'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MOCHI_B_VERTEX, MOCHI_B_FRAGMENT } from './MochiBackgroundBShader';

export interface OffscreenMochiEnvMapProps {
  /**
   * 渲染分辨率，默认 256x128 (equirect 2:1 比例)
   * 移动端建议 128x64，桌面端 256x128 或 512x256
   */
  resolution?: { width: number; height: number };

  /**
   * 更新频率，默认每秒更新一次
   */
  updateRate?: { seconds: number };

  /**
   * 背景着色器参数（透传给 MochiBackgroundBShader）
   */
  noiseScale?: number;
  colorCycleSpeed?: number;
  bgCycleSpeed?: number;
  grainStrength?: number;
  grainScale?: number;
  // 背景缩放（影响光斑大小与分布），默认 1.0
  scale?: number;

  /**
   * 当 envMap 准备好时回调
   */
  onEnvMapReady?: (envMap: THREE.Texture) => void;

  /**
   * 当 RT 准备好时回调（用于调试）
   */
  onRTReady?: () => void;

  /**
   * 调试模式：显示低分辨率 RT 贴图
   */
  debugView?: boolean;
}

/**
 * OffscreenMochiEnvMap
 * - 将动态 Mochi 背景渲染到低分辨率 equirectangular RT
 * - 通过 PMREMGenerator 生成预滤波环境贴图
 * - 低频更新（1-2秒一次），适合作为 envMap 使用
 * - 最终效果：动态背景作为环境反射/折射，不直接可见
 */
export default function OffscreenMochiEnvMap({
  resolution = { width: 256, height: 128 },
  updateRate = { seconds: 1 },
  noiseScale = 1.25,
  colorCycleSpeed = 0.25,
  bgCycleSpeed = 0.2,
  grainStrength = 0.06,
  grainScale = 2.0,
  scale = 1.0,
  onEnvMapReady,
  onRTReady,
  debugView = false,
}: OffscreenMochiEnvMapProps) {
  const { gl } = useThree();

  // 场景引用
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const quadRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null>(null);

  // RenderTarget (equirectangular 格式)
  const [rt, setRt] = useState<THREE.WebGLRenderTarget | null>(null);

  // PMREM 生成器（用于创建预滤波环境贴图）
  const pmremRef = useRef<THREE.PMREMGenerator | null>(null);

  // 最终输出的环境贴图
  const [envMap, setEnvMap] = useState<THREE.Texture | null>(null);

  // 时间累积器（控制更新频率）
  const timeAccumulatorRef = useRef(0);

  // 着色器材质
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(resolution.width, resolution.height) },
    uNoiseScale: { value: noiseScale },
    uColorCycle: { value: colorCycleSpeed },
    uBgCycle: { value: bgCycleSpeed },
    uGrainStrength: { value: grainStrength },
    uGrainScale: { value: grainScale },
    uScale: { value: scale },
  }), []);

  // 同步外部 props 到 uniforms
  useEffect(() => { uniforms.uNoiseScale.value = noiseScale; }, [noiseScale, uniforms]);
  useEffect(() => { uniforms.uColorCycle.value = colorCycleSpeed; }, [colorCycleSpeed, uniforms]);
  useEffect(() => { uniforms.uBgCycle.value = bgCycleSpeed; }, [bgCycleSpeed, uniforms]);
  useEffect(() => { uniforms.uGrainStrength.value = grainStrength; }, [grainStrength, uniforms]);
  useEffect(() => { uniforms.uGrainScale.value = grainScale; }, [grainScale, uniforms]);
  useEffect(() => { uniforms.uScale.value = scale; }, [scale, uniforms]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    vertexShader: MOCHI_B_VERTEX,
    fragmentShader: MOCHI_B_FRAGMENT,
    depthWrite: false,
    depthTest: false,
    transparent: false,
  }), [uniforms]);

  // 初始化场景和相机
  useEffect(() => {
    try {
      // 创建正交相机（覆盖整个 equirect 空间）
      cameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2);

      // 创建场景
      sceneRef.current = new THREE.Scene();

      // 创建全屏四边形（覆盖整个 RT）
      const geo = new THREE.PlaneGeometry(2, 2);
      const quad = new THREE.Mesh(geo, material);
      quadRef.current = quad;
      sceneRef.current.add(quad);

      return () => {
        geo.dispose();
        material.dispose();
        if (sceneRef.current) sceneRef.current.clear();
      };
    } catch (e) {
      console.error('[OffscreenMochiEnvMap] 初始化失败:', e);
    }
  }, [material]);

  // 创建/更新 RenderTarget
  useEffect(() => {
    try {
      const newRt = new THREE.WebGLRenderTarget(resolution.width, resolution.height, {
        type: THREE.HalfFloatType, // HDR 格式，支持高动态范围
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
      });

      // 设置色彩空间（three r152+）：使用线性空间渲染供 PMREM 处理
      (newRt.texture as any).colorSpace = THREE.LinearSRGBColorSpace;

      if (rt) rt.dispose();
      setRt(newRt);
      uniforms.uResolution.value.set(resolution.width, resolution.height);
      if (typeof (onRTReady) === 'function') onRTReady(); // 通知 RT 已准备好

      console.log('[OffscreenMochiEnvMap] ✅ RT 创建成功', {
        width: resolution.width,
        height: resolution.height,
        type: 'HalfFloatType'
      });
    } catch (e) {
      console.error('[OffscreenMochiEnvMap] 创建 RT 失败:', e);
    }

    return () => {
      if (rt) rt.dispose();
    };
  }, [resolution.width, resolution.height, uniforms]);

  // 初始化 PMREM 生成器
  useEffect(() => {
    try {
      // 销毁旧的
      if (pmremRef.current) {
        pmremRef.current.dispose();
      }

      // 创建新的
      pmremRef.current = new THREE.PMREMGenerator(gl);
      pmremRef.current.compileEquirectangularShader();
    } catch (e) {
      console.error('[OffscreenMochiEnvMap] 初始化 PMREM 失败:', e);
    }

    return () => {
      if (pmremRef.current) {
        pmremRef.current.dispose();
      }
    };
  }, [gl]);

  // 更新循环：定时渲染到 RT 并生成 envMap
  useFrame((_, delta) => {
    if (!rt || !sceneRef.current || !cameraRef.current || !pmremRef.current) return;

    // 累积时间，控制更新频率
    timeAccumulatorRef.current += delta;
    const updateInterval = updateRate.seconds || 1;
    if (timeAccumulatorRef.current < updateInterval) return;
    timeAccumulatorRef.current = 0;

    try {
      // 1. 更新着色器时间
      uniforms.uTime.value += delta;

      // 2. 保存当前渲染器状态
      const prevOutputColorSpace = (gl as any).outputColorSpace;
      const prevToneMapping = gl.toneMapping;
      const prevToneMappingExposure = (gl as any).toneMappingExposure;

      // 3. 设置渲染器状态（与主场景一致，避免色彩偏差）
      (gl as any).outputColorSpace = THREE.LinearSRGBColorSpace; // 线性空间
      gl.toneMapping = THREE.NoToneMapping; // 避免双重 tone mapping
      (gl as any).toneMappingExposure = 1.0;

      // 4. 渲染到 RT
      gl.setRenderTarget(rt);
      gl.clearColor();
      gl.render(sceneRef.current, cameraRef.current);
      gl.setRenderTarget(null);

      // 5. 还原渲染器状态
      (gl as any).outputColorSpace = prevOutputColorSpace;
      gl.toneMapping = prevToneMapping;
      (gl as any).toneMappingExposure = prevToneMappingExposure;

      // 6. 生成预滤波环境贴图（PMREM）
      try {
        const pmremResult = pmremRef.current.fromEquirectangular(rt.texture);

        // 释放旧的 envMap
        if (envMap) {
          envMap.dispose();
        }

        // 设置新的 envMap
        const newEnvMap = pmremResult.texture;
        newEnvMap.mapping = THREE.EquirectangularReflectionMapping;
        newEnvMap.generateMipmaps = true; // 确保生成多级纹理
        newEnvMap.needsUpdate = true;

        setEnvMap(newEnvMap);

        // 通知外部
        onEnvMapReady?.(newEnvMap);

        console.log('[OffscreenMochiEnvMap] ✅ 环境贴图生成成功', {
          width: newEnvMap.image?.width,
          height: newEnvMap.image?.height,
          mapping: newEnvMap.mapping,
          mipmaps: newEnvMap.mipmaps?.length || 0,
          hasImage: !!newEnvMap.image,
          type: newEnvMap.constructor.name
        });

        // 释放临时资源（延迟一帧释放，避免纹理还在使用中）
        // 兼容不同 three 版本：有的返回 { texture, dispose }
        setTimeout(() => {
          try {
            (pmremResult as any).dispose?.();
          } catch {}
        }, 100);
      } catch (e) {
        console.error('[OffscreenMochiEnvMap] PMREM 生成失败:', e);
      }
    } catch (e) {
      console.error('[OffscreenMochiEnvMap] 更新循环失败:', e);
    }
  });

  // 调试：在屏幕上显示低分辨率 RT
  if (debugView && rt) {
    return (
      <mesh position={[0, 0, -2]} renderOrder={-3} frustumCulled={false}>
        <planeGeometry args={[1.5, 0.75]} />
        <meshBasicMaterial map={rt.texture} depthWrite={false} />
      </mesh>
    );
  }

  return null;
}
