"use client";

import JadeV4 from '@/components/jade/JadeV4';
import LyricSyncV2 from '@/components/LyricSync-v2';
import { useState } from 'react';

export default function Page() {
  const [params, setParams] = useState({
    refractionGain: 3.0,
    refractionTint: '#a5c8ff',
    refractionTintStrength: 0.2,
    refractionOffsetBoost: 6.0,
    refractionBaseMix: 0.45,
    refractionGamma: 1.2,
    thickness: 1.1,
    roughness: 0.55,
    ior: 1.5,
  });

  return (
    <div style={{ width: '100%', height: '100vh', background: '#1f1e1c', position: 'relative' }}>
      {/* 背景层：3D模型 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <JadeV4
          showBackground={true}
          enableRotation={true}
          hdrExposure={1.5}
          backgroundColor={'#101014'}
          // 可分别指定：背景与折射/IBL 环境
          backgroundHdrPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
          refractionEnvPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
          modelPath="/models/10k_obj/001_空.obj"
          normalMapPath="/textures/normal.jpg"
          debugForceReflection={false}
          useDualPassRefraction={true}
          refractionGain={params.refractionGain}
          refractionTint={params.refractionTint}
          refractionTintStrength={params.refractionTintStrength}
          refractionOffsetBoost={params.refractionOffsetBoost}
          refractionBaseMix={params.refractionBaseMix}
          refractionGamma={params.refractionGamma}
          // 透传核心参数
          ior={params.ior}
          thickness={params.thickness}
          roughness={params.roughness}
        />
      </div>

      {/* 前景层：歌词同步界面 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
        <LyricSyncV2 />
      </div>

      {/* 调参面板 */}
      <div style={{ position: 'absolute', top: 16, right: 16, width: 280, background: 'rgba(0,0,0,0.8)', padding: 12, borderRadius: 8, color: '#fff', fontSize: 12, lineHeight: 1.4, zIndex: 3, backdropFilter: 'blur(8px)' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>JadeV4 折射调参</div>
        <label>Gain: {params.refractionGain.toFixed(2)}</label>
        <input type="range" min={0.5} max={6} step={0.1} value={params.refractionGain} onChange={(e)=>setParams(p=>({...p, refractionGain: parseFloat(e.target.value)}))} style={{ width: '100%' }} />

        <label style={{ display:'block', marginTop: 8 }}>OffsetBoost: {params.refractionOffsetBoost.toFixed(1)}</label>
        <input type="range" min={0.5} max={10} step={0.1} value={params.refractionOffsetBoost} onChange={(e)=>setParams(p=>({...p, refractionOffsetBoost: parseFloat(e.target.value)}))} style={{ width: '100%' }} />

        <label style={{ display:'block', marginTop: 8 }}>Roughness: {params.roughness.toFixed(2)}</label>
        <input type="range" min={0} max={1} step={0.01} value={params.roughness} onChange={(e)=>setParams(p=>({...p, roughness: parseFloat(e.target.value)}))} style={{ width: '100%' }} />

        <label style={{ display:'block', marginTop: 8 }}>Thickness: {params.thickness.toFixed(2)}</label>
        <input type="range" min={0} max={3} step={0.05} value={params.thickness} onChange={(e)=>setParams(p=>({...p, thickness: parseFloat(e.target.value)}))} style={{ width: '100%' }} />

        <label style={{ display:'block', marginTop: 8 }}>IOR: {params.ior.toFixed(2)}</label>
        <input type="range" min={1.0} max={2.5} step={0.01} value={params.ior} onChange={(e)=>setParams(p=>({...p, ior: parseFloat(e.target.value)}))} style={{ width: '100%' }} />

        <label style={{ display:'block', marginTop: 8 }}>Tint Strength: {params.refractionTintStrength.toFixed(2)}</label>
        <input type="range" min={0} max={1} step={0.01} value={params.refractionTintStrength} onChange={(e)=>setParams(p=>({...p, refractionTintStrength: parseFloat(e.target.value)}))} style={{ width: '100%' }} />

        <label style={{ display:'block', marginTop: 8 }}>Tint</label>
        <input type="color" value={params.refractionTint} onChange={(e)=>setParams(p=>({...p, refractionTint: e.target.value}))} style={{ width: '100%' }} />

        <label style={{ display:'block', marginTop: 8 }}>BaseMix: {params.refractionBaseMix.toFixed(2)}</label>
        <input type="range" min={0} max={1} step={0.01} value={params.refractionBaseMix} onChange={(e)=>setParams(p=>({...p, refractionBaseMix: parseFloat(e.target.value)}))} style={{ width: '100%' }} />

        <label style={{ display:'block', marginTop: 8 }}>Gamma: {params.refractionGamma.toFixed(2)}</label>
        <input type="range" min={0.6} max={2.2} step={0.01} value={params.refractionGamma} onChange={(e)=>setParams(p=>({...p, refractionGamma: parseFloat(e.target.value)}))} style={{ width: '100%' }} />
      </div>
    </div>
  );
}


