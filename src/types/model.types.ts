import * as THREE from 'three'

// 3D 模型信息接口
export interface Model3DInfo {
  id: string
  name: string
  filePath: string
  category: ModelCategory
  tags: string[]
  fileSize: number
  dimensions?: ModelDimensions
  description?: string
  createdAt?: Date
  updatedAt?: Date
}

// 模型分类
export type ModelCategory =
  | 'calligraphy' // 书法
  | 'sculpture'   // 雕塑
  | 'artifact'    // 文物
  | 'symbol'      // 符号
  | 'decoration'  // 装饰

// 模型尺寸信息
export interface ModelDimensions {
  width: number
  height: number
  depth: number
  boundingBox?: THREE.Box3
}

// 模型动画信息
export interface ModelAnimation {
  name: string
  duration: number
  loop: boolean
  clips?: THREE.AnimationClip[]
}

// 模型材质配置
export interface ModelMaterial {
  type: 'standard' | 'basic' | 'physical' | 'custom'
  color?: string
  metalness?: number
  roughness?: number
  opacity?: number
  transparent?: boolean
  emissive?: string
}

// 模型加载状态
export type ModelLoadState = 'idle' | 'loading' | 'loaded' | 'error'

// 模型渲染配置
export interface ModelRenderConfig {
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: THREE.Vector3
  visible: boolean
  castShadow?: boolean
  receiveShadow?: boolean
  frustumCulled?: boolean
}

// 模型交互配置
export interface ModelInteraction {
  rotatable: boolean
  scalable: boolean
  movable: boolean
  clickable: boolean
  hoverable: boolean
}

// 模型性能配置
export interface ModelPerformance {
  lodLevels: number[]
  occlusionCulling: boolean
  instanceRendering: boolean
  frustumCulling: boolean
}

// 模型管理器接口
export interface IModelManager {
  getModelList(): Promise<Model3DInfo[]>
  getModelById(id: string): Promise<Model3DInfo | null>
  loadModel(id: string): Promise<THREE.Object3D>
  preloadModel(id: string): Promise<void>
  unloadModel(id: string): void
  matchModelByAnchor(anchorWord: string): Promise<string | null>
  getModelFile(id: string): Promise<ArrayBuffer>
  optimizeModel(model: THREE.Object3D): THREE.Object3D
}

// 模型缓存接口
export interface IModelCache {
  get(id: string): THREE.Object3D | undefined
  set(id: string, model: THREE.Object3D): void
  has(id: string): boolean
  remove(id: string): boolean
  clear(): void
  size(): number
}

// 模型加载器配置
export interface ModelLoaderConfig {
  baseUrl?: string
  timeout?: number
  retryAttempts?: number
  progressCallback?: (progress: number) => void
  errorCallback?: (error: Error) => void
}

// 模型事件类型
export interface ModelEvents {
  onLoad: (model: THREE.Object3D) => void
  onProgress: (progress: number) => void
  onError: (error: Error) => void
  onClick: (intersection: THREE.Intersection) => void
  onHover: (intersection: THREE.Intersection | null) => void
}

// 模型实例接口
export interface ModelInstance {
  id: string
  object3D: THREE.Object3D
  info: Model3DInfo
  renderConfig: ModelRenderConfig
  interaction: ModelInteraction
  animations?: ModelAnimation[]
  isVisible: boolean
  isLoaded: boolean
}

// 模型组合接口 (多个模型的组合)
export interface ModelComposition {
  id: string
  name: string
  models: ModelInstance[]
  layout: 'grid' | 'circle' | 'line' | 'custom'
  spacing?: number
  animation?: {
    type: 'rotate' | 'float' | 'pulse' | 'orbit'
    speed: number
    amplitude?: number
  }
}