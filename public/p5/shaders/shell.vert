// 多层壳体渲染 - 顶点着色器
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
  // 世界坐标
  vec4 worldPos = uModelViewMatrix * vec4(aPosition, 1.0);
  vWorldPos = worldPos.xyz;

  // 法线
  vNormal = normalize(uNormalMatrix * aNormal);

  // 视线方向
  vViewDir = -normalize(worldPos.xyz);

  gl_Position = uProjectionMatrix * worldPos;
}