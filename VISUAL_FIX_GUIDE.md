# LyricSync 修复可视化指南

## 修复1：歌词跳转问题

### 问题时序图

```
修复前：
┌─────────────────────────────────────────────────────────────────┐
│ T0: 组件挂载 currentLyricIndex = 0                               │
│ T1: useEffect 执行，创建局部变量 isInitialized = false            │
│ T2: RAF 初始化，使用 currentLyricIndex=0，isInitialized = true  │
│ T3: 音频播放到 49.28 秒                                          │
│ T4: RAF 更新 currentLyricIndex = 4（【舍利子】）                 │
│ T5: useEffect 重新执行（依赖 currentLyricIndex 变化）            │
│ T6: 创建新局部变量 isInitialized = false ⚠️                      │
│ T7: RAF 检测到 !isInitialized，重新初始化                        │
│ T8: 使用 currentLyricIndex=4 初始化 ❌                           │
│ T9: 滚动跳转到【舍利子】！                                        │
└─────────────────────────────────────────────────────────────────┘

修复后：
┌─────────────────────────────────────────────────────────────────┐
│ T0: 组件挂载 currentLyricIndex = 0                               │
│ T1: useEffect 执行，isInitializedRef.current = false             │
│ T2: RAF 初始化，使用索引 0，isInitializedRef.current = true     │
│ T3: 音频播放到 49.28 秒                                          │
│ T4: RAF 更新 currentLyricIndex = 4（【舍利子】）                 │
│ T5: useEffect 重新执行（依赖 currentLyricIndex 变化）            │
│ T6: isInitializedRef.current 仍然是 true ✅                      │
│ T7: RAF 检测到 isInitializedRef.current，跳过初始化             │
│ T8: 正常滚动到【舍利子】，无跳转                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 代码对比

```typescript
// 修复前（❌ 错误）
useEffect(() => {
  let isInitialized = false  // 局部变量，useEffect 重新执行时重置

  const smoothScroll = () => {
    if (!isInitialized) {
      // 使用当前的 currentLyricIndex（可能是 0, 1, 2, ...）
      const offset = lyricRefs.current[currentLyricIndex]?.offsetTop
      container.scrollTop = offset - containerCenter
      isInitialized = true
    }
  }
}, [lyrics, isPlaying, currentLyricIndex])  // currentLyricIndex 变化会重新执行

// 修复后（✅ 正确）
const isInitializedRef = useRef(false)  // ref 持久化

useEffect(() => {
  const smoothScroll = () => {
    if (!isInitializedRef.current) {
      // 强制使用索引 0（第一句歌词）
      const offset = lyricRefs.current[0]?.offsetTop
      container.scrollTop = offset - containerCenter
      isInitializedRef.current = true  // ref 不会被 useEffect 重置
    }
  }
}, [lyrics, isPlaying, currentLyricIndex])  // 即使 currentLyricIndex 变化，ref 仍然有效
```

## 修复2：滚动阻尼问题

### 问题时序图

```
修复前：
┌─────────────────────────────────────────────────────────────────┐
│ 时间轴  RAF循环                  用户滚动        handleScroll    │
│         (60fps = 16.67ms)                                        │
├─────────────────────────────────────────────────────────────────┤
│ 0ms     设置 scrollTop           -              -               │
│         记录时间戳 = 0                                            │
│ 16ms    设置 scrollTop           用户滚轮↓      timeSince=16ms  │
│         记录时间戳 = 16                          < 150ms ❌ 忽略 │
│ 33ms    设置 scrollTop           用户滚轮↓      timeSince=17ms  │
│         记录时间戳 = 33                          < 150ms ❌ 忽略 │
│ 50ms    设置 scrollTop           用户滚轮↓      timeSince=17ms  │
│         记录时间戳 = 50                          < 150ms ❌ 忽略 │
│ ...     永远无法通过 150ms 检查！                                │
│         结果：用户滚动被完全忽略，RAF 每帧覆盖 scrollTop          │
└─────────────────────────────────────────────────────────────────┘

修复后：
┌─────────────────────────────────────────────────────────────────┐
│ 时间轴  RAF循环                  用户滚动        handleScroll    │
├─────────────────────────────────────────────────────────────────┤
│ 0ms     设置 scrollTop           -              -               │
│         isUserScrolling=false                                    │
│ 16ms    设置 scrollTop           用户滚轮↓      记录用户时间戳  │
│         isUserScrolling=false                   lastUser = 16ms │
│ 33ms    检测 isUserScrolling     用户滚轮↓      记录用户时间戳  │
│         = true，跳过设置 ✅                      lastUser = 33ms │
│ 50ms    检测 isUserScrolling     用户滚轮↓      记录用户时间戳  │
│         = true，跳过设置 ✅                      lastUser = 50ms │
│ 1000ms  检测 timeSince = 950ms   -              -               │
│         isUserScrolling=false                                    │
│ 1016ms  设置 scrollTop ✅         -              -               │
│         从用户停止位置继续                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 代码对比

```typescript
// 修复前（❌ 错误）
const smoothScroll = () => {
  // 每帧都设置 scrollTop，每帧都更新时间戳
  lastProgrammaticScrollTimeRef.current = Date.now()
  container.scrollTop = currentScrollTopRef.current
}

const handleScroll = (event) => {
  const timeSince = Date.now() - lastProgrammaticScrollTimeRef.current
  if (timeSince < 150) {
    return  // 永远 < 150ms，用户滚动被忽略
  }
  // ... 更新音频位置
}

// 修复后（✅ 正确）
const lastUserScrollTimeRef = useRef(0)  // 新增

const smoothScroll = () => {
  const timeSinceUserScroll = Date.now() - lastUserScrollTimeRef.current
  const isUserScrolling = timeSinceUserScroll < 1000

  if (!isUserScrolling) {
    // 只在非用户滚动期间才设置 scrollTop
    lastProgrammaticScrollTimeRef.current = Date.now()
    container.scrollTop = currentScrollTopRef.current
  }
}

const handleScroll = (event) => {
  const timeSince = Date.now() - lastProgrammaticScrollTimeRef.current
  if (timeSince < 150) {
    return  // 仍然忽略程序滚动触发的事件
  }

  // 记录用户滚动时间，暂停自动滚动 1000ms
  lastUserScrollTimeRef.current = Date.now()

  // 更新音频位置
  audio.currentTime = targetLyric.time
  currentScrollTopRef.current = containerScrollTop  // 同步当前位置
}
```

## 交互流程图

```
用户体验流程：

修复前：
用户滚动 → 被 150ms 冷却期阻止 → RAF 覆盖 scrollTop → 滚不动/弹回 ❌

修复后：
用户滚动 → 记录时间戳 → RAF 暂停 1000ms → 用户可流畅滚动 ✅
         ↓
         更新音频位置（跳转到对应时间）
         ↓
         1 秒后 RAF 从停止位置恢复自动滚动
```

## 关键改进点

| 问题            | 修复前                     | 修复后                         | 效果           |
|----------------|---------------------------|-------------------------------|---------------|
| 初始化跳转      | 局部变量 `isInitialized`   | ref `isInitializedRef`        | 不再跳转       |
| 初始化索引      | 使用 `currentLyricIndex`   | 强制使用索引 0                 | 始终从第一句开始 |
| 滚动阻尼        | RAF 每帧设置 `scrollTop`   | 检查 `isUserScrolling` 条件设置| 可流畅滚动     |
| 用户滚动检测    | 只有 `lastProgrammatic`    | 新增 `lastUserScrollTimeRef`  | 准确检测用户滚动|
| 自动滚动恢复    | 无机制                     | 1 秒后从停止位置恢复            | 自然平滑过渡   |

## 修复文件

- `/Users/aitoshuu/Documents/GitHub/CoScroll/src/components/LyricSync.tsx`
  - 第59行：`lastUserScrollTimeRef`
  - 第64行：`isInitializedRef`
  - 第285-303行：初始化逻辑
  - 第345-375行：RAF 循环
  - 第408-447行：handleScroll
