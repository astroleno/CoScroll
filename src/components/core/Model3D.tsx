'use client'

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useScroll } from '@/hooks/useScroll'
import { useModel } from '@/hooks/useModel'
import * as THREE from 'three'

// Model3D 组件 - 3D 书法模型渲染和旋转控制
export default function Model3D() {
  const modelRef = useRef<THREE.Group>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 使用自定义 hooks
  const { scrollSpeed } = useScroll()
  const { currentModelPath } = useModel()

  // 加载现有的道字模型
  const { scene } = useGLTF('/models/10k/003_道.glb')

  // 模型旋转状态
  const [rotationSpeed, setRotationSpeed] = useState(0)

  // 每帧更新模型旋转
  useFrame((state, delta) => {
    if (modelRef.current) {
      // 根据滚动速度计算旋转速度
      const targetRotationSpeed = Math.abs(scrollSpeed) * 0.01

      // 平滑过渡到目标旋转速度
      setRotationSpeed(prev =>
        THREE.MathUtils.lerp(prev, targetRotationSpeed, 0.1)
      )

      // 应用旋转
      modelRef.current.rotation.y += rotationSpeed * delta

      // 添加微妙的上下浮动效果
      modelRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1
    }
  })

  // 模型加载完成处理
  const handleModelLoad = () => {
    setIsLoading(false)
    if (modelRef.current) {
      // 调整模型大小和位置
      modelRef.current.scale.setScalar(2)
      modelRef.current.position.set(0, 0, 0)
    }
  }

  return (
    <group>
      {isLoading && (
        // 加载指示器 (简单的几何体)
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#64748b" wireframe />
        </mesh>
      )}

      <primitive
        ref={modelRef}
        object={scene.clone()}
        position={[0, 0, 0]}
        scale={[2, 2, 2]}
        onUpdate={handleModelLoad}
      />

      {/* 环境装饰 - 简单的粒子效果 */}
      <group>
        {Array.from({ length: 20 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 20
            ]}
          >
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial
              color="#64748b"
              transparent
              opacity={0.3}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// 预加载模型
useGLTF.preload('/models/10k/003_道.glb')