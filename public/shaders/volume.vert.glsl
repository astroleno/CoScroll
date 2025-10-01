// 体积渲染 - 顶点着色器
precision highp float;

varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
  // 世界坐标（用于ray marching起点/方向计算）
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize(normalMatrix * normal);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}