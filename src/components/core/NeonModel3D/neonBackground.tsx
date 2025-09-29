/**
 * 弥散霓虹背景效果
 * 使用渐变+噪声着色器模拟柔雾背景
 */

import { useMemo, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NeonConfig } from './neonConfig'

const backgroundVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const backgroundFragmentShader = `
varying vec2 vUv;

uniform float uTime;
uniform vec3 uColorTop;
uniform vec3 uColorMid;
uniform vec3 uColorBottom;
uniform vec3 uColorGlow;
uniform float uNoiseScale;
uniform float uNoiseIntensity;
uniform float uBaseLuma;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

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

void main() {
  vec2 uv = vUv;

  vec3 topBlend = mix(uColorMid, uColorTop, smoothstep(0.45, 1.0, uv.y));
  vec3 bottomBlend = mix(uColorBottom, uColorMid, smoothstep(0.0, 0.55, uv.y));
  vec3 gradient = mix(bottomBlend, topBlend, smoothstep(0.2, 0.85, uv.y));

  float centerDist = distance(uv, vec2(0.5, 0.58));
  float radial = smoothstep(0.88, 0.25, centerDist);
  vec3 glow = uColorGlow * radial * 0.38;

  float animatedNoise = noise(uv * uNoiseScale + uTime * 0.05);
  float midNoise = noise(uv * (uNoiseScale * 0.6) + uTime * 0.12);
  float fineNoise = random(uv * uNoiseScale * 2.6 + uTime * 0.45);
  float grain = (animatedNoise - 0.5) * uNoiseIntensity;
  grain += (fineNoise - 0.5) * uNoiseIntensity * 0.5;
  grain += (midNoise - 0.5) * uNoiseIntensity * 0.35;

  float vignette = smoothstep(0.2, 0.95, centerDist * 1.25);
  vec3 baseTint = vec3(0.12, 0.11, 0.16) * uBaseLuma;
  vec3 color = gradient + glow;
  color = mix(baseTint, color, 0.68);
  color *= mix(0.78, 1.08, vignette);
  color += grain;
  color = clamp(color, 0.0, 1.1);

  gl_FragColor = vec4(color, 1.0);
}
`

interface NeonBackgroundProps {
  config: NeonConfig
}

export function NeonBackground({ config }: NeonBackgroundProps) {
  const shaderMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: backgroundVertexShader,
    fragmentShader: backgroundFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uColorTop: { value: new THREE.Color() },
      uColorMid: { value: new THREE.Color() },
      uColorBottom: { value: new THREE.Color() },
      uColorGlow: { value: new THREE.Color() },
      uNoiseScale: { value: 3.5 },
      uNoiseIntensity: { value: 0.14 },
      uBaseLuma: { value: 1.0 }
    },
    transparent: false,
    depthWrite: false
  }), [])

  const atmosphereRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    const top = new THREE.Color(config.mainColor).lerp(new THREE.Color('#f1d7ff'), 0.45)
    const mid = new THREE.Color(config.secondaryColor).lerp(new THREE.Color('#d9e6ff'), 0.4)
    const bottom = new THREE.Color(config.secondaryColor).lerp(new THREE.Color('#bcd6ff'), 0.35)
    const glow = new THREE.Color(config.rimColor).lerp(new THREE.Color('#fff4f0'), 0.28)

    shaderMaterial.uniforms.uColorTop.value.copy(top)
    shaderMaterial.uniforms.uColorMid.value.copy(mid)
    shaderMaterial.uniforms.uColorBottom.value.copy(bottom)
    shaderMaterial.uniforms.uColorGlow.value.copy(glow)
    shaderMaterial.uniforms.uBaseLuma.value = 0.62
  }, [config.mainColor, config.secondaryColor, config.rimColor, shaderMaterial])

  useEffect(() => () => shaderMaterial.dispose(), [shaderMaterial])

  useFrame((state) => {
    shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime

    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.x = state.clock.elapsedTime * 0.04
      atmosphereRef.current.rotation.z = state.clock.elapsedTime * 0.02
    }
  })

  return (
    <>
      <color attach="background" args={['#271f33']} />
      <fog attach="fog" args={['#30253f', 6, 16]} />

      <mesh position={[0, 0, -6]} scale={[22, 16, 1]} material={shaderMaterial}>
        <planeGeometry args={[1, 1, 1, 1]} />
      </mesh>

      <mesh ref={atmosphereRef} scale={[16, 16, 16]}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          color={config.mainColor}
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  )
}
