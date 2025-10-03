'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TessellateModifier } from 'three-stdlib';
import { toCreasedNormals } from 'three-stdlib';
import { createScreenSpaceRefractionMaterial } from './ScreenSpaceRefractionMaterial';
import OffscreenMochiBackground from '@/components/backgrounds/OffscreenMochiBackground';
// 移除动态环境贴图链路：不再引入 OffscreenMochiEnvMap / Proxy

/**
 * JadeV2（简化复刻 JadeShader）
 * - 严格使用 MeshPhysicalMaterial 的核心参数：color/metalness/roughness/transmission/ior/reflectivity/thickness
 * - 使用 HDR 环境贴图作为 envMap
 * - 使用普通法线贴图，且支持 normalRepeat/normalScale/clearcoatNormalScale
 * - 明确不包含任何【C方案】内部衰减颜色/距离的参数与实现
 * - 使用 GLTF dragon 模型路径作为输入，加载后仅取其几何体
 */
export interface JadeV2Props {
  modelPath?: string;          // GLB/GLTF 模型路径，默认参考 ref/JadeShader 的 dragon.glb
  hdrPath?: string;            // 环境 IBL 用的 HDR 贴图路径
  backgroundHdrPath?: string;  // 背景可见图（可与 hdrPath 不同）；不传则与 hdrPath 相同
  backgroundTexturePath?: string; // 背景平面用的纹理（可选，不绘制平面，仅用于与参考一致的贴图来源）
  normalMapPath?: string;      // 法线贴图路径
  showBackground?: boolean;    // 是否显示背景平面
  // 屏幕空间折射（方案2）
  useDualPassRefraction?: boolean; // 开启屏幕空间折射
  refractionTexture?: THREE.Texture | null; // 来自 OffscreenMochiBackground 的 RT 纹理
  // 动态环境贴图（方案A：优先级高于 hdrPath）
  dynamicEnvMap?: THREE.Texture | null; // 来自 OffscreenMochiEnvMap 的动态环境贴图
  qualityPreset?: 'low'|'med'|'high';
  useEdgeFade?: boolean;

  // 材质参数（参考 JadeShader src/index.js 的 options 默认值）
  color?: string | number;     // 颜色
  metalness?: number;
  roughness?: number;
  transmission?: number;
  ior?: number;
  reflectivity?: number;
  thickness?: number;
  envMapIntensity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  normalScale?: number;
  clearcoatNormalScale?: number;
  normalRepeat?: number;       // 1-4 整数

  // 几何体优化（与 Jade.tsx 保持一致的 A+B 方案）
  maxEdge?: number;            // Tessellate 目标最大边长（0.01-0.15）
  subdivisions?: number;       // 简化 Loop 细分次数（0-1）
  creaseAngle?: number;        // 折痕角度（30-90）

  autoRotate?: boolean;        // 是否缓慢自转
  scale?: number;              // 统一缩放
  // 环境旋转（弧度）。传入时将覆盖内部自增逻辑
  envYaw?: number;
}

export default function JadeV2({
  modelPath = '/models/dragon.glb',
  hdrPath = '/textures/qwantani_moon_noon_puresky_1k.hdr',
  backgroundHdrPath,
  backgroundTexturePath = '/textures/texture.jpg',
  normalMapPath = '/textures/normal.jpg',
  showBackground = false,
  useDualPassRefraction = false,
  refractionTexture = null,
  dynamicEnvMap = null,
  qualityPreset = 'med',
  useEdgeFade = true,

  color = 0xffffff,
  metalness = 0.0,
  roughness = 0.55,
  transmission = 1.0,
  ior = 1.5,
  reflectivity = 0.45,
  thickness = 1.1,
  envMapIntensity = 2.4,
  clearcoat = 1.0,
  clearcoatRoughness = 1.0,
  normalScale = 0.3,
  clearcoatNormalScale = 0.2,
  normalRepeat = 3,

  // 几何优化默认值（贴合 Jade.tsx）
  maxEdge = 0.15,
  subdivisions = 0,
  creaseAngle = 30,

  autoRotate = true,
  scale = 1,
  envYaw,
}: JadeV2Props) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport, gl, scene } = useThree();

  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [envMap, setEnvMap] = useState<THREE.Texture | null>(null);
  const [normalMap, setNormalMap] = useState<THREE.Texture | null>(null);
  // 保留两份环境贴图：PMREM（用于 IBL）与 equirect（用于可见背景）
  const [envBackground, setEnvBackground] = useState<THREE.Texture | null>(null);
  const [bgTexture, setBgTexture] = useState<THREE.Texture | null>(null);
  const [internalRefractionTex, setInternalRefractionTex] = useState<THREE.Texture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 几何优化流程（与 Jade.tsx 同源）：
   * 1) mergeVertices 焊接重复顶点
   * 2) 转非索引
   * 3) TessellateModifier 均匀化三角形
   * 4) 简化 Loop 细分（每个三角形分 4）
   * 5) computeVertexNormals
   * 6) toCreasedNormals 基于角度焊接法线
   */
  function optimizeGeometry(
    geometry: THREE.BufferGeometry,
    options: { maxEdge?: number; subdivisions?: number; creaseAngle?: number } = {}
  ): THREE.BufferGeometry {
    const {
      maxEdge: optMaxEdge = 0.06,
      subdivisions: optSub = 1,
      creaseAngle: optCrease = 50,
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
    } catch (e) {
      console.warn('[JadeV2] 几何优化失败，使用原始几何:', e);
    }
    return geo;
  }

  /**
   * 简化版 Loop 细分：将每个三角形分为 4 个三角形
   */
  function loopSubdivide(geometry: THREE.BufferGeometry, iterations: number): THREE.BufferGeometry {
    if (iterations <= 0) return geometry;
    let geo = geometry;
    for (let i = 0; i < iterations; i++) {
      const positions = geo.attributes.position.array as ArrayLike<number>;
      const triangleCount = positions.length / 9;
      const newPositions: number[] = [];
      for (let t = 0; t < triangleCount; t++) {
        const o = t * 9;
        const v0 = new THREE.Vector3(positions[o], positions[o + 1], positions[o + 2]);
        const v1 = new THREE.Vector3(positions[o + 3], positions[o + 4], positions[o + 5]);
        const v2 = new THREE.Vector3(positions[o + 6], positions[o + 7], positions[o + 8]);
        const m01 = new THREE.Vector3().lerpVectors(v0, v1, 0.5);
        const m12 = new THREE.Vector3().lerpVectors(v1, v2, 0.5);
        const m20 = new THREE.Vector3().lerpVectors(v2, v0, 0.5);
        // 中心小三角
        newPositions.push(m01.x, m01.y, m01.z, m12.x, m12.y, m12.z, m20.x, m20.y, m20.z);
        // 其余三角
        newPositions.push(v0.x, v0.y, v0.z, m01.x, m01.y, m01.z, m20.x, m20.y, m20.z);
        newPositions.push(v1.x, v1.y, v1.z, m12.x, m12.y, m12.z, m01.x, m01.y, m01.z);
        newPositions.push(v2.x, v2.y, v2.z, m20.x, m20.y, m20.z, m12.x, m12.y, m12.z);
      }
      const newGeo = new THREE.BufferGeometry();
      newGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
      geo = newGeo;
    }
    return geo;
  }

  // 加载几何体（自动识别 OBJ 或 GLTF/GLB）
  useEffect(() => {
    let disposed = false;
    // 支持 blob: URL，通过 hash 附带扩展名（如 blob:...#obj / #glb / #gltf）
    const lower = modelPath.toLowerCase();
    const hashExt = lower.includes('#') ? lower.split('#').pop() || '' : '';
    const ext = hashExt || (lower.endsWith('.obj') ? 'obj' : lower.endsWith('.glb') ? 'glb' : lower.endsWith('.gltf') ? 'gltf' : '');
    const isOBJ = ext === 'obj';
    if (isOBJ) {
      const loader = new OBJLoader();
      try {
        loader.load(
          encodeURI(modelPath),
          (obj) => {
            if (disposed) return;
            try {
              let found: THREE.BufferGeometry | null = null;
              obj.traverse((child) => {
                if (!found && (child as THREE.Mesh).isMesh) {
                  found = (child as THREE.Mesh).geometry as THREE.BufferGeometry;
                }
              });
              if (!found) {
                setError('未在 OBJ 中找到网格');
                return;
              }
              let cloned = found.clone();
              try { cloned.center(); } catch {}
              // 应用几何优化（与 Jade.tsx 一致）
              cloned = optimizeGeometry(cloned, { maxEdge, subdivisions, creaseAngle });
              cloned.computeBoundingBox();
              const bbox = cloned.boundingBox;
              if (bbox) {
                const size = new THREE.Vector3();
                bbox.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z);
                const desired = 2;
                const fitScale = desired / Math.max(0.0001, maxDim);
                cloned.scale(fitScale, fitScale, fitScale);
              }
              setGeometry(cloned);
            } catch (e) {
              console.error('[JadeV2] 解析 OBJ 失败:', e);
              setError('解析 OBJ 失败');
            }
          },
          undefined,
          (err) => {
            const url = (err && (err as any).target && (err as any).target.responseURL) || modelPath;
            console.error('[JadeV2] 加载 OBJ 出错, url =', url, 'error =', err);
            try { setGeometry(new THREE.SphereGeometry(0.8, 48, 48)); } catch {}
            setError('加载模型失败');
          }
        );
      } catch (e) {
        console.error('[JadeV2] OBJLoader 异常:', e);
        setError('OBJLoader 异常');
      }
    } else {
      const loader = new GLTFLoader();
      try {
        loader.load(
          encodeURI(modelPath),
          (gltf) => {
            if (disposed) return;
            try {
              let targetMesh: THREE.Mesh | undefined;
              gltf.scene.traverse((obj) => {
                if (!targetMesh && (obj as THREE.Mesh).isMesh) {
                  const m = obj as THREE.Mesh;
                  if ((m.name || '').toLowerCase() === 'dragon') {
                    targetMesh = m;
                  } else if (!targetMesh) {
                    targetMesh = m;
                  }
                }
              });
              if (!targetMesh) {
                setError('未在 GLTF 中找到可用网格');
                return;
              }
              let cloned = (targetMesh.geometry as THREE.BufferGeometry).clone();
              try { cloned.center(); } catch {}
              cloned = optimizeGeometry(cloned, { maxEdge, subdivisions, creaseAngle });
              cloned.computeBoundingBox();
              const bbox = cloned.boundingBox;
              if (bbox) {
                const size = new THREE.Vector3();
                bbox.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z);
                const desired = 2;
                const fitScale = desired / Math.max(0.0001, maxDim);
                cloned.scale(fitScale, fitScale, fitScale);
              }
              setGeometry(cloned);
            } catch (e) {
              console.error('[JadeV2] 解析 GLTF 失败:', e);
              setError('解析 GLTF 失败');
            }
          },
          undefined,
          (err) => {
            const url = (err && (err as any).target && (err as any).target.responseURL) || modelPath;
            console.error('[JadeV2] 加载 GLTF 出错, url =', url, 'error =', err);
            try { setGeometry(new THREE.SphereGeometry(0.8, 48, 48)); } catch {}
            setError('加载模型失败');
          }
        );
      } catch (e) {
        console.error('[JadeV2] GLTFLoader 异常:', e);
        setError('GLTFLoader 异常');
      }
    }
    return () => {
      disposed = true;
    };
  }, [modelPath, maxEdge, subdivisions, creaseAngle]);

  // 加载 HDR 环境贴图：PMREM（IBL）+ equirect（可见背景）
  useEffect(() => {
    let disposed = false;
    const rgbe = new RGBELoader();
    try {
      rgbe.load(
        hdrPath,
        (texture) => {
          if (disposed) return;
          try {
            // 使用 PMREM 生成预滤波环境贴图
            const pmrem = new THREE.PMREMGenerator(gl);
            pmrem.compileEquirectangularShader();
            const envRT = pmrem.fromEquirectangular(texture);
            const envTex = envRT.texture;
            // 背景使用 backgroundHdrPath（若提供）；否则用 hdrPath 同一张
            const bgLoader = new RGBELoader();
            const useBg = backgroundHdrPath || hdrPath;
            bgLoader.load(useBg, (bg) => {
              if (disposed) return;
              try {
                bg.mapping = THREE.EquirectangularReflectionMapping;
                setEnvBackground(bg);
              } catch {}
            });
            // 释放生成器
            pmrem.dispose();

            // 设置最终 envMap
            setEnvMap(envTex);
            try {
              // 将 PMREM 结果作为全局环境，供传输/IBL 采样
              scene.environment = envTex;
              if (!showBackground) scene.background = null; // 背景保持隐藏
            } catch {}
            console.log('[JadeV2] ✅ HDRI → PMREM 成功', {
              path: hdrPath,
              width: (envTex as any).image?.width,
              height: (envTex as any).image?.height,
            });
          } catch (e) {
            console.error('[JadeV2] HDRI PMREM 失败:', e);
            setError('HDRI PMREM 失败');
            setLoading(false);
          }
        },
        undefined,
        (err) => {
          console.error('[JadeV2] 加载 HDR 出错:', err);
          setError('加载 HDR 失败');
          setLoading(false);
        }
      );
    } catch (e) {
      console.error('[JadeV2] RGBELoader 异常:', e);
      setError('RGBELoader 异常');
      setLoading(false);
    }
    return () => {
      disposed = true;
    };
  }, [hdrPath, gl, scene, showBackground]);

  // 策略：根据 showBackground 控制 scene.background
  // - showBackground=true: scene.background = HDRI（直接显示）
  // - showBackground=false: scene.background = null（透明，显示外部 CSS 背景，但 transmission 无法采样 HDRI）
  // 注意：这意味着在外部背景模式下，transmission 无法正确工作（会采样到外部背景）
  // 如需解耦，必须使用 Dual Refraction (SSR)
  useEffect(() => {
    if (!envBackground) return;
    try {
      if (showBackground) {
        scene.background = envBackground;
        console.log('[JadeV2] scene.background = HDRI (visible)');
      } else {
        scene.background = null;
        console.log('[JadeV2] scene.background = null (transparent, showing CSS background)');
      }
    } catch (e) {
      console.warn('[JadeV2] 设置 scene.background 失败:', e);
    }
    return () => {
      try { 
        if (scene.background === envBackground) {
          scene.background = null; 
        }
      } catch {}
    };
  }, [envBackground, scene, showBackground]);

  // 加载法线贴图
  useEffect(() => {
    let disposed = false;
    const textureLoader = new THREE.TextureLoader();
    try {
      textureLoader.load(
        normalMapPath,
        (texture) => {
          if (disposed) return;
          try {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(normalRepeat, normalRepeat);
            setNormalMap(texture);
          } catch (e) {
            console.error('[JadeV2] 处理法线贴图失败:', e);
            setError('法线贴图处理失败');
            setLoading(false);
          }
        },
        undefined,
        (err) => {
          console.error('[JadeV2] 加载法线贴图出错:', err);
          // 法线贴图非强依赖，不作为致命错误
        }
      );
    } catch (e) {
      console.error('[JadeV2] TextureLoader 异常:', e);
      setError('TextureLoader 异常');
      setLoading(false);
    }
    return () => {
      disposed = true;
    };
  }, [normalMapPath, normalRepeat]);

  // 加载背景纹理（用于参考中的背景平面）。若资源缺失不影响主渲染
  useEffect(() => {
    if (!showBackground) return; // 默认不加载背景
    let disposed = false;
    const loader = new THREE.TextureLoader();
    try {
      loader.load(
        backgroundTexturePath,
        (tex) => {
          if (disposed) return;
          try {
            setBgTexture(tex);
          } catch (e) {
            console.error('[JadeV2] 设置背景纹理失败:', e);
          }
        },
        undefined,
        (err) => {
          console.warn('[JadeV2] 背景纹理加载失败(非致命):', err);
        }
      );
    } catch (e) {
      console.warn('[JadeV2] 背景纹理加载器异常(非致命):', e);
    }
    return () => {
      disposed = true;
    };
  }, [backgroundTexturePath, showBackground]);

  // 创建材质（不包含任何内部衰减 C 方案）
  const material = useMemo(() => {
    // 单方案：仅使用静态 HDR envMap（不使用动态 PMREM 链路）
    const finalEnvMap = envMap;
    if (!finalEnvMap) return null;
    try {
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color as any),
        metalness,
        roughness,
        transmission,
        ior,
        reflectivity,
        thickness,
        envMap: finalEnvMap,
        envMapIntensity,
        clearcoat,
        clearcoatRoughness,
        normalScale: normalMap ? new THREE.Vector2(normalScale, normalScale) : undefined,
        normalMap: normalMap || undefined,
        clearcoatNormalMap: normalMap || undefined,
        clearcoatNormalScale: normalMap ? new THREE.Vector2(clearcoatNormalScale, clearcoatNormalScale) : undefined,
      });
      try {
        console.log('[JadeV2] material created:', {
          hasEnvMap: !!finalEnvMap,
          envMapIntensity,
          color,
          roughness,
          transmission,
        });
      } catch {}
      // 注入环境方向旋转（兼容不支持 envMapRotation 的 three 版本）
      const yawUniformName = 'uEnvYaw';
      mat.onBeforeCompile = (shader) => {
        shader.uniforms[yawUniformName] = { value: 0 };
        // 保存引用以便 useFrame 更新
        (mat as any).__envYawUniform = shader.uniforms[yawUniformName];
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\nuniform float ${yawUniformName};\nmat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.0,-s, 0.0,1.0,0.0, s,0.0,c); }`)
          .replace(/reflect\( -vViewPosition, normal \)/g, `rotY(${yawUniformName}) * reflect( -vViewPosition, normal )`)
          .replace(/reflect\( -vViewPosition, clearcoatNormal \)/g, `rotY(${yawUniformName}) * reflect( -vViewPosition, clearcoatNormal )`);
      };
      return mat;
    } catch (e) {
      console.error('[JadeV2] 创建材质失败:', e);
      return null;
    }
  }, [
    envMap,
    normalMap,
    color,
    metalness,
    roughness,
    transmission,
    ior,
    reflectivity,
    thickness,
    envMapIntensity,
    clearcoat,
    clearcoatRoughness,
    normalScale,
    clearcoatNormalScale,
  ]);

  // 屏幕空间折射材质（可选）
  const ssrMaterial = useMemo(() => {
    const refractionMap = refractionTexture || internalRefractionTex;
    if (!useDualPassRefraction) {
      console.log('[JadeV2] useDualPassRefraction=false，不创建 SSR 材质');
      return null;
    }
    if (!refractionMap) {
      console.warn('[JadeV2] ⚠️ 未提供 refractionMap，等待 OffscreenHDRIRT 完成...');
      return null;
    }
    try {
      console.log('[JadeV2] ✅ 创建 SSR 材质，refractionMap:', refractionMap);
      // 使用实际绘制分辨率（包含 DPR），否则 UV 采样会错位
      // 若提供了 RT 尺寸信息，优先使用它；否则退回到绘制缓冲区尺寸
      const res = gl.getDrawingBufferSize(new THREE.Vector2());
      const texWidth = (refractionMap as any).image?.width || res.x;
      const texHeight = (refractionMap as any).image?.height || res.y;
      console.log(`[JadeV2] RT 分辨率: ${texWidth}x${texHeight}, 画布: ${res.x}x${res.y}`);
      
      const mat = createScreenSpaceRefractionMaterial({
        refractionMap: refractionMap,
        ior,
        refractionStrength: 1.0,
        thickness,
        roughness, // 传入 roughness，用于控制模糊
        normalMap: normalMap ?? undefined,
        normalScale,
        useEdgeFade,
        renderResolution: { x: texWidth, y: texHeight },
      });
      // 关闭 debug 模式，启用正常折射
      (mat.uniforms as any).uDebugMode.value = 0;
      // 减小偏移强度，避免采样越界
      (mat.uniforms as any).uOffsetBoost.value = 1.0; // 从 3.0 降到 1.0
      
      // 验证 uniform 是否正确设置
      console.log('[JadeV2] SSR 材质 uniforms 检查:', {
        hasRefractionMap: (mat.uniforms as any).uHasRefractionMap.value,
        refractionMapUUID: refractionMap.uuid,
        ior: (mat.uniforms as any).uIOR.value,
        thickness: (mat.uniforms as any).uThickness.value,
        offsetBoost: (mat.uniforms as any).uOffsetBoost.value,
      });
      
      console.log('[JadeV2] SSR 材质创建成功，正常折射已启用');
      return mat;
    } catch (e) {
      console.error('[JadeV2] 创建屏幕空间折射材质失败:', e);
      return null;
    }
  }, [useDualPassRefraction, refractionTexture, internalRefractionTex, ior, thickness, normalMap, normalScale, useEdgeFade, gl]);

  // 单方案：不再维护动态 envMap 状态

  // 当画布尺寸变化时，更新折射材质的分辨率（避免刷新不及时）
  useEffect(() => {
    if (ssrMaterial) {
      const auto = gl.getDrawingBufferSize(new THREE.Vector2());
      const w = (refractionTexture as any)?.image?.width || auto.x;
      const h = (refractionTexture as any)?.image?.height || auto.y;
      (ssrMaterial.uniforms as any).uRenderResolution.value.set(w, h);
      // 若贴图后到，确保 hasMap 置 1
      (ssrMaterial.uniforms as any).uRefractionMap.value = refractionTexture;
      (ssrMaterial.uniforms as any).uHasRefractionMap.value = refractionTexture ? 1 : 0;
    }
  }, [gl, viewport.width, viewport.height, ssrMaterial, refractionTexture]);

  // 更新法线贴图重复
  useEffect(() => {
    if (normalMap) {
      try {
        normalMap.repeat.set(normalRepeat, normalRepeat);
        normalMap.needsUpdate = true;
      } catch (e) {
        console.error('[JadeV2] 更新法线贴图重复失败:', e);
      }
    }
  }, [normalMap, normalRepeat]);

  // 自转 + 背景切换控制
  useFrame((_, delta) => {
    // 如果显式传入 envYaw，则以外部值为准
    if (typeof envYaw === 'number') {
      if (material && (material as any).__envYawUniform) {
        (material as any).__envYawUniform.value = envYaw;
      }
      return;
    }
    if (autoRotate) {
      if (groupRef.current) {
        groupRef.current.rotation.y += delta * 0.3;
      }
      if (material && (material as any).__envYawUniform) {
        (material as any).__envYawUniform.value += delta * 0.15;
      }
    }
  });


  // 统一控制 loading：当且仅当 geometry 和 envMap 准备好时结束 loading
  useEffect(() => {
    if (geometry && envMap) {
      setLoading(false);
    }
  }, [geometry, envMap]);

  if (loading) {
    return (
      <group>
        <mesh>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshBasicMaterial color="#666666" wireframe />
        </mesh>
      </group>
    );
  }

  if (error || !geometry || !material) {
    console.error('[JadeV2] 渲染失败:', error);
    return (
      <group>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#ff0000" wireframe />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      {/* 单方案：不在内部创建折射 RT；如需屏幕空间折射，外部显式传入 refractionTexture */}
      {/* 单方案：移除内嵌动态环境贴图 */}
      {/* 背景平面，模拟参考中的 texture.jpg 背景 */}
      {/* 背景显隐逻辑已转到 useEffect 中，这里不再渲染任何背景实体 */}

      {/* 主对象 */}
      <group ref={groupRef} position={[0, 0, 0]} scale={scale}>
        <mesh 
          ref={meshRef} 
          geometry={geometry} 
          material={useDualPassRefraction && ssrMaterial ? ssrMaterial : material}
        />
      </group>
    </group>
  );
}


