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