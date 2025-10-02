'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export interface OffscreenHDRIRTProps {
  hdrPath: string;                       // equirect HDR 路径
  rtScale?: 0.5 | 0.75 | 1.0;            // RT 缩放，默认 1.0（与画布同分辨率）
  maxDpr?: number;                       // DPR 上限
  yawSpeed?: number;                     // 旋转速度（rad/s），默认 0.15
  updateEveryFrame?: boolean;            // 是否每帧更新；默认 true
  debugView?: boolean;                   // 是否显示 RT 贴图
  onReady?: (tex: THREE.Texture, info: { width: number; height: number }) => void;// 输出 RT 纹理与尺寸
}

/**
 * OffscreenHDRIRT
 * - 将一张 equirect HDRI 以全屏方式绘制到离屏 RT，作为折射采样图
 * - 可选缓慢绕 Y 轴旋转，不影响 scene.background 的显隐
 */
export default function OffscreenHDRIRT({
  hdrPath,
  rtScale = 1.0,
  maxDpr = 2,
  yawSpeed = 0.15,
  updateEveryFrame = true,
  debugView = false,
  onReady,
}: OffscreenHDRIRTProps){
  const { gl, size } = useThree();

  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.OrthographicCamera>();
  const quadRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>>();
  const [rt, setRt] = useState<THREE.WebGLRenderTarget | null>(null);
  const [hdrTex, setHdrTex] = useState<THREE.Texture | null>(null);

  // 加载 HDR（作为普通 2D 采样使用）
  useEffect(() => {
    let disposed = false;
    const loader = new RGBELoader();
    loader.load(
      hdrPath,
      (tex) => {
        if (disposed) return;
        try {
          (tex as any).colorSpace = THREE.LinearSRGBColorSpace;
          setHdrTex(tex);
        } catch (e) {
          console.error('[OffscreenHDRIRT] HDRI 处理失败:', e);
        }
      },
      undefined,
      (err) => console.error('[OffscreenHDRIRT] HDRI 加载失败:', err)
    );
    return () => { disposed = true; };
  }, [hdrPath]);

  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // 初始化离屏场景
  useEffect(() => {
    sceneRef.current = new THREE.Scene();
    cameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    const geo = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    materialRef.current = quad.material as THREE.MeshBasicMaterial;
    quadRef.current = quad as any;
    sceneRef.current.add(quad);
    return () => { geo.dispose(); materialRef.current?.dispose(); sceneRef.current?.clear(); };
  }, []);

  // 重建 RT（随画布变化）
  useEffect(() => {
    const dpr = Math.min(maxDpr, typeof window !== 'undefined' ? window.devicePixelRatio : 1);
    const w = Math.max(1, Math.floor(size.width * dpr * rtScale));
    const h = Math.max(1, Math.floor(size.height * dpr * rtScale));
    const newRt = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    (newRt.texture as any).colorSpace = THREE.LinearSRGBColorSpace;
    rt?.dispose();
    setRt(newRt);
    onReady?.(newRt.texture, { width: w, height: h });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, rtScale, maxDpr]);

  // 将 HDR 贴图赋值到材质 uniform
  useEffect(() => {
    if (!hdrTex || !materialRef.current) return;
    try {
      hdrTex.wrapS = THREE.RepeatWrapping;
      hdrTex.wrapT = THREE.ClampToEdgeWrapping;
      hdrTex.needsUpdate = true;
      materialRef.current.map = hdrTex as any;
      materialRef.current.needsUpdate = true;
    } catch (e) { console.error('[OffscreenHDRIRT] 贴图赋值失败:', e); }
  }, [hdrTex]);

  // 渲染到 RT
  useFrame((_, delta) => {
    if (!rt || !sceneRef.current || !cameraRef.current) return;
    if (updateEveryFrame && materialRef.current?.map) {
      const d = (yawSpeed / (2*Math.PI)) * delta; // 把弧度换算成 [0,1] 周期
      materialRef.current.map.offset.x = (materialRef.current.map.offset.x + d) % 1;
    }
    const prev = (gl as any).outputColorSpace;
    (gl as any).outputColorSpace = THREE.LinearSRGBColorSpace;
    gl.setRenderTarget(rt);
    gl.clearColor();
    gl.render(sceneRef.current, cameraRef.current);
    gl.setRenderTarget(null);
    (gl as any).outputColorSpace = prev;
  });

  if (debugView && rt) {
    return (
      <mesh position={[0, 0, -3]} renderOrder={-4} frustumCulled={false}>
        <planeGeometry args={[2, 1]}/>
        <meshBasicMaterial map={rt.texture} depthWrite={false}/>
      </mesh>
    );
  }
  return null;
}


