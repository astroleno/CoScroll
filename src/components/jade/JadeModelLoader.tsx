"use client";

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTransitionControl } from "@/hooks/useTransitionControl";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TessellateModifier } from 'three-stdlib';
import { toCreasedNormals } from 'three-stdlib';
import ModelPreloader from "./ModelPreloader";

/**
 * JadeModelLoader - 独立的3D模型加载器组件
 * 不包含Canvas，只负责加载和渲染3D模型
 */
interface JadeModelLoaderProps {
  modelPath: string;
  rotationDurationSec?: number;
  direction?: 1 | -1;
  fitToView?: boolean;
  enableRotation?: boolean;

  // 滚动控制参数
  enableScrollControl?: boolean;
  baseSpeed?: number;
  speedMultiplier?: number;
  externalVelocity?: number;

  // 旋转控制增强参数
  maxAngularVelocity?: number;
  enableDamping?: boolean;
  dampingFactor?: number;
  velocitySmoothing?: number;
  maxRotationPerFrame?: number;
  
  // 内层材质参数
  innerColor?: string | number;
  innerMetalness?: number;
  innerRoughness?: number;
  innerTransmission?: number;
  innerEmissiveColor?: string | number;
  innerEmissiveIntensity?: number;
  enableEmissive?: boolean;
  innerEnvMapIntensity?: number;
  
  // 图层控制
  showInnerLayer?: boolean;
  showOuterLayer?: boolean;
  outerOffset?: number;
  
  // 外层材质参数
  outerColor?: string | number;
  outerMetalness?: number;
  outerRoughness?: number;
  outerTransmission?: number;
  outerIor?: number;
  outerReflectivity?: number;
  outerThickness?: number;
  outerClearcoat?: number;
  outerClearcoatRoughness?: number;
  outerEnvMapIntensity?: number;
  
  // 几何体优化
  maxEdge?: number;
  subdivisions?: number;
  creaseAngle?: number;
  
  // 平滑着色控制
  smoothShading?: boolean;
  innerSmoothShading?: boolean;
  outerSmoothShading?: boolean;
}

/**
 * 应用平滑着色
 */
function applySmoothShading(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  let geo = geometry.clone();
  
  try {
    geo = mergeVertices(geo);
    geo.computeVertexNormals();
    console.log('[JadeModelLoader] 平滑着色已应用');
  } catch (e) {
    console.warn('[JadeModelLoader] 平滑着色应用失败:', e);
  }
  
  return geo;
}

/**
 * 几何体优化流程
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
    
    if (optSmooth) {
      geo = applySmoothShading(geo);
    }
  } catch (e) {
    console.warn('[JadeModelLoader] 几何优化失败，使用原始几何:', e);
  }
  return geo;
}

/**
 * 简化版 Loop 细分
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

function createOffsetGeometry(originalGeometry: THREE.BufferGeometry, offsetDistance: number, optimizeOptions?: { maxEdge?: number; subdivisions?: number; creaseAngle?: number; smoothShading?: boolean }): THREE.BufferGeometry {
  let offsetGeometry = originalGeometry.clone();
  
  if (optimizeOptions) {
    offsetGeometry = optimizeGeometry(offsetGeometry, optimizeOptions);
  }
  
  offsetGeometry.computeVertexNormals();
  
  const positionAttribute = offsetGeometry.getAttribute('position');
  const normalAttribute = offsetGeometry.getAttribute('normal');
  
  const newPositions = new Float32Array(positionAttribute.count * 3);
  
  for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    const z = positionAttribute.getZ(i);
    
    const nx = normalAttribute.getX(i);
    const ny = normalAttribute.getY(i);
    const nz = normalAttribute.getZ(i);
    
    newPositions[i * 3] = x + nx * offsetDistance;
    newPositions[i * 3 + 1] = y + ny * offsetDistance;
    newPositions[i * 3 + 2] = z + nz * offsetDistance;
  }
  
  offsetGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  offsetGeometry.computeVertexNormals();
  
  return offsetGeometry;
}

function ScrollRotator({
  groupRef,
  baseSpeed,
  speedMultiplier,
  enabled,
  externalVelocity = 0,
  maxAngularVelocity = 2.0,
  enableDamping = true,
  dampingFactor = 0.95,
  velocitySmoothing = 0.1,
  maxRotationPerFrame = 0.1,
}: {
  groupRef: React.RefObject<THREE.Group>;
  baseSpeed: number;
  speedMultiplier: number;
  enabled: boolean;
  externalVelocity?: number;
  maxAngularVelocity?: number;
  enableDamping?: boolean;
  dampingFactor?: number;
  velocitySmoothing?: number;
  maxRotationPerFrame?: number;
}) {
  const { gl } = useThree();
  const prevScrollYRef = useRef(0);
  const targetSpeedRef = useRef(baseSpeed);
  const currentSpeedRef = useRef(baseSpeed);
  const externalVelocityRef = useRef(externalVelocity);
  const smoothedVelocityRef = useRef(0);
  const totalRotationRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const lastExternalVelocityRef = useRef(externalVelocity);

  // Transition control for smooth state changes
  const transitionControl = useTransitionControl({
    transitionDuration: 800,
    enableVelocityReset: true,
    maxTransitionVelocity: 0.8,
    smoothingFactor: 0.15
  });

  useEffect(() => {
    const prevVelocity = lastExternalVelocityRef.current;
    lastExternalVelocityRef.current = externalVelocity;

    // Detect significant velocity changes that might indicate background/foreground transitions
    const velocityChange = Math.abs(externalVelocity - prevVelocity);
    const isSignificantChange = velocityChange > 0.5;

    if (isSignificantChange) {
      console.log('[ScrollRotator] Significant velocity change detected:', {
        prevVelocity,
        newVelocity: externalVelocity,
        change: velocityChange
      });

      // Handle transition based on velocity change pattern
      if (Math.abs(prevVelocity) > Math.abs(externalVelocity)) {
        // Velocity decreasing - likely background to foreground
        transitionControl.onBackgroundToForeground(currentSpeedRef.current);
      } else {
        // Velocity increasing - likely foreground to background
        transitionControl.onForegroundToBackground(currentSpeedRef.current);
      }
    }

    externalVelocityRef.current = externalVelocity;
  }, [externalVelocity, transitionControl]);

  useEffect(() => {
    const baseWithExternal = Math.max(-maxAngularVelocity, Math.min(maxAngularVelocity, baseSpeed + externalVelocityRef.current));
    targetSpeedRef.current = baseWithExternal;
  }, [baseSpeed, externalVelocityRef.current, maxAngularVelocity]);

  useEffect(() => {
    prevScrollYRef.current = window.scrollY || 0;
    const onScroll = () => {
      const y = window.scrollY || 0;
      const dy = y - prevScrollYRef.current;
      prevScrollYRef.current = y;
      const baseWithExternal = baseSpeed + externalVelocityRef.current;
      const scrollVelocity = dy * 0.001;

      // Apply velocity smoothing
      smoothedVelocityRef.current += (scrollVelocity - smoothedVelocityRef.current) * velocitySmoothing;

      // Calculate target speed with limits
      let newTargetSpeed = baseWithExternal + smoothedVelocityRef.current * speedMultiplier;
      newTargetSpeed = Math.max(-maxAngularVelocity, Math.min(maxAngularVelocity, newTargetSpeed));

      targetSpeedRef.current = newTargetSpeed;
    };
    const onWheel = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 16 : 1;
      const baseWithExternal = baseSpeed + externalVelocityRef.current;
      const scrollVelocity = e.deltaY * unit * 0.001;

      // Apply velocity smoothing
      smoothedVelocityRef.current += (scrollVelocity - smoothedVelocityRef.current) * velocitySmoothing;

      // Calculate target speed with limits
      let newTargetSpeed = baseWithExternal + smoothedVelocityRef.current * speedMultiplier;
      newTargetSpeed = Math.max(-maxAngularVelocity, Math.min(maxAngularVelocity, newTargetSpeed));

      targetSpeedRef.current = newTargetSpeed;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    const el = gl.domElement as HTMLCanvasElement;
    const onWheelCanvas = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 16 : 1;
      const baseWithExternal = baseSpeed + externalVelocityRef.current;
      const scrollVelocity = e.deltaY * unit * 0.001;

      // Apply velocity smoothing
      smoothedVelocityRef.current += (scrollVelocity - smoothedVelocityRef.current) * velocitySmoothing;

      // Calculate target speed with limits
      let newTargetSpeed = baseWithExternal + smoothedVelocityRef.current * speedMultiplier;
      newTargetSpeed = Math.max(-maxAngularVelocity, Math.min(maxAngularVelocity, newTargetSpeed));

      targetSpeedRef.current = newTargetSpeed;
      e.preventDefault();
    };

    const lastTouchY = { v: 0 } as { v: number };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) lastTouchY.v = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches || e.touches.length === 0) return;
      const y = e.touches[0].clientY;
      const dy = lastTouchY.v - y;
      lastTouchY.v = y;
      const baseWithExternal = baseSpeed + externalVelocityRef.current;
      const scrollVelocity = dy * 0.02;

      // Apply velocity smoothing
      smoothedVelocityRef.current += (scrollVelocity - smoothedVelocityRef.current) * velocitySmoothing;

      // Calculate target speed with limits
      let newTargetSpeed = baseWithExternal + scrollVelocity * speedMultiplier;
      newTargetSpeed = Math.max(-maxAngularVelocity, Math.min(maxAngularVelocity, newTargetSpeed));

      targetSpeedRef.current = newTargetSpeed;
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
  }, [baseSpeed, speedMultiplier, gl, maxAngularVelocity, velocitySmoothing]);

  useFrame((_, delta) => {
    if (!enabled || !groupRef.current) return;

    const currentTime = performance.now();
    const deltaTime = lastFrameTimeRef.current > 0 ? (currentTime - lastFrameTimeRef.current) / 1000 : delta;
    lastFrameTimeRef.current = currentTime;

    // Get controlled velocity from transition system
    const transitionVelocity = transitionControl.getCurrentVelocity();

    // Apply damping to target speed when no external input
    if (enableDamping) {
      const baseWithExternal = Math.max(-maxAngularVelocity, Math.min(maxAngularVelocity, baseSpeed + externalVelocityRef.current));
      targetSpeedRef.current += (baseWithExternal - targetSpeedRef.current) * (1 - dampingFactor);
    }

    // Use transition velocity if transitioning, otherwise use normal speed
    let effectiveSpeed = currentSpeedRef.current;
    if (transitionControl.isTransitioning()) {
      effectiveSpeed = transitionVelocity;
      console.log('[ScrollRotator] Using transition velocity:', transitionVelocity);
    } else {
      // Smooth current speed transition
      currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * Math.min(1, deltaTime * 10);
      effectiveSpeed = currentSpeedRef.current;
    }

    // Apply maximum rotation per frame limit
    const maxRotationThisFrame = maxRotationPerFrame * deltaTime * 60; // Normalize to 60fps
    const rotationDelta = Math.max(-maxRotationThisFrame, Math.min(maxRotationThisFrame, effectiveSpeed * deltaTime));

    // Apply rotation
    groupRef.current.rotation.y += rotationDelta;

    // Track total rotation
    totalRotationRef.current += Math.abs(rotationDelta);

    // Gradually decay smoothed velocity
    smoothedVelocityRef.current *= 0.98;
  });

  return null;
}

function RotationController({
  enabled,
  durationSec,
  direction,
  enableScrollControl = false,
  baseSpeed = 0.4,
  speedMultiplier = 3.0,
  externalVelocity = 0,
  maxAngularVelocity = 2.0,
  enableDamping = true,
  dampingFactor = 0.95,
  velocitySmoothing = 0.1,
  maxRotationPerFrame = 0.1,
  children
}: {
  enabled: boolean;
  durationSec: number;
  direction: 1 | -1;
  enableScrollControl?: boolean;
  baseSpeed?: number;
  speedMultiplier?: number;
  externalVelocity?: number;
  maxAngularVelocity?: number;
  enableDamping?: boolean;
  dampingFactor?: number;
  velocitySmoothing?: number;
  maxRotationPerFrame?: number;
  children?: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!enabled || !groupRef.current) return;

    if (enableScrollControl) return;

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
          maxAngularVelocity={maxAngularVelocity}
          enableDamping={enableDamping}
          dampingFactor={dampingFactor}
          velocitySmoothing={velocitySmoothing}
          maxRotationPerFrame={maxRotationPerFrame}
        />
      )}
      {children}
    </group>
  );
}

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

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError(null);

    const loadModel = async () => {
      try {
        console.log('[JadeModelLoader] 开始加载模型:', modelPath);
        
        let loadedGeometry = preloader.getModel(modelPath);
        
        if (loadedGeometry) {
          console.log('[JadeModelLoader] 使用预加载模型:', modelPath);
          if (disposed) return;
          setGeometry(loadedGeometry);
          setLoading(false);
          return;
        }

        if (preloader.isModelLoading(modelPath)) {
          console.log('[JadeModelLoader] 等待预加载完成:', modelPath);
          while (preloader.isModelLoading(modelPath)) {
            await new Promise(resolve => setTimeout(resolve, 50));
            if (disposed) return;
          }
          
          loadedGeometry = preloader.getModel(modelPath);
          if (loadedGeometry) {
            console.log('[JadeModelLoader] 预加载完成，使用模型:', modelPath);
            if (disposed) return;
            setGeometry(loadedGeometry);
            setLoading(false);
            return;
          }
        }

        console.log('[JadeModelLoader] 直接加载模型:', modelPath);
        if (modelPath.endsWith('.obj')) {
          const loader = new OBJLoader();
          const obj = await new Promise<THREE.Group>((resolve, reject) => {
            loader.load(modelPath, resolve, undefined, reject);
          });
          
          if (disposed) return;
          
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

        loadedGeometry = mergeVertices(loadedGeometry);
        loadedGeometry.computeVertexNormals();
        
        setGeometry(loadedGeometry);
        setLoading(false);
        
        console.log('[JadeModelLoader] 模型加载成功:', modelPath);
      } catch (err) {
        console.error('[JadeModelLoader] 模型加载失败:', err);
        setError(err instanceof Error ? err.message : '未知错误');
        setLoading(false);
      }
    };

    loadModel();

    return () => {
      disposed = true;
    };
  }, [modelPath, preloader]);

  useEffect(() => {
    if (!geometry) return;
    
    const offset = createOffsetGeometry(geometry, outerOffset, { maxEdge, subdivisions, creaseAngle, smoothShading: outerSmoothShading });
    setOffsetGeometry(offset);
    
    console.log('[JadeModelLoader] Offset 几何体重新创建，偏移距离:', outerOffset);
  }, [geometry, outerOffset, maxEdge, subdivisions, creaseAngle, outerSmoothShading]);

  useEffect(() => {
    if (!geometry || !offsetGeometry || !fitToView || !meshRef.current) return;

    try {
      const box = new THREE.Box3().setFromObject(meshRef.current);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const distance = maxDim * 2.5;
      
      camera.position.set(0, 0, distance);
      camera.lookAt(center);
      
      console.log('[JadeModelLoader] 视图适配完成:', {
        size: size.toArray(),
        center: center.toArray(),
        distance,
      });
    } catch (err) {
      console.warn('[JadeModelLoader] 视图适配失败:', err);
    }
  }, [geometry, offsetGeometry, fitToView, camera]);

  if (loading) {
    return null;
  }

  if (error) {
    return null;
  }

  if (!geometry || !offsetGeometry) return null;

  return (
    <group>
      {showInnerLayer && (
        <mesh ref={meshRef} geometry={geometry} material={material} />
      )}
      
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

export default function JadeModelLoader({
  modelPath = "/models/10k_obj/001_空.obj",
  rotationDurationSec = 8,
  direction = 1,
  fitToView = true,
  enableRotation = true,

  enableScrollControl = false,
  baseSpeed = 0.4,
  speedMultiplier = 3.0,
  externalVelocity = 0,

  // 旋转控制增强参数
  maxAngularVelocity = 2.0,
  enableDamping = true,
  dampingFactor = 0.95,
  velocitySmoothing = 0.1,
  maxRotationPerFrame = 0.1,
  
  innerColor = 0x2d6d8b,
  innerMetalness = 1.0,
  innerRoughness = 1.0,
  innerTransmission = 0.0,
  innerEmissiveColor = 0x0f2b38,
  innerEmissiveIntensity = 12.0,
  enableEmissive = true,
  innerEnvMapIntensity = 2.0,
  
  showInnerLayer = true,
  showOuterLayer = true,
  outerOffset = 0.001,
  
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
  
  maxEdge = 0.15,
  subdivisions = 0,
  creaseAngle = 30,
  
  smoothShading = true,
  innerSmoothShading = true,
  outerSmoothShading = true,
}: JadeModelLoaderProps) {
  const { scene } = useThree();
  const [envMap, setEnvMap] = useState<THREE.Texture | null>(null);

  const innerMaterial = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: typeof innerColor === 'string' ? new THREE.Color(innerColor) : innerColor,
      metalness: innerMetalness,
      roughness: innerRoughness,
      transmission: innerTransmission,
      emissive: enableEmissive ? (typeof innerEmissiveColor === 'string' ? new THREE.Color(innerEmissiveColor) : innerEmissiveColor) : 0x000000,
      emissiveIntensity: enableEmissive ? innerEmissiveIntensity : 0,
      envMapIntensity: innerEnvMapIntensity,
      flatShading: !innerSmoothShading,
    });

    return mat;
  }, [
    innerColor, innerMetalness, innerRoughness, innerTransmission, innerEmissiveColor, innerEmissiveIntensity, 
    enableEmissive, innerEnvMapIntensity, innerSmoothShading
  ]);

  const outerMaterial = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: typeof outerColor === 'string' ? new THREE.Color(outerColor) : outerColor,
      metalness: outerMetalness,
      roughness: Math.max(0.05, outerRoughness),
      transmission: outerTransmission,
      ior: outerIor,
      reflectivity: outerReflectivity,
      thickness: outerThickness,
      clearcoat: outerClearcoat,
      clearcoatRoughness: outerClearcoatRoughness,
      envMapIntensity: outerEnvMapIntensity,
      transparent: false,
      opacity: 1.0,
      flatShading: !outerSmoothShading,
    });

    return mat;
  }, [
    outerColor, outerMetalness, outerRoughness, outerTransmission, outerIor, outerReflectivity, 
    outerThickness, outerClearcoat, outerClearcoatRoughness, outerEnvMapIntensity, 
    outerSmoothShading
  ]);

  useEffect(() => {
    let disposed = false;

    const rgbe = new RGBELoader();
    
    try {
      rgbe.load(
        "/textures/qwantani_moon_noon_puresky_1k.hdr",
        (texture) => {
          if (disposed) return;
          
          try {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            
            setEnvMap(texture);
            scene.environment = texture;
            
            console.log('[JadeModelLoader] HDR 环境贴图加载成功');
          } catch (err) {
            console.error('[JadeModelLoader] HDR 环境贴图处理失败:', err);
          }
        },
        undefined,
        (err) => {
          console.error('[JadeModelLoader] HDR 环境贴图加载失败:', err);
        }
      );
    } catch (err) {
      console.error('[JadeModelLoader] RGBELoader 异常:', err);
    }

    return () => {
      disposed = true;
    };
  }, [scene]);

  useEffect(() => {
    if (envMap) {
      if (innerEnvMapIntensity > 0) {
        innerMaterial.envMap = envMap;
      } else {
        innerMaterial.envMap = null;
      }
      innerMaterial.needsUpdate = true;
      
      outerMaterial.envMap = envMap;
      outerMaterial.needsUpdate = true;
      
      console.log('[JadeModelLoader] 材质环境贴图设置完成');
    }
  }, [envMap, innerEnvMapIntensity, innerMaterial, outerMaterial]);

  return (
    <RotationController
      enabled={enableRotation}
      durationSec={rotationDurationSec}
      direction={direction}
      enableScrollControl={enableScrollControl}
      baseSpeed={baseSpeed}
      speedMultiplier={speedMultiplier}
      externalVelocity={externalVelocity}
      maxAngularVelocity={maxAngularVelocity}
      enableDamping={enableDamping}
      dampingFactor={dampingFactor}
      velocitySmoothing={velocitySmoothing}
      maxRotationPerFrame={maxRotationPerFrame}
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
        enablePreloading={true}
      />
    </RotationController>
  );
}
