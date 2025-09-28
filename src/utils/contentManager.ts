import { ContentPackage, ContentLoadState, ContentLibraryConfig, ContentMetadata } from '@/types/content.types'

// 内容包注册表 - 所有可用的内容包
const CONTENT_REGISTRY: Record<string, () => Promise<{ default: ContentPackage }>> = {
  'heart-sutra': () => import('@/contents/heart-sutra'),
  'demo-meditation': () => import('@/contents/demo-meditation'),
  // 未来可以添加更多内容包:
  // 'diamond-sutra': () => import('@/contents/diamond-sutra'),
  // 'lotus-sutra': () => import('@/contents/lotus-sutra'),
  // 'custom-meditation-1': () => import('@/contents/custom-meditation-1'),
}

// 内容库配置
export const contentLibraryConfig: ContentLibraryConfig = {
  defaultContentId: 'heart-sutra',
  availableContents: [
    {
      id: 'heart-sutra',
      title: '心经',
      description: '沉浸式心经数字体验',
      category: 'buddhist-sutra',
      difficulty: 'beginner',
      duration: '2:44',
      tags: ['佛经', '入门', '经典'],
      version: '1.0.0'
    },
    {
      id: 'demo-meditation',
      title: '示例冥想',
      description: '简单的冥想体验示例',
      category: 'meditation',
      difficulty: 'beginner',
      duration: '5:00',
      tags: ['冥想', '放松', '示例'],
      version: '1.0.0'
    }
    // 未来添加更多内容元数据
  ],
  cachingEnabled: true,
  preloadContents: ['heart-sutra']  // 预加载心经
}

// 内容包缓存
class ContentCache {
  private cache = new Map<string, ContentPackage>()
  private loadingPromises = new Map<string, Promise<ContentPackage>>()

  // 获取缓存的内容包
  get(contentId: string): ContentPackage | null {
    return this.cache.get(contentId) || null
  }

  // 设置缓存
  set(contentId: string, content: ContentPackage): void {
    this.cache.set(contentId, content)
  }

  // 检查是否已缓存
  has(contentId: string): boolean {
    return this.cache.has(contentId)
  }

  // 清理缓存
  clear(): void {
    this.cache.clear()
    this.loadingPromises.clear()
  }

  // 获取正在加载的Promise
  getLoadingPromise(contentId: string): Promise<ContentPackage> | null {
    return this.loadingPromises.get(contentId) || null
  }

  // 设置正在加载的Promise
  setLoadingPromise(contentId: string, promise: Promise<ContentPackage>): void {
    this.loadingPromises.set(contentId, promise)
  }

  // 清理加载Promise
  clearLoadingPromise(contentId: string): void {
    this.loadingPromises.delete(contentId)
  }
}

// 全局内容缓存实例
const contentCache = new ContentCache()

// 内容管理器类
export class ContentManager {
  private cache: ContentCache
  private config: ContentLibraryConfig

  constructor(config: ContentLibraryConfig = contentLibraryConfig) {
    this.cache = contentCache
    this.config = config
  }

  // 加载内容包
  async loadContent(contentId: string): Promise<ContentPackage> {
    try {
      // 检查缓存
      if (this.cache.has(contentId)) {
        console.log(`从缓存加载内容包: ${contentId}`)
        return this.cache.get(contentId)!
      }

      // 检查是否正在加载
      const existingPromise = this.cache.getLoadingPromise(contentId)
      if (existingPromise) {
        console.log(`等待内容包加载完成: ${contentId}`)
        return existingPromise
      }

      // 检查内容包是否存在
      const contentLoader = CONTENT_REGISTRY[contentId]
      if (!contentLoader) {
        throw new Error(`内容包不存在: ${contentId}`)
      }

      console.log(`开始加载内容包: ${contentId}`)

      // 创建加载Promise
      const loadingPromise = this.loadContentFromRegistry(contentId, contentLoader)
      this.cache.setLoadingPromise(contentId, loadingPromise)

      const content = await loadingPromise

      // 加载完成后缓存并清理Promise
      if (this.config.cachingEnabled) {
        this.cache.set(contentId, content)
      }
      this.cache.clearLoadingPromise(contentId)

      console.log(`内容包加载完成: ${contentId}`)
      return content

    } catch (error) {
      this.cache.clearLoadingPromise(contentId)
      console.error(`加载内容包失败: ${contentId}`, error)
      throw error
    }
  }

  // 从注册表加载内容包
  private async loadContentFromRegistry(
    contentId: string,
    loader: () => Promise<{ default: ContentPackage }>
  ): Promise<ContentPackage> {
    const module = await loader()
    const content = module.default

    // 验证内容包格式
    this.validateContentPackage(content)

    return content
  }

  // 验证内容包格式
  private validateContentPackage(content: ContentPackage): void {
    if (!content.meta || !content.meta.id) {
      throw new Error('内容包缺少有效的元数据')
    }
    if (!content.audio || !content.audio.file) {
      throw new Error('内容包缺少音频配置')
    }
    if (!content.segments || content.segments.length === 0) {
      throw new Error('内容包缺少文本段落')
    }
  }

  // 获取所有可用内容的元数据
  getAvailableContents(): ContentMetadata[] {
    return this.config.availableContents
  }

  // 获取默认内容ID
  getDefaultContentId(): string {
    return this.config.defaultContentId
  }

  // 预加载指定内容
  async preloadContents(): Promise<void> {
    const preloadPromises = this.config.preloadContents.map(contentId => {
      if (!this.cache.has(contentId)) {
        return this.loadContent(contentId).catch(error => {
          console.warn(`预加载内容包失败: ${contentId}`, error)
        })
      }
    })

    await Promise.all(preloadPromises)
    console.log('内容包预加载完成')
  }

  // 清理缓存
  clearCache(): void {
    this.cache.clear()
    console.log('内容包缓存已清理')
  }

  // 检查内容包是否存在
  isContentAvailable(contentId: string): boolean {
    return contentId in CONTENT_REGISTRY
  }

  // 搜索内容包
  searchContents(query: string): ContentMetadata[] {
    const normalizedQuery = query.toLowerCase()
    return this.config.availableContents.filter(content =>
      content.title.toLowerCase().includes(normalizedQuery) ||
      content.description.toLowerCase().includes(normalizedQuery) ||
      content.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
    )
  }
}

// 全局内容管理器实例
export const contentManager = new ContentManager()

// 便捷函数
export const loadContent = (contentId: string) => contentManager.loadContent(contentId)
export const getAvailableContents = () => contentManager.getAvailableContents()
export const getDefaultContentId = () => contentManager.getDefaultContentId()
export const preloadContents = () => contentManager.preloadContents()
export const clearContentCache = () => contentManager.clearCache()
export const isContentAvailable = (contentId: string) => contentManager.isContentAvailable(contentId)
export const searchContents = (query: string) => contentManager.searchContents(query)