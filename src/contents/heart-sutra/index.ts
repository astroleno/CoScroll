import { ContentPackage } from '@/types/content.types'

// 心经内容包
export const heartSutraContent: ContentPackage = {
  // 元数据
  meta: {
    id: 'heart-sutra',
    title: '心经',
    description: '沉浸式心经数字体验 - 般若波罗蜜多心经全文',
    category: 'buddhist-sutra',
    difficulty: 'beginner',
    duration: '2:44',
    tags: ['佛经', '入门', '经典', '般若', '心经'],
    author: '玄奘译',
    version: '1.0.0',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },

  // 音频配置
  audio: {
    file: '/audio/心经.mp3',
    loopEndTime: 155,  // 2:35开始渐弱
    fadeOutDuration: 9,  // 9秒渐弱 (2:35-2:44)
    volume: 1.0
  },

  // 歌词配置
  lyrics: {
    file: '/lyrics/心经.lrc',
    encoding: 'utf-8'
  },

  // 视觉配置
  visuals: {
    model: '/models/10k/003_道.glb',
    fallbackColor: '#ff0000',
    rotationSpeed: 1.0,
    backgroundStyle: 'default'
  },

  // 交互配置
  interaction: {
    scrollSensitivity: 0.01,
    speedRange: [0.2, 3.0],
    controlMode: 'scroll'
  },

  // 分段数据 - 基于原始heartSutra.ts
  segments: [
    { id: 1, text: "观自在菩萨，行深般若波罗蜜多时", anchor: "观" },
    { id: 2, text: "照见五蕴皆空，度一切苦厄。", anchor: "空" },
    { id: 3, text: "色不异空，空不异色；色即是空，空即是色。", anchor: "色" },
    { id: 4, text: "受想行识，亦复如是。", anchor: "受" },
    { id: 5, text: "舍利子，是诸法空相：不生不灭，不垢不净，不增不减。", anchor: "舍" },
    { id: 6, text: "是故空中无色，无受想行识；", anchor: "故" },
    { id: 7, text: "无眼耳鼻舌身意；无色声香味触法；", anchor: "眼" },
    { id: 8, text: "无眼界乃至无意识界。", anchor: "界" },
    { id: 9, text: "无无明，亦无无明尽；", anchor: "明" },
    { id: 10, text: "乃至无老死，亦无老死尽。", anchor: "老" },
    { id: 11, text: "无苦集灭道，无智亦无得。", anchor: "苦" },
    { id: 12, text: "以无所得故，菩提萨埵", anchor: "得" },
    { id: 13, text: "依般若波罗蜜多故，心无挂碍；", anchor: "依" },
    { id: 14, text: "无挂碍故，无有恐怖，", anchor: "挂" },
    { id: 15, text: "远离颠倒梦想，究竟涅槃。", anchor: "远" },
    { id: 16, text: "三世诸佛，依般若波罗蜜多故，", anchor: "三" },
    { id: 17, text: "得阿耨多罗三藐三菩提。", anchor: "阿" },
    { id: 18, text: "故知般若波罗蜜多，", anchor: "知" },
    { id: 19, text: "是大神咒，是大明咒，", anchor: "神" },
    { id: 20, text: "是无上咒，是无等等咒，", anchor: "上" },
    { id: 21, text: "能除一切苦，真实不虚。", anchor: "除" },
    { id: 22, text: "故说般若波罗蜜多咒，", anchor: "说" },
    { id: 23, text: "即说咒曰：", anchor: "曰" },
    { id: 24, text: "揭谛揭谛，波罗揭谛，", anchor: "揭" },
    { id: 25, text: "波罗僧揭谛，菩提萨婆诃。", anchor: "僧" }
  ]
}

// 导出默认内容包
export default heartSutraContent

// 文本分割逻辑 - 保持与原系统兼容
export function splitTextByAnchor(text: string, anchor: string) {
  const anchorIndex = text.indexOf(anchor)
  if (anchorIndex === -1) return { front: text, back: '' }

  return {
    front: text.substring(0, anchorIndex),
    back: text.substring(anchorIndex + anchor.length)
  }
}

// 交替显示逻辑 - 保持与原系统兼容
export function getTextLayout(segmentId: number) {
  const isEven = segmentId % 2 === 0
  return {
    frontZ: isEven ? -1 : 1,  // 偶数行：前文在后，奇数行：前文在前
    backZ: isEven ? 1 : -1,   // 偶数行：后文在前，奇数行：后文在后
    frontOpacity: isEven ? 0.7 : 0.9,
    backOpacity: isEven ? 0.9 : 0.7
  }
}

// 获取当前活跃段落 - 保持与原系统兼容
export function getCurrentSegment(scrollProgress: number) {
  const index = Math.floor(scrollProgress * heartSutraContent.segments.length)
  return heartSutraContent.segments[Math.min(index, heartSutraContent.segments.length - 1)]
}