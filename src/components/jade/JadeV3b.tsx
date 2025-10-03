"use client";

import dynamic from "next/dynamic";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const JadeV2 = dynamic(() => import("@/components/jade/JadeV2"), { ssr: false });

interface JadeV3bProps {
  modelPath?: string | string[];   // 支持单个或多个模型
  hdrPath?: string;
  enableRotation?: boolean;      // 基础自转开关（默认开）
  showBackground?: boolean;      // 是否显示 HDRI（默认开）
  hdrExposure?: number;          // Canvas 全局曝光（默认 1）
  baseSpeed?: number;            // 基础自转速度（弧度/秒）
  speedMultiplier?: number;      // 滚动速度放大系数
  showModelSwitcher?: boolean;   // 是否展示切换 UI（当传入数组时）
  initialIndex?: number;         // 初始索引
  allowCustomModel?: boolean;    // 是否允许添加自定义模型
  envYaw?: number;               // 环境贴图旋转（弧度）。若不传，则使用 v2 的默认自转
}

// Canvas 内部控制器：监听滚动并在 useFrame 中更新旋转
function ScrollRotator({
  groupRef,
  baseSpeed,
  speedMultiplier,
  enabled,
}: {
  groupRef: React.RefObject<THREE.Group>;
  baseSpeed: number;
  speedMultiplier: number;
  enabled: boolean;
}) {
  const { gl } = useThree();
  const prevScrollYRef = useRef(0);
  const targetSpeedRef = useRef(baseSpeed);
  const currentSpeedRef = useRef(baseSpeed);

  useEffect(() => {
    prevScrollYRef.current = window.scrollY || 0;
    const onScroll = () => {
      const y = window.scrollY || 0;
      const dy = y - prevScrollYRef.current;
      prevScrollYRef.current = y;
      const scrollVelocity = dy * 0.001; // 灵敏度
      targetSpeedRef.current = baseSpeed + scrollVelocity * speedMultiplier;
    };
    const onWheel = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 16 : 1; // 行→像素
      const scrollVelocity = e.deltaY * unit * 0.001; // 标准化
      targetSpeedRef.current = baseSpeed + scrollVelocity * speedMultiplier;
    };

    // 同时挂到 window 和 Canvas，确保事件被捕获
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    const el = gl.domElement as HTMLCanvasElement;
    const onWheelCanvas = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 16 : 1;
      const scrollVelocity = e.deltaY * unit * 0.001;
      targetSpeedRef.current = baseSpeed + scrollVelocity * speedMultiplier;
      e.preventDefault();
    };
    // 触摸端：用 touchmove 的 dy 作为增量，阻止默认页面滚动
    const lastTouchY = { v: 0 } as { v: number };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) lastTouchY.v = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches || e.touches.length === 0) return;
      const y = e.touches[0].clientY;
      const dy = lastTouchY.v - y; // 手指上滑→dy>0（对应滚轮下滑）
      lastTouchY.v = y;
      const scrollVelocity = dy * 0.02; // 移动端增益更大一点
      targetSpeedRef.current = baseSpeed + scrollVelocity * speedMultiplier;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheelCanvas, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      el.removeEventListener("wheel", onWheelCanvas);
      el.removeEventListener("touchstart", onTouchStart as any);
      el.removeEventListener("touchmove", onTouchMove as any);
    };
  }, [baseSpeed, speedMultiplier, gl]);

  useFrame((_, delta) => {
    if (!enabled) return;
    // 自然回落到基础速度
    targetSpeedRef.current += (baseSpeed - targetSpeedRef.current) * 0.02;
    // 平滑插值到目标速度
    currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * Math.min(1, delta * 10);
    if (groupRef.current) {
      groupRef.current.rotation.y += currentSpeedRef.current * delta;
    }
  });

  return null;
}

// 承载自转并将速度传给 JadeV2（通过其 autoRotate + 内部 useFrame 应用）
export default function JadeV3b({
  modelPath = "/models/10k_obj/001_空.obj",
  // 仅用于 IBL/反射的环境 HDR（按你的需求换成 dusk 版本）
  hdrPath = "/textures/qwantani_moon_noon_puresky_1k.hdr",
  enableRotation = true,
  showBackground = true,
  hdrExposure = 1.0,
  baseSpeed = 0.4,          // 默认缓慢自转
  speedMultiplier = 3.0,    // 滚动影响系数（提高灵敏度）
  showModelSwitcher = true,
  initialIndex = 0,
  allowCustomModel = true,
  envYaw,
}: JadeV3bProps) {
  // 用一个小代理，把速度应用到 JadeV2 的内部 rotate（复用其 onFrame）
  // 方式：给 JadeV2 一个伪装的 autoRotate=true，然后在全局 useFrame 中追加 Y 轴旋转
  const groupRef = useRef<THREE.Group>(null);

  // 统一处理“多个模型 + 切换 + 自定义添加”
  const models = Array.isArray(modelPath) ? modelPath.filter(Boolean) : [modelPath];
  const [index, setIndex] = useState(() => Math.max(0, Math.min(models.length - 1, initialIndex || 0)));
  const [userModelUrl, setUserModelUrl] = useState("");
  const [modelList, setModelList] = useState<string[]>(models);

  useEffect(() => {
    // 当外部传入变化时，同步内部列表与索引
    const next = Array.isArray(modelPath) ? modelPath.filter(Boolean) : [modelPath];
    setModelList(next);
    setIndex((old) => Math.max(0, Math.min(next.length - 1, old)));
  }, [modelPath]);

  const goPrev = () => setIndex((i) => (modelList.length ? (i - 1 + modelList.length) % modelList.length : 0));
  const goNext = () => setIndex((i) => (modelList.length ? (i + 1) % modelList.length : 0));
  const addCustomModel = () => {
    const url = userModelUrl.trim();
    if (!url) return;
    setModelList((lst) => {
      const next = [...lst, url];
      setIndex(next.length - 1);
      return next;
    });
    setUserModelUrl("");
  };

  // FPS 小窗
  // DOM 版 FPS：避免在 Canvas 内部渲染 DOM 造成 R3F 报错
  function FPSMeterDom() {
    const [fps, setFps] = useState(0);
    const running = useRef(true);
    useEffect(() => {
      running.current = true; // 兼容 React StrictMode 的双调用
      let last = performance.now();
      const samples: number[] = [];
      const loop = () => {
        if (!running.current) return;
        const now = performance.now();
        const dt = (now - last) / 1000;
        last = now;
        const current = dt > 0 ? 1 / dt : 0;
        samples.push(current);
        if (samples.length > 12) samples.shift();
        setFps(samples.reduce((a, b) => a + b, 0) / samples.length);
        requestAnimationFrame(loop);
      };
      const id = requestAnimationFrame(loop);
      return () => { running.current = false; cancelAnimationFrame(id); };
    }, []);
    return createPortal(
      <div style={{
        position: 'fixed', left: 8, top: 8, zIndex: 2147483646,
        background: 'rgba(0,0,0,0.55)', color: '#0f0',
        padding: '4px 6px', borderRadius: 6, fontSize: 12,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
      }}>
        {fps.toFixed(0)} fps
      </div>,
      document.body
    );
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const onPickFile = () => fileInputRef.current?.click();
  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      let url = URL.createObjectURL(f);
      // 为 blob: URL 追加扩展名标记，便于 JadeV2 正确选择 Loader
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (ext) url = `${url}#${ext}`;
      setModelList((lst) => {
        const next = [...lst, url];
        setIndex(next.length - 1);
        return next;
      });
    } catch {}
    // 重置 input 以便可重复选择同名文件
    e.target.value = "";
  };

  // envYaw 控件（UI 可调，若外部没传则用内部值；外部传入优先级更高）
  const [envYawInner, setEnvYawInner] = useState(0);
  const effectiveEnvYaw = typeof envYaw === 'number' ? envYaw : envYawInner;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} gl={{ toneMappingExposure: hdrExposure }}>
        <Suspense fallback={null}>
          <group ref={groupRef}>
          <ScrollRotator
            groupRef={groupRef}
            baseSpeed={baseSpeed}
            speedMultiplier={speedMultiplier}
            enabled={enableRotation}
          />
          <JadeV2
            modelPath={modelList[index]}
            hdrPath={hdrPath}
            // 背景维持原来的 moon_noon，不随 env HDR 更换
            backgroundHdrPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
            normalMapPath="/textures/normal.jpg"
            showBackground={showBackground}
            useDualPassRefraction={false}
            // 开启几何均匀化与一次细分，观察 FPS 影响
            maxEdge={0.15}
            subdivisions={0}
            envYaw={effectiveEnvYaw}
            // 与 v3 对齐的材质默认，避免边缘高光差异
            color={0xffffff}
            metalness={0.0}
            roughness={0.81}
            transmission={1.0}
            ior={1.5}
            reflectivity={0.38}
            thickness={1.1}
            envMapIntensity={1.4}
            clearcoat={0.0}
            clearcoatRoughness={1.0}
            normalScale={0.3}
            clearcoatNormalScale={0.2}
            normalRepeat={3}
            autoRotate={false} // 关闭内部原生自转，改用我们统一的速度控制
            />
          </group>
        </Suspense>
      </Canvas>
      {/* FPS 小窗（DOM 组件，位于 Canvas 外） */}
      <FPSMeterDom />

      {/* 模型切换与自定义添加 */}
      {(showModelSwitcher || allowCustomModel) && (
        <div style={{
          position: 'absolute', top: 8, right: 8, display: 'flex', gap: 8,
          alignItems: 'center', zIndex: 10,
          background: 'rgba(0,0,0,0.35)', padding: '6px 8px', borderRadius: 8, color: '#fff'
        }}>
          {showModelSwitcher && modelList.length > 1 && (
            <>
              <button onClick={goPrev} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #666', background: '#222', color: '#fff' }}>上一个</button>
              <span style={{ fontSize: 12, opacity: 0.9 }}>{index + 1} / {modelList.length}</span>
              <button onClick={goNext} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #666', background: '#222', color: '#fff' }}>下一个</button>
            </>
          )}
          {allowCustomModel && (
            <>
              <input
                value={userModelUrl}
                onChange={(e) => setUserModelUrl(e.target.value)}
                placeholder="输入自定义模型URL (.glb/.gltf/.obj)"
                style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #666', background: '#111', color: '#fff', minWidth: 240 }}
              />
              <button onClick={addCustomModel} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #666', background: '#2a2', color: '#fff' }}>添加</button>
              <button onClick={onPickFile} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #666', background: '#225', color: '#fff' }}>选择文件</button>
              <input ref={fileInputRef} type="file" accept=".glb,.gltf,.obj" style={{ display: 'none' }} onChange={onFileChange} />
            </>
          )}
          {/* envYaw 控件（弧度） */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>envYaw</span>
            <input
              type="range"
              min={-Math.PI}
              max={Math.PI}
              step={0.01}
              value={effectiveEnvYaw}
              onChange={(e) => setEnvYawInner(parseFloat(e.target.value))}
              disabled={typeof envYaw === 'number'}
            />
            <span style={{ width: 56, textAlign: 'right', fontSize: 12, opacity: 0.9 }}>{effectiveEnvYaw.toFixed(2)}</span>
            <button onClick={() => setEnvYawInner(0)} style={{ padding: '2px 6px', borderRadius: 6, border: '1px solid #666', background: '#222', color: '#fff' }}>0</button>
            <button onClick={() => setEnvYawInner(Math.PI/2)} style={{ padding: '2px 6px', borderRadius: 6, border: '1px solid #666', background: '#222', color: '#fff' }}>90°</button>
            <button onClick={() => setEnvYawInner(Math.PI)} style={{ padding: '2px 6px', borderRadius: 6, border: '1px solid #666', background: '#222', color: '#fff' }}>180°</button>
          </div>
        </div>
      )}
    </div>
  );
}


