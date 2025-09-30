// 柔软体积shader - 顶点着色器
precision mediump float;

attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPos;

void main() {
  // 视图空间位置
  vec4 viewPos = uModelViewMatrix * vec4(aPosition, 1.0);
  gl_Position = uProjectionMatrix * viewPos;

  // 视图空间法线
  vNormal = normalize(uNormalMatrix * aNormal);

  // 视线方向
  vViewDir = normalize(-viewPos.xyz);

  // 世界空间位置（用于噪声）
  vWorldPos = aPosition;
}