/**
 * 弥散霓虹材质着色器
 * 实现Fresnel边缘发光、内部发光、色彩渐变和颗粒效果
 */

import * as THREE from 'three'
import { NeonConfig } from './neonConfig'

// 顶点着色器
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
}
`

// 片元着色器
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

// 随机函数
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// 噪声函数
float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  
  vec2 u = f * f * (3.0 - 2.0 * f);
  
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// 渐变色彩函数
vec3 gradientColor(float t) {
  float factor = clamp(t, 0.0, 1.0);
  return mix(uColorSecondary, uColorMain, smoothstep(0.0, 1.0, factor));
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewDir);
  
  // Fresnel边缘发光计算
  float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 1.05 + uFresnelIntensity * 0.3);
  float rim = smoothstep(0.1, 1.0, fresnel) * (uFresnelIntensity * 0.7);

  // 内部发光计算 - 基于法线朝向
  float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
  float innerGlow = pow(facing, 1.4) * (uInnerGlowIntensity * 0.85);

  // 位置渐变计算 - 增强渐变效果
  float gradientFactor = 0.5 + vWorldPosition.y * uGradientStrength;
  vec3 baseColor = gradientColor(gradientFactor);

  // 添加法线渐变 - 基于法线朝向的渐变
  float normalGradient = 0.5 + dot(normal, vec3(0.0, 1.0, 0.0)) * (uGradientStrength * 0.85);
  vec3 normalColor = gradientColor(normalGradient);
  baseColor = mix(baseColor, normalColor, 0.45);

  // 呼吸动画效果
  float breathing = 0.5 + 0.5 * sin(uBreathing);
  float neonBoost = mix(1.0, 1.0 + uFresnelIntensity * 0.25, breathing);

  // 基础颜色计算 - 增加磨砂质感
  vec3 color = baseColor * (0.72 + 0.18 * innerGlow);
  color += uColorRim * rim * 0.4; // 边缘发光
  color += baseColor * pow(rim, 1.35) * 0.22; // 增加雾化感
  color *= neonBoost * 0.88; // 整体发光

  // 增加磨砂质感 - 基于法线的粗糙度
  float roughness = 1.0 - dot(normal, viewDir);
  color *= (0.7 + 0.3 * roughness);

  // 柔化中心与边缘对比，模拟体积散射
  float softness = smoothstep(0.3, 0.9, fresnel);
  color = mix(color, mix(color, uColorRim, 0.22), softness * 0.35);

  // 颗粒噪点效果 - 增强颗粒感
  float grainSample = random(gl_FragCoord.xy * 0.28 + uTime * 0.08);
  float grain = (grainSample - 0.5) * uGrainIntensity * 0.7;
  color += grain;
  
  // 高频噪点 - 增强胶片质感
  float noiseSample = noise(gl_FragCoord.xy * 0.045 + uTime * 0.04);
  float noiseValue = (noiseSample - 0.5) * uGrainIntensity * 0.55;
  color += noiseValue;
  
  // 低频噪点 - 增加纹理细节
  float lowFreqNoise = noise(gl_FragCoord.xy * 0.018 + uTime * 0.018);
  float lowFreq = (lowFreqNoise - 0.5) * uGrainIntensity * 0.28;
  color += lowFreq;

  // 提升磨砂感：混合回基色，避免过曝
  color = mix(color, baseColor, 0.45);

  // 颜色限制和输出 - 增加磨砂质感
  color = clamp(color, 0.0, 1.45);
  float alpha = clamp(0.8 + rim * 0.08, 0.76, 0.95); // 保留部分半透明
  
  gl_FragColor = vec4(color, alpha);
}
`

// 创建弥散霓虹材质
export function createNeonMaterial(config: NeonConfig): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
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
      uBreathing: { value: 0 }
    },
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending, // 改为正常混合，增加磨砂质感
    depthWrite: true,
    depthTest: true
  })
}

// 更新材质参数
export function updateNeonMaterial(material: THREE.ShaderMaterial, config: NeonConfig, time: number) {
  if (!material.uniforms) return
  
  material.uniforms.uTime.value = time
  material.uniforms.uColorMain.value.set(config.mainColor)
  material.uniforms.uColorSecondary.value.set(config.secondaryColor)
  material.uniforms.uColorRim.value.set(config.rimColor)
  material.uniforms.uFresnelIntensity.value = config.fresnelIntensity
  material.uniforms.uInnerGlowIntensity.value = config.innerGlowIntensity
  material.uniforms.uGradientStrength.value = config.gradientStrength
  material.uniforms.uGrainIntensity.value = config.grainIntensity
  material.uniforms.uBreathing.value = time * config.breathingSpeed
}

// 材质预设
export const materialPresets = {
  // 默认材质 - 参考图风格
  default: {
    fresnelIntensity: 2.5,
    innerGlowIntensity: 1.8,
    gradientStrength: 0.5,
    grainIntensity: 0.5
  },
  
  // 柔和材质 - 移动端优化
  soft: {
    fresnelIntensity: 1.8,
    innerGlowIntensity: 1.2,
    gradientStrength: 0.3,
    grainIntensity: 0.3
  },
  
  // 强烈材质 - 桌面端高质量
  intense: {
    fresnelIntensity: 3.0,
    innerGlowIntensity: 2.2,
    gradientStrength: 0.6,
    grainIntensity: 0.6
  }
}
