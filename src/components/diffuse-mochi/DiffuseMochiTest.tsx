'use client';

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import DepthPrepass from './DepthPrepass';
import VolumetricShells from './VolumetricShells';
import type { DiffuseMochiConfig } from './DiffuseMochiCore';

/**
 * DiffuseMochi 测试组件（使用简单球体）
 * 用于调试shader和参数
 */

interface DiffuseMochiTestProps {
  config?: DiffuseMochiConfig;
}

export default function DiffuseMochiTest({ config = {} }: DiffuseMochiTestProps) {
  const groupRef = useRef<THREE.Group>(null);

  // 创建简单球体geometry
  const geometry = useMemo(() => {
    return new THREE.SphereGeometry(1, 64, 64);
  }, []);

  // 自动旋转
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* 1. 深度预通道 (renderOrder=0) */}
      <DepthPrepass geometry={geometry} />

      {/* 2. 体积壳体 (renderOrder=1+) */}
      <VolumetricShells geometry={geometry} {...config} />

      {/* 调试：添加辅助网格 */}
      <gridHelper args={[10, 10]} position={[0, -1.5, 0]} />
    </group>
  );
}
