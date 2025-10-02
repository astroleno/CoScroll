'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { Suspense, useState, useEffect } from 'react';
import JadeMochi from '@/components/diffuse-mochi/JadeMochi';

/**
 * 玉石质感麻薯测试页面
 * 完整的Subsurface Scattering实现
 * 基于subsurface-refraction-shader
 */

export default function MochiJadePage() {
  // 全屏样式
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.style.cssText = 'margin:0;padding:0;height:100vh;overflow:hidden;';
    body.style.cssText = 'margin:0;padding:0;height:100vh;overflow:hidden;';

    const nextRoot = document.getElementById('__next');
    if (nextRoot) {
      nextRoot.style.cssText = 'height:100vh;overflow:hidden;margin:0;padding:0;';
    }

    return () => {
      root.style.cssText = '';
      body.style.cssText = '';
      if (nextRoot) {
        nextRoot.style.cssText = '';
      }
    };
  }, []);

  // 玉石配置
  const [config, setConfig] = useState({
    // Subsurface
    depth: 0.08,
    mediumColor: '#1a3a2e',       // 深绿（厚玉）
    thinMediumColor: '#7ed957',   // 透亮绿（薄玉透光）
    subsurfaceTint: '#4a7c59',    // 玉色调

    // Scattering
    mipMultiplier: 8,
    minMipLevel: 1,

    // 玉石特性
    jadeColor: '#6fa86f',         // 玉绿
    roughness: 0.3,
    translucency: 0.6,

    // 纹理
    textureScale: 2.0,
    colorBoost: 1.5,
  });

  // 颜色预设
  const colorPresets = {
    '翠玉 (Green Jade)': {
      mediumColor: '#1a3a2e',
      thinMediumColor: '#7ed957',
      subsurfaceTint: '#4a7c59',
      jadeColor: '#6fa86f',
    },
    '白玉 (White Jade)': {
      mediumColor: '#2a2a2a',
      thinMediumColor: '#e8dfd0',
      subsurfaceTint: '#9a9a8a',
      jadeColor: '#d0c8b8',
    },
    '紫玉 (Purple Jade)': {
      mediumColor: '#2e1a3a',
      thinMediumColor: '#c957ed',
      subsurfaceTint: '#7c4a9c',
      jadeColor: '#a86fcf',
    },
    '黄玉 (Yellow Jade)': {
      mediumColor: '#3a2e1a',
      thinMediumColor: '#edd957',
      subsurfaceTint: '#9c8a4a',
      jadeColor: '#cfb86f',
    },
  };

  const [currentPreset, setCurrentPreset] = useState('翠玉 (Green Jade)');

  const applyPreset = (presetName: string) => {
    const preset = colorPresets[presetName as keyof typeof colorPresets];
    if (preset) {
      setConfig({ ...config, ...preset });
      setCurrentPreset(presetName);
    }
  };

  const objModelPath = '/models/10k_obj/001_空.obj';

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* 3D场景 */}
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, #1a1a2e, #0f0f1e)' }}>
        <Canvas
          style={{ width: '100%', height: '100%', display: 'block' }}
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{
            alpha: true,
            antialias: true,
          }}
        >
          <color attach="background" args={['#16213e']} />

          {/* 光照 */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={1.0} />
          <directionalLight position={[-5, -3, -5]} intensity={0.3} color="#4a7c9c" />
          <pointLight position={[0, 3, 0]} intensity={0.5} color="#ffffff" />

          {/* 玉石模型 */}
          <Suspense fallback={null}>
            <JadeMochi modelPath={objModelPath} {...config} />
          </Suspense>

          {/* 控制器 */}
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            minDistance={2}
            maxDistance={10}
          />

          {/* 性能监控 */}
          <Stats />
        </Canvas>
      </div>

      {/* 控制面板 */}
      <div style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 50, maxWidth: '24rem', maxHeight: '90vh', overflowY: 'auto' }} className="bg-black/80 backdrop-blur p-5 rounded-lg shadow-2xl border border-gray-700 pointer-events-auto">
        <h1 className="text-xl font-bold mb-2 text-white">玉石质感 - Jade Subsurface</h1>
        <p className="text-sm text-gray-400 mb-4">
          完整Subsurface Scattering实现
        </p>

        {/* 技术说明 */}
        <div className="mb-4 pb-4 border-b border-gray-700">
          <p className="text-xs text-gray-400 leading-relaxed">
            <strong className="text-white">核心技术：</strong><br/>
            • Parallax Shift（视差偏移）<br/>
            • Normal Cubemap（法线立方体贴图）<br/>
            • Mip-level Scattering（多级散射）<br/>
            • Triplanar Projection（三平面投影）
          </p>
        </div>

        {/* 颜色预设 */}
        <div className="mb-4 pb-4 border-b border-gray-700">
          <label className="text-sm block mb-2 text-white font-medium">颜色预设：</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(colorPresets).map((presetName) => (
              <button
                key={presetName}
                onClick={() => applyPreset(presetName)}
                className={`px-3 py-2 rounded text-xs transition ${
                  currentPreset === presetName
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {presetName}
              </button>
            ))}
          </div>
        </div>

        {/* 参数调节 */}
        <div className="space-y-4">
          {/* Subsurface参数 */}
          <div className="pb-3 border-b border-gray-700">
            <h3 className="text-sm font-medium mb-3 text-white">次表面散射</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">深度: {config.depth.toFixed(3)}</span>
                  <span className="text-gray-500 ml-2">(光穿透深度)</span>
                </label>
                <input
                  type="range"
                  min="0.02"
                  max="0.15"
                  step="0.005"
                  value={config.depth}
                  onChange={(e) => setConfig({ ...config, depth: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">散射强度: {config.mipMultiplier}</span>
                  <span className="text-gray-500 ml-2">(模糊程度)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={config.mipMultiplier}
                  onChange={(e) => setConfig({ ...config, mipMultiplier: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">最小散射: {config.minMipLevel}</span>
                  <span className="text-gray-500 ml-2">(基础模糊)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={config.minMipLevel}
                  onChange={(e) => setConfig({ ...config, minMipLevel: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* 玉石特性 */}
          <div className="pb-3 border-b border-gray-700">
            <h3 className="text-sm font-medium mb-3 text-white">玉石特性</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">粗糙度: {config.roughness.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(表面光滑度)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.roughness}
                  onChange={(e) => setConfig({ ...config, roughness: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">透光性: {config.translucency.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(薄处透光)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.translucency}
                  onChange={(e) => setConfig({ ...config, translucency: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">颜色增强: {config.colorBoost.toFixed(1)}</span>
                  <span className="text-gray-500 ml-2">(亮度)</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={config.colorBoost}
                  onChange={(e) => setConfig({ ...config, colorBoost: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">纹理缩放: {config.textureScale.toFixed(1)}</span>
                  <span className="text-gray-500 ml-2">(内部纹理)</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  value={config.textureScale}
                  onChange={(e) => setConfig({ ...config, textureScale: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 效果验证 */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h3 className="text-sm font-medium mb-2 text-white">预期效果：</h3>
          <ul className="text-xs space-y-1 text-gray-400">
            <li>✓ 厚处深色实心（深玉色）</li>
            <li>✓ 薄处透光散射（亮玉色）</li>
            <li>✓ 边缘Fresnel光泽</li>
            <li>✓ 内部3D噪声纹理</li>
            <li>✓ 粗糙度控制光泽</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
