import * as THREE from 'three'

export interface NeonMaterialConfig {
  mainColor: THREE.ColorRepresentation
  secondaryColor: THREE.ColorRepresentation
  rimColor: THREE.ColorRepresentation
  neonIntensity: number
  rimIntensity: number
  grainIntensity: number
  gradientStrength: number
  innerGlow: number
  opacity: number
  noiseScale: number
  noiseSpeed: number
}

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  uniform float uTime;
  uniform vec3 uColorMain;
  uniform vec3 uColorSecondary;
  uniform vec3 uColorRim;
  uniform float uNeonIntensity;
  uniform float uRimIntensity;
  uniform float uGrainIntensity;
  uniform float uGradientStrength;
  uniform float uInnerGlow;
  uniform float uOpacity;
  uniform float uNoiseScale;
  uniform float uNoiseSpeed;
  uniform float uBreath;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  vec3 gradientColor(float t) {
    float factor = clamp(t, 0.0, 1.0);
    return mix(uColorSecondary, uColorMain, smoothstep(0.0, 1.0, factor));
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDir);

    float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.5);
    float rim = smoothstep(0.2, 1.0, fresnel) * uRimIntensity;

    float gradientFactor = 0.5 + vWorldPosition.y * uGradientStrength;
    vec3 baseColor = gradientColor(gradientFactor);

    float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
    float innerGlow = pow(facing, 1.5) * uInnerGlow;

    float breathing = 0.5 + 0.5 * sin(uBreath);
    float neonBoost = mix(1.0, 1.0 + uNeonIntensity * 0.85, breathing);

    vec3 color = baseColor * (0.6 + 0.4 * innerGlow);
    color += uColorRim * rim * uNeonIntensity;
    color *= neonBoost;

    float grainSample = random(gl_FragCoord.xy * uNoiseScale + uTime * uNoiseSpeed);
    float grain = (grainSample - 0.5) * uGrainIntensity;
    color += grain;

    color = clamp(color, 0.0, 2.0);
    float alpha = clamp(uOpacity + rim * 0.6, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`

const defaultConfig: NeonMaterialConfig = {
  mainColor: '#ffb199',
  secondaryColor: '#4ecdc4',
  rimColor: '#ffd18b',
  neonIntensity: 0.9,
  rimIntensity: 1.2,
  grainIntensity: 0.18,
  gradientStrength: 0.18,
  innerGlow: 1.0,
  opacity: 0.75,
  noiseScale: 1.0,
  noiseSpeed: 0.25
}

export function createNeonMaterial(config?: Partial<NeonMaterialConfig>) {
  const merged = { ...defaultConfig, ...config }

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorMain: { value: new THREE.Color(merged.mainColor) },
      uColorSecondary: { value: new THREE.Color(merged.secondaryColor) },
      uColorRim: { value: new THREE.Color(merged.rimColor) },
      uNeonIntensity: { value: merged.neonIntensity },
      uRimIntensity: { value: merged.rimIntensity },
      uGrainIntensity: { value: merged.grainIntensity },
      uGradientStrength: { value: merged.gradientStrength },
      uInnerGlow: { value: merged.innerGlow },
      uOpacity: { value: merged.opacity },
      uNoiseScale: { value: merged.noiseScale },
      uNoiseSpeed: { value: merged.noiseSpeed },
      uBreath: { value: 0 }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
}

