"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Lyrics3DRenderer from './Lyrics3DRenderer';
import { useLyrics3DStore } from '@/stores/lyrics3DStore';
import type { 
  Lyrics3DProps, 
  Lyrics3DConfig,
  LyricLine 
} from '@/types/lyrics3D.types';

/**
 * 3D字幕集成组件
 * 
 * 这个组件展示了如何在JadeV6中集成3D字幕功能
 * 提供了完整的配置和状态管理
 */
interface Lyrics3DIntegrationProps {
  // 基础数据
  lyricsData: LyricLine[];
  currentIndex: number;
  scrollTime: number;
  isPlaying: boolean;
  scrollVelocity: number;
  
  // 锚字模型相关
  anchorModel?: THREE.Object3D;
  anchorModelSize?: THREE.Vector3;
  currentAnchor?: string;
  
  // 配置选项
  config?: Partial<Lyrics3DConfig>;
  enableDebug?: boolean;
  enablePerformanceMonitor?: boolean;
  
  // 事件回调
  onError?: (error: any) => void;
  onLoad?: () => void;
}

/**
 * 3D字幕集成组件
 */
const Lyrics3DIntegration: React.FC<Lyrics3DIntegrationProps> = ({
  lyricsData,
  currentIndex,
  scrollTime,
  isPlaying,
  scrollVelocity,
  anchorModel,
  anchorModelSize,
  currentAnchor,
  config,
  enableDebug = false,
  enablePerformanceMonitor = true,
  onError,
  onLoad
}) => {
  const { scene, camera } = useThree();
  const [isInitialized, setIsInitialized] = useState(false);
  const store = useLyrics3DStore();

  // 初始化配置
  useEffect(() => {
    if (config) {
      store.setConfig(config);
    }
  }, [config]);

  // 同步数据到store
  useEffect(() => {
    store.updateFromLyricsController({
      lyricsData,
      currentIndex,
      scrollTime,
      isPlaying,
      scrollVelocity
    });
  }, [lyricsData, currentIndex, scrollTime, isPlaying, scrollVelocity]);

  // 更新锚字模型
  useEffect(() => {
    if (anchorModel && currentAnchor) {
      store.updateAnchorModel(anchorModel, currentAnchor);
    }
  }, [anchorModel, currentAnchor]);

  // 性能监控
  useEffect(() => {
    if (enablePerformanceMonitor) {
      const interval = setInterval(() => {
        // 性能监控通过useFrame在组件内部处理
        console.log('[Lyrics3D] Performance monitoring enabled');
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [enablePerformanceMonitor]);

  // 初始化完成
  useEffect(() => {
    if (!isInitialized && lyricsData.length > 0) {
      setIsInitialized(true);
      onLoad?.();
    }
  }, [lyricsData.length, isInitialized, onLoad]);

  // 错误处理
  const handleError = (error: any) => {
    console.error('[Lyrics3DIntegration] Error:', error);
    onError?.(error);
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <Lyrics3DRenderer
      lyricsData={lyricsData}
      currentIndex={currentIndex}
      scrollTime={scrollTime}
      isPlaying={isPlaying}
      scrollVelocity={scrollVelocity}
      config={config}
      anchorModel={anchorModel}
      anchorModelSize={anchorModelSize}
      currentAnchor={currentAnchor}
      enableDebug={enableDebug}
      enablePerformanceMonitor={enablePerformanceMonitor}
      onError={handleError}
    />
  );
};

/**
 * 使用3D字幕的Hook
 */
export const useLyrics3D = (
  lyricsData: LyricLine[],
  currentIndex: number,
  scrollTime: number,
  isPlaying: boolean,
  scrollVelocity: number
) => {
  const store = useLyrics3DStore();
  const [isReady, setIsReady] = useState(false);

  // 同步数据
  useEffect(() => {
    store.updateFromLyricsController({
      lyricsData,
      currentIndex,
      scrollTime,
      isPlaying,
      scrollVelocity
    });
  }, [lyricsData, currentIndex, scrollTime, isPlaying, scrollVelocity, store]);

  // 检查是否准备就绪
  useEffect(() => {
    if (lyricsData.length > 0 && !isReady) {
      setIsReady(true);
    }
  }, [lyricsData.length, isReady]);

  return {
    isReady,
    store,
    visibleLyrics: store.visibleLyrics,
    currentLyric: store.currentLyric,
    qualityLevel: store.qualityLevel,
    frameRate: store.frameRate,
    setQualityLevel: store.setQualityLevel,
    updateAnchorModel: store.updateAnchorModel
  };
};

/**
 * 3D字幕配置预设
 */
export const Lyrics3DConfigs = {
  // 高质量配置（桌面端）
  high: {
    maxVisibleLyrics: 15,
    updateRate: 60,
    enableOcclusion: true,
    qualityLevel: 'high' as const
  },
  
  // 中等质量配置（平板端）
  medium: {
    maxVisibleLyrics: 10,
    updateRate: 45,
    enableOcclusion: true,
    qualityLevel: 'medium' as const
  },
  
  // 低质量配置（移动端）
  low: {
    maxVisibleLyrics: 8,
    updateRate: 30,
    enableOcclusion: false,
    qualityLevel: 'low' as const
  }
};

/**
 * 自适应配置选择器
 */
export const getAdaptiveConfig = (): Lyrics3DConfig => {
  if (typeof window === 'undefined') {
    return Lyrics3DConfigs.high;
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const memory = (navigator as any).deviceMemory || 4;

  if (isMobile || memory < 4) {
    return Lyrics3DConfigs.low;
  } else if (memory < 8) {
    return Lyrics3DConfigs.medium;
  } else {
    return Lyrics3DConfigs.high;
  }
};

export default Lyrics3DIntegration;
