'use client';

/**
 * MochiBackgroundBShader
 * - 基于 `ref/MochiBackground/mochi.ts` 的片元思路，做了无音频化精简
 * - 仅保留 `uTime`、`uResolution` 与少量可调控的参数，便于独立使用
 * - 目标：在全屏四边形上渲染「弥散霓虹果冻」风格背景
 *
 * 注意：
 * - 本模块只导出着色器源码字符串，不含任何 three 逻辑
 * - 供 `MochiBackgroundB` 组件通过 `THREE.ShaderMaterial` 使用
 */

export const MOCHI_B_VERTEX = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// 无音频版本：移除了所有音频相关 uniform，给出固定但流动的参数
export const MOCHI_B_FRAGMENT = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec2  uResolution; // 像素
uniform float uTime;       // 秒

// 视觉控制（保留少量便于外部调参）
uniform float uNoiseScale;     // 噪声尺度（默认 1.25）
uniform float uColorCycle;     // 主体颜色循环速度（默认 0.25）
uniform float uBgCycle;        // 背景颜色循环速度（默认 0.2）
uniform float uGrainStrength;  // 颗粒强度 0..0.2（默认 0.06）
uniform float uGrainScale;     // 颗粒尺寸 1..4（默认 2.0）
uniform float uScale;          // 背景缩放比例（默认 1.0）

varying vec2 vUv;

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

float gauss2D(vec2 p, vec2 c, float sigma){
  float d2 = dot(p-c, p-c);
  float k = max(1e-5, sigma*sigma*2.0);
  return exp(-d2 / k);
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

  // 背景渐变（青紫蓝循环）
  float tBg = uTime * (uBgCycle > 0.0 ? uBgCycle : 0.2);
  vec3 pA = vec3(0.18, 0.20, 0.26);
  vec3 pB = vec3(0.08, 0.06, 0.10);
  vec3 pC = vec3(1.0, 1.0, 1.0);
  vec3 pD = vec3(0.00, 0.33, 0.66);
  vec3 bgBase = palette(fract(tBg), pA, pB, pC, pD);
  vec3 bg1 = bgBase + vec3(0.02);
  vec3 bg2 = bgBase - vec3(0.03);
  float g = clamp((uv.y+0.9)/2.0, 0.0, 1.0);
  vec3 col = mix(bg1, bg2, g);

  // metaball 场（受缩放影响）
  float t = uTime;
  float baseR = (0.28 + 0.06*0.8) * uScale; // 光斑大小受缩放影响
  float childR = (0.16 + 0.05*0.8) * uScale;
  vec2 c0 = 0.36 * uScale * vec2(cos(t*0.25), sin(t*0.22)); // 光斑位置受缩放影响
  vec2 c1 = -0.22 * uScale * vec2(cos(t*0.18+1.3), sin(t*0.2+0.7));
  vec2 c2 = 0.18 * uScale * vec2(cos(t*0.31+2.1), sin(t*0.27+1.1));

  float sigma0 = baseR*0.8;
  float sigma1 = childR*0.85;
  float sigma2 = childR*0.7;

  float field = 0.0;
  field += gauss2D(uv, c0, sigma0);
  field += gauss2D(uv, c1, sigma1);
  field += gauss2D(uv, c2, sigma2);
  field += 0.35 * gauss2D(uv, 0.42*c2 - 0.18*c1, sigma2*0.9);
  float n = fbm(vec3(uv*2.6, t*0.2));
  field *= (0.95 + 0.12*n + 0.06*0.6);

  float px = 1.5 / min(R.x, R.y);
  vec2 dx = vec2(px, 0.0), dy = vec2(0.0, px);
  float f1 = 0.5*field + 0.125*(
    gauss2D(uv+dx, c0, sigma0)+gauss2D(uv-dx, c0, sigma0)+
    gauss2D(uv+dy, c0, sigma0)+gauss2D(uv-dy, c0, sigma0)
  );
  float f2 = 0.5*field + 0.125*(
    gauss2D(uv+dx, c1, sigma1)+gauss2D(uv-dx, c1, sigma1)+
    gauss2D(uv+dy, c1, sigma1)+gauss2D(uv-dy, c1, sigma1)
  );
  float f3 = 0.5*field + 0.125*(
    gauss2D(uv+dx, c2, sigma2)+gauss2D(uv-dx, c2, sigma2)+
    gauss2D(uv+dy, c2, sigma2)+gauss2D(uv-dy, c2, sigma2)
  );
  float fieldBlur = 0.5*field + 0.5*(0.4*f1 + 0.35*f2 + 0.25*f3);

  float mapped = 1.0 - exp(-2.0 * clamp(fieldBlur, 0.0, 2.0));
  float fieldSoft = pow(mapped, 1.0);
  float edgeLo = 0.24;
  float edgeHi = 0.86 + 0.03*0.6;
  float alpha = smoothstep(edgeLo, edgeHi, fieldSoft);
  alpha = alpha*alpha*(3.0 - 2.0*alpha);

  float d = clamp(fieldSoft, 0.0, 1.0);
  float blueNoise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
  float dn = clamp(d + 0.012*(blueNoise - 0.5) + 0.045*(fbm(vec3(uv*2.0, t*0.15)) - 0.5), 0.0, 1.0);

  float tMain = uTime * (uColorCycle > 0.0 ? uColorCycle : 0.25);
  float baseHue01 = fract(0.55 + 0.12 * sin(tMain) + 0.07 * cos(1.7*tMain));
  float sat = 0.85;
  float bri = 1.0;
  vec3 baseRgb = hsb2rgb(vec3(baseHue01, sat, bri));
  vec3 innerRgb = hsb2rgb(vec3(baseHue01, 0.25, 1.0));
  vec3 rgb = mix(baseRgb, innerRgb, clamp(dn*dn, 0.0, 1.0));

  float rimMask = pow(1.0 - dn, 2.0);
  vec3 rim = vec3(0.008, 0.012, 0.028) * rimMask;
  vec3 blobCol = clamp(rgb + rim, 0.0, 1.0);
  float a = pow(smoothstep(0.05, 0.75, dn), 1.2);
  vec3 luma = vec3(dot(rgb, vec3(0.299, 0.587, 0.114)));
  rgb = clamp(mix(luma, rgb, 1.35), 0.0, 1.0);
  vec3 coreBoost = rgb * (1.0 + 0.18 * dn);
  vec3 highlight = vec3(1.0, 0.98, 0.95) * (0.04 * dn);
  blobCol = clamp(coreBoost + highlight, 0.0, 1.0);
  col = col*(1.0 - a) + blobCol*a;
  float shadow = pow(1.0 - dn, 3.0);
  col *= (1.0 - 0.18 * shadow);
  col = pow(col, vec3(1.06));

  // Film Grain（蓝噪+细纹）
  float scale = max(1.0, uGrainScale);
  mat2 rotG = mat2(0.7071, -0.7071, 0.7071, 0.7071);
  vec2 gp = (gl_FragCoord.xy / scale) * rotG;
  float grainA = fract(sin(dot(gp + vec2(uTime*37.0, uTime*19.0), vec2(12.9898,78.233))) * 43758.5453) - 0.5;
  float grainC = fract(sin(dot(gp*1.37 + 31.7 + uTime*21.0, vec2(26.651, 9.271))) * 921.271) - 0.5;
  float grain = mix(grainA, grainC, 0.5);
  float gs = clamp(uGrainStrength, 0.0, 0.2);
  float low = fbm(vec3(gl_FragCoord.xy * (0.003/scale), uTime*0.15));
  float modAmp = mix(0.7, 1.3, low);
  col += (0.66 * gs * modAmp) * grain;
  col += (0.5  * gs * modAmp) * vec3(0.9, -0.6, 0.45) * grain;

  // 亮度软限幅
  float maxL = 0.78;
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float clipAmt = smoothstep(maxL, 1.0, lum);
  if (clipAmt > 0.0) {
    float scale2 = maxL / max(1e-4, lum);
    col = mix(col, col * scale2, clipAmt * 0.9);
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;


