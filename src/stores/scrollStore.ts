import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// 滚动状态接口
interface ScrollState {
  // 基础状态
  scrollPosition: number
  scrollSpeed: number
  scrollVelocity: number
  isScrolling: boolean
  direction: 'up' | 'down' | 'idle'

  // 滚动配置
  sensitivity: number
  smoothing: number
  threshold: number

  // 统计信息
  totalDistance: number
  scrollStartTime: number | null
  lastScrollTime: number

  // 操作方法
  setScrollPosition: (position: number) => void
  setScrollSpeed: (speed: number) => void
  setIsScrolling: (isScrolling: boolean) => void
  setDirection: (direction: 'up' | 'down' | 'idle') => void
  setSensitivity: (sensitivity: number) => void
  setSmoothing: (smoothing: number) => void

  // 工具方法
  reset: () => void
  updateMetrics: () => void
  getScrollDuration: () => number
  getAverageSpeed: () => number
}

// 初始状态
const initialState = {
  scrollPosition: 0,
  scrollSpeed: 0,
  scrollVelocity: 0,
  isScrolling: false,
  direction: 'idle' as const,
  sensitivity: 1.0,
  smoothing: 0.1,
  threshold: 10,
  totalDistance: 0,
  scrollStartTime: null,
  lastScrollTime: 0,
}

// 创建滚动状态存储
export const useScrollStore = create<ScrollState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // 设置滚动位置
    setScrollPosition: (position: number) => {
      const state = get()
      const delta = Math.abs(position - state.scrollPosition)

      set({
        scrollPosition: position,
        totalDistance: state.totalDistance + delta,
        lastScrollTime: Date.now()
      })
    },

    // 设置滚动速度
    setScrollSpeed: (speed: number) => {
      const state = get()
      const direction = speed > 0 ? 'down' : speed < 0 ? 'up' : 'idle'

      set({
        scrollSpeed: speed,
        scrollVelocity: speed, // 同步设置 velocity
        direction,
        lastScrollTime: Date.now()
      })
    },

    // 设置滚动状态
    setIsScrolling: (isScrolling: boolean) => {
      const state = get()

      set({
        isScrolling,
        scrollStartTime: isScrolling && !state.isScrolling
          ? Date.now()
          : !isScrolling
          ? null
          : state.scrollStartTime
      })
    },

    // 设置滚动方向
    setDirection: (direction: 'up' | 'down' | 'idle') => {
      set({ direction })
    },

    // 设置灵敏度
    setSensitivity: (sensitivity: number) => {
      set({ sensitivity: Math.max(0.1, Math.min(5.0, sensitivity)) })
    },

    // 设置平滑度
    setSmoothing: (smoothing: number) => {
      set({ smoothing: Math.max(0, Math.min(1, smoothing)) })
    },

    // 重置所有状态
    reset: () => {
      set(initialState)
    },

    // 更新统计指标
    updateMetrics: () => {
      const state = get()
      const now = Date.now()

      set({
        lastScrollTime: now
      })
    },

    // 获取滚动持续时间
    getScrollDuration: () => {
      const state = get()
      return state.scrollStartTime
        ? Date.now() - state.scrollStartTime
        : 0
    },

    // 获取平均滚动速度
    getAverageSpeed: () => {
      const state = get()
      const duration = state.getScrollDuration()
      return duration > 0 ? state.totalDistance / duration : 0
    }
  }))
)

// 订阅滚动状态变化，用于调试
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  useScrollStore.subscribe(
    (state) => state.scrollSpeed,
    (scrollSpeed) => {
      if (Math.abs(scrollSpeed) > 50) {
        console.log(`Fast scroll detected: ${scrollSpeed.toFixed(2)}`)
      }
    }
  )
}