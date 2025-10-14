"use client";

import dynamic from "next/dynamic";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import OrientationGuard from "@/components/OrientationGuard";
import { Text } from "@react-three/drei";

// 动态引入 v2（包含高级材质与折射能力）
const JadeV2 = dynamic(() => import("@/components/jade/JadeV2"), { ssr: false });

interface JadeV5Props {
  // 模型路径：支持单个字符串或多个模型的数组
  modelPath?: string | string[];
  hdrPath?: string;
  enableRotation?: boolean;      // 基础自转开关
  showBackground?: boolean;      // 是否显示 HDRI
  hdrExposure?: number;          // Canvas 全局曝光
  baseSpeed?: number;            // 基础自转速度（弧度/秒）
  speedMultiplier?: number;      // 滚动/滑动速度放大系数
  externalVelocity?: number;     // 外部传入的速度增量

  // 切换器 UI
  showModelSwitcher?: boolean;   // 是否显示内置的模型切换按钮
  initialIndex?: number;         // 初始选中索引（当传入数组时生效）

  // 外层容器样式（可覆盖默认的 100vh 全屏）
  containerStyle?: React.CSSProperties;

  // 歌词文本
  currentLineText?: string;
  nextLineText?: string;
}

// Canvas 内控制器：监听滚动/滑动并在 useFrame 中更新旋转（与 v3b 一致）
function ScrollRotator({
  groupRef,
  baseSpeed,
  speedMultiplier,
  enabled,
  externalVelocity = 0,
}: {
  groupRef: React.RefObject<THREE.Group>;
  baseSpeed: number;
  speedMultiplier: number;
  enabled: boolean;
  externalVelocity?: number;
}) {
  const { gl } = useThree();
  const prevScrollYRef = useRef(0);
  const targetSpeedRef = useRef(baseSpeed);
  const currentSpeedRef = useRef(baseSpeed);
  const externalVelocityRef = useRef(externalVelocity);

  useEffect(() => {
    externalVelocityRef.current = externalVelocity;
  }, [externalVelocity]);

  useEffect(() => {
    targetSpeedRef.current = baseSpeed + externalVelocityRef.current;
  }, [baseSpeed, externalVelocity]);

  useEffect(() => {
    prevScrollYRef.current = window.scrollY || 0;
    const onScroll = () => {
      const y = window.scrollY || 0;
      const dy = y - prevScrollYRef.current;
      prevScrollYRef.current = y;
      const baseWithExternal = baseSpeed + externalVelocityRef.current;
      const scrollVelocity = dy * 0.001; // 灵敏度
      targetSpeedRef.current = baseWithExternal + scrollVelocity * speedMultiplier;
    };
    const onWheel = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 16 : 1; // 行→像素
      const baseWithExternal = baseSpeed + externalVelocityRef.current;
      const scrollVelocity = e.deltaY * unit * 0.001; // 标准化
      targetSpeedRef.current = baseWithExternal + scrollVelocity * speedMultiplier;
    };

    // 同时挂到 window 和 Canvas，确保事件被捕获
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    const el = gl.domElement as HTMLCanvasElement;
    const onWheelCanvas = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 16 : 1;
      const baseWithExternal = baseSpeed + externalVelocityRef.current;
      const scrollVelocity = e.deltaY * unit * 0.001;
      targetSpeedRef.current = baseWithExternal + scrollVelocity * speedMultiplier;
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
      const baseWithExternal = baseSpeed + externalVelocityRef.current;
      const scrollVelocity = dy * 0.02; // 移动端增益更大一点
      targetSpeedRef.current = baseWithExternal + scrollVelocity * speedMultiplier;
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
    const baseWithExternal = baseSpeed + externalVelocityRef.current;
    targetSpeedRef.current += (baseWithExternal - targetSpeedRef.current) * 0.02;
    // 平滑插值到目标速度
    currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * Math.min(1, delta * 10);
    if (groupRef.current) {
      groupRef.current.rotation.y += currentSpeedRef.current * delta;
    }
  });

  return null;
}

// v5：承载交互自转 + 使用 v2 的高级材质/折射；新增模型切换
export default function JadeV5({
  modelPath = "/models/10k_obj/001_空.obj",
  hdrPath = "/textures/qwantani_moon_noon_puresky_1k.hdr",
  enableRotation = true,
  showBackground = true,
  hdrExposure = 1.0,
  baseSpeed = 0.4,
  speedMultiplier = 3.0,
  externalVelocity = 0,
  showModelSwitcher = true,
  initialIndex = 0,
  containerStyle,
  currentLineText = "",
  nextLineText = "",
}: JadeV5Props) {
  const groupRef = useRef<THREE.Group>(null);

  // 归一化模型数组
  const models = useMemo(() => {
    try {
      const arr = Array.isArray(modelPath) ? modelPath : [modelPath];
      return arr.filter(Boolean);
    } catch (err) {
      console.error("[JadeV5] normalize modelPath error", err);
      return ["/models/10k_obj/001_空.obj"];
    }
  }, [modelPath]);

  const [index, setIndex] = useState(() => {
    try {
      if (!Array.isArray(models) || models.length === 0) return 0;
      const i = Math.max(0, Math.min(models.length - 1, initialIndex || 0));
      return i;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    // 当传入的模型数组变化时，确保索引在有效范围内
    setIndex((old) => {
      const n = models.length;
      if (n === 0) return 0;
      return Math.max(0, Math.min(n - 1, old));
    });
  }, [models]);

  const goPrev = () => setIndex((i) => (i - 1 + models.length) % models.length);
  const goNext = () => setIndex((i) => (i + 1) % models.length);

  // 默认让 Canvas 父容器占满一屏，避免只渲染一条窄带
  const wrapperStyle: React.CSSProperties = useMemo(() => ({
    position: "relative",
    width: "100%",
    height: "100vh",
    ...(containerStyle || {}),
  }), [containerStyle]);

  const trimmedCurrent = currentLineText.trim();
  const trimmedNext = nextLineText.trim();

  return (
    <div className="jv5-wrapper" style={wrapperStyle}>
      {/* 移动端横屏遮罩（只在移动端横屏时显示） */}
      <OrientationGuard />
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} gl={{ toneMappingExposure: hdrExposure }}>
    <Suspense fallback={null}>
      <group ref={groupRef}>
            <ScrollRotator
              groupRef={groupRef}
              baseSpeed={baseSpeed}
              speedMultiplier={speedMultiplier}
              enabled={enableRotation}
              externalVelocity={externalVelocity}
            />
            <JadeV2
              modelPath={models[index]}
              hdrPath={hdrPath}
              normalMapPath="/textures/normal.jpg"
              showBackground={showBackground}
              useDualPassRefraction={false}
              // 关闭几何细分与均匀化（maxEdge/subdivisions 全关）
              maxEdge={0}
              subdivisions={0}
              // 与 v3b 对齐的材质默认，避免边缘高光差异
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
              autoRotate={false}
            />
      </group>
      {trimmedNext && (
        <Text
          position={[0, -0.9, 0.9]}
          fontSize={0.32}
          maxWidth={3.2}
          lineHeight={1.3}
          anchorX="center"
          anchorY="middle"
          color="#dbe8ff"
          outlineWidth={0.006}
          outlineColor="rgba(15,37,68,0.6)"
        >
          {trimmedNext}
        </Text>
      )}
      {trimmedCurrent && (
        <Text
          position={[0, 0.6, -1.4]}
          fontSize={0.38}
          maxWidth={3.4}
          lineHeight={1.28}
          anchorX="center"
          anchorY="middle"
          color="#ffffff"
          outlineWidth={0.008}
          outlineColor="rgba(23,36,64,0.75)"
        >
          {trimmedCurrent}
        </Text>
      )}
    </Suspense>
      </Canvas>

      {showModelSwitcher && models.length > 1 && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            display: "flex",
            gap: 8,
            background: "rgba(0,0,0,0.35)",
            padding: "6px 8px",
            borderRadius: 8,
            color: "#fff",
            alignItems: "center",
            userSelect: "none",
          }}
        >
          <button
            onClick={goPrev}
            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #666", background: "#222", color: "#fff" }}
          >
            上一个
          </button>
          <span style={{ fontSize: 12, opacity: 0.9 }}>
            {index + 1} / {models.length}
          </span>
          <button
            onClick={goNext}
            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #666", background: "#222", color: "#fff" }}
          >
            下一个
          </button>
        </div>
      )}
      <style jsx global>{`
        /* 移动端：禁用文本选择与点击高亮，但不影响点击事件 */
        @media (pointer: coarse) {
          .jv5-wrapper { 
            -webkit-user-select: none; user-select: none; 
            -webkit-tap-highlight-color: transparent;
          }
        }
      `}</style>
    </div>
  );
}
