'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

export default function GradientBackgroundV3() {
  const uniforms = useMemo(
    () => ({
      colorTop: { value: new THREE.Color('#c8e8ff') },      // 更深的青蓝（冷色）
      colorMid1: { value: new THREE.Color('#d4e8ff') },     // 浅蓝（冷色）
      colorMid2: { value: new THREE.Color('#ffe0f0') },     // 粉色（中性）
      colorMid3: { value: new THREE.Color('#fff0e0') },     // 橙白（暖色）
      colorBottom: { value: new THREE.Color('#f5e6ff') }    // 淡紫（中性偏暖）
    }),
    []
  );

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 colorTop;
    uniform vec3 colorMid1;
    uniform vec3 colorMid2;
    uniform vec3 colorMid3;
    uniform vec3 colorBottom;
    varying vec2 vUv;

    // 简易噪声
    float noise(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 center = vec2(0.5, 0.5);
      float dist = length(vUv - center);

      // Y 轴渐变（上下方向）
      float yGradient = vUv.y;

      // 径向影响
      float radial = smoothstep(0.0, 1.2, dist);

      // 5 层混合：上（冷）→ 中1（冷）→ 中2（粉）→ 中3（橙）→ 下（紫）
      vec3 color;
      if (yGradient < 0.25) {
        color = mix(colorTop, colorMid1, yGradient / 0.25);
      } else if (yGradient < 0.5) {
        color = mix(colorMid1, colorMid2, (yGradient - 0.25) / 0.25);
      } else if (yGradient < 0.75) {
        color = mix(colorMid2, colorMid3, (yGradient - 0.5) / 0.25);
      } else {
        color = mix(colorMid3, colorBottom, (yGradient - 0.75) / 0.25);
      }

      // 径向叠加（边缘加暖色）
      color = mix(color, colorMid3, radial * 0.15);

      // 增强噪点（颗粒感）
      float n = noise(vUv * 800.0) * 0.015;
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
