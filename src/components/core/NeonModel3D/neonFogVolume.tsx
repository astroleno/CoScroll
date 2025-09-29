/**
 * 体积雾粒子层
 * 使用点精灵模拟漂浮的雾状颗粒，增加体积感和柔化效果
 */

import { useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NeonConfig } from './neonConfig'

const fogVertexShader = `
uniform float uSize;
uniform float uTime;
uniform float uSpread;
uniform float uFloatAmplitude;

attribute float aScale;
attribute float aSpeed;
attribute vec3 aOffset;

varying float vAlpha;
varying vec3 vColor;

float random(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

void main() {
  vec3 displaced = position;
  float floatOffset = sin(uTime * aSpeed + aOffset.x) * uFloatAmplitude;
  displaced += vec3(0.0, floatOffset, 0.0);

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  float depthFactor = clamp(-mvPosition.z / 5.0, 0.2, 1.5);

  gl_PointSize = uSize * aScale * depthFactor;
  gl_PointSize *= (1.0 / -mvPosition.z);

  vAlpha = clamp(1.0 - (length(displaced) / uSpread), 0.0, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`

const fogFragmentShader = `
uniform vec3 uColorInner;
uniform vec3 uColorOuter;
uniform float uTime;
uniform float uOpacity;

varying float vAlpha;

float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  float mask = smoothstep(0.5, 0.0, dist);

  float grain = noise(coord * 24.0 + uTime * 0.08) - 0.5;
  float softness = smoothstep(0.4, 0.0, dist);
  float alpha = mask * softness * vAlpha * uOpacity;
  alpha += grain * 0.18 * alpha;

  vec3 color = mix(uColorOuter, uColorInner, mask);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.6));
}
`

interface NeonFogVolumeProps {
  config: NeonConfig
  particleCount?: number
}

export function NeonFogVolume({ config, particleCount = 420 }: NeonFogVolumeProps) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const scales = new Float32Array(particleCount)
    const speeds = new Float32Array(particleCount)
    const offsets = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      const radius = 0.6 + Math.random() * 1.4
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      const x = radius * Math.sin(phi) * Math.cos(theta)
      const y = radius * Math.cos(phi)
      const z = radius * Math.sin(phi) * Math.sin(theta)

      positions[i * 3] = x * 1.6
      positions[i * 3 + 1] = y * 1.2
      positions[i * 3 + 2] = z * 1.6

      scales[i] = 0.6 + Math.random() * 0.9
      speeds[i] = 0.4 + Math.random() * 0.6
      offsets[i * 3] = Math.random() * Math.PI * 2
      offsets[i * 3 + 1] = Math.random() * Math.PI * 2
      offsets[i * 3 + 2] = Math.random() * Math.PI * 2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3))

    return geo
  }, [particleCount])

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: fogVertexShader,
    fragmentShader: fogFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 160 },
      uSpread: { value: 3.5 },
      uFloatAmplitude: { value: 0.18 },
      uColorInner: { value: new THREE.Color() },
      uColorOuter: { value: new THREE.Color() },
      uOpacity: { value: 0.32 }
    }
  }), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    material.uniforms.uTime.value = t
    material.uniforms.uOpacity.value = 0.28 + Math.sin(t * 0.35) * 0.04
  })

  useEffect(() => {
    const inner = new THREE.Color(config.mainColor).lerp(new THREE.Color('#ffffff'), 0.55)
    const outer = new THREE.Color(config.secondaryColor).lerp(new THREE.Color('#ffffff'), 0.35)

    material.uniforms.uColorInner.value.copy(inner)
    material.uniforms.uColorOuter.value.copy(outer)
  }, [config.mainColor, config.secondaryColor, material])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  return <points geometry={geometry} material={material} />
}
