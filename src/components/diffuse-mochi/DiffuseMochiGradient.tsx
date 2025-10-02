'use client';

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { gradientVolumetricVertexShader } from './shaders/gradient-volumetric.vert';
import { gradientVolumetricFragmentShader } from './shaders/gradient-volumetric.frag';

/**
 * 渐变体积麻薯组件
 * 使用连续渐变而不是多层离散壳体
 */

interface DiffuseMochiGradientProps {
  shellColor?: string;
  baseAlpha?: number;
  density?: number;
  noiseScale?: number;
  noiseAmplitude?: number;
  thickness?: number;
  falloffPower?: number;
  fresnelPower?: number;
}

export default function DiffuseMochiGradient({
  shellColor = '#f0f0f0',
  baseAlpha = 0.7,
  density = 1.2,
  noiseScale = 2.0,
  noiseAmplitude = 0.3,
  thickness = 2.0,
  falloffPower = 2.5,
  fresnelPower = 3.0,
}: DiffuseMochiGradientProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  // 创建球体geometry
  const geometry = useMemo(() => {
    return new THREE.SphereGeometry(1.0, 64, 64);
  }, []);

  // 创建shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        shellColor: { value: new THREE.Color(shellColor) },
        uBaseAlpha: { value: baseAlpha },
        uDensity: { value: density },
        uNoiseScale: { value: noiseScale },
        uNoiseAmplitude: { value: noiseAmplitude },
        uThickness: { value: thickness },
        uFalloffPower: { value: falloffPower },
        uFresnelPower: { value: fresnelPower },
      },
      vertexShader: gradientVolumetricVertexShader,
      fragmentShader: gradientVolumetricFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, // 改用加法混合，重叠变亮
    });
  }, [
    shellColor,
    baseAlpha,
    density,
    noiseScale,
    noiseAmplitude,
    thickness,
    falloffPower,
    fresnelPower,
  ]);

  // 自动旋转
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <mesh ref={meshRef} geometry={geometry} material={material} />
      {/* 辅助网格 */}
      <gridHelper args={[10, 10]} position={[0, -1.5, 0]} />
    </group>
  );
}
