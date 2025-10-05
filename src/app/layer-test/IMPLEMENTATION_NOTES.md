# layer-test 实现笔记

## 实现概览
- 使用三个 `@react-three/fiber` `<Canvas>` 叠加，实现“底层背景文字 + 中层 Jade 模型 + 顶层提示文字”的布局。
- 为避免绝对定位导致部分 Canvas 被压缩至 0 尺寸，改用单格 CSS Grid (`grid-cols-1`/`grid-rows-1`) 将三层 Canvas 叠放在同一单元。
- 中层直接复用 `JadeModelLoader`，保持 JadeV6 的双层材质、HDR 环境、旋转控制等所有参数；底层与顶层用 drei `<Text>` 提供中文文案。
- 页面背景设置为 `#1f1e1c`，额外叠加一个径向渐变层营造 JadeV6 风格的光晕。
- 透明度滑块 & 调试信息放在固定面板，便于调节中层 Canvas 透明度验证遮挡效果。

## 开发踩坑
- **多 Canvas 叠加**：直接 `absolute` + `z-index` 在当前 Tailwind 配置下会被父容器高度/定位影响，导致上层 Canvas 不渲染。改用 Grid 后每层都拥有完整宽高。
- **Suspense 边界**：`<Text>` 和 `<Environment>` 会异步加载资源，必须用 `<Suspense fallback={null}>` 包裹，否则 Canvas 会在资源挂起时保持空白。
- **调试技巧**：逐层替换为简单几何体、使用彩色背景排查渲染路径，可快速确认问题来自布局还是模型自身。

## 叠加方案补充要点
- 中层 `Environment` 应保持 `background={false}`，底层与顶层 Canvas 需透明背景，才能让下方内容透出；目前底层保持纯色、其它层显式 `style={{ background: 'transparent' }}` 可避免默认黑底遮挡。
- 三层视角默认独立，如果要完全同步可在顶/底层 `useFrame` 内拷贝中层相机矩阵；当前实现允许轻微差异，未引入额外同步逻辑。
- DOM 顺序即叠放顺序：Grid 叠层已经稳定，但仍建议保持 Bottom → Middle → Top 的渲染顺序，便于阅读与调试。

## 性能与后续优化
- 三个 Canvas 会提高 GPU/CPU 压力，特别在移动端。可根据需要追加 `gl={{ dpr: Math.min(2, window.devicePixelRatio) }}`、关闭顶层阴影等降低开销。
- Jade 模型中仍会看到 `THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType` 提示，后续可在加载 HDR/纹理后统一走 PMREM 并设置 `texture.type/format` 消除此警告。
- 目前是“2D 叠加”方案，并未实现跨 Canvas 折射。如果要让玻璃层折射底层文字，需要额外用 FBO 把底层渲染成贴图传入中层材质。
- 如果需要 Glow/Bloom，需在各自 Canvas 内独立配置后处理，跨 Canvas 不共享。

## Lyrics Top-Bottom-Bottom 布局思路
需求：保持 `src/app/page.tsx` 中的歌词样式与动画不变，仅调整展示位置为 `top / bottom / bottom`。建议步骤：
1. **保留现有样式定义**：不要大幅重写 `page.tsx` 内的歌词组件，只在布局层对三个歌词段落增加“目标插槽”。
2. **引入布局容器**：在主页 (非测试页) 上新增一个接收 `topLine` / `bottomLinePrimary` / `bottomLineSecondary` 的布局组件。该组件可以复用当前滚动 / 动画逻辑，只是渲染时把第一行放上方，两行堆叠在下方，并通过已有的 `textAlign`、`transform` 属性保持左右对齐。
3. **隐藏旧位置，启用新插槽**：不要删掉现有实现，可将旧的“前/后/后”插槽包在条件渲染里，通过配置开关切换到新的 Top/Bottom/Bottom 布局。如：
   ```tsx
   const layout = useLyricsLayout(); // 读取配置
   return layout === 'front-back-back'
     ? <FrontBackBackLayout {...props} />
     : <TopBottomBottomLayout {...props} />;
   ```
   这样既能回滚，又方便 A/B 测试。
4. **数据层保持不变**：歌词状态、播放同步、滚动节奏全部沿用现有 Hooks。新布局只负责在渲染时把同一份文本插入不同 DOM 结构即可。
5. **上线策略**：建议在主页面直接集成新的布局（而非 layer-test），但先在单独分支或 Feature Flag 下调试、验证动画表现后再默认开启。

总结：不需要在 layer-test 上整合，也不必重写动画；只要把主页原有的歌词模块封装成可切换布局的组件，新增一个 Top/Bottom/Bottom 布局即可实现需求。
