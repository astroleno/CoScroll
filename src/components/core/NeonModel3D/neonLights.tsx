/**
 * 弥散霓虹光照系统
 * 实现环境光、主光源、补光和动态呼吸效果
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import { NeonConfig } from './neonConfig'

interface NeonLightsProps {
  config: NeonConfig
  time: number
}

export function NeonLights({ config, time }: NeonLightsProps) {
  // 呼吸动画计算
  const breathing = useMemo(() => {
    return 0.5 + 0.5 * Math.sin(time * config.breathingSpeed)
  }, [time, config.breathingSpeed])

  // 动态光照强度 - 平衡发光和色彩
  const ambientIntensity = config.ambientIntensity * breathing
  const mainLightIntensity = config.mainLightIntensity * breathing
  const pointLightIntensity = 0.8 * breathing

  return (
    <>
      {/* 环境光 - 提供整体照明 */}
      <ambientLight 
        intensity={ambientIntensity} 
        color={config.mainColor}
      />
      
      {/* 主光源 - 温暖的方向光 */}
      <directionalLight 
        position={[6, 6, 4]} 
        intensity={mainLightIntensity} 
        color={config.mainColor}
        castShadow={false}
      />
      
      {/* 补光 - 冷色调补光 */}
      <directionalLight 
        position={[-6, -4, -6]} 
        intensity={config.ambientIntensity * 0.8} 
        color={config.secondaryColor}
        castShadow={false}
      />
      
      {/* 点光源 - 动态呼吸光 */}
      <pointLight 
        position={[0, -2, 4]} 
        intensity={pointLightIntensity} 
        color={config.mainColor}
        distance={12}
        decay={2}
      />
      
      {/* 边缘补光 - 增强轮廓 */}
      <pointLight 
        position={[4, 2, -2]} 
        intensity={pointLightIntensity * 0.6} 
        color={config.rimColor}
        distance={8}
        decay={1.5}
      />
    </>
  )
}

// 光照预设
export const lightPresets = {
  // 默认光照 - 参考图风格
  default: {
    ambientIntensity: 0.6,
    mainLightIntensity: 1.5,
    breathingSpeed: 0.8
  },
  
  // 柔和光照 - 移动端优化
  soft: {
    ambientIntensity: 0.4,
    mainLightIntensity: 1.0,
    breathingSpeed: 0.6
  },
  
  // 强烈光照 - 桌面端高质量
  intense: {
    ambientIntensity: 0.8,
    mainLightIntensity: 2.0,
    breathingSpeed: 1.0
  }
}

// 光照工具函数
export function createLightConfig(config: NeonConfig) {
  return {
    ambient: {
      intensity: config.ambientIntensity,
      color: config.mainColor
    },
    main: {
      intensity: config.mainLightIntensity,
      color: config.mainColor,
      position: [6, 6, 4] as [number, number, number]
    },
    fill: {
      intensity: config.ambientIntensity * 0.8,
      color: config.secondaryColor,
      position: [-6, -4, -6] as [number, number, number]
    },
    point: {
      intensity: 0.8,
      color: config.mainColor,
      position: [0, -2, 4] as [number, number, number],
      distance: 12
    }
  }
}
