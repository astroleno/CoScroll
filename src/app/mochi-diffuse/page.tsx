'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { Suspense, useState, useEffect } from 'react';
import DiffuseMochiCore, {
  type DiffuseMochiConfig,
} from '@/components/diffuse-mochi/DiffuseMochiCore';
import DiffuseMochiTest from '@/components/diffuse-mochi/DiffuseMochiTest';
import DiffuseMochiSimple from '@/components/diffuse-mochi/DiffuseMochiSimple';
import DiffuseMochiGradient from '@/components/diffuse-mochi/DiffuseMochiGradient';
import DiffuseMochiOBJ from '@/components/diffuse-mochi/DiffuseMochiOBJ';

/**
 * DiffuseMochi MVP 测试页面
 * 测试：深度预pass + 2层壳体 + 3D噪声
 */

export default function MochiDiffusePage() {
  // 使用useEffect设置全屏样式，避免hydration警告
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.style.cssText = 'margin:0;padding:0;height:100vh;overflow:hidden;';
    body.style.cssText = 'margin:0;padding:0;height:100vh;overflow:hidden;';

    // 查找Next.js的根div并强制全屏
    const nextRoot = document.getElementById('__next');
    if (nextRoot) {
      nextRoot.style.cssText = 'height:100vh;overflow:hidden;margin:0;padding:0;';
    }

    return () => {
      // 清理样式
      root.style.cssText = '';
      body.style.cssText = '';
      if (nextRoot) {
        nextRoot.style.cssText = '';
      }
    };
  }, []);

  // 切换渲染模式
  const [useGradient, setUseGradient] = useState(true); // 默认使用渐变模式
  const [useOBJ, setUseOBJ] = useState(true); // 使用OBJ模型

  // 渐变模式配置（A+B：多频噪声+法线调制）
  const [gradientConfig, setGradientConfig] = useState({
    shellColor: '#d8d8d8', // 暗色，避免加法混合过曝
    baseAlpha: 0.5,        // 降低alpha（加法混合会累积）
    density: 1.4,          // 提高密度补偿alpha降低
    noiseScale: 1.5,       // 调整噪声尺度，配合多频
    noiseAmplitude: 0.35,  // 增强噪声，展示颗粒质感
    thickness: 2.0,
    falloffPower: 3.5,     // 柔和衰减
    fresnelPower: 3.8,     // 增强边缘透明
  });

  // OBJ模型路径
  const objModelPath = '/models/10k_obj/001_空.obj';

  // 可用的10k模型
  const models = [
    '/models/10k/001_空.glb',
    '/models/10k/002_心.glb',
    '/models/10k/003_道.glb',
    '/models/10k/007_明.glb',
    '/models/10k/012_无.glb',
    '/models/10k/020_死.glb',
    '/models/10k/045_苦.glb',
    '/models/10k/094_色.glb',
    '/models/10k/101_观.glb',
  ];

  const [currentModel, setCurrentModel] = useState(models[1]); // 默认"心"
  const [useTestSphere, setUseTestSphere] = useState(true); // 先用测试球体

  // 多层模式配置（保留）
  const [config, setConfig] = useState<DiffuseMochiConfig>({
    shellCount: 5,
    shellThickness: 0.15,
    shellColor: '#e8e8e8',
    baseAlpha: 0.15,
    density: 0.5,
    noiseScale: 3.0,
    noiseAmplitude: 0.5,
    alphaCurveExp: 2.5,
    fresnelPower: 3.5,
    fresnelThreshold: [0.2, 0.85],
    densityInner: 1.0,
    densityOuter: 0.2,
    colorTempInner: [1.05, 1.0, 0.98],
    colorTempOuter: [0.98, 1.0, 1.02],
  });

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* 3D场景 - 全屏背景 */}
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
            {useGradient ? (
              useOBJ ? (
                <DiffuseMochiOBJ modelPath={objModelPath} {...gradientConfig} />
              ) : (
                <DiffuseMochiGradient {...gradientConfig} />
              )
            ) : useTestSphere ? (
              <DiffuseMochiTest config={config} />
            ) : (
              <DiffuseMochiCore modelPath={currentModel} config={config} autoRotate />
            )}
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

      {/* 控制面板 - 浮动在上方 */}
      <div style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 50, maxWidth: '20rem', maxHeight: '90vh', overflowY: 'auto' }} className="bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg pointer-events-auto">
        <h1 className="text-xl font-bold mb-2">DiffuseMochi MVP</h1>
        <p className="text-sm text-gray-600 mb-4">
          深度预pass + 2层壳体 + 3D噪声
        </p>

        {/* 渲染模式切换 */}
        <div className="mb-4 pb-4 border-b space-y-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useGradient}
              onChange={(e) => setUseGradient(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">
              渐变模式（连续雾化）
            </span>
          </label>

          {useGradient && (
            <label className="flex items-center space-x-2 cursor-pointer ml-6">
              <input
                type="checkbox"
                checked={useOBJ}
                onChange={(e) => setUseOBJ(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-xs text-gray-600">
                使用OBJ书法模型（001_空）
              </span>
            </label>
          )}

          {!useGradient && (
            <label className="flex items-center space-x-2 cursor-pointer ml-6">
              <input
                type="checkbox"
                checked={useTestSphere}
                onChange={(e) => setUseTestSphere(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-xs text-gray-600">
                使用测试球体
              </span>
            </label>
          )}
        </div>

        {/* 模型选择 */}
        {!useTestSphere && (
          <div className="mb-4">
          <label className="block text-sm font-medium mb-2">选择模型：</label>
          <select
            value={currentModel}
            onChange={(e) => setCurrentModel(e.target.value)}
            className="w-full p-2 border rounded"
          >
            {models.map((model) => (
              <option key={model} value={model}>
                {model.split('/').pop()?.replace('.glb', '')}
              </option>
            ))}
          </select>
        </div>
        )}

        {/* 快速调试参数 */}
        <div className="space-y-3">
          {useGradient ? (
            <>
              {/* 渐变模式参数 */}
              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium">密度: {gradientConfig.density.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(体积浓度)</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={gradientConfig.density}
                  onChange={(e) =>
                    setGradientConfig({ ...gradientConfig, density: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium">衰减曲线: {gradientConfig.falloffPower.toFixed(1)}</span>
                  <span className="text-gray-500 ml-2">(中心到边缘)</span>
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="5.0"
                  step="0.1"
                  value={gradientConfig.falloffPower}
                  onChange={(e) =>
                    setGradientConfig({ ...gradientConfig, falloffPower: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium">噪声强度: {gradientConfig.noiseAmplitude.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(雾化扰动)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.6"
                  step="0.05"
                  value={gradientConfig.noiseAmplitude}
                  onChange={(e) =>
                    setGradientConfig({ ...gradientConfig, noiseAmplitude: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium">基础透明度: {gradientConfig.baseAlpha.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(整体不透明度)</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={gradientConfig.baseAlpha}
                  onChange={(e) =>
                    setGradientConfig({ ...gradientConfig, baseAlpha: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium">Fresnel强度: {gradientConfig.fresnelPower.toFixed(1)}</span>
                  <span className="text-gray-500 ml-2">(边缘透明)</span>
                </label>
                <input
                  type="range"
                  min="1.5"
                  max="5"
                  step="0.1"
                  value={gradientConfig.fresnelPower}
                  onChange={(e) =>
                    setGradientConfig({ ...gradientConfig, fresnelPower: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>
            </>
          ) : (
            <>
              {/* 多层模式参数 */}
              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium">层数: {config.shellCount}</span>
                  <span className="text-gray-500 ml-2">(影响体积感)</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="6"
                  step="1"
                  value={config.shellCount}
                  onChange={(e) =>
                    setConfig({ ...config, shellCount: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium">噪声强度: {config.noiseAmplitude?.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(减少分层感)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.6"
                  step="0.05"
                  value={config.noiseAmplitude}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      noiseAmplitude: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs block mb-1">
                  <span className="font-medium">基础透明度: {config.baseAlpha?.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">(整体不透明度)</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={config.baseAlpha}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      baseAlpha: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
            </>
          )}
        </div>

        {/* 验收检查清单 */}
        <div className="mt-4 pt-4 border-t">
          <h3 className="text-sm font-medium mb-2">验收检查：</h3>
          <ul className="text-xs space-y-1 text-gray-700">
            <li>✓ 无洋葱皮分层感</li>
            <li>✓ 边缘柔和透明</li>
            <li>✓ 中心有体积感</li>
            <li>✓ 无自遮挡发白</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
