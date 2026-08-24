## 横向滚动重构 TODO（从 `src/app/page.tsx` 出发）

目标：以“时间”为唯一真相源，构建受控的横向时间轴 UI，彻底解决跟手性与歌词高光不同步问题。

### 指导原则
- 单一时间源：播放态由 `audioTime/absoluteTime` 驱动，预览态由 `previewTime` 驱动，二者互斥。
- 受控位移：横向位移使用 `transform: translateX` 与 `pixelsPerSecond` 映射，不使用原生 scroll。
- 一次性 seek：预览期间不 seek，结束时一次性 `commitTimeUpdate(targetTime, true)` 并触发 `seekSignal`。

### 方向与布局要求（RTL + 竖排 + 对齐 + 遮挡）
- 播放方向：右→左（RTL）。时间轴空间映射需支持方向因子 `direction = -1`。
- 歌词排布：竖排展示（CSS `writing-mode: vertical-rl; text-orientation: mixed;`）。
- 对齐策略：原“左右对齐”语义切换为“上下对齐”（竖排时顶部/底部）。
- 遮挡关系：保持既有层级关系（3D 模型、歌层、高光遮罩、噪点/特效），通过明确的 z-index/stacking context 管理，避免因 transform 产生新的 stacking context 而破坏遮挡。
---

### 实施任务

1) 引入横向时间映射容器（受控，支持 RTL）
- 在 `page.tsx` 增加横向容器：以 `translateX(direction * -displayTime * pixelsPerSecond)` 驱动位置（RTL 时 `direction = -1`）
- 定义 `pixelsPerSecond` 常量（默认 120–200）与 `direction`（1/-1），并暴露为 URL 参数或常量
- 渲染仅依赖“显示时间”（预览用 `previewTime`，播放用 `audioTime`）

2) 输入层：拖拽/滚轮→仅更新 `previewTime`（方向兼容）
- Pointer/touch/wheel 事件均 `passive: false` 并 `preventDefault()`，禁用浏览器手势
- 位移累计为 `deltaX`，映射 `timeDelta = -(deltaX * direction) / pixelsPerSecond`（右→左为正向时间）
- 连续输入期间只写 `previewTime` 与 `timelineStore.setVisualTime`
 - wheel 归一化：按 `deltaMode`（pixel/line/page）统一换算像素；对触控板/鼠标施加不同系数；设置单帧最大时间步进与平滑滤波，避免设备差异导致过冲

3) 预览生命周期与一次性 seek
- 进入预览：置 `isPreviewMode`，冻结音频更新对 UI 的影响
- 预览更新：基于累计位移更新 `previewTime`；UI 各层统一使用 `previewTime`
- 预览结束：计算 `targetAbsolute`，调用 `commitTimeUpdate(display, absolute, true)`，触发 `seekSignal`

4) 高光同步改为纯时间插值（竖排兼容）
- 以行的 `[start, end]` 做插值：`progress = clamp((t - start)/(end - start))`
- 竖排时以 Y 轴/高度为主，横排时以 X 轴/宽度为主；高光宽度/透明度/位移皆由 `progress` 驱动，消除密集段落的抖动
- 所有高光计算统一读取“显示时间”

5) `LyricsController` 角色转变
- 从“滚动驱动器”转为“时间读写器”：
  - 读：`currentTime`、`duration`、`scrollTime`
  - 写：`onPreviewStart/onPreviewTime/onPreviewEnd` 与 `onSeek`
- 移除对原生滚动位置的依赖，内部不再维护 scrollTop/Left 状态

6) 歌词虚拟化（横向/竖排兼容）
- 只渲染可视窗口 ±N 秒的歌词元素（按时间窗口虚拟化）
- 横排映射 X，竖排映射 Y；避免超长 DOM
 - 引入滞回（hysteresis）与预取缓冲：可视窗口外再预留 ±(2–4)s 缓冲，快速拖拽时减少装卸抖动；N 建议起始值 8–12s，按端上性能调优

7) 锚点/模型与显示时间严格一致
- `anchorChar = findAnchorCharByTime(displayTime)`，不再由 DOM 定位反推
- 预览期仅更新“预测下一个模型”，不切换重资源；seek 后再切换

7.1) 模型旋转方向与播放方向一致
- 提供 `rotationDirection`（1/-1），播放方向为右→左时，模型旋转方向取反以达成视觉一致性
- 在 `JadeV6` 等组件透传该参数，并确保预览与播放态一致

8) 预测预加载在预览期更新
- 预览更新时调用 `ModelPreloader.predictNextModel(...)` 更新 `nextModel`
- 预览结束后若锚点变化，再执行真实 `preloadNextModel`

9) 手感：速度与阻尼（可选增强）
- 捕获最近输入速度 `vx`，用小阻尼在预览期提供“惯性”；但仍不 seek
- 鼠标滚轮/触控板横向输入支持（Shift+wheel 或 deltaX）

10) 移动端手势细节
- Touch 事件走相同映射；加阈值过滤抖动
- 禁用系统返回/左右滑动冲突（容器层 `touch-action: none`）

11) 遮挡关系和层级稳定性
- 明确各层 z-index：3D 模型 < 歌词文本 < 高光遮罩 < 噪点/特效 UI
- 尽量将需要分层的元素放在同一 stacking context；必要的 transform 元素上指定 `isolation: isolate` 或单独容器，避免意外提升/覆盖

11.1) 相对时间窗口与大位移精度
- 使用相对时间锚点 `originTime`：位移用 `(displayTime - originTime)` 计算；当偏移超过阈值（如 ±30s）时重置 `originTime`，避免超大 translateX 造成的精度与性能问题

12) QA 场景清单
- 快速拖拽/来回抖动；密集歌词区；回到 0 附近；循环边界前后
- 切后台再返回（可见性变化时的时间同步）
- 低端移动设备帧率与卡顿观感
 - RTL + 竖排 + transform 在 Chrome/Firefox/Safari、iOS Safari 的表现差异（建立测试矩阵）

13) 播放“步进”彻底解决方案
- 统一用高精度时间：以 `performance.now()` 为基准，与音频 `currentTime` 进行偏差估计与小步校正
- 播放态：用 RAF 驱动 UI（非 setInterval），`onTimeUpdate` 只作为参考校正；去除/调小 `commitTimeUpdate` 的 8ms/0.005 阈值在播放态的影响
- 预览态：完全由输入积分得到的 `previewTime` 驱动；松手后一次 seek，设置 500ms 保护期避免反复校正
- 循环边界：由 `SmoothLoopManager` 提供稳定的跨界时间，确保 UI 连续无跳帧；必要时使用“子帧插值”过渡一帧

14) 性能指标与度量
- 目标：桌面 FPS ≥ 58、移动 FPS ≥ 55；输入至 UI 响应 < 16ms；虚拟化后内存占用 ≤ 现状 50%
- 建立简单指标采集：`performance.now()` 帧间隔直方图、内存快照、关键路径计时（输入→预览渲染）

15) 渐进式降级策略
- 设备能力检测（UA + 实测帧率）：动态调低 `pixelsPerSecond`、关闭/减弱惯性与特效、缩小虚拟化窗口、限制每帧最大 DOM 变更数量
- 资源侧降级：预览期只做预测不切换大模型，必要时关闭模型反射/环境贴图强化

16) 可访问性（a11y）
- 键盘快进/快退（←/→、Shift/Alt 变步长），Home/End 跳至头尾
- ARIA：当前时间、当前行/段描述；为屏幕阅读器提供简洁朗读文本
- 可聚焦控件与清晰焦点样式，确保无鼠标也可操作

17) 自动化测试
- 单元：时间↔像素映射、预览生命周期状态机、锚点匹配正确性
- 端到端：拖拽预览→松手 seek→音频/模型/高光一致跳转
- 性能回归：关键交互路径的帧时间阈值检查

18) 分阶段实施与验收
- Phase 1：时间映射容器 + 基础输入 + 预览生命周期；验收：可拖动预览并一次性 seek
- Phase 2：高光时间插值 + 播放态 RAF 同步；验收：无步进感、同步稳定
- Phase 3：虚拟化 + 手感 + 移动手势；验收：长歌词流畅、移动端跟手
- Phase 4：层级与方向细节 + 循环边界 + 模型旋转一致；验收：QA 全通过
- Phase 5：性能指标、降级策略、a11y 与自动化测试落地；验收：指标达标，测试绿

12) 调试叠层
- 最小信息：模式（Play/Preview）、display/absolute、loopCount、anchor、X 像素
- 开关：仅开发环境显示

---

### 代码落点与对接点
- `src/app/page.tsx`：新增横向容器、输入事件、`pixelsPerSecond`、预览生命周期、调试层
- `src/components/LyricsController.tsx`：时间读写接口化，去除 DOM 滚动耦合
- `src/components/layouts/StackedLyricsAndModel.tsx`：渲染依据“显示时间”，抽出高光插值；支持竖排布局与上下对齐
- `src/components/jade/ModelPreloader.ts`：新增预览期预测更新接口（轻量）
- `src/components/jade/JadeV6.tsx`：透传 `rotationDirection` 并在 RTL 时取反
 - `src/components/hooks`：新增 wheel 归一化与输入系数工具、设备能力探测工具

---

### 完成标准（Definition of Done）
- 拖拽/滚轮预览毫无掉帧，手感线性且无浏览器惯性影响
- 高光与进度永远和“显示时间”一致；播放态与预览态一致
- 松手后一跳到位、音频与模型同步，0.5s 内无二次校正抖动
- 大型歌词文件渲染稳定（虚拟化生效），移动端交互顺畅
- RTL + 竖排下对齐/遮挡关系正确；模型旋转方向与播放方向一致
 - 性能指标达标；存在明确降级路径；基础 a11y 可用；核心自动化测试通过