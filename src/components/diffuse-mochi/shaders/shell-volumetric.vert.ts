/**
 * Shell Volumetric 顶点着色器
 * 沿法线方向扩展壳体层
 */

export const shellVolumetricVertexShader = `
uniform float shellThickness;  // 壳体厚度
uniform int shellCount;        // 壳层数量
uniform float shellIndex;      // 当前层索引 [0, shellCount-1]

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying float vShellT;         // 归一化层深度 [0, 1]

void main() {
  // 计算归一化层深度 (0 = 最内层, 1 = 最外层)
  float t = shellIndex / max(float(shellCount - 1), 1.0);
  vShellT = t;

  // 法线方向偏移（沿法线向外扩展）
  vec3 n = normalize(normalMatrix * normal);

  // 修复：从原始表面向外扩展（0 到 shellThickness）
  // 而不是围绕原点内外扩展（-0.5 到 +0.5）
  float displacement = t * shellThickness;

  // MVP 变换
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  // 在世界空间中沿法线偏移
  worldPosition.xyz += n * displacement;

  vec4 viewPosition = viewMatrix * worldPosition;
  vViewPosition = viewPosition.xyz;

  gl_Position = projectionMatrix * viewPosition;

  // 传递法线
  vNormal = n;
}
`;
