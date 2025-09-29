/**
 * 弥散霓虹模型渲染组件
 * 独立的3D模型渲染组件，实现弥散霓虹风格效果
 */

import React, { useRef, useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import * as THREE from 'three'
import { NeonConfig, defaultNeonConfig, validateNeonConfig } from './neonConfig'
import { createNeonMaterial, updateNeonMaterial } from './neonMaterial'
import { NeonLights } from './neonLights'
import { NeonEffects } from './neonEffects'
import { NeonBackground } from './neonBackground'
import { NeonAmbientGlow } from './neonAmbientGlow'

export interface NeonModel3DProps {
  modelPath: string
  config?: Partial<NeonConfig>
  autoRotate?: boolean
  onLoad?: () => void
  onError?: (_error: Error) => void
  className?: string
}

// 模型组件
function NeonModel({ 
  modelPath, 
  config, 
  onLoad, 
  onError: _onError
}: { 
  modelPath: string
  config: NeonConfig
  onLoad?: () => void
  onError?: (_error: Error) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  
  // 加载模型
  const gltf = useLoader(GLTFLoader, modelPath)
  
  // 创建材质
  const material = useMemo(() => {
    return createNeonMaterial(config)
  }, [config])
  
  // 更新材质引用
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current = material
    }
  }, [material])
  
  // 动画循环
  useFrame((state, delta) => {
    // 更新材质参数
    if (materialRef.current) {
      updateNeonMaterial(materialRef.current, config, state.clock.elapsedTime)
    }
    
    // 自动旋转
    if (groupRef.current && config.autoRotate) {
      groupRef.current.rotation.y += config.rotationSpeed * delta
      // 轻微浮动效果
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * config.wobbleIntensity
    }
  })
  
  // 模型加载完成
  useEffect(() => {
    if (gltf && onLoad) {
      onLoad()
    }
  }, [gltf, onLoad])
  
  return (
    <group ref={groupRef} scale={[2, 2, 2]} rotation={[0, Math.PI / 2, 0]}>
      {gltf.scene && (
        <>
          <primitive 
            object={gltf.scene} 
            material={material}
            onUpdate={(self: THREE.Object3D) => {
              // 应用材质到所有网格
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
        </>
      )}
    </group>
  )
}


// 场景组件 - 在Canvas内部使用
function NeonScene({ 
  modelPath, 
  config, 
  onLoad, 
  onError 
}: { 
  modelPath: string
  config: NeonConfig
  onLoad?: () => void
  onError?: (_error: Error) => void
}) {
  const [time, setTime] = useState(0)
  
  // 更新时间
  useFrame((state) => {
    setTime(state.clock.elapsedTime)
  })
  
  return (
    <>
      {/* 动态背景和雾化 */}
      <NeonBackground config={config} />
      
      {/* 光照系统 */}
      <NeonLights config={config} time={time} />
      
      {/* 模型渲染 */}
      <NeonModel 
        modelPath={modelPath}
        config={config}
        onLoad={onLoad}
        onError={onError}
      />

      {/* 气体弥散光罩 */}
      <NeonAmbientGlow config={config} />
      
      {/* 后期处理效果 */}
      <NeonEffects config={config} />
    </>
  )
}

// 主组件
export function NeonModel3D({ 
  modelPath, 
  config: userConfig, 
  autoRotate = true,
  onLoad,
  onError,
  className
}: NeonModel3DProps) {
  // 合并配置
  const config = useMemo(() => {
    const mergedConfig = {
      ...defaultNeonConfig,
      ...userConfig,
      autoRotate
    }
    return validateNeonConfig(mergedConfig)
  }, [userConfig, autoRotate])
  
  return (
    <div className={`neon-model-3d ${className || ''}`} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 60 }}
        gl={{ 
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.85,
          outputColorSpace: THREE.SRGBColorSpace
        }}
        dpr={[1, 2]}
      >
        <NeonScene 
          modelPath={modelPath}
          config={config}
          onLoad={onLoad}
          onError={onError}
        />
      </Canvas>
    </div>
  )
}

// 导出类型和配置
export type { NeonConfig }
export { defaultNeonConfig, validateNeonConfig }
export { createNeonMaterial, updateNeonMaterial }
export { NeonLights, NeonEffects }
