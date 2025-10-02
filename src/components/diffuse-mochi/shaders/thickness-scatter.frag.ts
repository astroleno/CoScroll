/**
 * 厚度散射 Fragment Shader（简化版）
 * 借鉴subsurface refraction的核心思想：基于厚度的散射
 * 但不需要Cubemap、Parallax等复杂技术
 */

import { noise3DFunctions } from './noise3d.glsl';

export const thicknessScatterFragmentShader = /* glsl */ `
precision highp float;

${noise3DFunctions}

// Uniforms
uniform vec3 shellColor;
uniform vec3 mediumColor;         // 介质颜色（麻薯内部的糯米白）
uniform float uBaseAlpha;
uniform float uDensity;
uniform float uNoiseScale;
uniform float uScatterStrength;   // 散射强度
uniform float uThicknessBoost;    // 厚度增强系数
uniform float uFresnelPower;

// Varyings
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vObjectPosition;

void main() {
  // 1. Fresnel边缘检测
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vViewPosition);
  float fresnelDot = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - fresnelDot, uFresnelPower);

  // 2. 厚度估算（核心！）
  // 原理：视线越垂直于表面，穿透厚度越薄
  // fresnelDot: 正面=1（厚），侧面=0（薄）
  float thickness = pow(fresnelDot, uThicknessBoost);

  // 3. 基于厚度的散射计算
  // 薄处散射强（模糊），厚处散射弱（清晰）
  float scatterAmount = (1.0 - thickness) * uScatterStrength;

  // 4. 多尺度噪声（根据厚度调整细节）
  vec3 noiseCoord = vWorldPosition * uNoiseScale;

  // 厚处：粗颗粒（低频）
  float coarseNoise = perlinNoise3D(noiseCoord * 1.5);

  // 薄处：细颗粒（高频，模拟散射）
  float fineNoise = perlinNoise3D(noiseCoord * 6.0);

  // 根据散射量混合
  float noise = mix(coarseNoise, fineNoise, scatterAmount);

  // 噪声调制
  float noiseMult = mix(0.7, 1.3, noise);

  // 5. 密度计算（厚处更实，薄处更虚）
  float baseDensity = uDensity * thickness * noiseMult;

  // 边缘柔和消散
  float edgeFade = mix(0.3, 1.0, thickness);
  float density = baseDensity * edgeFade;

  // 6. 透明度
  float alpha = uBaseAlpha * density;

  // 限制上限（避免加法混合过曝）
  alpha = clamp(alpha, 0.0, 0.85);

  // 7. 颜色混合（表面色 vs 介质色）
  // 厚处：看到表面颜色
  // 薄处：光线穿透，看到内部介质色（糯米白）
  vec3 surfaceColor = shellColor;
  vec3 scatteredColor = mix(surfaceColor, mediumColor, scatterAmount * 0.7);

  // 温度渐变（厚处暖，薄处冷）
  vec3 warmTint = vec3(1.05, 1.0, 0.98);
  vec3 coolTint = vec3(0.98, 1.0, 1.05);
  vec3 tint = mix(warmTint, coolTint, scatterAmount);

  vec3 color = scatteredColor * tint;

  // 8. 边缘增亮（模拟散射）
  float edgeGlow = fresnel * (0.1 + scatterAmount * 0.15);
  color += vec3(edgeGlow);

  // 9. 微抖动
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  alpha += (dither - 0.5) * 0.015;

  // 10. 预乘alpha（配合加法混合）
  color *= alpha;

  gl_FragColor = vec4(color, alpha);
}
`;
