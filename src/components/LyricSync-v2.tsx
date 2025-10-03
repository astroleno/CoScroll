'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// 歌词数据类型
interface Lyric {
  time: number
  text: string
  anchor: string
}

// 解析LRC文件格式的函数
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

      // 锚字一位截断（解析时双保险）
      const anchor = text ? text[0] : '观'

      lyrics.push({
        time: timeInSeconds,
        text,
        anchor
      })
    }
  })

  return lyrics.sort((a, b) => a.time - b.time)
}

// 常量定义
const PROGRAM_SCROLL_COOLDOWN = 300  // 程序滚动冷却时间（ms）
const WRAP_COOLDOWN = 300  // 回绕窗口冷却时间（ms）
const WRAP_EPS = 0.5  // 回绕检测阈值（秒）
const LRC_FILE_PATH = '/lyrics/心经.lrc'

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

  // 加载歌词
  useEffect(() => {
    const loadLyrics = async () => {
      try {
        setLoadError(null)
        const resolvedUrl = `${window.location.origin}${encodeURI(LRC_FILE_PATH)}`
        const response = await fetch(resolvedUrl, { cache: 'no-store' })

        if (!response.ok) {
          throw new Error(`加载歌词失败：${response.status}`)
        }

        const lrcContent = await response.text()
        const parsedLyrics = parseLRC(lrcContent)
        setLyrics(parsedLyrics)
        setCurrentLyricIndex(0)
      } catch (error) {
        console.error(error)
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

  // 滚动归一化函数：实现真正无缝循环
  const normalizeScrollPosition = useCallback(() => {
    const container = lyricsContainerRef.current
    if (!container || !lyrics.length) return

    const firstOriginal = lyricRefs.current[0]
    const firstDuplicate = lyricRefs.current[lyrics.length]
    const cycleHeight = cycleHeightRef.current

    if (!firstOriginal || !firstDuplicate || cycleHeight <= 0) return

    const baseTop = firstOriginal.offsetTop
    const currentScrollTop = container.scrollTop
    let normalized = currentScrollTop - baseTop

    // 向下滚动归一化：保持在 [0, cycleHeight) 区间
    if (normalized >= cycleHeight) {
      normalized = normalized % cycleHeight
      lastProgrammaticScrollTimeRef.current = Date.now()
      container.scrollTop = baseTop + normalized
      console.log('🔄 滚动归一化（向下）', {
        originalScrollTop: currentScrollTop,
        normalizedScrollTop: baseTop + normalized,
        cycleHeight
      })
    } else if (normalized < 0) {
      // 防御性处理：避免向上越界
      normalized = ((normalized % cycleHeight) + cycleHeight) % cycleHeight
      lastProgrammaticScrollTimeRef.current = Date.now()
      container.scrollTop = baseTop + normalized
      console.log('🔄 滚动归一化（向上）', {
        originalScrollTop: currentScrollTop,
        normalizedScrollTop: baseTop + normalized,
        cycleHeight
      })
    }
  }, [lyrics.length])

  // 平滑滚动到指定歌词
  const scrollToLyric = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const container = lyricsContainerRef.current
    const target = lyricRefs.current[index]

    if (!container || !target || index < 0) return

    // 记录程序触发滚动的时间戳
    lastProgrammaticScrollTimeRef.current = Date.now()

    requestAnimationFrame(() => {
      target.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior,
      })
    })
  }, [])

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
        // 初始滚动到第一句
        scrollToLyric(0, 'auto')
      } catch (error) {
        console.log('⚠️ 自动播放被浏览器阻止，点击播放按钮开始:', error)
      }
    }

    if (audio.readyState >= 3) {
      tryAutoPlay()
    } else {
      audio.addEventListener('canplaythrough', tryAutoPlay, { once: true })
    }

    return () => {
      audio.removeEventListener('canplaythrough', tryAutoPlay)
    }
  }, [lyrics.length, scrollToLyric])

  // 循环高度计算：在DOM渲染完成后计算原始与克隆列表的高度差
  useEffect(() => {
    if (!lyrics.length) return

    const calculateCycleHeight = () => {
      const firstOriginal = lyricRefs.current[0]
      const firstDuplicate = lyricRefs.current[lyrics.length]

      if (firstOriginal && firstDuplicate) {
        const height = firstDuplicate.offsetTop - firstOriginal.offsetTop
        cycleHeightRef.current = height
        console.log('📏 循环高度计算完成', {
          firstOriginalOffsetTop: firstOriginal.offsetTop,
          firstDuplicateOffsetTop: firstDuplicate.offsetTop,
          cycleHeight: height
        })
      }
    }

    // 延迟计算，确保DOM完全渲染
    const timer = setTimeout(calculateCycleHeight, 100)
    return () => clearTimeout(timer)
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

    // 再视觉：强制滚动到原始列表第0行（确保归一化）
    const container = lyricsContainerRef.current
    const firstOriginal = lyricRefs.current[0]
    if (container && firstOriginal && cycleHeightRef.current > 0) {
      // 直接设置 scrollTop 到原始第0行的正确位置
      const baseTop = firstOriginal.offsetTop
      const targetScrollTop = baseTop // 确保在原始带的正确位置

      lastProgrammaticScrollTimeRef.current = Date.now()
      container.scrollTop = targetScrollTop

      console.log('📍 强制滚动到原始列表第0行（归一化）', {
        targetScrollTop,
        baseTop,
        cycleHeight: cycleHeightRef.current
      })
    }

    // 最后时间：确保音频从0开始
    const audio = audioRef.current
    if (audio && audio.currentTime > WRAP_EPS) {
      audio.currentTime = 0
    }

    // 3. 退出回绕窗口（延迟）
    setTimeout(() => {
      isLoopingRef.current = false
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

        // 自动滚动到当前歌词（时间→滚动）
        if (!isUserScrolling()) {
          scrollToLyric(newIndex, 'smooth')
        }
      }
    }

    audio.addEventListener('timeupdate', updateTime)
    return () => audio.removeEventListener('timeupdate', updateTime)
  }, [lyrics, allowScrollToTime, currentLyricIndex, indexForTime, scrollToLyric, handleLoopReset])

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

    // 🔄 首先执行滚动归一化（关键！）
    normalizeScrollPosition()

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
    } else {
      audio.play()
      setIsPlaying(true)

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
    <div className="min-h-screen bg-black text-gray-300 antialiased">
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
        src="/audio/心经.mp3"
        preload="metadata"
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
          overflow-y: scroll;
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