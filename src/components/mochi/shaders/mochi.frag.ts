export const mochiFragmentShader = `
uniform float time;
uniform vec3 color1; // 蓝色
uniform vec3 color2; // 粉色
uniform vec3 color3; // 橙色
uniform vec3 color4; // 黄色
uniform float roughness;
uniform float fresnelPower;
uniform float ditherStrength;
uniform float noiseScale;
uniform float noiseStrength;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec2 vUv;

// Simplex 3D Noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// RGB to HSV
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Dither 函数（蓝噪声近似）
float dither(vec2 coord) {
  return fract(sin(dot(coord.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);

  // === 1. 基础渐变（Y轴 + 球坐标混合） ===
  // Y 轴渐变：上蓝下橙
  float yGradient = (vWorldPosition.y + 1.0) * 0.5; // 0-1

  // 球坐标：用经纬度创建更丰富的渐变
  vec3 spherePos = normalize(vWorldPosition);
  float lat = asin(spherePos.y); // -PI/2 到 PI/2
  float lon = atan(spherePos.z, spherePos.x); // -PI 到 PI

  // 多层混合
  float gradient1 = yGradient; // 上下
  float gradient2 = (lon / 3.14159 + 1.0) * 0.5; // 左右
  float gradient3 = (lat / 1.5708 + 1.0) * 0.5; // 前后

  // 4 色混合（蓝 → 粉 → 橙 → 黄）
  vec3 baseColor;
  if (gradient1 < 0.33) {
    baseColor = mix(color1, color2, gradient1 / 0.33);
  } else if (gradient1 < 0.66) {
    baseColor = mix(color2, color3, (gradient1 - 0.33) / 0.33);
  } else {
    baseColor = mix(color3, color4, (gradient1 - 0.66) / 0.34);
  }

  // 用球坐标增加变化
  baseColor = mix(baseColor, color2, gradient2 * 0.2);
  baseColor = mix(baseColor, color3, gradient3 * 0.15);

  // === 2. Fresnel 边缘发光 ===
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), fresnelPower);
  float rimMask = smoothstep(0.3, 0.85, fresnel); // 边缘区域

  // 边缘加亮色（橙黄色）
  vec3 rimColor = mix(color3, color4, 0.5);
  baseColor = mix(baseColor, rimColor, rimMask * 0.4);

  // === 3. 表面噪声（绒感） ===
  float noise1 = snoise(vWorldPosition * noiseScale);
  float noise2 = snoise(vWorldPosition * noiseScale * 2.0 + vec3(100.0));
  float combinedNoise = (noise1 + noise2 * 0.5) * noiseStrength;

  baseColor += vec3(combinedNoise);

  // === 4. Dither 抖动（避免色带 + 增强颗粒感） ===
  float ditherValue = (dither(gl_FragCoord.xy) - 0.5) * ditherStrength;
  baseColor += vec3(ditherValue);

  // === 5. 粗糙度模拟（降低对比度） ===
  baseColor = mix(vec3(0.5), baseColor, 1.0 - roughness * 0.3);

  // 最终输出
  gl_FragColor = vec4(clamp(baseColor, 0.0, 1.0), 1.0);
}
`;
