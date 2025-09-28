'use client'

import { useState, useEffect } from 'react'
import { useScroll } from '@/hooks/useScroll'
import BackgroundCanvas from './BackgroundCanvas'
import AnchorGlyphRegion from './AnchorGlyphRegion'
import SubtitlesPane from './SubtitlesPane'

// 三层分离布局组件 - 基于GPT风格建议
export default function DreamyLayout() {
  const [isMobile, setIsMobile] = useState(false)

  // 初始化滚动处理
  useScroll()

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen">
        {/* 移动端：上下堆叠 */}
        <div className="flex-1 relative">
          <BackgroundCanvas />
          <AnchorGlyphRegion />
        </div>
        <div className="h-1/3 bg-black/60 backdrop-blur-sm">
          <SubtitlesPane />
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* 底层：背景 WebGL */}
      <div className="absolute inset-0 z-0">
        <BackgroundCanvas />
      </div>

      {/* 中层：锚字区 (2/3 宽度) */}
      <div className="absolute left-0 top-0 w-2/3 h-full z-10">
        <AnchorGlyphRegion />
      </div>

      {/* 上层：字幕区 (1/3 宽度) */}
      <div className="absolute right-0 top-0 w-1/3 h-full z-20 bg-gradient-to-l from-black/60 to-transparent backdrop-blur-sm">
        <SubtitlesPane />
      </div>

      {/* 文字深度层 - 前方文字 */}
      <div className="absolute left-0 top-0 w-2/3 h-full z-15 pointer-events-none">
        <FrontText className="opacity-90" />
      </div>

      {/* 文字深度层 - 后方文字 */}
      <div className="absolute left-0 top-0 w-2/3 h-full z-5 pointer-events-none">
        <BackText className="opacity-70" />
      </div>
    </div>
  )
}

// 前方文字组件
function FrontText({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center h-full ${className}`}>
      <div className="text-2xl font-chinese heart-sutra-text text-white/90">
        {/* 这里将显示当前段落的前半部分文字 */}
      </div>
    </div>
  )
}

// 后方文字组件
function BackText({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center h-full ${className}`}>
      <div className="text-2xl font-chinese heart-sutra-text text-white/70">
        {/* 这里将显示当前段落的后半部分文字 */}
      </div>
    </div>
  )
}