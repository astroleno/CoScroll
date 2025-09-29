import React, { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import {
  createShader3Material,
  defaultShader3Config,
  Shader3UniformConfig,
  updateShader3Material
} from './volumetricSurfaceMaterial'

export interface Shader3Model3DProps {
  modelPath: string
  config?: Partial<Shader3UniformConfig>
  autoRotate?: boolean
  rotationSpeed?: number
  wobbleIntensity?: number
  className?: string
  onLoad?: () => void
  onError?: (_error: Error) => void
}

function Model({ modelPath, config, autoRotate, rotationSpeed, wobbleIntensity, onLoad, onError }: {
  modelPath: string
  config: Shader3UniformConfig
  autoRotate?: boolean
  rotationSpeed?: number
  wobbleIntensity?: number
  onLoad?: () => void
  onError?: (_error: Error) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const gltf = useLoader(GLTFLoader, modelPath)

  const material = useMemo(() => {
    return createShader3Material(config)
  }, [config])

  useEffect(() => {
    materialRef.current = material
  }, [material])

  useEffect(() => {
    try {
      if (gltf && onLoad) onLoad()
    } catch (e) {
      if (onError) onError(e as Error)
    }
  }, [gltf, onLoad, onError])

  useFrame((state, delta) => {
    if (materialRef.current) {
      updateShader3Material(materialRef.current, config, state.clock.elapsedTime)
    }
    if (groupRef.current && autoRotate) {
      groupRef.current.rotation.y += (rotationSpeed || 0.3) * delta
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * (wobbleIntensity || 0.06)
    }
  })

  return (
    <group ref={groupRef} scale={[2, 2, 2]}>
      {gltf?.scene && (
        <primitive
          object={gltf.scene}
          onUpdate={(self: THREE.Object3D) => {
            self.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh
                mesh.material = material
                mesh.castShadow = false
                mesh.receiveShadow = false
              }
            })
          }}
        />
      )}
    </group>
  )
}

export function Shader3Model3D({
  modelPath,
  config,
  autoRotate = true,
  rotationSpeed = 0.3,
  wobbleIntensity = 0.06,
  className,
  onLoad,
  onError
}: Shader3Model3DProps) {
  const merged = useMemo<Shader3UniformConfig>(() => ({
    ...defaultShader3Config,
    ...(config || {})
  }), [config])

  return (
    <div className={className || ''} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 60 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.9,
          outputColorSpace: THREE.SRGBColorSpace
        }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.15} />
        <directionalLight position={[2, 3, 4]} intensity={0.6} />
        <Model
          modelPath={modelPath}
          config={merged}
          autoRotate={autoRotate}
          rotationSpeed={rotationSpeed}
          wobbleIntensity={wobbleIntensity}
          onLoad={onLoad}
          onError={onError}
        />
      </Canvas>
    </div>
  )
}

export type { Shader3UniformConfig }


