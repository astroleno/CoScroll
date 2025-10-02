# Screen-Space Dual-Pass Refraction TODO（方案2 实施文档）

目标：
- A 背景用于显示；B 背景离屏渲染到 RenderTarget，供主体屏幕空间折射采样。
- 形成可插拔的组件化能力，移动端安全，并具备质量/性能挡位与 Debug 安全网。

分阶段实施（里程碑）：
1) OffscreenMochiBackground → RenderTarget
2) ScreenSpaceRefractionMaterial（基础单步采样）
3) JadeV2 接入与运行时热切换
4) 页面层统一相机/色彩/尺寸与渲染顺序（B→A）
5) 质量提升（mip/模糊 → 厚度2-3步 → 轻度色散/IOR）
6) 色彩/性能与统计（rtScale、maxDPR、更新频率）
7) 文档与限制说明、推荐参数

—

必要补充（并入实现约束）
- 相机/视口对齐
  - 由页面统一注入 fov / near / far / viewport 至 A、B，两者使用同一套参数
  - resize 顺序：更新 B 的 RT 尺寸与相机 → 更新 A 的 renderer/camera
- 色彩管线一致
  - A 与 B 共用 ColorPipelineConfig：{ encoding, toneMapping, exposure }
  - 若使用 ACES，双方均为 ACES；禁止 B 内部自设
- 像素坐标 → UV 规则
  - uv = ndc * 0.5 + 0.5，并考虑 viewport 偏移/letterbox
  - 若 CSS scale 或 dpr≠1，统一用 renderSize 与 devicePixelRatio 修正
- 越界/遮挡处理
  - 折射后 UV 超出 [0,1]：clamp + edgeFade 衰减
  - 为多步厚度采样保留相同钳制逻辑
- 质量/性能挡位
  - rtScale ∈ {0.5, 0.75, 1.0}；maxDPR ≤ 2（移动端建议 0.75 ×，maxDPR 1.5~2）
  - B 的更新频率可配置：每帧/隔帧/低频（0.5–2s）
  - 基线先单步偏移；后续逐步开启提升项
- 素材设定（B）
  - 低频、强模糊、无边界图形；RMS 对比 ≤ 2%；与 A 同色温；主光方向一致
- 调试与安全网
  - Debug View：可在屏幕上直接显示 B 的 RT
  - 缺省/错误时回退至 MeshPhysicalMaterial，不中断渲染

—

组件与接口设计

1. OffscreenMochiBackground（独立组件）
- 责任：将 `ref/MochiBackground/mochi.ts` 渲染到 `WebGLRenderTarget`
- Props（建议）
  - cameraParams: { fov:number, near:number, far:number }
  - viewport: { width:number, height:number, dpr:number }
  - colorPipeline: { encoding, toneMapping, exposure }
  - rtScale?: 0.5|0.75|1.0（默认 0.75）
  - maxDPR?: number（默认 2）
  - updateRate?: 'every-frame' | 'half' | { seconds:number }（默认 { seconds: 1 }）
  - debugView?: boolean（默认 false）
- Outputs
  - renderTarget.texture（供折射采样）
  - effectiveSize（像素尺寸）
  - cameraParams（回传给 A 校验）
- 行为
  - 监听尺寸与 dpr，重建 RT；打印 RT 分辨率与更新耗时

2. ScreenSpaceRefractionMaterial（基础版）
- 责任：屏幕空间单步折射采样
- Uniforms（基础）
  - refractionMap: sampler2D（B 的 RT）
  - ior: number（默认 1.5）
  - refractionStrength: number（默认 1.0）
  - thickness: number（默认 1.1，仅参与偏移标量）
  - normalMap: sampler2D（可选）
  - normalScale: number（默认 0.3）
  - useEdgeFade: boolean（默认 true）
  - viewport, renderSize, dpr（用于 NDC/UV 计算与 letterbox 修正）
- 必备逻辑
  - distortionFromNormal（基于法线的 UV 偏移）
  - clampUV + edgeFade（越界渐隐）
  - 缺少 refractionMap 时自动回退

3. JadeV2 接入
- 新增 Props
  - useDualPassRefraction?: boolean（默认 false）
  - qualityPreset?: 'low'|'med'|'high'（默认 'med'）
  - useEdgeFade?: boolean（默认 true）
  - fallbackOnError?: boolean（默认 true）
  - refractionTexture?: Texture（从 OffscreenMochiBackground 注入）
- 行为
  - 运行时热切换材质（保留 uniforms/defines，避免 GC 抖动）
  - 回退策略：纹理缺失/管线不一致 → MeshPhysicalMaterial

4. 页面整合（渲染顺序与统一注入）
- 顺序：更新相机/尺寸 → 渲染 B（按 updateRate）→ 渲染 A
- 统一注入 cameraParams / viewport / colorPipeline 给 A 与 B
- 若存在后期合成，保证 B 更新在同帧优先于 A 采样

5. 质量提升（渐进式）
- a) mip/模糊采样：降低拉丝与 aliasing
- b) 2–3 步厚度：沿折射方向多次采样（可开关）
- c) 轻度色散/IOR：RGB 不同 IOR 微偏移
- 每步均验证“边界拉丝/越界”，必要时提升 edgeFade 强度

6. 色彩与性能
- 移动端上限：rtScale ≤ 0.75，maxDPR ≤ 2，maxSteps ≤ 2（若开启多步）
- 统计：打印 B 更新耗时、RT 像素尺寸、材质挡位（Low/Med/High）

7. 文档与限制
- 屏幕空间折射在遮挡/遮蔽区域存在失真；通过模糊与 edgeFade 掩饰
- 推荐参数集：
  - 移动端：rtScale 0.75，maxDPR 2，singleStep，edgeFade 强
  - 桌面静态：rtScale 1.0，mip/模糊 ON，singleStep
  - 展陈戏剧化：rtScale 1.0，多步=2~3，轻度色散，注意性能

—

验收标准（视觉）
- 玉的边缘“润光”明显，内部有缓慢流动且无条纹/干扰
- 纯色/渐变背景 A 上不显“塑料”，暗背景边缘不“脏”
- 快速 resize / 切换 DPR / 旋转屏幕，无坐标错位或颜色突变
- 关闭 B（或 B 静态）时，画面退化但不报错

—

风险清单与预案
- 相机不一致 → 统一从页面注入 cameraParams；渲染前断言校验
- 编码不一致 → 共享 ColorPipelineConfig；初始化时一致性检查
- 性能抖动 → B 低频更新；提供 rtScale 与 maxDPR；逐项开关提升项
- 透明排序 → 必要时做深度预通道或抖动弃片；避免透明互穿

—

实施顺序（可执行）：
1. 实现 OffscreenMochiBackground（含 rtScale、updateRate、debugView、colorPipeline）
2. 实现 ScreenSpaceRefractionMaterial（单步、edgeFade、clampUV）
3. JadeV2 接口与热切换、回退
4. 页面整合：对齐相机/色彩/尺寸与渲染顺序，增加面板控制
5. 质量提升：mip/模糊 → 厚度采样 → 色散（每步加入挡位）
6. 统计与移动端上限；补充 README 与接入指南


