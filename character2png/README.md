# 字体转PNG工具 (character2png)

## 项目简介
这是一个简单易用的字体转PNG图片工具，支持批量将字体文件转换为文字PNG图片。特别适合需要批量生成文字图片的场景。

## 功能特性
- ✅ 支持TTF、OTF等常见字体格式
- ✅ 批量生成文字PNG图片
- ✅ 可自定义图片尺寸、颜色、背景等参数
- ✅ 支持透明背景
- ✅ 支持多种文字位置（居中、左对齐、右对齐等）
- ✅ 简单易用的命令行界面
- ✅ 支持从文件批量读取文字

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 基本用法

```bash
# 使用单个文字
python font_to_png.py YanShiYouRanXiaoKai-2.ttf "你好世界"

# 从文件批量生成
python font_to_png.py YanShiYouRanXiaoKai-2.ttf example_text.txt
```

### 2. 高级用法

```bash
# 自定义参数
python font_to_png.py YanShiYouRanXiaoKai-2.ttf "测试文字" \
    --output my_output \
    --size 72 \
    --width 200 \
    --height 200 \
    --color red \
    --background transparent \
    --position center \
    --prefix my_text
```

### 3. 参数说明

| 参数 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `font_path` | 字体文件路径 | 必需 | `YanShiYouRanXiaoKai-2.ttf` |
| `text_source` | 文字来源（文件路径或直接文字） | 必需 | `example_text.txt` 或 `"你好"` |
| `-o, --output` | 输出目录 | `output` | `my_output` |
| `-s, --size` | 字体大小 | `64` | `72` |
| `-w, --width` | 图片宽度 | `128` | `200` |
| `-h, --height` | 图片高度 | `128` | `200` |
| `-c, --color` | 文字颜色 | `black` | `red`, `#FF0000` |
| `-b, --background` | 背景颜色 | `white` | `transparent`, `blue` |
| `-p, --position` | 文字位置 | `center` | `left`, `right`, `top`, `bottom` |
| `--prefix` | 文件名前缀 | `text` | `my_text` |

### 4. 颜色支持

支持的颜色格式：
- 英文颜色名：`red`, `blue`, `green`, `black`, `white` 等
- 十六进制：`#FF0000`, `#00FF00` 等
- RGB：`rgb(255,0,0)` 等
- 透明背景：使用 `transparent`

### 5. 文字位置选项

- `center`：居中（默认）
- `left`：左对齐
- `right`：右对齐
- `top`：顶部对齐
- `bottom`：底部对齐

## 使用示例

### 示例1：生成单个文字图片
```bash
python font_to_png.py YanShiYouRanXiaoKai-2.ttf "你好"
```

### 示例2：批量生成文字图片
```bash
# 1. 准备文字文件 example_text.txt
# 2. 运行命令
python font_to_png.py YanShiYouRanXiaoKai-2.ttf example_text.txt
```

### 示例3：生成透明背景的红色文字
```bash
python font_to_png.py YanShiYouRanXiaoKai-2.ttf "测试" \
    --background transparent \
    --color red \
    --size 100 \
    --width 300 \
    --height 300
```

## 输出文件命名规则

生成的文件名格式：`{前缀}_{文字内容}_{序号}.png`

例如：
- `text_你好_001.png`
- `text_世界_002.png`
- `text_Python_003.png`

## 注意事项

1. **字体文件**：确保字体文件路径正确，支持TTF、OTF格式
2. **文字编码**：文字文件请使用UTF-8编码
3. **输出目录**：程序会自动创建输出目录
4. **特殊字符**：文件名中的特殊字符会被自动处理
5. **内存使用**：批量处理大量文字时注意内存使用

## 常见问题

### Q: 字体加载失败怎么办？
A: 检查字体文件路径是否正确，确保字体文件存在且格式正确。

### Q: 如何生成透明背景的图片？
A: 使用 `--background transparent` 参数。

### Q: 支持哪些字体格式？
A: 支持TTF、OTF等PIL支持的字体格式。

### Q: 如何调整文字大小？
A: 使用 `--size` 参数调整字体大小，使用 `--width` 和 `--height` 调整图片尺寸。

## 技术实现

- **Python 3.x**：主要编程语言
- **Pillow (PIL)**：图像处理库
- **argparse**：命令行参数解析
- **typing**：类型提示支持

## 更新日志

- **v1.0.0**：初始版本，支持基本字体转PNG功能
- 支持批量处理
- 支持自定义参数
- 支持透明背景
- 支持多种文字位置

## 许可证

MIT License
