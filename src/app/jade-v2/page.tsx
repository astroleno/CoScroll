'use client';

import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import OffscreenHDRIRT from '@/components/backgrounds/OffscreenHDRIRT';
import { BackgroundMaskPlane } from '@/components/backgrounds/BackgroundMaskPlane';

const JadeV2 = dynamic(() => import('@/components/jade/JadeV2'), { ssr: false });

// 临时测试组件：直接显示 HDRI
function TestHDRIDisplay() {
  const [hdrTex, setHdrTex] = useState<THREE.Texture | null>(null);
  
  useEffect(() => {
    const loader = new RGBELoader();
    loader.load('/textures/qwantani_moon_noon_puresky_1k.hdr', (tex) => {
      console.log('[TestHDRI] ✅ HDRI 加载成功');
      setHdrTex(tex);
    }, undefined, (err) => {
      console.error('[TestHDRI] ❌ HDRI 加载失败:', err);
    });
  }, []);
  
  if (!hdrTex) return null;
  
  return (
    <mesh position={[-3, 2, 0]}>
      <planeGeometry args={[3, 2]} />
      <meshBasicMaterial map={hdrTex} toneMapped={false} />
    </mesh>
  );
}

export default function Page() {
  const [enableRotation, setEnableRotation] = useState(false);
  const [showBackground, setShowBackground] = useState(false);
  const [useDualPassRefraction, setUseDualPassRefraction] = useState(true);  // 开启 SSR，从 OffscreenHDRIRT 采样（解耦背景）
  const [refractionTexture, setRefractionTexture] = useState<any>(null);
  const [rtInfo, setRtInfo] = useState<{ width: number; height: number } | null>(null);
  const [options, setOptions] = useState({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.81,
    transmission: 1.0,
    ior: 1.5,
    reflectivity: 0.38,
    thickness: 1.1,
    envMapIntensity: 1.4,
    clearcoat: 0.0,
    clearcoatRoughness: 1.0,
    normalScale: 0.3,
    clearcoatNormalScale: 0.2,
    normalRepeat: 3,
  });

  // 背景遮罩平面配置
  const [backgroundMaskConfig, setBackgroundMaskConfig] = useState({
    useGradient: false,
    color: '#f5f5dc',              // 默认米色（宣纸风格）
    gradientTop: '#87CEEB',        // 天蓝色
    gradientBottom: '#F0E68C',     // 金黄色
  });

  return (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      background: '#1f1e1c', // 固定深色背景，背景由内部 BackgroundMaskPlane 提供
    }}>
      {/* 简易控制条，复刻参考中的 GUI 关键参数 */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 8, color: '#fff', fontSize: 12, minWidth: 260 }}>
        <div style={{ marginBottom: 6, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>Enable Rotation </label>
          <input type="checkbox" checked={enableRotation} onChange={(e) => setEnableRotation(e.target.checked)} />
          <label>Show HDRI </label>
          <input type="checkbox" checked={showBackground} onChange={(e) => setShowBackground(e.target.checked)} />
          <label>Dual Refraction </label>
          <input type="checkbox" checked={useDualPassRefraction} onChange={(e) => setUseDualPassRefraction(e.target.checked)} />
        </div>
        {/* 背景遮罩平面控制 */}
        <div style={{ marginBottom: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ marginBottom: 4, fontWeight: 'bold' }}>背景遮罩 (Background Mask)</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 4 }}>
            <label>使用渐变 </label>
            <input type="checkbox" checked={backgroundMaskConfig.useGradient} 
              onChange={(e) => setBackgroundMaskConfig({ ...backgroundMaskConfig, useGradient: e.target.checked })} />
          </div>
          {!backgroundMaskConfig.useGradient ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label>纯色:</label>
              <input type="color" value={backgroundMaskConfig.color} 
                onChange={(e) => setBackgroundMaskConfig({ ...backgroundMaskConfig, color: e.target.value })} />
              <span>{backgroundMaskConfig.color}</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <label>顶部:</label>
                <input type="color" value={backgroundMaskConfig.gradientTop} 
                  onChange={(e) => setBackgroundMaskConfig({ ...backgroundMaskConfig, gradientTop: e.target.value })} />
                <span>{backgroundMaskConfig.gradientTop}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label>底部:</label>
                <input type="color" value={backgroundMaskConfig.gradientBottom} 
                  onChange={(e) => setBackgroundMaskConfig({ ...backgroundMaskConfig, gradientBottom: e.target.value })} />
                <span>{backgroundMaskConfig.gradientBottom}</span>
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 110px 44px', alignItems: 'center', gap: 6 }}>
          <label>Roughness</label>
          <input type="range" min={0} max={1} step={0.01} value={options.roughness}
            onChange={(e) => setOptions({ ...options, roughness: Number(e.target.value) })} />
          <span style={{ textAlign: 'right' }}>{options.roughness.toFixed(2)}</span>

          <label>Metalness</label>
          <input type="range" min={0} max={1} step={0.01} value={options.metalness}
            onChange={(e) => setOptions({ ...options, metalness: Number(e.target.value) })} />
          <span style={{ textAlign: 'right' }}>{options.metalness.toFixed(2)}</span>

          <label>Transmission</label>
          <input type="range" min={0} max={1} step={0.01} value={options.transmission}
            onChange={(e) => setOptions({ ...options, transmission: Number(e.target.value) })} />
          <span style={{ textAlign: 'right' }}>{options.transmission.toFixed(2)}</span>

          <label>IOR</label>
          <input type="range" min={1} max={2.33} step={0.01} value={options.ior}
            onChange={(e) => setOptions({ ...options, ior: Number(e.target.value) })} />
          <span style={{ textAlign: 'right' }}>{options.ior.toFixed(2)}</span>

          <label>Reflectivity</label>
          <input type="range" min={0} max={1} step={0.01} value={options.reflectivity}
            onChange={(e) => setOptions({ ...options, reflectivity: Number(e.target.value) })} />
          <span style={{ textAlign: 'right' }}>{options.reflectivity.toFixed(2)}</span>

          <label>Thickness</label>
          <input type="range" min={0} max={5} step={0.1} value={options.thickness}
            onChange={(e) => setOptions({ ...options, thickness: Number(e.target.value) })} />
          <span style={{ textAlign: 'right' }}>{options.thickness.toFixed(2)}</span>

          <label>Env Intensity</label>
          <input type="range" min={0} max={3} step={0.1} value={options.envMapIntensity}
            onChange={(e) => setOptions({ ...options, envMapIntensity: Number(e.target.value) })} />
          <span style={{ textAlign: 'right' }}>{options.envMapIntensity.toFixed(2)}</span>

          <label>Clearcoat</label>
          <input type="range" min={0} max={1} step={0.01} value={options.clearcoat}
            onChange={(e) => setOptions({ ...options, clearcoat: Number(e.target.value) })} />
          <span style={{ textAlign: 'right' }}>{options.clearcoat.toFixed(2)}</span>

          <label>ClearcoatR</label>
          <input type="range" min={0} max={1} step={0.01} value={options.clearcoatRoughness}
            onChange={(e) => setOptions({ ...options, clearcoatRoughness: Number(e.target.value) })} />
          <span style={{ textAlign: 'right' }}>{options.clearcoatRoughness.toFixed(2)}</span>

          <label>NormalScale</label>
          <input type="range" min={0} max={5} step={0.01} value={options.normalScale}
            onChange={(e) => setOptions({ ...options, normalScale: Number(e.target.value) })} />
          <span style={{ textAlign: 'right' }}>{options.normalScale.toFixed(2)}</span>

          <label>ClearcoatNS</label>
          <input type="range" min={0} max={5} step={0.01} value={options.clearcoatNormalScale}
            onChange={(e) => setOptions({ ...options, clearcoatNormalScale: Number(e.target.value) })} />
          <span style={{ textAlign: 'right' }}>{options.clearcoatNormalScale.toFixed(2)}</span>

          <label>NormalRepeat</label>
          <input type="range" min={1} max={4} step={1} value={options.normalRepeat}
            onChange={(e) => setOptions({ ...options, normalRepeat: Number(e.target.value) })} />
          <span style={{ textAlign: 'right' }}>{options.normalRepeat}</span>
        </div>
      </div>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <Suspense fallback={null}>
          {/* 
            OffscreenHDRIRT - 隐藏的 HDRI 渲染目标
            - 渲染 HDRI 到离屏 RT，不显示在屏幕上
            - 传递给 JadeV2 作为折射图源
            - 这样可以实现：背景显示遮罩层，但折射显示 HDRI
          */}
          <OffscreenHDRIRT
            hdrPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
            rtScale={1.0}
            yawSpeed={0.15}
            updateEveryFrame={true}
            debugView={false}  // 关闭 debug，恢复正常显示
            onReady={(tex, info) => { setRefractionTexture(tex); setRtInfo(info); }}
          />
          <JadeV2
            modelPath="/models/10k_obj/001_空.obj"
            hdrPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
            normalMapPath="/textures/normal.jpg"
            showBackground={showBackground}  // 控制是否直接显示 HDRI（false 时由 onBeforeRender 临时切换）
            useDualPassRefraction={useDualPassRefraction}
            refractionTexture={refractionTexture}
            color={0xffffff}
            metalness={options.metalness}
            roughness={options.roughness}
            transmission={options.transmission}
            ior={options.ior}
            reflectivity={options.reflectivity}
            thickness={options.thickness}
            envMapIntensity={options.envMapIntensity}
            clearcoat={options.clearcoat}
            clearcoatRoughness={options.clearcoatRoughness}
            normalScale={options.normalScale}
            clearcoatNormalScale={options.clearcoatNormalScale}
            normalRepeat={options.normalRepeat}
            autoRotate={enableRotation}
          />
          {/* BackgroundMaskPlane - 提供可见背景，不影响 SSR 折射 */}
          {!showBackground && (
            <BackgroundMaskPlane
              color={backgroundMaskConfig.color}
              useGradient={backgroundMaskConfig.useGradient}
              gradientTop={backgroundMaskConfig.gradientTop}
              gradientBottom={backgroundMaskConfig.gradientBottom}
              visible={true}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}


