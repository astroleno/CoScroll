// 自定义体验配置示例
import { ExperienceConfig } from '@/config/experience.config'

// 示例：道德经体验配置
export const daodejingConfig: ExperienceConfig = {
  id: 'daodejing',
  title: '道德经',
  description: '道德经数字禅修体验',

  audio: {
    file: '/audio/道德经.mp3',
    loopEndTime: 180,  // 3分钟循环
    fadeOutDuration: 4  // 4秒渐弱
  },

  lyrics: {
    file: '/lyrics/道德经.lrc'
  },

  visuals: {
    model: '/models/10k/003_道.glb',
    fallbackColor: '#0066ff',  // 蓝色球体
    rotationSpeed: 0.8
  },

  interaction: {
    scrollSensitivity: 0.015,
    speedRange: [0.3, 2.5]
  }
}

// 示例：现代音乐体验配置
export const modernMusicConfig: ExperienceConfig = {
  id: 'modern-music',
  title: '现代音乐体验',
  description: '现代音乐可视化体验',

  audio: {
    file: '/audio/ambient.mp3',
    loopEndTime: 240,  // 4分钟循环
    fadeOutDuration: 2  // 2秒渐弱
  },

  lyrics: {
    file: '/lyrics/ambient.lrc'
  },

  visuals: {
    fallbackColor: '#ff6b9d',  // 粉色球体
    rotationSpeed: 1.5  // 更快的旋转
  },

  interaction: {
    scrollSensitivity: 0.02,
    speedRange: [0.1, 4.0]  // 更大的速度范围
  }
}

// 使用方法示例：
// 1. 在 useExperienceConfig 中传入配置ID：
//    const { config } = useExperienceConfig('daodejing')
//
// 2. 或者直接导入配置：
//    import { daodejingConfig } from '@/examples/custom-experience.config'
//    const config = daodejingConfig