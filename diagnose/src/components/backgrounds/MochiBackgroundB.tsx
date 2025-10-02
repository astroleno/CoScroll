'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MOCHI_B_VERTEX, MOCHI_B_FRAGMENT } from './MochiBackgroundBShader';

export interface MochiBackgroundBProps {
  speed?: number;              // 时间推进速度倍数，默认 1
  noiseScale?: number;         // 噪声尺度，默认 1.25
  colorCycleSpeed?: number;    // 主体颜色循环速度，默认 0.25
  bgCycleSpeed?: number;       // 背景颜色循环速度，默认 0.2
  grainStrength?: number;      // 颗粒强度 0..0.2，默认 0.06
  grainScale?: number;         // 颗粒尺寸 1..4，默认 2
  scale?: number;              // 背景缩放比例，默认 1.0
}

/**
 * MochiBackgroundB
 * - 独立背景组件：全屏四边形渲染，基于三方 GLSL 片元思路（无音频）
 * - 不包含音频依赖；仅依赖时间推进与少量可调参数
 */
export default function MochiBackgroundB({
  speed = 1,
  noiseScale = 1.25,
  colorCycleSpeed = 0.25,
  bgCycleSpeed = 0.2,
  grainStrength = 0.06,
  grainScale = 2.0,
  scale = 1.0,
}: MochiBackgroundBProps) {
  const { viewport, size } = useThree();

  // 统一 uniforms（用 ref 保存，避免对象替换导致 material 失效）
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uNoiseScale: { value: noiseScale },
    uColorCycle: { value: colorCycleSpeed },
    uBgCycle: { value: bgCycleSpeed },
    uGrainStrength: { value: grainStrength },
    uGrainScale: { value: grainScale },
    uScale: { value: scale },
  }), [noiseScale, colorCycleSpeed, bgCycleSpeed, grainStrength, grainScale, scale]);

  // 同步外部 props 到 uniforms（避免重建材质）
  useEffect(() => { uniforms.uNoiseScale.value = noiseScale; }, [noiseScale, uniforms]);
  useEffect(() => { uniforms.uColorCycle.value = colorCycleSpeed; }, [colorCycleSpeed, uniforms]);
  useEffect(() => { uniforms.uBgCycle.value = bgCycleSpeed; }, [bgCycleSpeed, uniforms]);
  useEffect(() => { uniforms.uGrainStrength.value = grainStrength; }, [grainStrength, uniforms]);
  useEffect(() => { uniforms.uGrainScale.value = grainScale; }, [grainScale, uniforms]);
  useEffect(() => { uniforms.uScale.value = scale; }, [scale, uniforms]);

  // 依据画布尺寸更新分辨率（像素）
  useEffect(() => {
    try {
      const w = Math.max(1, Math.floor(size.width * (window?.devicePixelRatio || 1)));
      const h = Math.max(1, Math.floor(size.height * (window?.devicePixelRatio || 1)));
      uniforms.uResolution.value.set(w, h);
    } catch (e) {
      console.error('[MochiBackgroundB] 更新分辨率失败', e);
    }
  }, [size.width, size.height, uniforms]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    vertexShader: MOCHI_B_VERTEX,
    fragmentShader: MOCHI_B_FRAGMENT,
    depthWrite: false,
    depthTest: false,
    transparent: false,
  }), [uniforms]);

  const meshRef = useRef<THREE.Mesh>(null);

  // 时间推进
  useFrame((_, delta) => {
    uniforms.uTime.value += delta * Math.max(0, speed);
  });

  // 以一个位于相机前的全屏平面呈现
  return (
    <mesh ref={meshRef} position={[0, 0, -1]} renderOrder={-2} frustumCulled={false}>
      <planeGeometry args={[2.4, 2.4]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}


