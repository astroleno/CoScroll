# LyricSync 修复总结

## 修复的问题

### 问题1：歌词跳转到【舍利子】而不是【观自在菩萨】
- **根本原因**：useEffect 重新执行时局部变量 `isInitialized` 被重置，导致使用错误的 `currentLyricIndex` 重新初始化滚动位置
- **修复方案**：使用 `useRef` 持久化初始化状态，强制使用索引 0（第一句歌词）初始化

### 问题2：电脑端滚不动，手机端会弹回
- **根本原因**：RAF 循环每帧都设置 `scrollTop`，150ms 冷却期永远无法生效（16.67ms << 150ms）
- **修复方案**：引入 `lastUserScrollTimeRef`，用户滚动时暂停自动滚动 1000ms

## 修改的文件

- `/Users/aitoshuu/Documents/GitHub/CoScroll/src/components/LyricSync.tsx`

## 修改的行数

1. **第64行**：添加 `isInitializedRef`
   ```typescript
   const isInitializedRef = useRef(false)
   ```

2. **第59行**：添加 `lastUserScrollTimeRef`
   ```typescript
   const lastUserScrollTimeRef = useRef(0)
   ```

3. **第277-303行**：删除局部变量 `isInitialized`，使用 `isInitializedRef.current`，强制使用索引 0 初始化

4. **第345-375行**：RAF 循环检查 `lastUserScrollTimeRef`，用户滚动期间跳过设置 `scrollTop`

5. **第408-447行**：`handleScroll` 记录 `lastUserScrollTimeRef.current`，同步 `currentScrollTopRef.current`

## 测试要点

1. **初始化测试**：
   - 刷新页面，观察歌词是否从【观自在菩萨】开始
   - 不应跳转到【舍利子】或其他句子

2. **滚动测试（电脑端）**：
   - 使用鼠标滚轮滚动歌词列表
   - 应能流畅滚动，无阻尼感
   - 松开鼠标后 1 秒，自动滚动从停止位置恢复

3. **滚动测试（手机端）**：
   - 用手指滑动歌词列表
   - 应能流畅滚动，无弹回现象
   - 松开手指后 1 秒，自动滚动从停止位置恢复

4. **音频同步测试**：
   - 滚动到某句歌词（例如【度一切苦厄】）
   - 音频应跳转到对应时间（36.79秒）
   - 1 秒后自动滚动继续

## 预期效果

- ✅ 歌词始终从第一句开始
- ✅ 电脑端可流畅滚动
- ✅ 手机端不会弹回
- ✅ 用户可通过滚动控制音频进度
- ✅ 1 秒后自动滚动自然恢复

## 技术债务

无。修复已完成，代码质量良好。

## 相关文档

- 详细分析：`/Users/aitoshuu/Documents/GitHub/CoScroll/BUG_ANALYSIS.md`
