// 多层壳体渲染 - 片段着色器
// 实现PPL方案: Fresnel + 分层透明度 + 3D噪声
precision mediump float;

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPos;

uniform float uTime;
uniform float uLayer;          // 当前壳体层级 (0=主体, 1-3=外层)
uniform float uTotalLayers;    // 总层数
uniform vec3 uMainColor;
uniform vec3 uSecondaryColor;
uniform vec3 uRimColor;
uniform float uSoftness;

// === 3D噪声函数 ===
float hash(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash(i + vec3(0,0,0));
  float n100 = hash(i + vec3(1,0,0));
  float n010 = hash(i + vec3(0,1,0));
  float n110 = hash(i + vec3(1,1,0));
  float n001 = hash(i + vec3(0,0,1));
  float n101 = hash(i + vec3(1,0,1));
  float n011 = hash(i + vec3(0,1,1));
  float n111 = hash(i + vec3(1,1,1));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);

  return mix(nxy0, nxy1, f.z);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);

  // === Fresnel效果 ===
  float fresnel = 1.0 - max(dot(N, V), 0.0);

  // 多重smoothstep实现极致柔边
  float softFresnel = fresnel;
  softFresnel = smoothstep(0.0, 1.0, softFresnel);
  softFresnel = smoothstep(0.0, 1.0, softFresnel);
  softFresnel = smoothstep(0.0, 1.0, softFresnel);
  softFresnel = smoothstep(0.0, 1.0, softFresnel);

  // === 3D噪声（跟随模型旋转） ===
  vec3 noisePos = vWorldPos * 0.4 + vec3(0.0, 0.0, uTime * 0.08);
  float n = noise(noisePos);
  n = sin(n * 2.0) * 0.5 + 0.75;
  n = pow(n, 6.0);

  // === PPL核心: 分层透明度控制 ===
  // 外层(uLayer=7)更透明，主体(uLayer=0)不透明
  float layerRatio = uLayer / max(uTotalLayers - 1.0, 1.0);
  float layerAlpha = mix(1.0, 0.05, layerRatio); // 1.0 → 0.05 (更透明)

  // === Alpha计算（激进衰减实现云雾消散）===
  float baseAlpha = 1.0 - softFresnel;

  // 外层使用更宽的过渡区（让边缘几乎消失）
  float alphaMin = uSoftness * 0.05 + layerRatio * 0.3; // 外层更早开始透明
  float alphaMax = 0.75 - layerRatio * 0.2;              // 外层更早结束
  baseAlpha = smoothstep(alphaMin, alphaMax, baseAlpha);

  // 应用分层衰减
  baseAlpha *= layerAlpha;

  // 5重柔化
  baseAlpha = smoothstep(0.0, 1.0, baseAlpha);
  baseAlpha = smoothstep(0.0, 1.0, baseAlpha);
  baseAlpha = smoothstep(0.0, 1.0, baseAlpha);
  baseAlpha = smoothstep(0.0, 1.0, baseAlpha);
  baseAlpha = smoothstep(0.0, 1.0, baseAlpha);

  // === 颜色混合（强化渐变）===
  // 外层更偏向边缘色，内层保持中心色
  float colorShift = softFresnel + layerRatio * 0.4; // 外层强制偏移

  vec3 centerColor = mix(uMainColor, uSecondaryColor, colorShift * 0.6);
  vec3 edgeColor = mix(uSecondaryColor, uRimColor, colorShift);
  vec3 finalColor = mix(centerColor, edgeColor, pow(colorShift, 1.5));

  // 轻微噪声调制
  finalColor *= mix(0.94, 1.0, n);

  // 呼吸效果
  float breath = 0.88 + 0.12 * sin(uTime * 0.4);
  finalColor *= breath;

  // === 体积光晕（外层更强+大范围扩散） ===
  float volumeGlow = pow(softFresnel, 2.0) * (0.5 + layerRatio * 0.8); // 外层更亮

  // 外层额外添加粉紫色光晕
  vec3 haloColor = mix(uSecondaryColor, uRimColor, layerRatio);
  finalColor += haloColor * volumeGlow;

  // 边缘噪声破碎（增加雾化感）
  float edgeNoise = noise(vWorldPos * 1.5 + uTime * 0.1);
  edgeNoise = smoothstep(0.3, 0.7, edgeNoise);

  // 最终输出（外层alpha更依赖glow）
  float glowContribution = volumeGlow * (0.15 + layerRatio * 0.3);
  float finalAlpha = clamp(baseAlpha + glowContribution, 0.0, 1.0);

  // 边缘噪声调制alpha（制造云雾消散感）
  finalAlpha *= mix(0.7, 1.0, edgeNoise);

  gl_FragColor = vec4(finalColor, finalAlpha);
}