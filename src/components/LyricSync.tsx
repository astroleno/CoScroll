'use client'
import { assetUrl } from '@/utils/assetUrl';


import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'

// 循环状态枚举
enum LoopState {
  NORMAL = 'normal',
  LOOP_JUMP = 'loop_jump',      // 正在跳跃
  LOOP_RECOVER = 'loop_recover'  // 跳跃后恢复期
}

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
      
      // 提取锚字（第一个字符），空文本则用默认字符，强制取首字符
      const anchor = ((text[0] ?? '').trim() || '观') || '观'

      lyrics.push({
        time: timeInSeconds,
        text,
        anchor
      })
    }
  })
  
  return lyrics.sort((a, b) => a.time - b.time)
}

const LRC_FILE_PATH = assetUrl('/lyrics/心经.lrc')

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
  const lastProgrammaticScrollTimeRef = useRef(0)
  const lastUserScrollTimeRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const cycleHeightRef = useRef<number>(0)
  const targetScrollTopRef = useRef(0)
  const currentScrollTopRef = useRef(0)
  const isInitializedRef = useRef(false)
  const lastScrollTopRef = useRef(0)
  const scrollVelocityRef = useRef(0)
  const isInitializingRef = useRef(false)  // 初始化保护期标志
  const loopStateRef = useRef<LoopState>(LoopState.NORMAL)  // 循环状态
  const lastAudioTimeRef = useRef(0)  // 记录上一次音频时间

  // B+C+D 方案的额外refs
  const initGuardUntilRef = useRef(0)  // 初始化保护期结束的时间戳
  const allowScrollToTimeRef = useRef(false)  // 是否允许"滚动→时间"同步

  // 常量
  const PROGRAM_SCROLL_COOLDOWN = 200  // ms，初始化后冷却（减少延迟）
  const INIT_GUARD_WINDOW = 200        // ms，初始化保护期（减少阻塞时间）

  // 加载歌词
  useEffect(() => {
    const loadLyrics = async () => {
      try {
        setLoadError(null)
        const resolvedUrl = (() => {
          if (typeof window === 'undefined') {
            return LRC_FILE_PATH
          }

          return new URL(LRC_FILE_PATH, window.location.origin).href
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

    // 🔧 修复：强制设置初始状态，确保滚动能开始
    const setupInitialState = () => {
      console.log('🔧 设置初始状态')
      lastProgrammaticScrollTimeRef.current = Date.now()
      scrollToLyric(0, 'auto')

      // 🔧 修复：即使自动播放失败，也要设置初始播放状态
      // 这样基础滚动就能工作
      setIsPlaying(true)

      // 重置控制状态
      lastUserScrollTimeRef.current = 0
      scrollVelocityRef.current = 0

      // 重置B+C+D方案的状态
      initGuardUntilRef.current = Date.now() + INIT_GUARD_WINDOW
      allowScrollToTimeRef.current = false

      console.log('🔄 初始状态设置完成')
    }

    // 尝试自动播放
    const tryAutoPlay = async () => {
       // 音频从0秒开始播放（完整音频）
       console.log('🔧 准备播放，当前时间：', audio.currentTime)

      // 先设置音量，避免太大声
      audio.volume = 0.8

      try {
        await audio.play()
         console.log('✅ 自动播放成功，当前时间：', audio.currentTime)
        setIsPlaying(true)
      } catch (error) {
        console.log('⚠️ 自动播放被浏览器阻止，但滚动功能已启用:', error)
        // 🔧 修复：即使播放失败，也不影响滚动功能
        // setIsPlaying 已经在 setupInitialState 中设置为 true
      }
    }

     // 等待音频元数据加载完成
     const onLoadedMetadata = () => {
       console.log('📊 音频元数据加载完成，时长：', audio.duration)
      setupInitialState()
     }

    // 监听元数据加载
    audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })

    // 多种方式尝试自动播放
    if (audio.readyState >= 2) {
      // 音频已经加载元数据
      onLoadedMetadata()
      if (audio.readyState >= 3) {
        tryAutoPlay()
      } else {
        audio.addEventListener('canplaythrough', tryAutoPlay, { once: true })
      }
    } else {
      // 等待音频可以播放
      audio.addEventListener('canplaythrough', tryAutoPlay, { once: true })
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('canplaythrough', tryAutoPlay)
    }
  }, [lyrics.length])

  // 获取当前歌词
  const currentLyric = lyrics[currentLyricIndex] || null
  const currentAnchor = (currentLyric?.anchor || '观').slice(0, 1)

  // 开发模式断点验证
  if (process.env.NODE_ENV === 'development') {
    // 验证关键状态
    console.assert(currentLyricIndex >= 0 && currentLyricIndex < lyrics.length,
      'Invalid currentLyricIndex', currentLyricIndex)
    console.assert(currentAnchor.length === 1,
      'Anchor must be single character', currentAnchor)
  }

  const formatTime = (time: number) => {
    if (!Number.isFinite(time) || time < 0) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const getLyricIndexForTime = useCallback((time: number) => {
    if (!lyrics.length) return 0

    let foundIndex = 0
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (time >= lyrics[i].time) {
        foundIndex = i
        break
      }
    }

    // 🔍 诊断：时间→索引映射验证
    if (process.env.NODE_ENV === 'development') {
      // 检查边界情况
      const isAtBoundary = (time === lyrics[0]?.time) || (foundIndex === lyrics.length - 1)

      if (isAtBoundary || Math.random() < 0.1) { // 10%的随机采样，避免日志过多
        console.log('🔍 [时间映射] getLyricIndexForTime诊断', {
          inputTime: time.toFixed(2),
          returnedIndex: foundIndex,
          returnedText: lyrics[foundIndex]?.text?.slice(0, 12),
          returnedTime: lyrics[foundIndex]?.time?.toFixed(2),
          timeDiff: (time - lyrics[foundIndex]?.time).toFixed(2),
          isFirstLyric: foundIndex === 0,
          isLastLyric: foundIndex === lyrics.length - 1,
          mappingAccuracy: Math.abs(time - lyrics[foundIndex]?.time).toFixed(2)
        })
      }
    }

    return foundIndex
  }, [lyrics])

  // 检测循环跳跃
  const detectLoopJump = useCallback((prevTime: number, currentTime: number) => {
    // 如果时间差为负且绝对值大于10秒，说明是循环跳跃
    const timeDiff = currentTime - prevTime
    return timeDiff < -10
  }, [])

  // 音频时间更新（仅用于更新时间显示）+ 时间窗口控制
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !lyrics.length) return

    const updateTime = () => {
      setCurrentTime(audio.currentTime)

      // 🔧 修复：时间窗口控制 - 更宽松的条件
      // 不仅等待首句时间，也允许基础滚动工作
      if (!allowScrollToTimeRef.current) {
        const firstLyricTime = lyrics[0]?.time || 0
        if (audio.currentTime >= firstLyricTime || audio.currentTime === 0) {
          allowScrollToTimeRef.current = true
          console.log('🔓 时间窗口已开放，允许滚动→时间同步', {
            currentTime: audio.currentTime.toFixed(2),
            firstLyricTime: firstLyricTime.toFixed(2)
          })
        }
      }
    }

    audio.addEventListener('timeupdate', updateTime)
    return () => audio.removeEventListener('timeupdate', updateTime)
  }, [lyrics])

  const lyricRefs = useRef<Array<HTMLParagraphElement | null>>([])

  useEffect(() => {
    // 因为我们复制了歌词（原始 + 复制），所以需要两倍的空间
    lyricRefs.current = new Array(lyrics.length * 2).fill(null)
  }, [lyrics])

  // 计算一个完整循环的高度（原始列表高度）
  useEffect(() => {
    const firstOriginal = lyricRefs.current[0]
    const firstDuplicate = lyricRefs.current[lyrics.length]
    if (firstOriginal && firstDuplicate) {
      // 两者 offsetTop 差值即一个循环的高度
      cycleHeightRef.current = firstDuplicate.offsetTop - firstOriginal.offsetTop
    }

    // 🔧 诊断：验证滚动容器设置
    const container = lyricsContainerRef.current
    if (container && process.env.NODE_ENV === 'development') {
      console.log('🔍 [诊断] 滚动容器设置验证', {
        containerExists: !!container,
        containerHeight: container.clientHeight,
        containerScrollHeight: container.scrollHeight,
        canScroll: container.scrollHeight > container.clientHeight,
        overflowComputed: getComputedStyle(container).overflowY,
        cssHeight: getComputedStyle(container).height,
        cssMaxHeight: getComputedStyle(container).maxHeight,
        firstLyricExists: !!lyricRefs.current[0],
        lyricsCount: lyrics.length
      })
    }
  }, [lyrics])

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

    // 记录程序触发滚动的时间戳
    lastProgrammaticScrollTimeRef.current = Date.now()

    // 🔧 修复：使用直接scrollTop设置，避免scrollIntoView的副作用
    requestAnimationFrame(() => {
      const containerHeight = container.clientHeight
      const containerCenter = containerHeight / 2
      const targetOffset = target.offsetTop - containerCenter

      container.scrollTop = targetOffset

      // 同步内部refs
      targetScrollTopRef.current = targetOffset
      currentScrollTopRef.current = targetOffset

      console.log('🎯 scrollToLyric直接设置滚动位置', {
        index,
        text: lyrics[index]?.text?.slice(0, 8),
        targetOffset: targetOffset.toFixed(2),
        containerHeight: containerHeight.toFixed(2)
      })
    })
  }, [lyrics.length])

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

  // 移除初始滚动调用，避免与平滑滚动 useEffect 竞争
  // useEffect(() => {
  //   if (lyrics.length) {
  //     scrollToLyric(0, 'auto')
  //   }
  // }, [lyrics, scrollToLyric])

  // 平滑连续滚动（使用 requestAnimationFrame 实现真正的连续滚动）
  useEffect(() => {
    if (!lyrics.length) return

    const container = lyricsContainerRef.current
    const audio = audioRef.current
    if (!container || !audio) return

     // 初始化完成

    const smoothScroll = () => {
      // 检查 refs 是否已准备好
      if (!lyricRefs.current[0]) {
        // Refs 还未准备好，等待下一帧
        animationFrameRef.current = requestAnimationFrame(smoothScroll)
        return
      }

       // 只在第一次且 refs 准备好时初始化滚动位置
      if (!isInitializedRef.current) {
        lastProgrammaticScrollTimeRef.current = Date.now()
        isInitializedRef.current = true
        setCurrentLyricIndex(0)
        scrollToLyric(0, 'auto')
        console.log('🔧 初始化：程序滚动到第一句并居中')
      }

      // 🔧 修复：即使音频未播放，也要进行基础滚动（歌词居中）
      // 这样用户可以看到歌词，即使音频没有自动播放
      const shouldDoBasicScroll = !isPlaying && lyricRefs.current[0]

      // 如果是基础滚动模式，只居中当前歌词
      if (shouldDoBasicScroll) {
        const currentLyric = lyricRefs.current[currentLyricIndex]
        if (currentLyric && container) {
          const containerHeight = container.clientHeight
          const containerCenter = containerHeight / 2
          const targetOffset = currentLyric.offsetTop - containerCenter

          // 直接设置滚动位置，不使用缓动
          container.scrollTop = targetOffset
          console.log('🔧 基础滚动：居中歌词', {
            index: currentLyricIndex,
            text: lyrics[currentLyricIndex]?.text?.slice(0, 8)
          })
        }
        animationFrameRef.current = requestAnimationFrame(smoothScroll)
        return
      }

      // 只有在播放状态才执行完整的滚动逻辑
      if (!isPlaying) {
        animationFrameRef.current = requestAnimationFrame(smoothScroll)
        return
      }

      // 统一的歌词索引计算逻辑
      const currentTime = audio.currentTime

      // 检测循环跳跃
      if (detectLoopJump(lastAudioTimeRef.current, currentTime)) {
        console.log('🔄 检测到循环跳跃', {
          from: lastAudioTimeRef.current.toFixed(2),
          to: currentTime.toFixed(2)
        })
        loopStateRef.current = LoopState.LOOP_JUMP
        // 循环跳跃后启动恢复期
        setTimeout(() => {
          loopStateRef.current = LoopState.LOOP_RECOVER
          console.log('🔁 进入循环恢复期')
          setTimeout(() => {
            loopStateRef.current = LoopState.NORMAL
            console.log('✅ 循环恢复期结束，回到正常状态')
          }, 2000)
        }, 500)
      }

      lastAudioTimeRef.current = currentTime

      // 计算当前歌词索引
      const effectiveLyricIndex = (loopStateRef.current === LoopState.LOOP_JUMP) ? 0 : getLyricIndexForTime(currentTime)

      // 更新当前歌词索引（使用 state，确保渲染一致性）
      if (effectiveLyricIndex !== currentLyricIndex) {
        console.log('🎵 RAF更新歌词索引', {
          audioTime: currentTime.toFixed(2),
          oldIndex: currentLyricIndex,
          newIndex: effectiveLyricIndex,
          loopState: loopStateRef.current
        })
        setCurrentLyricIndex(effectiveLyricIndex)
      }

      // 获取当前歌词元素
      const actualLyricIndex = effectiveLyricIndex
      const currentLyric = lyricRefs.current[actualLyricIndex]

      if (!currentLyric) {
        animationFrameRef.current = requestAnimationFrame(smoothScroll)
        return
      }

      // 下一句可能是原始部分的下一句，或者是复制部分的第一句
      let nextLyric: HTMLParagraphElement | null
      let nextLyricIndex: number

      if (actualLyricIndex < lyrics.length - 1) {
        // 不是最后一句，下一句在原始部分
        nextLyric = lyricRefs.current[actualLyricIndex + 1]
        nextLyricIndex = actualLyricIndex + 1
      } else {
        // 是最后一句，下一句是复制部分的第一句（实现无限循环）
        nextLyric = lyricRefs.current[lyrics.length] // 复制部分的第一句
        nextLyricIndex = 0 // 实际对应第一句歌词
      }

      // 智能检测用户滚动状态
      const now = Date.now()
      const timeSinceUserScroll = now - lastUserScrollTimeRef.current
      const currentScrollTop = container.scrollTop
      const scrollDelta = Math.abs(currentScrollTop - lastScrollTopRef.current)
      
      // 更新滚动速度
      scrollVelocityRef.current = scrollDelta
      lastScrollTopRef.current = currentScrollTop
      
      // 基于滚动速度和时间的智能判断 - 进一步优化敏感度
      const isUserScrolling = timeSinceUserScroll < 300 || scrollVelocityRef.current > 8

      // 如果用户正在滚动，完全跳过自动滚动
      if (isUserScrolling) {
        console.log('🚫 用户滚动中，跳过自动滚动', { 
          timeSince: timeSinceUserScroll, 
          velocity: scrollVelocityRef.current 
        })
        animationFrameRef.current = requestAnimationFrame(smoothScroll)
        return
      }

      // 只有在非用户滚动时才执行自动滚动
      if (currentLyric && nextLyric) {
        // 缓存容器尺寸，减少重复计算
        const containerHeight = container.clientHeight
        const containerCenter = containerHeight / 2

        const currentLyricTime = lyrics[actualLyricIndex].time
        const nextLyricTime = lyrics[nextLyricIndex].time
        const duration = nextLyricTime - currentLyricTime
        // 循环跳跃期间，progress固定为0
        const progress = (loopStateRef.current === LoopState.LOOP_JUMP) ? 0 : (duration > 0 ? Math.min(1, Math.max(0, (currentTime - currentLyricTime) / duration)) : 0)

        // 使用 offsetTop 而非 getBoundingClientRect，性能更好
        const currentOffset = currentLyric.offsetTop
        const nextOffset = nextLyric.offsetTop

        // 计算目标滚动位置
        const targetOffset = currentOffset + (nextOffset - currentOffset) * progress
        targetScrollTopRef.current = targetOffset - containerCenter

         // 缓动平滑滚动（lerp 线性插值）- 每帧执行，不节流
         const easeFactor = 0.12 // 缓动系数，增加到0.12提升响应速度
         currentScrollTopRef.current += (targetScrollTopRef.current - currentScrollTopRef.current) * easeFactor

        // 同步到实际滚动位置（记录时间戳）
        lastProgrammaticScrollTimeRef.current = now
        container.scrollTop = currentScrollTopRef.current
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
  }, [lyrics, isPlaying, currentLyricIndex, getLyricIndexForTime, scrollToLyric, detectLoopJump])

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!lyrics.length) return

    // 忽略非用户触发的事件
    if (!event.nativeEvent.isTrusted) {
      return
    }

    // 首句前禁止"滚动→时间"同步
    const audio = audioRef.current
    if (!audio) return
    if (audio.currentTime < lyrics[0].time) {
      console.log('🚫 首句时间未到，禁止滚动→时间同步', {
        currentTime: audio.currentTime,
        firstLyricTime: lyrics[0].time
      })
      return
    }

    // B+C+D 方案：三重早退机制
    const now = Date.now()

    // a) 初始化保护期内：忽略滚动
    if (now < initGuardUntilRef.current) {
      console.log('🚫 初始化保护期内，忽略滚动', {
        now,
        guardUntil: initGuardUntilRef.current
      })
      return
    }

    // b) 程序性滚动冷却期：忽略滚动
    const timeSinceLastProgrammaticScroll = now - lastProgrammaticScrollTimeRef.current
    if (timeSinceLastProgrammaticScroll < PROGRAM_SCROLL_COOLDOWN) {
      console.log('🚫 程序滚动冷却期内，忽略滚动', {
        timeSince: timeSinceLastProgrammaticScroll,
        cooldown: PROGRAM_SCROLL_COOLDOWN
      })
      return
    }

    // c) 首句时间未到：暂不允许"滚动→时间"
    if (!allowScrollToTimeRef.current) {
      console.log('🚫 时间窗口未开放，忽略滚动')
      return
    }

     const container = event.currentTarget
     
     // 记录用户滚动时间和速度
     lastUserScrollTimeRef.current = now
     const currentScrollTop = container.scrollTop
     const scrollDelta = Math.abs(currentScrollTop - lastScrollTopRef.current)
     scrollVelocityRef.current = scrollDelta
     lastScrollTopRef.current = currentScrollTop
     
     console.log('👆 用户开始滚动，暂停自动滚动', { 
       scrollDelta, 
       velocity: scrollVelocityRef.current,
       timeSince: timeSinceLastProgrammaticScroll 
     })
     
    const containerScrollTop = container.scrollTop
    const containerHeight = container.clientHeight
    const containerCenter = containerScrollTop + containerHeight / 2

    let closestIndex = currentLyricIndex
    let smallestDistance = Number.POSITIVE_INFINITY

    // 开发模式断点验证
    if (process.env.NODE_ENV === 'development') {
      console.assert(lyricRefs.current[0] !== null, 'First lyric ref is null')
      const timeSince = Date.now() - lastProgrammaticScrollTimeRef.current
      console.assert(timeSince >= PROGRAM_SCROLL_COOLDOWN,
        'Program scroll cooldown violated', timeSince)
    }

    // 只检查原始歌词部分（不包括复制部分）
    const lyricCount = lyrics.length
    for (let i = 0; i < lyricCount; i++) {
      const item = lyricRefs.current[i]
      if (!item) continue
      // 使用元素中心而非顶部，提高命中准确性
      const itemCenter = item.offsetTop + item.offsetHeight / 2
      const distance = Math.abs(itemCenter - containerCenter)

      if (distance < smallestDistance) {
        smallestDistance = distance
        closestIndex = i
      }

      // 开发模式：调试命中行匹配
      if (process.env.NODE_ENV === 'development') {
        if (i === currentLyricIndex || distance < 50) {
          console.log('🎯 元素匹配调试', {
            index: i,
            text: lyrics[i]?.text?.slice(0, 8) + '...',
            containerCenter: containerCenter.toFixed(2),
            itemTop: item.offsetTop.toFixed(2),
            itemHeight: item.offsetHeight.toFixed(2),
            itemCenter: itemCenter.toFixed(2),
            distance: distance.toFixed(2),
            isClosest: distance < smallestDistance
          })
        }
      }
    }

    // 开发模式：显示最终匹配结果
    if (process.env.NODE_ENV === 'development') {
      console.log('📍 最终匹配结果', {
        selectedIndex: closestIndex,
        selectedText: lyrics[closestIndex]?.text?.slice(0, 12) + '...',
        smallestDistance: smallestDistance.toFixed(2),
        containerCenter: containerCenter.toFixed(2),
        currentLyricIndex: currentLyricIndex,
        willTriggerSync: closestIndex !== currentLyricIndex
      })
    }

    // 🔍 深度诊断：检查DOM元素与数组的对应关系
    if (process.env.NODE_ENV === 'development' && closestIndex !== currentLyricIndex) {
      console.log('🔍 [诊断] 滚动→时间同步偏差分析', {
        // 当前状态
        currentLyricIndex,
        currentLyricText: lyrics[currentLyricIndex]?.text?.slice(0, 8),

        // 目标状态
        targetIndex: closestIndex,
        targetLyricText: lyrics[closestIndex]?.text?.slice(0, 8),
        targetTime: lyrics[closestIndex]?.time?.toFixed(2),

        // DOM元素信息
        domElementCount: lyricRefs.current.length,
        lyricsArrayLength: lyrics.length,

        // 容器信息
        containerScrollTop: containerScrollTop.toFixed(2),
        containerCenter: containerCenter.toFixed(2),

        // 距离分析
        smallestDistance: smallestDistance.toFixed(2),

        // 索引映射验证
        indexMapping: {
          'currentLyricIndex': currentLyricIndex,
          'closestIndex': closestIndex,
          'difference': closestIndex - currentLyricIndex,
          'isExpectedBehavior': Math.abs(closestIndex - currentLyricIndex) === 1
        }
      })

      // 验证DOM元素与数组元素的一致性
      if (lyricRefs.current[closestIndex]) {
        const domElement = lyricRefs.current[closestIndex]
        const domText = domElement.textContent?.slice(0, 8)
        const arrayText = lyrics[closestIndex]?.text?.slice(0, 8)
        console.log('🔍 [诊断] DOM与数组一致性检查', {
          domText,
          arrayText,
          isMatch: domText === arrayText,
          domElementIndex: closestIndex,
          arrayIndex: closestIndex
        })
      }
    }

     // 用户手动滚动时，同步更新音频位置和歌词索引
     if (closestIndex !== currentLyricIndex) {
       const targetLyric = lyrics[closestIndex]

       // 🔍 诊断：-1偏移模式检测
       const indexDifference = closestIndex - currentLyricIndex
       const isNegativeOneOffset = indexDifference === -1

       console.log('🎯 滚动同步：', {
         from: currentLyricIndex,
         to: closestIndex,
         fromText: lyrics[currentLyricIndex]?.text,
         toText: targetLyric?.text,
         targetTime: targetLyric?.time.toFixed(2),
         indexDifference,
         isNegativeOneOffset,
         offsetPattern: isNegativeOneOffset ? '🚨 检测到-1偏移模式' : '正常偏移'
       })

       // 🔍 诊断：详细的时间映射分析
       if (process.env.NODE_ENV === 'development' && isNegativeOneOffset) {
         console.log('🔍 [关键诊断] -1偏移详细分析', {
           '用户滚动到': {
             index: closestIndex,
             text: targetLyric?.text?.slice(0, 12),
             time: targetLyric?.time?.toFixed(2)
           },
           '当前音频时间': {
             index: currentLyricIndex,
             text: lyrics[currentLyricIndex]?.text?.slice(0, 12),
             time: lyrics[currentLyricIndex]?.time?.toFixed(2)
           },
           '预期行为': '应该同步到目标索引的时间',
           '实际行为': `将要同步到索引${closestIndex}，但可能存在算法偏差`,
           '问题假设': [
             '1. centeredIndex算法计算错误',
             '2. DOM元素与lyrics数组不对应',
             '3. 时间映射逻辑存在off-by-one',
             '4. 滚动事件处理时序问题'
           ]
         })
       }

       const audio = audioRef.current
       if (audio && targetLyric) {
         const oldTime = audio.currentTime
         const newTime = targetLyric.time

         audio.currentTime = newTime
         setCurrentTime(newTime)
         setCurrentLyricIndex(closestIndex)

         // 🔍 诊断：时间同步验证
         if (process.env.NODE_ENV === 'development' && isNegativeOneOffset) {
           console.log('🔍 [时间同步] 音频时间变更', {
             oldTime: oldTime.toFixed(2),
             newTime: newTime.toFixed(2),
             timeDifference: (newTime - oldTime).toFixed(2),
             syncedLyricIndex: closestIndex,
             syncedLyricText: targetLyric?.text?.slice(0, 12)
           })
         }

         // 计算并同步目标滚动位置
         const targetElement = lyricRefs.current[closestIndex]
         if (targetElement) {
           const containerHeight = container.clientHeight
           const containerCenter = containerHeight / 2
           const targetOffset = targetElement.offsetTop - containerCenter
           targetScrollTopRef.current = targetOffset
           currentScrollTopRef.current = targetOffset
         }
       }
     }
  }

  // 播放/暂停控制
  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      console.log('⏸️ 暂停播放')
    } else {
      // 播放逻辑优化：先标记程序滚动再居中
      console.log('▶️ 开始播放，当前时间：', audio.currentTime)
      lastProgrammaticScrollTimeRef.current = Date.now()
      scrollToLyric(0, 'auto')

      // 先标记程序滚动，再居中，让随后的 onScroll 被冷却窗屏蔽
      lastProgrammaticScrollTimeRef.current = Date.now()
      scrollToLyric(0, 'auto')

      // 重置控制状态
      lastUserScrollTimeRef.current = 0
      scrollVelocityRef.current = 0

      // 重置B+C+D方案的状态
      initGuardUntilRef.current = Date.now() + INIT_GUARD_WINDOW
      allowScrollToTimeRef.current = false

      console.log('🔄 播放重置，B+C+D状态已更新')

      audio.play().then(() => {
        console.log('✅ 播放开始，实际时间：', audio.currentTime)
      })
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

    // 计算并同步目标滚动位置（标记为程序滚动）
    const targetElement = lyricRefs.current[newIndex]
    const container = lyricsContainerRef.current
    if (targetElement && container) {
      const containerHeight = container.clientHeight
      const containerCenter = containerHeight / 2
      const targetOffset = targetElement.offsetTop - containerCenter
      targetScrollTopRef.current = targetOffset
      currentScrollTopRef.current = targetOffset

      // 标记为程序性滚动
      lastProgrammaticScrollTimeRef.current = Date.now()
      container.scrollTop = targetOffset

      console.log('🎯 进度条点击，程序滚动到歌词', { newIndex })
    }
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
                          {lyric.text || '♪'}
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
                          {lyric.text || '♪'}
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
