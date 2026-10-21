# 快速开始

> 本页保留早期配置示例。新增经典以[多经典接入规范](CLASSICS_INTEGRATION_SPEC.md)为准：
> 当前主入口固定《心经》，显示端仍有固定模型字表，不能把“编辑 JSON”视为整条接入链路已打通。

## 回答你的问题

### 1. 是否需要单独的歌词文件？

**答案**：**不需要**额外创建歌词文件，因为：

- ✅ 歌词文件已存在：`public/lyrics/心经.lrc`
- ✅ 配置已指向它：`"src": "/lyrics/心经.lrc"`
- ✅ 系统会自动加载

**constants.ts 的作用**：
- ❌ **以前**：硬编码的歌词数据（老代码）
- ✅ **现在**：不再使用，已被配置系统替代

### 2. 如何使用 JSON 配置？

**答案**：配置是**自动加载**的！

---

## 使用流程

### 方式 A：修改现有项目（最简单）

1. **编辑配置文件**：
   ```bash
   open public/projects/heart-sutra.json
   ```

2. **修改你想改的部分**（例如颜色）：
   ```json
   {
     "theme": {
       "anchor": {
         "primary": "#ff0000"  ← 改成红色
       }
     }
   }
   ```

3. **保存并刷新浏览器**
   - 就是这么简单！

---

### 方式 B：创建新项目

1. **复制配置文件**：
   ```bash
   cp public/projects/heart-sutra.json public/projects/my-song.json
   ```

2. **添加你的音频和歌词**：
   ```bash
   public/audio/my-song.mp3      ← 放你的音频
   public/lyrics/my-song.lrc     ← 放你的歌词
   ```

3. **修改配置**：
   ```json
   {
     "assets": {
       "audio": {
         "src": "/audio/my-song.mp3"
       },
       "lyrics": {
         "src": "/lyrics/my-song.lrc"
       }
     }
   }
   ```

4. **在代码中加载新项目**：

   编辑 `src/app/page.tsx` 第 104 行：
   ```typescript
   loadProject('my-song');  // ← 改成你的项目名
   ```

5. **运行**：
   ```bash
   npm run dev
   ```

---

## 配置加载原理

```
浏览器打开页面
    ↓
page.tsx 自动执行 loadProject('heart-sutra')
    ↓
加载 /projects/heart-sutra.json
    ↓
Zod 验证格式
    ↓
加载 /lyrics/心经.lrc
    ↓
注入颜色到 CSS
    ↓
渲染页面 ✅
```

**你不需要手动做任何事**，只需编辑 JSON 文件！

---

## 常用配置示例

### 更换颜色（粉色 → 蓝色）

**编辑**：`public/projects/heart-sutra.json`

```json
{
  "theme": {
    "anchor": {
      "primary": "#ffffff",
      "glowPrimary": "rgba(59, 130, 246, 0.3)",     ← 改成蓝色
      "glowSecondary": "rgba(37, 99, 235, 0.3)",    ← 改成深蓝
      "glowIntensity": 0.3
    }
  }
}
```

**效果**：锚字光晕从粉紫色变成蓝色系

---

### 更换歌曲

1. **准备文件**：
   ```
   public/audio/新歌.mp3
   public/lyrics/新歌.lrc
   ```

2. **修改配置**：
   ```json
   {
     "project": {
       "name": "新歌曲名称"
     },
     "assets": {
       "audio": {
         "src": "/audio/新歌.mp3",
         "title": "新歌"
       },
       "lyrics": {
         "src": "/lyrics/新歌.lrc"
       }
     }
   }
   ```

3. **刷新浏览器** → 完成！

---

## 检查配置是否生效

### 方法 1：查看控制台

按 F12 打开开发者工具，查看日志：

```
✅ [ConfigLoader] 配置加载成功: heart-sutra
✅ [useLyricsFromConfig] 加载成功，共 56 行
✅ [ThemeInjector] 主题已注入
```

### 方法 2：检查 CSS 变量

在控制台运行：

```javascript
// 查看锚字颜色
getComputedStyle(document.documentElement).getPropertyValue('--anchor-primary')

// 查看光晕颜色
getComputedStyle(document.documentElement).getPropertyValue('--anchor-glow-primary')
```

---

## 故障排除

### 问题：配置没有生效

**解决**：
1. 硬刷新浏览器（Ctrl+Shift+R）
2. 检查 JSON 格式是否正确
3. 查看控制台是否有错误

### 问题：歌词没有显示

**解决**：
1. 检查 LRC 文件路径是否正确
2. 确认 LRC 文件格式正确：
   ```lrc
   [00:12.50]歌词内容
   [00:18.30]下一句歌词
   ```

### 问题：模型没有显示

**解决**：
1. 检查模型文件是否存在于 `public/models/10k_obj/`
2. 确认 `anchors.mappings` 中的 `modelPath` 正确

---

## 文件位置速查

| 文件类型 | 位置 | 示例 |
|---------|------|------|
| 配置文件 | `public/projects/` | `heart-sutra.json` |
| 音频文件 | `public/audio/` | `心经_2.mp3` |
| 歌词文件 | `public/lyrics/` | `心经.lrc` |
| 模型文件 | `public/models/10k_obj/` | `101_观.obj` |

---

## 下一步

- 📖 查看完整文档：[CONFIG_GUIDE.md](./CONFIG_GUIDE.md)
- 🎨 尝试修改颜色主题
- 🎵 添加自己的歌曲
- 🔧 调整时间轴和锚字映射
