import * as THREE from "three";
import { assetUrl } from '@/utils/assetUrl';
import { createOffsetGeometry, normalizeModelGeometry } from './modelGeometry';
import { decodePreparedModel, PREPARED_MODEL_PRESET } from './preparedModelGeometry';
import { decodePreparedModelDelivery } from './preparedModelDelivery';
import { ModelDecodeScheduler } from './modelDecodeScheduler';
import preparedModels from './prepared-models.json';

type ModelRequest = {controller: AbortController; priority: number; cancelWhenUnowned: boolean};
type ModelPair = {base: THREE.BufferGeometry; outer?: THREE.BufferGeometry};

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
  private requests = new Map<string, ModelRequest>();
  private decoder = new ModelDecodeScheduler();
  private nextPrefetch: {path: string; release: () => void} | null = null;
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
  private readonly idleByteLimit = 8 * 1024 * 1024;
  private cacheEpoch = 0;
  private metricsDirty = true;
  private idleModelCount = 0;
  private idleByteCount = 0;
  private residentByteCount = 0;
  private disposedGeometries = new WeakSet<THREE.BufferGeometry>();
  private static DEBUG = false; // 如需调试，设为 true

  private constructor() {}

  retainPaths(paths: string[]): () => void {
    const owner = Symbol('model owner');
    this.owners.set(owner, new Set(paths));
    this.invalidateMetrics();
    return () => {
      if (!this.owners.delete(owner)) return;
      this.invalidateMetrics();
      this.scheduleTrim();
    };
  }

  private getPinnedPaths(): Set<string> {
    const pinned = new Set<string>();
    this.owners.forEach(paths => paths.forEach(path => pinned.add(path)));
    return pinned;
  }

  private isPathRetained(path: string): boolean {
    let retained = false;
    this.owners.forEach(paths => { if (paths.has(path)) retained = true; });
    return retained;
  }

  private cancelAbandonedRequests(pinned: Set<string>, clear = false) {
    this.requests.forEach((request, path) => {
      if (!pinned.has(path) && (clear || request.cancelWhenUnowned)) request.controller.abort();
    });
  }

  private disposeDetachedPair(pair: ModelPair) {
    const live = new Set<THREE.BufferGeometry>();
    this.cache.forEach(geometry => live.add(geometry));
    this.offsetGeometryCache.forEach(variants => variants.forEach(geometry => live.add(geometry)));
    new Set([pair.base, pair.outer]).forEach(geometry => {
      if (!geometry || live.has(geometry) || this.disposedGeometries.has(geometry)) return;
      this.disposedGeometries.add(geometry); geometry.dispose();
    });
  }

  private invalidateMetrics() {
    this.metricsDirty = true;
  }

  private collectGeometryBuffers(geometry: THREE.BufferGeometry | null | undefined, buffers: Set<ArrayBufferLike>) {
    if (!geometry) return;
    const addAttribute = (attribute: any) => {
      if (!attribute) return;
      const array = attribute.isInterleavedBufferAttribute ? attribute.data?.array : attribute.array;
      if (array?.buffer) buffers.add(array.buffer as ArrayBufferLike);
    };
    addAttribute(geometry.index);
    Object.values(geometry.attributes || {}).forEach(attribute => addAttribute(attribute));
    Object.values(geometry.morphAttributes || {}).forEach(attributes => {
      attributes.forEach(attribute => addAttribute(attribute));
    });
  }

  private totalBufferBytes(buffers: Set<ArrayBufferLike>): number {
    let bytes = 0;
    buffers.forEach(buffer => { bytes += buffer.byteLength; });
    return bytes;
  }

  private ensureMetrics() {
    if (!this.metricsDirty) return;
    const pinned = this.getPinnedPaths();
    const residentBuffers = new Set<ArrayBufferLike>();
    const idleBuffers = new Set<ArrayBufferLike>();
    let idleModels = 0;

    this.cache.forEach((base, path) => {
      const idle = !pinned.has(path);
      if (idle) idleModels++;
      this.collectGeometryBuffers(base, residentBuffers);
      if (idle) this.collectGeometryBuffers(base, idleBuffers);
      Array.from(this.offsetGeometryCache.get(path)?.values() ?? []).forEach(outer => {
        this.collectGeometryBuffers(outer, residentBuffers);
        if (idle) this.collectGeometryBuffers(outer, idleBuffers);
      });
    });

    this.idleModelCount = idleModels;
    this.idleByteCount = this.totalBufferBytes(idleBuffers);
    this.residentByteCount = this.totalBufferBytes(residentBuffers);
    this.metricsDirty = false;
  }

  private touchCachePath(path: string) {
    const geometry = this.cache.get(path);
    if (!geometry) return;
    this.cache.delete(path);
    this.cache.set(path, geometry);
  }

  private evictPath(path: string) {
    const evicted = new Set<THREE.BufferGeometry>();
    const base = this.cache.get(path);
    if (base) evicted.add(base);
    Array.from(this.offsetGeometryCache.get(path)?.values() ?? []).forEach(geometry => evicted.add(geometry));

    this.cache.delete(path);
    this.offsetGeometryCache.delete(path);
    this.loadingStatus.delete(path);
    this.priorityModels.delete(path);

    // A path may alias a geometry that another cache entry still displays or
    // preloads. Only geometries with no remaining cache reference may be
    // released, and each object is released at most once.
    const live = new Set<THREE.BufferGeometry>();
    this.cache.forEach((geometry, livePath) => {
      live.add(geometry);
      Array.from(this.offsetGeometryCache.get(livePath)?.values() ?? []).forEach(outer => live.add(outer));
    });
    evicted.forEach(geometry => {
      if (live.has(geometry) || this.disposedGeometries.has(geometry)) return;
      this.disposedGeometries.add(geometry);
      geometry.dispose();
    });
    this.invalidateMetrics();
  }

  private scheduleTrim() {
    if (this.trimTimer !== null) return;
    this.trimTimer = setTimeout(() => { this.trimTimer = null; this.trimCache(); }, 0);
  }

  trimCache() {
    if (this.trimTimer !== null) {
      clearTimeout(this.trimTimer);
      this.trimTimer = null;
    }
    this.ensureMetrics();
    const pinned = this.getPinnedPaths();
    this.cancelAbandonedRequests(pinned);
    while (true) {
      const idlePath = Array.from(this.cache.keys()).find(path => !pinned.has(path));
      if (!idlePath) break;
      if (this.idleModelCount <= this.idleModelLimit && this.idleByteCount <= this.idleByteLimit) break;
      this.evictPath(idlePath);
      this.ensureMetrics();
    }
    this.loadingStatus.forEach((status, path) => {
      if (status === 'error' && !pinned.has(path) && !this.loadingPromises.has(path)) {
        this.loadingStatus.delete(path);
      }
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
      if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 模型加载完成:', modelPath);
    } catch (error) {
      if (ModelPreloader.DEBUG) console.error('[ModelPreloader] 模型加载失败:', modelPath, error);
    } finally {
      this.currentLoads--;
    }
  }

  /**
   * 加载单个模型
   */
  async loadModel(modelPath: string, options: {priority?: 'current' | 'prefetch' | 'background'} = {}): Promise<THREE.BufferGeometry> {
    const priority = options.priority === 'prefetch' ? 1 : options.priority === 'background' ? 2 : 0;
    const cached = this.cache.get(modelPath);
    if (cached) {this.touchCachePath(modelPath); return cached;}
    const existing = this.loadingPromises.get(modelPath), previous = this.requests.get(modelPath);
    if (existing) {
      if (previous?.controller.signal.aborted) {
        await existing.catch(() => {});
        return this.loadModel(modelPath, options);
      }
      if (previous) {
        previous.priority = Math.min(previous.priority, priority);
        previous.cancelWhenUnowned ||= this.isPathRetained(modelPath);
        if (priority === 0) this.decoder.promote(modelPath);
      }
      return existing;
    }
    const epoch = this.cacheEpoch;
    const request: ModelRequest = {controller: new AbortController(), priority,
      cancelWhenUnowned: this.isPathRetained(modelPath)};
    this.requests.set(modelPath, request);
    this.loadingStatus.set(modelPath, 'loading');
    let decoded: Promise<THREE.BufferGeometry | ModelPair>;
    try {decoded = Promise.resolve(this.loadModelFromFile(modelPath, request));}
    catch (error) {decoded = Promise.reject(error);}
    const promise = decoded.then(result => {
      const pair: ModelPair = 'base' in result ? result : {base: result};
      if (request.controller.signal.aborted || (epoch !== this.cacheEpoch && !this.isPathRetained(modelPath))) {
        this.disposeDetachedPair(pair);
        throw request.controller.signal.reason ?? new DOMException('Model request superseded', 'AbortError');
      }
      // Publish the complete pair only after decode, identity and ownership checks.
      if (pair.outer) this.getOffsetCache(modelPath).set(JSON.stringify(PREPARED_MODEL_PRESET), pair.outer);
      this.cache.set(modelPath, pair.base);
      this.loadingStatus.set(modelPath, 'loaded');
      this.invalidateMetrics();
      return pair.base;
    }).catch(error => {
      if (request.controller.signal.aborted || (epoch !== this.cacheEpoch && !this.isPathRetained(modelPath))) {
        this.loadingStatus.delete(modelPath);
      } else this.loadingStatus.set(modelPath, 'error');
      throw error;
    }).finally(() => {
      if (this.loadingPromises.get(modelPath) === promise) this.loadingPromises.delete(modelPath);
      if (this.requests.get(modelPath) === request) this.requests.delete(modelPath);
      this.scheduleTrim();
    });
    this.loadingPromises.set(modelPath, promise);
    return promise;
  }

  private async fetchModelBytes(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
    signal.throwIfAborted();
    const controller = new AbortController(), abort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, {once: true});
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(url, {signal: controller.signal});
      if (!response.ok) throw new Error('Model HTTP ' + response.status);
      const bytes = await response.arrayBuffer();
      signal.throwIfAborted();
      return bytes;
    } finally {clearTimeout(timeout); signal.removeEventListener('abort', abort);}
  }

  private async loadModelFromFile(modelPath: string, request: ModelRequest): Promise<ModelPair> {
    const signal = request.controller.signal, prepared = preparedByUrl.get(modelPath);
    if (prepared && typeof DecompressionStream !== 'undefined') {
      try {
        const bytes = await this.fetchModelBytes(assetUrl(prepared.preparedPath), signal);
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
          .map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (bytes.byteLength !== prepared.bytes || digest !== prepared.preparedSha256) throw new Error('Prepared model integrity mismatch');
        signal.throwIfAborted();
        return await this.decoder.run(modelPath, () => {
          const expected = {generation: prepared.generation, geometryGeneration: prepared.geometryGeneration,
            sourceSha256: prepared.sourceSha256};
          return prepared.format === 'binary-v2'
            ? decodePreparedModelDelivery(bytes, expected, {signal})
            : decodePreparedModel(JSON.parse(new TextDecoder().decode(bytes)), expected, {signal});
        }, request.priority, signal);
      } catch (error) {
        signal.throwIfAborted();
        if (ModelPreloader.DEBUG) console.warn('[ModelPreloader] 预计算数据不可用，使用原模型:', error);
      }
    }
    // Fetch ahead without constructing geometry. Parsing and the original complete
    // geometry pipeline share the same exclusive restoration slot as prepared data.
    const bytes = await this.fetchModelBytes(modelPath, signal);
    return this.decoder.run(modelPath, async () => {
      let scene: THREE.Object3D | null = null;
      let extracted: THREE.BufferGeometry | null = null;
      let base: THREE.BufferGeometry | undefined, outer: THREE.BufferGeometry | undefined;
      try {
        if (modelPath.endsWith('.obj')) {
          const {OBJLoader} = await import('three/examples/jsm/loaders/OBJLoader.js');
          scene = new OBJLoader().parse(new TextDecoder().decode(bytes));
        } else if (modelPath.endsWith('.glb') || modelPath.endsWith('.gltf')) {
          const {GLTFLoader} = await import('three/examples/jsm/loaders/GLTFLoader.js');
          const gltf = await new GLTFLoader().parseAsync(bytes, modelPath.slice(0, modelPath.lastIndexOf('/') + 1));
          scene = gltf.scene;
        }
        signal.throwIfAborted();
        scene?.traverse(child => {if (child instanceof THREE.Mesh && child.geometry) extracted = child.geometry;});
        if (!extracted) throw new Error('未找到有效的几何体: ' + modelPath);
        base = normalizeModelGeometry(extracted);
        signal.throwIfAborted();
        outer = createOffsetGeometry(base, PREPARED_MODEL_PRESET.outerOffset, PREPARED_MODEL_PRESET);
        signal.throwIfAborted();
        return {base, outer};
      } catch (error) {
        if (base) this.disposeDetachedPair({base, outer});
        throw error;
      } finally {
        const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
        scene?.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return;
          if (child.geometry) geometries.add(child.geometry);
          const list = Array.isArray(child.material) ? child.material : [child.material];
          list.forEach(material => {if (material) materials.add(material);});
        });
        materials.forEach(material => {
          Object.values(material).forEach(value => {if (value?.isTexture) textures.add(value);});
          material.dispose();
        });
        textures.forEach(texture => texture.dispose());
        geometries.forEach(geometry => geometry.dispose());
      }
    }, request.priority, signal);
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
    this.touchCachePath(modelPath);

    if (cache.has(key)) {
      const cached = cache.get(key)!;
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }

    try {
      const offsetGeometry = createOffsetGeometry(baseGeometry, outerOffset, options);
      cache.set(key, offsetGeometry);
      this.invalidateMetrics();
      this.scheduleTrim();
      return offsetGeometry;
    } catch (error) {
      console.warn('[ModelPreloader] Offset 几何体生成失败，使用基础几何:', error);
      cache.set(key, baseGeometry);
      this.invalidateMetrics();
      this.scheduleTrim();
      return baseGeometry;
    }
  }

  /**
   * 获取缓存的模型
   */
  getModel(modelPath: string): THREE.BufferGeometry | null {
    const geometry = this.cache.get(modelPath) || null;
    if (geometry) this.touchCachePath(modelPath);
    return geometry;
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
    idleModels: number;
    idleBytes: number;
    residentBytes: number;
  } {
    this.ensureMetrics();
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
      priority,
      idleModels: this.idleModelCount,
      idleBytes: this.idleByteCount,
      residentBytes: this.residentByteCount
    };
  }

  /**
   * 获取详细加载状态
   */
  getDetailedStatus(): { [modelPath: string]: string } {
    const status: { [modelPath: string]: string } = {};
    this.loadingStatus.forEach((value, path) => {
      status[path] = value;
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
    if (this.nextPrefetch?.path === nextModelPath) return;
    this.cancelPreloadNext();
    if (!nextModelPath || this.cache.has(nextModelPath)) return;
    const owner = {path: nextModelPath, release: this.retainPaths([nextModelPath])};
    this.nextPrefetch = owner;
    this.setModelPriority(nextModelPath, true);
    try {
      await this.loadModel(nextModelPath, {priority: 'prefetch'});
    } catch (error) {
      if (ModelPreloader.DEBUG) console.error('[ModelPreloader] 智能预加载失败:', error);
    } finally {
      if (this.nextPrefetch === owner) this.nextPrefetch = null;
      owner.release();
      this.priorityModels.delete(nextModelPath);
      this.scheduleTrim();
    }
  }

  cancelPreloadNext(): void {
    this.nextPrefetch?.release();
    this.nextPrefetch = null;
    this.scheduleTrim();
  }

  /**
   * 手动添加模型到缓存
   */
  addToCache(modelPath: string, geometry: THREE.BufferGeometry): void {
    const previous = this.cache.get(modelPath);
    if (previous && previous !== geometry) {
      if (this.isPathRetained(modelPath)) throw new Error('Cannot replace a displayed model');
      this.evictPath(modelPath);
    }
    this.cache.delete(modelPath);
    this.cache.set(modelPath, geometry);
    this.loadingStatus.set(modelPath, 'loaded');
    this.invalidateMetrics();
    this.scheduleTrim();
    if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 模型已添加到缓存:', modelPath);
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    // Invalidate already-started requests so they can still deliver their result,
    // but cannot repopulate the cleared cache. Keep their promise entries so a
    // concurrent caller still shares the same in-flight work.
    this.cacheEpoch++;
    if (this.trimTimer !== null) {
      clearTimeout(this.trimTimer);
      this.trimTimer = null;
    }
    const pinned = this.getPinnedPaths();
    this.cancelAbandonedRequests(pinned, true);
    Array.from(this.cache.keys()).forEach(path => {
      if (!pinned.has(path)) this.evictPath(path);
    });
    Array.from(this.offsetGeometryCache.keys()).forEach(path => {
      if (!pinned.has(path) && !this.cache.has(path)) this.evictPath(path);
    });
    this.loadingStatus.forEach((status, path) => {
      if (!pinned.has(path) && !this.loadingPromises.has(path)) {
        this.loadingStatus.delete(path);
      }
    });
    Array.from(this.priorityModels).forEach(path => {
      if (!pinned.has(path) && !this.loadingPromises.has(path)) this.priorityModels.delete(path);
    });
    this.invalidateMetrics();
    if (ModelPreloader.DEBUG) console.log('[ModelPreloader] 缓存已清理');
  }
}

export default ModelPreloader;
