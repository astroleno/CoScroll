/**
 * 弥散霓虹组件测试页面
 * 用于测试和调试NeonModel3D组件
 */

'use client'

import React, { useState } from 'react'
import { NeonModel3D, NeonConfig } from '@/components/core/NeonModel3D/NeonModel3D'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

export default function NeonTestPage() {
  const [config, setConfig] = useState<Partial<NeonConfig>>({
    // 参考图风格配置 - 恢复色彩系统
    mainColor: '#ff6b9d',      // 主色调：粉橙色
    secondaryColor: '#4ecdc4', // 次色调：青蓝色
    rimColor: '#ffd18b',       // 边缘色：金色
    fresnelIntensity: 1.4,     // Fresnel效果
    innerGlowIntensity: 1.0,   // 内部发光
    gradientStrength: 0.45,    // 渐变强度
    grainIntensity: 0.55,      // 颗粒效果
    bloomIntensity: 0.9,       // Bloom效果
    bloomThreshold: 0.22,      // Bloom阈值
    grainOpacity: 0.45,        // 颗粒不透明度
    autoRotate: false,         // 禁用旋转，专注渲染效果
    rotationSpeed: 0,
    wobbleIntensity: 0
  })

  const [modelPath, setModelPath] = useState('/models/10k/002_心.glb') // 使用现有的心经模型
  
  // 可用的模型列表
  const availableModels = [
    { path: '/models/10k/001_空.glb', name: '空' },
    { path: '/models/10k/002_心.glb', name: '心' },
    { path: '/models/10k/003_道.glb', name: '道' },
    { path: '/models/10k/007_明.glb', name: '明' },
    { path: '/models/10k/012_无.glb', name: '无' },
    { path: '/models/10k/020_死.glb', name: '死' },
    { path: '/models/10k/045_苦.glb', name: '苦' },
    { path: '/models/10k/094_色.glb', name: '色' },
    { path: '/models/10k/101_观.glb', name: '观' }
  ]

  const handleConfigChange = <K extends keyof NeonConfig>(key: K, value: NeonConfig[K]) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }))
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">
          弥散霓虹渲染组件测试
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 渲染区域 */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-lg overflow-hidden" style={{ height: '600px' }}>
              <ErrorBoundary>
                <NeonModel3D
                  modelPath={modelPath}
                  config={config}
                  onLoad={() => console.log('模型加载完成')}
                  onError={(error) => console.error('渲染错误:', error)}
                />
              </ErrorBoundary>
            </div>
          </div>
          
          {/* 控制面板 */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">参数调节</h2>
            
            {/* 模型选择 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">模型选择</h3>
              <div className="grid grid-cols-3 gap-2">
                {availableModels.map((model) => (
                  <button
                    key={model.path}
                    onClick={() => setModelPath(model.path)}
                    className={`px-3 py-2 rounded text-sm ${
                      modelPath === model.path 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {model.name}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 着色器参数 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">着色器参数</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Fresnel强度: {config.fresnelIntensity}
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={config.fresnelIntensity || 2.5}
                  onChange={(e) => handleConfigChange('fresnelIntensity', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  内部发光强度: {config.innerGlowIntensity}
                </label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={config.innerGlowIntensity || 1.8}
                  onChange={(e) => handleConfigChange('innerGlowIntensity', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  渐变强度: {config.gradientStrength}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.gradientStrength || 0.5}
                  onChange={(e) => handleConfigChange('gradientStrength', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  颗粒强度: {config.grainIntensity}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.grainIntensity || 0.5}
                  onChange={(e) => handleConfigChange('grainIntensity', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
            
            {/* 后期处理参数 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">后期处理参数</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Bloom强度: {config.bloomIntensity}
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={config.bloomIntensity || 2.0}
                  onChange={(e) => handleConfigChange('bloomIntensity', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Bloom阈值: {config.bloomThreshold}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.bloomThreshold || 0.08}
                  onChange={(e) => handleConfigChange('bloomThreshold', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  颗粒不透明度: {config.grainOpacity}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.grainOpacity || 0.4}
                  onChange={(e) => handleConfigChange('grainOpacity', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
            
            {/* 动画参数 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">动画参数</h3>
              
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.autoRotate || false}
                    onChange={(e) => handleConfigChange('autoRotate', e.target.checked)}
                    className="rounded"
                  />
                  <span>自动旋转</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  旋转速度: {config.rotationSpeed}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.rotationSpeed || 0.5}
                  onChange={(e) => handleConfigChange('rotationSpeed', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  浮动强度: {config.wobbleIntensity}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.wobbleIntensity || 0.3}
                  onChange={(e) => handleConfigChange('wobbleIntensity', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
            
            {/* 预设按钮 */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium">预设</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfig({
                    mainColor: '#ff6b9d',
                    secondaryColor: '#4ecdc4',
                    rimColor: '#ffd18b',
                    fresnelIntensity: 2.5,
                    innerGlowIntensity: 1.8,
                    gradientStrength: 0.5,
                    grainIntensity: 0.5,
                    bloomIntensity: 2.0,
                    bloomThreshold: 0.08,
                    grainOpacity: 0.4
                  })}
                  className="px-3 py-2 bg-blue-600 rounded text-sm"
                >
                  参考图风格
                </button>
                <button
                  onClick={() => setConfig({
                    mainColor: '#ff6b9d',
                    secondaryColor: '#4ecdc4',
                    rimColor: '#ffd18b',
                    fresnelIntensity: 1.8,
                    innerGlowIntensity: 1.2,
                    gradientStrength: 0.3,
                    grainIntensity: 0.3,
                    bloomIntensity: 1.5,
                    bloomThreshold: 0.12,
                    grainOpacity: 0.3
                  })}
                  className="px-3 py-2 bg-green-600 rounded text-sm"
                >
                  柔和风格
                </button>
                <button
                  onClick={() => setConfig({
                    mainColor: '#ff6b9d',
                    secondaryColor: '#4ecdc4',
                    rimColor: '#ffd18b',
                    fresnelIntensity: 3.0,
                    innerGlowIntensity: 2.2,
                    gradientStrength: 0.6,
                    grainIntensity: 0.6,
                    bloomIntensity: 2.5,
                    bloomThreshold: 0.06,
                    grainOpacity: 0.5
                  })}
                  className="px-3 py-2 bg-purple-600 rounded text-sm"
                >
                  强烈风格
                </button>
                <button
                  onClick={() => setConfig({
                    mainColor: '#ff6b9d',
                    secondaryColor: '#4ecdc4',
                    rimColor: '#ffd18b',
                    fresnelIntensity: 1.5,
                    innerGlowIntensity: 1.0,
                    gradientStrength: 0.2,
                    grainIntensity: 0.2,
                    bloomIntensity: 1.0,
                    bloomThreshold: 0.15,
                    grainOpacity: 0.2,
                    autoRotate: false
                  })}
                  className="px-3 py-2 bg-orange-600 rounded text-sm"
                >
                  性能模式
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
