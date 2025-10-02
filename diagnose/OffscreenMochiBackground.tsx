'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MOCHI_B_FRAGMENT } from './MochiBackgroundBShader';

export interface CameraParams {
  fov: number;
  near: number;
  far: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  dpr: number;
}

export interface ColorPipelineConfig {
  outputEncoding?: THREE.TextureEncoding;
  toneMapping?: THREE.ToneMapping;
  exposure?: number;
}

export type UpdateRate = 'every-frame' | 'half' | { seconds: number };

export interface OffscreenMochiBackgroundProps {
  cameraParams: CameraParams;
  viewport: ViewportInfo;
  colorPipeline?: ColorPipelineConfig;
  rtScale?: 0.5 | 0.75 | 1.0;
  maxDpr?: number;
  updateRate?: UpdateRate;
  debugView?: boolean;
  onReady?: (texture: THREE.Texture) => void;
  onInfo?: (info: { width: number; height: number; dpr: number }) => void;
}

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
    // 无音频版：仅保留片元所需的最小参数
    uNoiseScale: { value: 1.25 },
    uColorCycle: { value: 0.25 },
    uBgCycle: { value: 0.2 },
    uGrainStrength: { value: 0.06 },
    uGrainScale: { value: 2.0 },
  }), []);

  const material = useMemo(() => {
    const frag = MOCHI_B_FRAGMENT;
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

  const shouldRenderThisFrame = (() => {
    let acc = 0;
    return (delta: number) => {
      if (updateRate === 'every-frame') return true;
      if (updateRate === 'half') {
        acc += delta;
        if (acc >= (1 / 30)) { acc = 0; return true; }
        return false;
      }
      const seconds = Math.max(0.05, (updateRate as any)?.seconds ?? 1);
      acc += delta;
      if (acc >= seconds) { acc = 0; return true; }
      return false;
    };
  })();

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

      gl.toneMapping = prevToneMapping;
      (gl as any).toneMappingExposure = prevExposure;
    } catch (e) {
      console.error('[OffscreenMochiBackground] 渲染失败:', e);
    }
  });

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


