'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { Suspense, useState, useEffect } from 'react';
import DiffuseMochiThickness from '@/components/diffuse-mochi/DiffuseMochiThickness';

/**
 * 厚度散射麻薯测试页面
 * 简化版subsurface scattering：基于视角估算厚度
 */

export default function MochiThicknessPage() {
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

  // 厚度散射配置
  const [config, setConfig] = useState({
    shellColor: '#e8e8e8',    // 表面颜色
    mediumColor: '#f8f5f0',   // 介质颜色（糯米白）
    baseAlpha: 0.7,
    density: 1.5,
    noiseScale: 2.0,
    scatterStrength: 0.8,     // 散射强度
    thicknessBoost: 1.5,      // 厚度增强
    fresnelPower: 3.0,
  });

  const objModelPath = '/models/10k_obj/001_空.obj';

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* 3D场景 */}
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, #e9d5ff, #bfdbfe)' }}>
        <Canvas
          style={{ width: '100%', height: '100%', display: 'block' }}
          camera={{ position: [0, 0, 4.5], fov: 45 }}
          gl={{
            alpha: true,
            premultipliedAlpha: true,
            antialias: true,
          }}
        >
          <color attach="background" args={['#d8c5e8']} />

          {/* 光照 */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <pointLight position={[-5, 3, -5]} intensity={0.5} color="#ff9999" />

          {/* 模型 */}
          <Suspense fallback={null}>
            <DiffuseMochiThickness modelPath={objModelPath} {...config} />
          </Suspense>

          {/* 控制器 */}
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            minDistance={1}
            maxDistance={10}
          />

          {/* 性能监控 */}
          <Stats />
        </Canvas>
      </div>

      {/* 控制面板 */}
      <div style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 50, maxWidth: '22rem', maxHeight: '90vh', overflowY: 'auto' }} className="bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg pointer-events-auto">
        <h1 className="text-xl font-bold mb-2">厚度散射麻薯</h1>
        <p className="text-sm text-gray-600 mb-4">
          简化版Subsurface Scattering
        </p>

        <div className="mb-4 pb-4 border-b">
          <p className="text-xs text-gray-700 leading-relaxed">
            <strong>核心原理：</strong><br/>
            • 视角估算厚度（无需额外pass）<br/>
            • 厚处：实心、细颗粒<br/>
            • 薄处：半透、散射模糊<br/>
            • 介质色：内部糯米白
          </p>
        </div>

        {/* 参数调节 */}
        <div className="space-y-3">
          <div>
            <label className="text-xs block mb-1">
              <span className="font-medium">密度: {config.density.toFixed(2)}</span>
              <span className="text-gray-500 ml-2">(整体浓度)</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={config.density}
              onChange={(e) => setConfig({ ...config, density: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-xs block mb-1">
              <span className="font-medium">散射强度: {config.scatterStrength.toFixed(2)}</span>
              <span className="text-gray-500 ml-2">(薄处模糊)</span>
            </label>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.05"
              value={config.scatterStrength}
              onChange={(e) => setConfig({ ...config, scatterStrength: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-xs block mb-1">
              <span className="font-medium">厚度增强: {config.thicknessBoost.toFixed(1)}</span>
              <span className="text-gray-500 ml-2">(厚薄对比)</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={config.thicknessBoost}
              onChange={(e) => setConfig({ ...config, thicknessBoost: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-xs block mb-1">
              <span className="font-medium">噪声尺度: {config.noiseScale.toFixed(1)}</span>
              <span className="text-gray-500 ml-2">(颗粒大小)</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              value={config.noiseScale}
              onChange={(e) => setConfig({ ...config, noiseScale: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-xs block mb-1">
              <span className="font-medium">基础透明度: {config.baseAlpha.toFixed(2)}</span>
              <span className="text-gray-500 ml-2">(整体不透明度)</span>
            </label>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={config.baseAlpha}
              onChange={(e) => setConfig({ ...config, baseAlpha: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-xs block mb-1">
              <span className="font-medium">Fresnel强度: {config.fresnelPower.toFixed(1)}</span>
              <span className="text-gray-500 ml-2">(边缘透明)</span>
            </label>
            <input
              type="range"
              min="1.5"
              max="5.0"
              step="0.1"
              value={config.fresnelPower}
              onChange={(e) => setConfig({ ...config, fresnelPower: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        {/* 验收检查 */}
        <div className="mt-4 pt-4 border-t">
          <h3 className="text-sm font-medium mb-2">效果验证：</h3>
          <ul className="text-xs space-y-1 text-gray-700">
            <li>✓ 笔画粗处更实心</li>
            <li>✓ 笔画细处半透散射</li>
            <li>✓ 重叠处自然变亮</li>
            <li>✓ 糯米颗粒质感</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
