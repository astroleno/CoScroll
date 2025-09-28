'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { LyricLine, parseLrc, getCurrentLyric } from '@/utils/lrcParser'
import { useContentAudio } from './useContentPackage'
import { useScrollStore } from '@/stores/scrollStore'

export function useHeartSutraAudio(contentId?: string) {
  const { config } = useContentAudio(contentId)
  const { scrollSpeed, scrollPosition } = useScrollStore()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [currentLyric, setCurrentLyric] = useState<LyricLine | null>(null)
  const [volume, setVolume] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)
  const [userControlled, setUserControlled] = useState(false)

  // 初始化音频 - 只在组件挂载时初始化一次
  useEffect(() => {
    if (audioRef.current) {
      // 如果已经有音频实例，先清理
      audioRef.current.pause()
      audioRef.current.src = ''
    }

    console.log('初始化音频:', config.audio.file)
    const audio = new Audio(config.audio.file)
    audioRef.current = audio

    // 设置默认音量
    audio.volume = volume

    const handleLoadedMetadata = () => {
      console.log('音频元数据加载完成:')
      console.log('- 时长:', audio.duration, '秒')
      console.log('- 音量:', audio.volume)
      console.log('- 文件路径:', audio.src)
      setDuration(audio.duration)
      setIsLoading(false)
    }

    const handleError = (e: Event) => {
      console.error('音频加载错误:', e)
      console.error('错误代码:', audio.error?.code)
      console.error('错误信息:', audio.error?.message)
    }

    const handleCanPlay = () => {
      console.log('音频可以播放')
    }

    const handleTimeUpdate = () => {
      // 如果用户正在控制，不自动更新时间
      if (userControlled) return

      let time = audio.currentTime

      // 检查是否到达循环截止点
      if (time >= config.audio.loopEndTime) {
        // 渐弱效果
        const fadeStart = config.audio.loopEndTime
        const fadeOutTime = config.audio.fadeOutDuration
        const fadeProgress = Math.min((time - fadeStart) / fadeOutTime, 1)
        audio.volume = volume * (1 - fadeProgress)

        // 渐弱完成后重新开始
        if (fadeProgress >= 1) {
          console.log('音频循环重新开始')
          audio.currentTime = 0
          audio.volume = volume
        }
      } else {
        // 正常播放时确保音量正确
        audio.volume = volume
      }

      setCurrentTime(time)
    }

    const handleEnded = () => {
      console.log('音频播放结束')
      // 如果音频结束，重新开始
      audio.currentTime = 0
      if (isPlaying) {
        console.log('重新播放音频')
        audio.play()
      }
    }

    // 添加事件监听器
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('error', handleError)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)

    return () => {
      console.log('清理音频资源')
      // 移除事件监听器
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)

      audio.pause()
      audio.src = ''
    }
  }, [config.audio.file]) // 只依赖音频文件路径，避免重复初始化

  // 单独处理音量变化
  useEffect(() => {
    if (audioRef.current && !userControlled) {
      audioRef.current.volume = volume
    }
  }, [volume, userControlled])

  // 加载LRC歌词文件
  useEffect(() => {
    fetch(config.lyrics.file)
      .then(response => response.text())
      .then(lrcContent => {
        const parsedLyrics = parseLrc(lrcContent)
        setLyrics(parsedLyrics)
      })
      .catch(console.error)
  }, [config.lyrics.file])

  // 更新当前歌词
  useEffect(() => {
    const lyric = getCurrentLyric(lyrics, currentTime)
    setCurrentLyric(lyric)
  }, [lyrics, currentTime])

  // DJ打碟式滚动控制 - 滚动直接控制音频位置
  const lastScrollPositionRef = useRef(0)

  useEffect(() => {
    if (audioRef.current && !isLoading && isPlaying) {
      const isScrolling = Math.abs(scrollSpeed) > 30

      if (isScrolling) {
        setUserControlled(true)

        // 计算滚动位置变化
        const scrollDelta = scrollPosition - lastScrollPositionRef.current
        lastScrollPositionRef.current = scrollPosition

        // 将滚动变化映射到音频时间变化 (每100像素滚动 = 1秒音频)
        const timeStep = scrollDelta / 100
        let newTime = audioRef.current.currentTime + timeStep

        // 确保时间在有效范围内
        newTime = Math.max(0, Math.min(newTime, config.audio.loopEndTime))

        // 直接设置音频位置
        audioRef.current.currentTime = newTime
        setCurrentTime(newTime)

        console.log('DJ模式 - 音频跳转到:', newTime.toFixed(2), '秒')
        console.log('滚动变化:', scrollDelta, '时间变化:', timeStep.toFixed(2))

        // 暂停自动播放，进入手动控制模式
        audioRef.current.pause()

      } else if (userControlled) {
        // 恢复自动播放
        audioRef.current.play()
        setUserControlled(false)
        console.log('退出DJ模式，恢复自动播放')
      }
    }
  }, [scrollSpeed, scrollPosition, isLoading, isPlaying, userControlled, config.audio.loopEndTime])

  // 播放控制
  const play = useCallback(async () => {
    if (audioRef.current && !isLoading && !isPlaying) {
      try {
        console.log('尝试播放音频...')
        console.log('音频文件:', audioRef.current.src)
        console.log('音频音量:', audioRef.current.volume)
        console.log('音频时长:', audioRef.current.duration)
        console.log('音频当前时间:', audioRef.current.currentTime)

        await audioRef.current.play()
        setIsPlaying(true)
        console.log('音频开始播放 ✓')

      } catch (error) {
        console.error('播放失败:', error)
        setIsPlaying(false)
      }
    } else if (isPlaying) {
      console.log('音频已在播放，跳过重复播放')
    }
  }, [isLoading, isPlaying])

  const pause = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      console.log('音频暂停')
    }
  }, [isPlaying])

  const togglePlay = useCallback(async () => {
    console.log('togglePlay 调用, 当前状态:', isPlaying)
    if (isPlaying) {
      pause()
    } else {
      await play()
    }
  }, [isPlaying, play, pause])

  // 音量控制
  const setAudioVolume = useCallback((newVolume: number) => {
    const vol = Math.max(0, Math.min(1, newVolume))
    setVolume(vol)
    if (audioRef.current) {
      audioRef.current.volume = vol
    }
  }, [])

  // 跳转到指定时间
  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, config.audio.loopEndTime))
    }
  }, [config.audio.loopEndTime])

  return {
    // 状态
    isPlaying,
    currentTime,
    duration,
    volume,
    isLoading,
    userControlled,

    // 歌词
    lyrics,
    currentLyric,

    // 控制方法
    play,
    pause,
    togglePlay,
    setVolume: setAudioVolume,
    seekTo,

    // 计算属性
    progress: duration > 0 ? Math.min(currentTime / config.audio.loopEndTime, 1) : 0,
    loopEndTime: config.audio.loopEndTime,
    playbackRate: audioRef.current?.playbackRate || 1.0,

    // 配置信息
    config
  }
}