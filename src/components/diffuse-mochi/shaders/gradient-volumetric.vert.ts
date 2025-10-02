/**
 * 渐变体积 Vertex Shader
 * 传递位置信息用于距离计算
 */

export const gradientVolumetricVertexShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vObjectPosition;  // 物体空间坐标 [-1, 1]

void main() {
  // 物体空间坐标（用于计算距离中心）
  vObjectPosition = position;

  // 世界空间
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  // 视图空间
  vec4 viewPosition = viewMatrix * worldPosition;
  vViewPosition = viewPosition.xyz;

  // 法线
  vNormal = normalize(normalMatrix * normal);

  gl_Position = projectionMatrix * viewPosition;
}
`;
