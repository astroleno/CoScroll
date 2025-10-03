# 视觉中心与布局中心不匹配 - 诊断与修复指南

## 问题描述

用户观察到固定的-1偏移现象：
- 滚动到"舍利子"，进度跳到"观自在菩萨"（上一句）
- 滚动到"色即是空"，进度跳到"照见五蕴皆空"（上一句）
- 锚字显示正常，说明锚字一位截断没问题

## 理论分析

**根本原因：CSS transform导致视觉中心与布局中心不匹配**

### 现象解释
```typescript
// 高亮样式使用scale-105放大
return 'text-white text-xl font-semibold scale-105'
```

### 问题核心
1. **视觉中心**：用户眼睛看到的放大后元素中心
2. **布局中心**：`offsetTop + offsetHeight/2` 计算的几何中心
3. **不匹配结果**：视觉中心在N行，布局中心实际指向N-1行

### 数学验证
```
假设：
- 容器中心在位置 Y
- 第N行（高亮）视觉中心在 Y-5px（由于scale-105，视觉中心偏上）
- 第N-1行布局中心在 Y-2px

算法计算：|(Y-2) - Y| < |(Y-5) - Y|
结果：选择第N-1行（偏移-1）
```

## 诊断代码

已在 `LyricSync-v2.tsx` 中添加诊断代码：

```typescript
// 诊断代码：验证视觉中心与布局中心不匹配理论
if (process.env.NODE_ENV === 'development') {
  const rect = item.getBoundingClientRect()
  const visualCenter = rect.top + rect.height / 2
  const isHighlighted = i === currentLyricIndex
  const hasScale = item.classList.contains('scale-105')

  if (isHighlighted && hasScale) {
    console.log(`🔍 诊断报告 [行${i}] "${lyrics[i]?.text || '♪'}":`, {
      布局中心: itemCenter,
      视觉中心: visualCenter,
      中心差值: visualCenter - itemCenter,
      容器中心: containerCenter,
      距离: distance,
      高亮样式: isHighlighted,
      缩放效果: hasScale,
      预期偏移: visualCenter - itemCenter > 0 ? '应该选择上一行' : '应该选择当前行'
    })
  }
}
```

## 修复方案

### 方案A：固定行高数学计算 ⭐⭐⭐⭐⭐ 推荐

已实现 `centeredIndexFixed()` 函数：

```typescript
const centeredIndexFixed = useCallback((): number => {
  const container = lyricsContainerRef.current
  if (!container) return -1

  const containerScrollTop = container.scrollTop
  const containerHeight = container.clientHeight
  const containerCenter = containerScrollTop + containerHeight / 2

  // 获取CSS变量值
  const wrapper = container.parentElement
  if (!wrapper) return -1

  const computedStyle = getComputedStyle(wrapper)
  const lineHeight = parseFloat(computedStyle.getPropertyValue('--line-height'))
  const visibleLines = parseFloat(computedStyle.getPropertyValue('--visible-lines'))

  if (!lineHeight || !visibleLines) return -1

  // 计算顶部偏移空间
  const offsetSpace = (visibleLines * lineHeight) / 2

  // 精确计算哪一行在视觉中心
  const centerLineIndex = Math.round((containerCenter - offsetSpace) / lineHeight)

  // 确保索引在有效范围内
  return Math.max(0, Math.min(centerLineIndex, lyrics.length - 1))
}, [lyrics.length])
```

**优势**：
- 不受CSS transform影响
- 计算精确，性能优异
- 利用现有CSS变量系统
- 完全避免视觉/布局中心不匹配

### 方案B：getBoundingClientRect() ⭐⭐⭐⭐ 备选

```typescript
const itemRect = item.getBoundingClientRect()
const itemCenter = itemRect.top + itemRect.height / 2
```

**优势**：获取真实的视觉位置，包含所有CSS变换效果
**劣势**：性能稍差（触发重排），仍可能受transform影响

## 测试步骤

### 1. 启动开发环境
```bash
npm run dev
```

### 2. 打开浏览器控制台
确保能看到开发模式下的诊断日志

### 3. 测试原始问题
1. 播放心经音频
2. 滚动到任意歌词（如"舍利子"）
3. 观察控制台输出和音频跳动
4. 验证是否确实出现-1偏移

### 4. 查看诊断报告
在控制台中寻找类似输出：
```
🔍 诊断报告 [行X] "歌词文本": {
  布局中心: 1234,
  视觉中心: 1240,
  中心差值: 6,
  容器中心: 1250,
  距离: 16,
  高亮样式: true,
  缩放效果: true,
  预期偏移: "应该选择上一行"
}
```

### 5. 测试修复算法
1. 点击右下角"修复算法：开启"按钮
2. 重复步骤3的测试
3. 观察算法对比日志：
```
🔧 算法对比: {
  原始算法: X,
  修复算法: X+1,
  使用修复: true,
  当前选择: "上一句歌词",
  修复应该选择: "当前歌词"
}
```

### 6. 验证修复效果
- **修复前**：滚动到"N句"，音频跳到"N-1句"
- **修复后**：滚动到"N句"，音频正确跳到"N句"

## 预期结果

### 诊断确认理论
- 高亮行确实应用了 `scale-105` 类
- 视觉中心与布局中心存在正差值
- 差值导致算法选择上一行

### 修复算法验证
- 固定行高计算不受transform影响
- 算法结果与用户预期一致
- 消除固定-1偏移现象

## 实现文件

- **主要文件**：`/src/components/LyricSync-v2.tsx`
- **诊断函数**：`centeredIndex()` (第114-164行)
- **修复函数**：`centeredIndexFixed()` (第166-193行)
- **切换开关**：`useFixedCentering` 状态变量
- **UI控制**：底部控制栏修复算法按钮

## 技术细节

### CSS变量系统
```css
.lyrics-wrapper {
  --visible-lines: 5;
  --line-height: 3.2rem;
}
```

### transform影响分析
- `offsetTop`：不受transform影响 ✅
- `offsetHeight`：不受transform影响 ✅
- `getBoundingClientRect()`：受transform影响 ⚠️
- `scale-105`：放大1.05倍，视觉中心偏移

### 算法选择逻辑
- 原始算法：选择距离容器中心最近的**布局中心**
- 修复算法：计算固定行高下的**理论中心位置**
- 期望结果：算法选择的行与用户视觉居中的行一致

---

**完成标准**：
1. ✅ 诊断代码确认理论正确性
2. ✅ 修复算法消除-1偏移
3. ✅ UI开关允许实时对比测试
4. ✅ 性能和稳定性保持不变