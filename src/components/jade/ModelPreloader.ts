import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * 模型预加载管理器
 * 负责在后台预加载所有可能的模型，避免切换时的加载延迟
 */
class ModelPreloader {
  private static instance: ModelPreloader;
  private cache = new Map<string, THREE.BufferGeometry>();
  private loadingPromises = new Map<string, Promise<THREE.BufferGeometry>>();
  private isPreloading = false;

  private constructor() {}

  static getInstance(): ModelPreloader {
    if (!ModelPreloader.instance) {
      ModelPreloader.instance = new ModelPreloader();
    }
    return ModelPreloader.instance;
  }

  /**
   * 预加载所有模型
   */
  async preloadAllModels(modelPaths: string[]): Promise<void> {
    if (this.isPreloading) {
      console.log('[ModelPreloader] 预加载已在进行中');
      return;
    }

    this.isPreloading = true;
    console.log('[ModelPreloader] 开始预加载所有模型:', modelPaths);

    try {
      // 并行加载所有模型
      const loadPromises = modelPaths.map(path => this.loadModel(path));
      await Promise.all(loadPromises);
      
      console.log('[ModelPreloader] ✅ 所有模型预加载完成');
    } catch (error) {
      console.error('[ModelPreloader] ❌ 预加载失败:', error);
    } finally {
      this.isPreloading = false;
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
   * 获取缓存状态
   */
  getCacheStatus(): { total: number; loaded: number; loading: number } {
    return {
      total: this.cache.size + this.loadingPromises.size,
      loaded: this.cache.size,
      loading: this.loadingPromises.size
    };
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
    console.log('[ModelPreloader] 缓存已清理');
  }
}

export default ModelPreloader;
