/**
 * 弥散霓虹后期处理效果
 * 实现Bloom光晕、Film Grain颗粒和雾化效果
 */

import { EffectComposer, Bloom, DepthOfField, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { NeonConfig } from './neonConfig'

interface NeonEffectsProps {
  config: NeonConfig
  enabled?: boolean
}

export function NeonEffects({ config, enabled = true }: NeonEffectsProps) {
  if (!enabled) return null

  const bloomIntensity = Math.min(config.bloomIntensity, 1.2)
  const bloomThreshold = Math.max(config.bloomThreshold, 0.15)

  return (
    <EffectComposer>
      {/* 景深效果让背景柔化 */}
      <DepthOfField
        focusDistance={0.02}
        focalLength={0.035}
        bokehScale={3.8}
        height={480}
      />

      {/* Bloom光晕效果 - 实现强烈的光晕扩散 */}
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.75} // 更平滑的光晕
        mipmapBlur
        blendFunction={BlendFunction.SCREEN}
        kernelSize={3} // 增强光晕范围
      />
      
      {/* Film Grain颗粒效果 - 增强胶片质感 */}
      <Noise
        premultiply
        blendFunction={BlendFunction.SOFT_LIGHT}
        opacity={config.grainOpacity}
      />
      
      {/* 暗角效果 - 增强中心聚焦 */}
      <Vignette
        offset={0.2}
        darkness={0.3}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}

// 效果预设
export const effectPresets = {
  // 默认效果 - 参考图风格
  default: {
    bloomIntensity: 2.0,
    bloomThreshold: 0.08,
    grainOpacity: 0.4
  },
  
  // 柔和效果 - 移动端优化
  soft: {
    bloomIntensity: 1.5,
    bloomThreshold: 0.12,
    grainOpacity: 0.3
  },
  
  // 强烈效果 - 桌面端高质量
  intense: {
    bloomIntensity: 2.5,
    bloomThreshold: 0.06,
    grainOpacity: 0.5
  },
  
  // 性能效果 - 低端设备
  performance: {
    bloomIntensity: 1.0,
    bloomThreshold: 0.15,
    grainOpacity: 0.2
  }
}

// 效果工具函数
export function createEffectConfig(config: NeonConfig) {
  return {
    bloom: {
      intensity: config.bloomIntensity,
      threshold: config.bloomThreshold,
      smoothing: 0.85
    },
    grain: {
      opacity: config.grainOpacity,
      blendMode: BlendFunction.SOFT_LIGHT
    },
    vignette: {
      offset: 0.2,
      darkness: 0.3
    }
  }
}

// 性能分级效果
export function getPerformanceEffects(deviceType: 'desktop' | 'mobile' | 'low-end') {
  switch (deviceType) {
    case 'desktop':
      return effectPresets.intense
    case 'mobile':
      return effectPresets.soft
    case 'low-end':
      return effectPresets.performance
    default:
      return effectPresets.default
  }
}
