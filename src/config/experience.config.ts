// 体验配置文件类型定义
export interface ExperienceConfig {
  id: string
  title: string
  description: string
  audio: {
    file: string
    loopEndTime: number  // 循环截止时间（秒）
    fadeOutDuration: number  // 渐弱时长（秒）
  }
  lyrics: {
    file: string
    encoding?: string
  }
  visuals: {
    model?: string
    fallbackColor: string
    rotationSpeed: number
  }
  interaction: {
    scrollSensitivity: number
    speedRange: [number, number]  // [最小速度, 最大速度]
  }
}

// 心经体验配置
export const heartSutraConfig: ExperienceConfig = {
  id: 'heart-sutra',
  title: '心经',
  description: '沉浸式心经数字体验',

  audio: {
    file: '/audio/心经.mp3',
    loopEndTime: 155,  // 2:35开始渐弱
    fadeOutDuration: 9  // 9秒渐弱 (2:35-2:44)
  },

  lyrics: {
    file: '/lyrics/心经.lrc',
    encoding: 'utf-8'
  },

  visuals: {
    model: '/models/10k/003_道.glb',
    fallbackColor: '#ff0000',
    rotationSpeed: 1.0
  },

  interaction: {
    scrollSensitivity: 0.01,
    speedRange: [0.2, 3.0]
  }
}

// 其他示例配置
export const demoConfigs: ExperienceConfig[] = [
  {
    id: 'demo-simple',
    title: '简单示例',
    description: '基础音频体验示例',

    audio: {
      file: '/audio/demo.mp3',
      loopEndTime: 60,
      fadeOutDuration: 2
    },

    lyrics: {
      file: '/lyrics/demo.lrc'
    },

    visuals: {
      fallbackColor: '#0066cc',
      rotationSpeed: 0.5
    },

    interaction: {
      scrollSensitivity: 0.02,
      speedRange: [0.5, 2.0]
    }
  }
]

// 默认配置
export const defaultConfig = heartSutraConfig