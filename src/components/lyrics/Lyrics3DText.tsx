"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { Text } from '@react-three/drei';
import { 
  calculateTextPosition, 
  calculateLayer, 
  calculateLODLevel,
  calculateAnimationInterpolation,
  calculateVisibility,
  calculateMaterialConfig,
  calculateGeometryConfig
} from '@/utils/lyrics3DPositionCalculator';
import { useOcclusionManager } from '@/utils/lyrics3DOcclusionManager';
import { usePerformanceManager } from '@/utils/lyrics3DPerformanceManager';
import type { 
  TextPosition, 
  LayerCalculation, 
  LayerType,
  Lyrics3DError,
  FontConfig
} from '@/types/lyrics3D.types';

/**
 * 单个3D文字组件 - 使用Troika Text优化
 */
interface Lyrics3DTextProps {
  text: string;
  index: number;
  currentIndex: number;
  anchorModelPosition: THREE.Vector3;
  anchorModelSize: THREE.Vector3;
  isCurrent: boolean;
  fontConfig?: FontConfig;
  onError?: (error: Lyrics3DError) => void;
  onLoad?: () => void;
  enableDebug?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  leftOffset: -3,
  rightOffset: 3,
  verticalSpacing: 1.2,
  depthOffset: 0
};

/**
 * 字体加载器Hook
 */
const useFontLoader = (fontConfig?: FontConfig) => {
  const [font, setFont] = useState<any | null>(null);
  const [fontStatus, setFontStatus] = useState<'loading' | 'loaded' | 'fallback'>('loading');
  const [error, setError] = useState<Lyrics3DError | null>(null);

  useEffect(() => {
    if (!fontConfig || !fontConfig.fontPath || fontConfig.fontPath.trim() === '') {
      setFontStatus('fallback');
      return;
    }

    const loadFont = async () => {
      try {
        setFontStatus('loading');
        
        // 尝试加载自定义字体
        const loader = new FontLoader();
        const loadedFont = await new Promise<any>((resolve, reject) => {
          loader.load(
            fontConfig.fontPath,
            resolve,
            undefined,
            reject
          );
        });
        
        setFont(loadedFont);
        setFontStatus('loaded');
      } catch (err) {
        console.warn('[Lyrics3DText] Custom font loading failed, using fallback:', err);
        setFontStatus('fallback');
        // 不设置错误，直接使用fallback字体
      }
    };

    loadFont();
  }, [fontConfig]);

  return { font, fontStatus, error };
};

/**
 * 性能优化Hook
 */
const usePerformanceOptimization = (
  isCurrent: boolean,
  distance: number,
  qualityLevel: 'high' | 'medium' | 'low'
) => {
  const [shouldRender, setShouldRender] = useState(true);
  const [lodLevel, setLodLevel] = useState<'high' | 'medium' | 'low'>('high');

  useEffect(() => {
    // 基于距离和质量的LOD计算
    if (distance > 10) {
      setShouldRender(false);
    } else if (distance > 5) {
      setLodLevel('low');
    } else if (distance > 2) {
      setLodLevel('medium');
    } else {
      setLodLevel('high');
    }

    // 根据质量级别调整
    if (qualityLevel === 'low' && distance > 3) {
      setShouldRender(false);
    }
  }, [distance, qualityLevel]);

  return { shouldRender, lodLevel };
};

/**
 * 动画Hook
 */
const useSmoothAnimation = (
  targetPosition: TextPosition,
  isCurrent: boolean
) => {
  const [position, setPosition] = useState(targetPosition);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setPosition(targetPosition);
    setIsAnimating(true);
    
    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [targetPosition]);

  useFrame((_, delta) => {
    if (isAnimating) {
      setPosition(prev => ({
        x: THREE.MathUtils.lerp(prev.x, targetPosition.x, delta * 3),
        y: THREE.MathUtils.lerp(prev.y, targetPosition.y, delta * 3),
        z: THREE.MathUtils.lerp(prev.z, targetPosition.z, delta * 3),
        opacity: THREE.MathUtils.lerp(prev.opacity, targetPosition.opacity, delta * 3),
        scale: THREE.MathUtils.lerp(prev.scale, targetPosition.scale, delta * 3)
      }));
    }
  });

  return { position, isAnimating };
};

/**
 * 单个3D文字组件
 */
const Lyrics3DText: React.FC<Lyrics3DTextProps> = ({
  text,
  index,
  currentIndex,
  anchorModelPosition,
  anchorModelSize,
  isCurrent,
  fontConfig,
  onError,
  onLoad,
  enableDebug = false
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Lyrics3DError | null>(null);
  const { camera, scene } = useThree();

  // 计算距离
  const distance = Math.abs(index - currentIndex);

  // 遮挡管理器
  const occlusionManager = useOcclusionManager(camera, scene);
  
  // 性能管理器
  const performanceManager = usePerformanceManager({
    targetFPS: 60,
    maxVisibleLyrics: 15,
    enableLOD: true,
    enableFrustumCulling: true
  });
  
  // 字体加载
  const { font, fontStatus, error: fontError } = useFontLoader(fontConfig);
  
  // 性能优化
  const shouldRender = performanceManager.calculateVisibility(index, currentIndex, distance);
  const lodConfig = performanceManager.calculateLODLevel(distance, isCurrent);

  // 计算位置
  const targetPosition = useMemo(() => 
    calculateTextPosition(index, currentIndex, anchorModelPosition, anchorModelSize, DEFAULT_CONFIG),
    [index, currentIndex, anchorModelPosition, anchorModelSize]
  );

  // 平滑动画
  const { position, isAnimating } = useSmoothAnimation(targetPosition, isCurrent);
  
  // 视锥剔除检查
  const isInFrustum = performanceManager.checkFrustumCulling(position, camera);

  // 计算层级信息
  const layer = useMemo(() => 
    calculateLayer(index, currentIndex), 
    [index, currentIndex]
  );

  // 错误处理
  const handleError = useCallback((error: Lyrics3DError) => {
    setError(error);
    onError?.(error);
  }, [onError]);

  // 字体加载完成
  useEffect(() => {
    if (fontStatus === 'loaded' || fontStatus === 'fallback') {
      setIsLoading(false);
      onLoad?.();
    }
    
    // 只有在真正需要时才处理字体错误
    if (fontError && fontConfig?.fontPath && fontConfig.fontPath.trim() !== '') {
      handleError(fontError);
    }
  }, [fontStatus, fontError, handleError, onLoad, fontConfig]);

  // 几何体创建错误处理
  const handleGeometryError = useCallback((error: any) => {
    const lyricsError: Lyrics3DError = {
      type: 'geometry_creation',
      message: `Failed to create geometry for text: ${text}`,
      details: error,
      timestamp: Date.now()
    };
    handleError(lyricsError);
  }, [text, handleError]);

  // 材质创建错误处理
  const handleMaterialError = useCallback((error: any) => {
    const lyricsError: Lyrics3DError = {
      type: 'material_creation',
      message: `Failed to create material for text: ${text}`,
      details: error,
      timestamp: Date.now()
    };
    handleError(lyricsError);
  }, [text, handleError]);

  // 渲染错误处理
  const handleRenderError = useCallback((error: any) => {
    const lyricsError: Lyrics3DError = {
      type: 'render_error',
      message: `Render error for text: ${text}`,
      details: error,
      timestamp: Date.now()
    };
    handleError(lyricsError);
  }, [text, handleError]);

  // 更新位置
  useFrame(() => {
    if (meshRef.current && isAnimating) {
      meshRef.current.position.set(position.x, position.y, position.z);
      
      if (meshRef.current.material) {
        const material = meshRef.current.material as THREE.MeshBasicMaterial;
        material.opacity = position.opacity;
        material.needsUpdate = true;
      }
      
      meshRef.current.scale.setScalar(position.scale);
    }
  });

  // 计算遮挡结果
  const occlusionResult = useMemo(() => {
    return occlusionManager.calculateOcclusion(
      position,
      index,
      currentIndex,
      layer
    );
  }, [position, index, currentIndex, layer, occlusionManager]);

  // 计算材质配置（集成遮挡效果）
  const materialConfig = useMemo(() => {
    const baseConfig = calculateMaterialConfig(isCurrent, position.opacity, layer);
    
    return {
      ...baseConfig,
      opacity: baseConfig.opacity * occlusionResult.occlusionFactor,
      transparent: true,
      depthTest: occlusionResult.depthTest,
      depthWrite: occlusionResult.depthWrite
    };
  }, [isCurrent, position.opacity, layer, occlusionResult]);

  // 使用性能管理器的LOD配置
  const fontSize = lodConfig.fontSize;

  // 处理加载完成
  useEffect(() => {
    if (fontStatus === 'loaded' || fontStatus === 'fallback') {
      setIsLoading(false);
      onLoad?.();
    }
  }, [fontStatus, onLoad]);

  // 不渲染条件 - 移到所有hooks之后
  if (error || !shouldRender || !isInFrustum || isLoading) {
    return null;
  }

  return (
    <Text
      ref={meshRef}
      position={[position.x, position.y, position.z]}
      fontSize={fontSize}
      color={materialConfig.color}
      anchorX="center"
      anchorY="middle"
      renderOrder={occlusionResult.renderOrder}
      font={font}
      material-transparent={materialConfig.transparent}
      material-opacity={materialConfig.opacity}
      material-depthTest={materialConfig.depthTest}
      material-depthWrite={materialConfig.depthWrite}
      material-side={materialConfig.side}
    >
      {text}
    </Text>
  );
};

export default Lyrics3DText;
