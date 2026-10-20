'use client'
import { assetUrl } from '@/utils/assetUrl';


import { useState, useEffect, useRef, useCallback } from 'react'

// 歌词数据类型
interface Lyric {
  time: number
  text: string
  anchor: string
}

// 解析LRC文件格式的函数（过滤空歌词）
const parseLRC = (lrcContent: string): Lyric[] => {
  const lines = lrcContent.trim().split('\n')
  const lyrics: Lyric[] = []

  lines.forEach(line => {
    const trimmedLine = line.trim()
    if (!trimmedLine) return

    // 匹配 [mm:ss.xxx] 格式的时间戳
    const match = trimmedLine.match(/^\[(\d{2}):(\d{2})\.(\d{3})\](.*)$/)
    if (match) {
      const minutes = parseInt(match[1])
      const seconds = parseInt(match[2])
      const milliseconds = parseInt(match[3])
      const text = match[4].trim()

      // 转换为秒
      const timeInSeconds = minutes * 60 + seconds + milliseconds / 1000

      // 🔧 关键修复：过滤掉空歌词，但保留时间戳用于锚点
      if (text) {
        // 锚字一位截断
        const anchor = text[0]

        lyrics.push({
          time: timeInSeconds,
          text,
          anchor
        })
      }
    }
  })

  return lyrics.sort((a, b) => a.time - b.time)
}

// 常量定义
const PROGRAM_SCROLL_COOLDOWN = 300  // 程序滚动冷却时间（ms）
const WRAP_COOLDOWN = 100  // 回绕窗口冷却时间（ms）
const WRAP_EPS = 0.5  // 回绕检测阈值（秒）
const LRC_FILE_PATH = assetUrl('/lyrics/心经.lrc')

export default function LyricSyncV2() {
  const [lyrics, setLyrics] = useState<Lyric[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [allowScrollToTime, setAllowScrollToTime] = useState(false)

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null)
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const lyricRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const lastProgrammaticScrollTimeRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const targetScrollTopRef = useRef(0)
  const currentScrollTopRef = useRef(0)

  // 回绕检测相关 refs
  const prevTimeRef = useRef(0)
  const isLoopingRef = useRef(false)
  const loopStartTimeRef = useRef(0)

  // 滚动归一化相关 refs
  const cycleHeightRef = useRef(0)
  const lastScrollTopRef = useRef(0)

  // 连续滚动相关 refs
  const continuousScrollEnabledRef = useRef(false)
  const currentScrollProgressRef = useRef(0)
  const targetScrollOffsetRef = useRef(0)

  // 加载歌词
  useEffect(() => {
    const loadLyrics = async () => {
      try {
        setLoadError(null)
        // 🔧 修复：使用直接路径，避免window.location.origin问题
        const response = await fetch(LRC_FILE_PATH, { cache: 'no-store' })

        if (!response.ok) {
          throw new Error(`加载歌词失败：${response.status}`)
        }

        const lrcContent = await response.text()
        const parsedLyrics = parseLRC(lrcContent)

        // 🔧 Debug: 检查解析结果
        console.log('🎵 歌词解析结果:', {
          totalCount: parsedLyrics.length,
          firstLyric: parsedLyrics[0]?.text,
          secondLyric: parsedLyrics[1]?.text,
          fifthLyric: parsedLyrics[4]?.text,
          allAnchors: parsedLyrics.map(l => l.anchor)
        })

        setLyrics(parsedLyrics)
        setCurrentLyricIndex(0)

        // 🔧 新增：验证修复效果的关键信息
        console.log('🔧 修复验证信息:', {
          lyricsLoaded: true,
          lyricsCount: parsedLyrics.length,
          firstLyricTime: parsedLyrics[0]?.time,
          lastLyricTime: parsedLyrics[parsedLyrics.length - 1]?.time,
          estimatedDuration: parsedLyrics[parsedLyrics.length - 1]?.time - parsedLyrics[0]?.time
        })
      } catch (error) {
        console.error('🎵 歌词加载详细错误:', {
          error,
          message: error instanceof Error ? error.message : '未知错误',
          stack: error instanceof Error ? error.stack : undefined,
          LRC_FILE_PATH,
          fetchUrl: LRC_FILE_PATH
        })
        setLoadError(error instanceof Error ? error.message : '加载歌词时出错')
      } finally {
        setIsLoading(false)
      }
    }

    loadLyrics()
  }, [])

  // 核心算法1：时间索引函数（首句前返回-1）
  const indexForTime = useCallback((time: number): number => {
    if (!lyrics.length) return -1

    // 首句前返回-1（关键策略）
    if (time < lyrics[0].time) {
      return -1
    }

    // 查找当前时间对应的歌词索引
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (time >= lyrics[i].time) {
        return i
      }
    }

    return 0
  }, [lyrics])

  // 核心算法2：元素中心命中检测（扩展到完整DOM范围）
  const centeredIndex = useCallback((): number => {
    const container = lyricsContainerRef.current
    if (!container) return -1

    const containerHeight = container.clientHeight
    const lyricCount = lyrics.length

    if (lyricCount === 0) return -1

    let closestIndex = -1
    let smallestDistance = Number.POSITIVE_INFINITY

    // 检查完整DOM范围（原始 + 克隆部分）
    const totalElements = lyricRefs.current.length
    for (let i = 0; i < totalElements; i++) {
      const item = lyricRefs.current[i]
      if (!item) continue

      // 使用getBoundingClientRect()获取精确位置
      const rect = item.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      // 计算元素相对于容器的中心位置
      const itemRelativeCenter = rect.top - containerRect.top + rect.height / 2

      // 计算与容器中心的距离
      const distance = Math.abs(itemRelativeCenter - containerHeight / 2)

      if (distance < smallestDistance) {
        smallestDistance = distance
        closestIndex = i
      }
    }

    // 将DOM索引映射到原始歌词索引（关键！）
    if (closestIndex >= 0) {
      const originalIndex = closestIndex % lyricCount
      console.log('🔍 索引映射', {
        closestDOMIndex: closestIndex,
        mappedOriginalIndex: originalIndex,
        lyricCount,
        cycle: Math.floor(closestIndex / lyricCount), // 0=原始带, 1=克隆带
        elementText: lyricRefs.current[closestIndex]?.textContent
      })
      return originalIndex
    }

    return -1
  }, [lyrics.length])

  // 🔧 简化的滚动归一化函数：只处理明显的越界情况
  const normalizeScrollPosition = useCallback(() => {
    const container = lyricsContainerRef.current
    if (!container || !lyrics.length) return

    const cycleHeight = cycleHeightRef.current
    if (cycleHeight <= 0) return

    const currentScrollTop = container.scrollTop
    const maxScroll = container.scrollHeight - container.clientHeight

    // 🔧 修复：只处理明显的越界情况，避免与连续滚动冲突
    if (currentScrollTop > maxScroll + 100) {
      // 向下越界太多，重置到合理位置
      container.scrollTop = maxScroll
      lastProgrammaticScrollTimeRef.current = Date.now()

      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 滚动归一化（向下越界）', {
          originalScrollTop: currentScrollTop,
          normalizedScrollTop: maxScroll,
          maxScroll
        })
      }
    } else if (currentScrollTop < -100) {
      // 向上越界太多，重置到顶部
      container.scrollTop = 0
      lastProgrammaticScrollTimeRef.current = Date.now()

      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 滚动归一化（向上越界）', {
          originalScrollTop: currentScrollTop,
          normalizedScrollTop: 0
        })
      }
    }
  }, [lyrics.length])

  // 平滑滚动到指定歌词（修复后的简化版本）
  const scrollToLyric = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const container = lyricsContainerRef.current
    const target = lyricRefs.current[index]

    if (!container || !target || index < 0) return

    // 记录程序触发滚动的时间戳
    lastProgrammaticScrollTimeRef.current = Date.now()

    // 🔧 修复：使用直接的滚动计算，而不是 scrollIntoView
    const containerHeight = container.clientHeight
    const targetRect = target.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    // 计算目标滚动位置（居中显示）
    const targetScrollTop = container.scrollTop + (targetRect.top - containerRect.top) - (containerHeight / 2) + (targetRect.height / 2)

    // 直接设置滚动位置
    if (behavior === 'auto') {
      container.scrollTop = targetScrollTop
    } else {
      // 对于 smooth 行为，我们也可以使用 CSS transition
      container.style.scrollBehavior = 'smooth'
      container.scrollTop = targetScrollTop
      // 重置 scrollBehavior
      setTimeout(() => {
        container.style.scrollBehavior = 'auto'
      }, 300)
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 scrollToLyric', {
        index,
        lyricText: lyrics[index]?.text,
        targetScrollTop: targetScrollTop.toFixed(1),
        behavior
      })
    }
  }, [lyrics])

  // 🔧 初始滚动修复：等待歌词和DOM都准备好后再滚动
  useEffect(() => {
    if (lyrics.length > 0 && lyricRefs.current[0] && lyricsContainerRef.current) {
      // 确保DOM已经渲染且refs已填充
      console.log('🎵 DOM准备就绪，执行初始滚动到第一句')
      console.log('🎵 目标歌词:', lyrics[0]?.text)
      scrollToLyric(0, 'auto')
    }
  }, [lyrics.length, scrollToLyric])

  // 连续滚动函数：修复后的简化版本
  const continuousScroll = useCallback(() => {
    const container = lyricsContainerRef.current
    const audio = audioRef.current

    // 基础检查
    if (!container || !lyrics.length) return

    // 🔧 修复1：统一滚动逻辑，无论是否启用连续滚动都执行居中
    let targetIndex = currentLyricIndex

    // 如果有音频且正在播放，使用音频时间计算索引
    if (audio && continuousScrollEnabledRef.current) {
      const audioTime = audio.currentTime
      const audioIndex = indexForTime(audioTime)
      if (audioIndex >= 0) {
        targetIndex = audioIndex
      }
    }

    // 确保目标索引有效
    if (targetIndex < 0 || targetIndex >= lyrics.length) {
      targetIndex = 0
    }

    const targetLyric = lyricRefs.current[targetIndex]
    if (!targetLyric) return

    // 🔧 修复2：简化的滚动位置计算
    const containerHeight = container.clientHeight
    const targetRect = targetLyric.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    // 计算元素应该居中的滚动位置
    const targetScrollTop = container.scrollTop + (targetRect.top - containerRect.top) - (containerHeight / 2) + (targetRect.height / 2)

    // 🔧 修复3：直接设置滚动位置，避免复杂的归一化逻辑
    container.scrollTop = targetScrollTop
    currentScrollTopRef.current = targetScrollTop

    // 调试信息
    if (process.env.NODE_ENV === 'development') {
      const scrollMode = audio && continuousScrollEnabledRef.current ? '连续滚动' : '基础滚动'
      console.log(`🎵 ${scrollMode}`, {
        targetIndex,
        lyricText: lyrics[targetIndex]?.text,
        targetScrollTop: targetScrollTop.toFixed(1),
        audioTime: audio?.currentTime.toFixed(2) || 'N/A',
        containerHeight: containerHeight.toFixed(1)
      })
    }
  }, [lyrics, currentLyricIndex, indexForTime])

  // requestAnimationFrame 循环
  const animationLoop = useCallback(() => {
    continuousScroll()
    animationFrameRef.current = requestAnimationFrame(animationLoop)
  }, [continuousScroll])

  // 自动播放初始化
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !lyrics.length) return

    audio.loop = true
    audio.volume = 0.8

    const tryAutoPlay = async () => {
      try {
        await audio.play()
        setIsPlaying(true)
        console.log('✅ 音频播放成功')
      } catch (error) {
        console.log('⚠️ 自动播放被浏览器阻止，但仍启用基础功能:', error)
        // 即使播放失败，也设置播放状态以启用滚动
        setIsPlaying(true)
      }

      // 无论播放是否成功，都启用连续滚动和基础功能
      continuousScrollEnabledRef.current = true

      // 启动连续滚动循环
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(animationLoop)
      }

      console.log('🌊 连续滚动已启用')
    }

    // 放宽播放条件：在 loadedmetadata 或 canplay 阶段就尝试播放
    if (audio.readyState >= 3) {
      tryAutoPlay()
    } else if (audio.readyState >= 1) {
      // 只要有了元数据就尝试播放
      tryAutoPlay()
      // 同时监听 canplaythrough 事件作为备选
      audio.addEventListener('canplaythrough', tryAutoPlay, { once: true })
    } else {
      // 等待至少 loadedmetadata
      audio.addEventListener('loadedmetadata', tryAutoPlay, { once: true })
      audio.addEventListener('canplaythrough', tryAutoPlay, { once: true })
    }

    return () => {
      audio.removeEventListener('canplaythrough', tryAutoPlay)
    }
  }, [lyrics.length, scrollToLyric])

  // 🔧 简化的循环高度计算：修复时序问题
  useEffect(() => {
    if (!lyrics.length) return

    const calculateCycleHeight = () => {
      const firstOriginal = lyricRefs.current[0]
      const firstDuplicate = lyricRefs.current[lyrics.length]

      if (firstOriginal && firstDuplicate) {
        const height = firstDuplicate.offsetTop - firstOriginal.offsetTop
        cycleHeightRef.current = height

        if (process.env.NODE_ENV === 'development') {
          console.log('📏 循环高度计算完成', {
            firstOriginalOffsetTop: firstOriginal.offsetTop,
            firstDuplicateOffsetTop: firstDuplicate.offsetTop,
            cycleHeight: height,
            lyricsCount: lyrics.length
          })
        }
      } else {
        // 🔧 修复：如果克隆元素还没有准备好，使用行高估算
        const estimatedHeight = lyrics.length * 3.2 * 16 // 3.2rem * 16px
        cycleHeightRef.current = estimatedHeight

        if (process.env.NODE_ENV === 'development') {
          console.log('📏 使用估算循环高度', { estimatedHeight })
        }
      }
    }

    // 多次尝试计算，确保DOM完全渲染
    const attempts = [100, 300, 1000]
    const timers = attempts.map(delay => setTimeout(calculateCycleHeight, delay))

    return () => timers.forEach(clearTimeout)
  }, [lyrics.length])


  // 回绕处理函数：原子化同步 + 滚动归一化
  const handleLoopReset = useCallback(() => {
    console.log('🔄 检测到回绕，开始原子化同步')

    // 1. 进入回绕窗口
    isLoopingRef.current = true
    loopStartTimeRef.current = Date.now()
    setAllowScrollToTime(false)

    // 2. 原子化同步（严格顺序）
    // 先状态
    setCurrentLyricIndex(0)
    setCurrentTime(0)

    // 再视觉：只重置状态，不强制 scrollTop（让 continuousScroll 处理）
    console.log('📍 回绕状态重置，让 continuousScroll 自然处理滚动')

    // 最后时间：确保音频从0开始
    const audio = audioRef.current
    if (audio && audio.currentTime > WRAP_EPS) {
      audio.currentTime = 0
    }

    // 3. 退出回绕窗口（延迟）
    setTimeout(() => {
      isLoopingRef.current = false
      // 确保时间窗口重新开放
      if (audio && audio.currentTime >= lyrics[0]?.time) {
        setAllowScrollToTime(true)
      }
      console.log('🔓 回绕窗口结束，恢复正常操作')
    }, WRAP_COOLDOWN)
  }, [])

  // 时间更新处理（包含回绕检测）
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !lyrics.length) return

    const updateTime = () => {
      const time = audio.currentTime
      const prevTime = prevTimeRef.current

      // 更新 prevTime
      prevTimeRef.current = time

      // 回绕检测：prevTime > time && time < WRAP_EPS
      if (prevTime > time && time < WRAP_EPS && !isLoopingRef.current) {
        console.log('🔄 检测到时间回绕', {
          prevTime: prevTime.toFixed(3),
          currentTime: time.toFixed(3),
          threshold: WRAP_EPS
        })
        handleLoopReset()
        return // 回绕期间跳过其他处理
      }

      // 如果正在回绕窗口内，跳过处理
      if (isLoopingRef.current) {
        return
      }

      setCurrentTime(time)

      // 核心策略：时间窗口控制（首句时间到达后启用）
      if (!allowScrollToTime && time >= lyrics[0].time) {
        setAllowScrollToTime(true)
        console.log('🔓 时间窗口已开放，允许滚动→时间同步')
      }

      // 计算当前歌词索引
      const newIndex = indexForTime(time)

      // 只在首句后更新索引（首句前index为-1，不会触发更新）
      if (newIndex >= 0 && newIndex !== currentLyricIndex) {
        setCurrentLyricIndex(newIndex)

        // 🔧 修复验证：详细的索引更新日志
        console.log('🎵 歌词索引更新', {
          newIndex,
          oldIndex: currentLyricIndex,
          lyricText: lyrics[newIndex]?.text,
          currentTime: time.toFixed(2),
          allowScrollToTime,
          isLooping: isLoopingRef.current,
          continuousScrollEnabled: continuousScrollEnabledRef.current
        })

        // 🔧 新增：验证DOM引用是否正确
        const targetElement = lyricRefs.current[newIndex]
        if (targetElement) {
          console.log('✅ DOM引用验证成功', {
            elementIndex: newIndex,
            elementText: targetElement.textContent,
            elementVisible: targetElement.offsetParent !== null
          })
        } else {
          console.log('❌ DOM引用验证失败', {
            elementIndex: newIndex,
            totalRefs: lyricRefs.current.length,
            lyricsCount: lyrics.length
          })
        }
      }
    }

    audio.addEventListener('timeupdate', updateTime)
    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      // 清理动画循环
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [lyrics, allowScrollToTime, handleLoopReset]) // 移除频繁变化的依赖，避免 RAF 被取消

  // 检测用户是否正在滚动
  const isUserScrolling = useCallback((): boolean => {
    const now = Date.now()
    const timeSinceLastProgrammaticScroll = now - lastProgrammaticScrollTimeRef.current
    return timeSinceLastProgrammaticScroll < PROGRAM_SCROLL_COOLDOWN
  }, [])

  // 处理用户滚动（集成归一化和同步控制）
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const container = lyricsContainerRef.current
    if (!container) return

    const currentScrollTop = container.scrollTop
    lastScrollTopRef.current = currentScrollTop

    // 忽略非用户触发的事件
    if (!event.nativeEvent.isTrusted) return

    // 程序滚动冷却期内，忽略滚动
    if (isUserScrolling()) {
      return
    }

    const audio = audioRef.current
    if (!audio || !lyrics.length) return

    // 🔄 只在用户滚动时执行归一化，避免与 continuousScroll 冲突
    // 只在滚动差异较大时进行归一化
    const scrollDelta = Math.abs(currentScrollTop - lastScrollTopRef.current)
    if (scrollDelta > 100) { // 只在明显跳跃时归一化
      normalizeScrollPosition()
    }

    // 🔄 回绕窗口内禁用滚动→时间同步
    if (isLoopingRef.current) {
      console.log('🚫 回绕窗口内，禁用滚动→时间同步')
      return
    }

    // 核心策略：时间窗口控制
    if (!allowScrollToTime) {
      console.log('🚫 时间窗口未开放，禁止滚动→时间同步')
      return
    }

    // 获取当前居中的歌词索引（滚动→时间）
    const centeredLyricIndex = centeredIndex()

    if (centeredLyricIndex >= 0 && centeredLyricIndex !== currentLyricIndex) {
      const targetLyric = lyrics[centeredLyricIndex]

      if (targetLyric) {
        // 正常同步音频时间
        audio.currentTime = targetLyric.time
        setCurrentTime(targetLyric.time)
        setCurrentLyricIndex(centeredLyricIndex)

        console.log('📍 滚动同步时间', {
          lyricIndex: centeredLyricIndex,
          lyricText: targetLyric.text,
          time: targetLyric.time.toFixed(2),
          audioCurrentTime: audio.currentTime.toFixed(2),
          scrollTop: currentScrollTop,
          cycleHeight: cycleHeightRef.current
        })
      }
    }
  }, [allowScrollToTime, currentLyricIndex, centeredIndex, isUserScrolling, lyrics, normalizeScrollPosition])

  // 播放/暂停控制
  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)

      // 禁用连续滚动
      continuousScrollEnabledRef.current = false

      // 停止动画循环
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      console.log('⏸️ 连续滚动已暂停')
    } else {
      audio.play()
      setIsPlaying(true)

      // 启用连续滚动
      continuousScrollEnabledRef.current = true

      // 重置时间窗口和状态
      setAllowScrollToTime(false)

      // 如果当前时间接近开头（可能是循环后），重置索引
      if (audio.currentTime < 1.0) {
        setCurrentLyricIndex(0)
        setCurrentTime(0)
        scrollToLyric(0, 'auto')
      } else {
        // 滚动到当前歌词
        if (currentLyricIndex >= 0) {
          scrollToLyric(currentLyricIndex, 'auto')
        }
      }

      // 启动连续滚动循环
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(animationLoop)
      }

      console.log('▶️ 连续滚动已启用')
    }
  }

  // 进度条点击
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * audio.duration

    audio.currentTime = newTime
    setCurrentTime(newTime)

    // 根据新时间重新计算索引，处理循环边界
    const newIndex = indexForTime(newTime)
    if (newIndex >= 0) {
      setCurrentLyricIndex(newIndex)
      scrollToLyric(newIndex, 'smooth')
    } else if (newTime < lyrics[0]?.time && newTime < 1.0) {
      // 如果点击位置在开头附近，可能是循环操作，重置到第一句
      setCurrentLyricIndex(0)
      scrollToLyric(0, 'smooth')
    }

    console.log('📍 进度条跳转', {
      newTime: newTime.toFixed(2),
      newIndex,
      percentage: (percentage * 100).toFixed(1) + '%'
    })
  }

  // 格式化时间
  const formatTime = (time: number) => {
    if (!Number.isFinite(time) || time < 0) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  
  // 获取当前歌词样式
  const getLyricClass = useCallback((index: number) => {
    const distance = Math.abs(index - currentLyricIndex)

    if (index === currentLyricIndex) {
      return 'text-white text-xl font-semibold scale-105'
    }

    if (distance === 1) {
      return 'text-gray-200 text-base opacity-90'
    }

    if (distance === 2) {
      return 'text-gray-500 text-sm opacity-70'
    }

    return 'text-gray-600 text-xs opacity-50'
  }, [currentLyricIndex])

  // 更新refs数组 - 为实现无限循环，需要复制歌词
  useEffect(() => {
    lyricRefs.current = new Array(lyrics.length * 2).fill(null)
  }, [lyrics])

  // 获取当前锚字（渲染时双保险）
  const currentLyric = lyrics[currentLyricIndex]
  const currentAnchor = currentLyric ? (currentLyric.anchor || currentLyric.text[0] || '观').slice(0, 1) : '观'

  const rawDuration = audioRef.current?.duration ?? 0
  const safeDuration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0
  const progressPercentage = safeDuration ? Math.min(100, (currentTime / safeDuration) * 100) : 0

  return (
    <div className="min-h-screen text-gray-300 antialiased" style={{ background: 'transparent' }}>
      {/* 背景效果 */}
      <div className="absolute inset-0 fog-effect"></div>
      <div className="absolute inset-0 grainy-overlay opacity-20 mix-blend-soft-light"></div>

      {/* 主内容区域 */}
      <div className="relative min-h-screen w-full flex overflow-hidden">
        {/* 左侧：大字符显示 */}
        <div className="w-2/3 flex items-center justify-center p-4">
          <span className="anchor-char select-none">
            {currentAnchor}
          </span>
        </div>

        {/* 右侧：歌词滚动区域 */}
        <div className="w-1/3 relative flex items-center justify-center">
          <div className="lyrics-wrapper relative w-full max-w-md h-full flex items-center">
            <div className="mask-gradient absolute inset-0 pointer-events-none z-10" aria-hidden="true" />

            <div
              ref={lyricsContainerRef}
              className="lyrics-scroll relative overflow-y-auto scrollbar-hide w-full"
              style={{
                height: 'calc(5 * 3.2rem)', // 确保有固定高度
                maxHeight: 'calc(5 * 3.2rem)'
              }}
              onScroll={handleScroll}
            >
              {loadError ? (
                <div className="flex h-full items-center justify-center text-sm text-red-400">
                  {loadError}
                </div>
              ) : (
                <div className="flex flex-col items-center text-lg leading-relaxed">
                  {isLoading && (
                    <p className="text-gray-500 text-sm">歌词加载中…</p>
                  )}

                  {!isLoading && lyrics.length > 0 && (
                    <>
                      {/* 顶部占位空间 */}
                      <div style={{ height: 'calc(var(--visible-lines) / 2 * var(--line-height))' }} />

                      {/* 第一遍：原始歌词 */}
                      {lyrics.map((lyric, index) => (
                        <p
                          key={`original-${lyric.time}-${index}`}
                          ref={element => {
                            lyricRefs.current[index] = element
                          }}
                          data-lyric-index={index}
                          data-cycle="0"
                          className={`lyric-line transition-all duration-500 ease-in-out ${getLyricClass(index)}`}
                        >
                          {lyric.text}
                        </p>
                      ))}

                      {/* 第二遍：复制歌词实现无限循环视觉效果 */}
                      {lyrics.map((lyric, index) => (
                        <p
                          key={`duplicate-${lyric.time}-${index}`}
                          ref={element => {
                            lyricRefs.current[lyrics.length + index] = element
                          }}
                          data-lyric-index={index}
                          data-cycle="1"
                          className={`lyric-line transition-all duration-500 ease-in-out ${getLyricClass(index)}`}
                        >
                          {lyric.text}
                        </p>
                      ))}

                      {/* 底部占位空间 */}
                      <div style={{ height: 'calc(var(--visible-lines) / 2 * var(--line-height))' }} />
                    </>
                  )}

                  {!isLoading && !lyrics.length && (
                    <p className="text-gray-500 text-sm">暂无歌词内容</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底部控制栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-4">
        <div className="max-w-4xl mx-auto">
          {/* 进度条 */}
          <div
            className="w-full h-2 bg-gray-700 rounded-full cursor-pointer mb-4"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-pink-500 rounded-full transition-all duration-100"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={togglePlay}
                className="w-12 h-12 bg-pink-500 hover:bg-pink-600 rounded-full flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              <div className="text-sm text-gray-400">
                {formatTime(currentTime)} / {formatTime(safeDuration)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 音频元素 */}
      <audio
        ref={audioRef}
        src={assetUrl("/audio/心经.mp3")}
        preload="auto"
      />

      <style jsx>{`
        .anchor-char {
          font-size: 20rem;
          line-height: 1;
          font-weight: 700;
          color: white;
          text-shadow: 0 0 25px rgba(244, 114, 182, 0.3), 0 0 60px rgba(107, 114, 255, 0.3);
          animation: breath 8s ease-in-out infinite, color-shift 15s ease-in-out infinite alternate;
          will-change: transform, opacity, text-shadow;
        }

        .lyrics-wrapper {
          --visible-lines: 5;
          --line-height: 3.2rem;
        }

        .lyrics-scroll {
          height: calc(var(--visible-lines) * var(--line-height));
          max-height: calc(var(--visible-lines) * var(--line-height));
          padding: 0 1.25rem;
          scroll-behavior: auto;
          overflow-y: auto !important;
          overflow-x: hidden;
          mask-image: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.95) 20%, rgba(0, 0, 0, 0.95) 80%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.95) 20%, rgba(0, 0, 0, 0.95) 80%, transparent 100%);
        }

        .mask-gradient {
          background: linear-gradient(to bottom, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0) 20%, rgba(0, 0, 0, 0) 80%, rgba(0, 0, 0, 0.85));
        }

        .lyric-line {
          line-height: var(--line-height);
          min-height: var(--line-height);
          text-align: center;
          transform-origin: center;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .grainy-overlay {
          position: fixed;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iNTAwIiBoZWlnaHQ9IjUwMCI+CjxmaWx0ZXIgaWQ9Im4iPgo8ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC43IiBudW1PY3RhdmVzPSIxMCIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPgo8L2ZpbHRlcj4KPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI24pIiBvcGFjaXR5PSIwLjMiLz4KPC9zdmc+');
          animation: grain 1s steps(1) infinite;
          will-change: transform;
          pointer-events: none;
        }

        .fog-effect {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 30% 40%, rgba(244, 114, 182, 0.15), transparent 50%),
                      radial-gradient(circle at 70% 60%, rgba(107, 114, 255, 0.15), transparent 50%);
          animation: fog-movement 25s ease-in-out infinite alternate;
          will-change: background-position;
          pointer-events: none;
        }

        @keyframes breath {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.03); opacity: 0.9; }
        }

        @keyframes color-shift {
          0% { text-shadow: 0 0 25px rgba(244, 114, 182, 0.3), 0 0 60px rgba(107, 114, 255, 0.3); }
          50% { text-shadow: 0 0 30px rgba(107, 114, 255, 0.35), 0 0 70px rgba(244, 114, 182, 0.35); }
          100% { text-shadow: 0 0 25px rgba(244, 114, 182, 0.3), 0 0 60px rgba(107, 114, 255, 0.3); }
        }

        @keyframes grain {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-2%, -2%); }
          20% { transform: translate(2%, 2%); }
          30% { transform: translate(-2%, 2%); }
          40% { transform: translate(2%, -2%); }
          50% { transform: translate(-2%, -2%); }
          60% { transform: translate(2%, 1%); }
          70% { transform: translate(-1%, 2%); }
          80% { transform: translate(2%, -1%); }
          90% { transform: translate(-2%, -2%); }
        }

        @keyframes fog-movement {
          from { background-position: 0% 0%, 0% 0%; }
          to { background-position: -100% -100%, 100% 100%; }
        }
      `}</style>
    </div>
  )
}
