'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  simplexNoise3D,
  gradientVertexInjection,
  gradientFragmentInjection
} from '../shaders/gradient.glsl';

interface MochiCoreProps {
  radius: number;
  segments: number;
  roughness: number;
  transmission: number;
  thickness: number;
  baseColor: string;
  attenuationColor: string;
  autoRotate: boolean;
  rotationSpeed: number;
  enableTransmission: boolean;
}

export default function MochiCore({
  radius,
  segments,
  roughness,
  transmission,
  thickness,
  baseColor,
  attenuationColor,
  autoRotate,
  rotationSpeed,
  enableTransmission
}: MochiCoreProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // 创建带渐变的材质
  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: roughness,
      metalness: 0,
      transmission: enableTransmission ? transmission : 0,
      transparent: !enableTransmission,
      opacity: enableTransmission ? 1 : 0.7,
      thickness: thickness,
      attenuationColor: new THREE.Color(attenuationColor),
      attenuationDistance: 0.5,
      envMapIntensity: 0.6,
      side: THREE.FrontSide
    });

    // 注入自定义渐变 shader
    mat.onBeforeCompile = (shader) => {
      // 检查是否已经定义了 vWorldPosition（transmission 会自动定义）
      const hasWorldPosition = shader.vertexShader.includes('varying vec3 vWorldPosition');

      // 只在没有定义时添加 varying
      if (!hasWorldPosition) {
        shader.vertexShader = `
          varying vec3 vWorldPosition;
          ${shader.vertexShader}
        `;
        shader.fragmentShader = `
          varying vec3 vWorldPosition;
          ${shader.fragmentShader}
        `;
      }

      // 添加 vWorldNormal
      shader.vertexShader = `
        varying vec3 vWorldNormal;
        ${shader.vertexShader}
      `;
      shader.fragmentShader = `
        varying vec3 vWorldNormal;
        ${shader.fragmentShader}
      `;

      // 在 vertex shader 的 main 函数结束前注入
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        ${gradientVertexInjection}
        `
      );

      // Fragment shader 添加 noise 函数
      shader.fragmentShader = `
        ${simplexNoise3D}
        ${shader.fragmentShader}
      `;

      // 在 diffuseColor 计算之后注入渐变
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        ${gradientFragmentInjection}
        `
      );
    };

    return mat;
  }, [roughness, transmission, thickness, baseColor, attenuationColor, enableTransmission]);

  useFrame((state, delta) => {
    if (autoRotate && meshRef.current) {
      meshRef.current.rotation.y += delta * rotationSpeed;
    }
  });

  return (
    <mesh ref={meshRef} renderOrder={0} material={material}>
      <sphereGeometry args={[radius, segments, segments]} />
    </mesh>
  );
}
