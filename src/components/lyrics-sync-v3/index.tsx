/**
 * LyricsSync-v3 - 主组件
 * 集成所有模块，提供完整的歌词同步体验
 */

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AudioEngine } from './AudioEngine';
import { Timeline } from './Timeline';
import { ScrollEngine } from './ScrollEngine';
import { SyncController } from './SyncController';
import { AnchorDisplay } from './UI/AnchorDisplay';
import { LyricRenderer } from './UI/LyricRenderer';
import { ProgressBar } from './UI/ProgressBar';

import {
  LYRICS_SYNC_V3_CONFIG,
  Lyric,
  SyncState,
  RenderState,
  DebugPanelState,
  LyricsSyncV3Events
} from './types';

// LRC文件路径
const LRC_FILE_PATH = '/lyrics/心经.lrc';
const AUDIO_FILE_PATH = '/audio/心经.mp3';

export const LyricsSyncV3: React.FC = () => {
  // 模块引用
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const scrollEngineRef = useRef<ScrollEngine | null>(null);
  const syncControllerRef = useRef<SyncController | null>(null);

  // 容器引用
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null); // 为 LyricRenderer 提供引用
  const audioRef = useRef<HTMLAudioElement>(null);

  // 状态管理
  const [lyrics, setLyrics] = useState<Lyric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const [currentAnchor, setCurrentAnchor] = useState('观');
  const [syncState, setSyncState] = useState<SyncState>(SyncState.AUTO_PLAY);
  const [renderState, setRenderState] = useState<RenderState>({
    currentAnchor: '观',
    displayedLyrics: [],
    progressPercentage: 0,
    isTransitioning: false
  });
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugPanelState, setDebugPanelState] = useState<DebugPanelState>({
    isVisible: false,
    currentMetrics: {
      stateTransitions: {},
      syncError: {
        p50: 0,
        p95: 0,
        max: 0,
        samples: [],
        lastUpdate: 0
      },
      rendering: {
        uiDiffCount: 0,
        layoutChangeCount: 0,
        frameDropCount: 0
      }
    },
    configOverride: {},
    isRecording: false,
    recordedData: []
  });

  // 初始化模块
  const initializeModules = useCallback(() => {
    console.log('🎵 LyricsSyncV3: 开始初始化模块...');

    if (!audioRef.current) {
      console.error('🎵 LyricsSyncV3: 音频元素引用不存在');
      return;
    }

    try {
      console.log('🎵 创建 AudioEngine...');
      // 创建 AudioEngine
      audioEngineRef.current = new AudioEngine(AUDIO_FILE_PATH, LYRICS_SYNC_V3_CONFIG);
      console.log('🎵 AudioEngine 创建成功');

      console.log('🎵 创建 Timeline...');
      // 创建 Timeline
      timelineRef.current = new Timeline(LYRICS_SYNC_V3_CONFIG);
      console.log('🎵 Timeline 创建成功');

      console.log('🎵 创建 ScrollEngine...');
      // 创建 ScrollEngine
      scrollEngineRef.current = new ScrollEngine(LYRICS_SYNC_V3_CONFIG);
      console.log('🎵 ScrollEngine 创建成功');

      console.log('🎵 创建 SyncController...');
      // 创建 SyncController
      syncControllerRef.current = new SyncController(
        audioEngineRef.current,
        timelineRef.current,
        scrollEngineRef.current,
        LYRICS_SYNC_V3_CONFIG
      );
      console.log('🎵 SyncController 创建成功');

      console.log('🎵 设置事件监听...');
      // 设置事件监听
      setupEventListeners();
      console.log('🎵 事件监听设置完成');

      console.log('🎵 设置滚动容器...');
      // 设置滚动容器
      if (scrollEngineRef.current && scrollContainerRef.current) {
        scrollEngineRef.current.setContainer(scrollContainerRef.current);
        console.log('🎵 滚动容器设置完成');
      } else {
        console.warn('🎵 滚动容器设置失败: 引用不存在');
      }

      console.log('🎵 LyricsSyncV3: 所有模块初始化完成');
    } catch (error) {
      console.error('🎵 LyricsSyncV3: 模块初始化失败', error);
      setLoadError(`初始化失败: ${error}`);
    }
  }, []);

  // 设置事件监听器
  const setupEventListeners = useCallback(() => {
    const audioEngine = audioEngineRef.current;
    const timeline = timelineRef.current;
    const scrollEngine = scrollEngineRef.current;
    const syncController = syncControllerRef.current;

    if (!audioEngine || !timeline || !scrollEngine || !syncController) return;

    // AudioEngine 事件 - 循环现在由SyncController处理
    // audioEngine.on('onLoopDetected', (wrapTime: number) => {
    //   console.log('🔄 循环检测', wrapTime.toFixed(2));
    //
    //   // 重置当前歌词索引和锚字
    //   setCurrentLyricIndex(0);
    //   setCurrentAnchor('观');
    // });

    // SyncController 事件
    syncController.on('onStateChange', (newState: SyncState, oldState: SyncState) => {
      console.log('🔄 状态变化', oldState, '→', newState);
      setSyncState(newState);
    });

    // SyncController 循环事件
    syncController.on('onLoopDetected', (wrapTime: number) => {
      console.log('🔄 循环检测', wrapTime.toFixed(2));
      // 循环状态重置由SyncController自动处理，无需手动重置
    });

    // SyncController 事件 - 优化锚字更新，避免过度触发
    syncController.on('onLyricChange', (lyric: Lyric, index: number) => {
      console.log('🎤 歌词变化', index, lyric.text);
      setCurrentLyricIndex(index);
      setCurrentAnchor(lyric.anchor || lyric.text?.[0] || '观');
      setRenderState(prev => ({
        ...prev,
        currentAnchor: lyric.anchor || lyric.text?.[0] || '观',
        isTransitioning: true
      }));

      // 短暂延迟后取消过渡状态
      setTimeout(() => {
        setRenderState(prev => ({
          ...prev,
          isTransitioning: false
        }));
      }, 300);
    });

      syncController.on('onSyncError', (error: number, strategy: string) => {
      console.warn('🔄 同步误差超限', error.toFixed(2) + 'ms', strategy);
    });

    syncController.on('onPerformanceUpdate', (metrics: any) => {
      setDebugPanelState(prev => ({
        ...prev,
        currentMetrics: metrics
      }));
    });

    // 监听滚动引擎事件
    scrollEngine.on('onUserScroll', (data: { scrollTop: number; velocity: number }) => {
      console.log('📜 用户滚动，同步到音频时间', data);

      // 将滚动位置映射到音频时间（双向同步）- 移除!isPlaying限制
      if (timelineRef.current && audioEngineRef.current) {
        const scrollMetrics = scrollEngineRef.current.getMetrics();
        const syncController = syncControllerRef.current;

        if (syncController) {
          // 使用SyncController的滚动到时间映射方法
          const mappedTime = syncController.mapScrollToTime(data.scrollTop, scrollMetrics);

          if (mappedTime !== undefined && mappedTime >= 0) {
            audioEngineRef.current.seek(mappedTime);
            setCurrentTime(mappedTime);

            // 更新歌词索引和锚字
            const newIndex = timelineRef.current.getIndexForTime(mappedTime);
            if (newIndex >= 0 && newIndex !== currentLyricIndex) {
              setCurrentLyricIndex(newIndex);
              const lyric = timelineRef.current.getLyric(newIndex);
              if (lyric) {
                setCurrentAnchor(lyric.anchor || lyric.text?.[0] || '观');
              }
            }
          }
        }
      }
    });

    // 添加高频时间更新监听器，确保锚字和歌词及时更新
    const timeUpdateInterval = setInterval(() => {
      if (audioEngine && timeline) {
        const currentTime = audioEngine.getCurrentTime();
        const newIndex = timeline.getIndexForTime(currentTime);

        if (newIndex >= 0 && newIndex !== currentLyricIndex) {
          const lyric = timeline.getLyric(newIndex);
          if (lyric) {
            console.log('🔄 主组件检测到歌词变化', newIndex, lyric.text);
            setCurrentLyricIndex(newIndex);
            setCurrentAnchor(lyric.anchor || lyric.text?.[0] || '观');
          }
        }
      }
    }, 200); // 每200ms检查一次

    // 清理函数
    return () => {
      clearInterval(timeUpdateInterval);
    };

    syncController.on('onSyncError', (error: number, strategy: string) => {
      console.warn('🔄 同步误差超限', error.toFixed(2) + 'ms', strategy);
    });

    syncController.on('onPerformanceUpdate', (metrics: any) => {
      setDebugPanelState(prev => ({
        ...prev,
        currentMetrics: metrics
      }));
    });

    // 监听滚动引擎事件 - 修复滚动控制功能
    scrollEngine.on('onUserScroll', (data: { scrollTop: number; velocity: number }) => {
      console.log('📜 用户滚动，同步到音频时间', data);

      // 将滚动位置映射到音频时间（双向同步）- 移除!isPlaying限制
      if (timelineRef.current && audioEngineRef.current) {
        const scrollMetrics = scrollEngineRef.current.getMetrics();
        const syncController = syncControllerRef.current;

        if (syncController) {
          // 使用SyncController的滚动到时间映射方法
          const mappedTime = syncController.mapScrollToTime(data.scrollTop, scrollMetrics);

          if (mappedTime !== undefined && mappedTime >= 0) {
            audioEngineRef.current.seek(mappedTime);
            setCurrentTime(mappedTime);

            // 更新歌词索引和锚字
            const newIndex = timelineRef.current.getIndexForTime(mappedTime);
            if (newIndex >= 0 && newIndex !== currentLyricIndex) {
              setCurrentLyricIndex(newIndex);
              const lyric = timelineRef.current.getLyric(newIndex);
              if (lyric) {
                setCurrentAnchor(lyric.anchor || lyric.text?.[0] || '观');
              }
            }
          }
        }
      }
    });
  }, []);

  // 加载歌词数据
  const loadLyrics = useCallback(async () => {
    try {
      setLoadError(null);
      setIsLoading(true);

      console.log('📅 开始加载歌词...');

      // 检查 Timeline 是否已初始化
      const timeline = timelineRef.current;
      if (!timeline) {
        console.error('📅 Timeline 模块未初始化');
        throw new Error('Timeline 模块未初始化');
      }
      console.log('📅 Timeline 模块已初始化');

      const resolvedUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${encodeURI(LRC_FILE_PATH)}`
        : LRC_FILE_PATH;

      console.log('📅 正在获取歌词文件:', resolvedUrl);

      const response = await fetch(resolvedUrl, { cache: 'no-store' });
      if (!response.ok) {
        console.error('📅 歌词文件获取失败:', response.status, response.statusText);
        throw new Error(`加载歌词失败：${response.status} ${response.statusText}`);
      }

      const lrcContent = await response.text();
      console.log('📅 歌词文件获取成功，内容长度:', lrcContent.length);

      if (lrcContent.trim().length === 0) {
        throw new Error('歌词文件内容为空');
      }

      console.log('📅 开始解析 LRC 内容...');
      const parsedLyrics = timeline.parseLRC(lrcContent);
      console.log('📅 LRC 解析完成，歌词行数:', parsedLyrics.length);

      if (parsedLyrics.length === 0) {
        throw new Error('未能解析出任何歌词内容');
      }

      setLyrics(parsedLyrics);

      // 验证数据
      const validation = timeline.validateData();
      if (!validation.isValid) {
        console.warn('📅 歌词数据验证失败', validation.errors);
      }

      console.log('📅 歌词加载完成', {
        count: parsedLyrics.length,
        metrics: timeline.getMetrics(),
        firstLyric: parsedLyrics[0],
        lastLyric: parsedLyrics[parsedLyrics.length - 1]
      });
    } catch (error) {
      console.error('📅 歌词加载失败', error);
      setLoadError(error instanceof Error ? error.message : '加载歌词时出错');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化音频播放和同步
  const initializeAudio = useCallback(async () => {
    const audioEngine = audioEngineRef.current;
    const syncController = syncControllerRef.current;
    if (!audioEngine || !syncController || !lyrics.length) return;

    try {
      console.log('🎵 开始初始化音频播放...');

      // 启动 SyncController 同步循环（独立于音频播放）
      syncController.start();
      console.log('🔄 SyncController 同步循环已启动');

      // 注意：不自动播放音频，等待用户交互
      console.log('🎵 音频引擎已初始化，等待用户播放');
    } catch (error) {
      console.error('🎵 音频初始化失败', error);
      setIsPlaying(false);
    }
  }, [lyrics.length]);

  // 播放/暂停控制
  const togglePlay = useCallback(async () => {
    const audioEngine = audioEngineRef.current;
    if (!audioEngine) return;

    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
      console.log('🎵 用户暂停播放');
    } else {
      try {
        const success = await audioEngine.play();
        if (success) {
          setIsPlaying(true);
          console.log('🎵 用户开始播放');
        } else {
          console.warn('🎵 播放被浏览器阻止');
        }
      } catch (error) {
        console.error('🎵 播放失败', error);
      }
    }
  }, [isPlaying]);

  // 处理进度条点击
  const handleProgressClick = useCallback((percentage: number) => {
    const audioEngine = audioEngineRef.current;
    const timeline = timelineRef.current;
    if (!audioEngine || !timeline) return;

    const newTime = percentage * audioEngine.getDuration();
    audioEngine.seek(newTime);
    setCurrentTime(newTime);

    // 更新歌词索引和锚字
    const newIndex = timeline.getIndexForTime(newTime);
    if (newIndex >= 0) {
      setCurrentLyricIndex(newIndex);
      const lyric = timeline.getLyric(newIndex);
      if (lyric) {
        setCurrentAnchor(lyric.anchor || lyric.text?.[0] || '观');
      }
    }
  }, []);

  // 处理歌词点击
  const handleLyricClick = useCallback((index: number) => {
    const audioEngine = audioEngineRef.current;
    const timeline = timelineRef.current;
    if (!audioEngine || !timeline || !lyrics[index]) return;

    const targetLyric = lyrics[index];
    audioEngine.seek(targetLyric.time);
    setCurrentTime(targetLyric.time);
    setCurrentLyricIndex(index);
    setCurrentAnchor(targetLyric.anchor || targetLyric.text?.[0] || '观');
  }, [lyrics]);

  // 处理滚动事件
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    // 滚动事件由 ScrollEngine 处理，但防止事件冒泡到页面
    event.stopPropagation();
  }, []);

  // 锁定/解锁页面滚动
  const lockPageScroll = useCallback(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    console.log('🔒 页面滚动已锁定');
  }, []);

  const unlockPageScroll = useCallback(() => {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.width = '';
    document.body.style.height = '';
    console.log('🔓 页面滚动已解锁');
  }, []);

  // 更新时间显示 - 简化版本，避免与 SyncController 冲突
  const updateTimeDisplay = useCallback(() => {
    const audioEngine = audioEngineRef.current;
    if (!audioEngine) return;

    const currentTime = audioEngine.getCurrentTime();
    const duration = audioEngine.getDuration();
    setCurrentTime(currentTime);
    setDuration(duration);

    // 更新进度百分比
    const progressPercentage = duration > 0
      ? Math.min(100, (currentTime / duration) * 100)
      : 0;

    setRenderState(prev => ({
      ...prev,
      progressPercentage
    }));
  }, []);

  // 定时更新显示 - 禁用，避免与SyncController冲突
  // useEffect(() => {
  //   const interval = setInterval(updateTimeDisplay, 100);
  //   return () => clearInterval(interval);
  // }, [updateTimeDisplay]);

  // 组件挂载 - 等待音频元素准备好后初始化
  useEffect(() => {
    const initializeAndLoad = async () => {
      try {
        // 等待 DOM 更新完成
        await new Promise(resolve => setTimeout(resolve, 50));

        // 检查音频元素是否存在
        if (!audioRef.current) {
          console.error('🎵 LyricsSyncV3: 音频元素不存在，等待 DOM 挂载...');
          // 再等待一段时间让 DOM 完全挂载
          await new Promise(resolve => setTimeout(resolve, 200));
          if (!audioRef.current) {
            throw new Error('音频元素无法挂载');
          }
        }

        console.log('🎵 音频元素已准备好，开始初始化模块...');

        // 锁定页面滚动
        lockPageScroll();

        // 先初始化模块
        initializeModules();

        // 等待模块初始化完成
        await new Promise(resolve => setTimeout(resolve, 100));

        // 然后加载歌词
        await loadLyrics();
      } catch (error) {
        console.error('🎵 LyricsSyncV3: 初始化失败', error);
        setLoadError(`初始化失败: ${error}`);
      }
    };

    initializeAndLoad();

    return () => {
      // 解锁页面滚动
      unlockPageScroll();

      // 清理模块
      audioEngineRef.current?.destroy();
      timelineRef.current?.clear();
      scrollEngineRef.current?.destroy();
      syncControllerRef.current?.destroy();
    };
  }, [initializeModules, loadLyrics, lockPageScroll, unlockPageScroll]);

  // 音频初始化
  useEffect(() => {
    if (lyrics.length > 0 && audioEngineRef.current) {
      initializeAudio();
    }
  }, [lyrics.length, initializeAudio]);

  // 渲染状态
  const renderStateMemo = useMemo(() => ({
    ...renderState,
    displayedLyrics: lyrics.map((lyric, index) => ({
      index,
      text: lyric.text,
      isActive: index === currentLyricIndex,
      distance: Math.abs(index - currentLyricIndex)
    }))
  }), [renderState, lyrics, currentLyricIndex]);

  // 总是渲染音频元素，无论状态如何
  return (
    <div className="lyrics-sync-v3">
      {/* 隐藏的音频元素 - 必须始终存在 */}
      <audio
        ref={audioRef}
        src={AUDIO_FILE_PATH}
        preload="metadata"
      />

      {/* 错误状态 */}
      {loadError && (
        <div className="lyrics-sync-v3 error">
          <div className="error-container">
            <h2>加载失败</h2>
            <p>{loadError}</p>
            <button onClick={() => window.location.reload()}>
              重新加载
            </button>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && !loadError && (
        <div className="lyrics-sync-v3 loading">
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>正在加载歌词...</p>
          </div>
        </div>
      )}

      {/* 正常内容 */}
      {!isLoading && !loadError && (
        <>
          {/* 背景效果 */}
          <div className="background-effects">
            <div className="fog-effect" />
            <div className="grainy-overlay" />
          </div>

          {/* 主内容区域 */}
          <div className="main-content">
            {/* 左侧：锚字显示 */}
            <div className="anchor-section">
              <AnchorDisplay
                anchor={currentAnchor}
                isVisible={true}
              />
            </div>

            {/* 右侧：歌词区域 */}
            <div className="lyrics-section">
              <div className="lyrics-wrapper">
                <div className="mask-gradient" />
                <div
                  ref={scrollContainerRef}
                  className="lyrics-scroll"
                  onScroll={handleScroll}
                >
                  <LyricRenderer
                    lyrics={lyrics}
                    currentIndex={currentLyricIndex}
                    containerRef={scrollContainerRef}
                    onScroll={handleScroll}
                    onLyricClick={handleLyricClick}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 控制栏 */}
          <div className="control-bar">
            <div className="control-container">
              {/* 进度条 */}
              <ProgressBar
                currentTime={currentTime}
                duration={duration}
                onProgressClick={handleProgressClick}
              />

              {/* 控制按钮 */}
              <div className="controls">
                <button
                  onClick={togglePlay}
                  className="play-button"
                  aria-label={isPlaying ? '暂停' : '播放'}
                >
                  {isPlaying ? (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>

                {/* 调试按钮（开发环境） */}
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={() => setShowDebugPanel(!showDebugPanel)}
                    className="debug-button"
                    aria-label="调试面板"
                  >
                    调试
                  </button>
                )}
              </div>
            </div>
          </div>

            {/* 调试面板 */}
          {showDebugPanel && process.env.NODE_ENV === 'development' && (
            <div className="debug-panel">
              <div className="debug-content">
                <h3>调试信息</h3>
                <div className="debug-section">
                  <h4>状态</h4>
                  <p>同步状态: {syncState}</p>
                  <p>当前索引: {currentLyricIndex}</p>
                  <p>播放状态: {isPlaying ? '播放中' : '暂停'}</p>
                  <p>当前时间: {currentTime.toFixed(2)}s</p>
                  <p>总时长: {duration.toFixed(2)}s</p>
                </div>
                <button onClick={() => {
                  if (syncControllerRef.current) {
                    console.log('调试信息:', syncControllerRef.current.getDebugInfo());
                  }
                }}>
                  输出详细调试信息
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .lyrics-sync-v3 {
          position: relative;
          min-height: 100vh;
          width: 100%;
          background: black;
          color: #e5e7eb;
          overflow: hidden;
        }

        .background-effects {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
        }

        .fog-effect {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at 30% 40%,
            rgba(244, 114, 182, 0.15),
            transparent 50%
          ),
          radial-gradient(
            circle at 70% 60%,
            rgba(107, 114, 255, 0.15),
            transparent 50%
          );
          animation: fog-movement 25s ease-in-out infinite alternate;
        }

        .grainy-overlay {
          position: absolute;
          inset: 0;
          background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iNTAwIiBoZWlnaHQ9IjUwMCI+CjxmaWx0ZXIgaWQ9Im4iPgo8ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC43IiBudW1PY3RhdmVzPSIxMCIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPgo8L2ZpbHRlcj4KPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI24pIiBvcGFjaXR5PSIwLjMiLz4KPC9zdmc+');
          animation: grain 1s steps(1) infinite;
          opacity: 0.2;
          mix-blend-mode: soft-light;
        }

        .main-content {
          position: relative;
          z-index: 2;
          display: flex;
          min-height: 100vh;
          width: 100%;
        }

        .anchor-section {
          flex: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .lyrics-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .lyrics-wrapper {
          position: relative;
          width: 100%;
          max-width: 28rem;
          height: 100%;
          display: flex;
          align-items: center;
        }

        .mask-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.85),
            rgba(0, 0, 0, 0) 20%,
            rgba(0, 0, 0, 0) 80%,
            rgba(0, 0, 0, 0.85)
          );
          pointer-events: none;
          z-index: 10;
        }

        .lyrics-scroll {
          position: relative;
          width: 100%;
          height: calc(5 * 3.2rem);
          max-height: calc(5 * 3.2rem);
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
          mask-image: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(0, 0, 0, 0.95) 20%,
            rgba(0, 0, 0, 0.95) 80%,
            transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(0, 0, 0, 0.95) 20%,
            rgba(0, 0, 0, 0.95) 80%,
            transparent 100%
          );
        }

        .lyrics-scroll::-webkit-scrollbar {
          display: none;
        }

        .control-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(12px);
          padding: 1rem;
          z-index: 100;
        }

        .control-container {
          max-width: 48rem;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
        }

        .play-button,
        .debug-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        }

        .play-button {
          background: linear-gradient(135deg, rgb(244, 114, 182), rgb(167, 139, 250));
          color: white;
        }

        .play-button:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(244, 114, 182, 0.4);
        }

        .debug-button {
          background: rgba(107, 114, 128, 0.3);
          color: #e5e7eb;
          font-size: 0.75rem;
        }

        .debug-button:hover {
          background: rgba(107, 114, 128, 0.5);
        }

        .loading-container,
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          gap: 1rem;
          text-align: center;
        }

        .loading-spinner {
          width: 2rem;
          height: 2rem;
          border: 2px solid rgba(107, 114, 128, 0.3);
          border-top-color: rgb(244, 114, 182);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .debug-panel {
          position: fixed;
          top: 1rem;
          right: 1rem;
          width: 20rem;
          max-height: 80vh;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(107, 114, 128, 0.3);
          border-radius: 0.5rem;
          padding: 1rem;
          overflow-y: auto;
          z-index: 1000;
        }

        .debug-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .debug-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .debug-section h4 {
          margin: 0;
          color: rgb(244, 114, 182);
          font-size: 0.875rem;
        }

        .debug-section p {
          margin: 0;
          font-size: 0.75rem;
          color: #9ca3af;
        }

        @keyframes fog-movement {
          from {
            background-position: 0% 0%, 0% 0%;
          }
          to {
            background-position: -100% -100%, 100% 100%;
          }
        }

        @keyframes grain {
          0%, 100% {
            transform: translate(0, 0);
          }
          10% {
            transform: translate(-2%, -2%);
          }
          20% {
            transform: translate(2%, 2%);
          }
          30% {
            transform: translate(-2%, 2%);
          }
          40% {
            transform: translate(2%, -2%);
          }
          50% {
            transform: translate(-2%, -2%);
          }
          60% {
            transform: translate(2%, 1%);
          }
          70% {
            transform: translate(-1%, 2%);
          }
          80% {
            transform: translate(2%, -1%);
          }
          90% {
            transform: translate(-2%, -2%);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
          .main-content {
            flex-direction: column;
          }

          .anchor-section {
            flex: 1;
            min-height: 40vh;
          }

          .lyrics-section {
            flex: 1;
            min-height: 40vh;
          }

          .lyrics-scroll {
            height: calc(4 * 3.2rem);
            max-height: calc(4 * 3.2rem);
          }

          .debug-panel {
            width: 16rem;
            font-size: 0.75rem;
          }
        }

        @media (max-width: 480px) {
          .anchor-section,
          .lyrics-section {
            padding: 1rem;
          }

          .lyrics-scroll {
            height: calc(3 * 3.2rem);
            max-height: calc(3 * 3.2rem);
          }

          .control-bar {
            padding: 0.75rem;
          }

          .play-button {
            width: 2.5rem;
            height: 2.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default LyricsSyncV3;