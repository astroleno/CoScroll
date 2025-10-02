'use client';

import * as THREE from 'three';
import { useRef, useMemo } from 'react';
import { shellVolumetricVertexShader } from './shaders/shell-volumetric.vert';
import { shellVolumetricFragmentShader } from './shaders/shell-volumetric.frag';

/**
 * 体积壳体组件
 * 实现：多层半透明壳体，通过Fresnel + 噪声 + 密度梯度实现麻薯质感
 */

interface VolumetricShellsProps {
  geometry: THREE.BufferGeometry;
  shellCount?: number; // 壳体层数（MVP默认2层）
  shellThickness?: number; // 壳体厚度
  shellColor?: string; // 基础颜色
  // 文档中的核心参数
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

export default function VolumetricShells({
  geometry,
  shellCount = 2, // MVP: 2层
  shellThickness = 0.02,
  shellColor = '#f5f5f5',
  baseAlpha = 0.6,
  density = 0.6,
  noiseScale = 1.0,
  noiseAmplitude = 0.3,
  alphaCurveExp = 2.5,
  fresnelPower = 2.5,
  fresnelThreshold = [0.2, 0.8],
  densityInner = 1.2,
  densityOuter = 0.4,
  colorTempInner = [1.05, 1.0, 0.98],
  colorTempOuter = [0.98, 1.0, 1.02],
}: VolumetricShellsProps) {
  const groupRef = useRef<THREE.Group>(null);

  // 为每层创建材质（带随机偏移抖动）
  const shells = useMemo(() => {
    console.log('Creating volumetric shells:', {
      shellCount,
      shellThickness,
      shellColor,
    });
    return Array.from({ length: shellCount }, (_, index) => {
      // 核心改进：每层添加随机偏移，打破规律性（文档挑战1-解决方案3）
      const randomOffset = (Math.random() - 0.5) * 0.15; // ±15%随机偏移
      const jitteredIndex = index + randomOffset;

      const uniforms = {
        shellThickness: { value: shellThickness },
        shellCount: { value: shellCount },
        shellIndex: { value: jitteredIndex }, // 使用抖动后的索引
        shellColor: { value: new THREE.Color(shellColor) },
        uBaseAlpha: { value: baseAlpha / Math.sqrt(shellCount) }, // 根据层数自适应降低alpha
        uDensity: { value: density },
        uNoiseScale: { value: noiseScale },
        uNoiseAmplitude: { value: noiseAmplitude },
        uAlphaCurveExp: { value: alphaCurveExp },
        uFresnelPower: { value: fresnelPower },
        uFresnelThreshold: { value: new THREE.Vector2(...fresnelThreshold) },
        uDensityInner: { value: densityInner },
        uDensityOuter: { value: densityOuter },
        uColorTempInner: { value: new THREE.Vector3(...colorTempInner) },
        uColorTempOuter: { value: new THREE.Vector3(...colorTempOuter) },
      };

      return {
        index,
        material: new THREE.ShaderMaterial({
          uniforms,
          vertexShader: shellVolumetricVertexShader,
          fragmentShader: shellVolumetricFragmentShader,
          transparent: true,
          depthWrite: false,
          depthTest: true,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, // 改用加法混合，更柔和
        }),
      };
    });
  }, [
    shellCount,
    shellThickness,
    shellColor,
    baseAlpha,
    density,
    noiseScale,
    noiseAmplitude,
    alphaCurveExp,
    fresnelPower,
    fresnelThreshold,
    densityInner,
    densityOuter,
    colorTempInner,
    colorTempOuter,
  ]);

  return (
    <group ref={groupRef}>
      {shells.map(({ index, material }) => (
        <mesh
          key={index}
          geometry={geometry}
          material={material}
          renderOrder={1 + index} // 在深度预pass之后渲染
        />
      ))}
    </group>
  );
}
