# Claude Code 协作指南

## 项目概述

**CoScroll** 是一个沉浸式心经数字体验应用，结合音频播放、LRC歌词同步、3D视觉效果和滚动交互。用户通过自动播放的心经音频体验禅意，滚动操作控制播放感受而非传统翻页。本项目使用 Claude Code 进行协作开发。

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
- **Framer Motion** - 过渡动画
- **Zustand** - 状态管理
- **HTML5 Audio API** - 音频播放和控制
- **TailwindCSS** - 样式框架

### 文件结构要点
```
src/
├── components/
│   ├── core/              # 核心功能组件 (Model3D, SegmentTransition)
│   └── layout/            # 布局组件 (AnchorGlyphRegion, SubtitlesPane)
├── hooks/                 # 自定义Hooks (usePlaybackControl, useHeartSutraAudio)
├── stores/               # Zustand状态管理 (scrollStore)
├── utils/                # 工具函数 (lrcParser)
├── data/                 # 数据文件 (heartSutra)
└── app/                  # Next.js页面

public/
├── audio/                # 音频文件 (心经.mp3)
├── lyrics/               # 歌词文件 (心经.lrc)
└── models/10k/           # 3D模型文件
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
- 主要hooks:
  - `usePlaybackControl` - 播放控制和状态管理
  - `useHeartSutraAudio` - 音频播放和LRC解析
  - `useSegmentTimer` - 段落切换定时器
  - `useScrollStore` - 滚动状态管理
- 遵循React Hooks规范

### 类型定义
- 所有接口定义在 `src/types/` 目录
- 按功能模块分文件: `content.types.ts`, `model.types.ts`
- 为未来AI集成预留接口定义

## 关键文件说明

### 核心组件
- `AnchorGlyphRegion.tsx` - 主要的3D区域，包含Three.js画布和控制界面
- `Model3D.tsx` - 3D模型渲染和自动旋转逻辑
- `SegmentTransition.tsx` - 段落切换动画组件
- `SubtitlesPane.tsx` - 字幕显示面板

### 数据文件
- `heartSutra.ts` - 心经文本分段数据
- `lrcParser.ts` - LRC歌词解析工具
- `心经.lrc` - 完整心经歌词时间轴
- `心经.mp3` - 心经音频文件

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

### 调整音频播放和循环
1. 编辑 `src/utils/lrcParser.ts` 修改循环截止时间
2. 在 `src/hooks/useHeartSutraAudio.ts` 调整渐弱效果
3. 更新LRC时间轴解析逻辑

### 添加新的3D模型
1. 将GLB文件放置在 `public/models/10k/` 目录
2. 在 `Model3D.tsx` 中更新模型路径
3. 测试模型加载和旋转效果

### 调整滚动控制
1. 编辑 `src/hooks/usePlaybackControl.ts`
2. 修改滚动速度映射算法
3. 在 `scrollStore.ts` 中调整滚动监听

### 修改段落切换动画
1. 编辑 `src/components/core/SegmentTransition.tsx`
2. 调整Framer Motion动画参数
3. 更新过渡时间和效果

## 故障排除

### 常见问题

**3D球体不显示:**
- 检查Camera位置和FOV设置
- 确认meshBasicMaterial颜色配置
- 查看浏览器控制台的Three.js错误

**音频不播放:**
- 确认用户已有交互行为（浏览器限制）
- 检查 `/public/audio/心经.mp3` 文件路径
- 验证HTML5 Audio API初始化状态

**LRC歌词不同步:**
- 检查 `/public/lyrics/心经.lrc` 文件格式
- 验证lrcParser.ts的时间解析逻辑
- 确认getCurrentLyric函数返回值

**滚动不影响播放:**
- 检查scrollStore的事件监听器
- 确认usePlaybackControl中的速度映射
- 验证滚动速度计算算法

**切换动画不流畅:**
- 检查SegmentTransition的Framer Motion配置
- 调整transition的spring参数
- 确认isTransitioning状态管理

### 调试步骤
1. 检查浏览器控制台错误
2. 验证状态store中的数据
3. 确认组件props传递
4. 检查Three.js渲染状态
5. 测试音频上下文状态

## 当前开发状态

### 已完成功能 ✅
- [x] 心经音频播放系统
- [x] LRC歌词时间轴解析
- [x] 2:27自动循环和渐弱效果
- [x] 3D球体自动旋转（临时替代模型）
- [x] 滚动控制播放速度
- [x] 段落切换动画框架
- [x] 音频控制界面

### 待完成任务 🚧
1. 集成3D书法模型替代球体
2. 完善段落切换动画效果
3. 优化音频渐弱过渡
4. 添加更多交互控制
5. 性能优化和测试

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