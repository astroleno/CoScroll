'use client';

import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo, useState } from 'react';
import OffscreenHDRIRT from '@/components/backgrounds/OffscreenHDRIRT';

const JadeV2 = dynamic(() => import('@/components/jade/JadeV2'), { ssr: false });

export default function Page() {
  const [enableRotation, setEnableRotation] = useState(false);
  const [showBackground, setShowBackground] = useState(false);
  const [useDualPassRefraction, setUseDualPassRefraction] = useState(false);
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

  return (
    <div style={{ width: '100%', height: '100vh', background: '#1f1e1c' }}>
      {/* 简易控制条，复刻参考中的 GUI 关键参数 */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 8, color: '#fff', fontSize: 12, minWidth: 260 }}>
        <div style={{ marginBottom: 6, display: 'flex', gap: 16, alignItems: 'center' }}>
          <label>Enable Rotation </label>
          <input type="checkbox" checked={enableRotation} onChange={(e) => setEnableRotation(e.target.checked)} />
          <label>Show Background </label>
          <input type="checkbox" checked={showBackground} onChange={(e) => setShowBackground(e.target.checked)} />
          <label>Dual Refraction </label>
          <input type="checkbox" checked={useDualPassRefraction} onChange={(e) => setUseDualPassRefraction(e.target.checked)} />
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
        <color attach="background" args={[0x1f1e1c]} />
        <Suspense fallback={null}>
          {/* 外部提供“隐藏 HDRI RT”作为折射图源；不显示在屏幕 */}
          {useDualPassRefraction && (
            <OffscreenHDRIRT
              hdrPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
              rtScale={1.0}
              yawSpeed={0.15}
              updateEveryFrame={true}
              debugView={false}
              onReady={(tex, info) => { setRefractionTexture(tex); setRtInfo(info); }}
            />
          )}
          <JadeV2
            modelPath="/models/10k_obj/001_空.obj"
            hdrPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
            normalMapPath="/textures/normal.jpg"
            showBackground={showBackground}
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
        </Suspense>
      </Canvas>
    </div>
  );
}


