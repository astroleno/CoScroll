export const mochiShellModelVertexShader = `
precision highp float;

uniform float shellOffset;  // 沿法线膨胀距离（世界空间单位）

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

void main() {
  // 修正后的法线（世界空间）
  vec3 N = normalize(normalMatrix * normal);

  // 先变换到世界空间，再沿修正后的法线膨胀
  vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  worldPos += N * shellOffset;

  // 传递给片元着色器
  vNormal = N;
  vWorldPosition = worldPos;

  // 视图空间位置
  vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
  vViewPosition = -mvPosition.xyz;

  gl_Position = projectionMatrix * mvPosition;
}`;


