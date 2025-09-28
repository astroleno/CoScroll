'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePlaybackControl } from './usePlaybackControl'

// 段落自动切换定时器 Hook
export function useSegmentTimer() {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const {
    currentSegment,
    playbackSpeed,
    isAutoPlaying,
    nextSegment,
    getSegmentDuration,
    segmentStartTime
  } = usePlaybackControl()

  // 清除定时器
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // 设置自动切换定时器
  const setTimer = useCallback(() => {
    if (!currentSegment || !isAutoPlaying) return

    clearTimer()

    const duration = getSegmentDuration(currentSegment.text)
    const elapsed = Date.now() - segmentStartTime
    const remaining = Math.max(0, duration - elapsed)

    timerRef.current = setTimeout(() => {
      nextSegment()
    }, remaining)
  }, [currentSegment, isAutoPlaying, getSegmentDuration, segmentStartTime, nextSegment, clearTimer])

  // 当播放速度变化时，重新计算定时器
  useEffect(() => {
    setTimer()
    return clearTimer
  }, [setTimer, clearTimer])

  // 当自动播放状态变化时，控制定时器
  useEffect(() => {
    if (isAutoPlaying) {
      setTimer()
    } else {
      clearTimer()
    }
  }, [isAutoPlaying, setTimer, clearTimer])

  // 组件卸载时清理定时器
  useEffect(() => {
    return clearTimer
  }, [clearTimer])

  return {
    clearTimer,
    setTimer
  }
}