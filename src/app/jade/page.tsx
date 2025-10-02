'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { Suspense, useState, useEffect } from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import Jade from '@/components/jade/Jade';

/**
 * Jade玉石质感测试页面
 * 使用MeshPhysicalMaterial（Three.js内置）
 * 简单、稳定、效果好
 */

export default function JadePage() {
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

  // 玉石材质配置（玉绿主色系，明度对比30%）
  const [config, setConfig] = useState({
    // 基础参数
    color: '#65B39A',                   // 玉绿主色（调暗以达到30%对比度）
    transmission: 1,
    thickness: 5,
    ior: 1.5,                           // 折射率（玉石典型值）
    roughness: 0.76,                    // 用户指定：表面光滑度
    metalness: 0,                       // 非金属
    reflectivity: 0.42,                 // 反射率

    // 衰减参数（玉石内透效果）
    attenuationColor: '#ffffff',        // 内透色：白色
    attenuationDistance: 0.8,

    // Clearcoat（表面光泽）
    clearcoat: 0.70,                    // 用户指定
    clearcoatRoughness: 0.78,           // 用户指定

    // 法线贴图
    normalScale: 0.86,
    clearcoatNormalScale: 1.34,
    normalRepeat: 3,

    // 环境贴图
    envMapIntensity: 0.4,               // 降低环境反射（柔和studio效果）

    // 几何体优化（用户指定值优先，方案A+B）
    maxEdge: 0.15,                      // 用户指定：0.150（方案A建议0.04-0.08）
    subdivisions: 0,                    // 用户指定：0（0=关闭，1=开启）
    creaseAngle: 30,                    // 用户指定：30度（保留尖角）
  });

  // Bloom后处理配置
  const [bloomConfig, setBloomConfig] = useState({
    threshold: 0.85,
    strength: 0.63,
    radius: 0.31,
  });

  // 颜色预设
  const colorPresets = {
    '翠玉 (Green)': {
      color: '#6fa86f',
      ior: 1.5,
    },
    '白玉 (White)': {
      color: '#f0e8d8',
      ior: 1.55,
    },
    '紫玉 (Purple)': {
      color: '#b88fb8',
      ior: 1.52,
    },
    '黄玉 (Yellow)': {
      color: '#d8c878',
      ior: 1.53,
    },
    '墨玉 (Black)': {
      color: '#3a3a3a',
      ior: 1.6,
    },
    '红玉 (Red)': {
      color: '#d88878',
      ior: 1.54,
    },
  };

  const [currentPreset, setCurrentPreset] = useState('翠玉 (Green)');

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
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, #F3F0DF, #E6E1CF)' }}>
        <Canvas
          style={{ width: '100%', height: '100%', display: 'block' }}
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{
            alpha: true,
            antialias: true,
          }}
        >
          <color attach="background" args={['#EDE9D7']} />

          {/* 灯光系统：顶侧主光 + 背缘光 */}
          <ambientLight intensity={0.5} />

          {/* 顶侧主光：形成主要面的层次 */}
          <directionalLight
            position={[3, 5, 4]}
            intensity={1.8}
            color="#FFFFFF"
            castShadow
          />

          {/* 背缘光：突出边缘轮廓 */}
          <directionalLight
            position={[-2, 1, -4]}
            intensity={1.2}
            color="#F5F2E8"
          />
          <pointLight
            position={[0, -2, -3]}
            intensity={0.8}
            color="#E8E5D8"
          />

          {/* 补光：柔和环境反射 */}
          <pointLight
            position={[2, 0, 2]}
            intensity={0.4}
            color="#FFFFFF"
          />

          {/* Jade模型 */}
          <Suspense fallback={null}>
            <Jade modelPath={objModelPath} {...config} />
          </Suspense>

          {/* 控制器 */}
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            minDistance={2}
            maxDistance={10}
          />

          {/* Bloom后处理 */}
          <EffectComposer>
            <Bloom
              luminanceThreshold={bloomConfig.threshold}
              luminanceSmoothing={0.9}
              intensity={bloomConfig.strength}
              radius={bloomConfig.radius}
            />
          </EffectComposer>

          {/* 性能监控 */}
          <Stats />
        </Canvas>
      </div>

      {/* 控制面板 */}
      <div style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 50, maxWidth: '22rem', maxHeight: '90vh', overflowY: 'auto' }} className="bg-black/90 backdrop-blur p-5 rounded-lg shadow-2xl border border-gray-700 pointer-events-auto">
        <h1 className="text-2xl font-bold mb-2 text-white">玉石质感 - Jade</h1>
        <p className="text-sm text-gray-400 mb-4">
          MeshPhysicalMaterial实现
        </p>

        {/* 技术说明 */}
        <div className="mb-4 pb-4 border-b border-gray-700">
          <p className="text-xs text-gray-400 leading-relaxed">
            <strong className="text-white">核心技术：</strong><br/>
            • Transmission（光穿透）<br/>
            • Thickness（厚度影响）<br/>
            • IOR（折射率）<br/>
            • Clearcoat（表面光泽）<br/>
            • HDR Environment Map（环境反射）
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
                    ? 'bg-emerald-600 text-white'
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
          {/* Transmission & Thickness */}
          <div className="pb-3 border-b border-gray-700">
            <h3 className="text-sm font-medium mb-3 text-white">光学特性</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">透射: {config.transmission.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(光穿透程度)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.transmission}
                  onChange={(e) => setConfig({ ...config, transmission: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">厚度: {config.thickness.toFixed(1)}</span>
                  <span className="text-gray-500 ml-2">(影响透射效果)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={config.thickness}
                  onChange={(e) => setConfig({ ...config, thickness: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">折射率: {config.ior.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(玉石1.5-1.7)</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="2.33"
                  step="0.01"
                  value={config.ior}
                  onChange={(e) => setConfig({ ...config, ior: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* 【C方案】衰减参数 */}
              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">衰减距离: {config.attenuationDistance.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(光穿透距离)</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.05"
                  value={config.attenuationDistance}
                  onChange={(e) => setConfig({ ...config, attenuationDistance: Number(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">【C方案】控制光在玉内穿透的距离</p>
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">衰减颜色</span>
                  <span className="text-gray-500 ml-2">(玉石内部色调)</span>
                </label>
                <input
                  type="color"
                  value={config.attenuationColor}
                  onChange={(e) => setConfig({ ...config, attenuationColor: e.target.value })}
                  className="w-full h-8 rounded cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">【C方案】光在玉内呈现的颜色</p>
              </div>
            </div>
          </div>

          {/* Surface */}
          <div className="pb-3 border-b border-gray-700">
            <h3 className="text-sm font-medium mb-3 text-white">表面质感</h3>

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
                  step="0.01"
                  value={config.roughness}
                  onChange={(e) => setConfig({ ...config, roughness: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">清漆: {config.clearcoat.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(表面光泽)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.clearcoat}
                  onChange={(e) => setConfig({ ...config, clearcoat: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">清漆粗糙度: {config.clearcoatRoughness.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(光泽细腻度)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.clearcoatRoughness}
                  onChange={(e) => setConfig({ ...config, clearcoatRoughness: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">法线强度: {config.normalScale.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(表面凹凸)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={config.normalScale}
                  onChange={(e) => setConfig({ ...config, normalScale: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Environment */}
          <div className="pb-3 border-b border-gray-700">
            <h3 className="text-sm font-medium mb-3 text-white">环境与反射</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">反射率: {config.reflectivity.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(镜面反射)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.reflectivity}
                  onChange={(e) => setConfig({ ...config, reflectivity: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">环境强度: {config.envMapIntensity.toFixed(1)}</span>
                  <span className="text-gray-500 ml-2">(HDR反射)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={config.envMapIntensity}
                  onChange={(e) => setConfig({ ...config, envMapIntensity: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Geometry Optimization */}
          <div className="pb-3 border-b border-gray-700">
            <h3 className="text-sm font-medium mb-3 text-white">几何体优化（方案A+B）</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">均匀化边长: {config.maxEdge.toFixed(3)}</span>
                  <span className="text-gray-500 ml-2">(切割长瘦三角形)</span>
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="0.15"
                  step="0.005"
                  value={config.maxEdge}
                  onChange={(e) => setConfig({ ...config, maxEdge: Number(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">【方案A】值越小越细致，建议0.04-0.08</p>
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">平滑细分: {config.subdivisions}</span>
                  <span className="text-gray-500 ml-2">(增加面数)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="1"
                  value={config.subdivisions}
                  onChange={(e) => setConfig({ ...config, subdivisions: Number(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">【方案A】移动端优化：最多1次（0=关闭，1=开启）</p>
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">折痕角度: {config.creaseAngle}°</span>
                  <span className="text-gray-500 ml-2">(保留尖角)</span>
                </label>
                <input
                  type="range"
                  min="30"
                  max="90"
                  step="5"
                  value={config.creaseAngle}
                  onChange={(e) => setConfig({ ...config, creaseAngle: Number(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">【方案B】50度时尖角锐利、圆弧平滑</p>
              </div>
            </div>
          </div>

          {/* Post Processing */}
          <div className="pb-3 border-b border-gray-700">
            <h3 className="text-sm font-medium mb-3 text-white">后处理效果</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">Bloom阈值: {bloomConfig.threshold.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(发光阈值)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={bloomConfig.threshold}
                  onChange={(e) => setBloomConfig({ ...bloomConfig, threshold: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">Bloom强度: {bloomConfig.strength.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(发光强度)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={bloomConfig.strength}
                  onChange={(e) => setBloomConfig({ ...bloomConfig, strength: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium text-gray-300">Bloom半径: {bloomConfig.radius.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(扩散范围)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={bloomConfig.radius}
                  onChange={(e) => setBloomConfig({ ...bloomConfig, radius: Number(e.target.value) })}
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
            <li>✓ 光线穿透（透射效果）</li>
            <li>✓ 厚度影响透光度</li>
            <li>✓ 表面清漆光泽</li>
            <li>✓ 环境HDR反射</li>
            <li>✓ 法线凹凸细节</li>
            <li>✓ 平滑无方块感</li>
            <li>✓ Bloom发光效果</li>
            <li>✓ 背景纹理衬托</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
