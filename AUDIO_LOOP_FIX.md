# 歌词滚动与音频循环联动问题修复方案

## 问题根本原因分析

### 1. 时间窗口控制的"单次生效"陷阱
- **问题**：`allowScrollToTime`一旦设置为true就永远不会重置
- **影响**：音频循环后，时间→滚动同步断裂

### 2. 循环边界的索引计算失效
- **问题**：音频循环后currentTime接近0，但lyrics[0].time > 0，导致indexForTime永远返回-1
- **影响**：歌词索引永远卡在最后一句

### 3. 滚动同步的"假死"状态
- **问题**：由于索引计算失效，滚动操作无法正确同步到音频时间
- **影响**：用户滚动操作无效

### 4. 缺少循环检测机制
- **问题**：代码完全没有检测音频循环的逻辑
- **影响**：无法在循环时重置相关状态

## 修复方案

### 方案1：智能循环检测 + 状态重置（推荐）

```typescript
// 添加循环检测状态
const [playCount, setPlayCount] = useState(0)
const lastCycleTimeRef = useRef(0)

// 修改时间更新逻辑
const updateTime = () => {
  const audio = audioRef.current
  const time = audio.currentTime

  // 检测音频循环（currentTime从大变小）
  if (lastCycleTimeRef.current > 1.0 && time < 1.0) {
    console.log('🔄 检测到音频循环，重置状态')
    setAllowScrollToTime(false)
    setCurrentLyricIndex(0)
    setPlayCount(prev => prev + 1)
  }
  lastCycleTimeRef.current = time

  setCurrentTime(time)

  // 修改时间窗口控制：每次循环都重新启用
  if (!allowScrollToTime && time >= lyrics[0].time) {
    setAllowScrollToTime(true)
    console.log('🔓 时间窗口已开放，允许滚动→时间同步')
  }

  // 修改索引计算：允许循环后正确识别首句
  const newIndex = indexForTime(time, playCount)

  if (newIndex >= 0 && newIndex !== currentLyricIndex) {
    setCurrentLyricIndex(newIndex)
    if (!isUserScrolling()) {
      scrollToLyric(newIndex, 'smooth')
    }
  }
}
```

### 方案2：修改indexForTime函数支持循环

```typescript
// 修改索引计算函数，支持循环识别
const indexForTime = useCallback((time: number, cycle: number = 0): number => {
  if (!lyrics.length) return -1

  // 如果是第一次循环且时间小于首句时间，返回-1
  if (cycle === 0 && time < lyrics[0].time) {
    return -1
  }

  // 如果不是第一次循环，允许时间接近0时返回首句索引
  if (cycle > 0 && time < lyrics[0].time) {
    return 0
  }

  // 正常查找逻辑
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (time >= lyrics[i].time) {
      return i
    }
  }

  return 0
}, [lyrics])
```

### 方案3：添加音频事件监听（最可靠）

```typescript
// 添加音频循环事件监听
useEffect(() => {
  const audio = audioRef.current
  if (!audio || !lyrics.length) return

  const handleLoop = () => {
    console.log('🔄 音频自然结束，准备循环')
    // 重置关键状态
    setAllowScrollToTime(false)
    setCurrentLyricIndex(0)
    // 滚动到顶部
    setTimeout(() => {
      scrollToLyric(0, 'auto')
      setAllowScrollToTime(true)
    }, 100)
  }

  // 监听音频结束事件
  audio.addEventListener('ended', handleLoop)

  return () => {
    audio.removeEventListener('ended', handleLoop)
  }
}, [lyrics.length, scrollToLyric])
```

### 方案4：滚动同步的循环边界处理

```typescript
// 修改滚动同步逻辑，支持循环边界
const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
  if (!event.nativeEvent.isTrusted) return
  if (isUserScrolling()) return

  // 允许在音频循环后进行滚动同步
  if (!allowScrollToTime) {
    // 如果是音频循环后的首次滚动，允许同步
    if (currentLyricIndex === lyrics.length - 1) {
      console.log('🔄 检测到循环后滚动，启用同步')
      setAllowScrollToTime(true)
    } else {
      console.log('🚫 时间窗口未开放，禁止滚动→时间同步')
      return
    }
  }

  const centeredLyricIndex = useFixedCentering ? centeredIndexFixed() : centeredIndex()

  if (centeredLyricIndex >= 0 && centeredLyricIndex !== currentLyricIndex) {
    const audio = audioRef.current
    const targetLyric = lyrics[centeredLyricIndex]

    if (audio && targetLyric) {
      // 如果是首句且音频接近结尾，说明需要循环
      if (centeredLyricIndex === 0 && audio.currentTime > audio.duration - 1.0) {
        audio.currentTime = 0
        setCurrentTime(0)
      } else {
        audio.currentTime = targetLyric.time
        setCurrentTime(targetLyric.time)
      }

      setCurrentLyricIndex(centeredLyricIndex)

      console.log('📍 滚动同步时间', {
        lyricIndex: centeredLyricIndex,
        lyricText: targetLyric.text,
        time: targetLyric.time.toFixed(2)
      })
    }
  }
}, [allowScrollToTime, currentLyricIndex, isUserScrolling, lyrics])
```

## 推荐的完整修复方案

结合方案1、2、3的优点，采用"智能循环检测 + 事件监听"的双重保障机制：

1. **循环检测**：通过currentTime变化检测循环
2. **事件监听**：监听音频ended事件作为备选方案
3. **状态重置**：循环时重置所有相关状态
4. **索引计算优化**：支持循环后的正确索引识别
5. **滚动同步增强**：处理循环边界的特殊情况

## 修复后的预期效果

1. ✅ 音频循环正常工作
2. ✅ 歌词索引正确跟随音频循环
3. ✅ 进度条正确显示循环进度
4. ✅ 滚动同步在循环边界正常工作
5. ✅ 视觉无限滚动保持正常

## 测试建议

1. **基本循环测试**：让音频自然播放，观察是否正常循环
2. **手动滚动测试**：在循环后手动滚动，观察是否能正确同步
3. **进度条测试**：点击进度条在不同位置，观察是否正确跳转
4. **边界测试**：在音频接近结尾时滚动，观察边界处理
5. **多次循环测试**：连续播放多个循环，确认稳定性