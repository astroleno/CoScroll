# 多 Canvas 叠加 → 主站合并方案（结合现有歌词实现）

目标：把 `layer-test` 的“三层 Canvas 叠加”落到主站页面（如 `src/app/page.tsx`），在不改动歌词业务逻辑与 JadeV6 材质/动画的前提下，仅调整渲染承载与布局。

---
## 1. 现状与原则
- 歌词组件目前“前/后/后”运行稳定，含对齐、字号、行距、颜色、步进精度等控制；这些逻辑不改动，直接复用。
- 模型沿用 `JadeModelLoader`（源自 jade-v6 内容层，Canvas 无依赖），保持内外双层材质与 HDR 环境。
- 新布局通过三层 Canvas 做 2D 叠加：Bottom(后两行) / Middle(Jade) / Top(前一行)。无跨层深度与折射。

---
## 2. 开关化策略（推荐）
在页面/全局配置中增加布局开关：

```ts
type LyricsLayout = 'front-back-back' | 'top-bottom-bottom';
```

页面渲染时：

```tsx
return layout === 'front-back-back'
  ? <LegacyLyricsAndModel />
  : <StackedLyricsAndModel />; // 三层 Canvas 版本
```

这样旧实现可随时回滚，新实现灰度上线。

---
## 3. 三层 Canvas 外壳（与 layer-test 一致）

使用单格 Grid 叠放三层，避免 absolute 造成的尺寸/层级问题；每层独立一个 `<Canvas gl={{ alpha:true }}>`，中层可通过 `style={{ opacity }}` 控整层透明度。

```tsx
<div className="relative w-full h-screen grid grid-cols-1 grid-rows-1">
  {/* Bottom：后两行歌词 */}
  <div className="col-start-1 row-start-1">
    <Canvas gl={{ alpha:true }}>
      <Suspense fallback={null}>
        <BottomLyrics />
      </Suspense>
    </Canvas>
  </div>

  {/* Middle：Jade 模型 */}
  <div className="col-start-1 row-start-1" style={{ opacity: midOpacity }}>
    <Canvas gl={{ alpha:true }}>
      <Suspense fallback={null}>
        <Environment preset="sunset" background={false} />
        <JadeModelLoader modelPath="/models/10k_obj/001_空.obj" fitToView enableRotation />
        <OrbitControls />
      </Suspense>
    </Canvas>
  </div>

  {/* Top：前一行歌词（最上层，禁用指针事件） */}
  <div className="col-start-1 row-start-1 pointer-events-none" aria-hidden>
    <Canvas gl={{ alpha:true }}>
      <Suspense fallback={null}>
        <TopLyrics />
      </Suspense>
    </Canvas>
  </div>
</div>
```

注意：
- `Suspense` 包裹 `<Text>`/`<Environment>` 等异步资源，防止挂起时空白。
- 顶层/中层 Canvas 背景应透明；底层可用主题底色或渐变。
- 事件路由：顶层一般 `pointer-events:none`，交互落到中层；有 UI 时再开启。

---
## 4. 歌词复用方式（不改业务逻辑）

把现有歌词组件按“渲染层”拆成两个可复用块：
- `TopLyrics`：渲染原“前层”一行（z≈0.5）的 JSX
- `BottomLyrics`：渲染原“后层×2”（z≈-0.5）的 JSX

两者都读取同一份父级状态（当前行、对齐位置、字号/行距/颜色等），仅改变渲染承载的 Canvas 与插槽位置。不要复制数据或改动逻辑。

隐藏旧实现时，优先“条件不渲染”而非仅 CSS 隐藏，以节省资源。

---
## 5. 性能与兼容
- 移动端建议限制 DPR（如 `gl={{ dpr: Math.min(2, window.devicePixelRatio) }}`）并禁用 MSAA。
- 三个 Canvas 的后处理互不共享；若需 Bloom，请在各自 Canvas 内单独添加。
- Jade 日志里出现的 `sRGB encoded textures` 警告可后续统一规整，不影响功能。

---
## 6. 升级路径（如需真实折射）
现方案为 2D 叠加，不会“折射到底层 Canvas”。若需要：
1. 在 Middle 使用 `useFBO()` 捕捉 Bottom 的画面为纹理；
2. 把该纹理作为 Middle 场景的 `scene.background` 或材质采样源；
3. JadeV6 仍可保持 `MeshPhysicalMaterial + transmission` 流程。

---
## 7. 合并 Checklist
- [ ] 新布局组件（StackedLyricsAndModel）完成，接入三段插槽。
- [ ] Bottom/Top 复用现有歌词渲染块，Middle 引入 `JadeModelLoader`。
- [ ] 桌面/移动端性能验证（FPS、内存、热力图）。
- [ ] `lyricsLayout` 开关可灰度/回滚。
- [ ] 设计/产品说明更新。

---
## 8. 结论
不改动任何歌词业务逻辑，仅替换承载与布局即可上线“三层叠加”。旧布局通过开关保留，风险可控；如需更高视觉诉求（真实折射/特效），再按 FBO 路线增量演进。
