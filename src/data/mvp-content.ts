import { TextContent, TextSegment } from '@/types/content.types'

// MVP 阶段的硬编码数据
export const MVP_DATA = {
  // 心经完整文本分段
  heartSutra: {
    id: 'heart_sutra',
    title: '般若波罗蜜多心经',
    description: '佛教经典，讲述般若智慧的核心要义',
    segments: [
      {
        id: 'hs_01',
        content: '观自在菩萨',
        startIndex: 0,
        endIndex: 5,
        anchorWord: '观',
        modelId: 'guan',
        duration: 3000
      },
      {
        id: 'hs_02',
        content: '行深般若波罗蜜多时',
        startIndex: 5,
        endIndex: 14,
        anchorWord: '行',
        modelId: 'xing',
        duration: 5000
      },
      {
        id: 'hs_03',
        content: '照见五蕴皆空',
        startIndex: 14,
        endIndex: 20,
        anchorWord: '照',
        modelId: 'zhao',
        duration: 4000
      },
      {
        id: 'hs_04',
        content: '度一切苦厄',
        startIndex: 20,
        endIndex: 25,
        anchorWord: '度',
        modelId: 'du',
        duration: 4000
      },
      {
        id: 'hs_05',
        content: '舍利子',
        startIndex: 25,
        endIndex: 28,
        anchorWord: '舍',
        modelId: 'she',
        duration: 2500
      },
      {
        id: 'hs_06',
        content: '色不异空',
        startIndex: 28,
        endIndex: 32,
        anchorWord: '色',
        modelId: 'se',
        duration: 3000
      },
      {
        id: 'hs_07',
        content: '空不异色',
        startIndex: 32,
        endIndex: 36,
        anchorWord: '空',
        modelId: 'kong',
        duration: 3000
      },
      {
        id: 'hs_08',
        content: '色即是空',
        startIndex: 36,
        endIndex: 40,
        anchorWord: '即',
        modelId: 'ji',
        duration: 3000
      },
      {
        id: 'hs_09',
        content: '空即是色',
        startIndex: 40,
        endIndex: 44,
        anchorWord: '是',
        modelId: 'shi',
        duration: 3000
      },
      {
        id: 'hs_10',
        content: '受想行识',
        startIndex: 44,
        endIndex: 48,
        anchorWord: '受',
        modelId: 'shou',
        duration: 3500
      },
      {
        id: 'hs_11',
        content: '亦复如是',
        startIndex: 48,
        endIndex: 52,
        anchorWord: '亦',
        modelId: 'yi',
        duration: 3500
      },
      {
        id: 'hs_12',
        content: '舍利子',
        startIndex: 52,
        endIndex: 55,
        anchorWord: '舍',
        modelId: 'she',
        duration: 2500
      },
      {
        id: 'hs_13',
        content: '是诸法空相',
        startIndex: 55,
        endIndex: 60,
        anchorWord: '诸',
        modelId: 'zhu',
        duration: 4000
      },
      {
        id: 'hs_14',
        content: '不生不灭',
        startIndex: 60,
        endIndex: 64,
        anchorWord: '生',
        modelId: 'sheng',
        duration: 3500
      },
      {
        id: 'hs_15',
        content: '不垢不净',
        startIndex: 64,
        endIndex: 68,
        anchorWord: '垢',
        modelId: 'gou',
        duration: 3500
      },
      {
        id: 'hs_16',
        content: '不增不减',
        startIndex: 68,
        endIndex: 72,
        anchorWord: '增',
        modelId: 'zeng',
        duration: 3500
      },
      {
        id: 'hs_17',
        content: '是故空中无色',
        startIndex: 72,
        endIndex: 78,
        anchorWord: '故',
        modelId: 'gu',
        duration: 4500
      },
      {
        id: 'hs_18',
        content: '无受想行识',
        startIndex: 78,
        endIndex: 83,
        anchorWord: '无',
        modelId: 'wu',
        duration: 4000
      },
      {
        id: 'hs_19',
        content: '无眼耳鼻舌身意',
        startIndex: 83,
        endIndex: 91,
        anchorWord: '眼',
        modelId: 'yan',
        duration: 5500
      },
      {
        id: 'hs_20',
        content: '无色声香味触法',
        startIndex: 91,
        endIndex: 99,
        anchorWord: '声',
        modelId: 'sheng2',
        duration: 5500
      },
      {
        id: 'hs_21',
        content: '无眼界',
        startIndex: 99,
        endIndex: 102,
        anchorWord: '界',
        modelId: 'jie',
        duration: 2500
      },
      {
        id: 'hs_22',
        content: '乃至无意识界',
        startIndex: 102,
        endIndex: 108,
        anchorWord: '乃',
        modelId: 'nai',
        duration: 4500
      },
      {
        id: 'hs_23',
        content: '无无明',
        startIndex: 108,
        endIndex: 111,
        anchorWord: '明',
        modelId: 'ming',
        duration: 2500
      },
      {
        id: 'hs_24',
        content: '亦无无明尽',
        startIndex: 111,
        endIndex: 116,
        anchorWord: '尽',
        modelId: 'jin',
        duration: 4000
      },
      // 继续添加更多段落...
      {
        id: 'hs_25',
        content: '揭谛揭谛',
        startIndex: 116,
        endIndex: 120,
        anchorWord: '揭',
        modelId: 'jie2',
        duration: 3500
      },
      {
        id: 'hs_26',
        content: '波罗揭谛',
        startIndex: 120,
        endIndex: 124,
        anchorWord: '波',
        modelId: 'bo',
        duration: 3500
      },
      {
        id: 'hs_27',
        content: '波罗僧揭谛',
        startIndex: 124,
        endIndex: 129,
        anchorWord: '僧',
        modelId: 'seng',
        duration: 4000
      },
      {
        id: 'hs_28',
        content: '菩提萨婆诃',
        startIndex: 129,
        endIndex: 134,
        anchorWord: '菩',
        modelId: 'pu',
        duration: 4000
      }
    ] as TextSegment[],
    metadata: {
      totalDuration: 108000, // 约1分48秒
      segmentCount: 28,
      theme: '般若智慧',
      difficulty: 0.7,
      language: 'zh' as const,
      category: 'sutra' as const
    },
    audioConfig: {
      id: 'heart_sutra_audio',
      filePath: '/audio/heart_sutra.mp3',
      duration: 108000,
      bpm: 60,
      volume: 0.8,
      effects: [
        {
          type: 'reverb',
          params: { wet: 0.3, decay: 4 },
          enabled: true
        }
      ]
    }
  } as TextContent,

  // 模型映射数据
  models: {
    // 现有模型
    'dao': {
      id: 'dao',
      name: '道',
      filePath: '/models/10k/003_道.glb',
      category: 'calligraphy' as const,
      tags: ['道家', '哲学', '书法'],
      fileSize: 1024000,
      description: '道家核心概念，表示宇宙万物的本源'
    },

    // 预留的模型 (心经相关)
    'guan': {
      id: 'guan',
      name: '观',
      filePath: '/models/10k/001_观.glb',
      category: 'calligraphy' as const,
      tags: ['佛教', '观想', '书法'],
      fileSize: 980000,
      description: '观察、觉察的意思，佛教修行的重要概念'
    },
    'xing': {
      id: 'xing',
      name: '行',
      filePath: '/models/10k/002_行.glb',
      category: 'calligraphy' as const,
      tags: ['佛教', '修行', '书法'],
      fileSize: 950000,
      description: '行动、修行的意思'
    },
    'zhao': {
      id: 'zhao',
      name: '照',
      filePath: '/models/10k/004_照.glb',
      category: 'calligraphy' as const,
      tags: ['佛教', '光明', '书法'],
      fileSize: 960000,
      description: '照见、觉察的意思'
    },
    'kong': {
      id: 'kong',
      name: '空',
      filePath: '/models/10k/005_空.glb',
      category: 'calligraphy' as const,
      tags: ['佛教', '空性', '书法'],
      fileSize: 920000,
      description: '佛教核心概念，表示事物的本质'
    },
    'se': {
      id: 'se',
      name: '色',
      filePath: '/models/10k/006_色.glb',
      category: 'calligraphy' as const,
      tags: ['佛教', '色相', '书法'],
      fileSize: 940000,
      description: '物质现象，五蕴之一'
    },
    'wu': {
      id: 'wu',
      name: '无',
      filePath: '/models/10k/007_无.glb',
      category: 'calligraphy' as const,
      tags: ['佛教', '空无', '书法'],
      fileSize: 880000,
      description: '无、空的意思'
    },
    'xin': {
      id: 'xin',
      name: '心',
      filePath: '/models/10k/008_心.glb',
      category: 'calligraphy' as const,
      tags: ['佛教', '心性', '书法'],
      fileSize: 970000,
      description: '心经的核心，表示心性智慧'
    }
  },

  // 音频配置
  audio: {
    heartSutra: {
      id: 'heart_sutra_main',
      filePath: '/audio/heart_sutra.mp3',
      duration: 108000,
      bpm: 60,
      volume: 0.8
    },
    ambient: {
      id: 'ambient_temple',
      filePath: '/audio/temple_ambient.mp3',
      duration: 300000, // 5分钟循环
      bpm: 40,
      volume: 0.3
    }
  }
} as const

// 获取随机文本段落 (用于测试)
export function getRandomSegment(): TextSegment {
  const segments = MVP_DATA.heartSutra.segments
  const randomIndex = Math.floor(Math.random() * segments.length)
  return segments[randomIndex]
}

// 根据关键词搜索段落
export function searchSegments(keyword: string): TextSegment[] {
  return MVP_DATA.heartSutra.segments.filter(
    segment =>
      segment.content.includes(keyword) ||
      segment.anchorWord?.includes(keyword)
  )
}

// 获取段落的前后文
export function getSegmentContext(segmentId: string): {
  prev: TextSegment | null
  current: TextSegment | null
  next: TextSegment | null
} {
  const segments = MVP_DATA.heartSutra.segments
  const index = segments.findIndex(s => s.id === segmentId)

  if (index === -1) {
    return { prev: null, current: null, next: null }
  }

  return {
    prev: index > 0 ? segments[index - 1] : null,
    current: segments[index],
    next: index < segments.length - 1 ? segments[index + 1] : null
  }
}