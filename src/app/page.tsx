'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import timelineStore from '@/stores/timelineStore';
import dynamic from 'next/dynamic';
import { LRC_LYRICS } from './constants';
import useLyrics from '@/components/hooks/useLyrics';
import { useScrollVelocity } from '@/components/hooks/useScrollVelocity';
import LyricsController from '@/components/LyricsController';
import EnhancedAudioPlayer from '@/components/audio/EnhancedAudioPlayer';
import AudioEngine from '@/components/audio/AudioEngine';
import PageVisibilityManager from '@/components/audio/PageVisibilityManager';
import SmoothLoopManager from '@/components/audio/SmoothLoopManager';
import AutoPlayGuard from '@/components/AutoPlayGuard';
import ModelPreloader from '@/components/jade/ModelPreloader';
import type { LyricLine } from '@/types';
import UnifiedLyricsAndModel from '@/components/layouts/UnifiedLyricsAndModel';
const SilkR3FBackground = dynamic(() => import('@/components/backgrounds/SilkR3F'), { ssr: false });

// 调试输出开关（仅开发环境生效）
const DEBUG_DEV = process.env.NODE_ENV === 'development';
const DEFAULT_FONT_FAMILY = 'RunZhiJiaKangXiZidian';
const DEFAULT_FONT_SCALE = 1.6;

// 默认时长，待真实音频元数据加载后更新
const MOCK_DURATION = 364; // ~6 分 4 秒

// 锚字到模型的映射 - 按精确时间轴硬编码
const ANCHOR_MODEL_MAPPING = {
  // 核心锚字 - 按心经语义层级映射（精确时间轴版本）
  '观': '/models/10k_obj/101_观.obj',      // [00:11.84] 观自在菩萨 - 起点——觉知开启
  '空': '/models/10k_obj/001_空.obj',      // [00:28.87] 照见五蕴皆空 - 体悟本性
  '苦': '/models/10k_obj/045_苦.obj',      // [00:36.79] 度一切苦厄 - 觉悟之因
  '色': '/models/10k_obj/094_色.obj',      // [00:52.53] 色不异空 - 现象与本质统一
  '法': '/models/10k_obj/022_法.obj',      // [01:34.09] 是诸法空相 - 法性显现
  '生': '/models/10k_obj/019_生.obj',      // [01:38.88] 不生不灭 - 生灭寂然
  '无': '/models/10k_obj/012_无.obj',      // [01:46.77] 是故空中无色 - 空寂归无
  '死': '/models/10k_obj/020_死.obj',      // [02:20.50] 乃至无老死 - 轮回消融
  '道': '/models/10k_obj/003_道.obj',      // [02:27.05] 无苦集灭道 - 八正道总摄
  '心': '/models/10k_obj/002_心.obj',      // [03:14.10] 心无挂碍 - 安住无碍
  '悟': '/models/10k_obj/008_悟.obj',      // [03:41.27] 得阿耨多罗三藐三菩提 - 智慧圆成
  '明': '/models/10k_obj/007_明.obj',      // [03:59.06] 是大明咒 - 光明智慧
  '真': '/models/10k_obj/009_真.obj',      // [04:07.59] 真实不虚 - 终点——实相圆满
  '圆': '/models/10k_obj/001_空.obj',      // [05:22.62] 波罗揭谛 - 圆满智慧（使用空模型）
  default: '/models/10k_obj/001_空.obj'
};

// 精确时间轴锚点映射（硬编码版本）
const ANCHOR_TIMELINE = [
  { time: 11.84, anchor: '观', text: '观自在菩萨', meaning: '起点——觉知开启' },
  { time: 28.87, anchor: '空', text: '照见五蕴皆空', meaning: '体悟本性' },
  { time: 36.79, anchor: '苦', text: '度一切苦厄', meaning: '觉悟之因' },
  { time: 52.53, anchor: '色', text: '色不异空', meaning: '现象与本质统一' },
  { time: 94.09, anchor: '法', text: '是诸法空相', meaning: '法性显现' },
  { time: 98.88, anchor: '生', text: '不生不灭', meaning: '生灭寂然' },
  { time: 106.77, anchor: '无', text: '是故空中无色', meaning: '空寂归无' },
  { time: 140.50, anchor: '死', text: '乃至无老死', meaning: '轮回消融' },
  { time: 147.05, anchor: '道', text: '无苦集灭道', meaning: '八正道总摄' },
  { time: 194.10, anchor: '心', text: '心无挂碍', meaning: '安住无碍' },
  { time: 221.27, anchor: '悟', text: '得阿耨多罗三藐三菩提', meaning: '智慧圆成' },
  { time: 239.06, anchor: '明', text: '是大明咒', meaning: '光明智慧' },
  { time: 247.59, anchor: '真', text: '真实不虚', meaning: '终点——实相圆满' },
  { time: 287.91, anchor: '道', text: '故说般若波罗蜜多咒', meaning: '咒语开启' },
  { time: 322.62, anchor: '圆', text: '波罗揭谛', meaning: '圆满智慧' },
  { time: 348.83, anchor: '心', text: '菩提娑婆诃', meaning: '心性圆满' }
];

// 所有需要预加载的模型路径
const ALL_MODEL_PATHS = Object.values(ANCHOR_MODEL_MAPPING).filter(path => path !== ANCHOR_MODEL_MAPPING.default);

const findCurrentLineIndex = (lyricLines: LyricLine[], time: number, durationParam: number): number => {
  if (!lyricLines || lyricLines.length === 0) return -1;
  const base = Math.max(1, durationParam || MOCK_DURATION);
  const loopTime = time % base;
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

const getModelPath = (anchorChar: string): string => {
  return ANCHOR_MODEL_MAPPING[anchorChar] || ANCHOR_MODEL_MAPPING.default;
};

export default function HomePage() {

  // 音频相关状态 - 重构为单一时间源
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [audioTime, setAudioTime] = useState(0); // 唯一真相源：音频时间
  const [previewTime, setPreviewTime] = useState<number | null>(null); // 手动滚动预览
  const [duration, setDuration] = useState(MOCK_DURATION);
  const [audioSrc, setAudioSrc] = useState('');
  const [isIntroPlaying, setIsIntroPlaying] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loopCount, setLoopCount] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [seekSignal, setSeekSignal] = useState(0);
  // 字体选择（应用于 DOM 歌词层）
  const selectedFont = DEFAULT_FONT_FAMILY;
  const fontSize = DEFAULT_FONT_SCALE;

  // 时间-像素映射与方向（Phase 1）
  // 说明：pixelsPerSecond 控制拖拽/滚轮的灵敏度；direction=-1 表示右→左（RTL）
  const PIXELS_PER_SECOND = 12; // 再次降低速度
  const DIRECTION = 1; // 改为 LTR，因为歌词现在是竖排的，需要从左到右滚动
  const DRAG_THRESHOLD_PX = 6; // 超过阈值才进入预览拖拽，避免点击被拦截
  const RECENTER_THRESHOLD_SEC = 30; // 超过该时间位移则重置原点，避免超大 transform

  // 计算值（不用state）
  const isPreviewMode = previewTime !== null;
  const displayTime = isPreviewMode ? (previewTime % duration) : audioTime;
  // 修复：预览模式时直接使用 previewTime 作为绝对时间，避免 loopCount 不同步
  const absoluteTime = isPreviewMode ? previewTime : (loopCount * duration + displayTime);

  // 3D模型相关状态
  const { scrollVelocity, handleScrollVelocityChange } = useScrollVelocity();
  const [currentAnchor, setCurrentAnchor] = useState('心');
  const [modelPreloadStatus, setModelPreloadStatus] = useState({
    isPreloading: false,
    loaded: 0,
    total: 0,
    currentModel: '',
    nextModel: ''
  });


  const audioRef = useRef<HTMLAudioElement>(null);
  const lastUserInteractionRef = useRef<number>(0);
  const isVisibilityChangeRef = useRef<boolean>(false);
  const audioTimeRef = useRef(0);
  const lastCommittedTimeRef = useRef({ stamp: 0, display: 0 });
  const lastSeekTimeRef = useRef<number>(0);
  const seekProtectionUntilRef = useRef<number>(0);
  // RAF 渲染与相对原点（Phase 2）
  const visualAbsoluteTimeRef = useRef<number>(0);
  const visualAnchorRef = useRef<{ engineAbs: number; stamp: number }>({ engineAbs: 0, stamp: 0 });
  const rafIdRef = useRef<number | null>(null);
  const [visualAbsoluteTime, setVisualAbsoluteTime] = useState(0);
  const [originTime, setOriginTime] = useState(0);
  const lyricTrackRef = useRef<HTMLDivElement>(null);
  const lastOverlayUpdateRef = useRef<number>(0);

  const lyrics = useLyrics(LRC_LYRICS);

  const commitTimeUpdate = useCallback(
    (displayTime: number, absoluteTime: number, force: boolean = false) => {
      audioTimeRef.current = displayTime;
      const newLoopCount = Math.floor(absoluteTime / duration);

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

      // Seek 保护期：在 seek 后的短时间内，忽略非强制的更新
      if (!force && now < seekProtectionUntilRef.current) {
        return;
      }

      // 写入全局时间 store
      timelineStore.setAudioTime(displayTime, absoluteTime);

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
        // Seek 保护期 500ms
        seekProtectionUntilRef.current = now + 500;
        lastSeekTimeRef.current = now;
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

  // 当前用于映射位移的绝对时间（预览优先，播放态用视觉时间）
  const mappedAbsoluteTime = useMemo(() => {
    if (isPreviewMode && previewTime != null) return previewTime as number;
    return visualAbsoluteTime;
  }, [isPreviewMode, previewTime, visualAbsoluteTime]);

  // 歌词轨道 transform（改为命令式更新以减少 setState 频率）
  const updateLyricTrackTransform = useCallback((absTime: number) => {
    const node = lyricTrackRef.current;
    if (!node) return;
    const relative = (absTime - originTime);
    const x = DIRECTION * -(relative * PIXELS_PER_SECOND);
    node.style.transform = `translate3d(${x}px, 0, 0)`;
  }, [originTime]);

  // 预览拖拽状态（Phase 1）
  const isPointerPreviewingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const previewStartClientXRef = useRef(0);
  const previewStartTimeRef = useRef<number | null>(null);
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
    const preloader = ModelPreloader.getInstance();
    const status = preloader.getCacheStatus();
    const currentModelPath = getModelPath(currentAnchor);
    const nextModelPath = preloader.predictNextModel(audioTimeRef.current, ANCHOR_TIMELINE, ANCHOR_MODEL_MAPPING) || '';

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
  }, [currentAnchor]);

  // 页面初始化预加载逻辑
  useEffect(() => {
    const initializePreloading = async () => {
      try {
        console.log('[HomePage] 开始页面初始化预加载...');
        setModelPreloadStatus(prev => ({ ...prev, isPreloading: true }));
        
        const preloader = ModelPreloader.getInstance();
        
        // 确定优先级模型（前3个锚字对应的模型）
        const priorityPaths = ANCHOR_TIMELINE.slice(0, 3).map(item => 
          ANCHOR_MODEL_MAPPING[item.anchor]
        ).filter(Boolean);
        
        console.log('[HomePage] 优先级模型:', priorityPaths);
        
        // 开始智能预加载
        await preloader.preloadAllModels(ALL_MODEL_PATHS, priorityPaths);
        
        // 更新状态
        const status = preloader.getCacheStatus();
        setModelPreloadStatus({
          isPreloading: false,
          loaded: status.loaded,
          total: status.total,
          currentModel: getModelPath(currentAnchor),
          nextModel: ''
        });
        
        console.log('[HomePage] ✅ 页面初始化预加载完成:', status);
      } catch (error) {
        console.error('[HomePage] ❌ 页面初始化预加载失败:', error);
        setModelPreloadStatus(prev => ({ ...prev, isPreloading: false }));
      }
    };

    // 延迟一点开始预加载，避免阻塞页面渲染
    const timer = setTimeout(initializePreloading, 100);
    return () => clearTimeout(timer);
  }, []);

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
  useEffect(() => {
    try {
      const audioPath = '/audio/心经_2.mp3';
      DEBUG_DEV && console.log('[HomePage] Setting audio source:', audioPath);
      setAudioSrc(audioPath);
      
      setAudioTime(0);
      setLoopCount(0);
      setPreviewTime(null);
      if (audioRef.current) audioRef.current.currentTime = 0;
    } catch (error) {
      console.error('[Audio] Failed to set audio source:', error);
    }
  }, []);

  // 用户交互处理
  const handleUserInteraction = useCallback(() => {
    addDebugLog(`用户交互触发，移动端: ${isMobile}`);
    lastUserInteractionRef.current = Date.now();
    setHasUserInteracted(true);
    setIsIntroPlaying(true);

    // Start from the beginning for better user experience
    const initialTime = 0;
    const base = Math.max(1, duration);
    // 统一从第一轮开始，避免初始相位差
    const initialAbsolute = 0 * base + initialTime;
    setLoopCount(0);
    commitTimeUpdate(initialTime, initialAbsolute, true);
  }, [isMobile, addDebugLog, commitTimeUpdate]);

  // 播放/暂停控制
  const handlePlayPause = useCallback(() => {
    if (!isReady) return;

    // Toggle playing state - AudioEngine will handle the actual play/pause
    setIsPlaying(prev => !prev);
  }, [isReady]);

  // 跳转处理
  const handleSeek = useCallback((absoluteTime: number) => {
    const safeDuration = Math.max(1, duration);
    const displayTime = absoluteTime % safeDuration;

    // 只调用 commitTimeUpdate，它会内部更新 loopCount
    // 不要重复调用 setLoopCount，避免状态冲突
    commitTimeUpdate(displayTime, absoluteTime, true);
    // 立即同步视觉时间与位移，保证进度条/歌词/模型同跳
    visualAbsoluteTimeRef.current = absoluteTime;
    setVisualAbsoluteTime(absoluteTime);
    updateLyricTrackTransform(absoluteTime);
  }, [duration, commitTimeUpdate]);

  // AudioEngine event handlers
  const handleAudioTimeUpdate = useCallback((displayTime: number, absoluteTime: number) => {
    commitTimeUpdate(displayTime, absoluteTime);
    // 记录引擎时间作为 RAF 外推锚点
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    visualAnchorRef.current = { engineAbs: absoluteTime, stamp: now };
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
    if (playing) {
      setIsIntroPlaying(false);
    }
  }, []);

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
    previewStartTimeRef.current = isPreviewMode ? (previewTime as number) : absoluteTime;
  }, [clearWheelPreviewTimeout, isPreviewMode, previewTime, absoluteTime]);

  const handleLyricPreviewTime = useCallback((time: number) => {
    // 设置预览时间，不 seek
    console.log('[handleLyricPreviewTime]', { time, isPlaying });
    setPreviewTime(time);
    const safeDuration = Math.max(1, duration);
    const displayTime = ((time % safeDuration) + safeDuration) % safeDuration;
    timelineStore.setVisualTime(displayTime, time);
  }, [duration, isPlaying]);

  const handleLyricPreviewEnd = useCallback(() => {
    clearWheelPreviewTimeout();
    // 预览结束：执行一次性 seek 到预览终点
    console.log('[handleLyricPreviewEnd] 预览结束并执行一次性 seek');
    const targetAbs = isPreviewMode && previewTime != null ? previewTime : absoluteTime;
    setPreviewTime(null);
    // 统一入口：以绝对时间 seek
    if (typeof targetAbs === 'number' && !Number.isNaN(targetAbs)) {
      handleSeek(targetAbs);
    }
  }, [clearWheelPreviewTimeout, isPreviewMode, previewTime, absoluteTime, handleSeek]);

  // Pointer 预览交互（Phase 1）
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // 仅主键/触控
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    clearWheelPreviewTimeout();
    isPointerPreviewingRef.current = true;
    isDraggingRef.current = false;
    previewStartClientXRef.current = e.clientX;
    // 不立刻进入预览，等待超过阈值
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerPreviewingRef.current) return;
    clearWheelPreviewTimeout();
    const deltaX = event.clientX - previewStartClientXRef.current;
    if (!isDraggingRef.current) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
      // 超过阈值，开始预览并捕获指针
      isDraggingRef.current = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {}
      event.preventDefault();
      handleLyricPreviewStart();
    } else {
      event.preventDefault();
    }
    const deltaTime = -(deltaX * DIRECTION) / Math.max(1, PIXELS_PER_SECOND);
    const base = previewStartTimeRef.current ?? absoluteTime;
    const nextTime = base + deltaTime;
    handleLyricPreviewTime(nextTime);
  }, [absoluteTime, handleLyricPreviewTime]);

  const handlePointerUpOrCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerPreviewingRef.current) return;
    clearWheelPreviewTimeout();
    if (isDraggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      e.preventDefault();
      handleLyricPreviewEnd();
    }
    isPointerPreviewingRef.current = false;
    isDraggingRef.current = false;
  }, [handleLyricPreviewEnd]);

  // Wheel 预览交互（Phase 1）
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // 使用 deltaX 为主；若未提供则可退化到 deltaY（触控板垂直）
    const nativeEvent = e.nativeEvent as unknown as WheelEvent;
    const rawDelta = normalizeWheelDeltaX(nativeEvent);
    const dx = rawDelta !== 0 ? rawDelta : nativeEvent.deltaY;
    if (!dx) return;
    e.preventDefault();
    // 进入临时预览态
    if (!isPreviewMode) {
      handleLyricPreviewStart();
    }
    const base = isPreviewMode && previewTime != null ? previewTime : absoluteTime;
    const deltaTime = -(dx * DIRECTION) / Math.max(1, PIXELS_PER_SECOND);
    const nextTime = base + deltaTime;
    handleLyricPreviewTime(nextTime);
    clearWheelPreviewTimeout();
    wheelPreviewTimeoutRef.current = setTimeout(() => {
      handleLyricPreviewEnd();
    }, 240);
    // 惯性与持续滚轮在此不自动结束；由用户停止滚轮后短暂停顿再松手也可
  }, [absoluteTime, isPreviewMode, previewTime, handleLyricPreviewStart, handleLyricPreviewTime, handleLyricPreviewEnd, clearWheelPreviewTimeout]);

  const handleSmoothLoopTimeUpdate = useCallback((time: number) => {
    // If user is actively preview-scrolling, don't override UI time with loop-driven updates
    if (isPreviewMode) return;
    const absolute = loopCount * duration + time;
    commitTimeUpdate(time, absolute, true);
  }, [commitTimeUpdate, isPreviewMode, loopCount, duration]);

  const handleVisibilityChange = useCallback((isVisible: boolean, wasHidden: boolean) => {
    isVisibilityChangeRef.current = true;
    if (isVisible && wasHidden) {
      addDebugLog('Page became visible after being hidden');
    }
  }, [addDebugLog]);

  const handleTimeSync = useCallback((expectedTime: number, actualTime: number) => {
    if (!isVisibilityChangeRef.current && Math.abs(expectedTime - actualTime) > 0.5) {
      const absolute = loopCount * duration + expectedTime;
      commitTimeUpdate(expectedTime, absolute, true);
      addDebugLog(`Time synced: ${actualTime.toFixed(2)} -> ${expectedTime.toFixed(2)}`);
    }
    isVisibilityChangeRef.current = false;
  }, [addDebugLog, commitTimeUpdate, loopCount, duration]);

  // 设置音频源时重置状态
  useEffect(() => {
    setAudioTime(0);
    setLoopCount(0);
    setPreviewTime(null);
    setIsPlaying(false);
    setIsReady(false);
    audioTimeRef.current = 0;
    lastCommittedTimeRef.current = { stamp: 0, display: 0 };
    visualAbsoluteTimeRef.current = 0;
    setVisualAbsoluteTime(0);
    setOriginTime(0);
  }, [audioSrc]);

  // 不再需要平滑渲染 useEffect，使用 displayTime 直接计算

  // 计算当前歌词行和锚字（使用 displayTime）
  const currentLineIndex = useMemo(
    () => findCurrentLineIndex(lyrics, displayTime, duration),
    [lyrics, displayTime, duration]
  );

  // 使用精确时间轴查找锚字
  const findAnchorCharByTime = (currentTime: number): string => {
    const loopTime = currentTime % duration;
    
    // 从时间轴中找到当前时间对应的锚字
    for (let i = ANCHOR_TIMELINE.length - 1; i >= 0; i--) {
      if (loopTime >= ANCHOR_TIMELINE[i].time) {
        return ANCHOR_TIMELINE[i].anchor;
      }
    }
    
    // 默认返回第一个锚字
    return ANCHOR_TIMELINE[0].anchor;
  };

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
    [displayTime, duration]
  );

  // 更新锚字状态和智能预加载（仅在锚字变更时触发）
  useEffect(() => {
    if (anchorChar === currentAnchor) return;

    if (DEBUG_DEV) {
      console.log(`[锚字更新] ${currentAnchor} -> ${anchorChar}`);
    }

    setCurrentAnchor(anchorChar);

    const preloader = ModelPreloader.getInstance();
    preloader
      .preloadNextModel(audioTimeRef.current, ANCHOR_TIMELINE, ANCHOR_MODEL_MAPPING)
      .catch((error) => {
        console.error('[HomePage] 智能预加载失败:', error);
      })
      .finally(() => {
        refreshPreloadStatus();
      });
  }, [anchorChar, currentAnchor, refreshPreloadStatus]);

  // 调试信息：显示当前锚字状态
  useEffect(() => {
    if (!DEBUG_DEV) return;

    const currentAnchorInfo = ANCHOR_TIMELINE.find(item => item.anchor === anchorChar);
    if (currentAnchorInfo) {
      console.log(`[当前锚字] ${anchorChar} - ${currentAnchorInfo.text} (${currentAnchorInfo.meaning})`);
    }
  }, [anchorChar]);

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
      const abs = (isPreviewMode && previewTime != null) ? (previewTime as number) : (absoluteTime as number);
      visualAbsoluteTimeRef.current = abs;
      setVisualAbsoluteTime((prev) => {
        // 降低 overlay 刷新频率
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - lastOverlayUpdateRef.current > 120) {
          lastOverlayUpdateRef.current = now;
          return abs;
        }
        return prev;
      });
      updateLyricTrackTransform(abs);
      return;
    }
    const tick = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const { engineAbs, stamp } = visualAnchorRef.current;
      const dtSec = Math.max(0, (now - stamp) / 1000);
      const expected = engineAbs + dtSec;
      visualAbsoluteTimeRef.current = expected;
      // 轨道命令式更新
      updateLyricTrackTransform(expected);
      // 调试叠层节流更新
      setVisualAbsoluteTime((prev) => {
        if (now - lastOverlayUpdateRef.current > 120) {
          lastOverlayUpdateRef.current = now;
          return expected;
        }
        return prev;
      });
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, [isPlaying, isPreviewMode, previewTime, absoluteTime, updateLyricTrackTransform]);

  // 原点重置，避免超大位移
  useEffect(() => {
    const current = isPreviewMode && previewTime != null ? (previewTime as number) : visualAbsoluteTimeRef.current;
    if (Math.abs(current - originTime) > RECENTER_THRESHOLD_SEC) {
      setOriginTime(current);
      // 重定位轨道，避免跳动
      updateLyricTrackTransform(current);
    }
  }, [isPreviewMode, previewTime, originTime, updateLyricTrackTransform]);

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

        /* 注册自定义字体（来自 public/fonts） */
        @font-face {
          font-family: 'YanShiYouRanXiaoKai2';
          src: url('/fonts/YanShiYouRanXiaoKai-2.ttf') format('truetype');
          font-display: swap;
        }
        @font-face {
          font-family: 'SlidefuRegular2';
          src: url('/fonts/Slidefu-Regular-2.ttf') format('truetype');
          font-display: swap;
        }
        @font-face {
          font-family: 'NanXiXinYueSong2025';
          src: url('/fonts/2025南西新月宋-标准简体.ttf') format('truetype');
          font-display: swap;
        }
        @font-face {
          font-family: 'NanXiYuQingSong';
          src: url('/fonts/南西玉清宋.ttf') format('truetype');
          font-display: swap;
        }
        @font-face {
          font-family: 'RunZhiJiaKangXiZidian';
          src: url('/fonts/润植家康熙字典美化体.ttf') format('truetype');
          font-display: swap;
        }
        @font-face {
          font-family: 'HuiWenZhuDiDiWuHaoMingChao';
          src: url('/fonts/汇文筑地五号明朝体.otf') format('opentype');
          font-display: swap;
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

        {/* Smooth Loop Manager */}
        {typeof window !== 'undefined' && (window as any).__audioElement && (
          <SmoothLoopManager
            audioElement={(window as any).__audioElement}
            isPlaying={isPlaying}
            duration={duration}
            currentTime={audioTime}
            onLoopComplete={handleAudioLoopComplete}
            onTimeUpdate={handleSmoothLoopTimeUpdate}
            enableGaplessLoop={false}
            loopOverlapTime={0.5}
          />
        )}
      
      {/* 自动播放引导 */}
      <AutoPlayGuard 
        onUserInteraction={handleUserInteraction}
        isReady={isReady}
        isPlaying={isPlaying || isIntroPlaying}
      />
      {/* 调试叠层（开发环境） */}
      <main className="relative flex-grow w-full overflow-hidden flex items-center justify-center">
        <SilkR3FBackground
          speed={4.9}
          scale={1}
          noiseIntensity={1.3}
          rotation={2.42}
          color="1f2e38"
          style={{ zIndex: 0 }}
        />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <UnifiedLyricsAndModel
            currentTime={displayTime}
            scrollTime={absoluteTime}
            duration={duration}
            isPlaying={isPlaying}
            currentAnchor={currentAnchor}
            lyrics={lyrics}
            onSeek={handleSeek}
            onScrollVelocityChange={handleScrollVelocityChange}
            modelPreloadStatus={modelPreloadStatus}
            scrollVelocity={scrollVelocity}
            fontFamily={selectedFont || undefined}
            fontSize={fontSize}
          />
        </div>

        <div
          className="absolute inset-0 z-50 pointer-events-auto"
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
      <footer className="w-full flex justify-center py-8 z-20">
        <EnhancedAudioPlayer
          isPlaying={isPlaying}
          isReady={isReady}
          duration={duration}
          currentTime={displayTime}
          isBuffering={isBuffering}
          onPlayPause={handlePlayPause}
          onSeek={(time) => {
            // 支持快退与快进：显示层loopCount随目标时间重算
            const safe = Math.max(1, duration);
            const targetAbs = Math.floor((visualAbsoluteTimeRef.current - (visualAbsoluteTimeRef.current % safe)) / safe) * safe + time;
            handleSeek(targetAbs);
          }}
        />
      </footer>

    </div>
  );
}
