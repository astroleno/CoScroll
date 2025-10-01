export const mochiShellFragmentShader = `
precision highp float;

uniform vec3 shellColor;
uniform float uAlpha;          // 基础透明度 (0.20~0.35)
uniform float uGlow;           // 发光强度 (0.25~0.45)
uniform float layerT;          // 0..1 层深（内→外）

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

float dither(vec2 coord) {
  return fract(sin(dot(coord, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);

  // Fresnel 驱动的软边 - 收窄范围到 0.10~0.75，让边缘更集中
  float f = 1.0 - max(dot(N, V), 0.0);
  float rim = smoothstep(0.10, 0.75, f + fwidth(f) * 1.5);

  // Alpha: 更透，不是更亮
  // 外层衰减但保持可见性
  float alpha = uAlpha * rim * pow(1.0 - layerT, 0.8);

  // 轻微抖动，避免带状
  alpha += (dither(gl_FragCoord.xy) - 0.5) * 0.012;
  alpha = clamp(alpha, 0.0, 0.65);

  // Glow: 受控的边缘发光，保留本色
  vec3 glowColor = shellColor * 1.15; // 轻微提亮
  vec3 baseColor = shellColor;
  vec3 glow = glowColor * rim * uGlow;
  vec3 color = mix(baseColor, glow, 0.6); // 60% glow，40% 本色

  // 表面粉感 - 细颗粒噪声，避免色带
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  color += (n - 0.5) * 0.004; // 0.4% 幅度的细颗粒

  // 限制最大亮度，防止炸白
  color = min(color, vec3(0.94));

  gl_FragColor = vec4(color, alpha);
}`;


