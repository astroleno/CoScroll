'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mochiVertexShader } from '../shaders/mochi.vert';
import { mochiFixedFragmentShader } from '../shaders/mochi-fixed.frag';

interface MochiCoreV3FixedProps {
  radius: number;
  segments: number;
  autoRotate: boolean;
  rotationSpeed: number;
}

export default function MochiCoreV3Fixed({
  radius,
  segments,
  autoRotate,
  rotationSpeed
}: MochiCoreV3FixedProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      color1: { value: new THREE.Color('#85b8ff') },  // 更深的蓝（强化冷色）
      color2: { value: new THREE.Color('#c4a0ff') },  // 紫粉（冷暖过渡）
      color3: { value: new THREE.Color('#ffb380') },  // 橙色（强化暖色）
      color4: { value: new THREE.Color('#ffe680') },  // 更深的黄（强化暖色）
      fresnelPower: { value: 3.0 },
      alphaMax: { value: 0.95 },    // 提高边缘最大透明度
      alphaBias: { value: 0.03 }    // 略降偏置，范围更大
    }),
    []
  );

  useFrame((state, delta) => {
    if (meshRef.current && autoRotate) {
      meshRef.current.rotation.y += delta * rotationSpeed;
    }
  });

  return (
    <mesh ref={meshRef} renderOrder={0}>
      <sphereGeometry args={[radius, segments, segments]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={mochiVertexShader}
        fragmentShader={mochiFixedFragmentShader}
        side={THREE.FrontSide}
        transparent
      />
    </mesh>
  );
}
