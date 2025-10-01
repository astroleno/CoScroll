# Codex 开发进度概览

## 当前成果

- 新增 `src/components/core/NeonModel3D/` 独立渲染组件，集成 Canvas、灯光、雾化、Fresnel Shader 与后期特效（Bloom/ChromaticAberration/Noise/Vignette），可单独预览霓虹雾化风格。
- `neonMaterial.ts` 封装自定义 Shader 参数，支持渐变色、呼吸发光、粒子噪点，方便后续以配置形式调色和调节强度。
- 组件支持 `quality` 分级（low/medium/high），自动调整 DPR、Bloom 强度等，以兼顾移动端性能和视觉效果。
- 通过 `index.ts` 导出组件与配置类型，便于在主程序或实验页面中直接引用。
- 优化模型加载：使用 `SkeletonUtils.clone` 深拷贝 GLTF、在卸载时释放 Shader，关闭裁剪与容器尺寸兜底，确保独立渲染更稳。
- 新建 `/neon-preview` 客户端页面，提供质量档位与配色预设切换，用于快速观测渲染效果（当前仍在排查 Next.js 开发时的报错，详细见下文待办）。

## 待处理事项

- `/neon-preview` 在 Next.js 开发模式下仍出现 “missing required error components, refreshing...” 与 404，需要继续定位（可能与客户端导入或错误边界缺失相关）。
- 项目现有 TypeScript 校验仍包含历史错误（滚动 store 字段缺失、模型数据类型为只读数组等）；需要统一修正后保证 neon 组件随项目一起通过 `npm run type-check`。
- 移动端性能与发热情况尚未验证，需要在目标设备上测试高/中/低质量档的帧率与稳定性。
- 未与现有滚动/音频逻辑整合；组件对外 API 需继续保持解耦并设计统一的滚动信号对接方案。
- 预览页目前只支持预设切换，后续仍需引入参数可视化调节（如 Leva）和模型文件切换入口。

## 下一步计划

1. 修复 `/neon-preview` 在开发模式下的错误组件缺失问题，确保页面能稳定渲染并展示模型。
2. 在目标移动设备（iOS/安卓至少各一台）运行组件，记录 `quality` 档位的 FPS、内存占用及潜在降级策略。
3. 清理 `useScrollStore`、`useModel` 等历史类型问题，确保 `npm run type-check` 通过并为后续集成打基础。
4. 扩充预览页调参能力：引入实时参数 UI、模型选择/上传，提升 QA 与调色效率。
5. 完成与主渲染流程的接入设计：明确滚动/时间输入、错误边界、加载状态，以及与其它特效层的叠加方式。
