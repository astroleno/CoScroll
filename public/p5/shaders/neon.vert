// p5 WEBGL vertex shader
// 透传顶点位置与法线，用于片段着色

precision mediump float;

attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uShellThickness; // 挤出外壳的厚度（模型空间单位，传 0 表示不挤出）

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  // 法线在视图空间中的方向
  vec3 nView = normalize(mat3(uModelViewMatrix) * aNormal);

  // 顶点位置（视图空间）
  vec4 viewPos = uModelViewMatrix * vec4(aPosition, 1.0);

  // 沿法线挤出一层外壳（仅当 uShellThickness > 0）
  viewPos.xyz += nView * uShellThickness;

  gl_Position = uProjectionMatrix * viewPos;

  // 视线方向（相机在局部空间为原点 [0,0,0]）
  vViewDir = normalize(-viewPos.xyz);
  vNormal = nView;
}


