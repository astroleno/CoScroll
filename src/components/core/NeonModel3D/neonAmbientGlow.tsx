/**
 * 气体弥散光罩
 * 在模型周围叠加体积感的柔光层，强化Volumetric Gradient/ambient glow
 */

import { useEffect, useMemo } from 'react'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { NeonConfig } from './neonConfig'

const glowVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const glowFragmentShader = `
varying vec2 vUv;

uniform float uTime;
uniform vec3 uColorInner;
uniform vec3 uColorOuter;
uniform float uIntensity;
uniform float uNoiseScale;

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
  vec2 centeredUv = vUv - 0.5;
  float dist = length(centeredUv) * 2.2;
  float falloff = pow(max(0.0, 1.0 - dist), 2.5);

  float animatedNoise = noise(centeredUv * uNoiseScale + uTime * 0.12);
  float surfaceNoise = random(centeredUv * (uNoiseScale * 2.5) + uTime * 0.6);
  float grain = (animatedNoise - 0.5) * 0.4 + (surfaceNoise - 0.5) * 0.2;

  vec3 base = mix(uColorOuter, uColorInner, smoothstep(0.0, 0.7, falloff));
  base *= mix(0.9, 1.35, falloff);
  base += grain * 0.35;

  float alpha = falloff * 0.95;
  alpha += grain * 0.2;
  alpha = clamp(alpha * uIntensity, 0.0, 1.0);

  gl_FragColor = vec4(base, alpha);
}
`

interface NeonAmbientGlowProps {
  config: NeonConfig
}

export function NeonAmbientGlow({ config }: NeonAmbientGlowProps) {
  const innerGlowMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: glowVertexShader,
    fragmentShader: glowFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColorInner: { value: new THREE.Color() },
      uColorOuter: { value: new THREE.Color() },
      uIntensity: { value: 0.42 },
      uNoiseScale: { value: 1.4 }
    }
  }), [])

  const outerGlowMaterial = useMemo(() => innerGlowMaterial.clone(), [innerGlowMaterial])

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    innerGlowMaterial.uniforms.uTime.value = elapsed
    outerGlowMaterial.uniforms.uTime.value = elapsed
    innerGlowMaterial.uniforms.uIntensity.value = 0.52 + Math.sin(elapsed * 0.5) * 0.03
    outerGlowMaterial.uniforms.uIntensity.value = 0.28 + Math.sin(elapsed * 0.32 + 0.6) * 0.02
  })

  useEffect(() => {
    const rimColor = new THREE.Color(config.rimColor)
    const mainColor = new THREE.Color(config.mainColor)
    const secondary = new THREE.Color(config.secondaryColor)

    innerGlowMaterial.uniforms.uColorInner.value.copy(mainColor.clone().lerp(new THREE.Color('#f5ecff'), 0.3))
    innerGlowMaterial.uniforms.uColorOuter.value.copy(rimColor.clone().lerp(secondary, 0.35))

    outerGlowMaterial.uniforms.uColorInner.value.copy(secondary.clone().lerp(mainColor, 0.35))
    outerGlowMaterial.uniforms.uColorOuter.value.copy(rimColor.clone().lerp(new THREE.Color('#fef3ff'), 0.6))
    outerGlowMaterial.uniforms.uNoiseScale.value = 0.8
  }, [config.mainColor, config.secondaryColor, config.rimColor, innerGlowMaterial, outerGlowMaterial])

  useEffect(() => () => {
    innerGlowMaterial.dispose()
    outerGlowMaterial.dispose()
  }, [innerGlowMaterial, outerGlowMaterial])

  return (
    <group>
      <Billboard>
        <mesh scale={[3.4, 3.4, 1]} material={outerGlowMaterial}>
          <planeGeometry args={[1, 1, 1, 1]} />
        </mesh>
      </Billboard>
      <Billboard>
        <mesh scale={[2.5, 2.5, 1]} position={[0, 0.06, 0.08]} material={innerGlowMaterial}>
          <planeGeometry args={[1, 1, 1, 1]} />
        </mesh>
      </Billboard>
    </group>
  )
}
