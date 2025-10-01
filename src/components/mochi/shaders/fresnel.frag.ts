export const fresnelFragmentShader = `
uniform vec3 glowColor;
uniform float fresnelPower;
uniform float rimStart;
uniform float rimEnd;
uniform float glowIntensity;
uniform float ditherStrength;

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;

// 蓝噪声 dither（抗色带）
float dither(vec2 coord) {
  return fract(sin(dot(coord.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // Fresnel 计算
  float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), fresnelPower);

  // 控制边缘宽度
  float rim = smoothstep(rimStart, rimEnd, fresnel);

  // 添加噪声抖动（破坏色带）
  float noise = dither(gl_FragCoord.xy);
  rim += (noise - 0.5) * ditherStrength;
  rim = clamp(rim, 0.0, 1.0);

  // 发光颜色
  vec3 glow = rim * glowColor * glowIntensity;

  // 边缘更不透明（创造体积感）
  float alpha = rim * 0.6;

  gl_FragColor = vec4(glow, alpha);
}
`;
