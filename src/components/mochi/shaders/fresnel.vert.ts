export const fresnelVertexShader = `
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;

void main() {
  vUv = uv;

  // 世界空间法线
  vNormal = normalize(normalMatrix * normal);

  // 世界空间位置
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);

  // 视线方向（从相机到顶点）
  vViewDir = normalize(cameraPosition - worldPosition.xyz);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
