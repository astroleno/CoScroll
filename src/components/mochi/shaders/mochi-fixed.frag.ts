export const mochiFixedFragmentShader = `
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 color4;
uniform float fresnelPower;

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

  // === 2. Fresnel 边缘发光 ===
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), fresnelPower);
  float rimMask = smoothstep(0.3, 0.85, fresnel);

  // 边缘加暖色
  vec3 rimColor = mix(color3, color4, 0.5);
  baseColor = mix(baseColor, rimColor, rimMask * 0.35);

  // === 3. 增强表面噪声（绒毛感）===
  // 双层噪声叠加
  float noise1 = simpleNoise(vWorldPosition * 5.0);
  float noise2 = simpleNoise(vWorldPosition * 12.0 + vec3(100.0));
  float noise = (noise1 * 0.6 + noise2 * 0.4) * 0.05; // 提高到 5%
  baseColor += vec3(noise);

  // === 4. 增强 Dither 抖动（颗粒感）===
  float ditherValue = (dither(gl_FragCoord.xy) - 0.5) * 0.025; // 提高到 2.5%
  baseColor += vec3(ditherValue);

  gl_FragColor = vec4(clamp(baseColor, 0.0, 1.0), 1.0);
}
`;
