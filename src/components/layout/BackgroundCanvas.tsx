'use client'

import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useScrollStore } from '@/stores/scrollStore'

// 背景 WebGL 层 - 弥散霓虹效果
export default function BackgroundCanvas() {
  const { scrollVelocity } = useScrollStore()

  return (
    <Canvas className="w-full h-full">
      {/* 弥散背景几何 */}
      <DreamyBackground />

      {/* 基础光照 */}
      <ambientLight intensity={0.3} color="#ff6b9d" />
      <directionalLight
        position={[5, 5, 5]}
        intensity={0.8}
        color="#ff9a8b"
      />
      <directionalLight
        position={[-5, -5, -5]}
        intensity={0.4}
        color="#4ecdc4"
      />

      {/* 后期处理管线 */}
      <EffectComposer>
        {/* 核心 Bloom 效果 */}
        <Bloom
          intensity={0.8 + scrollVelocity * 0.4}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.95}
          mipmapBlur={true}
          blendFunction={BlendFunction.SCREEN}
        />

        {/* Film Grain 颗粒质感 */}
        <Noise
          premultiply
          blendFunction={BlendFunction.MULTIPLY}
          opacity={0.3}
        />
      </EffectComposer>
    </Canvas>
  )
}

// 弥散背景几何体
function DreamyBackground() {
  return (
    <mesh>
      <planeGeometry args={[20, 20]} />
      <meshBasicMaterial
        color="#ff6b9d"
        transparent
        opacity={0.1}
      />
    </mesh>
  )
}