'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

export default function ShellTestPage() {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let instance: any
    (async () => {
      try {
        const { createShellTestSketch } = await import('@/p5/shell-test')
        instance = createShellTestSketch({ container: hostRef.current, debug: true })
      } catch (e) {
        console.error('[shell-test] mount error', e)
      }
    })()
    return () => {
      try {
        const canvas = hostRef.current?.querySelector('canvas')
        canvas?.remove()
      } catch (e) {
        console.error('[shell-test] unmount error', e)
      }
    }
  }, [])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      <div className="absolute top-4 left-4 z-50">
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg text-white hover:bg-white/20 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回首页
        </Link>
      </div>

      <div ref={hostRef} className="w-full h-full" />

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
        <div className="bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 text-sm text-white space-y-1">
          <div className="font-bold">多层壳体渲染测试</div>
          <div className="text-xs opacity-70">PPL方案 · 4层壳体 · 软糯边界</div>
        </div>
      </div>

      {/* 参数说明 */}
      <div className="absolute top-4 right-4 z-40 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-white text-xs space-y-2 max-w-xs">
        <div className="font-bold mb-2">渲染参数</div>
        <div>壳体层数: 4层</div>
        <div>Scale增量: 0.008/层</div>
        <div>Alpha衰减: 1.0 → 0.15</div>
        <div>噪声: 3D世界空间</div>
        <div>混合: BLEND模式</div>
      </div>
    </div>
  )
}