'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BACKGROUND_B_FRAGMENT } from '../backgrounds/BackgroundBShader';
import { useFrame, useThree } from '@react-three/fiber';

export interface CameraParams {
  fov: number;
  near: number;
  far: number;
}

export interface ViewportInfo {
  width: number;  // CSS 像素
  height: number; // CSS 像素
  dpr: number;    // 设备像素比（将受 maxDpr 限制）
}

export interface ColorPipelineConfig {
  outputEncoding?: THREE.TextureEncoding; // 与 renderer.outputEncoding 对齐（老版 three）
  toneMapping?: THREE.ToneMapping;
  exposure?: number;
}

export type UpdateRate = 'every-frame' | 'half' | { seconds: number };

export interface OffscreenMochiBackgroundProps {
  cameraParams: CameraParams;
  viewport: ViewportInfo;
  colorPipeline?: ColorPipelineConfig;

  rtScale?: 0.5 | 0.75 | 1.0;          // RT 尺寸缩放，默认 0.75
  maxDpr?: number;                      // DPR 上限，默认 2
  updateRate?: UpdateRate;              // 更新频率，默认 { seconds: 1 }
  debugView?: boolean;                  // 是否在屏幕显示调试贴图

  onReady?: (texture: THREE.Texture) => void; // 输出 RT 纹理（供折射采样）
  onInfo?: (info: { width: number; height: number; dpr: number }) => void;
}

/**
 * OffscreenMochiBackground
 * - 将一个简单的屏幕空间着色器渲染到 WebGLRenderTarget
 * - 暂作占位：后续可替换为 ref/MochiBackground/mochi.ts 的 GLSL
 * - 暴露 renderTarget.texture 供屏幕空间折射材质采样
 */
export default function OffscreenMochiBackground({
  cameraParams,
  viewport,
  colorPipeline,
  rtScale = 0.75,
  maxDpr = 2,
  updateRate = { seconds: 1 },
  debugView = false,
  onReady,
  onInfo,
}: OffscreenMochiBackgroundProps) {
  const { gl } = useThree();

  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.OrthographicCamera>();
  const quadRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>>();
  const [rt, setRt] = useState<THREE.WebGLRenderTarget | null>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uNoiseScale: { value: 1.25 },
    uSpeed: { value: 0.18 },
  }), []);

  const material = useMemo(() => {
    // 使用项目内拷贝的 mochi 背景（精简版片元）
    const frag = BACKGROUND_B_FRAGMENT;
    const vert = `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;
    const m = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vert,
      fragmentShader: frag,
    });
    return m;
  }, [uniforms]);

  // 初始化离屏场景与相机
  useEffect(() => {
    sceneRef.current = new THREE.Scene();
    cameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, cameraParams.near, cameraParams.far);
    const geo = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geo, material);
    quadRef.current = quad as any;
    sceneRef.current.add(quad);
    return () => {
      geo.dispose();
      material.dispose();
      if (sceneRef.current) sceneRef.current.clear();
    };
  }, [material, cameraParams.near, cameraParams.far]);

  // 重建 RenderTarget（随尺寸/DPR/rtScale 变化）
  useEffect(() => {
    try {
      const limitedDpr = Math.min(maxDpr, Math.max(1, viewport.dpr || 1));
      const w = Math.max(1, Math.floor(viewport.width * limitedDpr * rtScale));
      const h = Math.max(1, Math.floor(viewport.height * limitedDpr * rtScale));

      const newRt = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: false,
        stencilBuffer: false,
      });
      if (colorPipeline?.outputEncoding !== undefined) {
        // 旧版 three：使用 outputEncoding；若为新版 colorSpace，请按项目 three 版本调整
        (newRt.texture as any).encoding = colorPipeline.outputEncoding;
      }
      uniforms.uResolution.value.set(w, h);

      if (rt) rt.dispose();
      setRt(newRt);
      onInfo?.({ width: w, height: h, dpr: limitedDpr });
      onReady?.(newRt.texture);
    } catch (e) {
      console.error('[OffscreenMochiBackground] RT 重建失败:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.width, viewport.height, viewport.dpr, rtScale, maxDpr, colorPipeline?.outputEncoding]);

  // 更新频率控制
  const shouldRenderThisFrame = (() => {
    let acc = 0; // 闭包内累积器
    return (delta: number) => {
      if (updateRate === 'every-frame') return true;
      if (updateRate === 'half') {
        acc += delta;
        if (acc >= (1 / 30)) { // 约 30fps
          acc = 0;
          return true;
        }
        return false;
      }
      const seconds = Math.max(0.05, (updateRate as any)?.seconds ?? 1);
      acc += delta;
      if (acc >= seconds) {
        acc = 0;
        return true;
      }
      return false;
    };
  })();

  // 渲染到 RT
  useFrame((_, delta) => {
    if (!rt || !sceneRef.current || !cameraRef.current) return;
    if (!shouldRenderThisFrame(delta)) return;
    try {
      uniforms.uTime.value += delta;
      const prevToneMapping = gl.toneMapping;
      const prevExposure = (gl as any).toneMappingExposure;
      if (colorPipeline?.toneMapping !== undefined) gl.toneMapping = colorPipeline.toneMapping;
      if (colorPipeline?.exposure !== undefined) (gl as any).toneMappingExposure = colorPipeline.exposure;

      gl.setRenderTarget(rt);
      gl.clearColor();
      gl.render(sceneRef.current, cameraRef.current);
      gl.setRenderTarget(null);

      // 还原 renderer 状态
      gl.toneMapping = prevToneMapping;
      (gl as any).toneMappingExposure = prevExposure;
    } catch (e) {
      console.error('[OffscreenMochiBackground] 渲染失败:', e);
    }
  });

  // 调试：在主场景显示 RT 贴图
  if (debugView && rt) {
    return (
      <mesh position={[0, 0, -1]} renderOrder={-2} frustumCulled={false}>
        <planeGeometry args={[2.4, 2.4]} />
        <meshBasicMaterial map={rt.texture} depthWrite={false} />
      </mesh>
    );
  }
  return null;
}


