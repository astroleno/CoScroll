'use client';
import { assetUrl } from '@/utils/assetUrl';


import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import timelineStore from '@/stores/timelineStore';
import { loopPhase, timeInCurrentCycle } from '@/utils/loopTimeline';
// import { LRC_LYRICS } from './constants'; // 不再使用硬编码歌词
import { useScrollVelocity } from '@/components/hooks/useScrollVelocity';
import EnhancedAudioPlayer from '@/components/audio/EnhancedAudioPlayer';
import AudioEngine from '@/components/audio/AudioEngine';
import PageVisibilityManager from '@/components/audio/PageVisibilityManager';
import AutoPlayGuard from '@/components/AutoPlayGuard';
import ModelPreloader from '@/components/jade/ModelPreloader';
import type { LyricLine } from '@/types';
import UnifiedLyricsAndModel from '@/components/layouts/UnifiedLyricsAndModel';
// 配置系统导入
import type { ProjectConfig } from '@/config/types';
import type { ScenePalette } from '@/config/appearance';
import { resolveAnchor, resolveModelMappings } from '@/config/resolveAnchor';

// 调试输出开关（仅开发环境生效）
const DEBUG_DEV = process.env.NODE_ENV === 'development';
const DEFAULT_FONT_FAMILY = 'RunZhiJiaKangXiZidian';
const DEFAULT_FONT_SCALE = 1.6;

// 默认时长，待真实音频元数据加载后更新
const MOCK_DURATION = 364; // ~6 分 4 秒


const findCurrentLineIndex = (lyricLines: LyricLine[], time: number, durationParam: number): number => {
  if (!lyricLines || lyricLines.length === 0) return -1;
  const base = Math.max(1, durationParam || MOCK_DURATION);
  const loopTime = loopPhase(time, base);
  let lineIndex = -1;
  for (let i = 0; i < lyricLines.length; i++) {
    if (lyricLines[i].time <= loopTime) {
      lineIndex = i;
    } else {
      break;
    }
  }
  return lineIndex;
};

const getModelPath = (anchorChar: string, mappings: Record<string, string>): string => {
  return mappings[anchorChar] || mappings.default || '';
};

interface ReadingSessionProps {
  sessionRevision: number;
  config: ProjectConfig;
  lyrics: LyricLine[];
  mediaDuration: number;
  entered: boolean;
  initialPlaying: boolean;
  palette: ScenePalette;
  onEnter: () => void;
  onPlayingChange: (playing: boolean) => void;
}

export default function ReadingSession({sessionRevision, config, lyrics, mediaDuration, entered, initialPlaying, palette, onEnter, onPlayingChange}: ReadingSessionProps) {
  const startingIntent = useRef({entered, initialPlaying});
  startingIntent.current = {entered, initialPlaying};
  const currentSession = useRef(sessionRevision);
  currentSession.current = sessionRevision;
  const gesturePlayGeneration = useRef(0);
  // ==================== 配置加载 ====================
  const isConfigLoading = false;

  // 从配置获取锚字映射和时间轴

  // 构建锚字映射对象
  const anchorModelMapping = useMemo(() => {
    return resolveModelMappings(config);
  }, [config]);

  // 使用配置的时间轴或降级到硬编码
  const anchorTimeline = config.timeline;

  // 自动注入主题

  // 在组件挂载时加载配置

  // 使用配置的锚字映射
  const anchorMappings = anchorModelMapping;

  // 使用配置的时间轴
  const timeline = anchorTimeline;

  const audioSrcFromConfig = assetUrl(config?.assets.audio.src || '/audio/心经_2.mp3');
  const lyricsSrcFromConfig = assetUrl(config?.assets.lyrics.src || '/lyrics/心经.lrc');

  // ==================== 音频相关状态 ====================
  const [isPlaying, setIsPlaying] = useState(initialPlaying);
  const [isReady, setIsReady] = useState(false);
  const [audioTime, setAudioTime] = useState(0); // 唯一真相源：音频时间
  const [previewTime, setPreviewTime] = useState<number | null>(null); // 手动滚动预览
  const [duration, setDuration] = useState(mediaDuration);
  const audioSrc = audioSrcFromConfig;
  const [isIntroPlaying, setIsIntroPlaying] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(entered);
  const [isMobile, setIsMobile] = useState(false);
  const [loopCount, setLoopCount] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [seekSignal, setSeekSignal] = useState(0);
  // 字体选择（应用于 DOM 歌词层）
  const selectedFont = DEFAULT_FONT_FAMILY;
  const fontSize = DEFAULT_FONT_SCALE;
  const [fontRevision, setFontRevision] = useState(0);

  // 时间-像素映射与方向（Phase 1）
  // 说明：pixelsPerSecond 控制拖拽/滚轮的灵敏度；direction=-1 表示右→左（RTL）
  const PIXELS_PER_SECOND = 12; // 再次降低速度
  const DIRECTION = 1; // 改为 LTR，因为歌词现在是竖排的，需要从左到右滚动
  const DRAG_THRESHOLD_PX = 6; // 超过阈值才进入预览拖拽，避免点击被拦截

  // 计算值（不用state）
  const isPreviewMode = previewTime !== null;
  const displayTime = isPreviewMode ? ((previewTime % duration) + duration) % duration : audioTime;
  // 修复：预览模式时直接使用 previewTime 作为绝对时间，避免 loopCount 不同步
  const absoluteTime = isPreviewMode ? previewTime : (loopCount * duration + displayTime);

  // 3D模型相关状态
  const { scrollVelocity, scrollVelocityRef, rotationVelocityRef, handleScrollVelocityChange, setInternalScrollVelocity } = useScrollVelocity(false);
  const [currentAnchor, setCurrentAnchor] = useState('心');
  const [modelPreloadStatus, setModelPreloadStatus] = useState({
    isPreloading: false,
    loaded: 0,
    total: 0,
    currentModel: '',
    nextModel: ''
  });


  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUserInteractionRef = useRef<number>(0);
  const audioTimeRef = useRef(0);
  const lastCommittedTimeRef = useRef({ stamp: 0, display: 0 });
  // Continuous scene time is read by the Canvas without a React update per frame.
  const visualAbsoluteTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // 从配置动态加载歌词
  const isLyricsLoading = false;
  const [displayedModelPath, setDisplayedModelPath] = useState('');
  const [failedModelPath, setFailedModelPath] = useState('');
  const modelDisplayed = useCallback((path: string) => { setDisplayedModelPath(path); setFailedModelPath(''); }, []);
  useEffect(() => {
    // RootLayout declares and preloads the full font before client hydration.
    let cancelled = false;
    const bumpRevision = () => setFontRevision((rev) => rev + 1);

    if (typeof document !== 'undefined' && document.fonts) {
      // 改进字体加载逻辑
      const fontSpec = `16px ${selectedFont}`;
      // prepareProject already waited for this complete font before mounting.
      // Do not rasterize and upload the whole visible window a second time.
      if (document.fonts.check(fontSpec)) return;
      if (DEBUG_DEV) console.log('[FontLoader] 开始加载字体:', fontSpec);

      document.fonts.load(fontSpec)
        .then(() => {
          if (DEBUG_DEV) console.log('[FontLoader] ✅ 字体加载成功:', selectedFont);
          if (!cancelled) bumpRevision();
        })
        .catch((error) => {
          console.warn('[FontLoader] ❌ 字体加载失败:', selectedFont, error);
          // 即使失败也触发一次，使用系统字体
          if (!cancelled) bumpRevision();
        });
    } else {
      // 降级：直接触发一次
      if (DEBUG_DEV) console.log('[FontLoader] 使用降级方案');
      bumpRevision();
    }

    return () => {
      cancelled = true;
    };
  }, [selectedFont]);

  const commitTimeUpdate = useCallback(
    (displayTime: number, absoluteTime: number, force: boolean = false) => {
      const newLoopCount = Math.floor(absoluteTime / duration);

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

      // Protect a queued command until the media engine acknowledges it, rather
      // than dropping valid native loop samples for a fixed 500ms window.
      if (!force && timelineStore.pendingAudioSeek !== null) {
        return;
      }
      audioTimeRef.current = displayTime;

      // 写入全局时间 store
      if (force) timelineStore.requestAudioTime(displayTime, absoluteTime);

      const last = lastCommittedTimeRef.current;
      if (!force) {
        const elapsed = now - last.stamp;
        const delta = Math.abs(displayTime - last.display);
        // 降低节流，提高响应速度
        if (elapsed < 8 && delta < 0.005) {
          return;
        }
      }

      if (force) {
        setSeekSignal((prev) => (prev + 1) % Number.MAX_SAFE_INTEGER);
        visualAbsoluteTimeRef.current = absoluteTime;
      }

      lastCommittedTimeRef.current = { stamp: now, display: displayTime };
      setAudioTime(displayTime);
      setLoopCount(newLoopCount);
      timelineStore.setVisualTime(displayTime, absoluteTime);
    },
    [duration]
  );

  // 添加调试日志
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    if (DEBUG_DEV) console.log(logMessage);
    setDebugLogs(prev => [...prev.slice(-4), logMessage]);
  }, []);

  // 预览拖拽状态（Phase 1）
  const isPointerPreviewingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerSampleRef = useRef({x: 0, stamp: 0});
  const gestureSurfaceRef = useRef<HTMLElement | null>(null);
  const previewStartClientXRef = useRef(0);
  const previewStartTimeRef = useRef<number | null>(null);
  const lastPreviewTimeRef = useRef<number | null>(null);
  const wheelPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 统一 wheel 归一化（简化版，后续可抽到 hooks）
  const normalizeWheelDeltaX = useCallback((event: WheelEvent) => {
    const mode = (event as any).deltaMode === 1 ? 16 : 1; // 1: line, 0: pixel
    const raw = (event as any).deltaX * mode;
    // 统一方向：左滑 => 快进；右滑 => 后退
    // 在多数触控板上，左滑 deltaX 为正；为了与指针拖拽保持一致，这里取反
    return -raw;
  }, []);

  const refreshPreloadStatus = useCallback(() => {
    if (!config) return; // 如果配置未加载，跳过
    const preloader = ModelPreloader.getInstance();
    const status = preloader.getCacheStatus();
    const currentModelPath = getModelPath(currentAnchor, anchorMappings);
    const nextModelPath = preloader.predictNextModel(audioTimeRef.current, timeline, anchorMappings) || '';

    if (DEBUG_DEV) {
      console.log('[HomePage] 模型预加载状态:', {
        anchor: currentAnchor,
        ...status,
        currentModel: currentModelPath,
        nextModel: nextModelPath,
        isCurrentModelCached: preloader.isModelLoaded(currentModelPath),
        isCurrentModelLoading: preloader.isModelLoading(currentModelPath)
      });
    }

    setModelPreloadStatus(prev => {
      if (
        prev.loaded === status.loaded &&
        prev.total === status.total &&
        prev.currentModel === currentModelPath &&
        prev.nextModel === nextModelPath
      ) {
        return prev;
      }

      return {
        ...prev,
        loaded: status.loaded,
        total: status.total,
        currentModel: currentModelPath,
        nextModel: nextModelPath
      };
    });
  }, [currentAnchor, config, anchorMappings, timeline]);

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;
      
      const mobile = isMobileDevice || (isTouchDevice && isSmallScreen);
      DEBUG_DEV && console.log('[HomePage] Mobile detection:', { 
        userAgent: userAgent.substring(0, 50), 
        isMobileDevice, 
        isTouchDevice, 
        isSmallScreen, 
        mobile 
      });
      setIsMobile(mobile);
      return mobile;
    };

    checkMobile();
  }, []);

  // 设置音频源

  // 用户交互处理
  const playFromGesture = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const generation = ++gesturePlayGeneration.current;
    void audio.play().catch(() => {
      if (currentSession.current === sessionRevision && generation === gesturePlayGeneration.current &&
          audioRef.current === audio && audio.paused) {
        setIsIntroPlaying(false); setIsPlaying(false); onPlayingChange(false);
      }
    });
  }, [onPlayingChange, sessionRevision]);

  const handleUserInteraction = useCallback(() => {
    addDebugLog(`用户交互触发，移动端: ${isMobile}`);
    lastUserInteractionRef.current = Date.now();
    setHasUserInteracted(true);
    setIsIntroPlaying(true);
    onEnter();
    onPlayingChange(true);

    // Start from the beginning for better user experience
    const initialTime = 0;
    const base = Math.max(1, duration);
    // 统一从第一轮开始，避免初始相位差
    const initialAbsolute = 0 * base + initialTime;
    setLoopCount(0);
    commitTimeUpdate(initialTime, initialAbsolute, true);
    playFromGesture();
  }, [isMobile, addDebugLog, commitTimeUpdate, duration, onEnter, onPlayingChange, playFromGesture]);

  // 播放/暂停控制
  const handlePlayPause = useCallback(() => {
    if (!isReady && !(isPlaying || isIntroPlaying)) return;

    // Toggle playing state - AudioEngine will handle the actual play/pause
    const playing = !(isPlaying || isIntroPlaying);
    setIsIntroPlaying(false);
    setIsPlaying(playing);
    onPlayingChange(playing);
    if (playing) playFromGesture();
    else { gesturePlayGeneration.current++; audioRef.current?.pause(); }
  }, [isReady, isPlaying, isIntroPlaying, onPlayingChange, playFromGesture]);

  // 跳转处理
  const handleSeek = useCallback((absoluteTime: number) => {
    // A progress/keyboard command supersedes an older wheel or pointer preview.
    // Its delayed release must not seek back over this newer command.
    if (wheelPreviewTimeoutRef.current) clearTimeout(wheelPreviewTimeoutRef.current);
    wheelPreviewTimeoutRef.current = null;
    isPointerPreviewingRef.current = false;
    isDraggingRef.current = false;
    activePointerIdRef.current = null;
    lastPreviewTimeRef.current = null;
    previewStartTimeRef.current = null;
    setPreviewTime(null);
    handleScrollVelocityChange(0);
    const safeDuration = Math.max(1, duration);
    const displayTime = loopPhase(absoluteTime, safeDuration);

    // 只调用 commitTimeUpdate，它会内部更新 loopCount
    // 不要重复调用 setLoopCount，避免状态冲突
    commitTimeUpdate(displayTime, absoluteTime, true);
    // 立即同步视觉时间与位移，保证进度条/歌词/模型同跳
    visualAbsoluteTimeRef.current = absoluteTime;
  }, [duration, commitTimeUpdate, handleScrollVelocityChange]);

  // AudioEngine event handlers
  const handleAudioTimeUpdate = useCallback((displayTime: number, absoluteTime: number) => {
    commitTimeUpdate(displayTime, absoluteTime);
  }, [commitTimeUpdate]);

  const handleAudioDurationChange = useCallback((newDuration: number) => {
    setDuration(newDuration);
  }, []);

  const handleAudioReady = useCallback(() => {
      setIsReady(true);
    addDebugLog('Audio engine ready');
  }, [addDebugLog]);

  const handleAudioPlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    onPlayingChange(playing);
    if (playing) {
      setIsIntroPlaying(false);
    }
  }, [onPlayingChange]);

  const handleAudioLoopComplete = useCallback((newLoopCount: number) => {
    setLoopCount(newLoopCount);
    addDebugLog(`Loop completed: ${newLoopCount}`);
  }, [addDebugLog]);

  const clearWheelPreviewTimeout = useCallback(() => {
    if (wheelPreviewTimeoutRef.current) {
      clearTimeout(wheelPreviewTimeoutRef.current);
      wheelPreviewTimeoutRef.current = null;
    }
  }, []);

  const handleLyricPreviewStart = useCallback(() => {
    clearWheelPreviewTimeout();
    // 预览模式开始
    // 记录起点时间
    previewStartTimeRef.current = lastPreviewTimeRef.current ?? visualAbsoluteTimeRef.current;
    lastPreviewTimeRef.current = previewStartTimeRef.current;
  }, [clearWheelPreviewTimeout]);

  const handleLyricPreviewTime = useCallback((time: number, inputVelocity?: number) => {
    // 设置预览时间，不 seek
    if (DEBUG_DEV) console.log('[handleLyricPreviewTime]', { time, isPlaying });
    setPreviewTime(time);
    visualAbsoluteTimeRef.current = time;
    const safeDuration = Math.max(1, duration);
    const displayTime = ((time % safeDuration) + safeDuration) % safeDuration;
    timelineStore.setVisualTime(displayTime, time);

    const previous = lastPreviewTimeRef.current;
    if (previous !== null && Number.isFinite(previous)) {
      const deltaSeconds = time - previous;
      if (Number.isFinite(deltaSeconds) && Math.abs(deltaSeconds) > 1e-6) {
        const velocity = inputVelocity ?? deltaSeconds * PIXELS_PER_SECOND * 0.1;
        handleScrollVelocityChange(velocity);
      }
    }
    lastPreviewTimeRef.current = time;
  }, [duration, isPlaying, handleScrollVelocityChange]);

  const handleLyricPreviewEnd = useCallback((allowMomentum = true) => {
    clearWheelPreviewTimeout();
    // 预览结束：执行一次性 seek 到预览终点
    if (DEBUG_DEV) console.log('[handleLyricPreviewEnd] 预览结束并执行一次性 seek');
    const targetAbs = lastPreviewTimeRef.current ?? (isPreviewMode && previewTime != null ? previewTime : absoluteTime);
    const releaseVelocity = allowMomentum ? scrollVelocityRef.current : 0;
    setPreviewTime(null);
    lastPreviewTimeRef.current = null;
    handleScrollVelocityChange(0);
    // 统一入口：以绝对时间 seek
    if (typeof targetAbs === 'number' && !Number.isNaN(targetAbs)) {
      handleSeek(targetAbs);
      // A coalesced move and touchend may arrive before a single render frame.
      // Keep that impulse for the wheel, while the lyric/media velocity is zero.
      if (releaseVelocity) handleScrollVelocityChange(0, releaseVelocity);
    }
  }, [clearWheelPreviewTimeout, isPreviewMode, previewTime, absoluteTime, handleSeek, handleScrollVelocityChange, scrollVelocityRef]);

  const beginDrag = useCallback((x: number, stamp: number, id: number) => {
    if (activePointerIdRef.current !== null) return;
    clearWheelPreviewTimeout();
    activePointerIdRef.current = id;
    isPointerPreviewingRef.current = true;
    isDraggingRef.current = false;
    previewStartClientXRef.current = x;
    pointerSampleRef.current = {x, stamp};
  }, [clearWheelPreviewTimeout]);

  const moveDrag = useCallback((x: number, stamp: number) => {
    if (!isPointerPreviewingRef.current) return;
    clearWheelPreviewTimeout();
    const deltaX = x - previewStartClientXRef.current;
    if (!isDraggingRef.current) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
      isDraggingRef.current = true;
      handleLyricPreviewStart();
    }
    const deltaTime = -(deltaX * DIRECTION) / Math.max(1, PIXELS_PER_SECOND);
    const base = previewStartTimeRef.current ?? absoluteTime;
    const previous = pointerSampleRef.current;
    const velocity = -(x - previous.x) / Math.max(8, stamp - previous.stamp);
    pointerSampleRef.current = {x, stamp};
    handleLyricPreviewTime(base + deltaTime, velocity);
  }, [absoluteTime, clearWheelPreviewTimeout, handleLyricPreviewStart, handleLyricPreviewTime]);

  const endDrag = useCallback((x: number, stamp: number, cancelled = false) => {
    if (!isPointerPreviewingRef.current) return;
    if (!cancelled && x !== pointerSampleRef.current.x) moveDrag(x, stamp);
    clearWheelPreviewTimeout();
    const moved = isDraggingRef.current;
    isPointerPreviewingRef.current = false;
    isDraggingRef.current = false;
    activePointerIdRef.current = null;
    if (moved) handleLyricPreviewEnd(!cancelled);
  }, [moveDrag, clearWheelPreviewTimeout, handleLyricPreviewEnd]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Native touch listeners below own touch on iOS/Android. Do not double it
    // through compatibility PointerEvents or depend on touch pointer capture.
    if (e.pointerType === 'touch' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    beginDrag(e.clientX, e.timeStamp, e.pointerId);
    try {e.currentTarget.setPointerCapture(e.pointerId);} catch {}
  }, [beginDrag]);
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault(); moveDrag(e.clientX, e.timeStamp);
  }, [moveDrag]);
  const handlePointerUpOrCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || activePointerIdRef.current !== e.pointerId) return;
    if (e.type === 'pointerleave' && e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.preventDefault(); endDrag(e.clientX, e.timeStamp, e.type !== 'pointerup');
    try {e.currentTarget.releasePointerCapture(e.pointerId);} catch {}
  }, [endDrag]);

  const touchHandlers = useRef({beginDrag, moveDrag, endDrag});
  touchHandlers.current = {beginDrag, moveDrag, endDrag};
  useEffect(() => {
    const surface = gestureSurfaceRef.current;
    if (!surface) return;
    let activeTouch: number | null = null;
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 1 || activeTouch !== null) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      activeTouch = touch.identifier;
      if (event.cancelable) event.preventDefault();
      touchHandlers.current.beginDrag(touch.clientX, event.timeStamp, touch.identifier);
    };
    const move = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find(t => t.identifier === activeTouch);
      if (!touch) return;
      if (event.cancelable) event.preventDefault();
      touchHandlers.current.moveDrag(touch.clientX, event.timeStamp);
    };
    const end = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find(t => t.identifier === activeTouch);
      if (!touch) return;
      if (event.cancelable) event.preventDefault();
      activeTouch = null;
      touchHandlers.current.endDrag(touch.clientX, event.timeStamp, event.type === 'touchcancel');
    };
    surface.addEventListener('touchstart', start, {passive: false, capture: true});
    surface.addEventListener('touchmove', move, {passive: false, capture: true});
    surface.addEventListener('touchend', end, {passive: false, capture: true});
    surface.addEventListener('touchcancel', end, {passive: false, capture: true});
    return () => {
      surface.removeEventListener('touchstart', start, true); surface.removeEventListener('touchmove', move, true);
      surface.removeEventListener('touchend', end, true); surface.removeEventListener('touchcancel', end, true);
    };
  }, [sessionRevision]);

  // Wheel 预览交互（Phase 1）
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // 使用 deltaX 为主；若未提供则可退化到 deltaY（触控板垂直）
    const nativeEvent = e.nativeEvent as unknown as WheelEvent;
    const rawDelta = normalizeWheelDeltaX(nativeEvent);
    const dx = rawDelta !== 0 ? rawDelta : nativeEvent.deltaY;
    if (!dx) return;
    e.preventDefault();
    // 进入临时预览态
    if (lastPreviewTimeRef.current === null) {
      handleLyricPreviewStart();
    }
    const base = lastPreviewTimeRef.current ?? visualAbsoluteTimeRef.current;
    const deltaTime = -(dx * DIRECTION) / Math.max(1, PIXELS_PER_SECOND);
    const nextTime = base + deltaTime;
    handleLyricPreviewTime(nextTime);
    clearWheelPreviewTimeout();
    wheelPreviewTimeoutRef.current = setTimeout(() => {
      handleLyricPreviewEnd();
    }, 240);
    // 惯性与持续滚轮在此不自动结束；由用户停止滚轮后短暂停顿再松手也可
  }, [normalizeWheelDeltaX, handleLyricPreviewStart, handleLyricPreviewTime, handleLyricPreviewEnd, clearWheelPreviewTimeout]);

  const handleSmoothLoopTimeUpdate = useCallback((time: number) => {
    // If user is actively preview-scrolling, don't override UI time with loop-driven updates
    if (isPreviewMode) return;
    const absolute = loopCount * duration + time;
    commitTimeUpdate(time, absolute, true);
  }, [commitTimeUpdate, isPreviewMode, loopCount, duration]);

  const handleVisibilityChange = useCallback((isVisible: boolean, wasHidden: boolean) => {
    if (isVisible && wasHidden) {
      addDebugLog('Page became visible after being hidden');
    }
  }, [addDebugLog]);

  const handleTimeSync = useCallback((expectedTime: number, actualTime: number) => {
    if (Math.abs(expectedTime - actualTime) > 0.5) {
      const sample = timelineStore.sampleAudioTime();
      commitTimeUpdate(sample.display, sample.absolute);
      visualAbsoluteTimeRef.current = sample.absolute;
      addDebugLog(`Time synced: ${actualTime.toFixed(2)} -> ${expectedTime.toFixed(2)}`);
    }
  }, [addDebugLog, commitTimeUpdate]);

  // Keep the unlocked native media element and both WebGL contexts. Reset only
  // recording state; appearance edits never enter this session boundary.
  useLayoutEffect(() => {
    gesturePlayGeneration.current++;
    timelineStore.reset();
    if (wheelPreviewTimeoutRef.current) clearTimeout(wheelPreviewTimeoutRef.current);
    wheelPreviewTimeoutRef.current = null;
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
    isPointerPreviewingRef.current = isDraggingRef.current = false;
    activePointerIdRef.current = null;
    previewStartTimeRef.current = lastPreviewTimeRef.current = null;
    audioTimeRef.current = visualAbsoluteTimeRef.current = 0;
    lastCommittedTimeRef.current = {stamp: 0, display: 0};
    setInternalScrollVelocity(0); handleScrollVelocityChange(0);
    setAudioTime(0); setLoopCount(0); setPreviewTime(null);
    setDuration(mediaDuration); setIsReady(false); setIsIntroPlaying(false);
    setIsPlaying(startingIntent.current.entered && startingIntent.current.initialPlaying);
    setHasUserInteracted(startingIntent.current.entered);
    setDisplayedModelPath(''); setFailedModelPath('');
    setCurrentAnchor(config.timeline[0].anchor);
    setSeekSignal(previous => previous + 1);
    return () => { if (wheelPreviewTimeoutRef.current) clearTimeout(wheelPreviewTimeoutRef.current); };
  }, [sessionRevision, config, mediaDuration, setInternalScrollVelocity, handleScrollVelocityChange]);

  // 不再需要平滑渲染 useEffect，使用 displayTime 直接计算

  // 计算当前歌词行和锚字（使用 displayTime）
  const currentLineIndex = useMemo(
    () => findCurrentLineIndex(lyrics, displayTime, duration),
    [lyrics, displayTime, duration]
  );

  // 使用精确时间轴查找锚字
  const findAnchorCharByTime = useCallback((currentTime: number): string => {
    if (timeline.length === 0) return '心'; // 默认值

    const loopTime = loopPhase(currentTime, duration);

    // 从时间轴中找到当前时间对应的锚字
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (loopTime >= timeline[i].time) {
        return timeline[i].anchor;
      }
    }

    // 默认返回第一个锚字
    return timeline[0]?.anchor || '心';
  }, [timeline, duration]);

  // 保留原有的歌词行查找逻辑作为备用
  const findAnchorChar = (currentIndex: number): string => {
    if (!lyrics || lyrics.length === 0) return '心';
    for (let i = currentIndex; i >= 0; i--) {
      const text = lyrics[i].text.trim();
      if (text) return text.charAt(0);
    }
    for (let i = 0; i < lyrics.length; i++) {
      const text = lyrics[i].text.trim();
      if (text) return text.charAt(0);
    }
    return '心';
  };

  // 使用精确时间轴查找锚字（使用 displayTime）
  const anchorChar = useMemo(
    () => findAnchorCharByTime(displayTime),
    [findAnchorCharByTime, displayTime]
  );
  const resolvedAnchor = useMemo(() => resolveAnchor(anchorChar, config), [anchorChar, config]);
  const upcomingModelPath = ModelPreloader.getInstance().predictNextModel(displayTime, timeline, anchorMappings);
  useEffect(() => ModelPreloader.getInstance().retainPaths(
    [resolvedAnchor.modelPath, displayedModelPath, upcomingModelPath ?? ''].filter(Boolean)
  ), [resolvedAnchor.modelPath, displayedModelPath, upcomingModelPath]);

  // 更新锚字状态和智能预加载（仅在锚字变更时触发）
  useEffect(() => {
    if (!config) return;

    if (DEBUG_DEV) {
      console.log(`[锚字更新] ${anchorChar}`);
    }

    setCurrentAnchor(anchorChar);

    const preloader = ModelPreloader.getInstance();
    let canceled = false;
    // The visible model is loaded on demand; only warm the next distinct model.
    const timer = setTimeout(() => preloader
      .preloadNextModel(lastPreviewTimeRef.current === null ? audioTimeRef.current :
        ((lastPreviewTimeRef.current % duration) + duration) % duration, timeline, anchorMappings)
      .catch((error) => {
        console.error('[HomePage] 智能预加载失败:', error);
      })
      .finally(() => {
        if (!canceled) refreshPreloadStatus();
      }), 400);
    return () => { canceled = true; clearTimeout(timer); };
  }, [anchorChar, config, timeline, anchorMappings, refreshPreloadStatus, duration]);

  // 调试信息：显示当前锚字状态
  useEffect(() => {
    if (!DEBUG_DEV) return;

    const currentAnchorInfo = timeline.find(item => item.anchor === anchorChar);
    if (currentAnchorInfo) {
      console.log(`[当前锚字] ${anchorChar} - ${currentAnchorInfo.text} (${currentAnchorInfo.meaning})`);
    }
  }, [anchorChar, timeline]);

  // 模型预加载状态监控（仅在状态发生变化时更新）
  useEffect(() => {
    refreshPreloadStatus();
  }, [refreshPreloadStatus]);

  // RAF 驱动视觉时间（播放态）；预览态直接用 previewTime
  useEffect(() => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (!isPlaying || isPreviewMode) {
      visualAbsoluteTimeRef.current = lastPreviewTimeRef.current ?? timelineStore.sampleAudioTime().absolute;
      return;
    }
    const tick = () => {
      // Read media time through native loops and buffering, without wall-clock drift.
      visualAbsoluteTimeRef.current = timelineStore.sampleAudioTime().absolute;
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, [isPlaying, isPreviewMode, seekSignal]);

  // 如果配置或歌词正在加载，显示加载状态
  if (isConfigLoading || !config || isLyricsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <link rel="preload" href={assetUrl('/fonts/润植家康熙字典美化体.woff2')} as="font" type="font/woff2" crossOrigin="anonymous" fetchPriority="low" />
        <link rel="preload" href={assetUrl('/projects/heart-sutra.json')} as="fetch" crossOrigin="anonymous" fetchPriority="high" />
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">
            {isConfigLoading ? '加载配置中...' : '加载歌词中...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-transparent font-sans overflow-hidden opacity-100 transition-opacity duration-300">
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseSlow {
          0%, 100% { opacity: 0.75; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        .animate-pulse-slow {
          animation: pulseSlow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        /* Robustly hide scrollbar */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        /* 固定画布：禁止整个页面滚动 */
        html, body, #__next { height: 100%; overflow: hidden; }

        /* 噪点覆盖层样式 */
        .noise-overlay {
          mix-blend-mode: normal;
          pointer-events: none;
          user-select: none;
        }
        /* 噪点效果优化 */
        .noise-overlay canvas {
          image-rendering: pixelated;
          image-rendering: -moz-crisp-edges;
          image-rendering: crisp-edges;
        }

      `}</style>


      {/* Page Visibility Manager */}
      <PageVisibilityManager
        isPlaying={isPlaying}
        currentTime={audioTime}
        onVisibilityChange={handleVisibilityChange}
        onTimeSync={handleTimeSync}
      >

        {/* Audio Engine */}
        <AudioEngine
          sessionRevision={sessionRevision}
          audioElementRef={audioRef}
          audioSrc={audioSrc}
          isPlaying={hasUserInteracted && (isPlaying || isIntroPlaying)}
          isReady={isReady}
          currentTime={audioTime}
          loopCount={loopCount}
          duration={duration}
          onTimeUpdate={handleAudioTimeUpdate}
          onDurationChange={handleAudioDurationChange}
          onReady={handleAudioReady}
          onPlayStateChange={handleAudioPlayStateChange}
          onLoopComplete={handleAudioLoopComplete}
          enableWebAudio={false}
          initialTime={0}
          seekSignal={seekSignal}
        />

      
      {/* 自动播放引导 */}
      {!hasUserInteracted && <AutoPlayGuard
        title={config.project.name}
        onUserInteraction={handleUserInteraction}
        isReady={isReady}
        isPlaying={isPlaying || isIntroPlaying}
      />}
      {/* 调试叠层（开发环境） */}
      <main
        ref={gestureSurfaceRef}
        className="relative flex-grow w-full overflow-hidden flex items-center justify-center"
        style={{ visibility: hasUserInteracted ? 'visible' : 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <UnifiedLyricsAndModel
            sceneKey={sessionRevision}
            currentTime={displayTime}
            scrollTime={absoluteTime}
            scrollTimeRef={visualAbsoluteTimeRef}
            scrollVelocityRef={scrollVelocityRef}
            rotationVelocityRef={rotationVelocityRef}
            seekRevision={seekSignal}
            active={hasUserInteracted}
            duration={duration}
            isPlaying={isPlaying}
            isPreviewMode={isPreviewMode}
            currentAnchor={anchorChar}
            modelPath={resolvedAnchor.modelPath}
            onModelDisplayed={modelDisplayed}
            onModelError={setFailedModelPath}
            palette={palette}
            lyrics={lyrics}
            onSeek={handleSeek}
            onScrollVelocityChange={handleScrollVelocityChange}
            modelPreloadStatus={modelPreloadStatus}
            scrollVelocity={scrollVelocity}
            fontFamily={selectedFont || undefined}
            fontSize={fontSize}
            fontRevision={fontRevision}
          />
        </div>

        <div
          className="absolute inset-0 z-50 pointer-events-auto"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          onPointerLeave={handlePointerUpOrCancel}
          onWheel={handleWheel}
        >
          <div className="w-full h-full" />
        </div>
      </main>

      </PageVisibilityManager>

      {/* 音频播放器 */}
      <footer
        className="relative w-full flex justify-center py-8 z-20"
        style={{ visibility: hasUserInteracted ? 'visible' : 'hidden' }}
      >
        <p className="absolute top-0 left-4 right-4 text-center text-xs pointer-events-none" data-model-status
          data-anchor={anchorChar} data-rendered-character={displayedModelPath === resolvedAnchor.modelPath ? resolvedAnchor.renderedCharacter : ''}
          style={{color: palette.adjacentText}}>
          {displayedModelPath !== resolvedAnchor.modelPath ? `${failedModelPath === resolvedAnchor.modelPath ? '模型暂未加载' : '模型加载中'}：${anchorChar}` : resolvedAnchor.isPlaceholder
            ? `${resolvedAnchor.pendingReason === 'pending-simplification' ? '模型制作中' : '模型占位'}：${anchorChar}（暂用${resolvedAnchor.renderedCharacter}占位）` : ''}
        </p>
        <EnhancedAudioPlayer
          key={sessionRevision}
          accent={palette.accent}
          isPlaying={isPlaying}
          isReady={isReady}
          duration={duration}
          currentTime={displayTime}
          isBuffering={isBuffering}
          onPlayPause={handlePlayPause}
          onSeek={(time) => {
            // 支持快退与快进：显示层loopCount随目标时间重算
            const safe = Math.max(1, duration);
            const targetAbs = timeInCurrentCycle(visualAbsoluteTimeRef.current, time, safe);
            handleSeek(targetAbs);
          }}
        />
      </footer>

    </div>
  );
}
