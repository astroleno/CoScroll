/**
 * 3D Perlin Noise 实现
 * 用于打破壳体层的规律性，实现雾状/颗粒感
 */

export const noise3DFunctions = `
// 3D Hash 函数
vec3 hash3D(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
}

// 3D Perlin Noise（优化版）
float perlinNoise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);

  // 使用 smoothstep 进行平滑插值
  vec3 u = f * f * (3.0 - 2.0 * f);

  // 8个角的梯度噪声
  float n000 = dot(hash3D(i + vec3(0.0, 0.0, 0.0)) - 0.5, f - vec3(0.0, 0.0, 0.0));
  float n100 = dot(hash3D(i + vec3(1.0, 0.0, 0.0)) - 0.5, f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(hash3D(i + vec3(0.0, 1.0, 0.0)) - 0.5, f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(hash3D(i + vec3(1.0, 1.0, 0.0)) - 0.5, f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(hash3D(i + vec3(0.0, 0.0, 1.0)) - 0.5, f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(hash3D(i + vec3(1.0, 0.0, 1.0)) - 0.5, f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(hash3D(i + vec3(0.0, 1.0, 1.0)) - 0.5, f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(hash3D(i + vec3(1.0, 1.0, 1.0)) - 0.5, f - vec3(1.0, 1.0, 1.0));

  // 三线性插值
  float nx00 = mix(n000, n100, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx11 = mix(n011, n111, u.x);

  float nxy0 = mix(nx00, nx10, u.y);
  float nxy1 = mix(nx01, nx11, u.y);

  float nxyz = mix(nxy0, nxy1, u.z);

  // 归一化到 [0, 1]
  return nxyz * 0.5 + 0.5;
}

// FBM（分形布朗运动）- 可选，更丰富的噪声
float fbm3D(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    value += amplitude * perlinNoise3D(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }

  return value;
}
`;
