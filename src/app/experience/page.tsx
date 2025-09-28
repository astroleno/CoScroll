'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

// 动态加载 ScrollCanvas 组件，避免 SSR 问题
const ScrollCanvas = dynamic(
  () => import('@/components/core/ScrollCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-paper-dark">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto"></div>
          <p className="text-ink-light font-chinese">正在加载 3D 体验...</p>
        </div>
      </div>
    )
  }
)

export default function ExperiencePage() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-paper-dark">
      {/* 返回按钮 */}
      <div className="absolute top-4 left-4 z-50">
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 bg-paper-light/80 backdrop-blur-sm rounded-lg text-ink hover:bg-paper-light transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回首页
        </Link>
      </div>

      {/* 使用说明 */}
      <div className="absolute top-4 right-4 z-50">
        <div className="bg-paper-light/80 backdrop-blur-sm rounded-lg p-4 max-w-xs text-sm text-ink">
          <h3 className="font-semibold mb-2 font-chinese">使用说明</h3>
          <ul className="space-y-1 text-xs">
            <li>• 上下滚动控制速度</li>
            <li>• 文字前后交替显示</li>
            <li>• 3D模型同步旋转</li>
            <li>• 音频速度同步</li>
          </ul>
        </div>
      </div>

      {/* 主要 3D 体验区域 */}
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="loading-spinner"></div>
        </div>
      }>
        <ScrollCanvas />
      </Suspense>

      {/* 底部状态栏 */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
        <div className="bg-paper-light/80 backdrop-blur-sm rounded-full px-6 py-2 text-sm text-ink">
          <span className="font-chinese">心经体验 · MVP 版本</span>
        </div>
      </div>
    </div>
  )
}