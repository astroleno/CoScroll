# 配置系统使用指南

## 📖 概述

CoScroll 现在支持**完全可配置化**，无需修改代码即可：
- ✅ 更换歌曲和歌词
- ✅ 修改颜色主题
- ✅ 调整锚字和模型映射
- ✅ 编辑时间轴

---

## 🚀 快速开始

### 1. 配置文件位置

所有配置都在 **JSON 文件** 中：

```
public/projects/heart-sutra.json  ← 心经项目配置
```

### 2. 如何使用配置

#### 方法 A：修改现有配置

直接编辑 `public/projects/heart-sutra.json`，然后刷新页面即可看到效果。

#### 方法 B：创建新项目

1. 复制现有配置：
   ```bash
   cp public/projects/heart-sutra.json public/projects/my-song.json
   ```

2. 修改配置内容（见下方详细说明）

3. 在代码中加载新配置：
   ```typescript
   // src/app/page.tsx
   loadProject('my-song');  // 改为你的项目名
   ```

---

## 📝 配置文件结构

```json
{
  "version": "1.0.0",
  "project": { ... },      // 项目元信息
  "assets": { ... },       // 资源路径（音频/歌词/模型）
  "theme": { ... },        // 主题颜色
  "anchors": { ... },      // 锚字到模型的映射
  "timeline": [ ... ],     // 时间轴锚点
  "performance": { ... }   // 性能配置
}
```

---

## 🎵 修改音频和歌词

### 1. 准备文件

将你的文件放到对应目录：

```
public/audio/my-song.mp3     ← 音频文件
public/lyrics/my-song.lrc    ← 歌词文件（LRC 格式）
```

### 2. 修改配置

编辑 `public/projects/your-project.json`：

```json
{
  "assets": {
    "audio": {
      "src": "/audio/my-song.mp3",
      "format": "mp3",
      "duration": 240,
      "title": "我的歌曲",
      "artist": "歌手名"
    },
    "lyrics": {
      "src": "/lyrics/my-song.lrc",
      "format": "lrc"
    }
  }
}
```

### 3. LRC 歌词格式

歌词文件使用标准 LRC 格式：

```lrc
[00:00.00]
[00:12.50]第一句歌词
[00:18.30]第二句歌词
[00:25.10]第三句歌词
```

---

## 🎨 修改颜色主题

### 锚字颜色

```json
{
  "theme": {
    "anchor": {
      "primary": "#ffffff",                    // 锚字主色
      "glowPrimary": "rgba(244, 114, 182, 0.3)",   // 光晕颜色1
      "glowSecondary": "rgba(107, 114, 255, 0.3)", // 光晕颜色2
      "glowIntensity": 0.3                     // 光晕强度 (0-1)
    }
  }
}
```

### 歌词颜色

```json
{
  "theme": {
    "lyrics": {
      "current": "#f8fafc",        // 当前歌词颜色
      "adjacent": "#e5e7eb",       // 相邻歌词颜色
      "nextAdjacent": "#9ca3af",   // 次相邻歌词颜色
      "distant": "#6b7280",        // 远距离歌词颜色
      "gradientStart": "rgba(244, 114, 182, 0.1)",
      "gradientEnd": "rgba(107, 114, 255, 0.1)"
    }
  }
}
```

### 进度条颜色

```json
{
  "theme": {
    "progressBar": {
      "background": "rgba(107, 114, 128, 0.3)",
      "completed": "#10b981",      // 已完成部分颜色
      "slider": "#ffffff",         // 滑块颜色
      "border": "rgba(107, 114, 128, 0.3)"
    }
  }
}
```

### 背景颜色

```json
{
  "theme": {
    "background": {
      "base": "#1f2e38",           // 基础背景色
      "overlay": "rgba(0, 0, 0, 0.5)"
    }
  }
}
```

---

## 🔤 修改锚字映射

### 锚字到模型的映射

```json
{
  "anchors": {
    "mappings": [
      {
        "anchor": "观",                    // 锚字
        "modelPath": "101_观.obj",         // 模型文件名
        "semanticMeaning": "觉知开启"      // 语义描述（可选）
      },
      {
        "anchor": "空",
        "modelPath": "001_空.obj",
        "semanticMeaning": "体悟本性"
      }
    ],
    "defaultModel": "001_空.obj"          // 默认模型
  }
}
```

### 注意事项

- `modelPath` 是相对于 `models.directory` 的路径
- 模型文件应放在 `public/models/10k_obj/` 目录下
- 支持的格式：`.obj`, `.glb`, `.gltf`

---

## ⏱️ 修改时间轴

时间轴定义了在哪个时间点显示哪个锚字：

```json
{
  "timeline": [
    {
      "time": 11.84,                // 时间点（秒）
      "anchor": "观",                // 显示的锚字
      "text": "观自在菩萨",          // 对应的歌词
      "meaning": "觉知开启"          // 语义描述（可选）
    },
    {
      "time": 28.87,
      "anchor": "空",
      "text": "照见五蕴皆空",
      "meaning": "体悟本性"
    }
  ]
}
```

### 重要规则

1. **时间必须升序排列**（从小到大）
2. **锚字必须在 `anchors.mappings` 中定义**
3. 时间以秒为单位，支持小数（如 `11.84`）

---

## ⚙️ 性能配置

```json
{
  "performance": {
    "qualityLevel": "high",           // 质量等级: low/medium/high
    "preloadModels": true,            // 是否预加载模型
    "maxConcurrentLoads": 3,          // 最大并发加载数
    "enableAdaptiveQuality": true     // 是否启用自适应质量
  }
}
```

---

## 🔍 配置验证

配置文件使用 **Zod** 进行运行时验证，如果格式错误会：

1. 在浏览器控制台显示详细错误信息
2. 自动回退到默认配置
3. 页面仍然可以正常运行

### 常见错误

❌ **颜色格式错误**
```json
"primary": "white"  // 错误：应该是 #ffffff
```

✅ **正确格式**
```json
"primary": "#ffffff"  // HEX 格式
"glowPrimary": "rgba(244, 114, 182, 0.3)"  // RGBA 格式
```

❌ **时间轴未排序**
```json
[
  { "time": 28.87, ... },
  { "time": 11.84, ... }  // 错误：时间倒序
]
```

✅ **正确排序**
```json
[
  { "time": 11.84, ... },
  { "time": 28.87, ... }  // 正确：升序
]
```

---

## 📂 完整示例

创建一个新项目的完整步骤：

### 1. 创建配置文件

`public/projects/diamond-sutra.json`:

```json
{
  "version": "1.0.0",
  "project": {
    "id": "diamond-sutra",
    "name": "金刚经",
    "description": "金刚经可视化项目"
  },
  "assets": {
    "audio": {
      "src": "/audio/金刚经.mp3",
      "format": "mp3",
      "title": "金刚经"
    },
    "lyrics": {
      "src": "/lyrics/金刚经.lrc",
      "format": "lrc"
    },
    "models": {
      "directory": "/models/10k_obj",
      "format": "obj"
    }
  },
  "theme": {
    "anchor": {
      "primary": "#ffd700",
      "glowPrimary": "rgba(255, 215, 0, 0.3)",
      "glowSecondary": "rgba(218, 165, 32, 0.3)",
      "glowIntensity": 0.4
    },
    "lyrics": {
      "current": "#ffd700",
      "adjacent": "#f0e68c",
      "nextAdjacent": "#daa520",
      "distant": "#b8860b",
      "gradientStart": "rgba(255, 215, 0, 0.1)",
      "gradientEnd": "rgba(218, 165, 32, 0.1)"
    },
    "progressBar": {
      "background": "rgba(139, 69, 19, 0.3)",
      "completed": "#ffd700",
      "slider": "#ffffff",
      "border": "rgba(139, 69, 19, 0.3)"
    },
    "background": {
      "base": "#2c1810",
      "overlay": "rgba(0, 0, 0, 0.6)"
    }
  },
  "anchors": {
    "mappings": [
      { "anchor": "如", "modelPath": "001_空.obj" },
      { "anchor": "是", "modelPath": "002_心.obj" }
    ],
    "defaultModel": "001_空.obj"
  },
  "timeline": [
    { "time": 0, "anchor": "如", "text": "如是我闻" },
    { "time": 10, "anchor": "是", "text": "一时佛在" }
  ],
  "performance": {
    "qualityLevel": "high",
    "preloadModels": true,
    "maxConcurrentLoads": 3
  }
}
```

### 2. 准备资源文件

```
public/audio/金刚经.mp3       ← 音频文件
public/lyrics/金刚经.lrc      ← 歌词文件
```

### 3. 在代码中加载

编辑 `src/app/page.tsx`：

```typescript
useEffect(() => {
  loadProject('diamond-sutra');  // ← 改为你的项目 ID
}, [loadProject]);
```

### 4. 启动查看

```bash
npm run dev
```

打开浏览器访问 `http://localhost:3000`

---

## 🛠️ 调试技巧

### 查看配置加载日志

打开浏览器控制台（F12），查看日志：

```
[ConfigLoader] 加载配置文件: /projects/heart-sutra.json
[ConfigLoader] ✅ 配置加载成功: heart-sutra
[useLyricsFromConfig] 加载歌词文件: /lyrics/心经.lrc
[useLyricsFromConfig] ✅ 加载成功，共 56 行
[ThemeInjector] 主题已注入
```

### 验证配置格式

在浏览器控制台运行：

```javascript
fetch('/projects/heart-sutra.json')
  .then(r => r.json())
  .then(console.log)
```

### 检查颜色是否生效

在控制台查看 CSS 变量：

```javascript
getComputedStyle(document.documentElement).getPropertyValue('--anchor-primary')
```

---

## 📚 相关文件

| 文件 | 说明 |
|------|------|
| `src/config/types.ts` | TypeScript 类型定义 |
| `src/config/schema.ts` | Zod 验证规则 |
| `src/config/loader.ts` | 配置加载器 |
| `src/config/defaults.ts` | 默认配置 |
| `src/stores/projectConfigStore.ts` | 状态管理 |
| `src/hooks/useLyricsFromConfig.ts` | 歌词加载 Hook |
| `public/projects/*.json` | 项目配置文件 |

---

## ❓ 常见问题

### Q: 修改配置后不生效？

A: 清除浏览器缓存或硬刷新（Ctrl+Shift+R / Cmd+Shift+R）

### Q: 配置验证失败怎么办？

A: 查看控制台错误信息，检查 JSON 格式是否正确

### Q: 可以不提供某些配置项吗？

A: 必填项不能省略，可选项（如 `semanticMeaning`）可以省略

### Q: 支持热重载吗？

A: 当前需要手动刷新页面，未来版本将支持热重载

---

## 🎉 总结

现在你可以：
- ✅ 创建任意数量的项目配置
- ✅ 自由更换音频、歌词、模型
- ✅ 自定义颜色主题
- ✅ 无需修改代码，只需编辑 JSON

**下一步**：开发配置页面 UI，让配置更加可视化！
