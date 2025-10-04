import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * 模型预加载管理器
 * 负责在后台预加载所有可能的模型，避免切换时的加载延迟
 * 
 * 优化特性：
 * 1. 优先级加载：当前需要的模型优先加载
 * 2. 智能预加载：根据时间轴预测下一个需要的模型
 * 3. 渐进式加载：先加载关键模型，再加载其他模型
 * 4. 缓存管理：智能清理不常用的模型
 */
class ModelPreloader {
  private static instance: ModelPreloader;
  private cache = new Map<string, THREE.BufferGeometry>();
  private loadingPromises = new Map<string, Promise<THREE.BufferGeometry>>();
  private isPreloading = false;
  private loadingQueue: string[] = [];
  private priorityModels = new Set<string>();
  private loadingStatus = new Map<string, 'pending' | 'loading' | 'loaded' | 'error'>();
  private maxConcurrentLoads = 3; // 最大并发加载数
  private currentLoads = 0;

  private constructor() {}

  static getInstance(): ModelPreloader {
    if (!ModelPreloader.instance) {
      ModelPreloader.instance = new ModelPreloader();
    }
    return ModelPreloader.instance;
  }

  /**
   * 智能预加载所有模型（优化版）
   * 支持优先级加载和渐进式加载
   */
  async preloadAllModels(modelPaths: string[], priorityPaths: string[] = []): Promise<void> {
    if (this.isPreloading) {
      console.log('[ModelPreloader] 预加载已在进行中');
      return;
    }

    this.isPreloading = true;
    console.log('[ModelPreloader] 开始智能预加载:', { 
      total: modelPaths.length, 
      priority: priorityPaths.length 
    });

    try {
      // 设置优先级模型
      priorityPaths.forEach(path => this.priorityModels.add(path));
      
      // 初始化加载状态
      modelPaths.forEach(path => {
        if (!this.loadingStatus.has(path)) {
          this.loadingStatus.set(path, 'pending');
        }
      });

      // 启动渐进式加载
      await this.startProgressiveLoading(modelPaths);
      
      console.log('[ModelPreloader] ✅ 智能预加载完成');
    } catch (error) {
      console.error('[ModelPreloader] ❌ 预加载失败:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * 渐进式加载：优先加载重要模型，然后加载其他模型
   */
  private async startProgressiveLoading(modelPaths: string[]): Promise<void> {
    // 1. 首先加载优先级模型
    const priorityPaths = modelPaths.filter(path => this.priorityModels.has(path));
    const normalPaths = modelPaths.filter(path => !this.priorityModels.has(path));

    console.log('[ModelPreloader] 阶段1: 加载优先级模型', priorityPaths);
    if (priorityPaths.length > 0) {
      await this.loadModelsWithConcurrency(priorityPaths);
    }

    // 2. 然后加载其他模型
    console.log('[ModelPreloader] 阶段2: 加载其他模型', normalPaths);
    if (normalPaths.length > 0) {
      await this.loadModelsWithConcurrency(normalPaths);
    }
  }

  /**
   * 控制并发数量的模型加载
   */
  private async loadModelsWithConcurrency(modelPaths: string[]): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    for (const path of modelPaths) {
      if (this.cache.has(path) || this.loadingPromises.has(path)) {
        continue; // 跳过已加载或正在加载的模型
      }

      const loadPromise = this.loadModelWithConcurrencyControl(path);
      loadPromises.push(loadPromise);
    }

    await Promise.all(loadPromises);
  }

  /**
   * 带并发控制的模型加载
   */
  private async loadModelWithConcurrencyControl(modelPath: string): Promise<void> {
    // 等待并发槽位
    while (this.currentLoads >= this.maxConcurrentLoads) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.currentLoads++;
    this.loadingStatus.set(modelPath, 'loading');

    try {
      await this.loadModel(modelPath);
      this.loadingStatus.set(modelPath, 'loaded');
      console.log('[ModelPreloader] 模型加载完成:', modelPath);
    } catch (error) {
      this.loadingStatus.set(modelPath, 'error');
      console.error('[ModelPreloader] 模型加载失败:', modelPath, error);
    } finally {
      this.currentLoads--;
    }
  }

  /**
   * 加载单个模型
   */
  private async loadModel(modelPath: string): Promise<THREE.BufferGeometry> {
    // 如果已经缓存，直接返回
    if (this.cache.has(modelPath)) {
      console.log('[ModelPreloader] 使用缓存模型:', modelPath);
      return this.cache.get(modelPath)!;
    }

    // 如果正在加载，等待加载完成
    if (this.loadingPromises.has(modelPath)) {
      console.log('[ModelPreloader] 等待模型加载完成:', modelPath);
      return this.loadingPromises.get(modelPath)!;
    }

    // 开始加载
    const loadPromise = this.loadModelFromFile(modelPath);
    this.loadingPromises.set(modelPath, loadPromise);

    try {
      const geometry = await loadPromise;
      this.cache.set(modelPath, geometry);
      this.loadingPromises.delete(modelPath);
      console.log('[ModelPreloader] 模型加载完成:', modelPath);
      return geometry;
    } catch (error) {
      this.loadingPromises.delete(modelPath);
      throw error;
    }
  }

  /**
   * 从文件加载模型
   */
  private async loadModelFromFile(modelPath: string): Promise<THREE.BufferGeometry> {
    let loadedGeometry: THREE.BufferGeometry | null = null;

    if (modelPath.endsWith('.obj')) {
      const loader = new OBJLoader();
      const obj = await new Promise<THREE.Group>((resolve, reject) => {
        loader.load(modelPath, resolve, undefined, reject);
      });
      
      // 提取第一个几何体
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          loadedGeometry = child.geometry;
        }
      });
    } else if (modelPath.endsWith('.glb') || modelPath.endsWith('.gltf')) {
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(modelPath, resolve, undefined, reject);
      });
      
      // 提取第一个几何体
      gltf.scene.traverse((child: any) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          loadedGeometry = child.geometry;
        }
      });
    }

    if (!loadedGeometry) {
      throw new Error(`未找到有效的几何体: ${modelPath}`);
    }

    // 几何体优化
    loadedGeometry = mergeVertices(loadedGeometry);
    loadedGeometry.computeVertexNormals();

    return loadedGeometry;
  }

  /**
   * 获取缓存的模型
   */
  getModel(modelPath: string): THREE.BufferGeometry | null {
    return this.cache.get(modelPath) || null;
  }

  /**
   * 检查模型是否已加载
   */
  isModelLoaded(modelPath: string): boolean {
    return this.cache.has(modelPath);
  }

  /**
   * 检查是否正在加载
   */
  isModelLoading(modelPath: string): boolean {
    return this.loadingPromises.has(modelPath);
  }

  /**
   * 获取缓存状态（增强版）
   */
  getCacheStatus(): { 
    total: number; 
    loaded: number; 
    loading: number; 
    pending: number;
    error: number;
    priority: number;
  } {
    const loaded = this.cache.size;
    const loading = this.currentLoads;
    const pending = Array.from(this.loadingStatus.values()).filter(status => status === 'pending').length;
    const error = Array.from(this.loadingStatus.values()).filter(status => status === 'error').length;
    const priority = this.priorityModels.size;

    return {
      total: this.loadingStatus.size,
      loaded,
      loading,
      pending,
      error,
      priority
    };
  }

  /**
   * 获取详细加载状态
   */
  getDetailedStatus(): { [modelPath: string]: string } {
    const status: { [modelPath: string]: string } = {};
    this.loadingStatus.forEach((status, path) => {
      status[path] = status;
    });
    return status;
  }

  /**
   * 设置模型优先级
   */
  setModelPriority(modelPath: string, isPriority: boolean = true): void {
    if (isPriority) {
      this.priorityModels.add(modelPath);
      console.log('[ModelPreloader] 设置模型优先级:', modelPath);
    } else {
      this.priorityModels.delete(modelPath);
    }
  }

  /**
   * 预测下一个需要的模型（基于时间轴）
   */
  predictNextModel(currentTime: number, anchorTimeline: Array<{time: number, anchor: string}>, modelMapping: {[key: string]: string}): string | null {
    // 找到当前时间之后的下一个锚点
    const nextAnchor = anchorTimeline.find(item => item.time > currentTime);
    if (nextAnchor && modelMapping[nextAnchor.anchor]) {
      return modelMapping[nextAnchor.anchor];
    }
    return null;
  }

  /**
   * 智能预加载下一个模型
   */
  async preloadNextModel(currentTime: number, anchorTimeline: Array<{time: number, anchor: string}>, modelMapping: {[key: string]: string}): Promise<void> {
    const nextModelPath = this.predictNextModel(currentTime, anchorTimeline, modelMapping);
    if (nextModelPath && !this.cache.has(nextModelPath) && !this.loadingPromises.has(nextModelPath)) {
      console.log('[ModelPreloader] 智能预加载下一个模型:', nextModelPath);
      this.setModelPriority(nextModelPath, true);
      try {
        await this.loadModel(nextModelPath);
      } catch (error) {
        console.error('[ModelPreloader] 智能预加载失败:', error);
      }
    }
  }

  /**
   * 手动添加模型到缓存
   */
  addToCache(modelPath: string, geometry: THREE.BufferGeometry): void {
    this.cache.set(modelPath, geometry);
    this.loadingStatus.set(modelPath, 'loaded');
    console.log('[ModelPreloader] 模型已添加到缓存:', modelPath);
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
    this.loadingStatus.clear();
    this.priorityModels.clear();
    console.log('[ModelPreloader] 缓存已清理');
  }
}

export default ModelPreloader;
