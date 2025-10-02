/**
 * Jade Subsurface Scattering Vertex Shader
 * 基于subsurface-refraction-shader实现
 * 用于玉石质感渲染
 */

export const jadeSubsurfaceVertexShader = /* glsl */ `
// Three.js会自动注入以下变量，无需声明：
// attribute vec3 position, normal, tangent
// uniform mat4 modelMatrix, modelViewMatrix, projectionMatrix
// uniform mat3 normalMatrix
// uniform vec3 cameraPosition

// Varyings
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vPosition;          // 模型空间位置
varying vec3 vWorldPosition;     // 世界空间位置
varying vec3 vViewPosition;      // 视图空间位置

void main() {
  // 法线和切线（世界空间）
  vNormal = normalize(normalMatrix * normal);

  // 检查是否有切线属性
  #ifdef USE_TANGENT
    vTangent = normalize(normalMatrix * tangent);
  #else
    vTangent = vec3(0.0);
  #endif

  // 位置
  vPosition = position;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mvPosition.xyz;

  gl_Position = projectionMatrix * mvPosition;
}
`;
