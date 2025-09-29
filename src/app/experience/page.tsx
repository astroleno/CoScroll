'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

export default function ExperiencePage() {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let instance: any
    (async () => {
      try {
        const { createSketch } = await import('@/p5/sketch')
        instance = createSketch({ container: hostRef.current, debug: true })
      } catch (e) {
        console.error('[p5] mount error', e)
      }
    })()
    return () => {
      try {
        // p5 没有统一销毁 API，通常移除 canvas 或让页面卸载
        const canvas = hostRef.current?.querySelector('canvas')
        canvas?.remove()
      } catch (e) {
        console.error('[p5] unmount error', e)
      }
    }
  }, [])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-paper-dark">
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

      {/* p5 宿主节点 */}
      <div ref={hostRef} className="w-full h-full" />

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
        <div className="bg-paper-light/80 backdrop-blur-sm rounded-full px-6 py-2 text-sm text-ink">
          <span className="font-chinese">心经体验 · p5 实验版</span>
        </div>
      </div>
    </div>
  )
}