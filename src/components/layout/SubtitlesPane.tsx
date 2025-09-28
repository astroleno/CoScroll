'use client'

import { useHeartSutraAudio } from '@/hooks/useHeartSutraAudio'
import { usePlaybackControl } from '@/hooks/usePlaybackControl'
import { useContentMetadata } from '@/hooks/useContentPackage'

// 字幕区域 - 音频同步文本显示
export default function SubtitlesPane() {
  const { currentLyric, progress, isPlaying, currentTime } = useHeartSutraAudio()
  const { currentSegment } = usePlaybackControl()
  const { metadata } = useContentMetadata()

  // 分割歌词文本（简单版本）
  const text = currentLyric?.text || '心经体验'
  const anchor = currentLyric?.anchor || currentSegment?.anchor || '心'

  const parts = text.split(anchor)
  const front = parts[0] || ''
  const back = parts[1] || ''

  return (
    <div className="flex flex-col h-full p-6 text-white">
      {/* 标题 */}
      <div className="mb-6">
        <h2 className="text-xl font-chinese font-semibold mb-2">{metadata.title || '心经'}</h2>
        <div className="text-sm opacity-70">
          {isPlaying ? '正在播放' : '已暂停'} · {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}
        </div>
      </div>

      {/* 当前文本 */}
      <div className="flex-1 flex flex-col justify-center space-y-6">
        {/* 前半句 */}
        <div className="transition-all duration-500 opacity-70">
          <div className="text-sm opacity-70 mb-1">前文</div>
          <div className="text-lg font-chinese heart-sutra-text leading-relaxed">
            {front}
          </div>
        </div>

        {/* 锚字 */}
        <div className="text-center py-4">
          <div className="text-sm opacity-50 mb-2">锚字</div>
          <div className="text-4xl anchor-char font-bold text-[#ff6b9d]">
            {anchor}
          </div>
        </div>

        {/* 后半句 */}
        <div className="transition-all duration-500 opacity-90">
          <div className="text-sm opacity-70 mb-1">后文</div>
          <div className="text-lg font-chinese heart-sutra-text leading-relaxed">
            {back}
          </div>
        </div>
      </div>

      {/* 当前歌词显示 */}
      <div className="mb-4 p-4 bg-black/30 rounded-lg">
        <div className="text-sm opacity-70 mb-2">当前歌词</div>
        <div className="text-lg font-chinese text-center">
          {text}
        </div>
      </div>

      {/* 进度指示 */}
      <div className="mt-6">
        <div className="w-full bg-white/10 rounded-full h-1">
          <div
            className="bg-gradient-to-r from-[#ff6b9d] to-[#4ecdc4] h-1 rounded-full transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs opacity-50 mt-2">
          <span>开始</span>
          <span>{Math.round(progress * 100)}%</span>
          <span>结束</span>
        </div>
      </div>
    </div>
  )
}