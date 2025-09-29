// p5 WEBGL vertex shader
// 透传顶点位置与法线，用于片段着色

precision mediump float;

attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec4 worldPos = uModelViewMatrix * vec4(aPosition, 1.0);
  gl_Position = uProjectionMatrix * worldPos;

  // 视线方向（相机在局部空间为原点 [0,0,0]）
  vViewDir = normalize(-worldPos.xyz);
  vNormal = mat3(uModelViewMatrix) * aNormal;
}


