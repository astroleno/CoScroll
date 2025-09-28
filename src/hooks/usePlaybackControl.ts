'use client'

import { useState, useEffect, useCallback } from 'react'
import { useScrollStore } from '@/stores/scrollStore'
import { useHeartSutraAudio } from './useHeartSutraAudio'

// 播放控制 Hook - 音频同步版本
export function usePlaybackControl() {
  const [isTransitioning, setIsTransitioning] = useState(false)

  // 获取滚动状态和音频状态
  const { scrollVelocity } = useScrollStore()
  const {
    currentLyric,
    isPlaying,
    currentTime,
    progress,
    togglePlay,
    setVolume,
    volume
  } = useHeartSutraAudio()

  // 滚动影响音频播放速度（通过音量或其他方式体现）
  const playbackSpeed = Math.max(0.2, Math.min(3.0, 1.0 + scrollVelocity * 0.5))

  // 当前段落基于音频歌词
  const currentSegment = currentLyric ? {
    id: Math.floor(currentTime / 10) + 1, // 简单的ID生成
    anchor: currentLyric.anchor || '心',
    text: currentLyric.text
  } : {
    id: 1,
    anchor: '心',
    text: '心经体验'
  }

  // 计算段落进度（基于音频时间）
  const getSegmentProgress = useCallback(() => {
    return progress
  }, [progress])

  // 计算总体验进度
  const getTotalProgress = useCallback(() => {
    return progress
  }, [progress])

  // 音频控制方法
  const nextSegment = useCallback(() => {
    // 基于音频的下一段逻辑可以是快进
    setIsTransitioning(true)
    setTimeout(() => {
      setIsTransitioning(false)
    }, 600)
  }, [])

  const previousSegment = useCallback(() => {
    // 基于音频的上一段逻辑可以是快退
    setIsTransitioning(true)
    setTimeout(() => {
      setIsTransitioning(false)
    }, 600)
  }, [])

  const jumpToSegment = useCallback(() => {
    // 跳转逻辑
  }, [])

  const toggleAutoPlay = useCallback(() => {
    togglePlay()
  }, [togglePlay])

  return {
    // 状态
    currentSegmentIndex: Math.floor(currentTime / 10), // 基于时间的段落索引
    currentSegment,
    playbackSpeed,
    isAutoPlaying: isPlaying,
    segmentStartTime: currentTime,
    isTransitioning,

    // 进度
    getSegmentProgress,
    getTotalProgress,

    // 控制方法
    nextSegment,
    previousSegment,
    jumpToSegment,
    toggleAutoPlay,

    // 音频相关
    currentTime,
    volume,
    setVolume,

    // 元数据
    totalSegments: 32 // LRC中大约32行
  }
}