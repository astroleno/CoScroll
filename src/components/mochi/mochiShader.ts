// Copied from ref/MochiBackground/mochi.ts (GLSL strings) to make it local to src/
// Keep only shader strings for integration without p5; comments preserved for context.

export const MOCHI_VERTEX = `
#ifdef GL_ES
precision highp float;
#endif
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main(){
  vTexCoord = aTexCoord;
  vec4 pos = vec4(aPosition, 1.0);
  pos.xy = pos.xy * 2.0 - 1.0;
  gl_Position = pos;
}`;

export const MOCHI_FRAGMENT = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec2  uResolution;    // 像素
uniform float uTime;          // 秒

// 音频/全局统一参数（与 spiral/wave 保持一致）
uniform float uLevel;         // 0..1 音量
uniform float uFlux;          // 0..1 频谱变化率
uniform float uCentroid;      // 0..1 频谱质心
uniform float uZCR;           // 0..1 过零率
uniform vec4  uMFCC;          // 0..1 x4
uniform float uPulse;         // 0..1 打击脉冲（映射 ShaderPark 的 click/mix）
uniform float uSensitivity;   // 0.5..3.0 可视敏感度

// 视觉控制（可选）
uniform float uNoiseScale;    // 默认 1.0
uniform float uMixStrength;   // 0..1 几何混合强度（基础），会与 uPulse 相乘
uniform float uColorWarmth;   // -1..1 负值偏冷，正值偏暖
uniform float uMaxSteps;      // 最大步进（建议 64~96）
uniform float uMaxDist;       // 最大行进距离（建议 6.0）
uniform float uSurfEpsilon;   // 表面阈值（建议 0.0015~0.003）
// 体积渲染参数
uniform float uVolumeStrength; // 0..2 体积发光强度（默认 0.8）
uniform float uAbsorption;     // 0.1..4 体积吸收系数（默认 1.2）
uniform float uStepScale;      // 0.5..2 步长缩放（默认 1.0 更细=更慢）
uniform float uAnisotropy;     // -0.9..0.9 前向散射相位 g（默认 0.55）
uniform float uLightStrength;  // 0..4 体积入射光强（默认 1.2）
// 色彩循环速度
uniform float uColorCycleSpeed; // 主体颜色循环速度（秒^-1）
uniform float uBgCycleSpeed;    // 背景颜色循环速度（秒^-1）
// 颗粒强度
uniform float uGrainStrength;   // 0..0.2 建议范围，默认 0.06
uniform float uGrainScale;      // 1..4 颗粒尺寸系数（>1 更粗），默认 2.0

varying vec2 vTexCoord;

#define R uResolution

mat2 rot(float a){ return mat2(cos(a), -sin(a), sin(a), cos(a)); }

float hash(vec3 p){
  p = fract(p*0.3183099 + vec3(0.1,0.2,0.3));
  p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}

float noise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
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

float fbm(vec3 p){
  float a = 0.5;
  float f = 1.0;
  float s = max(0.2, uNoiseScale);
  float acc = 0.0;
  for(int i=0;i<5;i++){
    acc += a * noise(p * (f * s));
    f *= 2.0;
    a *= 0.5;
  }
  return acc;
}

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d){
  return a + b * cos(6.2831853 * (c * t + d));
}

vec3 hsb2rgb(vec3 c){
  vec3 p = abs(fract(vec3(c.x) + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  vec3 rgb = clamp(p - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*R) / min(R.x, R.y);
  float tBg = uTime * (uBgCycleSpeed > 0.0 ? uBgCycleSpeed : 0.2);
  vec3 pA = vec3(0.18, 0.20, 0.26);
  vec3 pB = vec3(0.08, 0.06, 0.10);
  vec3 pC = vec3(1.0, 1.0, 1.0);
  vec3 pD = vec3(0.00, 0.33, 0.66);
  vec3 bgBase = palette(fract(tBg), pA, pB, pC, pD);
  vec3 bg1 = bgBase + vec3(0.02, 0.02, 0.02);
  vec3 bg2 = bgBase - vec3(0.03, 0.03, 0.03);
  float g = clamp((uv.y+0.9)/2.0, 0.0, 1.0);
  vec3 col = mix(bg1, bg2, g);
  gl_FragColor = vec4(col, 1.0);
}`;


