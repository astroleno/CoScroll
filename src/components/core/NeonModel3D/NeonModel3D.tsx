'use client'

import { Suspense, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Center, useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, ChromaticAberration, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { clone as cloneSkinnedScene } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { createNeonMaterial, NeonMaterialConfig } from './neonMaterial'

export interface NeonModel3DProps {
  modelPath?: string
  autoRotate?: boolean
  rotationSpeed?: number
  wobbleIntensity?: number
  pulseSpeed?: number
  quality?: 'low' | 'medium' | 'high'
  neonConfig?: Partial<NeonMaterialConfig>
  className?: string
  style?: CSSProperties
  showFloorGlow?: boolean
}

const DEFAULT_MODEL_PATH = '/models/10k/003_道.glb'

export default function NeonModel3D({
  modelPath = DEFAULT_MODEL_PATH,
  autoRotate = true,
  rotationSpeed = 0.35,
  wobbleIntensity = 0.15,
  pulseSpeed = 0.6,
  quality = 'medium',
  neonConfig,
  className,
  style,
  showFloorGlow = true
}: NeonModel3DProps) {
  const dpr: [number, number] =
    quality === 'high' ? [1.5, 2] : quality === 'low' ? [0.8, 1.1] : [1, 1.6]
  const bloomIntensity = quality === 'high' ? 1.1 : quality === 'low' ? 0.55 : 0.85
  const noiseOpacity = quality === 'low' ? 0.15 : 0.22
  const chromaticOffset = useMemo(() => new THREE.Vector2(0.0005, 0.0008), [])
  const containerStyle = useMemo<CSSProperties>(() => ({
    position: 'relative',
    width: '100%',
    height: '100%',
    ...style
  }), [style])

  return (
    <div className={className} style={containerStyle}>
      <Canvas
        dpr={dpr}
        gl={{
          antialias: quality !== 'low',
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1
        }}
        camera={{ position: [0, 0, 6], fov: 45 }}
      >
        <color attach="background" args={[0x140e16]} />
        <fog attach="fog" args={[0x1c1220, 8, 16]} />

        <Suspense fallback={null}>
          <NeonBackdrop />
          <GradientAtmosphere />
          {showFloorGlow && <FloorGlow />}
          <SceneLights />
          <CenteredNeonModel
            modelPath={modelPath}
            autoRotate={autoRotate}
            rotationSpeed={rotationSpeed}
            wobbleIntensity={wobbleIntensity}
            pulseSpeed={pulseSpeed}
            neonConfig={neonConfig}
          />
        </Suspense>

        <EffectComposer enableNormalPass={false}>
          <Bloom
            intensity={bloomIntensity * 1.5} // 增强光晕效果
            luminanceThreshold={0.08} // 降低阈值，让更多区域发光
            luminanceSmoothing={0.85} // 更平滑的发光
            mipmapBlur
            blendFunction={BlendFunction.SCREEN}
          />
          {quality !== 'low' ? (
            <ChromaticAberration
              offset={chromaticOffset}
              radialModulation
              modulationOffset={0.3}
            />
          ) : (
            <></>
          )}
          <Noise
            premultiply
            blendFunction={BlendFunction.SOFT_LIGHT}
            opacity={noiseOpacity * 1.5} // 增强颗粒质感
          />
          <Vignette eskil offset={0.25} darkness={0.65} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}

interface CenteredNeonModelProps {
  modelPath: string
  autoRotate: boolean
  rotationSpeed: number
  wobbleIntensity: number
  pulseSpeed: number
  neonConfig?: Partial<NeonMaterialConfig>
}

function CenteredNeonModel({
  modelPath,
  autoRotate,
  rotationSpeed,
  wobbleIntensity,
  pulseSpeed,
  neonConfig
}: CenteredNeonModelProps) {
  return (
    <Center disableY>
      <NeonModel
        modelPath={modelPath}
        autoRotate={autoRotate}
        rotationSpeed={rotationSpeed}
        wobbleIntensity={wobbleIntensity}
        pulseSpeed={pulseSpeed}
        neonConfig={neonConfig}
      />
    </Center>
  )
}

interface NeonModelProps extends CenteredNeonModelProps {}

function NeonModel({
  modelPath,
  autoRotate,
  rotationSpeed,
  wobbleIntensity,
  pulseSpeed,
  neonConfig
}: NeonModelProps) {
  const groupRef = useRef<THREE.Group>(null)
  const gltf = useGLTF(modelPath, true)
  const neonConfigKey = useMemo(() => JSON.stringify(neonConfig ?? {}), [neonConfig])
  const neonMaterial = useMemo(() => createNeonMaterial(neonConfig), [neonConfigKey])

  const sceneClone = useMemo(() => cloneSkinnedScene(gltf.scene) as THREE.Group, [gltf.scene])

  useEffect(() => {
    return () => {
      neonMaterial.dispose()
    }
  }, [neonMaterial])

  useEffect(() => {
    sceneClone.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh) {
        mesh.geometry.computeVertexNormals()
        mesh.material = neonMaterial
        mesh.castShadow = false
        mesh.receiveShadow = false
        mesh.frustumCulled = false
      }
    })
  }, [sceneClone, neonMaterial])

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime
    neonMaterial.uniforms.uTime.value = time
    neonMaterial.uniforms.uBreath.value = time * pulseSpeed * Math.PI * 2

    if (groupRef.current && autoRotate) {
      // 只在Y轴旋转（水平面旋转）
      groupRef.current.rotation.y += rotationSpeed * delta
      // 移除X轴旋转，只保留Y轴旋转
      // groupRef.current.rotation.x += rotationSpeed * 0.25 * delta
      // 保留轻微的上下浮动效果
      groupRef.current.position.y = Math.sin(time * 0.6) * wobbleIntensity
    }
  })

  return <primitive ref={groupRef} object={sceneClone} />
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.5} color={0xff6b9d} /> {/* 增强环境光 */}
      <directionalLight position={[6, 6, 4]} intensity={1.2} color={0xff6b9d} /> {/* 增强主光源 */}
      <directionalLight position={[-6, -4, -6]} intensity={0.8} color={0x4ecdc4} /> {/* 增强补光 */}
      <pointLight position={[0, -2, 4]} intensity={0.8} color={0xff6b9d} distance={12} /> {/* 增强点光源 */}
    </>
  )
}

function NeonBackdrop() {
  const topColor = useMemo(() => new THREE.Color('#ff6b9d'), []) // 粉橙色顶部
  const bottomColor = useMemo(() => new THREE.Color('#4ecdc4'), []) // 青蓝色底部
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTopColor: { value: topColor.clone() },
          uBottomColor: { value: bottomColor.clone() }
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform vec3 uTopColor;
          uniform vec3 uBottomColor;
          void main() {
            vec3 color = mix(uBottomColor, uTopColor, smoothstep(0.0, 1.0, vUv.y));
            gl_FragColor = vec4(color, 1.0);
          }
        `,
        side: THREE.BackSide,
        depthWrite: false
      }),
    [bottomColor, topColor]
  )

  useEffect(() => {
    material.uniforms.uTopColor.value.copy(topColor)
    material.uniforms.uBottomColor.value.copy(bottomColor)
  }, [material, topColor, bottomColor])

  return (
    <mesh position={[0, 0, -6]} scale={[20, 20, 1]}>
      <planeGeometry args={[1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

function GradientAtmosphere() {
  const gradientMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColorA: { value: new THREE.Color('#ff6b9d') }, // 粉橙色
          uColorB: { value: new THREE.Color('#4ecdc4') }, // 青蓝色
          uTime: { value: 0 }
        },
        vertexShader: /* glsl */ `
          varying vec3 vPosition;
          void main() {
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vPosition;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uTime;
          float softNoise(vec3 p) {
            return fract(sin(dot(p + uTime * 0.02, vec3(12.9898, 78.233, 54.53))) * 43758.5453);
          }
          void main() {
            float mask = clamp(0.5 + vPosition.y * 0.08, 0.0, 1.0);
            float glow = pow(1.0 - clamp(length(vPosition.xy) / 6.0, 0.0, 1.0), 1.6);
            float noise = (softNoise(vPosition * 2.0) - 0.5) * 0.15;
            vec3 base = mix(uColorB, uColorA, mask);
            vec3 color = base * (0.6 + glow * 0.5) + noise;
            gl_FragColor = vec4(color, 0.45);
          }
        `,
        transparent: true,
        depthWrite: false
      }),
    []
  )

  useFrame((state) => {
    gradientMaterial.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh scale={[12, 12, 1]} position={[0, 0, -3]}>
      <planeGeometry args={[1, 1]} />
      <primitive object={gradientMaterial} attach="material" />
    </mesh>
  )
}

function FloorGlow() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.1, 0]}>
      <circleGeometry args={[3.5, 64]} />
      <meshBasicMaterial
        color={0xffe1ff}
        transparent
        opacity={0.35}
      />
    </mesh>
  )
}

useGLTF.preload(DEFAULT_MODEL_PATH)
