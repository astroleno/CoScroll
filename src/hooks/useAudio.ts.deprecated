'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAudioStore } from '@/stores/audioStore'
import { start, getContext, Reverb, Player, context } from 'tone'

// useAudio Hook - 音频管理和同步控制
export function useAudio() {
  const {
    isPlaying,
    playbackRate,
    currentTime,
    duration,
    setIsPlaying,
    setPlaybackRate,
    setCurrentTime,
    setDuration
  } = useAudioStore()

  const [isAudioReady, setIsAudioReady] = useState(false)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Tone.js 播放器引用
  const playerRef = useRef<InstanceType<typeof Player> | null>(null)
  const reverbRef = useRef<InstanceType<typeof Reverb> | null>(null)

  // 初始化音频系统
  const initAudio = useCallback(async () => {
    try {
      // 启动 Tone.js 音频上下文
      await start()
      setAudioContext(context)

      // 创建混响效果
      const reverb = new Reverb({
        decay: 4,
        wet: 0.3
      }).toDestination()
      reverbRef.current = reverb

      // 创建音频播放器
      const player = new Player({
        url: '/audio/heart_sutra.mp3', // MVP 阶段的音频文件路径
        loop: true,
        autostart: false,
        onload: () => {
          setDuration(player.buffer.duration || 0)
          setIsAudioReady(true)
          console.log('Audio loaded successfully')
        },
        onerror: (err) => {
          console.error('Audio loading error:', err)
          setError('音频加载失败')
        }
      }).connect(reverb)

      playerRef.current = player

    } catch (err) {
      console.error('Audio initialization error:', err)
      setError('音频初始化失败')
    }
  }, [setDuration])

  // 播放音频
  const play = useCallback(async () => {
    if (playerRef.current && isAudioReady) {
      try {
        if (context.state !== 'running') {
          await start()
        }
        playerRef.current.start()
        setIsPlaying(true)
      } catch (err) {
        console.error('Play error:', err)
        setError('播放失败')
      }
    }
  }, [isAudioReady, setIsPlaying])

  // 暂停音频
  const pause = useCallback(() => {
    if (playerRef.current && isPlaying) {
      playerRef.current.stop()
      setIsPlaying(false)
    }
  }, [isPlaying, setIsPlaying])

  // 设置播放倍速
  const setPlaybackRateValue = useCallback((rate: number) => {
    if (playerRef.current && isAudioReady) {
      // Tone.js 播放倍速控制
      playerRef.current.playbackRate = rate
      setPlaybackRate(rate)
    }
  }, [isAudioReady, setPlaybackRate])

  // 设置播放位置
  const setPosition = useCallback((position: number) => {
    if (playerRef.current && isAudioReady) {
      // 重新开始播放从指定位置
      if (isPlaying) {
        playerRef.current.stop()
        playerRef.current.start('+0', position)
      }
      setCurrentTime(position)
    }
  }, [isAudioReady, isPlaying, setCurrentTime])

  // 应用音频效果
  const applyEffects = useCallback((effects: { reverb?: number; wet?: number }) => {
    if (reverbRef.current) {
      if (effects.wet !== undefined) {
        reverbRef.current.wet.value = effects.wet
      }
    }
  }, [])

  // 渐入效果
  const fadeIn = useCallback((duration: number = 1) => {
    if (playerRef.current && isAudioReady) {
      playerRef.current.volume.value = -60 // 从很小声开始
      playerRef.current.volume.rampTo(0, duration) // 渐入到正常音量
    }
  }, [isAudioReady])

  // 渐出效果
  const fadeOut = useCallback((duration: number = 1) => {
    if (playerRef.current && isAudioReady) {
      playerRef.current.volume.rampTo(-60, duration) // 渐出
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.stop()
          setIsPlaying(false)
        }
      }, duration * 1000)
    }
  }, [isAudioReady, setIsPlaying])

  // 监控播放进度
  useEffect(() => {
    let animationFrame: number

    const updateProgress = () => {
      if (playerRef.current && isPlaying && isAudioReady) {
        // 这里可以获取当前播放时间，Tone.js 的实现可能需要其他方式
        // setCurrentTime(player.immediate())
      }
      animationFrame = requestAnimationFrame(updateProgress)
    }

    if (isPlaying) {
      updateProgress()
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [isPlaying, isAudioReady, setCurrentTime])

  // 清理资源
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose()
      }
      if (reverbRef.current) {
        reverbRef.current.dispose()
      }
    }
  }, [])

  return {
    // 状态
    isAudioReady,
    isPlaying,
    playbackRate,
    currentTime,
    duration,
    error,
    audioContext,

    // 控制方法
    initAudio,
    play,
    pause,
    setPlaybackRate: setPlaybackRateValue,
    setPosition,
    applyEffects,
    fadeIn,
    fadeOut
  }
}