import * as THREE from 'three';

/**
 * 3D字幕质量级别
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
 * 3D字幕配置接口
 */
export interface Lyrics3DConfig {
  maxVisibleLyrics: number;
  updateRate: number;
  enableOcclusion: boolean;
  qualityLevel: QualityLevel;
  anchorModelReference?: THREE.Object3D;
}

/**
 * 3D字幕组件Props
 */
export interface Lyrics3DProps {
  lyricsData: LyricLine[];
  currentIndex: number;
  scrollTime: number;
  isPlaying: boolean;
  scrollVelocity: number;
  config?: Lyrics3DConfig;
  // 锚字模型相关
  anchorModel?: THREE.Object3D;
  anchorModelSize?: THREE.Vector3;
  currentAnchor?: string;
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
 * 3D文字位置计算结果
 */
export interface TextPosition {
  x: number;
  y: number;
  z: number;
  opacity: number;
  scale: number;
}

/**
 * 3D文字材质配置
 */
export interface TextMaterialConfig {
  color: string | number;
  opacity: number;
  metalness: number;
  roughness: number;
  transmission: number;
  transparent: boolean;
}

/**
 * 性能配置
 */
export interface PerformanceConfig {
  desktop: {
    maxVisibleLyrics: number;
    updateRate: number;
    enableOcclusion: boolean;
    qualityLevel: QualityLevel;
  };
  mobile: {
    maxVisibleLyrics: number;
    updateRate: number;
    enableOcclusion: boolean;
    qualityLevel: QualityLevel;
  };
}

/**
 * 动画配置
 */
export interface AnimationConfig {
  positionSpeed: number;
  opacitySpeed: number;
  scaleSpeed: number;
  enableSmoothTransition: boolean;
}

/**
 * 字体配置
 */
export interface FontConfig {
  fontPath: string;
  fallbackFont: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
}

/**
 * 3D字幕渲染器配置
 */
export interface Lyrics3DRendererConfig {
  // 基础配置
  config: Lyrics3DConfig;
  
  // 性能配置
  performance: PerformanceConfig;
  
  // 动画配置
  animation: AnimationConfig;
  
  // 字体配置
  font: FontConfig;
  
  // 材质配置
  material: TextMaterialConfig;
}

/**
 * 空间布局类型
 */
export type LayerType = 'front' | 'back';

/**
 * 前-后-后循环的层级计算
 */
export interface LayerCalculation {
  layerType: LayerType;
  depthOffset: number;
  renderOrder: number;
}

/**
 * 3D字幕事件类型
 */
export interface Lyrics3DEvents {
  onTextClick?: (text: string, index: number) => void;
  onTextHover?: (text: string, index: number) => void;
  onTextLeave?: (text: string, index: number) => void;
  onAnimationComplete?: (index: number) => void;
}

/**
 * 调试配置
 */
export interface DebugConfig {
  showBoundingBoxes: boolean;
  showLayerIndicators: boolean;
  showPerformanceStats: boolean;
  enableWireframe: boolean;
  logFrameRate: boolean;
}

/**
 * 3D字幕状态快照
 */
export interface Lyrics3DStateSnapshot {
  timestamp: number;
  currentIndex: number;
  scrollTime: number;
  isPlaying: boolean;
  frameRate: number;
  memoryUsage: number;
  visibleTextCount: number;
}

/**
 * 错误类型
 */
export interface Lyrics3DError {
  type: 'font_loading' | 'texture_loading' | 'geometry_creation' | 'material_creation' | 'render_error';
  message: string;
  details?: any;
  timestamp: number;
}

/**
 * 3D字幕组件状态
 */
export interface Lyrics3DComponentState {
  isLoading: boolean;
  isError: boolean;
  error: Lyrics3DError | null;
  isInitialized: boolean;
  lastUpdateTime: number;
}

/**
 * 锚字模型信息
 */
export interface AnchorModelInfo {
  model: THREE.Object3D;
  position: THREE.Vector3;
  size: THREE.Vector3;
  boundingBox: THREE.Box3;
  anchor: string;
}

/**
 * 视锥剔除配置
 */
export interface FrustumCullingConfig {
  enabled: boolean;
  margin: number;
  updateFrequency: number;
}

/**
 * LOD配置
 */
export interface LODConfig {
  enabled: boolean;
  distances: number[];
  levels: QualityLevel[];
  updateFrequency: number;
}

/**
 * 实例化渲染配置
 */
export interface InstancedRenderingConfig {
  enabled: boolean;
  maxInstances: number;
  batchSize: number;
  updateFrequency: number;
}

/**
 * 内存管理配置
 */
export interface MemoryManagementConfig {
  maxCacheSize: number;
  cleanupInterval: number;
  enableGarbageCollection: boolean;
  textureCompression: boolean;
}

/**
 * 3D字幕完整配置
 */
export interface Lyrics3DFullConfig {
  // 基础配置
  config: Lyrics3DConfig;
  
  // 性能配置
  performance: PerformanceConfig;
  
  // 动画配置
  animation: AnimationConfig;
  
  // 字体配置
  font: FontConfig;
  
  // 材质配置
  material: TextMaterialConfig;
  
  // 调试配置
  debug: DebugConfig;
  
  // 视锥剔除配置
  frustumCulling: FrustumCullingConfig;
  
  // LOD配置
  lod: LODConfig;
  
  // 实例化渲染配置
  instancedRendering: InstancedRenderingConfig;
  
  // 内存管理配置
  memoryManagement: MemoryManagementConfig;
}

export default {
  QualityLevel,
  LyricLine,
  Lyrics3DConfig,
  Lyrics3DProps,
  LyricsControllerData,
  TextPosition,
  TextMaterialConfig,
  PerformanceConfig,
  AnimationConfig,
  FontConfig,
  Lyrics3DRendererConfig,
  LayerType,
  LayerCalculation,
  Lyrics3DEvents,
  DebugConfig,
  Lyrics3DStateSnapshot,
  Lyrics3DError,
  Lyrics3DComponentState,
  AnchorModelInfo,
  FrustumCullingConfig,
  LODConfig,
  InstancedRenderingConfig,
  MemoryManagementConfig,
  Lyrics3DFullConfig
};
