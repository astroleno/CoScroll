export const mochiExpandedVertexShader = `
precision highp float;

uniform float shellOffset;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vObjectPosition; // 物体空间位置，用于跟随旋转的渐变
varying vec2 vUv;
varying float vShellLayer;

void main() {
  vUv = uv;

  // 计算法线膨胀
  vec3 expandedPosition = position + normal * shellOffset;

  // 世界空间法线
  vNormal = normalize(normalMatrix * normal);

  // 视图空间位置
  vec4 mvPosition = modelViewMatrix * vec4(expandedPosition, 1.0);
  vViewPosition = -mvPosition.xyz;

  // 世界空间位置
  vWorldPosition = (modelMatrix * vec4(expandedPosition, 1.0)).xyz;

  // 物体空间位置（未乘模型矩阵），让渐变随物体旋转
  vObjectPosition = expandedPosition;

  // 传递外壳层信息
  vShellLayer = shellOffset;

  gl_Position = projectionMatrix * mvPosition;
}
`;
