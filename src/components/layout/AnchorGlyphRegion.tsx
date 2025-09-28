'use client'

import { Canvas } from '@react-three/fiber'
import { usePlaybackControl } from '@/hooks/usePlaybackControl'
import { useSegmentTimer } from '@/hooks/useSegmentTimer'
import Model3D from '../core/Model3D'
import SegmentTransition from '../core/SegmentTransition'

// 锚字区域 - 3D书法模型显示 (自动播放版本)
export default function AnchorGlyphRegion() {
  const { currentSegment, playbackSpeed, getSegmentProgress, getTotalProgress, isTransitioning } = usePlaybackControl()

  // 启动自动切换定时器
  useSegmentTimer()

  return (
    <div className="relative w-full h-full">
      {/* 3D 模型画布 */}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        className="w-full h-full"
        style={{ background: 'transparent' }}
      >
        {/* 基础光照 */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        {/* 3D 模型 - 纯自动旋转 */}
        <Model3D
          modelPath={`/models/10k/003_道.glb`} // 当前使用道字模型
          anchorChar={currentSegment?.anchor || '道'}
          textLength={currentSegment?.text.length || 0}
          playbackSpeed={playbackSpeed}
        />
      </Canvas>

      {/* 段落信息覆盖层 */}
      <div className="absolute bottom-8 left-8 bg-black/30 backdrop-blur-sm rounded-lg p-4 text-white">
        <div className="text-sm opacity-70">当前锚字</div>
        <div className="text-3xl font-chinese font-bold">{currentSegment?.anchor || '心'}</div>
        <div className="text-xs opacity-50 mt-2">
          {currentSegment?.text || '心经体验'}
        </div>

        {/* 播放状态信息 */}
        <div className="text-xs opacity-40 mt-2 space-y-1">
          <div>播放速度: {playbackSpeed.toFixed(1)}x</div>
          <div>音频时间: {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}</div>
          <div>总体进度: {Math.round(getTotalProgress() * 100)}%</div>
        </div>

        {/* 音频控制 */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={toggleAutoPlay}
            className="px-2 py-1 bg-white/20 rounded text-xs hover:bg-white/30"
          >
            {isAutoPlaying ? '暂停' : '播放'}
          </button>
          <div className="text-xs opacity-60">
            音量: {Math.round(volume * 100)}%
          </div>
        </div>
      </div>
    </div>
  )
}