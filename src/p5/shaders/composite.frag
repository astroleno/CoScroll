// 合成shader - 混合多层光晕实现柔软体积效果
precision mediump float;

varying vec2 vUV;

uniform sampler2D uLayer0;  // 原始几何渲染
uniform sampler2D uLayer1;  // 第一层模糊
uniform sampler2D uLayer2;  // 第二层模糊
uniform sampler2D uLayer3;  // 第三层模糊

uniform float uBloomStrength;  // 光晕强度
uniform float uSoftness;       // 柔软度

void main() {
  vec4 base = texture2D(uLayer0, vUV);
  vec4 blur1 = texture2D(uLayer1, vUV);
  vec4 blur2 = texture2D(uLayer2, vUV);
  vec4 blur3 = texture2D(uLayer3, vUV);

  // 多层混合实现极致柔软边缘
  // 模拟ShaderPark的blend效果
  vec4 softHalo = blur1 * 0.3 + blur2 * 0.4 + blur3 * 0.3;

  // 混合原始和光晕
  vec3 color = base.rgb + softHalo.rgb * uBloomStrength;

  // Alpha混合以实现柔边
  float alpha = base.a + softHalo.a * uSoftness;
  alpha = clamp(alpha, 0.0, 1.0);

  // 额外的柔化处理
  alpha = smoothstep(0.0, 1.0, alpha);

  gl_FragColor = vec4(color, alpha);
}