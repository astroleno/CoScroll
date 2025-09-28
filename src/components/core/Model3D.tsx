'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useExperienceConfig } from '@/hooks/useExperienceConfig'

// Model3D 组件 - 3D 书法模型渲染和自动旋转控制
interface Model3DProps {
  modelPath?: string
  anchorChar?: string
  textLength?: number
  playbackSpeed?: number
}

export default function Model3D({
  modelPath,
  anchorChar = '道',
  textLength = 10,
  playbackSpeed = 1.0
}: Model3DProps) {
  const { config } = useExperienceConfig()
  const meshRef = useRef<THREE.Mesh>(null)

  // 计算旋转参数
  const rotationCycles = textLength > 30 ? 2 : 1  // 长段落2圈，短段落1圈
  const baseRotationSpeed = (rotationCycles * Math.PI * 2) / (textLength > 30 ? 25 : 15) // 基础速度
  const currentRotationSpeed = baseRotationSpeed * playbackSpeed * config.visuals.rotationSpeed

  // 每帧更新球体旋转
  useFrame((state, delta) => {
    if (meshRef.current) {
      // 应用自动旋转
      meshRef.current.rotation.y += currentRotationSpeed * delta
      meshRef.current.rotation.x += currentRotationSpeed * delta * 0.3

      // 添加微妙的上下浮动效果
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[1.5, 32, 32]} />
      <meshBasicMaterial
        color={config.visuals.fallbackColor}
      />
    </mesh>
  )
}