export const mochiFixedFragmentShader = `
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 color4;
uniform float fresnelPower;
uniform float alphaMax;       // 新增：核心最大透明度上限（0..1）
uniform float alphaBias;      // 新增：基础偏置，保证有厚度
uniform vec3 lightPosition;   // 光源位置（用于 SSS）
uniform float sssStrength;    // SSS 强度 (0.5~0.8)
uniform vec3 sssColor;        // SSS 颜色

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

// 简化的噪声函数（避免复杂的 Simplex Noise）
float simpleNoise(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.543))) * 43758.5453);
}

// Dither 函数
float dither(vec2 coord) {
  return fract(sin(dot(coord.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);

  // === 1. 基础4色渐变（Y轴） ===
  float yGradient = (vWorldPosition.y + 1.0) * 0.5;

  vec3 baseColor;
  if (yGradient < 0.33) {
    baseColor = mix(color1, color2, yGradient / 0.33);
  } else if (yGradient < 0.66) {
    baseColor = mix(color2, color3, (yGradient - 0.33) / 0.33);
  } else {
    baseColor = mix(color3, color4, (yGradient - 0.66) / 0.34);
  }

  // === 2. Fake SSS（体积散射）===
  vec3 L = normalize(lightPosition - vWorldPosition);
  float thickness = max(0.0, dot(-L, normal)); // 背光面透光
  vec3 sssContribution = sssColor * thickness * sssStrength;
  baseColor = mix(baseColor, baseColor + sssContribution, 0.6); // 模糊混合

  // === 3. Fresnel 边缘发光（轻微染色）===
  float f = 1.0 - max(dot(normal, viewDir), 0.0);
  float fres = pow(f, 2.0); // 使用更柔和的指数
  // 拉宽 smoothstep 范围，让边缘更模糊
  float rimMask = smoothstep(0.05, 0.85, f);
  vec3 rimColor = mix(color3, color4, 0.5);
  baseColor = mix(baseColor, rimColor, rimMask * 0.15);

  // === 4. 增强表面噪声（模拟 iceShader 的 roughness）===
  float noise1 = simpleNoise(vWorldPosition * 5.0);
  float noise2 = simpleNoise(vWorldPosition * 12.0 + vec3(100.0));
  float noise = (noise1 * 0.6 + noise2 * 0.4) * 0.08; // 增强到 8%
  baseColor += vec3(noise);

  // === 5. 增强 Dither 抖动（颗粒感）===
  float ditherValue = (dither(gl_FragCoord.xy) - 0.5) * 0.025;
  baseColor += vec3(ditherValue);

  // === 6. 透明度：拉宽 rim 范围，添加噪声打散边缘（麻薯模糊感）===
  float rimSoft = smoothstep(0.05, 0.85, f); // 用 f 而非 fres，范围更宽
  float alphaGradient = mix(1.0, 0.0, rimSoft); // 中心实、边缘透

  // 用噪声打散边缘，避免硬边
  float alphaNoise = simpleNoise(vWorldPosition * 200.0) * 0.05;
  float alpha = alphaBias + alphaMax * clamp(alphaGradient, 0.0, 1.0);
  alpha *= (0.95 + alphaNoise); // 噪声打散
  alpha = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(clamp(baseColor, 0.0, 1.0), alpha);
}
`;
