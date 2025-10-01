'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface GradientBackgroundProps {
  colors: [string, string];
}

export default function GradientBackground({ colors }: GradientBackgroundProps) {
  const uniforms = useMemo(
    () => ({
      color1: { value: new THREE.Color(colors[0]) }, // 中心色
      color2: { value: new THREE.Color(colors[1]) }, // 边缘色
      color3: { value: new THREE.Color('#f5e6ff') }  // 中间过渡色（淡紫）
    }),
    [colors]
  );

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    varying vec2 vUv;

    // 简易噪声函数
    float noise(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      // 径向渐变（从中心到边缘）
      vec2 center = vec2(0.5, 0.5);
      float dist = length(vUv - center) * 1.2; // 稍微扩大范围

      // 三层渐变：中心 → 中间 → 边缘
      vec3 color = mix(color1, color3, smoothstep(0.0, 0.6, dist));
      color = mix(color, color2, smoothstep(0.6, 1.2, dist));

      // 添加细微噪点（避免色带）
      float n = noise(vUv * 500.0) * 0.008;
      color += vec3(n);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return (
    <mesh position={[0, 0, -5]} renderOrder={-1}>
      <planeGeometry args={[100, 100]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthWrite={false}
      />
    </mesh>
  );
}
