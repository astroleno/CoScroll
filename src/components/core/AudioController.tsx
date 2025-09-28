'use client'

import { useEffect, useState } from 'react'
import { useAudio } from '@/hooks/useAudio'
import { useScroll } from '@/hooks/useScroll'

// AudioController 组件 - 音频播放控制和同步
export default function AudioController() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // 使用自定义 hooks
  const { scrollSpeed } = useScroll()
  const {
    audioContext,
    initAudio,
    play,
    pause,
    setPlaybackRate,
    isAudioReady
  } = useAudio()

  // 初始化音频系统
  useEffect(() => {
    const handleUserInteraction = async () => {
      if (!isInitialized) {
        await initAudio()
        setIsInitialized(true)
      }
    }

    // 监听用户交互事件
    document.addEventListener('click', handleUserInteraction)
    document.addEventListener('scroll', handleUserInteraction)

    return () => {
      document.removeEventListener('click', handleUserInteraction)
      document.removeEventListener('scroll', handleUserInteraction)
    }
  }, [isInitialized, initAudio])

  // 根据滚动速度调整音频播放倍速
  useEffect(() => {
    if (isAudioReady && audioContext) {
      const baseRate = 1.0
      const speedFactor = scrollSpeed / 100
      const newRate = Math.max(0.5, Math.min(2.0, baseRate + speedFactor))

      setPlaybackRate(newRate)
    }
  }, [scrollSpeed, isAudioReady, audioContext, setPlaybackRate])

  // 播放/暂停控制
  const togglePlayback = () => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-30">
      <div className="bg-paper-light/90 backdrop-blur-sm rounded-full px-6 py-3 flex items-center space-x-4">
        {/* 播放/暂停按钮 */}
        <button
          onClick={togglePlayback}
          disabled={!isAudioReady}
          className="w-10 h-10 rounded-full bg-ink text-paper-light hover:bg-ink-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isPlaying ? (
            // 暂停图标
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            // 播放图标
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* 音频状态指示 */}
        <div className="flex items-center space-x-2 text-sm text-ink">
          <div className={`w-2 h-2 rounded-full ${
            isAudioReady ? 'bg-green-500' : 'bg-yellow-500'
          }`} />
          <span className="font-chinese">
            {isAudioReady ? '音频就绪' : '音频加载中...'}
          </span>
        </div>

        {/* 播放倍速显示 */}
        {isAudioReady && (
          <div className="text-xs text-ink-light">
            倍速: {(1 + scrollSpeed / 100).toFixed(1)}x
          </div>
        )}
      </div>
    </div>
  )
}