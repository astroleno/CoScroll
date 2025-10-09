"use client";

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTransitionControl } from "@/hooks/useTransitionControl";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import ModelPreloader from "./ModelPreloader";

const IS_DEV = process.env.NODE_ENV === 'development';

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
  
  // 环境配置
  environmentHdrPath?: string;
  environmentIntensity?: number;
  background?: string | number;
  showHdrBackground?: boolean;
  
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
  
  // 法线贴图
  normalMapPath?: string;
  normalScale?: number;
  normalRepeat?: number;

  // 几何体优化
  maxEdge?: number;
  subdivisions?: number;
  creaseAngle?: number;
  
  // 平滑着色控制
  smoothShading?: boolean;
  innerSmoothShading?: boolean;
  outerSmoothShading?: boolean;
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
      if (IS_DEV) {
        console.log('[ScrollRotator] Using transition velocity:', transitionVelocity);
      }
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
        if (IS_DEV) {
          console.log('[JadeModelLoader] 开始加载模型:', modelPath);
        }

        let loadedGeometry = preloader.getModel(modelPath);

        if (loadedGeometry) {
          if (IS_DEV) {
            console.log('[JadeModelLoader] 使用预加载模型:', modelPath);
          }
          if (disposed) return;
          setGeometry(loadedGeometry);
          setLoading(false);
          return;
        }

        if (preloader.isModelLoading(modelPath)) {
          if (IS_DEV) {
            console.log('[JadeModelLoader] 等待预加载完成:', modelPath);
          }
          while (preloader.isModelLoading(modelPath)) {
            await new Promise(resolve => setTimeout(resolve, 50));
            if (disposed) return;
          }
          
          loadedGeometry = preloader.getModel(modelPath);
          if (loadedGeometry) {
            if (IS_DEV) {
              console.log('[JadeModelLoader] 预加载完成，使用模型:', modelPath);
            }
            if (disposed) return;
            setGeometry(loadedGeometry);
            setLoading(false);
            return;
          }
        }

        if (IS_DEV) {
          console.log('[JadeModelLoader] 直接加载模型:', modelPath);
        }
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
        preloader.addToCache(modelPath, loadedGeometry);
        setLoading(false);

        if (IS_DEV) {
          console.log('[JadeModelLoader] 模型加载成功:', modelPath);
        }
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

    const offsetGeometryFromCache = preloader.getOffsetGeometry(modelPath, {
      outerOffset,
      maxEdge,
      subdivisions,
      creaseAngle,
      smoothShading: outerSmoothShading,
    });

    if (offsetGeometryFromCache) {
      setOffsetGeometry(offsetGeometryFromCache);
      if (IS_DEV) {
        console.log('[JadeModelLoader] 使用缓存 Offset 几何体:', {
          modelPath,
          outerOffset,
          maxEdge,
          subdivisions,
          creaseAngle,
          smoothShading: outerSmoothShading,
        });
      }
      return;
    }

    try {
      const generated = preloader.getOffsetGeometry(modelPath, {
        outerOffset,
        maxEdge,
        subdivisions,
        creaseAngle,
        smoothShading: outerSmoothShading,
      });

      if (generated) {
        setOffsetGeometry(generated);
        if (IS_DEV) {
          console.log('[JadeModelLoader] 生成并缓存 Offset 几何体:', {
            modelPath,
            outerOffset,
          });
        }
        return;
      }
    } catch (error) {
      console.error('[JadeModelLoader] Offset 几何体生成失败:', error);
    }

    const fallback = geometry.clone();
    fallback.computeVertexNormals();
    setOffsetGeometry(fallback);
    if (IS_DEV) {
      console.warn('[JadeModelLoader] Offset 几何体缓存未命中，使用回退几何:', modelPath);
    }
  }, [geometry, modelPath, outerOffset, maxEdge, subdivisions, creaseAngle, outerSmoothShading, preloader]);

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
      
      if (IS_DEV) {
        console.log('[JadeModelLoader] 视图适配完成:', {
          size: size.toArray(),
          center: center.toArray(),
          distance,
        });
      }
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
  
  environmentHdrPath = "/textures/qwantani_moon_noon_puresky_1k.hdr",
  environmentIntensity = 1.0,
  background = "#1f1e1c",
  showHdrBackground = false,
  
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
  normalMapPath = "/textures/normal.jpg",
  normalScale = 0.3,
  normalRepeat = 3,
  
  maxEdge = 0.15,
  subdivisions = 0,
  creaseAngle = 30,

  smoothShading = true,
  innerSmoothShading = true,
  outerSmoothShading = true,
}: JadeModelLoaderProps) {
  const { scene, gl } = useThree();
  const [envMap, setEnvMap] = useState<THREE.Texture | null>(null);
  const [normalMap, setNormalMap] = useState<THREE.Texture | null>(null);

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

  useEffect(() => {
    let disposed = false;

    if (!environmentHdrPath) {
      setEnvMap(null);
      scene.environment = null;
      return () => {
        disposed = true;
      };
    }

    if (IS_DEV) {
      console.log('[JadeModelLoader] 开始加载 HDR 环境贴图:', environmentHdrPath);
    }

    const loader = new RGBELoader();
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    pmremGenerator.compileEquirectangularShader();

    loader.load(
      environmentHdrPath,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }

        try {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          texture.colorSpace = THREE.SRGBColorSpace;

          const envTexture = pmremGenerator.fromEquirectangular(texture).texture;
          pmremGenerator.dispose();
          texture.dispose();

          scene.environment = envTexture;
          (scene as any).environmentIntensity = environmentIntensity;
          setEnvMap(envTexture);

          if (IS_DEV) {
            console.log('[JadeModelLoader] HDR 环境贴图加载成功:', environmentHdrPath);
          }
        } catch (err) {
          if (IS_DEV) {
            console.error('[JadeModelLoader] HDR 环境贴图处理失败:', err);
          }
          pmremGenerator.dispose();
        }
      },
      undefined,
      (err) => {
        if (IS_DEV) {
          console.error('[JadeModelLoader] HDR 环境贴图加载失败:', err);
        }
        pmremGenerator.dispose();
        if (!disposed) {
          setEnvMap(null);
        }
      }
    );

    return () => {
      disposed = true;
      pmremGenerator.dispose();
    };
  }, [environmentHdrPath, environmentIntensity, gl, scene]);

  useEffect(() => {
    if (!envMap) {
      scene.environment = null;
      if (!showHdrBackground) {
        try {
          scene.background = new THREE.Color(background as any);
        } catch (err) {
          if (IS_DEV) {
            console.error('[JadeModelLoader] 背景恢复失败:', err);
          }
        }
      }
      return;
    }

    if (innerEnvMapIntensity > 0) {
      innerMaterial.envMap = envMap;
      innerMaterial.envMapIntensity = innerEnvMapIntensity * environmentIntensity;
    } else {
      innerMaterial.envMap = null;
      innerMaterial.envMapIntensity = 0;
    }
    innerMaterial.needsUpdate = true;

    outerMaterial.envMap = envMap;
    outerMaterial.envMapIntensity = outerEnvMapIntensity * environmentIntensity;
    outerMaterial.needsUpdate = true;

    scene.environment = envMap;
    (scene as any).environmentIntensity = environmentIntensity;

    if (IS_DEV) {
      console.log('[JadeModelLoader] 材质环境贴图设置完成');
    }
  }, [
    envMap,
    innerEnvMapIntensity,
    outerEnvMapIntensity,
    innerMaterial,
    outerMaterial,
    environmentIntensity,
    scene,
    showHdrBackground,
    background
  ]);

  useEffect(() => {
    try {
      if (showHdrBackground && envMap) {
        scene.background = envMap;
      } else if (!showHdrBackground) {
        if (background === null || background === undefined || background === 'transparent') {
          scene.background = null;
        } else {
          scene.background = new THREE.Color(background as any);
        }
      }
    } catch (err) {
      if (IS_DEV) {
        console.error('[JadeModelLoader] 背景设置失败:', err);
      }
    }
  }, [background, showHdrBackground, envMap, scene]);

  useEffect(() => {
    if (!normalMapPath) {
      setNormalMap((prev) => {
        if (prev) {
          prev.dispose();
        }
        return null;
      });
      return;
    }

    let disposed = false;
    const loader = new THREE.TextureLoader();

    loader.load(
      normalMapPath,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        setNormalMap((prev) => {
          if (prev && prev !== texture) {
            prev.dispose();
          }
          return texture;
        });

        if (IS_DEV) {
          console.log('[JadeModelLoader] 法线贴图加载成功:', normalMapPath);
        }
      },
      undefined,
      (err) => {
        if (IS_DEV) {
          console.error('[JadeModelLoader] 法线贴图加载失败:', err);
        }
      }
    );

    return () => {
      disposed = true;
    };
  }, [normalMapPath]);

  useEffect(() => {
    return () => {
      if (normalMap) {
        normalMap.dispose();
      }
    };
  }, [normalMap]);

  useEffect(() => {
    return () => {
      if (envMap) {
        envMap.dispose();
      }
    };
  }, [envMap]);

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
