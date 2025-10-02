'use client';

import * as THREE from 'three';
import { useRef } from 'react';

/**
 * 深度预通道组件
 * 目的：先写入深度信息，防止半透明材质自遮挡时发白
 * 渲染顺序：必须在 VolumetricShells 之前（renderOrder=0）
 */

interface DepthPrepassProps {
  geometry: THREE.BufferGeometry;
}

export default function DepthPrepass({ geometry }: DepthPrepassProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh ref={meshRef} geometry={geometry} renderOrder={0}>
      <meshDepthMaterial
        depthPacking={THREE.RGBADepthPacking}
        // 关键配置：只写深度，不输出颜色
        colorWrite={false}
        depthWrite={true}
        transparent={false}
      />
    </mesh>
  );
}
