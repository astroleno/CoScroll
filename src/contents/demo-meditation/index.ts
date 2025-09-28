import { ContentPackage } from '@/types/content.types'

// 示例冥想内容包 - 验证系统扩展性
export const demoMeditationContent: ContentPackage = {
  // 元数据
  meta: {
    id: 'demo-meditation',
    title: '示例冥想',
    description: '简单的冥想体验示例',
    category: 'meditation',
    difficulty: 'beginner',
    duration: '5:00',
    tags: ['冥想', '放松', '示例'],
    author: '系统示例',
    version: '1.0.0',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },

  // 音频配置
  audio: {
    file: '/audio/demo-meditation.mp3',  // 实际不存在，仅作示例
    loopEndTime: 300,  // 5分钟
    fadeOutDuration: 5,  // 5秒渐弱
    volume: 0.8
  },

  // 歌词配置
  lyrics: {
    file: '/lyrics/demo-meditation.lrc',  // 实际不存在，仅作示例
    encoding: 'utf-8'
  },

  // 视觉配置
  visuals: {
    model: '/models/10k/meditation-sphere.glb',  // 实际不存在，仅作示例
    fallbackColor: '#0066cc',
    rotationSpeed: 0.5,
    backgroundStyle: 'modern'
  },

  // 交互配置
  interaction: {
    scrollSensitivity: 0.02,
    speedRange: [0.5, 2.0],
    controlMode: 'breath'
  },

  // 分段数据 - 简单的冥想引导
  segments: [
    { id: 1, text: "闭上双眼，放松身体", anchor: "闭" },
    { id: 2, text: "深深吸气，缓缓呼气", anchor: "吸" },
    { id: 3, text: "感受内心的平静", anchor: "感" },
    { id: 4, text: "让思绪如云朵飘过", anchor: "思" },
    { id: 5, text: "回归当下这一刻", anchor: "当" },
    { id: 6, text: "体验内在的宁静", anchor: "宁" }
  ]
}

// 导出默认内容包
export default demoMeditationContent