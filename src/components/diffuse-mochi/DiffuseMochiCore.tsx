'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import DepthPrepass from './DepthPrepass';
import VolumetricShells from './VolumetricShells';

/**
 * DiffuseMochi 核心组件
 * 整合：深度预pass + 多层体积壳体
 */

export interface DiffuseMochiConfig {
  shellCount?: number;
  shellThickness?: number;
  shellColor?: string;
  baseAlpha?: number;
  density?: number;
  noiseScale?: number;
  noiseAmplitude?: number;
  alphaCurveExp?: number;
  fresnelPower?: number;
  fresnelThreshold?: [number, number];
  densityInner?: number;
  densityOuter?: number;
  colorTempInner?: [number, number, number];
  colorTempOuter?: [number, number, number];
}

interface DiffuseMochiCoreProps {
  modelPath: string;
  config?: DiffuseMochiConfig;
  autoRotate?: boolean;
  rotationSpeed?: number;
}

export default function DiffuseMochiCore({
  modelPath,
  config = {},
  autoRotate = true,
  rotationSpeed = 0.5,
}: DiffuseMochiCoreProps) {
  const groupRef = useRef<THREE.Group>(null);

  // 加载模型（带错误处理）
  let gltf;
  try {
    gltf = useGLTF(modelPath);
  } catch (error) {
    console.error('Failed to load model:', modelPath, error);
    return null;
  }

  const { scene } = gltf;

  // 提取第一个mesh的geometry
  let geometry: THREE.BufferGeometry | null = null;
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && !geometry) {
      geometry = child.geometry;
      console.log('Found geometry:', geometry);
    }
  });

  // 自动旋转
  useFrame((state, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * rotationSpeed;
    }
  });

  if (!geometry) {
    console.error('No geometry found in model:', modelPath);
    console.log('Scene children:', scene.children);
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="red" />
      </mesh>
    );
  }

  return (
    <group ref={groupRef}>
      {/* 1. 深度预通道 (renderOrder=0) */}
      <DepthPrepass geometry={geometry} />

      {/* 2. 体积壳体 (renderOrder=1+) */}
      <VolumetricShells geometry={geometry} {...config} />
    </group>
  );
}
