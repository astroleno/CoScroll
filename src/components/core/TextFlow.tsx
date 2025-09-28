'use client'

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useText } from '@/hooks/useText'
import { useScroll } from '@/hooks/useScroll'
import * as THREE from 'three'

// TextFlow 组件 - 处理文字的前后交替显示
export default function TextFlow() {
  const frontTextRef = useRef<THREE.Mesh>(null)
  const backTextRef = useRef<THREE.Mesh>(null)

  // 使用自定义 hooks
  const { currentText, nextText } = useText()
  const { scrollPosition } = useScroll()

  // 文字动画状态
  const [frontOpacity, setFrontOpacity] = useState(1)
  const [backOpacity, setBackOpacity] = useState(0.6)

  // 每帧更新文字位置和透明度
  useFrame((state, delta) => {
    if (frontTextRef.current && backTextRef.current) {
      // 根据滚动位置计算文字偏移
      const offset = scrollPosition * 0.01

      // 前景文字位置 (模型前方)
      frontTextRef.current.position.y = 2 + offset
      frontTextRef.current.position.z = 3

      // 后景文字位置 (模型后方)
      backTextRef.current.position.y = -2 - offset
      backTextRef.current.position.z = -3

      // 透明度渐变效果
      const frontMaterial = frontTextRef.current.material as THREE.MeshBasicMaterial
      const backMaterial = backTextRef.current.material as THREE.MeshBasicMaterial

      if (frontMaterial && backMaterial) {
        frontMaterial.opacity = frontOpacity
        backMaterial.opacity = backOpacity
      }
    }
  })

  return (
    <group>
      {/* 前景文字 */}
      <Text
        ref={frontTextRef}
        position={[0, 2, 3]}
        fontSize={1.2}
        color="#1f2937"
        anchorX="center"
        anchorY="middle"
        font="/fonts/chinese-font.woff" // 后续添加中文字体
        maxWidth={8}
        textAlign="center"
      >
        {currentText?.content || '观自在菩萨'}
      </Text>

      {/* 后景文字 */}
      <Text
        ref={backTextRef}
        position={[0, -2, -3]}
        fontSize={1}
        color="#374151"
        anchorX="center"
        anchorY="middle"
        font="/fonts/chinese-font.woff"
        maxWidth={8}
        textAlign="center"
      >
        {nextText?.content || '行深般若波罗蜜多时'}
      </Text>
    </group>
  )
}