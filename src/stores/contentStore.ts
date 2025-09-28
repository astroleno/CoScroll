import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { TextSegment, TextContent, TextState } from '@/types/content.types'

// 内容状态接口
interface ContentState {
  // 当前内容
  currentContent: TextContent | null
  segments: TextSegment[]
  currentIndex: number

  // 状态管理
  state: TextState
  error: string | null
  progress: number

  // 内容历史
  history: string[] // 内容ID历史
  favorites: string[] // 收藏的内容ID

  // 搜索和过滤
  searchQuery: string
  filteredSegments: TextSegment[]

  // 操作方法
  setCurrentContent: (content: TextContent) => void
  setSegments: (segments: TextSegment[]) => void
  setCurrentIndex: (index: number) => void
  setState: (state: TextState) => void
  setError: (error: string | null) => void
  setProgress: (progress: number) => void

  // 导航方法
  nextSegment: () => void
  prevSegment: () => void
  goToSegment: (index: number) => void
  goToAnchor: (anchorWord: string) => void

  // 历史和收藏
  addToHistory: (contentId: string) => void
  addToFavorites: (contentId: string) => void
  removeFromFavorites: (contentId: string) => void
  clearHistory: () => void

  // 搜索功能
  setSearchQuery: (query: string) => void
  searchSegments: (query: string) => TextSegment[]

  // 工具方法
  reset: () => void
  getCurrentSegment: () => TextSegment | null
  getNextSegment: () => TextSegment | null
  getPrevSegment: () => TextSegment | null
  getProgress: () => number
}

// 初始状态
const initialState = {
  currentContent: null,
  segments: [],
  currentIndex: 0,
  state: 'loading' as TextState,
  error: null,
  progress: 0,
  history: [],
  favorites: [],
  searchQuery: '',
  filteredSegments: [],
}

// 创建内容状态存储
export const useContentStore = create<ContentState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // 设置当前内容
    setCurrentContent: (content: TextContent) => {
      const state = get()
      set({
        currentContent: content,
        segments: content.segments,
        currentIndex: 0,
        state: 'ready',
        error: null
      })

      // 添加到历史记录
      state.addToHistory(content.id)
    },

    // 设置文本段落
    setSegments: (segments: TextSegment[]) => {
      set({
        segments,
        filteredSegments: segments,
        currentIndex: 0
      })
    },

    // 设置当前索引
    setCurrentIndex: (index: number) => {
      const state = get()
      const validIndex = Math.max(0, Math.min(index, state.segments.length - 1))

      set({
        currentIndex: validIndex,
        progress: state.segments.length > 0 ? (validIndex / state.segments.length) * 100 : 0
      })
    },

    // 设置状态
    setState: (newState: TextState) => {
      set({ state: newState })
    },

    // 设置错误
    setError: (error: string | null) => {
      set({
        error,
        state: error ? 'error' : 'ready'
      })
    },

    // 设置进度
    setProgress: (progress: number) => {
      set({ progress: Math.max(0, Math.min(100, progress)) })
    },

    // 下一个段落
    nextSegment: () => {
      const state = get()
      const nextIndex = (state.currentIndex + 1) % state.segments.length
      state.setCurrentIndex(nextIndex)
    },

    // 上一个段落
    prevSegment: () => {
      const state = get()
      const prevIndex = (state.currentIndex - 1 + state.segments.length) % state.segments.length
      state.setCurrentIndex(prevIndex)
    },

    // 跳转到指定段落
    goToSegment: (index: number) => {
      const state = get()
      state.setCurrentIndex(index)
    },

    // 跳转到锚字
    goToAnchor: (anchorWord: string) => {
      const state = get()
      const targetIndex = state.segments.findIndex(
        segment => segment.anchorWord === anchorWord
      )

      if (targetIndex !== -1) {
        state.setCurrentIndex(targetIndex)
      }
    },

    // 添加到历史记录
    addToHistory: (contentId: string) => {
      const state = get()
      const newHistory = [contentId, ...state.history.filter(id => id !== contentId)]
        .slice(0, 50) // 最多保存50条历史记录

      set({ history: newHistory })
    },

    // 添加到收藏
    addToFavorites: (contentId: string) => {
      const state = get()
      if (!state.favorites.includes(contentId)) {
        set({ favorites: [...state.favorites, contentId] })
      }
    },

    // 从收藏中移除
    removeFromFavorites: (contentId: string) => {
      const state = get()
      set({ favorites: state.favorites.filter(id => id !== contentId) })
    },

    // 清空历史记录
    clearHistory: () => {
      set({ history: [] })
    },

    // 设置搜索查询
    setSearchQuery: (query: string) => {
      const state = get()
      const filteredSegments = query
        ? state.segments.filter(segment =>
            segment.content.includes(query) ||
            segment.anchorWord?.includes(query)
          )
        : state.segments

      set({
        searchQuery: query,
        filteredSegments
      })
    },

    // 搜索段落
    searchSegments: (query: string) => {
      const state = get()
      return state.segments.filter(segment =>
        segment.content.includes(query) ||
        segment.anchorWord?.includes(query)
      )
    },

    // 重置状态
    reset: () => {
      set({
        ...initialState,
        history: get().history, // 保留历史记录
        favorites: get().favorites // 保留收藏
      })
    },

    // 获取当前段落
    getCurrentSegment: () => {
      const state = get()
      return state.segments[state.currentIndex] || null
    },

    // 获取下一个段落
    getNextSegment: () => {
      const state = get()
      const nextIndex = (state.currentIndex + 1) % state.segments.length
      return state.segments[nextIndex] || null
    },

    // 获取上一个段落
    getPrevSegment: () => {
      const state = get()
      const prevIndex = (state.currentIndex - 1 + state.segments.length) % state.segments.length
      return state.segments[prevIndex] || null
    },

    // 获取进度百分比
    getProgress: () => {
      const state = get()
      return state.segments.length > 0 ? (state.currentIndex / state.segments.length) * 100 : 0
    }
  }))
)

// 开发环境下的状态监听
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  useContentStore.subscribe(
    (state) => state.currentIndex,
    (currentIndex, prevIndex) => {
      console.log(`Content index changed: ${prevIndex} -> ${currentIndex}`)
    }
  )
}