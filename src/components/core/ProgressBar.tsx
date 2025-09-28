'use client'

import { useText } from '@/hooks/useText'
import { useScroll } from '@/hooks/useScroll'

// ProgressBar 组件 - 显示进度和当前段落信息
export default function ProgressBar() {
  const { currentText, totalSegments, currentIndex } = useText()
  const { scrollPosition } = useScroll()

  // 计算总体进度
  const progress = totalSegments > 0 ? (currentIndex / totalSegments) * 100 : 0

  return (
    <div className="absolute top-1/2 right-4 transform -translate-y-1/2 z-40">
      <div className="bg-paper-light/90 backdrop-blur-sm rounded-lg p-4 w-64">
        {/* 当前文本显示 */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-ink-dark mb-2 font-chinese">
            当前段落
          </h3>
          <p className="text-base text-ink font-chinese leading-relaxed">
            {currentText?.content || '观自在菩萨'}
          </p>
          {currentText?.anchorWord && (
            <div className="mt-2 text-xs text-ink-light">
              锚字: <span className="font-semibold">{currentText.anchorWord}</span>
            </div>
          )}
        </div>

        {/* 进度条 */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-ink-light mb-1">
            <span>进度</span>
            <span>{currentIndex + 1} / {totalSegments}</span>
          </div>
          <div className="w-full bg-ink/10 rounded-full h-2">
            <div
              className="bg-ink rounded-full h-2 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 滚动状态 */}
        <div className="space-y-2 text-xs text-ink-light">
          <div className="flex justify-between">
            <span>滚动位置:</span>
            <span>{Math.round(scrollPosition)}</span>
          </div>
          <div className="flex justify-between">
            <span>段落进度:</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* 下一段落预览 */}
        <div className="mt-4 pt-4 border-t border-ink/10">
          <h4 className="text-xs font-semibold text-ink-light mb-1 font-chinese">
            下一段落
          </h4>
          <p className="text-sm text-ink/70 font-chinese">
            {/* 这里显示下一个文本段落 */}
            行深般若波罗蜜多时
          </p>
        </div>
      </div>
    </div>
  )
}