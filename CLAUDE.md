# Claude Code 协作指南

## 项目概述

**CoScroll** 是一个结合滚动交互、3D书法模型和音频同步的数字经卷体验应用。本项目使用 Claude Code 进行协作开发，这个文档记录了项目的核心信息和开发规范。

## 核心命令

### 开发命令
```bash
# 启动开发服务器
npm run dev

# 构建项目
npm run build

# 类型检查
npm run type-check

# 代码检查
npm run lint
```

### 测试命令
```bash
# 运行测试（如果配置了）
npm test

# 检查现有模型文件
ls public/models/10k/

# 检查音频文件
ls public/audio/
```

## 项目架构

### 核心技术栈
- **Next.js 14** - React 应用框架
- **TypeScript** - 类型安全
- **Three.js + React Three Fiber** - 3D渲染
- **Zustand** - 状态管理
- **Tone.js** - 音频处理
- **TailwindCSS** - 样式框架

### 文件结构要点
```
src/
├── components/core/        # 核心功能组件
├── hooks/                 # 自定义Hooks
├── stores/               # Zustand状态管理
├── types/                # TypeScript类型定义
├── data/                 # MVP硬编码数据
└── app/                  # Next.js页面
```

## 开发规范

### 组件开发
- 所有组件使用 TypeScript
- 核心组件放在 `src/components/core/`
- UI组件放在 `src/components/ui/`
- 使用 `'use client'` 指令标记客户端组件

### 状态管理
- 使用 Zustand 进行全局状态管理
- 主要stores: `scrollStore`, `contentStore`, `audioStore`
- 状态更新通过store中的方法进行

### 自定义Hooks
- 核心逻辑通过自定义Hooks封装
- 主要hooks: `useScroll`, `useText`, `useAudio`, `useModel`, `useSync`
- 遵循React Hooks规范

### 类型定义
- 所有接口定义在 `src/types/` 目录
- 按功能模块分文件: `content.types.ts`, `model.types.ts`
- 为未来AI集成预留接口定义

## 关键文件说明

### 核心组件
- `ScrollCanvas.tsx` - 主要的Three.js画布，整合所有功能
- `TextFlow.tsx` - 文字前后交替显示逻辑
- `Model3D.tsx` - 3D模型加载和旋转控制
- `AudioController.tsx` - 音频播放和同步控制

### 数据文件
- `mvp-content.ts` - MVP阶段的硬编码数据
- 包含心经文本分段和模型映射

### 配置文件
- `next.config.js` - 支持GLB模型和音频文件加载
- `tailwind.config.js` - 中文字体和动画配置
- `tsconfig.json` - TypeScript路径映射配置

## 调试信息

### 开发环境监听
项目配置了开发环境下的状态监听，会在控制台输出：
- 滚动速度变化
- 音频播放状态
- 内容索引变化
- 组件错误信息

### 性能监控
- Three.js性能监控 (FPS, 内存使用)
- 音频同步延迟监控
- 滚动响应性能监控

## 常见任务

### 添加新的文本内容
1. 编辑 `src/data/mvp-content.ts`
2. 在 `heartSutra.segments` 数组中添加新段落
3. 确保每个段落包含 `anchorWord` 用于模型匹配

### 添加新的3D模型
1. 将GLB文件放置在 `public/models/10k/` 目录
2. 在 `mvp-content.ts` 的 `models` 对象中添加模型信息
3. 更新模型映射逻辑

### 调整滚动同步算法
1. 编辑 `src/hooks/useSync.ts`
2. 修改 `getRotationSpeed()` 和 `getPlaybackRate()` 函数
3. 在 `ScrollCanvas` 中测试同步效果

### 音频配置调整
1. 编辑 `src/hooks/useAudio.ts`
2. 调整Tone.js效果参数
3. 修改 `audioStore.ts` 中的默认值

## 故障排除

### 常见问题

**3D模型不显示:**
- 检查模型文件路径是否正确
- 确认模型文件大小和格式
- 查看浏览器控制台的Three.js错误

**音频不播放:**
- 确认用户已有交互行为（浏览器限制）
- 检查音频文件路径和格式
- 查看Tone.js初始化状态

**滚动不响应:**
- 检查事件监听器是否正确绑定
- 确认scrollStore状态更新
- 验证useSync Hook的同步逻辑

**类型错误:**
- 运行 `npm run type-check` 检查类型
- 确认接口定义的一致性
- 检查导入路径是否正确

### 调试步骤
1. 检查浏览器控制台错误
2. 验证状态store中的数据
3. 确认组件props传递
4. 检查Three.js渲染状态
5. 测试音频上下文状态

## MVP开发重点

### 当前阶段目标
- [x] 基础架构完成
- [ ] 组件功能实现
- [ ] 现有模型集成 (`003_道.glb`)
- [ ] 音频同步验证
- [ ] 交互逻辑完善

### 下一步任务
1. 安装并解决依赖冲突
2. 实现ScrollCanvas的具体渲染逻辑
3. 集成现有的道字模型
4. 添加测试音频文件
5. 验证核心交互功能

### 性能目标
- 滚动响应延迟 < 16ms (60fps)
- 音频同步延迟 < 200ms
- 3D模型加载时间 < 3s
- 首屏加载时间 < 5s

## 扩展计划

### AI集成准备
- `ITextProcessor` 接口已预留
- `LLMProcessor` 服务框架已定义
- 支持动态文本分析和锚字提取

### 模型库扩展
- `IModelManager` 接口支持动态加载
- 模型缓存和预加载机制
- 支持100+书法模型库

### 音频增强
- 多音轨支持
- 实时音效处理
- 音频可视化效果

## 团队协作

### 代码提交规范
```bash
# 功能开发
git commit -m "feat: add scroll synchronization logic"

# 问题修复
git commit -m "fix: resolve audio playback delay issue"

# 文档更新
git commit -m "docs: update component usage guide"
```

### 分支策略
- `main` - 稳定版本
- `develop` - 开发分支
- `feature/*` - 功能分支
- `bugfix/*` - 问题修复

### Review要点
- 类型安全性检查
- 性能影响评估
- 用户体验一致性
- 代码可维护性

---

## 联系与支持

如有问题或建议，请通过以下方式联系：
- 项目Issues: [GitHub Issues](https://github.com/username/CoScroll/issues)
- 技术讨论: 项目Discussion区
- 紧急问题: 直接联系项目维护者

**记住**: 保持代码简洁、注释清晰、测试充分！🚀