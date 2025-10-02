'use client';

import * as THREE from 'three';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { gradientVolumetricVertexShader } from './shaders/gradient-volumetric.vert';
import { gradientVolumetricFragmentShader } from './shaders/gradient-volumetric.frag';

/**
 * 渐变体积麻薯组件 - OBJ模型版本
 */

interface DiffuseMochiOBJProps {
  modelPath: string;
  shellColor?: string;
  baseAlpha?: number;
  density?: number;
  noiseScale?: number;
  noiseAmplitude?: number;
  thickness?: number;
  falloffPower?: number;
  fresnelPower?: number;
}

export default function DiffuseMochiOBJ({
  modelPath,
  shellColor = '#f0f0f0',
  baseAlpha = 1.0,
  density = 1.1,
  noiseScale = 2.0,
  noiseAmplitude = 0.0,
  thickness = 2.0,
  falloffPower = 5.0,
  fresnelPower = 3.1,
}: DiffuseMochiOBJProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载OBJ模型
  useEffect(() => {
    const loader = new OBJLoader();

    loader.load(
      modelPath,
      (obj) => {
        console.log('OBJ loaded:', obj);

        // 从OBJ中提取第一个mesh的geometry
        let foundGeometry: THREE.BufferGeometry | null = null;
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh && !foundGeometry) {
            foundGeometry = child.geometry;
            console.log('Found geometry:', foundGeometry);
          }
        });

        if (foundGeometry) {
          // 计算法线（如果没有）
          if (!foundGeometry.attributes.normal) {
            foundGeometry.computeVertexNormals();
          }

          // 居中和缩放
          foundGeometry.center();
          foundGeometry.computeBoundingBox();
          const bbox = foundGeometry.boundingBox!;
          const size = bbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.0 / maxDim; // 缩放到2个单位大小
          foundGeometry.scale(scale, scale, scale);

          setGeometry(foundGeometry);
          setLoading(false);
        } else {
          setError('No mesh found in OBJ file');
          setLoading(false);
        }
      },
      (progress) => {
        console.log('Loading:', (progress.loaded / progress.total) * 100 + '%');
      },
      (err) => {
        console.error('Error loading OBJ:', err);
        setError('Failed to load OBJ file');
        setLoading(false);
      }
    );
  }, [modelPath]);

  // 创建shader material
  const material = useMemo(() => {
    if (!geometry) return null;

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
    geometry,
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

  if (loading) {
    return (
      <group>
        <mesh>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshBasicMaterial color="#666666" wireframe />
        </mesh>
      </group>
    );
  }

  if (error || !geometry || !material) {
    console.error('Render error:', error);
    return (
      <group>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#ff0000" wireframe />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <mesh geometry={geometry} material={material} />
      {/* 辅助网格 */}
      <gridHelper args={[10, 10]} position={[0, -1.5, 0]} />
    </group>
  );
}
