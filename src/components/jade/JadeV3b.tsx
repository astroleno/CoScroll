"use client";

import dynamic from "next/dynamic";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useEffect, useRef, useState } from "react";

const JadeV2 = dynamic(() => import("@/components/jade/JadeV2"), { ssr: false });

interface JadeV3bProps {
  modelPath?: string;
  hdrPath?: string;
  enableRotation?: boolean;      // 基础自转开关（默认开）
  showBackground?: boolean;      // 是否显示 HDRI（默认开）
  hdrExposure?: number;          // Canvas 全局曝光（默认 1）
  baseSpeed?: number;            // 基础自转速度（弧度/秒）
  speedMultiplier?: number;      // 滚动速度放大系数
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
  hdrPath = "/textures/qwantani_moon_noon_puresky_1k.hdr",
  enableRotation = true,
  showBackground = true,
  hdrExposure = 1.0,
  baseSpeed = 0.4,          // 默认缓慢自转
  speedMultiplier = 3.0,    // 滚动影响系数（提高灵敏度）
}: JadeV3bProps) {
  // 用一个小代理，把速度应用到 JadeV2 的内部 rotate（复用其 onFrame）
  // 方式：给 JadeV2 一个伪装的 autoRotate=true，然后在全局 useFrame 中追加 Y 轴旋转
  const groupRef = useRef<THREE.Group>(null);

  return (
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
            modelPath={modelPath}
            hdrPath={hdrPath}
            normalMapPath="/textures/normal.jpg"
            showBackground={showBackground}
            useDualPassRefraction={false}
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
  );
}


