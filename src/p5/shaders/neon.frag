// p5 WEBGL fragment shader
// 复现 Shader Park 风格的 FBM 发光与边缘光（简化版）

precision mediump float;

varying vec3 vNormal;
varying vec3 vViewDir;

uniform float uTime;
uniform vec3 uMainColor;
uniform vec3 uSecondaryColor;
uniform vec3 uRimColor;
uniform float uNoiseScale;
uniform float uBreathingSpeed;
uniform float uFresnelIntensity;
uniform float uNoiseLayers;

// 简化 3D 噪声（基于 iq 的 hash）
float hash(vec3 p){
  p = vec3( dot(p,vec3(127.1,311.7, 74.7)),
            dot(p,vec3(269.5,183.3,246.1)),
            dot(p,vec3(113.5,271.9,124.6)) );
  return fract(sin(p)*43758.5453123).x;
}

float noise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f*f*(3.0-2.0*f);
  float n000 = hash(i + vec3(0,0,0));
  float n100 = hash(i + vec3(1,0,0));
  float n010 = hash(i + vec3(0,1,0));
  float n110 = hash(i + vec3(1,1,0));
  float n001 = hash(i + vec3(0,0,1));
  float n101 = hash(i + vec3(1,0,1));
  float n011 = hash(i + vec3(0,1,1));
  float n111 = hash(i + vec3(1,1,1));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p, float layers){
  float v = 0.0;
  float a = 0.5;
  for (float i=0.0; i<8.0; i+=1.0){
    if(i>=layers) break;
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main(){
  // Fresnel 边缘发光
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float fres = pow(1.0 - max(dot(n, v), 0.0), uFresnelIntensity);

  // FBM 体积发光（沿视线扰动时间）
  vec3 p = v * uNoiseScale + vec3(0.0, 0.0, -uTime * 0.1);
  float f = fbm(p, uNoiseLayers);
  f = pow(f * 0.5 + 0.75, 3.0);

  // 呼吸调制
  float breath = 0.5 + 0.5 * sin(uTime * uBreathingSpeed);

  // 颜色混合
  vec3 baseCol = mix(uMainColor, uSecondaryColor, f);
  vec3 col = baseCol * (0.6 + 0.4 * breath) + uRimColor * fres;

  gl_FragColor = vec4(col, 1.0);
}


