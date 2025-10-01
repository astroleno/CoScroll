export const mochiVertexShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vUv = uv;

  // 世界空间法线
  vNormal = normalize(normalMatrix * normal);

  // 视图空间位置
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;

  // 世界空间位置
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

  gl_Position = projectionMatrix * mvPosition;
}
`;
