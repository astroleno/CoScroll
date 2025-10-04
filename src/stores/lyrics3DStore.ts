import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import * as THREE from 'three';

/**
 * 3D字幕质量级别配置
 */
export type QualityLevel = 'high' | 'medium' | 'low';

/**
 * 歌词行数据结构
 */
export interface LyricLine {
  text: string;
  time: number;
}

/**
 * LyricsController 传入的数据结构
 */
export interface LyricsControllerData {
  lyricsData: LyricLine[];
  currentIndex: number;
  scrollTime: number;
  isPlaying: boolean;
  scrollVelocity: number;
}

/**
 * 3D字幕配置
 */
export interface Lyrics3DConfig {
  maxVisibleLyrics: number;
  updateRate: number;
  enableOcclusion: boolean;
  qualityLevel: QualityLevel;
  anchorModelReference?: THREE.Object3D;
}

/**
 * 3D字幕状态接口
 */
interface Lyrics3DState {
  // 基础状态
  lyricsData: LyricLine[];
  currentIndex: number;
  scrollTime: number;
  isPlaying: boolean;
  scrollVelocity: number;

  // 计算属性
  visibleLyrics: LyricLine[];
  currentLyric: LyricLine | null;
  
  // 3D特定状态
  qualityLevel: QualityLevel;
  mobileMode: boolean;
  config: Lyrics3DConfig;

  // 锚字模型相关状态
  currentAnchorModel: THREE.Object3D | null;
  anchorModelPosition: THREE.Vector3;
  anchorModelSize: THREE.Vector3;
  currentAnchor: string;

  // 性能监控
  frameRate: number;
  memoryUsage: number;
  lastUpdateTime: number;

  // 操作方法
  updateFromLyricsController: (data: LyricsControllerData) => void;
  setQualityLevel: (level: QualityLevel) => void;
  syncWithAudio: (currentTime: number) => void;
  updateAnchorModel: (model: THREE.Object3D, anchor: string) => void;
  setConfig: (config: Partial<Lyrics3DConfig>) => void;
  reset: () => void;
}

/**
 * 性能配置常量
 */
const PERFORMANCE_CONFIG = {
  desktop: {
    maxVisibleLyrics: 15,
    updateRate: 60,
    enableOcclusion: true,
    qualityLevel: 'high' as QualityLevel
  },
  mobile: {
    maxVisibleLyrics: 8,
    updateRate: 30,
    enableOcclusion: false,
    qualityLevel: 'low' as QualityLevel
  }
};

/**
 * 检测设备类型
 */
const detectDeviceType = (): 'desktop' | 'mobile' => {
  if (typeof window === 'undefined') return 'desktop';
  
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return isMobile ? 'mobile' : 'desktop';
};

/**
 * 计算可见歌词范围
 */
const calculateVisibleLyrics = (
  lyricsData: LyricLine[], 
  currentIndex: number, 
  maxVisible: number
): LyricLine[] => {
  if (!lyricsData || lyricsData.length === 0) return [];
  
  const start = Math.max(0, currentIndex - Math.floor(maxVisible / 2));
  const end = Math.min(lyricsData.length, start + maxVisible);
  
  return lyricsData.slice(start, end);
};

/**
 * 计算当前歌词
 */
const calculateCurrentLyric = (
  lyricsData: LyricLine[], 
  currentIndex: number
): LyricLine | null => {
  if (!lyricsData || currentIndex < 0 || currentIndex >= lyricsData.length) {
    return null;
  }
  return lyricsData[currentIndex];
};

/**
 * 3D字幕状态管理Store
 */
export const useLyrics3DStore = create<Lyrics3DState>()(
  subscribeWithSelector((set, get) => {
    const deviceType = detectDeviceType();
    const deviceConfig = PERFORMANCE_CONFIG[deviceType];

    return {
      // 基础状态
      lyricsData: [],
      currentIndex: 0,
      scrollTime: 0,
      isPlaying: false,
      scrollVelocity: 0,

      // 计算属性
      visibleLyrics: [],
      currentLyric: null,

      // 3D特定状态
      qualityLevel: deviceConfig.qualityLevel,
      mobileMode: deviceType === 'mobile',
      config: {
        maxVisibleLyrics: deviceConfig.maxVisibleLyrics,
        updateRate: deviceConfig.updateRate,
        enableOcclusion: deviceConfig.enableOcclusion,
        qualityLevel: deviceConfig.qualityLevel
      },

      // 锚字模型相关状态
      currentAnchorModel: null,
      anchorModelPosition: new THREE.Vector3(0, 0, 0),
      anchorModelSize: new THREE.Vector3(1, 1, 1),
      currentAnchor: '心',

      // 性能监控
      frameRate: 60,
      memoryUsage: 0,
      lastUpdateTime: Date.now(),

      // 操作方法
      updateFromLyricsController: (data: LyricsControllerData) => {
        const { lyricsData, currentIndex, scrollTime, isPlaying, scrollVelocity } = data;
        
        set((state) => {
          // 检查是否有实际变化
          const hasDataChanged = 
            state.lyricsData !== lyricsData ||
            state.currentIndex !== currentIndex ||
            Math.abs(state.scrollTime - scrollTime) > 0.01 ||
            state.isPlaying !== isPlaying ||
            Math.abs(state.scrollVelocity - scrollVelocity) > 0.01;
          
          if (!hasDataChanged) {
            return state; // 没有变化，返回原状态
          }
          
          const newVisibleLyrics = calculateVisibleLyrics(
            lyricsData, 
            currentIndex, 
            state.config.maxVisibleLyrics
          );
          
          const newCurrentLyric = calculateCurrentLyric(lyricsData, currentIndex);

          return {
            lyricsData,
            currentIndex,
            scrollTime,
            isPlaying,
            scrollVelocity,
            visibleLyrics: newVisibleLyrics,
            currentLyric: newCurrentLyric,
            lastUpdateTime: Date.now()
          };
        });
      },

      setQualityLevel: (level: QualityLevel) => {
        set((state) => ({
          qualityLevel: level,
          config: {
            ...state.config,
            qualityLevel: level
          }
        }));
      },

      syncWithAudio: (currentTime: number) => {
        set((state) => {
          // 检查时间是否有显著变化
          const timeDiff = Math.abs(currentTime - state.lastUpdateTime);
          if (timeDiff < 100) { // 小于100ms不更新
            return state;
          }
          
          // 根据音频时间同步状态
          const newScrollTime = state.scrollTime + (currentTime - state.lastUpdateTime) / 1000;
          
          return {
            scrollTime: newScrollTime,
            lastUpdateTime: currentTime
          };
        });
      },

      updateAnchorModel: (model: THREE.Object3D, anchor: string) => {
        set((state) => {
          // 检查是否有实际变化
          if (state.currentAnchorModel === model && state.currentAnchor === anchor) {
            return state; // 没有变化，返回原状态
          }
          
          // 计算锚字模型的位置和尺寸
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          
          return {
            currentAnchorModel: model,
            anchorModelPosition: center,
            anchorModelSize: size,
            currentAnchor: anchor
          };
        });
      },

      setConfig: (newConfig: Partial<Lyrics3DConfig>) => {
        set((state) => {
          // 检查配置是否真的发生了变化
          const hasChanges = Object.keys(newConfig).some(key => 
            state.config[key as keyof Lyrics3DConfig] !== newConfig[key as keyof Lyrics3DConfig]
          );
          
          if (!hasChanges) {
            return state; // 没有变化，返回原状态
          }
          
          return {
            config: {
              ...state.config,
              ...newConfig
            }
          };
        });
      },

      reset: () => {
        set({
          lyricsData: [],
          currentIndex: 0,
          scrollTime: 0,
          isPlaying: false,
          scrollVelocity: 0,
          visibleLyrics: [],
          currentLyric: null,
          currentAnchorModel: null,
          anchorModelPosition: new THREE.Vector3(0, 0, 0),
          anchorModelSize: new THREE.Vector3(1, 1, 1),
          currentAnchor: '心',
          frameRate: 60,
          memoryUsage: 0,
          lastUpdateTime: Date.now()
        });
      }
    };
  })
);

/**
 * 性能监控Hook
 */
export const usePerformanceMonitor = () => {
  const frameCount = { current: 0 };
  const lastTime = { current: Date.now() };

  const updateFrameRate = () => {
    frameCount.current++;
    const now = Date.now();
    const delta = now - lastTime.current;

    if (delta >= 1000) {
      const fps = (frameCount.current * 1000) / delta;
      frameCount.current = 0;
      lastTime.current = now;

      // 更新帧率
      useLyrics3DStore.setState({ frameRate: fps });

      // 性能警告
      if (fps < 30) {
        console.warn(`[Lyrics3D] Low FPS detected: ${fps.toFixed(1)}`);
        // 自动降级
        const currentState = useLyrics3DStore.getState();
        if (currentState.qualityLevel === 'high') {
          currentState.setQualityLevel('medium');
        } else if (currentState.qualityLevel === 'medium') {
          currentState.setQualityLevel('low');
        }
      }
    }
  };

  return { updateFrameRate };
};

/**
 * 自适应质量Hook
 */
export const useAdaptiveQuality = () => {
  const setQualityLevel = useLyrics3DStore((state) => state.setQualityLevel);
  const qualityLevel = useLyrics3DStore((state) => state.qualityLevel);

  const adjustQuality = (fps: number) => {
    if (fps < 30 && qualityLevel !== 'low') {
      setQualityLevel('low');
    } else if (fps < 45 && qualityLevel === 'high') {
      setQualityLevel('medium');
    } else if (fps > 55 && qualityLevel === 'low') {
      setQualityLevel('medium');
    }
  };

  return { adjustQuality, qualityLevel };
};

export default useLyrics3DStore;
