"use client";

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useLyrics3DStore } from '@/stores/lyrics3DStore';
import Lyrics3DText from './Lyrics3DText';
import type { 
  Lyrics3DProps, 
  Lyrics3DComponentState,
  Lyrics3DError,
  FontConfig
} from '@/types/lyrics3D.types';

/**
 * Lyrics3DRenderer - 3D字幕渲染组件
 * 
 * 核心功能：
 * 1. 基于Troika Text的3D文字渲染
 * 2. 实现"前-后-后"空间布局
 * 3. 与锚字3D模型的遮挡交互
 * 4. 性能优化和LOD系统
 */
interface Lyrics3DRendererComponentProps extends Lyrics3DProps {
  // 组件特定配置
  enableDebug?: boolean;
  enablePerformanceMonitor?: boolean;
  onError?: (error: Lyrics3DError) => void;
}

/**
 * 字体配置
 */
const defaultFontConfig: FontConfig = {
  fontPath: '', // 使用默认字体，避免加载错误
  fallbackFont: 'Arial',
  fontSize: 0.5,
  fontWeight: 'normal',
  fontStyle: 'normal'
};

/**
 * 主3D字幕渲染组件
 */
const Lyrics3DRenderer: React.FC<Lyrics3DRendererComponentProps> = ({
  lyricsData,
  currentIndex,
  scrollTime,
  isPlaying,
  scrollVelocity,
  config,
  anchorModel,
  anchorModelSize,
  currentAnchor,
  enableDebug = false,
  enablePerformanceMonitor = true,
  onError
}) => {
  const { scene, camera } = useThree();
  const [componentState, setComponentState] = useState<Lyrics3DComponentState>({
    isLoading: true,
    isError: false,
    error: null,
    isInitialized: false,
    lastUpdateTime: Date.now()
  });

  // 从store获取状态
  const storeState = useLyrics3DStore();
  const {
    visibleLyrics,
    currentLyric,
    anchorModelPosition,
    anchorModelSize: storeAnchorModelSize,
    qualityLevel,
    frameRate
  } = storeState;

  // 性能监控
  const performanceRef = useRef({ frameCount: 0, lastTime: Date.now() });

  useFrame(() => {
    if (enablePerformanceMonitor) {
      const now = Date.now();
      const delta = now - performanceRef.current.lastTime;
      
      if (delta >= 1000) {
        const fps = (performanceRef.current.frameCount * 1000) / delta;
        performanceRef.current.frameCount = 0;
        performanceRef.current.lastTime = now;
        
        // 更新帧率到store
        useLyrics3DStore.setState({ frameRate: fps });
        
        if (enableDebug) {
          console.log(`[Lyrics3D] FPS: ${fps.toFixed(1)}, Quality: ${qualityLevel}`);
        }
      }
      
      performanceRef.current.frameCount++;
    }
  });

  // 更新锚字模型信息
  useEffect(() => {
    if (anchorModel && currentAnchor) {
      storeState.updateAnchorModel(anchorModel, currentAnchor);
    }
  }, [anchorModel, currentAnchor, storeState]);

  // 更新配置
  useEffect(() => {
    if (config) {
      storeState.setConfig(config);
    }
  }, [config, storeState]);

  // 同步LyricsController数据
  useEffect(() => {
    storeState.updateFromLyricsController({
      lyricsData,
      currentIndex,
      scrollTime,
      isPlaying,
      scrollVelocity
    });
  }, [lyricsData, currentIndex, scrollTime, isPlaying, scrollVelocity, storeState]);

  // 计算可见歌词
  const visibleLyricsToRender = useMemo(() => {
    if (!lyricsData || lyricsData.length === 0) return [];
    
    const maxVisible = config?.maxVisibleLyrics || 15;
    const start = Math.max(0, currentIndex - Math.floor(maxVisible / 2));
    const end = Math.min(lyricsData.length, start + maxVisible);
    
    return lyricsData.slice(start, end).map((lyric, index) => ({
      ...lyric,
      originalIndex: start + index
    }));
  }, [lyricsData, currentIndex, config?.maxVisibleLyrics]);

  // 错误处理
  const handleError = useCallback((error: Lyrics3DError) => {
    setComponentState(prev => ({
      ...prev,
      isError: true,
      error
    }));
    onError?.(error);
  }, [onError]);

  // 初始化完成
  useEffect(() => {
    if (visibleLyricsToRender.length > 0 && !componentState.isInitialized) {
      setComponentState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false
      }));
    }
  }, [visibleLyricsToRender.length, componentState.isInitialized]);

  // 调试信息
  if (enableDebug) {
    console.log('[Lyrics3DRenderer] State:', {
      visibleLyricsCount: visibleLyricsToRender.length,
      currentIndex,
      anchorModelPosition,
      qualityLevel,
      frameRate
    });
  }

  if (componentState.isError) {
    return null; // 错误时隐藏组件
  }

  return (
    <group>
      {visibleLyricsToRender.map((lyric, index) => {
        const isCurrent = lyric.originalIndex === currentIndex;
        
        return (
          <Lyrics3DText
            key={`${lyric.time}-${lyric.originalIndex}`}
            text={lyric.text}
            index={lyric.originalIndex}
            currentIndex={currentIndex}
            anchorModelPosition={anchorModelPosition}
            anchorModelSize={anchorModelSize || storeAnchorModelSize}
            isCurrent={isCurrent}
            fontConfig={defaultFontConfig}
            onError={handleError}
            onLoad={() => {
              if (enableDebug) {
                console.log(`[Lyrics3DText] Loaded: ${lyric.text}`);
              }
            }}
            enableDebug={enableDebug}
          />
        );
      })}
      
      {/* 调试信息 */}
      {enableDebug && (
        <group position={[0, 2, 0]}>
          <mesh>
            <planeGeometry args={[4, 1]} />
            <meshBasicMaterial color="black" transparent opacity={0.7} />
          </mesh>
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.2}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            {`FPS: ${frameRate.toFixed(1)} | Quality: ${qualityLevel} | Visible: ${visibleLyricsToRender.length}`}
          </Text>
        </group>
      )}
    </group>
  );
};

export default Lyrics3DRenderer;
