// LyricsSync-v3 基础版（单文件示例）
// 说明：
// 1) 这是一个最小可运行的基础实现，包含：主时钟/吸附器/USER_SCRUB 子态/LOOP_COOLING/滚动归一化/简单 UI。
// 2) 结构按你前文的契约裁剪到单文件，便于快速粘贴与改造。后续你可拆分到 /AudioEngine.ts、/Timeline.ts 等。
// 3) 不引入外部状态库；仅用 React Hooks + 原生 Audio。
// 4) 重点在“架构骨架”和“参数面板”，方便你标定。

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// -----------------------------
// 配置（与我们讨论的工程版一致，数值可改）
// -----------------------------
const CFG = {
  ADHESION: {
    TARGET_SETTLE_MS: 240,
    DAMPING_RATIO: 0.9,
    TOLERANCE: { HARD: 180, SOFT_HI: 50, SOFT_LO: 12, FREEZE: 8 },
    DELTA_CLAMP: { MAX_DT: 33, MIN_DT: 8, MAX_SCROLL_PROGRESS: 0.5 },
  },
  LOOP_COOLING: {
    MAIN_RATIO: 0.4,
    MINOR_RATIO: 0.2,
    BASE_DURATION: 200,
    MIN_DURATION: 100,
    MAX_DURATION: 300,
    WRAP_WINDOW: 120,
    DIRECTION_FLIP_THRESHOLD: 2,
  },
  USER_SCRUB: {
    ACTIVE_TIMEOUT: 100,
    INERTIA_DECAY_TAU: 150,
    MIN_VELOCITY: 0.1,
    DIRECTION_HOLD_THRESHOLD: 0.05,
  },
  MONITORING: { SAMPLE_HZ: 30, WINDOW_MS: 5000, STABLE_FRAMES: 3, ENABLE_PERF_LOGS: false },
  ACCEPTANCE: { SYNC_ERROR_P95: 25, SYNC_ERROR_MAX: 60, IDLE_TRANSITION_MS: 400, AUTO_TRANSITION_MS: 800, MIN_DIRECTION_DELTA: 0.1 },
}

// -----------------------------
// 类型声明
// -----------------------------
type SyncState = 'AUTO_PLAY' | 'USER_SCRUB' | 'IDLE_AUTO' | 'LOOP_COOLING'

type LyricLine = {
  time: number;
  text: string;
  anchor?: string;
  importance?: 'primary' | 'secondary' | 'tertiary';
}

type NormalizedScrollDelta = {
  value: number // s（时间等效位移，正负代表方向）
  direction: 1 | -1 | 0
  timestamp: number
  source: 'wheel' | 'touch' | 'pointer'
}

// 锚字重要性级别
type AnchorImportance = 'primary' | 'secondary' | 'tertiary'

// -----------------------------
// 心经真实数据（来自 /public/lyrics/心经.lrc）
// 锚字选择原则：选择每句中最重要的汉字，通常是佛学核心概念
// 重要性级别：primary（核心概念）> secondary（重要概念）> tertiary（辅助概念）
// -----------------------------
const HEART_SUTRA_LYRICS: LyricLine[] = [
  { time: 11.840, text: '观自在菩萨', anchor: '观', importance: 'primary' },
  { time: 18.680, text: '行深般若波罗蜜多时', anchor: '般', importance: 'primary' },
  { time: 28.870, text: '照见五蕴皆空', anchor: '照', importance: 'primary' },
  { time: 36.790, text: '度一切苦厄', anchor: '度', importance: 'primary' },
  { time: 49.280, text: '舍利子', anchor: '舍', importance: 'primary' },
  { time: 52.530, text: '色不异空 空不异色', anchor: '色', importance: 'primary' },
  { time: 63.470, text: '色即是空 空即是色', anchor: '空', importance: 'primary' },
  { time: 74.040, text: '受想行识 亦复如是', anchor: '受', importance: 'secondary' },
  { time: 91.220, text: '舍利子 是诸法空相', anchor: '相', importance: 'primary' },
  { time: 98.880, text: '不生不灭不垢不净不增不减', anchor: '不', importance: 'primary' },
  { time: 106.770, text: '是故空中无色', anchor: '无', importance: 'primary' },
  { time: 112.070, text: '无受想行识', anchor: '识', importance: 'secondary' },
  { time: 115.330, text: '无眼耳鼻舌身意', anchor: '眼', importance: 'secondary' },
  { time: 118.710, text: '无色声香味触法', anchor: '声', importance: 'secondary' },
  { time: 125.140, text: '无眼界 乃至无意识界', anchor: '界', importance: 'secondary' },
  { time: 132.160, text: '无无明 亦无无明尽', anchor: '明', importance: 'primary' },
  { time: 140.500, text: '乃至无老死 亦无老死尽', anchor: '死', importance: 'primary' },
  { time: 147.050, text: '无苦集灭道 无智亦无得', anchor: '苦', importance: 'primary' },
  { time: 167.070, text: '以无所得故 菩提萨陲', anchor: '得', importance: 'primary' },
  { time: 189.130, text: '依般若波罗蜜多故 心无挂碍', anchor: '心', importance: 'primary' },
  { time: 199.590, text: '无挂碍故 无有恐怖', anchor: '恐', importance: 'secondary' },
  { time: 204.610, text: '远离颠倒梦想 究竟涅盘', anchor: '远', importance: 'primary' },
  { time: 213.060, text: '三世诸佛 依般若波罗蜜多故', anchor: '佛', importance: 'primary' },
  { time: 221.270, text: '得阿耨多罗三藐三菩提', anchor: '阿', importance: 'primary' },
  { time: 233.080, text: '故知般若波罗蜜多', anchor: '般', importance: 'primary' },
  { time: 237.420, text: '是大神咒 是大明咒', anchor: '咒', importance: 'primary' },
  { time: 240.710, text: '是无上咒 是无等等咒', anchor: '上', importance: 'primary' },
  { time: 244.570, text: '能除一切苦 真实不虚', anchor: '除', importance: 'primary' },
  { time: 287.910, text: '故说般若波罗蜜多咒', anchor: '说', importance: 'secondary' },
  { time: 302.270, text: '即说咒曰', anchor: '曰', importance: 'tertiary' },
  { time: 306.620, text: '揭谛揭谛 波罗揭谛', anchor: '揭', importance: 'primary' },
  { time: 348.800, text: '波罗僧揭谛 菩提娑婆诃', anchor: '菩', importance: 'primary' },
]

// 默认使用心经数据，保持向后兼容
const DEMO_LYRICS = HEART_SUTRA_LYRICS
const DEMO_DURATION = 350 // 心经实际音频时长约 5分48秒 (348.8秒)，为循环效果设置为 350 秒
const DEMO_AUDIO = '/audio/心经.mp3' // 心经音频文件路径

// -----------------------------
// 工具：环形时间轴 wrap()
// -----------------------------
function wrapTime(t: number, dur: number) {
  return ((t % dur) + dur) % dur
}

// -----------------------------
// 工具：基于目标收敛时间推 k（简化）
// 目标：95% 误差在 TARGET_SETTLE_MS 内消散；ζ≈0.9。
// 这里给出经验公式：k ≈ c / TARGET_SETTLE_MS，c 取 30–50 的经验值。
// 具体你可替换为更严谨的阻尼二阶系统推导。
// -----------------------------
function deriveSpringK(targetSettleMs: number) {
  const c = 40
  return c / Math.max(120, targetSettleMs) // 防止过大
}

// -----------------------------
// AudioEngine（增强版，支持无限循环、错误处理、重试机制）
// - 若 audioUrl 为空，则使用"假时钟"（内部累加 currentTime）
// - 支持无限循环播放、自动重试、缓冲监控、错误恢复
// -----------------------------
function useAudioEngine(audioUrl?: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [ready, setReady] = useState(false)
  const [usingFake, setUsingFake] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bufferHealth, setBufferHealth] = useState(100)
  const [retryCount, setRetryCount] = useState(0)
  const fakeClockRef = useRef({ t: 0, playing: true })
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const checkBufferIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 配置
  const MAX_RETRIES = 3
  const RETRY_DELAY_BASE = 1000 // Base delay in ms
  const BUFFER_CHECK_INTERVAL = 500 // Check buffer every 500ms

  // 清理函数
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    if (checkBufferIntervalRef.current) {
      clearInterval(checkBufferIntervalRef.current)
      checkBufferIntervalRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeEventListener('error', handleError)
      audioRef.current.removeEventListener('stalled', handleStalled)
      audioRef.current.removeEventListener('abort', handleAbort)
      audioRef.current.removeEventListener('waiting', handleWaiting)
      audioRef.current.removeEventListener('canplay', handleCanPlay)
      audioRef.current.removeEventListener('ended', handleEnded)
      audioRef.current.removeEventListener('timeupdate', handleTimeUpdate)
      audioRef.current.removeEventListener('progress', handleProgress)
      audioRef.current = null
    }
  }, [])

  // 错误处理函数
  const handleError = useCallback((e: Event) => {
    console.error('Audio error:', e)
    const audioEl = audioRef.current
    if (!audioEl) return

    let errorMessage = 'Audio playback error'
    if (audioEl.error) {
      switch (audioEl.error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = 'Audio playback was aborted'
          break
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error occurred while loading audio'
          break
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = 'Audio decoding failed'
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Audio format not supported'
          break
        default:
          errorMessage = `Audio error: ${audioEl.error.message}`
      }
    }

    setError(errorMessage)
    setReady(false)

    // 重试逻辑
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount) // Exponential backoff
      retryTimeoutRef.current = setTimeout(() => {
        console.log(`Retrying audio load (attempt ${retryCount + 1}/${MAX_RETRIES})`)
        setRetryCount(prev => prev + 1)
        initAudio()
      }, delay)
    } else {
      console.error('Max retries reached, falling back to fake clock')
      setUsingFake(true)
      setReady(true)
      setError(null)
    }
  }, [retryCount])

  const handleStalled = useCallback(() => {
    console.warn('Audio playback stalled')
    setError('Audio playback stalled')
  }, [])

  const handleAbort = useCallback(() => {
    console.warn('Audio playback aborted')
    setError('Audio playback aborted')
  }, [])

  const handleWaiting = useCallback(() => {
    console.warn('Audio waiting for data')
    setLoading(true)
  }, [])

  const handleCanPlay = useCallback(() => {
    console.log('Audio can play')
    setReady(true)
    setLoading(false)
    setError(null)
    setRetryCount(0)
  }, [])

  const handleEnded = useCallback(() => {
    console.log('Audio ended, restarting for infinite loop')
    const audioEl = audioRef.current
    if (audioEl) {
      // 无缝循环：立即重新开始播放
      audioEl.currentTime = 0
      audioEl.play().catch(err => {
        console.error('Failed to restart audio loop:', err)
        setError('Failed to restart audio loop')
      })
    }
  }, [])

  const handleTimeUpdate = useCallback(() => {
    // 可以在这里添加时间同步逻辑
  }, [])

  const handleProgress = useCallback(() => {
    const audioEl = audioRef.current
    if (audioEl && audioEl.buffered.length > 0) {
      const bufferedEnd = audioEl.buffered.end(audioEl.buffered.length - 1)
      const duration = audioEl.duration || 1
      const health = (bufferedEnd / duration) * 100
      setBufferHealth(Math.min(100, Math.max(0, health)))
    }
  }, [])

  // 初始化音频
  const initAudio = useCallback(() => {
    if (!audioUrl) return

    cleanup()

    const el = new Audio()
    el.src = audioUrl
    el.loop = false // We handle looping manually for better control
    el.preload = 'auto'
    el.crossOrigin = 'anonymous' // Handle CORS issues

    // 添加事件监听器
    el.addEventListener('error', handleError)
    el.addEventListener('stalled', handleStalled)
    el.addEventListener('abort', handleAbort)
    el.addEventListener('waiting', handleWaiting)
    el.addEventListener('canplay', handleCanPlay)
    el.addEventListener('ended', handleEnded)
    el.addEventListener('timeupdate', handleTimeUpdate)
    el.addEventListener('progress', handleProgress)

    audioRef.current = el
    setLoading(true)

    // 开始缓冲监控
    checkBufferIntervalRef.current = setInterval(handleProgress, BUFFER_CHECK_INTERVAL)
  }, [audioUrl, cleanup, handleError, handleStalled, handleAbort, handleWaiting, handleCanPlay, handleEnded, handleTimeUpdate, handleProgress])

  useEffect(() => {
    if (!audioUrl) {
      setUsingFake(true)
      setReady(true)
      return cleanup
    }

    setUsingFake(false)
    setReady(false)
    setLoading(true)
    setError(null)
    setRetryCount(0)

    initAudio()

    return cleanup
  }, [audioUrl, initAudio, cleanup])

  const play = useCallback(async () => {
    if (usingFake) {
      fakeClockRef.current.playing = true
      return
    }

    const audioEl = audioRef.current
    if (!audioEl || !ready) return

    try {
      await audioEl.play()
      setLoading(false)
      setError(null)
    } catch (err) {
      console.error('Failed to play audio:', err)
      setError('Failed to play audio')

      // 如果是用户交互限制，等待用户交互后重试
      if (err instanceof Error && err.name === 'NotAllowedError') {
        console.log('Audio requires user interaction')
      }
    }
  }, [usingFake, ready])

  const pause = useCallback(() => {
    if (usingFake) {
      fakeClockRef.current.playing = false
      return
    }
    audioRef.current?.pause()
  }, [usingFake])

  const seek = useCallback((t: number) => {
    if (usingFake) {
      fakeClockRef.current.t = t
      return
    }

    const audioEl = audioRef.current
    if (audioEl) {
      audioEl.currentTime = t
    }
  }, [usingFake])

  const getCurrentTime = useCallback(() => {
    if (usingFake) {
      return fakeClockRef.current.t
    }
    return audioRef.current ? audioRef.current.currentTime : 0
  }, [usingFake])

  const retry = useCallback(() => {
    setRetryCount(0)
    setError(null)
    initAudio()
  }, [initAudio])

  // 假时钟推进（支持无限循环）
  useEffect(() => {
    if (!usingFake) return

    let raf = 0
    let last = performance.now()
    const FAKE_DURATION = 350 // Match the real audio duration

    const tick = () => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now

      if (fakeClockRef.current.playing) {
        fakeClockRef.current.t += dt
        // 无限循环
        if (fakeClockRef.current.t >= FAKE_DURATION) {
          fakeClockRef.current.t = fakeClockRef.current.t % FAKE_DURATION
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [usingFake])

  return {
    ready,
    play,
    pause,
    seek,
    getCurrentTime,
    usingFake,
    error,
    loading,
    bufferHealth,
    retry,
    retryCount
  }
}

// -----------------------------
// Timeline（dur 预计算 + 二分/插值）——最简：假设时间递增
// -----------------------------
function useTimeline(lyrics: LyricLine[], duration: number) {
  const durs = useMemo(() => {
    const arr: number[] = []
    for (let i = 0; i < lyrics.length; i++) {
      const t0 = lyrics[i].time
      const t1 = i === lyrics.length - 1 ? duration : lyrics[i + 1].time
      arr.push(Math.max(0.0001, t1 - t0))
    }
    return arr
  }, [lyrics, duration])

  const indexOfTime = useCallback((t: number) => {
    // 线性扫描即可（少量行）。真实项目请改为二分。
    for (let i = 0; i < lyrics.length - 1; i++) {
      if (t >= lyrics[i].time && t < lyrics[i + 1].time) return i
    }
    return lyrics.length - 1
  }, [lyrics])

  const interp = useCallback((t: number) => {
    const i = indexOfTime(t)
    const t0 = lyrics[i].time
    const p = (t - t0) / durs[i]
    return { i, p: Math.min(0.9999, Math.max(0, p)) }
  }, [indexOfTime, lyrics, durs])

  return { durs, indexOfTime, interp }
}

// -----------------------------
// 滚动归一化（wheel/touch 为时间等效 Δs）
// -----------------------------
function useNormalizedScroll(onDelta: (d: NormalizedScrollDelta) => void) {
  const lastTouch = useRef<{ y: number; t: number } | null>(null)

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      // Prevent default scroll behavior
      e.preventDefault()
      e.stopPropagation()

      const valuePx = e.deltaY
      const dir = valuePx === 0 ? 0 : (valuePx > 0 ? 1 : -1)
      // 简化：把像素映射为时间等效，先给个经验系数 0.0015 s/px
      const value = valuePx * 0.0015
      onDelta({ value, direction: dir as 1 | -1 | 0, timestamp: performance.now(), source: 'wheel' })
    }

    const onTouchStart = (e: TouchEvent) => {
      // Prevent default touch behavior
      e.preventDefault()
      e.stopPropagation()

      lastTouch.current = { y: e.touches[0].clientY, t: performance.now() }
    }

    const onTouchMove = (e: TouchEvent) => {
      // Prevent default touch behavior
      e.preventDefault()
      e.stopPropagation()

      if (!lastTouch.current) return
      const ny = e.touches[0].clientY
      const dy = lastTouch.current.y - ny
      lastTouch.current = { y: ny, t: performance.now() }
      const dir = dy === 0 ? 0 : (dy > 0 ? 1 : -1)
      const value = dy * 0.002 // s/px（触控稍灵敏）
      onDelta({ value, direction: dir as 1 | -1 | 0, timestamp: performance.now(), source: 'touch' })
    }

    // Add additional event listeners for better capture
    const onKeyDown = (e: KeyboardEvent) => {
      let deltaValue = 0
      let direction: 1 | -1 | 0 = 0

      switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          deltaValue = -0.5
          direction = -1
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          deltaValue = 0.5
          direction = 1
          break
        default:
          return
      }

      e.preventDefault()
      e.stopPropagation()

      onDelta({
        value: deltaValue,
        direction,
        timestamp: performance.now(),
        source: 'wheel'
      })
    }

    // Use capture phase and non-passive to ensure events are captured
    const wheelOptions = { capture: true, passive: false } as const
    const touchOptions = { capture: true, passive: false } as const

    // Add event listeners with capture phase
    window.addEventListener('wheel', onWheel, wheelOptions)
    window.addEventListener('touchstart', onTouchStart, touchOptions)
    window.addEventListener('touchmove', onTouchMove, touchOptions)
    window.addEventListener('keydown', onKeyDown, { capture: true })

    // Also add document-level listeners as backup
    document.addEventListener('wheel', onWheel, wheelOptions)
    document.addEventListener('touchstart', onTouchStart, touchOptions)
    document.addEventListener('touchmove', onTouchMove, touchOptions)
    document.addEventListener('keydown', onKeyDown, { capture: true })

    // Debug: Log that scroll listeners are attached
    console.log('[LyricSync-v4] Scroll event listeners attached')

    return () => {
      // Remove all event listeners
      window.removeEventListener('wheel', onWheel, wheelOptions)
      window.removeEventListener('touchstart', onTouchStart, touchOptions)
      window.removeEventListener('touchmove', onTouchMove, touchOptions)
      window.removeEventListener('keydown', onKeyDown, { capture: true })

      document.removeEventListener('wheel', onWheel, wheelOptions)
      document.removeEventListener('touchstart', onTouchStart, touchOptions)
      document.removeEventListener('touchmove', onTouchMove, touchOptions)
      document.removeEventListener('keydown', onKeyDown, { capture: true })

      console.log('[LyricSync-v4] Scroll event listeners removed')
    }
  }, [onDelta])
}

// -----------------------------
// SyncController：主时钟/吸附/状态机（精简版）
// -----------------------------
function useSyncController(duration: number, audio: ReturnType<typeof useAudioEngine>) {
  const stateRef = useRef<SyncState>('AUTO_PLAY')
  const [state, setState] = useState<SyncState>('AUTO_PLAY')
  const displayTimeRef = useRef(0)
  const [renderTrigger, setRenderTrigger] = useState(0)  // 强制重新渲染的触发器
  const lastInputAtRef = useRef(0)
  const velocityRef = useRef(0)
  const coolingUntilRef = useRef(0)
  const dirFlipCountRef = useRef(0)
  const lastDirRef = useRef<1 | -1 | 0>(0)
  const kRef = useRef(deriveSpringK(CFG.ADHESION.TARGET_SETTLE_MS))

  const enterState = useCallback((s: SyncState) => {
    stateRef.current = s
    setState(s)
  }, [])

  // 强制重新渲染的函数
  const forceRender = useCallback(() => {
    setRenderTrigger(prev => prev + 1)
  }, [])

  const clampDt = (dtMs: number) => Math.max(CFG.ADHESION.DELTA_CLAMP.MIN_DT, Math.min(CFG.ADHESION.DELTA_CLAMP.MAX_DT, dtMs))

  const rAF = useRef(0)
  let frameCount = 0
  useEffect(() => {
    let last = performance.now()
    const tick = () => {
      const now = performance.now()
      const rawDt = now - last
      const dt = clampDt(rawDt)
      last = now

      // 读主时钟
      const audioT = wrapTime(audio.getCurrentTime(), duration)

      // 误差
      const eps = wrapTime(displayTimeRef.current - audioT, duration)
      const absE = Math.abs(eps)

      // 状态机推进（精简版）
      switch (stateRef.current) {
        case 'AUTO_PLAY': {
          // 拉式：displayTime 跟随 audio
          displayTimeRef.current = audioT
          break
        }
        case 'USER_SCRUB': {
          // 惯性：速度指数衰减
          const tau = CFG.USER_SCRUB.INERTIA_DECAY_TAU
          const decay = Math.exp(-(dt) / tau)
          velocityRef.current *= decay
          const v = velocityRef.current
          if (Math.abs(v) < CFG.USER_SCRUB.MIN_VELOCITY && now - lastInputAtRef.current > CFG.USER_SCRUB.ACTIVE_TIMEOUT) {
            // 进入 IDLE_AUTO：冻结 displayTime
            enterState('IDLE_AUTO')
          } else {
            displayTimeRef.current = wrapTime(displayTimeRef.current + v * (dt / 1000), duration)
          }
          break
        }
        case 'IDLE_AUTO': {
          // 用户停止滚动，让音频跟上用户选择的位置
          if (absE > CFG.ADHESION.TOLERANCE.SOFT_LO) {
            // 将音频seek到用户选择的位置
            audio.seek(displayTimeRef.current)
            console.log('[LyricSync-v4] Seeking audio to user position:', displayTimeRef.current)
          }

          // 立即进入 AUTO_PLAY，音频现在会跟随用户选择的位置
          enterState('AUTO_PLAY')
          break
        }
        case 'LOOP_COOLING': {
          if (now >= coolingUntilRef.current) enterState('IDLE_AUTO')
          break
        }
      }

      // 每30帧强制重新渲染一次（约每0.5秒）
      frameCount++
      if (frameCount % 30 === 0) {
        forceRender()
      }

      rAF.current = requestAnimationFrame(tick)
    }
    rAF.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rAF.current)
  }, [audio, duration, enterState, forceRender])

  // 外部输入：滚动 Δs（时间等效，单位 s）
  const onScrollDelta = useCallback((d: NormalizedScrollDelta) => {
    const now = performance.now()

    // Debug: Log scroll events for testing
    console.log('[LyricSync-v4] Scroll event received:', {
      value: d.value,
      direction: d.direction,
      source: d.source,
      timestamp: d.timestamp,
      currentState: stateRef.current
    })

    // 方向翻转统计（冷却辅助）
    if (d.direction !== 0 && lastDirRef.current !== 0 && d.direction !== lastDirRef.current) {
      dirFlipCountRef.current += 1
    }
    lastDirRef.current = d.direction

    // 归一化：单帧最大推进 0.5s
    const deltaSec = Math.max(-CFG.ADHESION.DELTA_CLAMP.MAX_SCROLL_PROGRESS, Math.min(CFG.ADHESION.DELTA_CLAMP.MAX_SCROLL_PROGRESS, d.value))

    // 写入 USER_SCRUB 动量
    velocityRef.current = deltaSec // 简化：直接把 Δs 视为速度基
    lastInputAtRef.current = now

    // 进入 USER_SCRUB
    if (stateRef.current !== 'USER_SCRUB') {
      // 若 wrap 附近或方向翻转频繁，先进入冷却
      if (dirFlipCountRef.current >= CFG.LOOP_COOLING.DIRECTION_FLIP_THRESHOLD) {
        coolingUntilRef.current = now + CFG.LOOP_COOLING.MIN_DURATION
        enterState('LOOP_COOLING')
        dirFlipCountRef.current = 0
        return
      }
      enterState('USER_SCRUB')
      audio.pause()
    }

    // 立即推进显示时间（增量映射）
    displayTimeRef.current = wrapTime(displayTimeRef.current + deltaSec, duration)

    // 立即强制重新渲染以响应滚动
    forceRender()
  }, [audio, duration, enterState, forceRender])

  // 对外暴露
  return {
    state,
    displayTimeRef,
    onScrollDelta,
    renderTrigger,  // 暴露渲染触发器
    jumpTo: (t: number) => { displayTimeRef.current = wrapTime(t, duration); forceRender() },
    handOverToAudio: () => { enterState('AUTO_PLAY'); audio.play() },
  }
}

// -----------------------------
// AnchorCharacter 组件：锚字视觉效果
// 为3D模型替换预留接口
// -----------------------------
interface AnchorCharacterProps {
  character: string
  isActive: boolean
  importance?: 'primary' | 'secondary' | 'tertiary'
  delay?: number
  use3DModel?: boolean  // 为3D模型替换预留
  modelPath?: string     // 3D模型路径
}

// 未来3D模型组件的占位接口
// const AnchorCharacter3D = ({ modelPath, importance }: { modelPath: string; importance: string }) => {
//   // 这里将集成Three.js/React Three Fiber的3D模型渲染
//   return <ThreeModelRenderer path={modelPath} importance={importance} />
// }

function AnchorCharacter({ character, isActive, importance = 'primary', delay = 0, use3DModel = false, modelPath }: AnchorCharacterProps) {
  // 根据重要性配置视觉效果
  const getConfig = (imp: 'primary' | 'secondary' | 'tertiary') => {
    switch (imp) {
      case 'primary':
        return {
          colors: ['#FF6B35', '#F7931E', '#FFC107'],
          fontSize: 32,
          glowSize: 20,
          scale: 1.3,
          animationDuration: 3
        }
      case 'secondary':
        return {
          colors: ['#4ECDC4', '#44A3AA', '#2A9D8F'],
          fontSize: 28,
          glowSize: 15,
          scale: 1.2,
          animationDuration: 4
        }
      case 'tertiary':
        return {
          colors: ['#7B68EE', '#6A5ACD', '#483D8B'],
          fontSize: 24,
          glowSize: 10,
          scale: 1.1,
          animationDuration: 5
        }
    }
  }

  const config = getConfig(importance)

  // 浮层动画变体
  const floatingVariants = {
    initial: {
      opacity: 0,
      scale: 0.5,
      y: 20,
      filter: 'blur(8px)',
      rotateZ: -5
    },
    floating: {
      opacity: 1,
      scale: config.scale,
      y: 0,
      filter: 'blur(0px)',
      rotateZ: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12,
        delay: delay / 1000,
        duration: 0.8
      }
    },
    active: {
      scale: config.scale * 1.1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10,
        duration: 0.3
      }
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      y: -20,
      filter: 'blur(6px)',
      rotateZ: 5,
      transition: {
        duration: 0.4,
        ease: "easeInOut"
      }
    }
  }

  // 光晕效果
  const glowVariants = {
    initial: { scale: 0.5, opacity: 0 },
    floating: {
      scale: [1, 1.2, 1],
      opacity: [0.6, 0.8, 0.6],
      transition: {
        duration: config.animationDuration,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    active: {
      scale: 1.5,
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    },
    exit: {
      scale: 0.3,
      opacity: 0,
      transition: { duration: 0.3 }
    }
  }

  // 渐变文字样式
  const gradientStyle = {
    background: `linear-gradient(135deg, ${config.colors.join(', ')})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontSize: `${config.fontSize}px`,
    fontWeight: 800,
    letterSpacing: '0.05em',
    textShadow: isActive ? `0 0 ${config.glowSize}px rgba(255, 107, 53, 0.4)` : 'none',
    position: 'relative' as const,
    zIndex: 10
  }

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          key={character}
          variants={floatingVariants}
          initial="initial"
          animate={isActive ? ["floating", "active"] : "floating"}
          exit="exit"
          style={{
            position: 'relative',
            display: 'inline-block',
            marginLeft: '16px',
            verticalAlign: 'middle'
          }}
        >
          {/* 背景光晕层 */}
          <motion.div
            variants={glowVariants}
            initial="initial"
            animate="floating"
            exit="exit"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${config.fontSize * 1.5}px`,
              height: `${config.fontSize * 1.5}px`,
              background: `radial-gradient(circle, ${config.colors[0]}33 0%, transparent 70%)`,
              borderRadius: '50%',
              filter: 'blur(8px)',
              zIndex: 1
            }}
          />

          {/* 主光晕 */}
          <motion.div
            variants={glowVariants}
            initial="initial"
            animate="floating"
            exit="exit"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${config.fontSize}px`,
              height: `${config.fontSize}px`,
              background: `radial-gradient(circle, ${config.colors[1]}66 0%, ${config.colors[0]}33 50%, transparent 70%)`,
              borderRadius: '50%',
              zIndex: 2
            }}
          />

          {/* 锚字主体 */}
          <motion.span
            style={gradientStyle}
            whileHover={{
              scale: 1.1,
              rotateZ: [0, -2, 2, 0],
              transition: { duration: 0.3 }
            }}
          >
            {character}
          </motion.span>

          {/* 装饰性粒子效果 */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              initial={{
                opacity: 0,
                scale: 0,
                x: 0,
                y: 0
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
                x: [0, (i - 1) * 20, (i - 1) * 30],
                y: [0, -15 - i * 10, -25 - i * 15],
                transition: {
                  delay: (delay + i * 100) / 1000,
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3
                }
              }}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '4px',
                height: '4px',
                background: config.colors[i % config.colors.length],
                borderRadius: '50%',
                zIndex: 5
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// -----------------------------
// UI：基础渲染（虚拟列表略，最简实现）
// -----------------------------
export default function LyricsSyncV3({
  lyrics = DEMO_LYRICS,
  duration = DEMO_DURATION,
  audioUrl = DEMO_AUDIO,
}: { lyrics?: LyricLine[]; duration?: number; audioUrl?: string }) {
  const audio = useAudioEngine(audioUrl)
  const { durs, indexOfTime, interp } = useTimeline(lyrics, duration)
  const { state, displayTimeRef, onScrollDelta, handOverToAudio, renderTrigger } = useSyncController(duration, audio)

  // Prevent body scrolling and manage component lifecycle
  useEffect(() => {
    // Store original body styles
    const originalOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position
    const originalHeight = document.body.style.height
    const originalHtmlOverflow = document.documentElement.style.overflow

    // Prevent scrolling on body and html
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.height = '100vh'
    document.documentElement.style.overflow = 'hidden'

    // Also prevent touch scrolling on mobile
    document.body.style.touchAction = 'none'
    document.documentElement.style.touchAction = 'none'

    // Cleanup function to restore original styles
    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.position = originalPosition
      document.body.style.height = originalHeight
      document.documentElement.style.overflow = originalHtmlOverflow
      document.body.style.touchAction = ''
      document.documentElement.style.touchAction = ''
    }
  }, [])

  // 归一化输入挂钩
  useNormalizedScroll(onScrollDelta)

  // 自动播放解锁（用户首次交互时）
  const [hasInteracted, setHasInteracted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)  // 用于触发重新渲染的时间状态

  useEffect(() => {
    const onFirst = async () => {
      setHasInteracted(true)
      try {
        await audio.play()
        console.log('[LyricSync-v4] Audio started successfully')
      } catch (err) {
        console.error('[LyricSync-v4] Failed to start audio:', err)
      }
      window.removeEventListener('pointerdown', onFirst)
    }
    window.addEventListener('pointerdown', onFirst)
    return () => window.removeEventListener('pointerdown', onFirst)
  }, [audio])

  // 监听 displayTimeRef 的变化并更新组件状态
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(displayTimeRef.current)
    }

    // 初始设置
    updateTime()

    // 定期更新（更频繁）
    const interval = setInterval(updateTime, 100)

    return () => clearInterval(interval)
  }, [renderTrigger, displayTimeRef])

  // 强制启动音频的函数
  const forceStartAudio = async () => {
    if (!hasInteracted) {
      setHasInteracted(true)
    }
    try {
      await audio.play()
      console.log('[LyricSync-v4] Audio force started')
    } catch (err) {
      console.error('[LyricSync-v4] Force start failed:', err)
    }
  }

  // 渲染映射 - 使用 currentTime 确保响应式更新
  const { i, p } = interp(currentTime)
  const current = lyrics[i]

  // Debug log
  useEffect(() => {
    console.log('[LyricSync-v4] Render update:', {
      currentTime,
      i,
      p,
      currentAnchor: current?.anchor,
      state,
      audioTime: audio.getCurrentTime()
    })
  }, [currentTime, i, p, current, state, audio.getCurrentTime()])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      display: 'grid',
      gridTemplateRows: 'auto 1fr auto',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
      zIndex: 9999,
      backgroundColor: '#ffffff'
    }}>
      <header style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e5e5e5',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <strong style={{ fontSize: 16 }}>LyricsSync-v5 • 心经数字体验</strong>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '12px' }}>
            {state === 'AUTO_PLAY' ? '🎵 音频跟随' :
             state === 'USER_SCRUB' ? '🖱️ 手动控制' :
             state === 'IDLE_AUTO' ? '🔄 同步中' : '🔄 冷却中'}
          </span>
          {!audio.ready && (
            <span style={{ fontSize: 11, color: '#ffcc00', background: 'rgba(255,204,0,0.2)', padding: '4px 8px', borderRadius: '12px' }}>
              {audio.error ? '❌ 音频错误' : '⏳ 加载中...'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* 音频控制按钮 */}
          <button
            style={{
              padding: '8px 16px',
              background: audio.ready && currentTime > 0 ?
                (currentTime < duration * 0.99 ? 'rgba(255,100,100,0.3)' : 'rgba(100,255,100,0.3)') :
                'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '20px',
              color: 'white',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={async () => {
              if (currentTime < duration * 0.99) {
                await audio.pause()
              } else {
                await forceStartAudio()
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.4)'
              e.currentTarget.style.transform = 'scale(1.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            {currentTime < duration * 0.99 ? '⏸️ 暂停' : '▶️ 播放'}
          </button>

          {!hasInteracted && (
            <button
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #ff6b6b, #ff8e8e)',
                border: 'none',
                borderRadius: '20px',
                color: 'white',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                animation: 'pulse 2s infinite',
                boxShadow: '0 4px 15px rgba(255,107,107,0.3)'
              }}
              onClick={forceStartAudio}
            >
              🎵 点击开始体验
            </button>
          )}

          <button
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '16px',
              color: 'white',
              cursor: 'pointer',
              fontSize: 11,
              transition: 'all 0.3s ease'
            }}
            onClick={handOverToAudio}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.3)'
              e.currentTarget.style.transform = 'scale(1.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            🔄 回到自动
          </button>

          {audio.error && (
            <button
              style={{
                padding: '6px 12px',
                background: 'rgba(255,100,100,0.3)',
                border: '1px solid rgba(255,100,100,0.5)',
                borderRadius: '16px',
                color: '#ffcccc',
                cursor: 'pointer',
                fontSize: 11
              }}
              onClick={audio.retry}
            >
              🔄 重试音频
            </button>
          )}
        </div>
      </header>

      <main style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 50%, #f093fb15 100%)',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      }}
      onWheel={(e) => {
        // Additional wheel prevention at the component level
        e.preventDefault()
        e.stopPropagation()
      }}
      onTouchMove={(e) => {
        // Additional touch prevention at the component level
        e.preventDefault()
        e.stopPropagation()
      }}
      >
        {/* 背景装饰性圆形 */}
        <div style={{
          position: 'absolute',
          top: '-200px',
          right: '-200px',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(102,126,234,0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          zIndex: 1
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-150px',
          left: '-150px',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(118,75,162,0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          zIndex: 1
        }} />

        {/* 增强的渐变遮罩 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 80,
          background: 'linear-gradient(#ffffff, rgba(255,255,255,0.95))',
          pointerEvents: 'none',
          zIndex: 4
        }} />
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          background: 'linear-gradient(rgba(255,255,255,0.95), #ffffff)',
          pointerEvents: 'none',
          zIndex: 4
        }} />

        {/* 歌词列表 - 改进滚动效果 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          padding: '80px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            position: 'relative',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            transform: `translateY(${-i * 50 - p * 50}px)`,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            {lyrics.map((line, idx) => {
              const active = idx === i
              const distance = Math.abs(idx - i - p)

              // 渐变透明度和缩放，创造深度感
              const opacity = Math.max(0.3, 1 - distance * 0.15)
              const scale = Math.max(0.9, 1 - distance * 0.05)

              return (
                <motion.div
                  key={idx}
                  animate={{
                    opacity,
                    scale,
                    transition: {
                      opacity: { duration: 0.3 },
                      scale: { duration: 0.3 }
                    }
                  }}
                  style={{
                    height: 50,
                    lineHeight: '50px',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    marginBottom: '4px'
                  }}
                >
                  {/* 歌词文本 */}
                  <motion.span
                    animate={{
                      fontSize: active ? 22 : 16,
                      fontWeight: active ? 700 : 400,
                      color: active ? '#1a1a1a' : '#666',
                      letterSpacing: active ? '0.05em' : '0.02em',
                      marginRight: active ? '8px' : '0',
                      textShadow: active ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                    style={{
                      fontFamily: 'system-ui, sans-serif',
                    }}
                  >
                    {line.text}
                  </motion.span>

                  {/* 锚字组件 */}
                  <AnchorCharacter
                    character={line.anchor || ''}
                    isActive={active && !!line.anchor}
                    importance={line.importance}
                    delay={idx * 100}
                  />
                </motion.div>
              )
            })}
          </div>
        </div>
      </main>

      <footer style={{
        padding: '16px 20px',
        borderTop: '1px solid #e5e5e5',
        background: 'linear-gradient(to top, #f8f9fa, #ffffff)',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif'
      }}>
        {/* 主要控制说明 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '24px',
          marginBottom: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: 13,
            color: '#333',
            fontWeight: 500
          }}>
            <span style={{ fontSize: 16 }}>🖱️</span>
            <span>滚动鼠标控制进度</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: 13,
            color: '#333',
            fontWeight: 500
          }}>
            <span style={{ fontSize: 16 }}>⌨️</span>
            <span>↑↓ 或 W/S 键控制</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: 13,
            color: '#333',
            fontWeight: 500
          }}>
            <span style={{ fontSize: 16 }}>🔄</span>
            <span>停止滚动音频同步</span>
          </div>
        </div>

        {/* 状态信息 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '8px',
          flexWrap: 'wrap'
        }}>
          <span style={{
            fontSize: 11,
            color: '#666',
            background: 'rgba(102,126,234,0.1)',
            padding: '4px 8px',
            borderRadius: '8px'
          }}>
            📖 当前: 第 {i + 1}/{lyrics.length} 句
          </span>
          <span style={{
            fontSize: 11,
            color: '#666',
            background: 'rgba(118,75,162,0.1)',
            padding: '4px 8px',
            borderRadius: '8px'
          }}>
            ⏱️ {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
          </span>
          {current?.anchor && (
            <span style={{
              fontSize: 11,
              color: '#666',
              background: 'rgba(255,107,53,0.1)',
              padding: '4px 8px',
              borderRadius: '8px'
            }}>
              ✨ 锚字: {current.anchor}
            </span>
          )}
        </div>

        {/* 音频状态和技术信息 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          fontSize: 10,
          color: '#999',
          flexWrap: 'wrap'
        }}>
          <span>
            {audio.usingFake ? '🔄 使用内置时钟' :
             audio.error ? `❌ ${audio.error}` :
             audio.loading ? '⏳ 音频加载中...' :
             audio.ready ? '🎵 音频就绪' : '🔇 音频未就绪'}
          </span>
          <span>•</span>
          <span>锚字效果: 浮层 • 渐变 • 光晕 • 粒子</span>
          {audio.retryCount > 0 && (
            <>
              <span>•</span>
              <span>重试次数: {audio.retryCount}</span>
            </>
          )}
        </div>

        {/* 首次使用提示 */}
        {!hasInteracted && (
          <div style={{
            marginTop: '12px',
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #ff6b6b15, #ff8e8e15)',
            border: '1px solid rgba(255,107,107,0.3)',
            borderRadius: '8px',
            fontSize: 12,
            color: '#ff6b6b',
            fontWeight: 500,
            animation: 'pulse 2s infinite'
          }}>
            👆 点击上方"🎵 点击开始体验"按钮开始心经数字之旅
          </div>
        )}
      </footer>
    </div>
  )
}
