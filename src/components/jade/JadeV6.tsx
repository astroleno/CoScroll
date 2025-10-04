"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TessellateModifier } from 'three-stdlib';
import { toCreasedNormals } from 'three-stdlib';
import OrientationGuard from "@/components/OrientationGuard";
import ModelPreloader from "./ModelPreloader";

/**
 * JadeV6 - 背景与环境完全分离的玉质渲染组件
 * 
 * 核心特性：
 * 1. 显示背景：使用纯色背景（scene.background = 纯色）
 * 2. 折射/反射环境：使用 HDR 环境贴图（scene.environment = HDR PMREM）
 * 3. 完全解耦：背景显示与材质采样使用不同的贴图源
 * 
 * 技术实现：
 * - scene.background = 纯色背景（用户可见）
 * - scene.environment = HDR 环境贴图的 PMREM（材质采样）
 * - 材质使用 MeshPhysicalMaterial 的 transmission 进行折射
 */
interface JadeV6Props {
  // 模型相关
  modelPath?: string;              // 模型文件路径
  rotationDurationSec?: number;    // 旋转周期（秒）
  direction?: 1 | -1;              // 旋转方向
  fitToView?: boolean;             // 是否自动适配视图
  
  // 滚动控制相关（新增）
  enableScrollControl?: boolean;  // 是否启用滚动控制
  baseSpeed?: number;              // 基础旋转速度（弧度/秒）
  speedMultiplier?: number;        // 滚动速度放大系数
  externalVelocity?: number;       // 外部传入的速度增量
  
  // 背景相关（显示用）
  background?: string | number;    // 纯色背景（CSS 颜色值）
  showHdrBackground?: boolean;     // 是否显示 HDR 背景（覆盖纯色背景）
  
  // 环境相关（材质采样用）
  environmentHdrPath?: string;     // HDR 环境贴图路径（用于折射/反射）
  environmentIntensity?: number;   // 环境贴图强度
  
  // 内层材质参数（自发光层）
  innerColor?: string | number;    // 内层颜色
  innerMetalness?: number;         // 内层金属度
  innerRoughness?: number;         // 内层粗糙度
  innerTransmission?: number;      // 内层透射度
  innerEmissiveColor?: string | number; // 自发光颜色
  innerEmissiveIntensity?: number; // 自发光强度
  enableEmissive?: boolean;        // 自发光开关
  innerEnvMapIntensity?: number;   // 内层环境贴图强度
  
  // 图层控制
  showInnerLayer?: boolean;        // 显示内部层
  showOuterLayer?: boolean;        // 显示外部层
  outerOffset?: number;            // 外部层偏移距离
  
  // 外层材质参数（折射层）
  outerColor?: string | number;    // 外层颜色
  outerMetalness?: number;         // 外层金属度
  outerRoughness?: number;         // 外层粗糙度
  outerTransmission?: number;      // 外层透射度
  outerIor?: number;               // 外层折射率
  outerReflectivity?: number;      // 外层反射率
  outerThickness?: number;         // 外层厚度
  outerClearcoat?: number;         // 外层清漆层
  outerClearcoatRoughness?: number; // 外层清漆粗糙度
  outerEnvMapIntensity?: number;   // 外层环境贴图强度
  
  // 法线贴图
  normalMapPath?: string;          // 法线贴图路径
  normalScale?: number;            // 法线强度
  normalRepeat?: number;           // 法线重复次数
  
  // 几何体优化（外壳细分）
  maxEdge?: number;                // Tessellate 目标最大边长（0.01-0.15）
  subdivisions?: number;           // 简化 Loop 细分次数（0-1）
  creaseAngle?: number;            // 折痕角度（30-90）
  
  // 平滑着色控制
  smoothShading?: boolean;         // 全局平滑着色开关
  innerSmoothShading?: boolean;   // 内层平滑着色
  outerSmoothShading?: boolean;   // 外层平滑着色
  
  // 渲染设置
  exposure?: number;               // 全局曝光
  enableRotation?: boolean;        // 是否启用旋转
  
  // 预加载设置
  enablePreloading?: boolean;      // 是否启用预加载
  preloadAllModels?: boolean;      // 是否预加载所有模型
  modelPaths?: string[];           // 需要预加载的模型路径列表
  preloadStatus?: {                // 预加载状态
    isPreloading: boolean;
    loaded: number;
    total: number;
    currentModel: string;
    nextModel: string;
  };
}

/**
 * 应用平滑着色（类似 Blender Shade Smooth）
 */
function applySmoothShading(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  let geo = geometry.clone();
  
  try {
    // 1. 焊接重复顶点（确保共享顶点）
    geo = mergeVertices(geo);
    
    // 2. 计算平滑法线
    geo.computeVertexNormals();
    
    console.log('[JadeV6] 平滑着色已应用');
  } catch (e) {
    console.warn('[JadeV6] 平滑着色应用失败:', e);
  }
  
  return geo;
}

/**
 * 几何体优化流程（来自 JadeV2）
 */
function optimizeGeometry(
  geometry: THREE.BufferGeometry,
  options: { maxEdge?: number; subdivisions?: number; creaseAngle?: number; smoothShading?: boolean } = {}
): THREE.BufferGeometry {
  const {
    maxEdge: optMaxEdge = 0.06,
    subdivisions: optSub = 1,
    creaseAngle: optCrease = 50,
    smoothShading: optSmooth = true,
  } = options;

  let geo = geometry;
  try {
    geo = mergeVertices(geo);
    geo = geo.toNonIndexed();
    if (optMaxEdge > 0 && optMaxEdge <= 0.15) {
      const tess = new TessellateModifier(optMaxEdge);
      geo = tess.modify(geo);
    }
    if (optSub > 0) {
      const iterations = Math.min(optSub, 1);
      geo = loopSubdivide(geo, iterations);
    }
    geo.computeVertexNormals();
    if (optCrease < 90) {
      const creaseRad = THREE.MathUtils.degToRad(optCrease);
      geo = toCreasedNormals(geo, creaseRad);
    }
    
    // 应用平滑着色（如果启用）
    if (optSmooth) {
      geo = applySmoothShading(geo);
    }
  } catch (e) {
    console.warn('[JadeV6] 几何优化失败，使用原始几何:', e);
  }
  return geo;
}

/**
 * 简化版 Loop 细分：将每个三角形分为 4 个三角形
 */
function loopSubdivide(geometry: THREE.BufferGeometry, iterations: number): THREE.BufferGeometry {
  let geo = geometry;
  for (let i = 0; i < iterations; i++) {
    const positions = geo.attributes.position.array;
    const newPositions: number[] = [];
    
    for (let j = 0; j < positions.length; j += 9) {
      const v1 = [positions[j], positions[j + 1], positions[j + 2]];
      const v2 = [positions[j + 3], positions[j + 4], positions[j + 5]];
      const v3 = [positions[j + 6], positions[j + 7], positions[j + 8]];
      
      const m1 = [(v1[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2, (v1[2] + v2[2]) / 2];
      const m2 = [(v2[0] + v3[0]) / 2, (v2[1] + v3[1]) / 2, (v2[2] + v3[2]) / 2];
      const m3 = [(v3[0] + v1[0]) / 2, (v3[1] + v1[1]) / 2, (v3[2] + v1[2]) / 2];
      
      newPositions.push(...v1, ...m1, ...m3);
      newPositions.push(...m1, ...v2, ...m2);
      newPositions.push(...m2, ...v3, ...m3);
      newPositions.push(...m1, ...m2, ...m3);
    }
    
    const newGeo = new THREE.BufferGeometry();
    newGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newPositions), 3));
    geo = newGeo;
  }
  return geo;
}

// 创建 offset 几何体的函数
function createOffsetGeometry(originalGeometry: THREE.BufferGeometry, offsetDistance: number, optimizeOptions?: { maxEdge?: number; subdivisions?: number; creaseAngle?: number; smoothShading?: boolean }): THREE.BufferGeometry {
  // 克隆原始几何体
  let offsetGeometry = originalGeometry.clone();
  
  // 应用几何体优化（如果提供了选项）
  if (optimizeOptions) {
    offsetGeometry = optimizeGeometry(offsetGeometry, optimizeOptions);
  }
  
  // 确保有法线
  offsetGeometry.computeVertexNormals();
  
  // 获取位置和法线属性
  const positionAttribute = offsetGeometry.getAttribute('position');
  const normalAttribute = offsetGeometry.getAttribute('normal');
  
  // 创建新的位置数组
  const newPositions = new Float32Array(positionAttribute.count * 3);
  
  for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    const z = positionAttribute.getZ(i);
    
    const nx = normalAttribute.getX(i);
    const ny = normalAttribute.getY(i);
    const nz = normalAttribute.getZ(i);
    
    // 沿着法线方向偏移
    newPositions[i * 3] = x + nx * offsetDistance;
    newPositions[i * 3 + 1] = y + ny * offsetDistance;
    newPositions[i * 3 + 2] = z + nz * offsetDistance;
  }
  
  // 更新几何体的位置属性
  offsetGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  
  // 重新计算法线
  offsetGeometry.computeVertexNormals();
  
  return offsetGeometry;
}

// 双层模型加载器组件：自发光层 + 折射层（支持预加载）
function DualLayerModelLoader({ 
  modelPath, 
  material,
  refractionMaterial,
  fitToView = true,
  showInnerLayer = true,
  showOuterLayer = true,
  outerOffset = 0.02,
  maxEdge = 0.15,
  subdivisions = 0,
  creaseAngle = 30,
  smoothShading = true,
  innerSmoothShading = true,
  outerSmoothShading = true,
  enablePreloading = true
}: { 
  modelPath: string; 
  material: THREE.Material;
  refractionMaterial: THREE.Material;
  fitToView?: boolean;
  showInnerLayer?: boolean;
  showOuterLayer?: boolean;
  outerOffset?: number;
  maxEdge?: number;
  subdivisions?: number;
  creaseAngle?: number;
  smoothShading?: boolean;
  innerSmoothShading?: boolean;
  outerSmoothShading?: boolean;
  enablePreloading?: boolean;
}) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [offsetGeometry, setOffsetGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const refractionMeshRef = useRef<THREE.Mesh>(null);
  const { camera, scene } = useThree();
  const preloader = ModelPreloader.getInstance();

  // 模型加载逻辑（使用预加载系统）
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError(null);

    const loadModel = async () => {
      try {
        console.log('[JadeV6] 开始加载模型:', modelPath);
        
        // 首先尝试从预加载缓存获取
        let loadedGeometry = preloader.getModel(modelPath);
        
        if (loadedGeometry) {
          console.log('[JadeV6] 使用预加载模型:', modelPath);
          if (disposed) return;
          setGeometry(loadedGeometry);
          setLoading(false);
          return;
        }

        // 如果预加载缓存中没有，检查是否正在加载
        if (preloader.isModelLoading(modelPath)) {
          console.log('[JadeV6] 等待预加载完成:', modelPath);
          // 等待预加载完成
          while (preloader.isModelLoading(modelPath)) {
            await new Promise(resolve => setTimeout(resolve, 50));
            if (disposed) return;
          }
          
          loadedGeometry = preloader.getModel(modelPath);
          if (loadedGeometry) {
            console.log('[JadeV6] 预加载完成，使用模型:', modelPath);
            if (disposed) return;
            setGeometry(loadedGeometry);
            setLoading(false);
            return;
          }
        }

        // 如果预加载系统没有该模型，直接加载
        console.log('[JadeV6] 直接加载模型:', modelPath);
        if (modelPath.endsWith('.obj')) {
          const loader = new OBJLoader();
          const obj = await new Promise<THREE.Group>((resolve, reject) => {
            loader.load(modelPath, resolve, undefined, reject);
          });
          
          if (disposed) return;
          
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
          
          if (disposed) return;
          
          // 提取第一个几何体
          gltf.scene.traverse((child: any) => {
            if (child instanceof THREE.Mesh && child.geometry) {
              loadedGeometry = child.geometry;
            }
          });
        }

        if (!loadedGeometry) {
          throw new Error('未找到有效的几何体');
        }

        if (disposed) return;

        // 几何体优化
        loadedGeometry = mergeVertices(loadedGeometry);
        loadedGeometry.computeVertexNormals();
        
        setGeometry(loadedGeometry);
        setLoading(false);
        
        console.log('[JadeV6] 模型加载成功:', modelPath);
      } catch (err) {
        console.error('[JadeV6] 模型加载失败:', err);
        setError(err instanceof Error ? err.message : '未知错误');
        setLoading(false);
      }
    };

    loadModel();

    return () => {
      disposed = true;
    };
  }, [modelPath, preloader]);

  // 当 outerOffset 或细分参数变化时，重新创建 offset 几何体
  useEffect(() => {
    if (!geometry) return;
    
    const offset = createOffsetGeometry(geometry, outerOffset, { maxEdge, subdivisions, creaseAngle, smoothShading: outerSmoothShading });
    setOffsetGeometry(offset);
    
    console.log('[JadeV6] Offset 几何体重新创建，偏移距离:', outerOffset, '细分参数:', { maxEdge, subdivisions, creaseAngle, smoothShading: outerSmoothShading });
  }, [geometry, outerOffset, maxEdge, subdivisions, creaseAngle, outerSmoothShading]);

  // 自动适配视图 - 等待几何体完全准备好
  useEffect(() => {
    if (!geometry || !offsetGeometry || !fitToView || !meshRef.current) return;

    try {
      const box = new THREE.Box3().setFromObject(meshRef.current);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const distance = maxDim * 2.5; // 调整距离，让模型看起来更小（80%大小）
      
      camera.position.set(0, 0, distance);
      camera.lookAt(center);
      
      console.log('[JadeV6] 视图适配完成:', { size, center, distance });
    } catch (err) {
      console.warn('[JadeV6] 视图适配失败:', err);
    }
  }, [geometry, offsetGeometry, fitToView, camera]);


  if (loading) {
    return null; // 加载期间不显示任何内容
  }

  if (error) {
    return null; // 错误时也不显示占位立方体
  }

  if (!geometry || !offsetGeometry) return null;

  return (
    <group>
      {/* 自发光层：原始模型（内部） */}
      {showInnerLayer && (
        <mesh ref={meshRef} geometry={geometry} material={material} />
      )}
      
      {/* 折射层：offset 几何体（外壳） */}
      {showOuterLayer && (
        <mesh 
          ref={refractionMeshRef} 
          geometry={offsetGeometry} 
          material={refractionMaterial}
        />
      )}
    </group>
  );
}

// 滚动控制器（类似 JadeV5 的 ScrollRotator）
function ScrollRotator({
  groupRef,
  baseSpeed,
  speedMultiplier,
  enabled,
  externalVelocity = 0,
}: {
  groupRef: React.RefObject<THREE.Group>;
  baseSpeed: number;
  speedMultiplier: number;
  enabled: boolean;
  externalVelocity?: number;
}) {
  const { gl } = useThree();
  const prevScrollYRef = useRef(0);
  const targetSpeedRef = useRef(baseSpeed);
  const currentSpeedRef = useRef(baseSpeed);
  const externalVelocityRef = useRef(externalVelocity);

  useEffect(() => {
    externalVelocityRef.current = externalVelocity;
  }, [externalVelocity]);

  useEffect(() => {
    targetSpeedRef.current = baseSpeed + externalVelocityRef.current;
  }, [baseSpeed, externalVelocity]);

  useEffect(() => {
    prevScrollYRef.current = window.scrollY || 0;
    const onScroll = () => {
      const y = window.scrollY || 0;
      const dy = y - prevScrollYRef.current;
      prevScrollYRef.current = y;
      const baseWithExternal = baseSpeed + externalVelocityRef.current;
      const scrollVelocity = dy * 0.001; // 灵敏度
      targetSpeedRef.current = baseWithExternal + scrollVelocity * speedMultiplier;
    };
    const onWheel = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 16 : 1; // 行→像素
      const baseWithExternal = baseSpeed + externalVelocityRef.current;
      const scrollVelocity = e.deltaY * unit * 0.001; // 标准化
      targetSpeedRef.current = baseWithExternal + scrollVelocity * speedMultiplier;
    };

    // 同时挂到 window 和 Canvas，确保事件被捕获
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    const el = gl.domElement as HTMLCanvasElement;
    const onWheelCanvas = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 16 : 1;
      const baseWithExternal = baseSpeed + externalVelocityRef.current;
      const scrollVelocity = e.deltaY * unit * 0.001;
      targetSpeedRef.current = baseWithExternal + scrollVelocity * speedMultiplier;
      e.preventDefault();
    };
    // 触摸端：用 touchmove 的 dy 作为增量，阻止默认页面滚动
    const lastTouchY = { v: 0 } as { v: number };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) lastTouchY.v = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches || e.touches.length === 0) return;
      const y = e.touches[0].clientY;
      const dy = lastTouchY.v - y; // 手指上滑→dy>0（对应滚轮下滑）
      lastTouchY.v = y;
      const baseWithExternal = baseSpeed + externalVelocityRef.current;
      const scrollVelocity = dy * 0.02; // 移动端增益更大一点
      targetSpeedRef.current = baseWithExternal + scrollVelocity * speedMultiplier;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheelCanvas, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      el.removeEventListener("wheel", onWheelCanvas);
      el.removeEventListener("touchstart", onTouchStart as any);
      el.removeEventListener("touchmove", onTouchMove as any);
    };
  }, [baseSpeed, speedMultiplier, gl]);

  useFrame((_, delta) => {
    if (!enabled) return;
    // 自然回落到基础速度
    const baseWithExternal = baseSpeed + externalVelocityRef.current;
    targetSpeedRef.current += (baseWithExternal - targetSpeedRef.current) * 0.02;
    // 平滑插值到目标速度
    currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * Math.min(1, delta * 10);
    if (groupRef.current) {
      groupRef.current.rotation.y += currentSpeedRef.current * delta;
    }
  });

  return null;
}

// 旋转控制器（支持滚动控制）
function RotationController({ 
  enabled, 
  durationSec, 
  direction,
  enableScrollControl = false,
  baseSpeed = 0.4,
  speedMultiplier = 3.0,
  externalVelocity = 0,
  children 
}: { 
  enabled: boolean; 
  durationSec: number; 
  direction: 1 | -1;
  enableScrollControl?: boolean;
  baseSpeed?: number;
  speedMultiplier?: number;
  externalVelocity?: number;
  children?: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!enabled || !groupRef.current) return;
    
    // 如果启用滚动控制，由 ScrollRotator 处理旋转
    if (enableScrollControl) return;
    
    // 否则使用固定速度旋转
    const speed = (2 * Math.PI) / durationSec * direction;
    groupRef.current.rotation.y += speed * delta;
  });

  return (
    <group ref={groupRef}>
      {enableScrollControl && (
        <ScrollRotator
          groupRef={groupRef}
          baseSpeed={baseSpeed}
          speedMultiplier={speedMultiplier}
          enabled={enabled}
          externalVelocity={externalVelocity}
        />
      )}
      {children}
    </group>
  );
}

// 主渲染组件
function JadeV6Content({
  modelPath = "/models/10k_obj/001_空.obj",
  rotationDurationSec = 8,
  direction = 1,
  fitToView = true,
  
  // 滚动控制参数（新增）
  enableScrollControl = false,
  baseSpeed = 0.4,
  speedMultiplier = 3.0,
  externalVelocity = 0,
  
  background = "#1f1e1c",
  showHdrBackground = false,
  environmentHdrPath = "/textures/qwantani_moon_noon_puresky_1k.hdr",
  environmentIntensity = 1.0,
  
  // 内层材质参数
  innerColor = 0x2d6d8b,
  innerMetalness = 1.0,
  innerRoughness = 1.0,
  innerTransmission = 0.0,
  innerEmissiveColor = 0x0f2b38,
  innerEmissiveIntensity = 12.0,
  enableEmissive = true,
  innerEnvMapIntensity = 2.0,
  
  // 图层控制
  showInnerLayer = true,
  showOuterLayer = true,
  outerOffset = 0.001,
  
  // 外层材质参数
  outerColor = 0xffffff,
  outerMetalness = 0.0,
  outerRoughness = 0.85,
  outerTransmission = 1.0,
  outerIor = 1.5,
  outerReflectivity = 0.30,
  outerThickness = 0.24,
  outerClearcoat = 0.0,
  outerClearcoatRoughness = 1.0,
  outerEnvMapIntensity = 5.0,
  normalMapPath = "/textures/normal.jpg",
  normalScale = 0.3,
  normalRepeat = 3,
  
  // 几何体优化（外壳细分）
  maxEdge = 0.15,
  subdivisions = 0,
  creaseAngle = 30,
  
  // 平滑着色控制
  smoothShading = true,
  innerSmoothShading = true,
  outerSmoothShading = true,
  
  exposure = 1.0,
  enableRotation = true,
  
  // 预加载设置
  enablePreloading = true,
  preloadAllModels = false,
  modelPaths = [],
}: JadeV6Props) {
  const { scene, gl } = useThree();
  const [envMap, setEnvMap] = useState<THREE.Texture | null>(null);
  const [normalMap, setNormalMap] = useState<THREE.Texture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const preloader = ModelPreloader.getInstance();

  // 预加载逻辑
  useEffect(() => {
    if (!enablePreloading) return;

    const preloadModels = async () => {
      try {
        if (preloadAllModels && modelPaths.length > 0) {
          console.log('[JadeV6] 开始预加载所有模型:', modelPaths);
          await preloader.preloadAllModels(modelPaths);
        } else {
          // 只预加载当前模型
          console.log('[JadeV6] 预加载当前模型:', modelPath);
          const allPaths = [modelPath, ...modelPaths];
          await preloader.preloadAllModels(allPaths);
        }
      } catch (err) {
        console.error('[JadeV6] 预加载失败:', err);
      }
    };

    preloadModels();
  }, [enablePreloading, preloadAllModels, modelPaths, modelPath, preloader]);

  // 创建内层材质（自发光层）- 支持透射度
  const innerMaterial = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: typeof innerColor === 'string' ? new THREE.Color(innerColor) : innerColor,
      metalness: innerMetalness,
      roughness: innerRoughness,
      transmission: innerTransmission,
      emissive: enableEmissive ? (typeof innerEmissiveColor === 'string' ? new THREE.Color(innerEmissiveColor) : innerEmissiveColor) : 0x000000,
      emissiveIntensity: enableEmissive ? innerEmissiveIntensity : 0,
      envMapIntensity: innerEnvMapIntensity,
      flatShading: !innerSmoothShading, // 平滑着色控制
    });

    // 设置法线贴图
    if (normalMap) {
      mat.normalMap = normalMap;
      mat.normalScale = new THREE.Vector2(normalScale, normalScale);
      mat.normalMap.wrapS = THREE.RepeatWrapping;
      mat.normalMap.wrapT = THREE.RepeatWrapping;
      mat.normalMap.repeat.set(normalRepeat, normalRepeat);
    }

    return mat;
  }, [
    innerColor, innerMetalness, innerRoughness, innerTransmission, innerEmissiveColor, innerEmissiveIntensity, 
    enableEmissive, innerEnvMapIntensity, innerSmoothShading, normalMap, normalScale, normalRepeat
  ]);

  // 创建外层材质（折射层）
  const outerMaterial = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: typeof outerColor === 'string' ? new THREE.Color(outerColor) : outerColor,
      metalness: outerMetalness,
      roughness: Math.max(0.05, outerRoughness), // 最小粗糙度确保反射可见
      transmission: outerTransmission,
      ior: outerIor,
      reflectivity: outerReflectivity,
      thickness: outerThickness,
      clearcoat: outerClearcoat,
      clearcoatRoughness: outerClearcoatRoughness,
      envMapIntensity: outerEnvMapIntensity,
      transparent: false,
      opacity: 1.0,
      flatShading: !outerSmoothShading, // 平滑着色控制
    });

    // 设置法线贴图
    if (normalMap) {
      mat.normalMap = normalMap;
      mat.normalScale = new THREE.Vector2(normalScale, normalScale);
      mat.normalMap.wrapS = THREE.RepeatWrapping;
      mat.normalMap.wrapT = THREE.RepeatWrapping;
      mat.normalMap.repeat.set(normalRepeat, normalRepeat);
    }

    return mat;
  }, [
    outerColor, outerMetalness, outerRoughness, outerTransmission, outerIor, outerReflectivity, 
    outerThickness, outerClearcoat, outerClearcoatRoughness, outerEnvMapIntensity, 
    outerSmoothShading, normalMap, normalScale, normalRepeat
  ]);

  // 当环境贴图加载后，只更新折射材质（内层不反射）
  useEffect(() => {
    if (envMap) {
      // 内层材质：根据参数决定是否使用环境贴图
      if (innerEnvMapIntensity > 0) {
        innerMaterial.envMap = envMap;
      } else {
        innerMaterial.envMap = null;
      }
      innerMaterial.needsUpdate = true;
      
      // 外层材质：设置环境贴图，用于折射
      outerMaterial.envMap = envMap;
      outerMaterial.needsUpdate = true;
      
      console.log('[JadeV6] 材质环境贴图设置完成:', {
        hasEnvMap: !!envMap,
        innerMaterialEnvMap: !!innerMaterial.envMap,
        outerMaterialEnvMap: !!outerMaterial.envMap,
        sceneEnvironment: !!scene.environment
      });
    }
  }, [envMap, innerEnvMapIntensity, innerMaterial, outerMaterial, scene.environment]);

  // 加载 HDR 环境贴图
  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError(null);

    console.log('[JadeV6] 开始加载 HDR 环境贴图:', environmentHdrPath);

    const rgbe = new RGBELoader();
    
    try {
      rgbe.load(
        environmentHdrPath,
        (texture) => {
          if (disposed) return;
          
          try {
            console.log('[JadeV6] HDR 纹理加载完成，开始生成 PMREM...');
            
            // 设置纹理映射模式
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            
            // 使用 PMREM 生成器处理 HDR 纹理
            const pmremGenerator = new THREE.PMREMGenerator(gl);
            pmremGenerator.compileEquirectangularShader();
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            pmremGenerator.dispose();
            texture.dispose(); // 释放原始纹理
            
            // 设置环境贴图（用于 PBR/折射采样）
            scene.environment = envMap;
            setEnvMap(envMap);
            setLoading(false);
            
            console.log('[JadeV6] ✅ HDR 环境贴图加载成功:', {
              path: environmentHdrPath,
              envMapSize: texture.image ? `${texture.image.width}x${texture.image.height}` : 'unknown',
              sceneEnvironment: !!scene.environment
            });
          } catch (err) {
            console.error('[JadeV6] ❌ HDR 环境贴图处理失败:', err);
            setError('环境贴图处理失败');
            setLoading(false);
          }
        },
        (progress) => {
          console.log('[JadeV6] HDR 加载进度:', progress);
        },
        (err) => {
          console.error('[JadeV6] ❌ HDR 环境贴图加载失败:', err);
          setError(`环境贴图加载失败: ${err instanceof Error ? err.message : '未知错误'}`);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('[JadeV6] ❌ RGBELoader 异常:', err);
      setError('环境贴图加载器异常');
      setLoading(false);
    }

    return () => {
      disposed = true;
    };
  }, [environmentHdrPath, gl, scene]);

  // 加载法线贴图
  useEffect(() => {
    if (!normalMapPath) return;

    let disposed = false;
    const loader = new THREE.TextureLoader();
    
    try {
      loader.load(
        normalMapPath,
        (texture) => {
          if (disposed) return;
          setNormalMap(texture);
          console.log('[JadeV6] 法线贴图加载成功:', normalMapPath);
        },
        undefined,
        (err) => {
          console.error('[JadeV6] 法线贴图加载失败:', err);
        }
      );
    } catch (err) {
      console.error('[JadeV6] 法线贴图加载器异常:', err);
    }

    return () => {
      disposed = true;
    };
  }, [normalMapPath]);

  // 设置背景（纯色或 HDR）
  useEffect(() => {
    try {
      if (showHdrBackground && envMap) {
        // 显示 HDR 背景
        scene.background = envMap;
        console.log('[JadeV6] HDR 背景设置成功');
      } else {
        // 显示纯色背景
        if (typeof background === 'string') {
          scene.background = new THREE.Color(background);
        } else {
          scene.background = new THREE.Color(background);
        }
        console.log('[JadeV6] 纯色背景设置成功:', background);
      }
    } catch (err) {
      console.error('[JadeV6] 背景设置失败:', err);
    }
  }, [background, showHdrBackground, envMap, scene]);

  if (loading) {
    return null; // 加载期间不显示任何内容
  }

  if (error) {
    return null; // 错误时也不显示占位立方体
  }

  // 调试信息：显示环境贴图状态
  console.log('[JadeV6] 双层渲染状态:', {
    hasEnvMap: !!envMap,
    hasSceneEnvironment: !!scene.environment,
    innerMaterialEnvMap: !!innerMaterial.envMap,
    outerMaterialEnvMap: !!outerMaterial.envMap
  });

  return (
    <RotationController 
      enabled={enableRotation} 
      durationSec={rotationDurationSec} 
      direction={direction}
      enableScrollControl={enableScrollControl}
      baseSpeed={baseSpeed}
      speedMultiplier={speedMultiplier}
      externalVelocity={externalVelocity}
    >
      <DualLayerModelLoader 
        modelPath={modelPath} 
        material={innerMaterial}
        refractionMaterial={outerMaterial}
        fitToView={fitToView}
        showInnerLayer={showInnerLayer}
        showOuterLayer={showOuterLayer}
        outerOffset={outerOffset}
        maxEdge={maxEdge}
        subdivisions={subdivisions}
        creaseAngle={creaseAngle}
        smoothShading={smoothShading}
        innerSmoothShading={innerSmoothShading}
        outerSmoothShading={outerSmoothShading}
        enablePreloading={enablePreloading}
      />
    </RotationController>
  );
}

// 主组件
export default function JadeV6(props: JadeV6Props) {
  const {
    exposure = 1.0,
    ...contentProps
  } = props;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <OrientationGuard />
      <Canvas 
        style={{ width: '100%', height: '100%', display: 'block' }}
        camera={{ position: [0, 0, 5], fov: 45 }} 
        gl={{ 
          toneMappingExposure: exposure,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
          antialias: true,
          powerPreference: 'high-performance'
        }}
      >
        <Suspense fallback={null}>
          <JadeV6Content {...contentProps} />
        </Suspense>
      </Canvas>
    </div>
  );
}