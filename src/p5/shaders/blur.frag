precision mediump float;
varying vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uDirection; // (1,0)=水平; (0,1)=垂直; 也可以传斜向
uniform float uSigma;    // 模糊强度

float gauss(float x, float sigma){
  return exp(-(x*x)/(2.0*sigma*sigma));
}

void main(){
  vec2 texel = 1.0 / vec2(textureSize(uTex, 0));
  vec4 sum = vec4(0.0);
  float wSum = 0.0;
  // 13-tap，可分离 + 更宽核
  for (int i=-12; i<=12; i++){
    float fi = float(i);
    float w = gauss(fi, uSigma);
    vec2 offset = uDirection * fi * texel;
    vec4 c = texture2D(uTex, vUV + offset);
    sum += c * w;
    wSum += w;
  }
  gl_FragColor = sum / max(wSum, 1e-5);
}


