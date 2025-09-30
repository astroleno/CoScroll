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
uniform float uEdgeOnly; // 1.0 输出仅边缘并以 alpha 表示强度，用于光晕缓冲
uniform vec2 uResolution; // 屏幕分辨率，用于屏幕空间噪声
uniform float uEdgeGamma; // 边缘幂指数，控制宽度分布
uniform float uInnerAlpha; // 主体层 alpha（让中心也可被轻柔化）

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

void main(){
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float ndv = max(dot(n, v), 0.0);

  // 屏幕空间UV
  vec2 screenUV = gl_FragCoord.xy / uResolution.xy;

  // 使用视线方向获取噪声
  vec3 s = normalize(vViewDir);
  vec3 p = s * uNoiseScale + vec3(0.0, 0.0, -uTime * 0.1);

  // 3通道噪声
  float offset = 0.1;
  vec3 n_vec = vec3(
    noise(p),
    noise(p + offset),
    noise(p + offset * 2.0)
  );

  // 应用sin和pow变换
  n_vec = sin(n_vec * 2.0) * 0.5 + 0.75;
  n_vec = pow(n_vec, vec3(8.0));

  // 最简单的超柔边方法：基于到中心的距离
  vec2 center = screenUV - 0.5;
  float dist = length(center);

  // 超级柔和的边缘算法 - 完全重新设计
  // 使用更大的过渡区域
  float mask1 = 1.0 - smoothstep(0.1, 0.8, dist);   // 超大过渡区域
  float mask2 = 1.0 - smoothstep(0.0, 0.7, dist);   // 更大过渡
  float mask3 = 1.0 - smoothstep(-0.1, 0.6, dist);  // 扩展边界

  // 组合遮罩
  float volumeMask = mask1 * 0.3 + mask2 * 0.4 + mask3 * 0.3;

  // 极致柔化 - 四重smoothstep
  float softAlpha = volumeMask;
  softAlpha = smoothstep(0.0, 1.0, softAlpha); // 1st
  softAlpha = smoothstep(0.0, 1.0, softAlpha); // 2nd
  softAlpha = smoothstep(0.0, 1.0, softAlpha); // 3rd
  softAlpha = smoothstep(0.0, 1.0, softAlpha); // 4th - 极致柔滑

  // 颜色基于噪声和位置
  vec3 centerColor = mix(uMainColor, uSecondaryColor, n_vec.x);
  vec3 edgeColor = mix(uSecondaryColor, uRimColor, n_vec.y);
  vec3 finalColor = mix(edgeColor, centerColor, volumeMask);

  // 应用噪声调制
  finalColor *= n_vec;

  // 呼吸效果
  float breath = 0.8 + 0.2 * sin(uTime * uBreathingSpeed);
  finalColor *= breath;

  if (uEdgeOnly > 0.5) {
    // 光晕：超级柔和的扩散
    float haloDist = length(center);

    // 多层光晕遮罩
    float halo1 = 1.0 - smoothstep(0.0, 1.0, haloDist);   // 超大扩散
    float halo2 = 1.0 - smoothstep(0.1, 0.9, haloDist);   // 大扩散
    float halo3 = 1.0 - smoothstep(0.2, 0.8, haloDist);   // 中扩散

    float haloMask = halo1 * 0.2 + halo2 * 0.4 + halo3 * 0.4;
    float haloAlpha = haloMask * softAlpha * 0.9;

    // 四重柔化光晕
    haloAlpha = smoothstep(0.0, 1.0, haloAlpha);
    haloAlpha = smoothstep(0.0, 1.0, haloAlpha);
    haloAlpha = smoothstep(0.0, 1.0, haloAlpha);
    haloAlpha = smoothstep(0.0, 1.0, haloAlpha);

    gl_FragColor = vec4(uRimColor, haloAlpha);
  } else {
    // 主体 - 确保边缘完全柔滑
    gl_FragColor = vec4(finalColor, softAlpha);
  }
}


