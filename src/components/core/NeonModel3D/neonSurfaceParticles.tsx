/**
 * 表面雾化颗粒层
 * 直接贴附在模型表面，营造柔和的体积纹理
 */

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler'
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils'
import { NeonConfig } from './neonConfig'

const surfaceVertexShader = `
uniform float uTime;
uniform float uSize;
uniform float uFloatAmplitude;

attribute float aNoise;
attribute vec3 aNormal;

varying float vNoise;
varying float vMask;

void main() {
  vec3 displaced = position + aNormal * aNoise * 0.035;
  displaced += aNormal * sin(uTime * 0.7 + aNoise * 6.283) * uFloatAmplitude;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  gl_PointSize = uSize * (1.0 / -mvPosition.z);
  gl_PointSize = clamp(gl_PointSize, 2.0, 28.0);

  vMask = clamp(dot(normalize(aNormal), vec3(0.0, 0.8, 0.2)) * 0.5 + 0.5, 0.1, 1.0);
  vNoise = aNoise;
  gl_Position = projectionMatrix * mvPosition;
}
`

const surfaceFragmentShader = `
uniform vec3 uColorInner;
uniform vec3 uColorOuter;
uniform float uOpacity;
uniform float uTime;

varying float vNoise;
varying float vMask;

float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);
  float feather = smoothstep(0.5, 0.15, dist);
  float halo = smoothstep(0.45, 0.0, dist);

  float grain = (noise(uv * 24.0 + uTime * 0.1) - 0.5) * 0.25;
  float alpha = feather * halo * uOpacity * mix(0.7, 1.0, vMask);
  alpha += grain * 0.2 * alpha;

  vec3 color = mix(uColorOuter, uColorInner, halo);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.65));
}
`

interface NeonSurfaceParticlesProps {
  scene: THREE.Object3D | null
  config: NeonConfig
  count?: number
}

export function NeonSurfaceParticles({ scene, config, count = 900 }: NeonSurfaceParticlesProps) {
  const data = useMemo(() => {
    if (!scene) return null

    scene.updateMatrixWorld(true)

    const meshes: THREE.Mesh[] = []
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.updateMatrix()
        if (mesh.geometry) {
          meshes.push(mesh)
        }
      }
    })

    if (!meshes.length) return null

    const appliedGeometries: THREE.BufferGeometry[] = []
    meshes.forEach((mesh) => {
      const geo = mesh.geometry.clone()
      geo.applyMatrix4(mesh.matrixWorld)
      appliedGeometries.push(geo)
    })

    const merged = mergeBufferGeometries(appliedGeometries, true)
    appliedGeometries.forEach((geo) => geo.dispose())

    if (!merged) return null

    const tempMesh = new THREE.Mesh(merged)
    const sampler = new MeshSurfaceSampler(tempMesh).build()

    const positions = new Float32Array(count * 3)
    const normals = new Float32Array(count * 3)
    const noises = new Float32Array(count)

    const tempPosition = new THREE.Vector3()
    const tempNormal = new THREE.Vector3()

    for (let i = 0; i < count; i++) {
      sampler.sample(tempPosition, tempNormal)
      positions[i * 3] = tempPosition.x
      positions[i * 3 + 1] = tempPosition.y
      positions[i * 3 + 2] = tempPosition.z

      normals[i * 3] = tempNormal.x
      normals[i * 3 + 1] = tempNormal.y
      normals[i * 3 + 2] = tempNormal.z

      noises[i] = Math.random()
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3))
    geometry.setAttribute('aNoise', new THREE.BufferAttribute(noises, 1))

    tempMesh.geometry.dispose()

    const material = new THREE.ShaderMaterial({
      vertexShader: surfaceVertexShader,
      fragmentShader: surfaceFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 22 },
        uFloatAmplitude: { value: 0.02 },
        uColorInner: { value: new THREE.Color() },
        uColorOuter: { value: new THREE.Color() },
        uOpacity: { value: 0.5 }
      }
    })

    return { geometry, material }
  }, [scene, count])

  useFrame((state) => {
    if (!data) return
    data.material.uniforms.uTime.value = state.clock.elapsedTime
  })

  useEffect(() => {
    if (!data) return
    const inner = new THREE.Color(config.mainColor).lerp(new THREE.Color('#ffffff'), 0.6)
    const outer = new THREE.Color(config.secondaryColor).lerp(new THREE.Color('#ffffff'), 0.4)

    data.material.uniforms.uColorInner.value.copy(inner)
    data.material.uniforms.uColorOuter.value.copy(outer)
    data.material.uniforms.uOpacity.value = 0.42
  }, [config.mainColor, config.secondaryColor, data])

  useEffect(() => () => {
    if (!data) return
    data.geometry.dispose()
    data.material.dispose()
  }, [data])

  if (!data) return null

  return <points geometry={data.geometry} material={data.material} />
}
