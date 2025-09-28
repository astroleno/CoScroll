import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// 音频状态接口
interface AudioState {
  // 播放状态
  isPlaying: boolean
  isPaused: boolean
  isLoading: boolean
  isReady: boolean

  // 播放参数
  playbackRate: number
  volume: number
  currentTime: number
  duration: number

  // 音频效果
  reverbLevel: number
  wetLevel: number

  // 错误状态
  error: string | null

  // 音频文件信息
  currentAudioId: string | null
  availableAudios: string[]

  // 操作方法
  setIsPlaying: (playing: boolean) => void
  setIsPaused: (paused: boolean) => void
  setIsLoading: (loading: boolean) => void
  setIsReady: (ready: boolean) => void
  setPlaybackRate: (rate: number) => void
  setVolume: (volume: number) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setReverbLevel: (level: number) => void
  setWetLevel: (level: number) => void
  setError: (error: string | null) => void
  setCurrentAudioId: (id: string | null) => void
  setAvailableAudios: (audios: string[]) => void

  // 工具方法
  reset: () => void
  getProgress: () => number
  togglePlayPause: () => void
}

// 初始状态
const initialState = {
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  isReady: false,
  playbackRate: 1.0,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  reverbLevel: 0.3,
  wetLevel: 0.3,
  error: null,
  currentAudioId: null,
  availableAudios: [],
}

// 创建音频状态存储
export const useAudioStore = create<AudioState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // 设置播放状态
    setIsPlaying: (playing: boolean) => {
      set({
        isPlaying: playing,
        isPaused: !playing && get().duration > 0
      })
    },

    // 设置暂停状态
    setIsPaused: (paused: boolean) => {
      set({
        isPaused: paused,
        isPlaying: !paused
      })
    },

    // 设置加载状态
    setIsLoading: (loading: boolean) => {
      set({ isLoading: loading })
    },

    // 设置就绪状态
    setIsReady: (ready: boolean) => {
      set({ isReady: ready })
    },

    // 设置播放倍速
    setPlaybackRate: (rate: number) => {
      const clampedRate = Math.max(0.25, Math.min(4.0, rate))
      set({ playbackRate: clampedRate })
    },

    // 设置音量
    setVolume: (volume: number) => {
      const clampedVolume = Math.max(0, Math.min(1, volume))
      set({ volume: clampedVolume })
    },

    // 设置当前时间
    setCurrentTime: (time: number) => {
      const state = get()
      const clampedTime = Math.max(0, Math.min(state.duration || 0, time))
      set({ currentTime: clampedTime })
    },

    // 设置总时长
    setDuration: (duration: number) => {
      const clampedDuration = Math.max(0, duration)
      set({ duration: clampedDuration })
    },

    // 设置混响级别
    setReverbLevel: (level: number) => {
      const clampedLevel = Math.max(0, Math.min(1, level))
      set({ reverbLevel: clampedLevel })
    },

    // 设置湿度级别
    setWetLevel: (level: number) => {
      const clampedLevel = Math.max(0, Math.min(1, level))
      set({ wetLevel: clampedLevel })
    },

    // 设置错误
    setError: (error: string | null) => {
      set({ error })
    },

    // 设置当前音频ID
    setCurrentAudioId: (id: string | null) => {
      set({ currentAudioId: id })
    },

    // 设置可用音频列表
    setAvailableAudios: (audios: string[]) => {
      set({ availableAudios: audios })
    },

    // 重置状态
    reset: () => {
      set({
        ...initialState,
        availableAudios: get().availableAudios // 保留可用音频列表
      })
    },

    // 获取播放进度 (0-100)
    getProgress: () => {
      const state = get()
      return state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0
    },

    // 切换播放/暂停
    togglePlayPause: () => {
      const state = get()
      state.setIsPlaying(!state.isPlaying)
    }
  }))
)

// 开发环境监听器
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // 监听播放状态变化
  useAudioStore.subscribe(
    (state) => state.isPlaying,
    (isPlaying) => {
      console.log(`Audio playback ${isPlaying ? 'started' : 'stopped'}`)
    }
  )

  // 监听播放倍速变化
  useAudioStore.subscribe(
    (state) => state.playbackRate,
    (playbackRate) => {
      if (playbackRate !== 1.0) {
        console.log(`Playback rate changed to: ${playbackRate.toFixed(2)}x`)
      }
    }
  )

  // 监听错误
  useAudioStore.subscribe(
    (state) => state.error,
    (error) => {
      if (error) {
        console.error('Audio error:', error)
      }
    }
  )
}