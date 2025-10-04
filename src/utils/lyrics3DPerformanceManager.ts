import * as THREE from 'three';
import type { QualityLevel, TextPosition } from '@/types/lyrics3D.types';

/**
 * 3D字幕性能优化管理器
 * 
 * 核心功能：
 * 1. 动态LOD系统
 * 2. 视锥剔除优化
 * 3. 实例化渲染
 * 4. 内存管理
 * 5. 帧率监控和自适应调整
 */

/**
 * 性能配置
 */
export interface PerformanceConfig {
  targetFPS: number;
  maxVisibleLyrics: number;
  updateRate: number;
  enableLOD: boolean;
  enableFrustumCulling: boolean;
  enableInstancedRendering: boolean;
  enableMemoryManagement: boolean;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  visibleTextCount: number;
  renderedTextCount: number;
  droppedFrames: number;
}

/**
 * LOD级别配置
 */
export interface LODConfig {
  level: 'high' | 'medium' | 'low';
  maxDistance: number;
  fontSize: number;
  curveSegments: number;
  bevelEnabled: boolean;
  bevelThickness: number;
  bevelSize: number;
  bevelSegments: number;
}

/**
 * 性能优化管理器类
 */
export class Lyrics3DPerformanceManager {
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics;
  private frameCount: number = 0;
  private lastTime: number = 0;
  private droppedFrames: number = 0;
  private qualityLevel: QualityLevel = 'high';
  private adaptiveQuality: boolean = true;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      targetFPS: 60,
      maxVisibleLyrics: 15,
      updateRate: 60,
      enableLOD: true,
      enableFrustumCulling: true,
      enableInstancedRendering: false,
      enableMemoryManagement: true,
      ...config
    };

    this.metrics = {
      fps: 60,
      frameTime: 16.67,
      memoryUsage: 0,
      visibleTextCount: 0,
      renderedTextCount: 0,
      droppedFrames: 0
    };

    this.lastTime = performance.now();
  }

  /**
   * 更新性能指标
   */
  updateMetrics(): void {
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    
    this.frameCount++;
    
    if (deltaTime >= 1000) {
      this.metrics.fps = (this.frameCount * 1000) / deltaTime;
      this.metrics.frameTime = deltaTime / this.frameCount;
      this.metrics.droppedFrames = this.droppedFrames;
      
      // 更新内存使用
      if (this.config.enableMemoryManagement) {
        this.updateMemoryUsage();
      }
      
      // 自适应质量调整
      if (this.adaptiveQuality) {
        this.adjustQualityLevel();
      }
      
      this.frameCount = 0;
      this.droppedFrames = 0;
      this.lastTime = now;
    }
  }

  /**
   * 更新内存使用
   */
  private updateMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
    }
  }

  /**
   * 自适应质量调整
   */
  private adjustQualityLevel(): void {
    const { fps, memoryUsage } = this.metrics;
    
    if (fps < 30 || memoryUsage > 200) {
      this.qualityLevel = 'low';
    } else if (fps < 45 || memoryUsage > 100) {
      this.qualityLevel = 'medium';
    } else if (fps > 55 && memoryUsage < 50) {
      this.qualityLevel = 'high';
    }
  }

  /**
   * 计算LOD级别
   */
  calculateLODLevel(distance: number, isCurrent: boolean): LODConfig {
    if (!this.config.enableLOD) {
      return this.getLODConfig('high');
    }

    let level: 'high' | 'medium' | 'low' = 'high';

    // 基于距离的LOD
    if (distance > 8) {
      level = 'low';
    } else if (distance > 4) {
      level = 'medium';
    }

    // 基于性能的LOD
    if (this.qualityLevel === 'low') {
      level = 'low';
    } else if (this.qualityLevel === 'medium' && level === 'high') {
      level = 'medium';
    }

    // 当前行始终使用高质量
    if (isCurrent && level === 'low') {
      level = 'medium';
    }

    return this.getLODConfig(level);
  }

  /**
   * 获取LOD配置
   */
  private getLODConfig(level: 'high' | 'medium' | 'low'): LODConfig {
    const configs = {
      high: {
        level: 'high' as const,
        maxDistance: 10,
        fontSize: 0.5,
        curveSegments: 64,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.01,
        bevelSegments: 3
      },
      medium: {
        level: 'medium' as const,
        maxDistance: 6,
        fontSize: 0.4,
        curveSegments: 32,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.005,
        bevelSegments: 2
      },
      low: {
        level: 'low' as const,
        maxDistance: 3,
        fontSize: 0.3,
        curveSegments: 16,
        bevelEnabled: false,
        bevelThickness: 0,
        bevelSize: 0,
        bevelSegments: 1
      }
    };

    return configs[level];
  }

  /**
   * 视锥剔除检查
   */
  checkFrustumCulling(
    position: TextPosition,
    camera: THREE.Camera,
    margin: number = 2
  ): boolean {
    if (!this.config.enableFrustumCulling) return true;

    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);

    const point = new THREE.Vector3(position.x, position.y, position.z);
    return frustum.containsPoint(point);
  }

  /**
   * 计算可见性
   */
  calculateVisibility(
    index: number,
    currentIndex: number,
    distance: number
  ): boolean {
    const maxVisible = this.config.maxVisibleLyrics;
    
    // 基础可见性检查
    if (distance > maxVisible) return false;
    
    // 基于性能的可见性调整
    if (this.qualityLevel === 'low' && distance > maxVisible * 0.5) {
      return false;
    } else if (this.qualityLevel === 'medium' && distance > maxVisible * 0.7) {
      return false;
    }
    
    return true;
  }

  /**
   * 计算渲染优先级
   */
  calculateRenderPriority(
    index: number,
    currentIndex: number,
    isCurrent: boolean,
    distance: number
  ): number {
    let priority = 0;
    
    // 当前行最高优先级
    if (isCurrent) {
      priority += 1000;
    }
    
    // 距离越近优先级越高
    priority += (10 - distance) * 100;
    
    // 基于性能调整优先级
    if (this.qualityLevel === 'low') {
      priority *= 0.5;
    } else if (this.qualityLevel === 'medium') {
      priority *= 0.8;
    }
    
    return priority;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取性能指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取当前质量级别
   */
  getQualityLevel(): QualityLevel {
    return this.qualityLevel;
  }

  /**
   * 设置质量级别
   */
  setQualityLevel(level: QualityLevel): void {
    this.qualityLevel = level;
  }

  /**
   * 启用/禁用自适应质量
   */
  setAdaptiveQuality(enabled: boolean): void {
    this.adaptiveQuality = enabled;
  }

  /**
   * 记录丢帧
   */
  recordDroppedFrame(): void {
    this.droppedFrames++;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.frameCount = 0;
    this.droppedFrames = 0;
    this.lastTime = 0;
  }
}

/**
 * 创建性能管理器实例
 */
export const createPerformanceManager = (
  config?: Partial<PerformanceConfig>
): Lyrics3DPerformanceManager => {
  return new Lyrics3DPerformanceManager(config);
};

/**
 * 性能管理器Hook
 */
export const usePerformanceManager = (
  config?: Partial<PerformanceConfig>
) => {
  const manager = new Lyrics3DPerformanceManager(config);

  return {
    manager,
    updateMetrics: () => manager.updateMetrics(),
    calculateLODLevel: (distance: number, isCurrent: boolean) => 
      manager.calculateLODLevel(distance, isCurrent),
    checkFrustumCulling: (position: TextPosition, camera: THREE.Camera, margin?: number) => 
      manager.checkFrustumCulling(position, camera, margin),
    calculateVisibility: (index: number, currentIndex: number, distance: number) => 
      manager.calculateVisibility(index, currentIndex, distance),
    calculateRenderPriority: (index: number, currentIndex: number, isCurrent: boolean, distance: number) => 
      manager.calculateRenderPriority(index, currentIndex, isCurrent, distance),
    getMetrics: () => manager.getMetrics(),
    getQualityLevel: () => manager.getQualityLevel(),
    setQualityLevel: (level: QualityLevel) => manager.setQualityLevel(level),
    setAdaptiveQuality: (enabled: boolean) => manager.setAdaptiveQuality(enabled),
    recordDroppedFrame: () => manager.recordDroppedFrame(),
    dispose: () => manager.dispose()
  };
};

export default Lyrics3DPerformanceManager;
