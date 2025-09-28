'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Loader } from '@/components/ui/Loader'
import TextFlow from './TextFlow'
import Model3D from './Model3D'
import AudioController from './AudioController'
import ProgressBar from './ProgressBar'

// ScrollCanvas 主组件 - 整合所有核心功能
export default function ScrollCanvas() {
  return (
    <ErrorBoundary>
      <div className="relative w-full h-full">
        {/* Three.js 主画布 */}
        <Canvas
          className="webgl-canvas"
          camera={{
            position: [0, 0, 10],
            fov: 50,
            near: 0.1,
            far: 1000
          }}
          dpr={[1, 2]} // 设备像素比优化
          performance={{ min: 0.5 }} // 性能优化
        >
          {/* 基础光照 */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />

          {/* 核心组件 */}
          <Suspense fallback={null}>
            <TextFlow />
            <Model3D />
          </Suspense>
        </Canvas>

        {/* UI 层组件 */}
        <AudioController />
        <ProgressBar />

        {/* 加载指示器 */}
        <Suspense fallback={<Loader />}>
          <div />
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}