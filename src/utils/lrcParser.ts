// LRC歌词解析工具
export interface LyricLine {
  time: number  // 秒数
  text: string
  anchor?: string  // 提取的锚字
}

// 解析LRC时间戳 [mm:ss.xxx] 为秒数
function parseLrcTime(timeStr: string): number {
  const match = timeStr.match(/\[(\d{2}):(\d{2})\.(\d{3})\]/)
  if (!match) return 0

  const minutes = parseInt(match[1], 10)
  const seconds = parseInt(match[2], 10)
  const milliseconds = parseInt(match[3], 10)

  return minutes * 60 + seconds + milliseconds / 1000
}

// 提取文本首字作为锚字
function extractAnchor(text: string): string {
  // 移除空格和标点，获取第一个汉字
  const cleanText = text.replace(/[^\u4e00-\u9fa5]/g, '')
  return cleanText.charAt(0) || '心'
}

// 解析LRC文件内容
export function parseLrc(lrcContent: string): LyricLine[] {
  const lines = lrcContent.split('\n')
  const lyrics: LyricLine[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith('[')) continue

    const timeMatch = trimmed.match(/^(\[[\d:\.]+\])(.*)$/)
    if (!timeMatch) continue

    const time = parseLrcTime(timeMatch[1])
    const text = timeMatch[2].trim()

    if (text) {
      lyrics.push({
        time,
        text,
        anchor: extractAnchor(text)
      })
    }
  }

  return lyrics.sort((a, b) => a.time - b.time)
}

// 获取指定时间的当前歌词
export function getCurrentLyric(lyrics: LyricLine[], currentTime: number): LyricLine | null {
  if (lyrics.length === 0) return null

  // 找到当前时间对应的歌词行
  let currentIndex = -1
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= currentTime) {
      currentIndex = i
    } else {
      break
    }
  }

  return currentIndex >= 0 ? lyrics[currentIndex] : null
}

// 心经循环截止时间 (2:44 = 164秒)
export const HEART_SUTRA_LOOP_END = 164