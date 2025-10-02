/**
 * Shell Volumetric 片元着色器
 * 实现：Fresnel边缘检测 + 指数透明度 + 3D噪声 + 密度梯度
 */

import { noise3DFunctions } from './noise3d.glsl';

export const shellVolumetricFragmentShader = /* glsl */ `
precision highp float;

${noise3DFunctions}

// Uniforms
uniform vec3 shellColor;           // 基础颜色
uniform float uBaseAlpha;          // 基础透明度
uniform float uDensity;            // 密度基准
uniform float uNoiseScale;         // 噪声缩放
uniform float uNoiseAmplitude;     // 噪声强度（0-1）
uniform float uAlphaCurveExp;      // 透明度曲线指数 (2.5-3.5)
uniform float uFresnelPower;       // Fresnel锐度 (2.5-3.0)
uniform vec2 uFresnelThreshold;    // Fresnel双阈值 [0.2, 0.8]
uniform float uDensityInner;       // 内层密度 (1.2)
uniform float uDensityOuter;       // 外层密度 (0.4)
uniform vec3 uColorTempInner;      // 内层色温 [1.05, 1.0, 0.98]
uniform vec3 uColorTempOuter;      // 外层色温 [0.98, 1.0, 1.02]

// Varyings
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying float vShellT;

void main() {
  // 1. Fresnel 边缘检测（挑战2：实心→半透渐变）
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vViewPosition);

  float fresnelDot = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - fresnelDot, uFresnelPower);

  // 双阈值平滑：中心实心，边缘透明
  float rim = smoothstep(uFresnelThreshold.x, uFresnelThreshold.y, fresnel);

  // 2. 密度梯度（挑战2：内实外虚）
  float density = uDensity * mix(uDensityInner, uDensityOuter, vShellT);

  // 3. 3D 噪声扰动（挑战1：打破规律性）
  vec3 noiseCoord = vWorldPosition * uNoiseScale + vec3(0.0, 0.0, vShellT * 10.0);
  float noise = perlinNoise3D(noiseCoord);

  // 噪声映射到 [1-amplitude, 1+amplitude] 范围
  float noiseMultiplier = mix(1.0 - uNoiseAmplitude, 1.0 + uNoiseAmplitude, noise);
  density *= noiseMultiplier;

  // 4. 指数透明度曲线（挑战1：层间融合）
  // 外层更透明，使用指数曲线而非线性
  float alphaCurve = pow(1.0 - vShellT, uAlphaCurveExp);

  // 修改：让中心有基础可见度（0.5） + 边缘Fresnel增强（0.5）
  // 而不是完全由rim控制（会导致中心完全透明）
  float visibilityMix = 0.5 + 0.5 * rim;
  float alpha = uBaseAlpha * alphaCurve * visibilityMix * density;

  // 微抖动，减少带状
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  alpha += (dither - 0.5) * 0.01;
  alpha = clamp(alpha, 0.0, 1.0);

  // 5. 颜色温度渐变（挑战1：内暖外冷）
  vec3 colorTemp = mix(uColorTempInner, uColorTempOuter, vShellT);
  vec3 color = shellColor * colorTemp;

  // 6. 移除边缘增亮，改为边缘透明消散
  // 边缘应该是透明+柔和，不是发光
  // color += vec3(fresnel * 0.15); // 移除发光效果

  gl_FragColor = vec4(color, alpha);
}
`;
