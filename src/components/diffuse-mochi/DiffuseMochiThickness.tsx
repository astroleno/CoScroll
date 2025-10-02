'use client';

import * as THREE from 'three';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { gradientVolumetricVertexShader } from './shaders/gradient-volumetric.vert';
import { thicknessScatterFragmentShader } from './shaders/thickness-scatter.frag';

/**
 * 厚度散射麻薯组件（简化版）
 * 核心：基于视角估算厚度，厚处实心细颗粒，薄处半透散射
 */

interface DiffuseMochiThicknessProps {
  modelPath: string;
  shellColor?: string;
  mediumColor?: string;      // 介质颜色（内部糯米白）
  baseAlpha?: number;
  density?: number;
  noiseScale?: number;
  scatterStrength?: number;  // 散射强度
  thicknessBoost?: number;   // 厚度增强
  fresnelPower?: number;
}

export default function DiffuseMochiThickness({
  modelPath,
  shellColor = '#f0f0f0',
  mediumColor = '#f8f5f0',   // 糯米白
  baseAlpha = 0.7,
  density = 1.5,
  noiseScale = 2.0,
  scatterStrength = 0.8,
  thicknessBoost = 1.5,
  fresnelPower = 3.0,
}: DiffuseMochiThicknessProps) {
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

        let foundGeometry: THREE.BufferGeometry | null = null;
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh && !foundGeometry) {
            foundGeometry = child.geometry;
          }
        });

        if (foundGeometry) {
          if (!foundGeometry.attributes.normal) {
            foundGeometry.computeVertexNormals();
          }

          foundGeometry.center();
          foundGeometry.computeBoundingBox();
          const bbox = foundGeometry.boundingBox!;
          const size = bbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.0 / maxDim;
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
        mediumColor: { value: new THREE.Color(mediumColor) },
        uBaseAlpha: { value: baseAlpha },
        uDensity: { value: density },
        uNoiseScale: { value: noiseScale },
        uScatterStrength: { value: scatterStrength },
        uThicknessBoost: { value: thicknessBoost },
        uFresnelPower: { value: fresnelPower },
      },
      vertexShader: gradientVolumetricVertexShader,
      fragmentShader: thicknessScatterFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
  }, [
    geometry,
    shellColor,
    mediumColor,
    baseAlpha,
    density,
    noiseScale,
    scatterStrength,
    thicknessBoost,
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
      <gridHelper args={[10, 10]} position={[0, -1.5, 0]} />
    </group>
  );
}
