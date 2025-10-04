# LyricSync 滚动→时间同步偏差修复报告

## 问题描述

用户反馈滚动→时间同步存在固定偏移：
- 滚动到"舍利子"（第5句），但进度只跳到"观自在菩萨"（第1句）
- 滚动到"色即是空"（第8句），进度跳到"照见一切是空"（第3句）
- 锚字显示正常，说明锚字截取逻辑无误

## 根本原因分析

### 核心问题：元素中心计算算法错误

**问题代码位置**：`src/components/LyricSync.tsx` 第545行（修复前）

```typescript
// ❌ 错误的实现
const itemCenter = item.offsetTop + item.offsetHeight / 2 + item.offsetHeight / 2
// 实际计算：offsetTop + offsetHeight（元素底部）
```

**问题分析**：
- 原代码计算的是元素的**底部位置**，而非中心位置
- 导致当用户滚动到目标行时，系统误认为下一行更接近屏幕中心
- 形成一致的"off-by-one"错误模式

### 错误模式示例

1. **用户滚动到"舍利子"（索引4）**
   - 系统计算"舍利子"元素底部位置
   - 发现"照见五蕴皆空"（索引3）的顶部更接近中心
   - 错误选择索引3，音频跳转到较早时间

2. **用户滚动到"色即是空"（索引7）**
   - 同样的计算错误
   - 系统选择"照见一切是空"（实际应为"照见五蕴皆空"，索引3）
   - 产生时间跳跃

## 修复方案

### 1. 核心修复：纠正元素中心计算

```typescript
// ✅ 修复后的正确实现
const itemCenter = item.offsetTop + item.offsetHeight / 2
```

**修复逻辑**：
- `offsetTop`：元素相对于容器顶部的距离
- `offsetHeight / 2`：元素高度的一半
- 相加得到元素中心的精确位置

### 2. 增强调试信息

添加了详细的开发模式调试信息：

```typescript
// 元素匹配调试
console.log('🎯 元素匹配调试', {
  index: i,
  text: lyrics[i]?.text?.slice(0, 8) + '...',
  containerCenter: containerCenter.toFixed(2),
  itemTop: item.offsetTop.toFixed(2),
  itemHeight: item.offsetHeight.toFixed(2),
  itemCenter: itemCenter.toFixed(2),
  distance: distance.toFixed(2),
  isClosest: distance < smallestDistance
})

// 最终匹配结果
console.log('📍 最终匹配结果', {
  selectedIndex: closestIndex,
  selectedText: lyrics[closestIndex]?.text?.slice(0, 12) + '...',
  smallestDistance: smallestDistance.toFixed(2),
  containerCenter: containerCenter.toFixed(2)
})

// 滚动同步详情
console.log('🎯 滚动同步：', {
  from: currentLyricIndex,
  to: closestIndex,
  fromText: lyrics[currentLyricIndex]?.text,
  toText: targetLyric?.text,
  targetTime: targetLyric?.time.toFixed(2)
})
```

## 技术细节

### 修复前算法流程
1. 计算元素底部：`offsetTop + offsetHeight`
2. 与容器中心比较距离
3. 选择距离最小的元素（实际是下一行）
4. 音频同步到错误的时间点

### 修复后算法流程
1. 计算元素中心：`offsetTop + offsetHeight / 2`
2. 与容器中心比较距离
3. 正确选择最接近中心的元素
4. 音频准确同步到对应时间点

### 数学原理

**修复前**：
```
itemCenter = offsetTop + offsetHeight
// 错误：这是元素底部坐标
```

**修复后**：
```
itemCenter = offsetTop + offsetHeight / 2
// 正确：这是元素中心坐标
```

## 预期修复效果

1. **消除固定偏移**：滚动到第N句将准确同步到第N句的音频时间
2. **提高匹配精度**：元素中心算法提供更精确的位置匹配
3. **增强调试能力**：详细的控制台输出便于问题定位
4. **保持其他功能**：锚字显示、循环播放等功能不受影响

## 测试验证计划

### 基础功能测试
1. **自动播放**：验证歌词随音频时间自动滚动
2. **手动滚动**：验证滚动到任意句子的同步准确性
3. **循环播放**：验证2:27处的循环跳跃逻辑

### 重点测试场景
1. **精确滚动测试**：
   - 滚动到"舍利子"（第5句），验证音频跳转到00:49.280
   - 滚动到"色即是空"（第8句），验证音频跳转到01:03.470
   - 滚动到"菩提娑婆诃"（最后一句），验证音频跳转到05:48.800

2. **边界测试**：
   - 滚动到第一句"观自在菩萨"
   - 滚动到最后一句
   - 快速连续滚动

3. **性能测试**：
   - 监控滚动响应延迟
   - 检查控制台调试信息
   - 验证不增加性能开销

### 调试信息验证
在开发模式下，控制台应显示：
- 元素匹配的详细坐标信息
- 最终选择的歌词索引和文本
- 滚动同步的起始和目标状态

## 相关文件

- **主要修复文件**：`src/components/LyricSync.tsx`
- **歌词数据文件**：`public/lyrics/心经.lrc`
- **音频文件**：`public/audio/心经.mp3`

## 修复状态

✅ **已完成修复**：
- 纠正元素中心计算算法
- 添加详细调试信息
- 优化同步日志输出

⏳ **待验证**：
- 用户实际测试验证
- 边界情况测试
- 性能影响评估

---

**修复工程师**: Claude Code
**修复时间**: 2025-10-03
**版本**: LyricSync-v2-sync-fix