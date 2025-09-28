// 心经文本数据结构 - 基于1_心经拆解.md
export interface HeartSutraSegment {
  id: number
  text: string
  anchor: string
}

export const heartSutraSegments: HeartSutraSegment[] = [
  { id: 1, text: "观自在菩萨，行深般若波罗蜜多时", anchor: "观" },
  { id: 2, text: "照见五蕴皆空，度一切苦厄。", anchor: "空" },
  { id: 3, text: "色不异空，空不异色；色即是空，空即是色。", anchor: "色" },
  { id: 4, text: "是诸法空相：不生不灭，不垢不净，不增不减。", anchor: "心" },
  { id: 5, text: "是故空中无色，无受想行识；无眼耳鼻舌身意；无色声香味触法；无眼界乃至无意识界。", anchor: "无" },
  { id: 6, text: "无无明，亦无无明尽。", anchor: "明" },
  { id: 7, text: "乃至无老死，亦无老死尽。", anchor: "老" },
  { id: 8, text: "无苦集灭道，无智亦无得。", anchor: "苦" }
]

// 文本分割逻辑
export function splitTextByAnchor(text: string, anchor: string) {
  const anchorIndex = text.indexOf(anchor)
  if (anchorIndex === -1) return { front: text, back: '' }

  return {
    front: text.substring(0, anchorIndex),
    back: text.substring(anchorIndex + anchor.length)
  }
}

// 交替显示逻辑
export function getTextLayout(segmentId: number) {
  const isEven = segmentId % 2 === 0
  return {
    frontZ: isEven ? -1 : 1,  // 偶数行：前文在后，奇数行：前文在前
    backZ: isEven ? 1 : -1,   // 偶数行：后文在前，奇数行：后文在后
    frontOpacity: isEven ? 0.7 : 0.9,
    backOpacity: isEven ? 0.9 : 0.7
  }
}

// 获取当前活跃段落
export function getCurrentSegment(scrollProgress: number): HeartSutraSegment {
  const index = Math.floor(scrollProgress * heartSutraSegments.length)
  return heartSutraSegments[Math.min(index, heartSutraSegments.length - 1)]
}