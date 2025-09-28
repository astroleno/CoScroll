'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { LyricLine, parseLrc, getCurrentLyric, HEART_SUTRA_LOOP_END } from '@/utils/lrcParser'

export function useHeartSutraAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [currentLyric, setCurrentLyric] = useState<LyricLine | null>(null)
  const [volume, setVolume] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)

  // 初始化音频
  useEffect(() => {
    const audio = new Audio('/audio/心经.mp3')
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration)
      setIsLoading(false)
    })

    audio.addEventListener('timeupdate', () => {
      let time = audio.currentTime

      // 检查是否到达循环截止点 (2:44)
      if (time >= HEART_SUTRA_LOOP_END) {
        // 渐弱效果
        const fadeOutTime = 3 // 3秒渐弱
        const fadeStart = HEART_SUTRA_LOOP_END
        const fadeProgress = Math.min((time - fadeStart) / fadeOutTime, 1)
        audio.volume = volume * (1 - fadeProgress)

        // 渐弱完成后重新开始
        if (fadeProgress >= 1) {
          audio.currentTime = 0
          audio.volume = volume
        }
      } else {
        // 正常播放时确保音量正确
        audio.volume = volume
      }

      setCurrentTime(time)
    })

    audio.addEventListener('ended', () => {
      // 如果音频结束，重新开始
      audio.currentTime = 0
      if (isPlaying) {
        audio.play()
      }
    })

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [volume, isPlaying])

  // 加载LRC歌词文件
  useEffect(() => {
    fetch('/lyrics/心经.lrc')
      .then(response => response.text())
      .then(lrcContent => {
        const parsedLyrics = parseLrc(lrcContent)
        setLyrics(parsedLyrics)
      })
      .catch(console.error)
  }, [])

  // 更新当前歌词
  useEffect(() => {
    const lyric = getCurrentLyric(lyrics, currentTime)
    setCurrentLyric(lyric)
  }, [lyrics, currentTime])

  // 播放控制
  const play = useCallback(() => {
    if (audioRef.current && !isLoading) {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }, [isLoading])

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
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
      audioRef.current.currentTime = Math.max(0, Math.min(time, HEART_SUTRA_LOOP_END))
    }
  }, [])

  return {
    // 状态
    isPlaying,
    currentTime,
    duration,
    volume,
    isLoading,

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
    progress: duration > 0 ? Math.min(currentTime / HEART_SUTRA_LOOP_END, 1) : 0,
    loopEndTime: HEART_SUTRA_LOOP_END
  }
}