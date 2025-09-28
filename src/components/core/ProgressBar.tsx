'use client'

import { useHeartSutraAudio } from '@/hooks/useHeartSutraAudio'
import { useScrollStore } from '@/stores/scrollStore'

// ProgressBar 组件 - 显示进度和当前段落信息
export default function ProgressBar() {
  const { currentLyric, progress, lyrics, currentTime, config } = useHeartSutraAudio()
  const { scrollSpeed } = useScrollStore()

  // 计算总体进度
  const progressPercent = progress * 100
  const currentIndex = lyrics.findIndex(lyric => lyric === currentLyric) || 0

  return (
    <div className="absolute top-1/2 right-4 transform -translate-y-1/2 z-40">
      <div className="bg-paper-light/90 backdrop-blur-sm rounded-lg p-4 w-64">
        {/* 当前文本显示 */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-ink-dark mb-2 font-chinese">
            当前歌词
          </h3>
          <p className="text-base text-ink font-chinese leading-relaxed">
            {currentLyric?.text || '观自在菩萨'}
          </p>
          {currentLyric?.anchor && (
            <div className="mt-2 text-xs text-ink-light">
              锚字: <span className="font-semibold">{currentLyric.anchor}</span>
            </div>
          )}
        </div>

        {/* 进度条 */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-ink-light mb-1">
            <span>进度</span>
            <span>{Math.max(0, currentIndex + 1)} / {lyrics.length}</span>
          </div>
          <div className="w-full bg-ink/10 rounded-full h-2">
            <div
              className="bg-ink rounded-full h-2 transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
            />
          </div>
        </div>

        {/* 音频状态 */}
        <div className="space-y-2 text-xs text-ink-light">
          <div className="flex justify-between">
            <span>播放时间:</span>
            <span>{Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}</span>
          </div>
          <div className="flex justify-between">
            <span>播放进度:</span>
            <span>{Math.max(0, Math.min(100, Math.round(progressPercent)))}%</span>
          </div>
          <div className="flex justify-between">
            <span>滚动速度:</span>
            <span>{scrollSpeed.toFixed(1)}</span>
          </div>
        </div>

        {/* 下一段落预览 */}
        <div className="mt-4 pt-4 border-t border-ink/10">
          <h4 className="text-xs font-semibold text-ink-light mb-1 font-chinese">
            下一歌词
          </h4>
          <p className="text-sm text-ink/70 font-chinese">
            {lyrics[currentIndex + 1]?.text || '行深般若波罗蜜多时'}
          </p>
        </div>
      </div>
    </div>
  )
}