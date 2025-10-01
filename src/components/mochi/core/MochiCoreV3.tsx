'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mochiVertexShader } from '../shaders/mochi.vert';
import { mochiFragmentShader } from '../shaders/mochi.frag';

interface MochiCoreV3Props {
  radius: number;
  segments: number;
  autoRotate: boolean;
  rotationSpeed: number;
}

export default function MochiCoreV3({
  radius,
  segments,
  autoRotate,
  rotationSpeed
}: MochiCoreV3Props) {
  const meshRef = useRef<THREE.Mesh>(null);

  // 4 色配置（蓝 → 粉 → 橙 → 黄）
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      color1: { value: new THREE.Color('#a0c4ff') }, // 浅蓝
      color2: { value: new THREE.Color('#ffb3d9') }, // 粉色
      color3: { value: new THREE.Color('#ffcc99') }, // 橙色
      color4: { value: new THREE.Color('#fff5b8') }, // 浅黄
      roughness: { value: 0.85 },
      fresnelPower: { value: 3.0 },
      ditherStrength: { value: 0.02 },    // Dither 强度
      noiseScale: { value: 5.0 },         // 噪声尺度
      noiseStrength: { value: 0.04 }      // 噪声强度
    }),
    []
  );

  useFrame((state, delta) => {
    if (meshRef.current) {
      if (autoRotate) {
        meshRef.current.rotation.y += delta * rotationSpeed;
      }
      // 更新时间 uniform
      (meshRef.current.material as THREE.ShaderMaterial).uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef} renderOrder={0}>
      <sphereGeometry args={[radius, segments, segments]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={mochiVertexShader}
        fragmentShader={mochiFragmentShader}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}
