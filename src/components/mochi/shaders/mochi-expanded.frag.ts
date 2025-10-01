export const mochiExpandedFragmentShader = `
precision highp float;

uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 color4;
uniform float shellOffset;
uniform float shellOpacity;
uniform float shellMaxOffset;
uniform vec3 shellColor;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vObjectPosition;
varying vec2 vUv;
varying float vShellLayer;

// 简化噪声函数
float simpleNoise(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

// 抖动函数
float dither(vec2 coord) {
  return fract(sin(dot(coord, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  
  // 基础4色渐变（内核）-- 使用物体空间Y轴，随物体旋转
  vec3 baseColor;
  float yGradient = (vObjectPosition.y + 1.0) * 0.5;
  
  if (yGradient < 0.33) {
    baseColor = mix(color1, color2, yGradient / 0.33);
  } else if (yGradient < 0.66) {
    baseColor = mix(color2, color3, (yGradient - 0.33) / 0.33);
  } else {
    baseColor = mix(color3, color4, (yGradient - 0.66) / 0.34);
  }
  
  // 降低内核饱和度，增加糯米感
  baseColor = mix(baseColor, vec3(0.9), 0.3);
  
  // 噪声质感（跟随物体）
  float noise1 = simpleNoise(vObjectPosition * 6.0);
  float noise2 = simpleNoise(vObjectPosition * 14.0 + 100.0);
  float noise = (noise1 * 0.6 + noise2 * 0.4) * 0.04;
  
  // 抖动
  float ditherValue = (dither(gl_FragCoord.xy) - 0.5) * 0.025;
  
  // 外壳层处理
  if (shellOffset > 0.0) {
    // 归一化层深（0=最内壳，1=最外壳）
    float layerT = clamp(shellOffset / max(shellMaxOffset, 1e-6), 0.0, 1.0);
    // 外壳颜色（偏冷色，冰凉糯感），叠加随Y的微渐变
    vec3 shellBaseColor = mix(shellColor, vec3(0.8, 0.9, 1.0), 0.4);
    float shellY = (vObjectPosition.y + 1.0) * 0.5;
    shellBaseColor = mix(shellBaseColor, vec3(1.0, 0.92, 0.85), 0.25 * (1.0 - shellY)); // 下暖上冷
    
    // 外壳透明度（外层显著降低），q 越大外层越淡
    float q = 1.8;
    float layerAlpha = shellOpacity * pow(1.0 - layerT, q);
    
    // 外壳Fresnel效果
    float fresnel = pow(1.0 - dot(normal, viewDir), 2.0);
    float rim = smoothstep(0.22, 0.95, fresnel);
    
    // 混合内核和外壳
    baseColor = mix(baseColor, shellBaseColor, layerAlpha);
    // 边缘发光受层深强抑制：外层几乎不发亮
    float rimGain = 0.22 * pow(1.0 - layerT, 2.2);
    baseColor += rim * shellBaseColor * rimGain;
    
    // 外壳噪声（更细腻）
    // 外壳噪声略微增强，强调“糯感”（跟随物体）
    float shellNoise = simpleNoise(vObjectPosition * 10.0) * 0.025;
    baseColor += shellNoise;
  }
  
  // 应用噪声和抖动
  baseColor += noise + ditherValue;
  
  // 亮度上限，防止白圈（线性近似）
  baseColor = min(baseColor, vec3(0.95));
  gl_FragColor = vec4(clamp(baseColor, 0.0, 1.0), 1.0);
}
`;
