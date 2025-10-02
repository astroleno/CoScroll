'use client';

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * 超简单测试版本 - 验证基础渲染
 */

export default function DiffuseMochiSimple() {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => new THREE.SphereGeometry(1.2, 64, 64), []);

  // 自动旋转
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group>
      {/* 测试：普通材质 - 半透明白色球体 */}
      <mesh ref={meshRef} geometry={geometry} position={[0, 0, 0]}>
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.7}
          roughness={0.1}
          metalness={0.0}
          emissive="#ffe0f0"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* 辅助：网格地面 */}
      <gridHelper args={[10, 10]} position={[0, -1.5, 0]} />
    </group>
  );
}
