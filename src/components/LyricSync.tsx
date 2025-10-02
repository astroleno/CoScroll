'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'

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
      
      // 提取锚字（第一个字符）
      const anchor = text.charAt(0)
      
      lyrics.push({
        time: timeInSeconds,
        text,
        anchor
      })
    }
  })
  
  return lyrics.sort((a, b) => a.time - b.time)
}

const LRC_FILE_PATH = '/lyrics/心经.lrc'

// Spotify风格的歌词同步组件
export default function LyricSync() {
  const [lyrics, setLyrics] = useState<Lyric[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const isProgrammaticScrollRef = useRef(false)
  const animationFrameRef = useRef<number | null>(null)

  // 加载歌词
  useEffect(() => {
    const loadLyrics = async () => {
      try {
        setLoadError(null)
        const resolvedUrl = (() => {
          if (typeof window === 'undefined') {
            return LRC_FILE_PATH
          }

          const basePath = window.location.origin
          const normalizedPath = LRC_FILE_PATH.startsWith('/') ? LRC_FILE_PATH : `/${LRC_FILE_PATH}`
          return `${basePath}${encodeURI(normalizedPath)}`
        })()

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

  // 自动播放音频并设置循环
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !lyrics.length) return

    // 设置循环播放
    audio.loop = true

    // 尝试自动播放
    const tryAutoPlay = () => {
      // 先设置音量，避免太大声
      audio.volume = 0.8
      
      const playPromise = audio.play()
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('✅ 自动播放成功')
          setIsPlaying(true)
        }).catch(error => {
          console.log('⚠️ 自动播放被浏览器阻止，点击播放按钮开始:', error)
        })
      }
    }

    // 多种方式尝试自动播放
    if (audio.readyState >= 3) {
      // 音频已经加载足够数据
      tryAutoPlay()
    } else {
      // 等待音频可以播放
      audio.addEventListener('canplaythrough', tryAutoPlay, { once: true })
    }

    return () => {
      audio.removeEventListener('canplaythrough', tryAutoPlay)
    }
  }, [lyrics.length])

  // 获取当前歌词
  const currentLyric = lyrics[currentLyricIndex] || lyrics[0]
  const currentAnchor = currentLyric?.anchor || '观'

  const formatTime = (time: number) => {
    if (!Number.isFinite(time) || time < 0) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const getLyricIndexForTime = useCallback((time: number) => {
    if (!lyrics.length) return 0

    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (time >= lyrics[i].time) {
        return i
      }
    }

    return 0
  }, [lyrics])

  // 音频时间更新（仅用于更新时间显示）
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !lyrics.length) return

    const updateTime = () => {
      setCurrentTime(audio.currentTime)
    }

    audio.addEventListener('timeupdate', updateTime)
    return () => audio.removeEventListener('timeupdate', updateTime)
  }, [lyrics])

  const lyricRefs = useRef<Array<HTMLParagraphElement | null>>([])

  useEffect(() => {
    // 因为我们复制了歌词（原始 + 复制），所以需要两倍的空间
    lyricRefs.current = new Array(lyrics.length * 2).fill(null)
  }, [lyrics])

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

  const scrollToLyric = useCallback((index: number, behavior: ScrollBehavior = 'smooth', attempt = 0) => {
    const container = lyricsContainerRef.current
    const target = lyricRefs.current[index]

    if (!container || !lyrics.length) return

    if (!target) {
      if (attempt < 5) {
        requestAnimationFrame(() => scrollToLyric(index, behavior, attempt + 1))
      }
      return
    }

    const scrollBehavior = attempt ? 'auto' : behavior

    // 标记这是程序触发的滚动
    isProgrammaticScrollRef.current = true
    
    requestAnimationFrame(() => {
      target.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: scrollBehavior,
      })
      
      // 滚动完成后重置标记
      setTimeout(() => {
        isProgrammaticScrollRef.current = false
      }, scrollBehavior === 'smooth' ? 500 : 50)
    })
  }, [lyrics.length])

  // 当歌词加载完成时，滚动到第一行
  useEffect(() => {
    if (lyrics.length) {
      scrollToLyric(0, 'auto')
    }
  }, [lyrics, scrollToLyric])

  // 平滑连续滚动（使用 requestAnimationFrame 实现真正的连续滚动）
  useEffect(() => {
    if (!lyrics.length) return

    const container = lyricsContainerRef.current
    const audio = audioRef.current
    if (!container || !audio) return

    const smoothScroll = () => {
      if (!isPlaying) {
        animationFrameRef.current = requestAnimationFrame(smoothScroll)
        return
      }

      const currentTime = audio.currentTime
      const lyricIndex = getLyricIndexForTime(currentTime)
      
      // 更新当前歌词索引
      if (lyricIndex !== currentLyricIndex) {
        setCurrentLyricIndex(lyricIndex)
      }

      const currentLyric = lyricRefs.current[lyricIndex]
      const nextLyric = lyricRefs.current[lyricIndex + 1]

      if (currentLyric) {
        const containerRect = container.getBoundingClientRect()
        const containerCenter = containerRect.height / 2

        let targetCenter: number

        // 如果有下一句，进行插值滚动
        if (nextLyric) {
          const currentLyricTime = lyrics[lyricIndex].time
          const nextLyricTime = lyrics[lyricIndex + 1].time
          const duration = nextLyricTime - currentLyricTime
          const progress = duration > 0 ? Math.min(1, Math.max(0, (currentTime - currentLyricTime) / duration)) : 0

          const currentRect = currentLyric.getBoundingClientRect()
          const nextRect = nextLyric.getBoundingClientRect()

          const currentCenter = currentRect.top + currentRect.height / 2 - containerRect.top
          const nextCenter = nextRect.top + nextRect.height / 2 - containerRect.top

          // 使用缓动函数让滚动更平滑
          const easeProgress = progress
          targetCenter = currentCenter + (nextCenter - currentCenter) * easeProgress
        } else {
          // 最后一句，保持居中
          const currentRect = currentLyric.getBoundingClientRect()
          targetCenter = currentRect.top + currentRect.height / 2 - containerRect.top
        }

        const scrollOffset = targetCenter - containerCenter

        // 平滑滚动到目标位置
        if (Math.abs(scrollOffset) > 0.5) {
          isProgrammaticScrollRef.current = true
          container.scrollBy({
            top: scrollOffset,
            behavior: 'auto'
          })
          
          setTimeout(() => {
            isProgrammaticScrollRef.current = false
          }, 16)
        }
      }

      // 继续下一帧动画
      animationFrameRef.current = requestAnimationFrame(smoothScroll)
    }

    // 启动动画循环
    animationFrameRef.current = requestAnimationFrame(smoothScroll)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [lyrics, isPlaying, currentLyricIndex, getLyricIndexForTime])

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!lyrics.length) return

    // 忽略非用户触发的事件
    if (!event.nativeEvent.isTrusted) {
      return
    }

    // 忽略程序触发的滚动
    if (isProgrammaticScrollRef.current) {
      return
    }

    const container = event.currentTarget
    // 获取容器的位置信息，用于计算相对位置
    const containerRect = container.getBoundingClientRect()
    const containerCenter = containerRect.top + containerRect.height / 2

    let closestIndex = currentLyricIndex
    let smallestDistance = Number.POSITIVE_INFINITY

    lyricRefs.current.forEach((item, index) => {
      if (!item) return
      // 使用 getBoundingClientRect 获取元素相对于视口的准确位置
      const itemRect = item.getBoundingClientRect()
      const itemCenter = itemRect.top + itemRect.height / 2
      // 计算元素中心与容器中心的距离
      const distance = Math.abs(itemCenter - containerCenter)
      
      if (distance < smallestDistance) {
        smallestDistance = distance
        closestIndex = index
      }
    })

    // 用户手动滚动时，同步更新音频位置和歌词索引
    if (closestIndex !== currentLyricIndex) {
      setCurrentLyricIndex(closestIndex)
      const audio = audioRef.current
      const targetLyric = lyrics[closestIndex]
      if (audio && targetLyric) {
        audio.currentTime = targetLyric.time
        setCurrentTime(targetLyric.time)
      }
    }
    // 不暂停自动滚动，立即从新位置继续
  }

  // 播放/暂停控制
  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
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

    const newIndex = getLyricIndexForTime(newTime)
    setCurrentLyricIndex(newIndex)
    
    // 自动滚动会立即从新位置继续
  }

  const rawDuration = audioRef.current?.duration ?? 0
  const safeDuration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0

  // 计算进度百分比
  const progressPercentage = safeDuration 
    ? Math.min(100, (currentTime / safeDuration) * 100) 
    : 0

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

                  {!isLoading && (
                    <>
                      {/* 顶部占位空间 - 让第一行能居中显示 */}
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
