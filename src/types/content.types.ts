// 文本段落接口
export interface TextSegment {
  id: string
  content: string
  startIndex: number
  endIndex: number
  anchorWord?: string
  duration?: number
  modelId?: string
}

// 锚字接口
export interface AnchorWord {
  word: string
  confidence: number
  modelId?: string
  position: number
}

// 文本元数据接口
export interface TextMetadata {
  totalDuration: number
  segmentCount: number
  theme: string
  difficulty: number
  language: 'zh' | 'en'
  category: 'sutra' | 'poetry' | 'philosophy' | 'literature'
}

// 文本内容接口
export interface TextContent {
  id: string
  title: string
  description?: string
  segments: TextSegment[]
  metadata: TextMetadata
  audioConfig?: AudioConfig
}

// 音频配置接口
export interface AudioConfig {
  id: string
  filePath: string
  duration: number
  bpm?: number
  volume?: number
  effects?: AudioEffect[]
}

// 音频效果接口
export interface AudioEffect {
  type: 'reverb' | 'delay' | 'filter' | 'chorus' | 'distortion'
  params: Record<string, number>
  enabled: boolean
}

// 文本处理器接口 (未来 AI 集成)
export interface ITextProcessor {
  segmentText(text: string): Promise<TextSegment[]>
  extractAnchorWords(segments: TextSegment[]): Promise<AnchorWord[]>
  generateMetadata(text: string): Promise<TextMetadata>
  analyzeText(text: string): Promise<TextAnalysis>
}

// 文本分析结果
export interface TextAnalysis {
  sentiment: number // -1 to 1
  complexity: number // 0 to 1
  keywords: string[]
  themes: string[]
  readingTime: number // 分钟
}

// 内容提供者接口
export interface IContentProvider {
  getText(id: string): Promise<TextContent>
  getTextList(): Promise<TextContent[]>
  searchText(query: string): Promise<TextContent[]>
  getRandomText(): Promise<TextContent>
}

// 文本状态类型
export type TextState = 'loading' | 'ready' | 'playing' | 'paused' | 'error'

// 文本导航类型
export type TextNavigation = {
  currentIndex: number
  totalCount: number
  canGoNext: boolean
  canGoPrev: boolean
  progress: number // 0 to 100
}

// ==================== 内容包系统类型定义 ====================

// 内容包元数据
export interface ContentMetadata {
  id: string
  title: string
  description: string
  category: 'buddhist-sutra' | 'taoist-text' | 'meditation' | 'custom'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  duration: string  // 格式: "2:44"
  tags: string[]
  author?: string
  version: string
  createdAt?: string
  updatedAt?: string
}

// 内容包音频配置
export interface ContentAudioConfig {
  file: string
  loopEndTime: number  // 循环截止时间（秒）
  fadeOutDuration: number  // 渐弱时长（秒）
  volume?: number
}

// 内容包歌词配置
export interface ContentLyricsConfig {
  file: string
  encoding?: string
}

// 内容包视觉配置
export interface ContentVisualConfig {
  model?: string
  fallbackColor: string
  rotationSpeed: number
  backgroundStyle?: 'default' | 'neon' | 'classical' | 'modern'
}

// 内容包交互配置
export interface ContentInteractionConfig {
  scrollSensitivity: number
  speedRange: [number, number]  // [最小速度, 最大速度]
  controlMode?: 'scroll' | 'breath' | 'gesture'
}

// 内容段落
export interface ContentSegment {
  id: number
  text: string
  anchor: string
  startTime?: number  // 可选：在LRC中的开始时间
  endTime?: number    // 可选：在LRC中的结束时间
}

// 完整的内容包接口
export interface ContentPackage {
  meta: ContentMetadata
  audio: ContentAudioConfig
  lyrics: ContentLyricsConfig
  visuals: ContentVisualConfig
  interaction: ContentInteractionConfig
  segments: ContentSegment[]
}

// 内容包加载状态
export interface ContentLoadState {
  isLoading: boolean
  isLoaded: boolean
  error: string | null
  package: ContentPackage | null
}

// 内容库配置
export interface ContentLibraryConfig {
  defaultContentId: string
  availableContents: ContentMetadata[]
  cachingEnabled: boolean
  preloadContents: string[]  // 需要预加载的内容ID列表
}