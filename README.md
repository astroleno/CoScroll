# CoScroll - 数字经卷体验

> AI驱动的3D书法与音频同步的沉浸式滚动体验

## 项目概述

CoScroll 是一个结合滚动交互、3D书法模型和音频同步的数字经卷体验应用。通过滚动操作，用户可以体验文字前后交替显示、3D模型同步旋转和音频速度同步的沉浸式阅读体验。

### 核心功能

- 📜 **滚动驱动**: 上下滚动控制整体节奏
- 🎨 **3D书法**: 书法模型根据滚动速度旋转
- 📝 **文字交替**: 一行在模型前方，一行在后方交替显示
- 🎵 **音频同步**: 音频播放速度与滚动速度同步
- 🧘 **沉浸体验**: 简约设计，专注于内容本身

## MVP 版本特性

- ✅ 心经文本体验
- ✅ 道字 3D 模型 (003_道.glb)
- ✅ 基础滚动交互
- ✅ 硬编码内容数据
- ✅ 预留 AI 集成接口

## 技术栈

### 核心框架
- **Next.js 14** - React 应用框架
- **TypeScript** - 类型安全
- **TailwindCSS** - 样式框架

### 3D 渲染
- **Three.js** - 3D 图形库
- **React Three Fiber** - React Three.js 集成
- **React Three Drei** - Three.js 工具组件

### 状态管理
- **Zustand** - 轻量状态管理
- **TanStack Query** - 数据获取和缓存

### 音频处理
- **Tone.js** - Web 音频处理
- **Web Audio API** - 原生音频控制

## 项目结构

```
CoScroll/
├── src/
│   ├── app/                    # Next.js App Router
│   ├── components/
│   │   ├── core/              # 核心组件 (ScrollCanvas, TextFlow, Model3D, AudioController)
│   │   ├── ui/                # UI 组件 (Loader, ErrorBoundary)
│   │   └── layout/            # 布局组件
│   ├── hooks/                 # 自定义 Hooks (useScroll, useText, useAudio, useModel, useSync)
│   ├── stores/                # Zustand 状态管理
│   ├── types/                 # TypeScript 类型定义
│   ├── data/                  # 硬编码数据 (MVP 阶段)
│   └── utils/                 # 工具函数
├── public/
│   ├── models/10k/            # 3D 模型文件
│   ├── audio/                 # 音频文件
│   └── images/                # 图片资源
└── docs/                      # 项目文档
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```

### 3. 访问应用
打开 [http://localhost:3000](http://localhost:3000) 查看应用

## 使用说明

1. **进入体验页面**: 点击首页的"开始体验"按钮
2. **滚动交互**: 使用鼠标滚轮或键盘箭头键控制滚动
3. **观察同步**: 文字、3D模型旋转和音频播放会根据滚动速度同步变化
4. **音频控制**: 点击底部播放按钮控制音频播放

## 开发指南

### 核心组件

1. **ScrollCanvas** (`/src/components/core/ScrollCanvas.tsx`)
   - 主要的 Three.js 画布组件
   - 整合所有核心功能

2. **TextFlow** (`/src/components/core/TextFlow.tsx`)
   - 处理文字的前后交替显示
   - 使用 `@react-three/drei` 的 Text 组件

3. **Model3D** (`/src/components/core/Model3D.tsx`)
   - 3D 模型渲染和旋转控制
   - 支持 GLB 模型加载

4. **AudioController** (`/src/components/core/AudioController.tsx`)
   - 音频播放控制和同步
   - 基于 Tone.js 实现

### 自定义 Hooks

- **useScroll**: 滚动事件处理和状态管理
- **useText**: 文本数据和段落导航
- **useAudio**: 音频播放控制
- **useModel**: 3D模型管理
- **useSync**: 核心同步逻辑

### 状态管理

使用 Zustand 管理全局状态：
- `scrollStore`: 滚动相关状态
- `contentStore`: 文本内容状态
- `audioStore`: 音频播放状态

## 扩展开发

### 添加新的文本内容

1. 在 `/src/data/mvp-content.ts` 中添加新的文本段落
2. 确保每个段落包含 `anchorWord` 用于模型匹配

### 添加新的 3D 模型

1. 将 GLB 文件放置在 `/public/models/10k/` 目录
2. 在 `mvp-content.ts` 的 `models` 对象中添加模型信息
3. 确保文件路径正确

### 音频集成

1. 将音频文件放置在 `/public/audio/` 目录
2. 在音频配置中指定文件路径
3. 支持 MP3、WAV 等格式

## 性能优化

- 模型预加载和缓存
- 音频流式加载
- Three.js 渲染优化
- 组件懒加载

## 浏览器支持

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

要求支持 WebGL 2.0 和 Web Audio API

## 项目状态

### 当前版本: MVP v0.1.0

- [x] 基础框架搭建
- [x] 核心组件开发
- [x] 滚动交互实现
- [x] 3D 模型集成
- [x] 音频同步功能
- [x] 数据结构设计

### 计划功能

- [ ] LLM 文本分析集成
- [ ] 更多书法模型库
- [ ] 用户自定义内容
- [ ] 移动端优化
- [ ] 性能监控

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 联系方式

- 项目链接: [https://github.com/yourusername/CoScroll](https://github.com/yourusername/CoScroll)
- 问题反馈: [Issues](https://github.com/yourusername/CoScroll/issues)

---

**CoScroll** - 让古典文化在数字时代焕发新的生命力 ✨