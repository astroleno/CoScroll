/**
 * 渐变体积 Fragment Shader
 * 核心思路：单层mesh，在shader内计算到表面的距离，实现连续渐变
 */

import { noise3DFunctions } from './noise3d.glsl';

export const gradientVolumetricFragmentShader = /* glsl */ `
precision highp float;

${noise3DFunctions}

// Uniforms
uniform vec3 shellColor;
uniform float uBaseAlpha;
uniform float uDensity;
uniform float uNoiseScale;
uniform float uNoiseAmplitude;
uniform float uThickness;        // 体积厚度
uniform float uFalloffPower;     // 衰减曲线
uniform float uFresnelPower;

// Varyings
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vObjectPosition;    // 物体空间坐标

void main() {
  // 1. Fresnel边缘检测
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vViewPosition);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), uFresnelPower);

  // 2. 距离衰减：从表面到内部的连续渐变
  // 使用视线深度作为厚度近似
  float viewDepth = length(vViewPosition);
  float depthFactor = smoothstep(0.0, uThickness, viewDepth);

  // 3. 多频率噪声叠加（方案A：模拟麻薯内部颗粒结构）
  vec3 noiseCoord = vWorldPosition * uNoiseScale;

  // 大颗粒（主要结构）
  float noise1 = perlinNoise3D(noiseCoord * 1.0);

  // 中颗粒（细节层次）
  float noise2 = perlinNoise3D(noiseCoord * 2.5);

  // 细颗粒（表面质感）
  float noise3 = perlinNoise3D(noiseCoord * 6.0);

  // 叠加：50% 大 + 30% 中 + 20% 细
  float noise = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;

  float noiseMult = mix(1.0 - uNoiseAmplitude, 1.0 + uNoiseAmplitude, noise);

  // 4. 法线调制（方案B：不同角度不同透明度，增强立体感）
  // 垂直表面（法线朝上）更实，水平表面更虚
  vec3 upVector = vec3(0.0, 1.0, 0.0);
  float normalAngle = abs(dot(N, upVector));
  float normalModulation = mix(0.85, 1.15, normalAngle); // 水平85% → 垂直115%

  // 5. 组合密度：Fresnel + 法线调制 + 噪声
  // fresnel: 正面=0（中心），侧面=1（边缘）
  // 反转：中心密度高，边缘密度低
  float viewAngleDensity = pow(1.0 - fresnel, uFalloffPower);

  // 结合所有因素
  float density = uDensity * viewAngleDensity * noiseMult * normalModulation;

  // 6. 最终透明度（优化重叠效果）
  // 降低alpha上限，避免加法混合过曝
  float alpha = uBaseAlpha * density;
  alpha = min(alpha, 0.8); // 限制最大alpha，防止重叠过亮

  // 7. 微抖动
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  alpha += (dither - 0.5) * 0.02;
  alpha = clamp(alpha, 0.0, 1.0);

  // 8. 颜色：中心略暖，边缘略冷（增强体积感）
  vec3 centerColor = shellColor * vec3(1.08, 1.0, 0.95); // 微暖
  vec3 edgeColor = shellColor * vec3(0.95, 1.0, 1.08);   // 微冷
  vec3 color = mix(centerColor, edgeColor, fresnel);

  // 9. 边缘轻微增亮（模拟散射）
  color += vec3(fresnel * 0.08 * density);

  // 10. 加法混合优化：预乘alpha，让重叠更自然
  // 重叠区域会亮度累加但有上限
  color *= alpha; // Pre-multiplied alpha for additive blending

  gl_FragColor = vec4(color, alpha);
}
`;
