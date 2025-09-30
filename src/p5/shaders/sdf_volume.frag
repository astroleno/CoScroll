// 真正的SDF体积渲染 - Ray Marching实现
precision mediump float;

varying vec2 vUV;

uniform float uTime;
uniform vec3 uMainColor;
uniform vec3 uSecondaryColor;
uniform vec3 uRimColor;
uniform float uNoiseScale;
uniform float uBreathingSpeed;
uniform vec2 uResolution;

// 3D噪声函数
float hash(vec3 p) {
  p = vec3(dot(p,vec3(127.1,311.7, 74.7)),
           dot(p,vec3(269.5,183.3,246.1)),
           dot(p,vec3(113.5,271.9,124.6)));
  return fract(sin(p).x*43758.5453123);
}

float noise(vec3 x) {
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

// 3通道FBM噪声 - 完全复制ShaderPark
vec3 fbm(vec3 p, float offset) {
  return vec3(
    noise(p),
    noise(p + offset),
    noise(p + offset * 2.0)
  );
}

// SDF基础几何体
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

// 真正的SDF smooth blend - 核心柔边算法
float sdfSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

// 场景SDF - 模拟ShaderPark的两个sphere + blend
float sceneSDF(vec3 p) {
  // 基于ray方向的噪声，完全复制ShaderPark方法
  vec3 rayDir = normalize(p);
  vec3 noiseInput = rayDir + vec3(0.0, 0.0, -uTime * 0.1);
  vec3 n_vec = fbm(noiseInput * uNoiseScale, 0.1);
  n_vec = sin(n_vec * 2.0) * 0.5 + 0.75;
  n_vec = pow(n_vec, vec3(8.0));

  // 调整球体大小以获得更柔软的混合
  float sphere1 = sdSphere(p, 0.6 + n_vec.x * 0.1);
  float sphere2 = sdSphere(p, 0.4);

  // 使用更大的blend参数获得极致柔软边缘
  return sdfSmoothUnion(sphere1, sphere2, 1.2);
}

// Ray Marching核心算法
float rayMarch(vec3 ro, vec3 rd) {
  float t = 0.1;  // 稍微偏移起点
  const int MAX_STEPS = 80;
  const float MIN_DIST = 0.001;
  const float MAX_DIST = 8.0;

  for(int i = 0; i < MAX_STEPS; i++) {
    vec3 pos = ro + rd * t;
    float dist = sceneSDF(pos);

    if(dist < MIN_DIST) {
      return t;
    }

    // 更保守的步进以获得更好的柔边
    t += dist * 0.5;

    if(t > MAX_DIST) {
      break;
    }
  }

  return -1.0;
}

// 计算法线（数值微分）
vec3 calcNormal(vec3 p) {
  const float h = 0.001;
  return normalize(vec3(
    sceneSDF(p + vec3(h, 0, 0)) - sceneSDF(p - vec3(h, 0, 0)),
    sceneSDF(p + vec3(0, h, 0)) - sceneSDF(p - vec3(0, h, 0)),
    sceneSDF(p + vec3(0, 0, h)) - sceneSDF(p - vec3(0, 0, h))
  ));
}

void main() {
  // 使用vUV坐标系统
  vec2 screenPos = vUV * 2.0 - 1.0;
  screenPos.x *= uResolution.x / uResolution.y;

  // 相机设置
  vec3 cameraPos = vec3(0.0, 0.0, 2.0);
  vec3 rayDir = normalize(vec3(screenPos, -1.0));

  // 真正的体积渲染 - 沿射线采样密度
  float volumeDensity = 0.0;
  const int VOLUME_STEPS = 32;
  float stepSize = 4.0 / float(VOLUME_STEPS);

  for(int i = 0; i < VOLUME_STEPS; i++) {
    vec3 samplePos = cameraPos + rayDir * (0.1 + float(i) * stepSize);
    float sdf = sceneSDF(samplePos);

    // 将SDF距离转换为密度
    if(sdf < 0.1) {
      float density = 1.0 - smoothstep(0.0, 0.1, sdf);
      volumeDensity += density * stepSize;
    }
  }

  volumeDensity = clamp(volumeDensity, 0.0, 1.0);

  if(volumeDensity > 0.001) {
    // 计算颜色
    vec3 avgPos = cameraPos + rayDir * 2.0;
    vec3 noiseInput = normalize(avgPos) + vec3(0.0, 0.0, -uTime * 0.1);
    vec3 n_vec = fbm(noiseInput * uNoiseScale, 0.1);
    n_vec = sin(n_vec * 2.0) * 0.5 + 0.75;
    n_vec = pow(n_vec, vec3(8.0));

    vec3 centerColor = mix(uMainColor, uSecondaryColor, n_vec.x);
    vec3 edgeColor = mix(uSecondaryColor, uRimColor, n_vec.y);
    vec3 finalColor = mix(centerColor, edgeColor, 1.0 - volumeDensity);
    finalColor *= n_vec;

    // 呼吸效果
    float breath = 0.8 + 0.2 * sin(uTime * uBreathingSpeed);
    finalColor *= breath;

    // 使用volumeDensity作为alpha实现真正的体积透明度
    gl_FragColor = vec4(finalColor, volumeDensity);
  } else {
    discard;
  }
}