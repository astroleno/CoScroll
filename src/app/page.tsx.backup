'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { LRC_LYRICS } from './constants';
import useLyrics from '@/components/hooks/useLyrics';
import LyricsController from '@/components/LyricsController';
import AudioPlayer from '@/components/AudioPlayer';
import AutoPlayGuard from '@/components/AutoPlayGuard';
import ModelPreloader from '@/components/jade/ModelPreloader';
import type { LyricLine } from '@/types';

// 动态导入 JadeV6 避免 SSR 问题
const JadeV6 = dynamic(() => import('@/components/jade/JadeV6'), { 
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#202734]">
      <div className="text-white text-xl">加载3D模型中...</div>
    </div>
  )
});

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
  // 音频相关状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [scrollTime, setScrollTime] = useState(0);
  const [duration, setDuration] = useState(MOCK_DURATION);
  const [audioSrc, setAudioSrc] = useState('');
  const [isIntroPlaying, setIsIntroPlaying] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [audioRestartCount, setAudioRestartCount] = useState(0);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // 3D模型相关状态
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [currentAnchor, setCurrentAnchor] = useState('心');
  const [modelPreloadStatus, setModelPreloadStatus] = useState({
    isPreloading: false,
    loaded: 0,
    total: 0,
    currentModel: '',
    nextModel: ''
  });


  const audioRef = useRef<HTMLAudioElement>(null);
  const isSeekingRef = useRef(false);
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loopCountRef = useRef(0);
  const isAudioEndedRef = useRef(false);
  const pendingSeekAbsoluteTimeRef = useRef<number | null>(null);
  const lastSeekTargetDisplayTimeRef = useRef<number | null>(null);

  const lyrics = useLyrics(LRC_LYRICS);

  // 添加调试日志
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setDebugLogs(prev => [...prev.slice(-4), logMessage]);
  }, []);

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
      console.log('[HomePage] Mobile detection:', { 
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
      console.log('[HomePage] Setting audio source:', audioPath);
      setAudioSrc(audioPath);
      
      setScrollTime(0);
      setCurrentTime(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
    } catch (error) {
      console.error('[Audio] Failed to set audio source:', error);
    }
  }, []);

  // 用户交互处理
  const handleUserInteraction = useCallback(() => {
    addDebugLog(`用户交互触发，移动端: ${isMobile}`);
    setHasUserInteracted(true);
    setIsIntroPlaying(true);

    const initialLoop = 3;
    const initialScrollTime = MOCK_DURATION * initialLoop;
    const initialDisplayTime = 0;

    setScrollTime(initialScrollTime);
    setCurrentTime(initialDisplayTime);
    loopCountRef.current = initialLoop;

    if (audioRef.current) {
        audioRef.current.currentTime = initialDisplayTime;
    }

    const mainAudio = audioRef.current;
    if (mainAudio) {
      mainAudio.play()
        .then(() => {
          addDebugLog('音频播放成功');
        })
        .catch(e => {
          addDebugLog(`音频播放失败: ${e.message}`);
        });
    }
  }, [isReady, isMobile, addDebugLog]);

  // 播放/暂停控制
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !isReady) return;
    if (isPlaying) {
      try {
        audio.pause();
      } catch (e) {
        console.error('[Audio] Pause failed:', e);
      }
    } else {
      audio.play().catch(e => console.error('[Audio] Playback failed:', e));
    }
  }, [isPlaying, isReady]);

  // 跳转处理
  const handleSeek = useCallback((absoluteTime: number) => {
    isSeekingRef.current = true;
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    const timeoutDuration = isPlaying ? 1000 : 500;
    seekTimeoutRef.current = setTimeout(() => {
      isSeekingRef.current = false;
      lastSeekTargetDisplayTimeRef.current = null;
    }, timeoutDuration);

    const safeDuration = Math.max(1, duration);
    const displayTime = absoluteTime % safeDuration;
    setCurrentTime(displayTime);
    setScrollTime(absoluteTime);
    loopCountRef.current = Math.floor(absoluteTime / safeDuration);
    lastSeekTargetDisplayTimeRef.current = displayTime;

    try {
      const audio = audioRef.current;
      if (audio && isReady) {
        audio.currentTime = displayTime;
        pendingSeekAbsoluteTimeRef.current = null;
      } else {
        pendingSeekAbsoluteTimeRef.current = absoluteTime;
      }
    } catch (err) {
      console.error('[Audio] Seek failed:', err);
    }
  }, [duration, isReady, isPlaying]);

  // 时间更新处理
  const handleTimeUpdate = useCallback((event: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = event.currentTarget;
    if (!audio) return;

    const newDisplayTime = audio.currentTime;

    if (isSeekingRef.current) {
      const targetDisplayTime = lastSeekTargetDisplayTimeRef.current;
      if (targetDisplayTime != null && Math.abs(newDisplayTime - targetDisplayTime) > 0.5) {
        setCurrentTime(newDisplayTime);
        setScrollTime(loopCountRef.current * duration + newDisplayTime);
      }
      return;
    }

    if (isAudioEndedRef.current && newDisplayTime > 1.0) {
      isAudioEndedRef.current = false;
    }

    const isLooping = !isAudioEndedRef.current &&
                     ((newDisplayTime < currentTime && currentTime > duration * 0.9) ||
                      (newDisplayTime < 0.5 && currentTime > duration * 0.9 && loopCountRef.current > 0));

    if (isLooping) {
      loopCountRef.current++;
    }

    setCurrentTime(newDisplayTime);
    setScrollTime(loopCountRef.current * duration + newDisplayTime);
  }, [currentTime, duration]);

  // 音频元数据加载
  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
    try {
      const target = e.currentTarget;
      const realDuration = Math.max(1, Math.floor(target.duration));
      setDuration(realDuration);
      const pendingAbs = pendingSeekAbsoluteTimeRef.current;
      if (pendingAbs != null) {
        const displayTime = pendingAbs % realDuration;
        try {
          if (audioRef.current) audioRef.current.currentTime = displayTime;
          setCurrentTime(displayTime);
          loopCountRef.current = Math.floor(pendingAbs / realDuration);
          pendingSeekAbsoluteTimeRef.current = null;
          lastSeekTargetDisplayTimeRef.current = displayTime;
        } catch (seekErr) {
          console.error('[Audio] Failed to apply pending seek after metadata load:', seekErr);
        }
      }
    } catch (err) {
      console.error('[Audio] Failed to read metadata:', err);
    }
  }, []);

  // 音频可播放
  const handleCanPlay = () => {
    try {
      setIsReady(true);
      const pendingAbs = pendingSeekAbsoluteTimeRef.current;
      const audio = audioRef.current;
      const safeDuration = Math.max(1, duration);
      if (pendingAbs != null && audio) {
        const displayTime = pendingAbs % safeDuration;
        audio.currentTime = displayTime;
        setCurrentTime(displayTime);
        loopCountRef.current = Math.floor(pendingAbs / safeDuration);
        pendingSeekAbsoluteTimeRef.current = null;
        lastSeekTargetDisplayTimeRef.current = displayTime;
      }
    } catch (err) {
      console.error('[Audio] canplay handler failed:', err);
    }
  };

  // 音频错误处理
  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const err = e.currentTarget.error;
    if (err) console.error(`Audio Error: Code ${err.code} - ${err.message}`);
  };

  // 音频结束处理
  const handleAudioEnded = useCallback(() => {
    console.log('[HomePage] Audio ended, restarting for infinite playback');
    const audio = audioRef.current;
    if (!audio) return;

    isAudioEndedRef.current = true;
    loopCountRef.current++;
    setAudioRestartCount(prev => prev + 1);

    setCurrentTime(0);
    setScrollTime(loopCountRef.current * duration);

    if (isMobile) {
      if (audioRestartCount > 0 && audioRestartCount % 10 === 0) {
        audio.load();
        setTimeout(() => {
          audio.play().catch(err => console.error('[Audio] Mobile reload and play failed:', err));
        }, 200);
      } else {
        audio.currentTime = 0;
        audio.play()
          .then(() => {
            console.log('[HomePage] Mobile audio restarted successfully');
          })
          .catch(e => {
            console.error('[Audio] Mobile audio restart failed:', e);
            audio.load();
            setTimeout(() => {
              audio.play().catch(err => console.error('[Audio] Mobile fallback play failed:', err));
            }, 100);
          });
      }
    } else {
      audio.currentTime = 0;
      audio.play()
        .then(() => {
          console.log('[HomePage] Desktop audio restarted successfully');
        })
        .catch(e => {
          console.error('[Audio] Desktop audio restart failed:', e);
        });
    }
  }, [isMobile, audioRestartCount, duration]);

  // 移动端页面可见性处理
  useEffect(() => {
    if (!isMobile) return;

    const handleVisibilityChange = () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (document.hidden) {
        audio.pause();
      } else {
        if (audioRef.current) {
          const expectedTime = currentTime;
          const actualTime = audioRef.current.currentTime;
          if (Math.abs(expectedTime - actualTime) > 0.5) {
            audioRef.current.currentTime = expectedTime;
          }
        }

        if (isPlaying) {
          audio.play().catch(e => {
            console.error('[Audio] Mobile resume failed:', e);
            setHasUserInteracted(false);
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isMobile, isPlaying, currentTime]);

  // 计算当前歌词行和锚字
  const currentLineIndex = findCurrentLineIndex(lyrics, currentTime, duration);

  // 使用精确时间轴查找锚字
  const findAnchorCharByTime = (currentTime: number): string => {
    const loopTime = currentTime % duration;
    
    // 从时间轴中找到当前时间对应的锚字
    for (let i = ANCHOR_TIMELINE.length - 1; i >= 0; i--) {
      if (loopTime >= ANCHOR_TIMELINE[i].time) {
        console.log(`[锚字切换] 时间: ${loopTime.toFixed(2)}s -> 锚字: ${ANCHOR_TIMELINE[i].anchor} (${ANCHOR_TIMELINE[i].text})`);
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

  // 使用精确时间轴查找锚字
  const anchorChar = findAnchorCharByTime(currentTime);

  // 更新锚字状态和智能预加载
  useEffect(() => {
    if (anchorChar !== currentAnchor) {
      console.log(`[锚字更新] ${currentAnchor} -> ${anchorChar}`);
      setCurrentAnchor(anchorChar);
      
      // 智能预加载下一个模型
      const preloader = ModelPreloader.getInstance();
      preloader.preloadNextModel(currentTime, ANCHOR_TIMELINE, ANCHOR_MODEL_MAPPING)
        .then(() => {
          // 更新预加载状态
          const status = preloader.getCacheStatus();
          setModelPreloadStatus(prev => ({
            ...prev,
            loaded: status.loaded,
            currentModel: getModelPath(anchorChar),
            nextModel: preloader.predictNextModel(currentTime, ANCHOR_TIMELINE, ANCHOR_MODEL_MAPPING) || ''
          }));
        })
        .catch(error => {
          console.error('[HomePage] 智能预加载失败:', error);
        });
    }
  }, [anchorChar, currentAnchor, currentTime]);

  // 调试信息：显示当前锚字状态
  useEffect(() => {
    const currentAnchorInfo = ANCHOR_TIMELINE.find(item => item.anchor === anchorChar);
    if (currentAnchorInfo) {
      console.log(`[当前锚字] ${anchorChar} - ${currentAnchorInfo.text} (${currentAnchorInfo.meaning})`);
    }
  }, [anchorChar]);

  // 模型预加载状态监控
  useEffect(() => {
    const preloader = ModelPreloader.getInstance();
    const status = preloader.getCacheStatus();
    
    console.log('[HomePage] 模型预加载状态:', {
      ...status,
      currentModel: getModelPath(currentAnchor),
      nextModel: preloader.predictNextModel(currentTime, ANCHOR_TIMELINE, ANCHOR_MODEL_MAPPING),
      isCurrentModelCached: preloader.isModelLoaded(getModelPath(currentAnchor)),
      isCurrentModelLoading: preloader.isModelLoading(getModelPath(currentAnchor))
    });
    
    // 更新状态
    setModelPreloadStatus(prev => ({
      ...prev,
      loaded: status.loaded,
      total: status.total,
      currentModel: getModelPath(currentAnchor),
      nextModel: preloader.predictNextModel(currentTime, ANCHOR_TIMELINE, ANCHOR_MODEL_MAPPING) || ''
    }));
  }, [currentAnchor, currentTime]);

  console.log('[HomePage] Render state:', { hasUserInteracted, isReady, isPlaying, isIntroPlaying });

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
      {/* 主音频 */}
      <audio
        key={audioSrc} 
        ref={audioRef} 
        src={audioSrc || undefined}
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)}
        onEnded={handleAudioEnded} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata} 
        onCanPlay={handleCanPlay} 
        onError={handleAudioError}
        preload="auto"
        playsInline
        webkit-playsinline="true"
        controls={false}
      />
      
      {/* 自动播放引导 */}
      <AutoPlayGuard 
        onUserInteraction={handleUserInteraction}
        isReady={isReady}
        isPlaying={isPlaying || isIntroPlaying}
      />
      
      {/* 3D模型背景 - 替代原来的背景字符 */}
      <div className="fixed inset-0 pointer-events-none z-10" style={{ width: '100%', height: '100%' }}>
        <JadeV6
          modelPath={getModelPath(currentAnchor)}
          rotationDurationSec={8}
          direction={1}
          fitToView
          background="#202734"
          environmentHdrPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
          environmentIntensity={1.0}
          // 滚动控制参数（新增）
          enableScrollControl={true}
          baseSpeed={0.3}
          speedMultiplier={8.0}
          externalVelocity={scrollVelocity}
          // 预加载设置（优化版）
          enablePreloading={true}
          preloadAllModels={false} // 改为false，因为已经在页面初始化时预加载了
          modelPaths={ALL_MODEL_PATHS}
          // 预加载状态传递
          preloadStatus={modelPreloadStatus}
        />
      </div>

      {/* 歌词控制器 */}
      <main className="relative w-full flex-grow flex justify-center items-center z-20 py-4 overflow-hidden">
        <div className="relative w-full max-w-4xl h-full pointer-events-auto">
          <LyricsController
            lyrics={lyrics}
            currentTime={currentTime}
            duration={duration}
            scrollTime={scrollTime}
            onSeek={handleSeek}
            isPlaying={isPlaying}
            onScrollVelocityChange={setScrollVelocity}
          />
        </div>
      </main>

      {/* 音频播放器 */}
      <footer className="w-full flex justify-center py-8 z-20">
        <AudioPlayer
          isPlaying={isPlaying} 
          isReady={isReady}
          duration={duration} 
          currentTime={currentTime}
          onPlayPause={handlePlayPause} 
          onSeek={(time) => handleSeek(loopCountRef.current * duration + time)}
        />
      </footer>

    </div>
  );
}
