## 三层 Canvas 合并 TODO（主站接入）

基于 `src/app/layer-test/MERGE_PLAN.md` 的实施任务清单。目标：不改歌词业务逻辑，仅替换承载与布局，在首页提供开关灰度上线。

### 执行清单

- [ ] 新增布局开关 `lyricsLayout`，保留旧布局可回滚（front-back-back | stacked-3canvas）
- [ ] 创建 `StackedLyricsAndModel` 外壳：Grid 叠加三层 `<Canvas gl={{ alpha:true }}>`
- [ ] 拆分歌词渲染为 `TopLyrics`（前一行）与 `BottomLyrics`（后两行），读取现有同一份状态
- [ ] 中层接入 `JadeModelLoader`（不自带 Canvas），对齐 JadeV6 参数与环境分离
- [ ] 首页接入布局开关：`LegacyLyricsAndModel` vs `StackedLyricsAndModel` 灰度切换
- [ ] 性能与移动端：限制 DPR、关闭 MSAA（必要时）、顶层 `pointer-events:none`
- [ ] 视觉对齐：字号、行距、对齐、颜色、淡入淡出节奏校准
- [ ] 文档更新：README 合并说明、使用指引、回滚策略

### 设计要点

- 三层叠加是 2D 叠放，无跨层深度与折射；如需真实折射，后续采用 FBO 捕捉底层纹理供中层材质采样。
- 顶/中 Canvas 背景透明；底层可用主题底色或渐变。
- 事件路由：顶层一般 `pointer-events:none`，交互落中层（如 OrbitControls/滚动）。

### 技术约定

- 中层使用 `JadeModelLoader`（非 `JadeV6`），以便放入独立 Canvas 层。
- 歌词渲染读取同一份父级状态，不复制数据，不改逻辑，仅改变承载位置。
- 若需后处理（如 Bloom），在各自 Canvas 内独立添加，互不共享。

### 状态管理策略

- **单一数据源**：使用首页父级状态或 Zustand，禁止各层自管时间
- **共享状态**：`currentTime/scrollTime/isPlaying/anchorChar` 作为 props 传递给 `TopLyrics/BottomLyrics/Middle(JadeModelLoader)`
- **事件总线**：必要时仅做解耦，不复制状态逻辑

### 参数映射约定

- **材质参数**：创建 `JadeV6` → `JadeModelLoader` 参数映射表，确保视觉一致性
- **HDR环境**：使用同一 `environmentHdrPath` (`/textures/qwantani_moon_noon_puresky_1k.hdr`)
- **预加载**：沿用现有 `ModelPreloader`，避免重复加载
- **Canvas配置**：`alpha:true`、`dpr: Math.min(2, devicePixelRatio)`，移动端可关闭 MSAA

### 事件处理统一性

- **顶层**：`pointer-events:none`，仅显示不拦截交互
- **滚轮/触摸**：同时挂在 window 和中层 Canvas，Canvas 上 `preventDefault`
- **OrbitControls**：仅放中层，模型交互优先级最高
- **优先级**：模型交互 > 页面滚动，避免冲突

### 具体实施步骤

#### 1. 文件结构创建
```
src/components/layouts/
├── StackedLyricsAndModel.tsx    # 三层Canvas外壳
├── TopLyrics.tsx               # 前一行歌词（z≈0.5）
├── BottomLyrics.tsx            # 后两行歌词（z≈-0.5）
└── index.ts                    # 导出文件
```

#### 2. 布局开关实现
```typescript
// 在 src/app/page.tsx 或全局配置中
type LyricsLayout = 'front-back-back' | 'stacked-3canvas';

// 页面渲染时条件选择
return layout === 'front-back-back'
  ? <LegacyLyricsAndModel />
  : <StackedLyricsAndModel />;
```

#### 3. 参数映射表创建
创建 `JadeV6 → JadeModelLoader` 参数映射，确保：
- 内外层材质参数一致
- HDR环境路径相同
- 滚动控制参数对应
- 透明度控制可调

#### 4. 状态同步实现
- 从首页传递 `currentTime/scrollTime/isPlaying/anchorChar`
- 各子组件只做渲染，不管理状态
- 保持与现有音频事件系统的兼容性

### 测试策略

#### 视觉对齐测试
- **对比截图**：新旧布局的字号/行距/对齐/颜色对比
- **锚字切换**：日志验证切换时机与模型切换同步性
- **渐变效果**：淡入淡出节奏与原版一致

#### 性能测试
- **首屏时间**：三层Canvas加载时间不超过原版20%
- **内存曲线**：监控三个Canvas的内存占用
- **FPS基准**：桌面60FPS，移动端30FPS稳定
- **滚动延迟**：交互响应时间<100ms

#### 回滚验证
- **热切换**：`lyricsLayout` 运行时切换无异常
- **功能完整**：旧布局所有功能正常
- **状态保持**：切换时音频/播放状态不丢失

### 验收标准

- 开关可在运行时切换布局，旧布局可随时回滚。
- 三个 Canvas 叠加表现与 `layer-test` 一致；中层透明度可控。
- 歌词显示顺序与旧实现一致，滚动/播放/锚点联动正常。
- 桌面/移动端性能稳定（首屏加载、交互 FPS、内存占用合理）。

### 风险与后续

- 真实折射需升级 FBO 路线；当前版本为安全的 2D 叠加。
- 3D 文本参数可能与 DOM 样式略有差异，需要一轮视觉校准。

---

维护人：PM/FE 联合
更新时间：初始化于当前合并周期


