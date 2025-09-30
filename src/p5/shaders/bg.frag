precision mediump float;
varying vec2 vUV;
uniform float uTime;

// 参考 sketch1732356：以“视线方向”做单噪声→sin→pow(8) 调色

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

vec3 palette(float t){
  vec3 a = vec3(0.98, 0.92, 0.86);
  vec3 b = vec3(0.70, 0.74, 0.92);
  vec3 c = vec3(0.58, 0.84, 0.92);
  vec3 d = vec3(0.96, 0.78, 0.86);
  return mix(mix(a,b,t), mix(c,d,1.0-t), 0.5 + 0.5*sin(t*6.2831));
}

void main(){
  // 构造“视线方向”近似：将 UV 映射到 [-1,1]，z=1 并归一化
  vec2 uv = vUV;
  vec2 p = uv*2.0 - 1.0;
  vec3 ray = normalize(vec3(p, 1.0));

  float n1 = noise(ray + vec3(0.0, 0.0, -uTime * 0.1));
  float f = sin(n1 * 2.0) * 0.5 + 0.75;
  f = pow(f, 8.0);

  // 用 f 做柔和多色调色
  vec3 col = palette(f);

  // 轻微暗角，突出中心
  float r = length(p);
  float vignette = smoothstep(1.3, 0.2, r);
  col *= mix(0.9, 1.0, vignette);

  gl_FragColor = vec4(col, 1.0);
}


