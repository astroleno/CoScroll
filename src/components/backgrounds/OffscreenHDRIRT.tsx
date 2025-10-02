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

  // 初始化离屏场景（只在组件挂载时执行一次）
  useEffect(() => {
    console.log('[OffscreenHDRIRT] 🔧 初始化离屏场景');
    sceneRef.current = new THREE.Scene();
    cameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    cameraRef.current.position.z = 1;
    
    const geo = new THREE.PlaneGeometry(2, 2);
    
    // 使用自定义 shader 直接输出 HDRI，而不是 MeshBasicMaterial
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uHDR: { value: null },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uHDR;
        varying vec2 vUv;
        void main() {
          vec3 hdr = texture2D(uHDR, vUv).rgb;
          gl_FragColor = vec4(hdr, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    
    const quad = new THREE.Mesh(geo, mat);
    materialRef.current = mat as any;
    quadRef.current = quad as any;
    sceneRef.current.add(quad);
    
    return () => { 
      console.log('[OffscreenHDRIRT] 🧹 清理离屏场景');
      geo.dispose(); 
      mat.dispose(); 
      sceneRef.current?.clear(); 
    };
  }, []); // 空依赖数组，确保只执行一次

  // 渲染完成标志（需要在组件外部定义，在 useFrame 中使用）
  const readyCalledRef = useRef(false);

  // 重建 RT（随画布变化）
  useEffect(() => {
    const dpr = Math.min(maxDpr, typeof window !== 'undefined' ? window.devicePixelRatio : 1);
    const w = Math.max(1, Math.floor(size.width * dpr * rtScale));
    const h = Math.max(1, Math.floor(size.height * dpr * rtScale));
    
    // 使用 UnsignedByteType + Linear 色彩空间
    // tone mapping 会在渲染时把 HDR 压缩到 0-1，存储为 Linear RGB
    const newRt = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType, // LDR 类型，自动 clamp
      depthBuffer: false,
      stencilBuffer: false,
    });
    (newRt.texture as any).colorSpace = THREE.LinearSRGBColorSpace; // Linear 存储，shader 直接读取
    rt?.dispose();
    setRt(newRt);
    readyCalledRef.current = false; // 重置标志，等待新的渲染完成
    console.log(`[OffscreenHDRIRT] ✅ RT 创建成功，尺寸: ${w}x${h}，类型: UnsignedByteType (LDR)`);
    // 注意：不在这里立即调用 onReady，等待 HDRI 渲染完成后再调用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, rtScale, maxDpr]);

  // 将 HDR 贴图赋值到材质 uniform
  useEffect(() => {
    if (!hdrTex || !materialRef.current || !quadRef.current) {
      console.warn('[OffscreenHDRIRT] ⚠️ 无法赋值贴图:', { hdrTex: !!hdrTex, mat: !!materialRef.current, quad: !!quadRef.current });
      return;
    }
    try {
      hdrTex.wrapS = THREE.RepeatWrapping;
      hdrTex.wrapT = THREE.ClampToEdgeWrapping;
      hdrTex.needsUpdate = true;
      
      // 关键：将 HDRI 赋值到 shader 的 uniform
      (materialRef.current as any).uniforms.uHDR.value = hdrTex;
      materialRef.current.needsUpdate = true;
      
      console.log('[OffscreenHDRIRT] ✅ HDRI 贴图已赋值到 shader uniform', {
        textureColorSpace: (hdrTex as any).colorSpace,
        uniformValue: !!(materialRef.current as any).uniforms.uHDR.value,
      });
    } catch (e) { console.error('[OffscreenHDRIRT] 贴图赋值失败:', e); }
  }, [hdrTex]);

  // 渲染到 RT + 首次渲染完成后触发 onReady
  useFrame((_, delta) => {
    if (!rt || !sceneRef.current || !cameraRef.current) return;
    
    // 确保 HDRI 贴图已加载（直接检查 hdrTex 状态，而不是 materialRef.current.map）
    if (!hdrTex || !materialRef.current) {
      return; // 静默跳过，不打印警告
    }
    
    // 更新旋转（直接操作 hdrTex，而不是 materialRef.current.map）
    if (updateEveryFrame && hdrTex) {
      const d = (yawSpeed / (2*Math.PI)) * delta; // 把弧度换算成 [0,1] 周期
      hdrTex.offset.x = (hdrTex.offset.x + d) % 1;
    }
    
    // 验证shader uniform（仅首次打印）
    if (!readyCalledRef.current) {
      console.log('[OffscreenHDRIRT] 🎬 准备渲染，检查 shader uniform:', {
        hasUniform: !!(materialRef.current as any).uniforms?.uHDR,
        uniformValue: !!(materialRef.current as any).uniforms?.uHDR?.value,
        hdrTexUUID: hdrTex.uuid,
      });
    }
    
    // 保存并设置渲染状态
    const prevOutputColorSpace = (gl as any).outputColorSpace;
    const prevToneMapping = gl.toneMapping;
    const prevExposure = gl.toneMappingExposure;
    
      // 使用 Linear 色彩空间和 ACES tone mapping
      (gl as any).outputColorSpace = THREE.LinearSRGBColorSpace; // 输出 Linear 到 RT
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.2; // 提高曝光，让折射更明亮
    
    gl.setRenderTarget(rt);
    gl.clear(true, true, true); // 清除颜色、深度、模板
    gl.render(sceneRef.current, cameraRef.current);
    gl.setRenderTarget(null);
    
    // 恢复渲染状态
    (gl as any).outputColorSpace = prevOutputColorSpace;
    gl.toneMapping = prevToneMapping;
    gl.toneMappingExposure = prevExposure;
    
    // 首次渲染完成后，触发 onReady 回调（确保 RT 已经包含了 HDRI 内容）
    if (!readyCalledRef.current && onReady) {
      readyCalledRef.current = true;
      console.log(`[OffscreenHDRIRT] ✅ 首次渲染完成，触发 onReady，尺寸: ${rt.width}x${rt.height}`);
      onReady(rt.texture, { width: rt.width, height: rt.height });
    }
  });

  if (debugView && rt) {
    console.log('[OffscreenHDRIRT] 🎨 Debug 视图已启用，显示 RT 纹理');
    return (
      <mesh position={[3, 2, 0]} renderOrder={999} frustumCulled={false}>
        <planeGeometry args={[3, 2]}/>
        {/* 启用 toneMapped 来正确显示 HDR 内容 */}
        <meshBasicMaterial map={rt.texture} depthWrite={false} depthTest={false} toneMapped={true}/>
      </mesh>
    );
  }
  return null;
}


