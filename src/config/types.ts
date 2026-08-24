/**
 * 项目配置类型定义
 *
 * 这个文件定义了所有配置项的 TypeScript 类型
 * 用于类型检查和 IDE 智能提示
 */

// ==================== 项目元信息 ====================

export interface ProjectMeta {
  id: string;
  name: string;
  description?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== 资源配置 ====================

export interface AudioConfig {
  src: string;
  format: 'mp3' | 'wav' | 'ogg' | 'flac';
  duration?: number;
  title?: string;
  artist?: string;
  album?: string;
}

export interface LyricsConfig {
  src: string;
  format: 'lrc';
  encoding?: string;
}

export interface ModelsConfig {
  directory: string;
  format: 'obj' | 'glb' | 'gltf';
}

export interface AssetConfig {
  audio: AudioConfig;
  lyrics: LyricsConfig;
  models: ModelsConfig;
}

// ==================== 主题配置 ====================

export interface AnchorThemeConfig {
  primary: string;              // 锚字主色
  glowPrimary: string;          // 光晕颜色1
  glowSecondary: string;        // 光晕颜色2
  glowIntensity: number;        // 光晕强度 0-1
  fontSize?: number;            // 字体大小（可选）
}

export interface LyricsThemeConfig {
  current: string;              // 当前歌词颜色
  adjacent: string;             // 相邻歌词颜色
  nextAdjacent: string;         // 次相邻歌词颜色
  distant: string;              // 远距离歌词颜色
  gradientStart: string;        // 渐变起始色
  gradientEnd: string;          // 渐变结束色
  hoverBackground?: string;     // 悬停背景色（可选）
}

export interface ProgressBarThemeConfig {
  background: string;           // 进度条背景色
  completed: string;            // 完成部分颜色
  slider: string;               // 滑块颜色
  border: string;               // 边框颜色
}

export interface BackgroundThemeConfig {
  base: string;                 // 基础背景色
  overlay: string;              // 叠加层颜色
  noise?: boolean;              // 是否显示噪点
  noiseIntensity?: number;      // 噪点强度
}

export interface ThemeConfig {
  anchor: AnchorThemeConfig;
  lyrics: LyricsThemeConfig;
  progressBar: ProgressBarThemeConfig;
  background: BackgroundThemeConfig;
}

// ==================== 锚字配置 ====================

export interface AnchorMapping {
  anchor: string;               // 锚字
  modelPath: string;            // 模型文件名（相对于 models.directory）
  description?: string;         // 描述
  semanticMeaning?: string;     // 语义含义
}

export interface AnchorConfig {
  mappings: AnchorMapping[];
  defaultModel: string;         // 默认模型文件名
}

// ==================== 时间轴配置 ====================

export interface TimelineItem {
  time: number;                 // 时间点（秒）
  anchor: string;               // 锚字
  text: string;                 // 歌词文本
  meaning?: string;             // 语义描述
}

// ==================== 性能配置 ====================

export interface PerformanceConfig {
  qualityLevel?: 'low' | 'medium' | 'high';
  preloadModels?: boolean;
  maxConcurrentLoads?: number;
  enableAdaptiveQuality?: boolean;
}

// ==================== 完整项目配置 ====================

export interface ProjectConfig {
  version: string;              // 配置文件版本
  project: ProjectMeta;         // 项目元信息
  assets: AssetConfig;          // 资源配置
  theme: ThemeConfig;           // 主题配置
  anchors: AnchorConfig;        // 锚字配置
  timeline: TimelineItem[];     // 时间轴配置
  performance: PerformanceConfig; // 性能配置
}
