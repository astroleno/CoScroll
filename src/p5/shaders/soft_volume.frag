// 柔软体积shader - 片段着色器
// 模拟ShaderPark的blend效果
precision mediump float;

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPos;

uniform float uTime;
uniform vec3 uMainColor;
uniform vec3 uSecondaryColor;
uniform vec3 uRimColor;
uniform float uSoftness; // 柔软度参数 (0.0-1.0)

// 3D噪声
float hash(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p.x) * 43758.5453123);
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

  // Fresnel效果 (核心)
  float fresnel = 1.0 - max(dot(N, V), 0.0);

  // 🔑 关键: 多层smoothstep实现极致柔边
  float softFresnel = fresnel;
  softFresnel = smoothstep(0.0, 1.0, softFresnel);
  softFresnel = smoothstep(0.0, 1.0, softFresnel);
  softFresnel = smoothstep(0.0, 1.0, softFresnel);
  softFresnel = smoothstep(0.0, 1.0, softFresnel); // 4重柔化

  // 轻微噪声（减少粒子感）
  vec3 noisePos = vWorldPos * 0.5 + vec3(0.0, 0.0, uTime * 0.05);
  float n = noise(noisePos);
  n = sin(n * 2.0) * 0.5 + 0.75;
  n = pow(n, 8.0);

  // Alpha计算 - 核心柔边算法
  float baseAlpha = 1.0 - softFresnel;

  // 🔑 调整alpha范围实现柔边
  float alphaMin = uSoftness * 0.3; // 软边起点
  float alphaMax = 0.95; // 固定终点
  baseAlpha = smoothstep(alphaMin, alphaMax, baseAlpha);

  // 5重柔化alpha（关键！）
  baseAlpha = smoothstep(0.0, 1.0, baseAlpha);
  baseAlpha = smoothstep(0.0, 1.0, baseAlpha);
  baseAlpha = smoothstep(0.0, 1.0, baseAlpha);
  baseAlpha = smoothstep(0.0, 1.0, baseAlpha);
  baseAlpha = smoothstep(0.0, 1.0, baseAlpha);

  // 颜色混合（简化，减少噪声影响）
  vec3 centerColor = mix(uMainColor, uSecondaryColor, softFresnel * 0.5);
  vec3 edgeColor = mix(uSecondaryColor, uRimColor, softFresnel);
  vec3 finalColor = mix(centerColor, edgeColor, softFresnel);

  // 轻微噪声调制（减少粒子感）
  finalColor *= mix(0.95, 1.0, n);

  // 呼吸效果
  float breath = 0.9 + 0.1 * sin(uTime * 0.3);
  finalColor *= breath;

  // 🔑 最终输出 - 超柔软的alpha
  gl_FragColor = vec4(finalColor, baseAlpha);
}