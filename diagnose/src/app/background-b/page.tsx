'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import OffscreenMochiEnvMap from '@/components/backgrounds/OffscreenMochiEnvMap';
import MochiBackgroundB from '@/components/backgrounds/MochiBackgroundB';
import * as THREE from 'three';

// 可选：懒加载某个模型以便观察背景折射/反射（此处不涉及音频）
const JadeV2 = dynamic(() => import('@/components/jade/JadeV2'), { ssr: false });

export default function Page() {
  const [showModel, setShowModel] = useState(false);
  const [showVisibleBackground, setShowVisibleBackground] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [dynamicEnvMap, setDynamicEnvMap] = useState<THREE.Texture | null>(null);
  const [debugInfo, setDebugInfo] = useState({ envMapReady: false, rtReady: false });
  const [showDebugRT, setShowDebugRT] = useState(false);
  const [backgroundScale, setBackgroundScale] = useState(0.5); // 背景缩放比例
  const [backgroundPosition, setBackgroundPosition] = useState({ x: 0, y: 0 }); // 背景位置偏移

  // 背景参数控制
  const [bgParams, setBgParams] = useState({
    noiseScale: 1.25,
    colorCycleSpeed: 0.25,
    bgCycleSpeed: 0.2,
    grainStrength: 0.06,
    grainScale: 2.0,
  });

  // 材质参数控制（用于测试 PBR 参数是否生效）
  const [materialParams, setMaterialParams] = useState({
    roughness: 0.0,      // 极低粗糙度 = 清晰反射/折射
    metalness: 0.0,      // 非金属（金属会减少透射效果）
    transmission: 1.0,   // 最大透射度（完全透明）
    clearcoat: 0.8,      // 适中清漆层
    clearcoatRoughness: 0.05, // 清漆光滑
    envMapIntensity: 5.0, // 环境贴图强度
  });

  return (
    <div style={{ width: '100%', height: '100vh', background: '#0f0f12' }}>
      {/* 控制面板 */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 10,
        background: 'rgba(0,0,0,0.8)',
        padding: 16,
        borderRadius: 8,
        color: '#fff',
        fontSize: 12,
        maxWidth: 300,
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>场景控制</h4>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={showModel} onChange={(e) => setShowModel(e.target.checked)} />
            显示模型 (测试 PBR 材质参数)
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={showVisibleBackground} onChange={(e) => setShowVisibleBackground(e.target.checked)} />
            显示可见背景 (MochiBackgroundB 全屏)
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
            模型自动旋转
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={showDebugRT} onChange={(e) => setShowDebugRT(e.target.checked)} />
            调试：显示低分辨率纹理
          </label>
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>
                背景缩放: {backgroundScale.toFixed(2)}
              </label>
              <input
                type="range"
                min={0.1}
                max={2.0}
                step={0.01}
                value={backgroundScale}
                onChange={(e) => setBackgroundScale(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>
                背景位置X: {backgroundPosition.x.toFixed(1)}
              </label>
              <input
                type="range"
                min={-2}
                max={2}
                step={0.1}
                value={backgroundPosition.x}
                onChange={(e) => setBackgroundPosition(prev => ({ ...prev, x: parseFloat(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div style={{ marginTop: 4 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>
              背景位置Y: {backgroundPosition.y.toFixed(1)}
            </label>
            <input
              type="range"
              min={-2}
              max={2}
              step={0.1}
              value={backgroundPosition.y}
              onChange={(e) => setBackgroundPosition(prev => ({ ...prev, y: parseFloat(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>动态环境贴图参数</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {Object.entries(bgParams).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: 11, marginBottom: 4 }}>
                  {key}: {typeof value === 'number' ? value.toFixed(2) : value}
                </label>
                <input
                  type="range"
                  min={key.includes('Speed') ? 0 : key.includes('Scale') ? 0.5 : 0}
                  max={key.includes('Speed') ? 2 : key.includes('Scale') ? 4 : key.includes('Strength') ? 0.2 : 1}
                  step={0.01}
                  value={value as number}
                  onChange={(e) => setBgParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>材质参数 (测试 PBR 效果)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {Object.entries(materialParams).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: 11, marginBottom: 4 }}>
                  {key}: {typeof value === 'number' ? value.toFixed(2) : value}
                </label>
                <input
                  type="range"
                  min={key.includes('envMapIntensity') ? 0 : key.includes('metalness') || key.includes('transmission') ? 0 : key.includes('roughness') ? 0 : key.includes('clearcoat') ? 0 : 0}
                  max={key.includes('envMapIntensity') ? 10 : key.includes('metalness') || key.includes('transmission') ? 1 : key.includes('roughness') ? 1 : key.includes('clearcoat') ? 1 : 2}
                  step={0.01}
                  value={value as number}
                  onChange={(e) => setMaterialParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>
          ✅ 动态背景 → PMREM → envMap → PBR 材质<br />
          🔧 调整 roughness 清漆参数观察效果变化<br />
          <div style={{ marginTop: 4, fontSize: 10 }}>
            📊 调试信息：<br />
            • 环境贴图: {debugInfo.envMapReady ? '✅ 已就绪' : '⏳ 生成中'}<br />
            • 渲染纹理: {debugInfo.rtReady ? '✅ 已就绪' : '⏳ 生成中'}<br />
            • 动态纹理: {dynamicEnvMap ? '✅ 已连接' : '⏳ 等待中'}
          </div>
        </div>
      </div>

      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <color attach="background" args={[0x0f0f12]} />
        <Suspense fallback={null}>
          {/* 核心：动态环境贴图生成器 */}
          <OffscreenMochiEnvMap
            resolution={{ width: 256, height: 128 }}
            updateRate={{ seconds: 1 }}
            onEnvMapReady={(envMap) => {
              setDynamicEnvMap(envMap);
              setDebugInfo(prev => ({ ...prev, envMapReady: true }));
            }}
            onRTReady={() => setDebugInfo(prev => ({ ...prev, rtReady: true }))}
            debugView={false}
            {...bgParams}
          />

          {/* 调试用：显示低分辨率 RT 纹理 */}
          {showDebugRT && <mesh position={[0, 0, -3]} renderOrder={-4} frustumCulled={false}>
            <planeGeometry args={[2, 1]} />
            <meshBasicMaterial map={dynamicEnvMap} transparent opacity={0.7} />
          </mesh>}

          {/* 可选：可见的全屏背景 */}
          {showVisibleBackground && (
            <group
              scale={[backgroundScale, backgroundScale, 1]}
              position={[backgroundPosition.x, backgroundPosition.y, 0]}
            >
              <MochiBackgroundB scale={backgroundScale} />
            </group>
          )}

          {/* 主模型：使用动态 envMap，关闭屏幕空间折射 */}
          {showModel && (
            <JadeV2
              modelPath="/models/10k_obj/001_空.obj"
              hdrPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
              normalMapPath="/textures/normal.jpg"
              showBackground={false}
              useDualPassRefraction={false}  // ❌ 关闭屏幕空间折射
              dynamicEnvMap={dynamicEnvMap}  // ✅ 使用动态环境贴图
              color={0xffffff}
              metalness={0.0}      // 确保是非金属
              roughness={0.0}      // 极低粗糙度
              transmission={1.0}   // 最大透射度
              ior={1.45}          // 接近玻璃的折射率
              reflectivity={0.02} // 极低反射，最大化透射
              thickness={0.3}     // 薄厚度，更好的透射
              envMapIntensity={materialParams.envMapIntensity}
              clearcoat={materialParams.clearcoat}
              clearcoatRoughness={materialParams.clearcoatRoughness}
              normalScale={0.2}
              clearcoatNormalScale={0.2}
              normalRepeat={2}
              autoRotate={autoRotate}  // ✅ 使用自动旋转开关
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}


