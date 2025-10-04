import * as THREE from 'three';
import type { TextPosition, LayerCalculation, LayerType } from '@/types/lyrics3D.types';

/**
 * 3D字幕位置计算工具
 * 
 * 核心功能：
 * 1. 实现"前-后-后"循环的空间布局
 * 2. 相对于锚字3D模型的精确定位
 * 3. 复刻2D布局的左右分布
 * 4. 支持平滑动画和性能优化
 */

/**
 * 计算"前-后-后"循环的层级
 */
export const calculateLayer = (index: number, currentIndex: number): LayerCalculation => {
  const relativeIndex = Math.abs(index - currentIndex);
  const layerCycle = relativeIndex % 3;
  
  const layerConfig = {
    0: { layerType: 'front' as LayerType, depthOffset: -0.5, renderOrder: 1 },
    1: { layerType: 'back' as LayerType, depthOffset: 0.8, renderOrder: 0 },
    2: { layerType: 'back' as LayerType, depthOffset: 0.8, renderOrder: 0 }
  };
  
  return layerConfig[layerCycle as keyof typeof layerConfig];
};

/**
 * 计算3D文字位置
 */
export const calculateTextPosition = (
  index: number, 
  currentIndex: number, 
  anchorModelPosition: THREE.Vector3,
  anchorModelSize: THREE.Vector3,
  options?: {
    leftOffset?: number;
    rightOffset?: number;
    verticalSpacing?: number;
    depthOffset?: number;
  }
): TextPosition => {
  const {
    leftOffset = -3,
    rightOffset = 3,
    verticalSpacing = 1.2,
    depthOffset = 0
  } = options || {};

  const isLeft = index % 2 === 0;
  const x = isLeft ? leftOffset : rightOffset;  // 左右分布，复刻现有2D布局
  const y = (index - currentIndex) * verticalSpacing; // 上下位置，对应滚动效果
  
  // 计算层级
  const layer = calculateLayer(index, currentIndex);
  const z = anchorModelPosition.z + layer.depthOffset + depthOffset;
  
  // 计算透明度
  const distance = Math.abs(index - currentIndex);
  const opacity = Math.max(0, 1 - distance * 0.3);
  
  // 计算缩放
  const scale = distance === 0 ? 1.2 : 1.0;
  
  return {
    x,
    y,
    z,
    opacity,
    scale
  };
};

/**
 * 批量计算多个文字的位置
 */
export const calculateMultipleTextPositions = (
  lyricsData: Array<{ text: string; time: number; index: number }>,
  currentIndex: number,
  anchorModelPosition: THREE.Vector3,
  anchorModelSize: THREE.Vector3,
  options?: {
    maxVisible?: number;
    leftOffset?: number;
    rightOffset?: number;
    verticalSpacing?: number;
    depthOffset?: number;
  }
): Array<{ lyric: { text: string; time: number; index: number }; position: TextPosition; layer: LayerCalculation }> => {
  const { maxVisible = 15 } = options || {};
  
  // 计算可见范围
  const start = Math.max(0, currentIndex - Math.floor(maxVisible / 2));
  const end = Math.min(lyricsData.length, start + maxVisible);
  
  return lyricsData.slice(start, end).map((lyric, index) => {
    const originalIndex = start + index;
    const position = calculateTextPosition(
      originalIndex,
      currentIndex,
      anchorModelPosition,
      anchorModelSize,
      options
    );
    const layer = calculateLayer(originalIndex, currentIndex);
    
    return {
      lyric: { ...lyric, index: originalIndex },
      position,
      layer
    };
  });
};

/**
 * 计算文字相对于锚字模型的边界框
 */
export const calculateTextBounds = (
  text: string,
  fontSize: number,
  position: TextPosition
): THREE.Box3 => {
  // 估算文字边界框（基于字体大小和文字长度）
  const textWidth = text.length * fontSize * 0.6; // 中文字符宽度估算
  const textHeight = fontSize;
  
  const halfWidth = textWidth / 2;
  const halfHeight = textHeight / 2;
  
  return new THREE.Box3(
    new THREE.Vector3(
      position.x - halfWidth,
      position.y - halfHeight,
      position.z - 0.1
    ),
    new THREE.Vector3(
      position.x + halfWidth,
      position.y + halfHeight,
      position.z + 0.1
    )
  );
};

/**
 * 检查文字是否与锚字模型重叠
 */
export const checkTextModelOverlap = (
  textBounds: THREE.Box3,
  modelBounds: THREE.Box3
): boolean => {
  return textBounds.intersectsBox(modelBounds);
};

/**
 * 计算文字的最佳渲染顺序
 */
export const calculateRenderOrder = (
  index: number,
  currentIndex: number,
  layer: LayerCalculation
): number => {
  const distance = Math.abs(index - currentIndex);
  const baseOrder = layer.renderOrder;
  
  // 距离越近，渲染顺序越高（更晚渲染，显示在前面）
  return baseOrder + (10 - distance) * 0.1;
};

/**
 * 计算文字的视锥剔除
 */
export const calculateFrustumCulling = (
  position: TextPosition,
  camera: THREE.Camera,
  margin: number = 2
): boolean => {
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  frustum.setFromProjectionMatrix(matrix);
  
  const point = new THREE.Vector3(position.x, position.y, position.z);
  return frustum.containsPoint(point);
};

/**
 * 计算LOD级别
 */
export const calculateLODLevel = (
  distance: number,
  qualityLevel: 'high' | 'medium' | 'low'
): 'high' | 'medium' | 'low' => {
  if (qualityLevel === 'low' || distance > 8) {
    return 'low';
  } else if (qualityLevel === 'medium' || distance > 4) {
    return 'medium';
  } else {
    return 'high';
  }
};

/**
 * 计算动画插值
 */
export const calculateAnimationInterpolation = (
  currentPosition: TextPosition,
  targetPosition: TextPosition,
  deltaTime: number,
  speed: number = 3
): TextPosition => {
  const lerpFactor = Math.min(1, deltaTime * speed);
  
  return {
    x: THREE.MathUtils.lerp(currentPosition.x, targetPosition.x, lerpFactor),
    y: THREE.MathUtils.lerp(currentPosition.y, targetPosition.y, lerpFactor),
    z: THREE.MathUtils.lerp(currentPosition.z, targetPosition.z, lerpFactor),
    opacity: THREE.MathUtils.lerp(currentPosition.opacity, targetPosition.opacity, lerpFactor),
    scale: THREE.MathUtils.lerp(currentPosition.scale, targetPosition.scale, lerpFactor)
  };
};

/**
 * 计算性能优化的可见性
 */
export const calculateVisibility = (
  index: number,
  currentIndex: number,
  qualityLevel: 'high' | 'medium' | 'low',
  maxVisible: number = 15
): boolean => {
  const distance = Math.abs(index - currentIndex);
  
  // 基于质量级别的可见性计算
  switch (qualityLevel) {
    case 'high':
      return distance <= maxVisible;
    case 'medium':
      return distance <= Math.floor(maxVisible * 0.7);
    case 'low':
      return distance <= Math.floor(maxVisible * 0.5);
    default:
      return distance <= maxVisible;
  }
};

/**
 * 计算文字材质配置
 */
export const calculateMaterialConfig = (
  isCurrent: boolean,
  opacity: number,
  layer: LayerCalculation
) => {
  return {
    color: isCurrent ? '#E2E8F0' : '#94A3B8',
    opacity,
    transparent: true,
    depthTest: layer.layerType === 'front',
    depthWrite: layer.layerType === 'front',
    side: THREE.DoubleSide
  };
};

/**
 * 计算文字几何体配置
 */
export const calculateGeometryConfig = (
  lodLevel: 'high' | 'medium' | 'low'
) => {
  const configs = {
    high: {
      curveSegments: 64,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.01,
      bevelOffset: 0,
      bevelSegments: 3
    },
    medium: {
      curveSegments: 32,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.005,
      bevelOffset: 0,
      bevelSegments: 2
    },
    low: {
      curveSegments: 16,
      bevelEnabled: false,
      bevelThickness: 0,
      bevelSize: 0,
      bevelOffset: 0,
      bevelSegments: 1
    }
  };
  
  return configs[lodLevel];
};

export default {
  calculateLayer,
  calculateTextPosition,
  calculateMultipleTextPositions,
  calculateTextBounds,
  checkTextModelOverlap,
  calculateRenderOrder,
  calculateFrustumCulling,
  calculateLODLevel,
  calculateAnimationInterpolation,
  calculateVisibility,
  calculateMaterialConfig,
  calculateGeometryConfig
};
