// Simplex 3D Noise
// https://github.com/hughsk/glsl-noise/blob/master/simplex/3d.glsl
export const simplexNoise3D = `
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
`;

// 冷暖渐变注入代码
export const gradientHeader = `
${simplexNoise3D}
// 自定义 varying，避免与 three 内部重名
varying vec3 vMochiWorldPos;
varying vec3 vMochiWorldNormal;
`;

export const gradientVertexInjection = `
vMochiWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
vMochiWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
`;

export const gradientFragmentInjection = `
// 冷暖色定义（参考 ref1-2）
vec3 coolColor = vec3(0.72, 0.83, 1.0);   // 浅蓝 #b8d4ff
vec3 warmColor = vec3(1.0, 0.83, 0.9);    // 粉色 #ffd4e5
vec3 accentColor = vec3(1.0, 0.93, 0.82); // 暖白 #ffe5d0

// 基于世界空间 Y 轴的渐变（上冷下暖）
float yGradient = vMochiWorldPos.y * 0.5 + 0.5; // normalize to 0-1

// 基于法线的边缘增强（侧面加暖色）
vec3 viewDir = normalize(cameraPosition - vMochiWorldPos);
float fresnel = pow(1.0 - max(dot(vMochiWorldNormal, viewDir), 0.0), 2.0);

// 3层颜色混合
vec3 baseGradient = mix(warmColor, coolColor, yGradient);
vec3 gradientColor = mix(baseGradient, accentColor, fresnel * 0.3);

// 添加细微噪声（颗粒感）
float noise = snoise(vMochiWorldPos * 8.0) * 0.03;
gradientColor += vec3(noise);

// 应用到 diffuseColor（颜色）
diffuseColor.rgb = gradientColor;

// 追加柔度与透明度地板：边缘更透、中心更实，保证主体可读
float softness = mix(0.35, 0.7, fresnel); // 0.35~0.7 随边缘提升
// 对最终输出做地板保护（在 output_fragment 之前插入）
gl_FragColor.a = max(gl_FragColor.a, softness);
// 轻度把渐变混入结果，避免纯白：
gl_FragColor.rgb = mix(gl_FragColor.rgb, gradientColor, 0.2);
`;
