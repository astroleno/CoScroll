'use client'

import { useEffect, useState } from 'react'
import { useHeartSutraAudio } from '@/hooks/useHeartSutraAudio'
import { useScrollStore } from '@/stores/scrollStore'

// AudioController 组件 - 音频播放控制和同步
export default function AudioController() {
  const [userInteracted, setUserInteracted] = useState(false)

  // 使用心经音频 hook
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isLoading,
    currentLyric,
    play,
    pause,
    togglePlay,
    progress,
    config,
    userControlled,
    playbackRate
  } = useHeartSutraAudio()

  // 使用滚动状态
  const { scrollSpeed } = useScrollStore()

  // 处理用户点击播放按钮
  const handlePlayClick = async () => {
    setUserInteracted(true)
    console.log('用户点击播放按钮')
    await togglePlay()
  }

  // 添加测试函数
  const testAudio = () => {
    console.log('测试音频播放...')
    const testAudioElement = new Audio('/audio/心经.mp3')
    testAudioElement.volume = 1.0
    testAudioElement.play()
      .then(() => console.log('测试音频播放成功 ✓'))
      .catch(err => console.error('测试音频播放失败:', err))
  }

  return (
    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-30">
      {/* 用户交互提示 */}
      {!userInteracted && !isLoading && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm animate-pulse">
          点击任意位置开始播放
        </div>
      )}

      <div className="bg-paper-light/90 backdrop-blur-sm rounded-full px-6 py-3 flex items-center space-x-4">
        {/* 播放/暂停按钮 */}
        <button
          onClick={handlePlayClick}
          disabled={isLoading}
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
            !isLoading ? 'bg-green-500' : 'bg-yellow-500'
          }`} />
          <span className="font-chinese">
            {!isLoading ? '音频就绪' : '音频加载中...'}
          </span>
        </div>

        {/* 当前歌词显示 */}
        {currentLyric && (
          <div className="text-xs text-ink max-w-32 truncate">
            {currentLyric.text}
          </div>
        )}

        {/* DJ模式指示 */}
        {userControlled && (
          <div className="text-xs text-red-500 font-bold animate-pulse">
            🎧 DJ模式
          </div>
        )}

        {/* 当前歌词显示 */}
        {currentLyric && (
          <div className="text-xs text-ink max-w-40 truncate">
            🎵 {currentLyric.text}
          </div>
        )}

        {/* 播放状态 */}
        {!isLoading && (
          <div className="text-xs text-ink-light">
            {userControlled ? '⏸️ 手动控制' : '▶️ 自动播放'}
          </div>
        )}

        {/* 播放进度和时间 */}
        {!isLoading && (
          <div className="text-xs text-ink-light">
            {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')} ({Math.floor(progress * 100)}%)
          </div>
        )}

        {/* 滚动速度显示 */}
        {Math.abs(scrollSpeed) > 30 && (
          <div className={`text-xs font-bold ${userControlled ? 'text-red-500' : 'text-blue-500'}`}>
            {scrollSpeed > 0 ? '⬇️ 快进' : '⬆️ 倒退'} {Math.abs(scrollSpeed).toFixed(0)}
          </div>
        )}

        {/* 测试按钮 */}
        <button
          onClick={testAudio}
          className="text-xs bg-green-500 text-white px-2 py-1 rounded"
        >
          测试音频
        </button>
      </div>
    </div>
  )
}