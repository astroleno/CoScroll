import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { assetUrl } from '@/utils/assetUrl';
import { createOffsetGeometry, normalizeModelGeometry } from './modelGeometry';
import { decodePreparedModel, PREPARED_MODEL_PRESET } from './preparedModelGeometry';
import preparedModels from './prepared-models.json';

// Match complete release URLs; an external custom OBJ with the same basename is never substituted.
const preparedByUrl = new Map(preparedModels.models.map(model => [assetUrl(model.sourcePath), model]));

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
  private offsetGeometryCache = new Map<string, Map<string, THREE.BufferGeometry>>();
  private owners = new Map<symbol, Set<string>>();
  private trimTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly idleModelLimit = 8;
  private static DEBUG = false; // 如需调试，设为 true

  private constructor() {}

  retainPaths(paths: string[]): () => void {
    const owner = Symbol('model owner');
    this.owners.set(owner, new Set(paths));
    return () => { this.owners.delete(owner); this.scheduleTrim(); };
  }

  private scheduleTrim() {
    if (this.trimTimer !== null) return;
    this.trimTimer = setTimeout(() => { this.trimTimer = null; this.trimCache(); }, 0);
  }

  trimCache() {
    const pinned = new Set(Array.from(this.owners.values()).flatMap(paths => Array.from(paths)));
    const idle = Array.from(this.cache.keys()).filter(path => !pinned.has(path));
    for (const path of idle.slice(0, Math.max(0, idle.length - this.idleModelLimit))) {
      const geometries = new Set([this.cache.get(path), ...Array.from(this.offsetGeometryCache.get(path)?.values() ?? [])]);
      geometries.forEach(geometry => geometry?.dispose());
      this.cache.delete(path);
      this.offsetGeometryCache.delete(path);
      this.loadingStatus.delete(path);
      this.priorityModels.delete(path);
    }
    this.loadingStatus.forEach((status, path) => {
      if (status === 'error' && !pinned.has(path)) this.loadingStatus.delete(path);
    });
  }

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
      if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 预加载已在进行中');
      return;
    }

    this.isPreloading = true;
    if (ModelPreloader.DEBUG) {
      console.log('[ModelPreloader] 开始智能预加载:', { 
        total: modelPaths.length, 
        priority: priorityPaths.length 
      });
    }

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
      
      if (ModelPreloader.DEBUG) console.log('[ModelPreloader] ✅ 智能预加载完成');
    } catch (error) {
      if (ModelPreloader.DEBUG) console.error('[ModelPreloader] ❌ 预加载失败:', error);
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

    if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 阶段1: 加载优先级模型', priorityPaths);
    if (priorityPaths.length > 0) {
      await this.loadModelsWithConcurrency(priorityPaths);
    }

    // 2. 然后加载其他模型
    if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 阶段2: 加载其他模型', normalPaths);
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
      if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 模型加载完成:', modelPath);
    } catch (error) {
      this.loadingStatus.set(modelPath, 'error');
      if (ModelPreloader.DEBUG) console.error('[ModelPreloader] 模型加载失败:', modelPath, error);
    } finally {
      this.currentLoads--;
    }
  }

  /**
   * 加载单个模型
   */
  async loadModel(modelPath: string): Promise<THREE.BufferGeometry> {
    // 如果已经缓存，直接返回
    if (this.cache.has(modelPath)) {
      if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 使用缓存模型:', modelPath);
      const geometry = this.cache.get(modelPath)!;
      this.cache.delete(modelPath);
      this.cache.set(modelPath, geometry);
      return geometry;
    }

    // 如果正在加载，等待加载完成
    if (this.loadingPromises.has(modelPath)) {
      if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 等待模型加载完成:', modelPath);
      return this.loadingPromises.get(modelPath)!;
    }

    // 开始加载
    this.loadingStatus.set(modelPath, 'loading');
    const loadPromise = this.loadModelFromFile(modelPath);
    this.loadingPromises.set(modelPath, loadPromise);

    try {
      const geometry = await loadPromise;
      this.cache.set(modelPath, geometry);
      this.loadingStatus.set(modelPath, 'loaded');
      this.loadingPromises.delete(modelPath);
      this.scheduleTrim();
      if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 模型加载完成:', modelPath);
      return geometry;
    } catch (error) {
      this.loadingPromises.delete(modelPath);
      this.loadingStatus.set(modelPath, 'error');
      throw error;
    }
  }

  /**
   * 从文件加载模型
   */
  private async loadModelFromFile(modelPath: string): Promise<THREE.BufferGeometry> {
    const prepared = preparedByUrl.get(modelPath);
    if (prepared && typeof DecompressionStream !== 'undefined') {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(assetUrl(prepared.preparedPath), {signal: controller.signal});
        if (!response.ok) throw new Error(`Prepared model HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
          .map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (bytes.byteLength !== prepared.bytes || digest !== prepared.preparedSha256) throw new Error('Prepared model integrity mismatch');
        const geometries = await decodePreparedModel(JSON.parse(new TextDecoder().decode(bytes)), {
          generation: preparedModels.generation, sourceSha256: prepared.sourceSha256,
        });
        this.getOffsetCache(modelPath).set(JSON.stringify(PREPARED_MODEL_PRESET), geometries.outer);
        return geometries.base;
      } catch (error) {
        if (ModelPreloader.DEBUG) console.warn('[ModelPreloader] 预计算数据不可用，使用原模型:', error);
      } finally {
        clearTimeout(timeout);
      }
    }

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
    return normalizeModelGeometry(loadedGeometry);
  }

  private getOffsetCache(modelPath: string) {
    if (!this.offsetGeometryCache.has(modelPath)) {
      this.offsetGeometryCache.set(modelPath, new Map());
    }
    return this.offsetGeometryCache.get(modelPath)!;
  }

  getOffsetGeometry(
    modelPath: string,
    options: { outerOffset: number; maxEdge?: number; subdivisions?: number; creaseAngle?: number; smoothShading?: boolean }
  ): THREE.BufferGeometry | null {
    const baseGeometry = this.cache.get(modelPath);
    if (!baseGeometry) {
      return null;
    }

    const { outerOffset, maxEdge = 0.15, subdivisions = 0, creaseAngle = 30, smoothShading = true } = options;
    const cache = this.getOffsetCache(modelPath);
    const key = JSON.stringify({ outerOffset, maxEdge, subdivisions, creaseAngle, smoothShading });

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    try {
      const offsetGeometry = createOffsetGeometry(baseGeometry, outerOffset, options);
      cache.set(key, offsetGeometry);
      return offsetGeometry;
    } catch (error) {
      console.warn('[ModelPreloader] Offset 几何体生成失败，使用基础几何:', error);
      cache.set(key, baseGeometry);
      return baseGeometry;
    }
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
    const loading = this.loadingPromises.size;
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
      if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 设置模型优先级:', modelPath);
    } else {
      this.priorityModels.delete(modelPath);
    }
  }

  /**
   * 预测下一个需要的模型（基于时间轴）
   */
  predictNextModel(currentTime: number, anchorTimeline: Array<{time: number, anchor: string}>, modelMapping: {[key: string]: string}): string | null {
    if (!anchorTimeline.length) return null;
    let current = 0;
    for (let index = 0; index < anchorTimeline.length; index++) {
      if (anchorTimeline[index].time <= currentTime) current = index;
      else break;
    }
    const currentPath = modelMapping[anchorTimeline[current].anchor];
    for (let step = 1; step < anchorTimeline.length; step++) {
      const next = anchorTimeline[(current + step) % anchorTimeline.length];
      const path = modelMapping[next.anchor];
      if (path && path !== currentPath) return path;
    }
    return null;
  }

  /**
   * 智能预加载下一个模型
   */
  async preloadNextModel(currentTime: number, anchorTimeline: Array<{time: number, anchor: string}>, modelMapping: {[key: string]: string}): Promise<void> {
    const nextModelPath = this.predictNextModel(currentTime, anchorTimeline, modelMapping);
    if (nextModelPath && !this.cache.has(nextModelPath) && !this.loadingPromises.has(nextModelPath)) {
      if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 智能预加载下一个模型:', nextModelPath);
      this.setModelPriority(nextModelPath, true);
      try {
        await this.loadModel(nextModelPath);
      } catch (error) {
        if (ModelPreloader.DEBUG) console.error('[ModelPreloader] 智能预加载失败:', error);
      } finally {
        this.priorityModels.delete(nextModelPath);
        this.scheduleTrim();
      }
    }
  }

  /**
   * 手动添加模型到缓存
   */
  addToCache(modelPath: string, geometry: THREE.BufferGeometry): void {
    this.cache.set(modelPath, geometry);
    this.loadingStatus.set(modelPath, 'loaded');
    if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 模型已添加到缓存:', modelPath);
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
    this.loadingStatus.clear();
    this.priorityModels.clear();
    this.offsetGeometryCache.clear();
    if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 缓存已清理');
  }
}

export default ModelPreloader;
