import * as THREE from 'three';
import type { TextPosition, LayerCalculation } from '@/types/lyrics3D.types';

/**
 * 3D字幕遮挡效果管理器
 * 
 * 核心功能：
 * 1. 管理字幕与锚字3D模型的遮挡关系
 * 2. 实现"前-后-后"循环的深度排序
 * 3. 优化渲染顺序和深度测试
 * 4. 处理透明度和可见性
 */

/**
 * 遮挡检测结果
 */
export interface OcclusionResult {
  isOccluded: boolean;
  occlusionFactor: number; // 0-1，0表示完全被遮挡，1表示完全可见
  renderOrder: number;
  depthTest: boolean;
  depthWrite: boolean;
}

/**
 * 锚字模型信息
 */
export interface AnchorModelInfo {
  model: THREE.Object3D;
  position: THREE.Vector3;
  size: THREE.Vector3;
  boundingBox: THREE.Box3;
  anchor: string;
}

/**
 * 遮挡管理器类
 */
export class Lyrics3DOcclusionManager {
  private anchorModel: THREE.Object3D | null = null;
  private anchorModelInfo: AnchorModelInfo | null = null;
  private camera: THREE.Camera | null = null;
  private scene: THREE.Scene | null = null;

  constructor(camera?: THREE.Camera, scene?: THREE.Scene) {
    this.camera = camera || null;
    this.scene = scene || null;
  }

  /**
   * 设置锚字模型
   */
  setAnchorModel(model: THREE.Object3D, anchor: string): void {
    this.anchorModel = model;
    
    // 计算锚字模型信息
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    this.anchorModelInfo = {
      model,
      position: center,
      size,
      boundingBox: box,
      anchor
    };
  }

  /**
   * 计算遮挡结果
   */
  calculateOcclusion(
    textPosition: TextPosition,
    textIndex: number,
    currentIndex: number,
    layer: LayerCalculation
  ): OcclusionResult {
    if (!this.anchorModelInfo) {
      return {
        isOccluded: false,
        occlusionFactor: 1,
        renderOrder: layer.renderOrder,
        depthTest: true,
        depthWrite: true
      };
    }

    // 计算文字边界框
    const textBounds = this.calculateTextBounds(textPosition);
    
    // 检查与锚字模型的相交
    const intersects = this.checkIntersection(textBounds, this.anchorModelInfo.boundingBox);
    
    // 计算遮挡因子
    const occlusionFactor = this.calculateOcclusionFactor(
      textPosition,
      textIndex,
      currentIndex,
      layer,
      intersects
    );

    // 计算渲染顺序
    const renderOrder = this.calculateRenderOrder(
      textIndex,
      currentIndex,
      layer,
      occlusionFactor
    );

    return {
      isOccluded: occlusionFactor < 0.1,
      occlusionFactor,
      renderOrder,
      depthTest: layer.layerType === 'front',
      depthWrite: layer.layerType === 'front' && occlusionFactor > 0.5
    };
  }

  /**
   * 计算文字边界框
   */
  private calculateTextBounds(textPosition: TextPosition): THREE.Box3 {
    const textWidth = 2; // 估算文字宽度
    const textHeight = 0.5; // 估算文字高度
    const textDepth = 0.1; // 估算文字深度

    return new THREE.Box3(
      new THREE.Vector3(
        textPosition.x - textWidth / 2,
        textPosition.y - textHeight / 2,
        textPosition.z - textDepth / 2
      ),
      new THREE.Vector3(
        textPosition.x + textWidth / 2,
        textPosition.y + textHeight / 2,
        textPosition.z + textDepth / 2
      )
    );
  }

  /**
   * 检查边界框相交
   */
  private checkIntersection(textBounds: THREE.Box3, modelBounds: THREE.Box3): boolean {
    return textBounds.intersectsBox(modelBounds);
  }

  /**
   * 计算遮挡因子
   */
  private calculateOcclusionFactor(
    textPosition: TextPosition,
    textIndex: number,
    currentIndex: number,
    layer: LayerCalculation,
    intersects: boolean
  ): number {
    if (!this.anchorModelInfo) return 1;

    // 基础可见性
    let factor = 1;

    // 层级影响
    if (layer.layerType === 'back') {
      factor *= 0.7; // 后层字幕基础透明度降低
    }

    // 相交影响
    if (intersects) {
      if (layer.layerType === 'front') {
        // 前层字幕与模型相交时，保持可见但稍微降低透明度
        factor *= 0.9;
      } else {
        // 后层字幕与模型相交时，大幅降低透明度
        factor *= 0.3;
      }
    }

    // 距离影响
    const distance = Math.abs(textIndex - currentIndex);
    const distanceFactor = Math.max(0.1, 1 - distance * 0.2);
    factor *= distanceFactor;

    // 深度影响
    const depthDifference = Math.abs(textPosition.z - this.anchorModelInfo.position.z);
    if (depthDifference < 0.5) {
      factor *= 0.8; // 深度接近时降低透明度
    }

    return Math.max(0, Math.min(1, factor));
  }

  /**
   * 计算渲染顺序
   */
  private calculateRenderOrder(
    textIndex: number,
    currentIndex: number,
    layer: LayerCalculation,
    occlusionFactor: number
  ): number {
    let order = layer.renderOrder;

    // 距离影响渲染顺序
    const distance = Math.abs(textIndex - currentIndex);
    order += (10 - distance) * 0.1;

    // 遮挡因子影响渲染顺序
    order += occlusionFactor * 0.5;

    // 层级影响
    if (layer.layerType === 'front') {
      order += 1;
    }

    return order;
  }

  /**
   * 更新相机和场景引用
   */
  updateCameraAndScene(camera: THREE.Camera, scene: THREE.Scene): void {
    this.camera = camera;
    this.scene = scene;
  }

  /**
   * 获取锚字模型信息
   */
  getAnchorModelInfo(): AnchorModelInfo | null {
    return this.anchorModelInfo;
  }

  /**
   * 检查文字是否在视锥内
   */
  isInFrustum(textPosition: TextPosition): boolean {
    if (!this.camera) return true;

    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);

    const point = new THREE.Vector3(textPosition.x, textPosition.y, textPosition.z);
    return frustum.containsPoint(point);
  }

  /**
   * 计算文字相对于锚字模型的位置关系
   */
  getRelativePosition(textPosition: TextPosition): {
    isInFront: boolean;
    isBehind: boolean;
    distance: number;
  } {
    if (!this.anchorModelInfo) {
      return {
        isInFront: false,
        isBehind: false,
        distance: 0
      };
    }

    const distance = textPosition.z - this.anchorModelInfo.position.z;
    const isInFront = distance < 0;
    const isBehind = distance > 0;

    return {
      isInFront,
      isBehind,
      distance: Math.abs(distance)
    };
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.anchorModel = null;
    this.anchorModelInfo = null;
    this.camera = null;
    this.scene = null;
  }
}

/**
 * 创建遮挡管理器实例
 */
export const createOcclusionManager = (
  camera?: THREE.Camera,
  scene?: THREE.Scene
): Lyrics3DOcclusionManager => {
  return new Lyrics3DOcclusionManager(camera, scene);
};

/**
 * 遮挡管理器Hook
 */
export const useOcclusionManager = (
  camera: THREE.Camera,
  scene: THREE.Scene
) => {
  const manager = new Lyrics3DOcclusionManager(camera, scene);

  return {
    manager,
    setAnchorModel: (model: THREE.Object3D, anchor: string) => {
      manager.setAnchorModel(model, anchor);
    },
    calculateOcclusion: (
      textPosition: TextPosition,
      textIndex: number,
      currentIndex: number,
      layer: LayerCalculation
    ) => {
      return manager.calculateOcclusion(textPosition, textIndex, currentIndex, layer);
    },
    isInFrustum: (textPosition: TextPosition) => {
      return manager.isInFrustum(textPosition);
    },
    getRelativePosition: (textPosition: TextPosition) => {
      return manager.getRelativePosition(textPosition);
    },
    dispose: () => {
      manager.dispose();
    }
  };
};

export default Lyrics3DOcclusionManager;
