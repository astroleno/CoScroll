'use client'

import { useScrollStore } from '@/stores/scrollStore'
import { heartSutraSegments, getCurrentSegment, splitTextByAnchor, getTextLayout } from '@/data/heartSutra'

// 字幕区域 - 滚动文本显示
export default function SubtitlesPane() {
  const { scrollProgress } = useScrollStore()
  const currentSegment = getCurrentSegment(scrollProgress) || heartSutraSegments[0]
  const { front, back } = splitTextByAnchor(currentSegment?.text || '', currentSegment?.anchor || '')
  const layout = getTextLayout(currentSegment?.id || 1)

  return (
    <div className="flex flex-col h-full p-6 text-white">
      {/* 标题 */}
      <div className="mb-6">
        <h2 className="text-xl font-chinese font-semibold mb-2">心经</h2>
        <div className="text-sm opacity-70">段落 {currentSegment.id} / {heartSutraSegments.length}</div>
      </div>

      {/* 当前文本 */}
      <div className="flex-1 flex flex-col justify-center space-y-6">
        {/* 前半句 */}
        <div className={`transition-all duration-500 ${layout.frontZ > 0 ? 'opacity-90' : 'opacity-70'}`}>
          <div className="text-sm opacity-70 mb-1">前文</div>
          <div className="text-lg font-chinese heart-sutra-text leading-relaxed">
            {front}
          </div>
        </div>

        {/* 锚字 */}
        <div className="text-center py-4">
          <div className="text-sm opacity-50 mb-2">锚字</div>
          <div className="text-4xl anchor-char font-bold text-[#ff6b9d]">
            {currentSegment?.anchor || '道'}
          </div>
        </div>

        {/* 后半句 */}
        <div className={`transition-all duration-500 ${layout.backZ > 0 ? 'opacity-90' : 'opacity-70'}`}>
          <div className="text-sm opacity-70 mb-1">后文</div>
          <div className="text-lg font-chinese heart-sutra-text leading-relaxed">
            {back}
          </div>
        </div>
      </div>

      {/* 进度指示 */}
      <div className="mt-6">
        <div className="w-full bg-white/10 rounded-full h-1">
          <div
            className="bg-gradient-to-r from-[#ff6b9d] to-[#4ecdc4] h-1 rounded-full transition-all duration-300"
            style={{ width: `${scrollProgress * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs opacity-50 mt-2">
          <span>开始</span>
          <span>{Math.round(scrollProgress * 100)}%</span>
          <span>结束</span>
        </div>
      </div>
    </div>
  )
}