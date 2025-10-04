"use client";

import React, { useState } from 'react';

/**
 * 噪点效果测试页面
 * 用于测试和调整噪点参数
 */
export default function NoiseTestPage() {
  const [noiseEnabled, setNoiseEnabled] = useState(true);
  const [intensity, setIntensity] = useState(0.3);
  const [scale, setScale] = useState(1.0);
  const [speed, setSpeed] = useState(1.0);
  const [opacity, setOpacity] = useState(0.8);
  const [blendMode, setBlendMode] = useState<'normal' | 'multiply' | 'overlay' | 'screen' | 'soft-light' | 'hard-light' | 'color-dodge' | 'color-burn'>('normal');
  const [color, setColor] = useState('#ffffff');
  const [noiseType, setNoiseType] = useState<'perlin' | 'simplex' | 'white' | 'blue' | 'pink'>('perlin');
  const [frequency, setFrequency] = useState(1.0);
  const [octaves, setOctaves] = useState(4);
  const [lacunarity, setLacunarity] = useState(2.0);
  const [persistence, setPersistence] = useState(0.5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex flex-col">
      {/* 控制面板 */}
      <div className="fixed top-4 left-4 z-50 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white max-w-sm">
        <h2 className="text-lg font-bold mb-4">噪点效果控制</h2>
        
        <div className="space-y-3">
          {/* 开关 */}
          <div className="flex items-center justify-between">
            <label className="text-sm">启用噪点</label>
            <input
              type="checkbox"
              checked={noiseEnabled}
              onChange={(e) => setNoiseEnabled(e.target.checked)}
              className="w-4 h-4"
            />
          </div>

          {/* 强度 */}
          <div>
            <label className="text-sm block mb-1">强度: {intensity.toFixed(3)}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* 缩放 */}
          <div>
            <label className="text-sm block mb-1">缩放: {scale.toFixed(2)}</label>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* 速度 */}
          <div>
            <label className="text-sm block mb-1">速度: {speed.toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="5.0"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* 透明度 */}
          <div>
            <label className="text-sm block mb-1">透明度: {opacity.toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* 混合模式 */}
          <div>
            <label className="text-sm block mb-1">混合模式</label>
            <select
              value={blendMode}
              onChange={(e) => setBlendMode(e.target.value as any)}
              className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm"
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="overlay">Overlay</option>
              <option value="screen">Screen</option>
              <option value="soft-light">Soft Light</option>
              <option value="hard-light">Hard Light</option>
              <option value="color-dodge">Color Dodge</option>
              <option value="color-burn">Color Burn</option>
            </select>
          </div>

          {/* 颜色 */}
          <div>
            <label className="text-sm block mb-1">颜色</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full h-8 rounded"
            />
          </div>

          {/* 噪点类型 */}
          <div>
            <label className="text-sm block mb-1">噪点类型</label>
            <select
              value={noiseType}
              onChange={(e) => setNoiseType(e.target.value as any)}
              className="w-full bg-gray-800 text-white rounded px-2 py-1 text-sm"
            >
              <option value="perlin">Perlin</option>
              <option value="simplex">Simplex</option>
              <option value="white">White</option>
              <option value="blue">Blue</option>
              <option value="pink">Pink</option>
            </select>
          </div>

          {/* 频率 */}
          <div>
            <label className="text-sm block mb-1">频率: {frequency.toFixed(2)}</label>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.1"
              value={frequency}
              onChange={(e) => setFrequency(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* 八度 */}
          <div>
            <label className="text-sm block mb-1">八度: {octaves}</label>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={octaves}
              onChange={(e) => setOctaves(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* 间隙 */}
          <div>
            <label className="text-sm block mb-1">间隙: {lacunarity.toFixed(2)}</label>
            <input
              type="range"
              min="1.0"
              max="4.0"
              step="0.1"
              value={lacunarity}
              onChange={(e) => setLacunarity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* 持续性 */}
          <div>
            <label className="text-sm block mb-1">持续性: {persistence.toFixed(2)}</label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={persistence}
              onChange={(e) => setPersistence(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">噪点效果测试</h1>
          <p className="text-lg mb-8">调整左侧控制面板来测试不同的噪点效果</p>
          
          {/* 示例内容 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">示例文本</h3>
              <p className="text-sm leading-relaxed">
                这是一段示例文本，用于测试噪点效果对文字可读性的影响。
                噪点应该轻微扰动背景，而不破坏整体润度。
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">噪点参数</h3>
              <div className="text-sm space-y-1">
                <p>强度: {intensity.toFixed(3)}</p>
                <p>缩放: {scale.toFixed(2)}</p>
                <p>速度: {speed.toFixed(2)}</p>
                <p>透明度: {opacity.toFixed(2)}</p>
                <p>类型: {noiseType}</p>
                <p>混合: {blendMode}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 简单的噪点效果 */}
      {noiseEnabled && (
        <div 
          className="fixed inset-0 pointer-events-none z-50"
          style={{
            opacity: opacity,
            background: `
              radial-gradient(circle at 20% 20%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
              radial-gradient(circle at 40% 40%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
              radial-gradient(circle at 60% 60%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
              radial-gradient(circle at 80% 80%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
              radial-gradient(circle at 10% 90%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
              radial-gradient(circle at 90% 10%, rgba(255,255,255,${intensity}) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px, 60px 60px, 40px 40px, 70px 70px, 30px 30px, 80px 80px',
            animation: 'noise 2s steps(4) infinite'
          }}
        >
          <style jsx>{`
            @keyframes noise {
              0% { transform: translate(0, 0); }
              25% { transform: translate(-1px, -1px); }
              50% { transform: translate(1px, -1px); }
              75% { transform: translate(-1px, 1px); }
              100% { transform: translate(0, 0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
