'use client'

import { useState } from 'react'
import { NeonModel3D } from '@/components/core/NeonModel3D'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import type { NeonMaterialConfig } from '@/components/core/NeonModel3D'

// 霓虹预览页面 - 专注于渲染测试
export default function NeonPreviewPage() {
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium')
  const [preset, setPreset] = useState<'default' | 'warm' | 'cool' | 'vibrant'>('default')

  // 预设配置
  const presets: Record<string, Partial<NeonMaterialConfig>> = {
    default: {
      mainColor: '#ff6b9d', // 粉橙色
      secondaryColor: '#4ecdc4', // 青蓝色
      rimColor: '#ffd18b', // 边缘金色
      neonIntensity: 1.5, // 增强霓虹强度
      rimIntensity: 2.0, // 增强边缘发光
      grainIntensity: 0.3, // 增强颗粒质感
      gradientStrength: 0.4, // 增强渐变效果
      innerGlow: 1.5, // 增强内部发光
      opacity: 0.9 // 提高不透明度
    },
    warm: {
      mainColor: '#ff9a8b',
      secondaryColor: '#ff6b9d',
      rimColor: '#ffd18b',
      neonIntensity: 1.1,
      rimIntensity: 1.4,
      grainIntensity: 0.15,
      gradientStrength: 0.25,
      innerGlow: 1.2,
      opacity: 0.8
    },
    cool: {
      mainColor: '#4ecdc4',
      secondaryColor: '#45b7d1',
      rimColor: '#96ceb4',
      neonIntensity: 0.8,
      rimIntensity: 1.0,
      grainIntensity: 0.2,
      gradientStrength: 0.15,
      innerGlow: 0.8,
      opacity: 0.7
    },
    vibrant: {
      mainColor: '#ff6b9d',
      secondaryColor: '#4ecdc4',
      rimColor: '#ffd18b',
      neonIntensity: 1.3,
      rimIntensity: 1.6,
      grainIntensity: 0.25,
      gradientStrength: 0.3,
      innerGlow: 1.4,
      opacity: 0.85
    }
  }

  return (
    <div className="w-full h-screen bg-black">
      {/* 控制面板 */}
      <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-white">
        <h2 className="text-lg font-bold mb-4">霓虹渲染测试</h2>
        
        {/* 质量选择 */}
        <div className="mb-4">
          <label className="block text-sm mb-2">质量档位</label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as 'low' | 'medium' | 'high')}
            className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm"
          >
            <option value="low">低质量</option>
            <option value="medium">中等质量</option>
            <option value="high">高质量</option>
          </select>
        </div>

        {/* 预设选择 */}
        <div className="mb-4">
          <label className="block text-sm mb-2">色彩预设</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as any)}
            className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm"
          >
            <option value="default">默认</option>
            <option value="warm">温暖</option>
            <option value="cool">冷调</option>
            <option value="vibrant">鲜艳</option>
          </select>
        </div>

        {/* 状态信息 */}
        <div className="text-xs opacity-60">
          <div>质量: {quality}</div>
          <div>预设: {preset}</div>
        </div>
      </div>

      {/* 渲染组件 */}
      <div className="w-full h-full">
        <ErrorBoundary>
          <NeonModel3D
            modelPath="/models/10k/003_道.glb"
            quality={quality}
            neonConfig={presets[preset]}
            autoRotate={true}
            rotationSpeed={0.35}
            wobbleIntensity={0.15}
            pulseSpeed={0.6}
            showFloorGlow={true}
          />
        </ErrorBoundary>
      </div>
    </div>
  )
}