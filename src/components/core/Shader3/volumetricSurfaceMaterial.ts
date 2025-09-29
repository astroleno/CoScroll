import * as THREE from 'three'

/**
 * Shader3 Volumetric Surface Material
 * 受 docs/shader3实现.md 启发，实现 FBM 噪声 + Fresnel + 渐变色 + 体感弥散
 * - 完全独立，可用于任意 Mesh
 * - 提供 createShader3Material 与 updateShader3Material 两个方法
 * - 带详细注释与必要的 try-catch，便于排错
 */

export interface Shader3UniformConfig {
  mainColor: string
  secondaryColor: string
  rimColor: string
  fresnelIntensity: number
  innerGlowIntensity: number
  gradientStrength: number
  grainIntensity: number
  breathingSpeed: number
  noiseScale: number
  noiseLayers: number
  noiseAmplitude: number
  warmCoolMix: number
  rimPower: number
  streakFrequency: number
  streakContrast: number
  lightDirection?: [number, number, number]
  edgeSoftness?: number
  sssStrength?: number
  sssPower?: number
  sssColor?: string
}

export const defaultShader3Config: Shader3UniformConfig = {
  mainColor: '#ffb27d',
  secondaryColor: '#7dbbff',
  rimColor: '#ffd6c2',
  fresnelIntensity: 2.4,
  innerGlowIntensity: 1.8,
  gradientStrength: 0.55,
  grainIntensity: 0.55,
  breathingSpeed: 0.6,
  noiseScale: 1.2,
  noiseLayers: 4,
  noiseAmplitude: 0.6,
  warmCoolMix: 0.65,
  rimPower: 2.2,
  streakFrequency: 9.0,
  streakContrast: 1.2,
  lightDirection: [0.2, 0.6, 0.7],
  edgeSoftness: 0.6,
  sssStrength: 0.55,
  sssPower: 1.6,
  sssColor: '#ffbfa1'
}

// 顶点着色器：输出法线、世界坐标与视线方向
const vertexShader = `
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vViewDir = normalize(cameraPosition - vWorldPosition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

// 片元着色器：实现 FBM、Fresnel、体感雾化与胶片噪点
const fragmentShader = `
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;

uniform float uTime;
uniform vec3 uColorMain;
uniform vec3 uColorSecondary;
uniform vec3 uColorRim;
uniform float uFresnelIntensity;
uniform float uInnerGlowIntensity;
uniform float uGradientStrength;
uniform float uGrainIntensity;
uniform float uBreathing;
uniform float uNoiseScale;
uniform int uNoiseLayers;
uniform float uNoiseAmplitude;
uniform float uWarmCoolMix;
uniform float uRimPower;
uniform float uStreakFreq;
uniform float uStreakContrast;
uniform vec3 uLightDir;
uniform float uEdgeSoftness;
uniform float uSSSStrength;
uniform float uSSSPower;
uniform vec3 uSSSColor;

// 经典 hash 与噪声
float hash(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.1,0.2,0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  float n000 = hash(i + vec3(0.0,0.0,0.0));
  float n100 = hash(i + vec3(1.0,0.0,0.0));
  float n010 = hash(i + vec3(0.0,1.0,0.0));
  float n110 = hash(i + vec3(1.0,1.0,0.0));
  float n001 = hash(i + vec3(0.0,0.0,1.0));
  float n101 = hash(i + vec3(1.0,0.0,1.0));
  float n011 = hash(i + vec3(0.0,1.0,1.0));
  float n111 = hash(i + vec3(1.0,1.0,1.0));
  vec3 u = f*f*(3.0-2.0*f);
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}

float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amp * noise3(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return value;
}

vec3 gradientColor(float t) {
  float factor = clamp(t, 0.0, 1.0);
  return mix(uColorSecondary, uColorMain, smoothstep(0.0, 1.0, factor));
}

// 三向投影混合权重，减少接缝
vec3 triplanarBlend(vec3 n){
  vec3 an = abs(n);
  an = max(an, 0.0001);
  return an / (an.x + an.y + an.z);
}

// 抗锯齿阈值函数，减少高频条纹的接缝/摩尔纹
float aastep(float threshold, float value){
  float afwidth = 0.7 * fwidth(value);
  return smoothstep(threshold - afwidth, threshold + afwidth, value);
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewDir);
  vec3 lightDir = normalize(uLightDir);

  // Fresnel 控制边缘发光强度
  float ndv = clamp(dot(normal, viewDir), 0.0, 1.0);
  float fresnel = pow(1.0 - ndv, uRimPower);
  float rim = smoothstep(0.1, 1.0, fresnel) * (uFresnelIntensity * 0.7);

  // FBM 噪声体感：在世界坐标里做缓慢流动
  vec3 p = vWorldPosition * uNoiseScale + vec3(0.0, 0.0, -uTime * 0.25);
  float n = fbm(p, uNoiseLayers);
  n = pow(n, 2.2) * uNoiseAmplitude; // 强化高光区域

  // 渐变与法线调制
  float gradientFactor = 0.5 + vWorldPosition.y * uGradientStrength;
  vec3 baseColor = gradientColor(gradientFactor);
  float normalGradient = 0.5 + dot(normal, vec3(0.0, 1.0, 0.0)) * (uGradientStrength * 0.8);
  baseColor = mix(baseColor, gradientColor(normalGradient), 0.4);

  // 冷暖双色调和（靠边缘更冷，中心更暖）
  vec3 warm = baseColor;
  vec3 cool = mix(uColorSecondary, vec3(0.8,0.9,1.0), 0.35);
  float edgeFactor = smoothstep(0.2, 1.0, fresnel);
  baseColor = mix(warm, cool, edgeFactor * uWarmCoolMix);

  // 呼吸增强
  float breathing = 0.5 + 0.5 * sin(uBreathing);
  float neonBoost = mix(1.0, 1.0 + uFresnelIntensity * 0.25, breathing);

  // 体感雾化颜色合成
  vec3 color = baseColor * (0.70 + 0.25 * pow(ndv, 1.4) * uInnerGlowIntensity);
  color += uColorRim * rim * 0.45;
  color += baseColor * pow(rim, 1.35) * 0.22;
  color += vec3(n) * 0.35; // 噪声赋予厚度
  color *= neonBoost * 0.9;

  // 刷纹条纹（三向投影的各向异性条纹），模拟书法肌理
  vec3 w = triplanarBlend(normal);
  float nx = fbm(vec3(vWorldPosition.xz, uTime*0.2), uNoiseLayers);
  float ny = fbm(vec3(vWorldPosition.xy + 3.1, uTime*0.2), uNoiseLayers);
  float nz = fbm(vec3(vWorldPosition.yz + 6.2, uTime*0.2), uNoiseLayers);
  float sx = 0.5 + 0.5 * sin(vWorldPosition.y * uStreakFreq + nx * 3.14);
  float sy = 0.5 + 0.5 * sin(vWorldPosition.z * uStreakFreq + ny * 3.14);
  float sz = 0.5 + 0.5 * sin(vWorldPosition.x * uStreakFreq + nz * 3.14);
  sx = aastep(0.55, sx);
  sy = aastep(0.55, sy);
  sz = aastep(0.55, sz);
  float streak = (sx*w.x + sy*w.y + sz*w.z);
  streak = pow(streak, uStreakContrast);
  color = mix(color, color * (0.75 + 0.25 * streak), 0.65);

  // 假高光（半 Lambert）沿刷纹方向更亮
  float hLambert = max(0.0, dot(normalize(normal + viewDir), lightDir));
  color += baseColor * pow(hLambert, 8.0) * 0.25;

  // 次表面散射近似（果冻感）：边缘透光 + 暖色调
  float sss = pow(1.0 - ndv, uSSSPower) * uSSSStrength;
  vec3 sssColor = mix(baseColor, uSSSColor, 0.7);
  color = mix(color, color + sssColor * 0.6, sss);

  // 胶片噪点（屏幕空间），提升质感
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
  color += (grain - 0.5) * uGrainIntensity * 0.6;

  // 适当回混，避免过曝
  color = mix(color, baseColor, 0.35);
  color = clamp(color, 0.0, 1.4);
  // 边缘柔化：根据 Fresnel 降低 alpha，并做抖动避免带状
  float edge = smoothstep(0.0, uEdgeSoftness, fresnel);
  edge = clamp(edge + (grain - 0.5) * 0.03, 0.0, 1.0);
  float alpha = clamp(0.9 - edge * 0.35, 0.55, 0.98);
  gl_FragColor = vec4(color, alpha);
}`

export function createShader3Material(config: Shader3UniformConfig): THREE.ShaderMaterial {
  try {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColorMain: { value: new THREE.Color(config.mainColor) },
        uColorSecondary: { value: new THREE.Color(config.secondaryColor) },
        uColorRim: { value: new THREE.Color(config.rimColor) },
        uFresnelIntensity: { value: config.fresnelIntensity },
        uInnerGlowIntensity: { value: config.innerGlowIntensity },
        uGradientStrength: { value: config.gradientStrength },
        uGrainIntensity: { value: config.grainIntensity },
        uBreathing: { value: 0 },
        uNoiseScale: { value: config.noiseScale },
        uNoiseLayers: { value: config.noiseLayers },
        uNoiseAmplitude: { value: config.noiseAmplitude },
        uWarmCoolMix: { value: config.warmCoolMix },
        uRimPower: { value: config.rimPower },
        uStreakFreq: { value: config.streakFrequency },
        uStreakContrast: { value: config.streakContrast },
        uLightDir: { value: new THREE.Vector3(...(config.lightDirection || [0.2,0.6,0.7])) },
        uEdgeSoftness: { value: config.edgeSoftness ?? 0.6 },
        uSSSStrength: { value: config.sssStrength ?? 0.55 },
        uSSSPower: { value: config.sssPower ?? 1.6 },
        uSSSColor: { value: new THREE.Color(config.sssColor ?? '#ffbfa1') }
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true,
      blending: THREE.NormalBlending
    })
    return material
  } catch (error) {
    // 打印详细错误，方便定位 shader 编译问题
    console.error('[Shader3] createShader3Material error:', error)
    throw error
  }
}

export function updateShader3Material(
  material: THREE.ShaderMaterial,
  config: Shader3UniformConfig,
  time: number
) {
  try {
    if (!material || !material.uniforms) return
    material.uniforms.uTime.value = time
    material.uniforms.uColorMain.value.set(config.mainColor)
    material.uniforms.uColorSecondary.value.set(config.secondaryColor)
    material.uniforms.uColorRim.value.set(config.rimColor)
    material.uniforms.uFresnelIntensity.value = config.fresnelIntensity
    material.uniforms.uInnerGlowIntensity.value = config.innerGlowIntensity
    material.uniforms.uGradientStrength.value = config.gradientStrength
    material.uniforms.uGrainIntensity.value = config.grainIntensity
    material.uniforms.uBreathing.value = time * config.breathingSpeed
    material.uniforms.uNoiseScale.value = config.noiseScale
    material.uniforms.uNoiseLayers.value = config.noiseLayers
    material.uniforms.uNoiseAmplitude.value = config.noiseAmplitude
    material.uniforms.uWarmCoolMix.value = config.warmCoolMix
    material.uniforms.uRimPower.value = config.rimPower
    material.uniforms.uStreakFreq.value = config.streakFrequency
    material.uniforms.uStreakContrast.value = config.streakContrast
    const ld = config.lightDirection || [0.2,0.6,0.7]
    material.uniforms.uLightDir.value.set(ld[0], ld[1], ld[2])
    material.uniforms.uEdgeSoftness.value = (config.edgeSoftness ?? 0.6)
    material.uniforms.uSSSStrength.value = (config.sssStrength ?? 0.55)
    material.uniforms.uSSSPower.value = (config.sssPower ?? 1.6)
    material.uniforms.uSSSColor.value.set(config.sssColor ?? '#ffbfa1')
  } catch (error) {
    console.error('[Shader3] updateShader3Material error:', error)
  }
}


