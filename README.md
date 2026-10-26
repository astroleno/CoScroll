# CoScroll - 数字经卷体验

> AI驱动的3D书法与音频同步的沉浸式滚动体验

## 当前基线与经典接入

- [曲目与专属手写开场制作](docs/TRACK_PRODUCTION.md)：制曲模型自动创作短序，Inko 制作与冻结资源，构建检查每首曲目的完整开场。
- [工程经验与多经典接入规范](docs/CLASSICS_INTEGRATION_SPEC.md)：现有能力、视觉约束、百字模型入库、配置与切换要求、验收及发布。
- [75 个 V2 模型入库](docs/V2_75_MODEL_INTEGRATION_20261023.md)：替换 7 个、补入 68 个，连同原 26 个 OBJ 共 101 个源模型；来源、完整几何校验与交付边界。
- [曲目切换、画面设置与模型占位方案](docs/PLAYBACK_APPEARANCE_MODEL_PLAN.md)：已实现心经/赞诗切换、明确占位与按曲目调色；保留原丝绸背景。
- [妙法莲华经内容核对](docs/LOTUS_SUTRA_CONTENT_REVIEW_20261022.md)：音源指纹、33 句歌词、重复段、时间点与补字依据。
- [手机首载与长帧验收](docs/MOBILE_BOOT_STALL_RELEASE_20261023.md)：无损压缩交付、音频探测、完整模型分片恢复、画面对照和两站实测。
- [七字模型接入记录](docs/PRIORITY7_MODEL_INTEGRATION_20261022.md)：妙、化、竹、海、土、雨、天的正式替换、手机回归、两站发布与性能限制。
- [iPhone 字形分包、加载与长帧验收](docs/IPHONE_PERFORMANCE_RELEASE_20261022.md)：同源字形、完整字体回退、慢网对照与实际性能边界。
- [妙法莲华经接入与公网验收](docs/LOTUS_SUTRA_RELEASE_20261022.md)、[此前无限滚动验收](docs/CONTINUOUS_SCROLL_RELEASE_20261021.md)与 [COS/CDN 发布流程](docs/COSCROLL_RELEASE.md)。

## 发布与交接规则

提交、推送和公网发布按用户本次授权执行。用户已授权完整发布链路时，连续完成提交推送、部署替换、双站验收和清理；以两站公网 `release-health.json` 和页面内容均匹配本次正式候选作为上线完成标准。

| 站点 | 正式入口 | 兼容入口 |
| --- | --- | --- |
| aitoshuu.me | [CoScroll](https://aitoshuu.me/CoScroll/) | [coscroll](https://aitoshuu.me/coscroll/) |
| tongye.me | [CoScroll](https://tongye.me/CoScroll/) | [coscroll](https://tongye.me/coscroll/) |

正式路径固定为驼峰 `/CoScroll/`；小写 `/coscroll`、`/coscroll/` 及子路径以 308 跳转到本站正式路径，保留曲目参数、重复查询参数和编码子路径。缺失资源仍返回 404。发布标识 `coscroll-<digest>`、CDN 对象前缀及服务器目录沿用原有小写形式。

1. **制曲与检查**：新增曲目或替换 MP3/LRC 时，由制曲模型自动创作专属短序并按[制作流程](docs/TRACK_PRODUCTION.md)生成、冻结真实 Inko 开场；输入未变时复用已验收资源。执行 `npm run tracks:check`、`npm run test:deployment` 和 `npm run test:runtime`，必要检查失败须修复后再发布。
2. **提交与构建**：先将本轮产品改动 commit、push，再从该提交的干净源码生成 `cdn` 正式候选，完成生产构建、类型检查和包校验。可用普通构建副本隔离无关的未提交文件；记录提交 ID、release ID 和交付闭包 SHA-256。
3. **上传与切换**：上传不可变 COS 对象，完整核验 CDN 内容后暂存并核验源站文件。保存配置、当前发布链接、邻站基线与回滚目标；切换前再次核对现网，发现并行维护时按最新状态重新审阅合并，保留其他项目的更新。通过 `nginx -t` 后，原子切换 CoScroll 自身发布链接并按需重载。CDN 校验按现有 10 Mbps 封顶限速，四路、每路最高 150 KiB/s，并与浏览器大文件下载错开。
4. **公网 HTTP 验收**：逐一检查上表四个入口，核验两站全部源站文件及 CDN 交付物的内容摘要、编码、MIME、缓存、CORS 和音频 Range；检查规范跳转、参数保留、真实 404、安全响应头及首页、LuBirth 入口。共享 CDN 内容可完整校验一次，再按两站分别核验现场元数据和跨域行为，记录清楚两种校验口径。
5. **真实浏览器验收**：两站、两种入口逐一覆盖《心经》《妙法莲华经》及本轮受影响曲目；覆盖手机竖屏、横屏和桌面，检查专属手写开场、触摸/Enter/Space 开始、播放暂停及相关交互。补测图片失败时的同文后备，确认无意外自动播放、页面错误或资源泄漏；未做的真机、Safari 等检查如实记录。
6. **清理与回滚保留**：截图查看后删除，关闭本轮测试页面/空间，清理本轮临时候选、构建副本、隔离依赖、脚本和日志。保留正式手写资源及来源档案、生产交付物、旧版本和配置回滚备份；仅清理本轮材料。回滚时核对最新共享配置，合并恢复与旧包 basePath 一致的 CoScroll 规则，保留后续维护。
7. **归档与交付**：将发布身份、双站验收结果、清理结果、回滚依据及未测项写入 `docs/`，再将验证记录 commit、push，核实远端同步后交付。

命令、基础设施和发布细节见 [COS/CDN 发布流程](docs/COSCROLL_RELEASE.md)；完整交接示例见[专属序言与入口大小写公网发布](docs/INKO_CASE_ENTRY_RELEASE_20261026.md)。

下文保留了早期 MVP 的实现说明；新增经典请先阅读接入规范，其中明确区分现状与待实现模块。

## 项目概述

CoScroll 是一个结合滚动交互、3D书法模型和音频同步的数字经卷体验应用。通过滚动操作，用户可以体验文字前后交替显示、3D模型同步旋转和音频速度同步的沉浸式阅读体验。

### 核心功能

- 📜 **滚动驱动**: 上下滚动控制整体节奏
- 🎨 **3D书法**: 书法模型根据滚动速度旋转
- 📝 **文字交替**: 一行在模型前方，一行在后方交替显示
- 🎵 **音频同步**: 音频播放速度与滚动速度同步
- 🧘 **沉浸体验**: 简约设计，专注于内容本身
- ✨ **噪点效果**: 程序化生成的噪点纹理，增强视觉质感

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

### 玉质渲染组件系列

#### JadeV6 - 背景环境分离组件
- **路径**: `/src/components/jade/JadeV6.tsx`
- **特性**: 实现背景显示与环境贴图的完全分离
- **技术实现**:
  - `scene.background` = 纯色背景（用户可见）
  - `scene.environment` = HDR 环境贴图的 PMREM（材质采样）
  - 支持 MeshPhysicalMaterial 的 transmission 折射
- **使用场景**: 需要纯色背景但保持高质量折射效果的场景
- **访问路径**: `/jade-v6`

### 3D字幕系统

#### Lyrics3DRenderer - 3D字幕渲染组件
- **路径**: `/src/components/lyrics/Lyrics3DRenderer.tsx`
- **特性**: 基于Troika Text的3D字幕渲染系统
- **核心功能**:
  - "前-后-后"循环空间布局
  - 与锚字3D模型的遮挡交互
  - 动态LOD系统和性能优化
  - 视锥剔除和实例化渲染
- **技术实现**:
  - Troika Text (SDF技术)
  - Zustand状态管理
  - 自适应质量调整
  - 内存管理和垃圾回收
- **使用场景**: 沉浸式3D经卷体验
- **访问路径**: `/lyrics3d-example`

#### Lyrics3DStore - 状态管理系统
- **路径**: `/src/stores/lyrics3DStore.ts`
- **特性**: 统一的3D字幕状态管理
- **核心功能**:
  - 与LyricsController的状态同步
  - 性能监控和自适应调整
  - 锚字模型管理
  - 质量级别控制

### 噪点效果组件系列

#### AdvancedNoiseOverlay - 高级噪点覆盖层
- **路径**: `/src/components/AdvancedNoiseOverlay.tsx`
- **特性**: 程序化生成的噪点纹理，支持多种噪点类型和混合模式
- **技术实现**:
  - 支持 Perlin、Simplex、White、Blue、Pink 噪声
  - 分形布朗运动 (FBM) 实现复杂噪点纹理
  - 多种混合模式：normal、multiply、overlay、screen 等
  - 实时动画和响应式调整
- **使用场景**: 增强视觉质感，添加胶片颗粒感
- **访问路径**: `/noise-test` (测试页面)

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

### 当前版本: MVP v0.2.0

- [x] 基础框架搭建
- [x] 核心组件开发
- [x] 滚动交互实现
- [x] 3D 模型集成
- [x] 音频同步功能
- [x] 数据结构设计
- [x] JadeV6 背景环境分离组件

### 计划功能

- [ ] LLM 文本分析集成
- [ ] 更多书法模型库
- [ ] 用户自定义内容
- [x] 移动端优化
- [x] 性能监控
- [x] 3D字幕集成系统

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
