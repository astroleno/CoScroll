# PNG转3D模型模块

## 功能概述
这个模块使用Tripo3D API将PNG图片转换为3D模型，支持单个图片处理和批量处理。

## 安装依赖
```bash
pip install -r requirements.txt
```

## 配置设置

### 1. 设置API密钥
在系统环境变量中设置Tripo3D API密钥：
```bash
# Windows
set TRIPO3D_API_KEY=your_api_key_here

# Linux/Mac
export TRIPO3D_API_KEY=your_api_key_here
```

### 2. 配置参数
编辑 `config.py` 文件中的配置参数：
- `INPUT_DIR`: PNG图片输入目录
- `OUTPUT_DIR`: 3D模型输出目录
- `MODEL_SETTINGS`: 模型生成参数

## 使用方法

### 命令行使用

#### 1. 处理单个图片
```bash
# 基本用法
python main.py single image.png

# 指定输出路径
python main.py single image.png -o model.glb
```

#### 2. 批量处理
```bash
# 顺序处理（推荐）
python main.py batch

# 并行处理（更快但消耗更多资源）
python main.py batch --parallel --workers 3
```

#### 3. 检查配置
```bash
python main.py check
```

### Python代码使用

#### 处理单个图片
```python
from api_client import Tripo3DClient

# 创建客户端
client = Tripo3DClient()

# 处理图片
success, message = client.generate_3d_model(
    image_path="input.png",
    output_path="output.glb"
)

if success:
    print("处理成功！")
else:
    print(f"处理失败: {message}")
```

#### 批量处理
```python
from batch_processor import BatchProcessor

# 创建批量处理器
processor = BatchProcessor()

# 执行批量处理
results = processor.process_all(parallel=False)

# 打印结果
processor.print_summary(results)
```

## 配置说明

### 模型设置参数
- `quality`: 模型质量 (low/medium/high)
- `format`: 输出格式 (glb/obj/ply)
- `resolution`: 模型分辨率 (512/1024/2048)
- `detail_level`: 细节级别 (1-10)

### 批量处理设置
- `BATCH_SIZE`: 每批处理的图片数量
- `MAX_RETRIES`: 最大重试次数
- `RETRY_DELAY`: 重试延迟（秒）

## 输出文件

生成的3D模型文件将保存在 `models_output` 目录中，文件格式根据配置设置。

## 错误处理

程序包含完整的错误处理机制：
- API请求失败自动重试
- 网络超时处理
- 文件操作错误处理
- 详细的日志记录

## 日志文件

处理过程中的日志会保存在 `png2model.log` 文件中，包含：
- 处理进度信息
- 错误详情
- 性能统计

## 注意事项

1. **API限制**: 注意Tripo3D API的调用限制和费用
2. **网络连接**: 需要稳定的网络连接
3. **文件格式**: 确保输入PNG文件格式正确
4. **存储空间**: 3D模型文件可能较大，确保有足够存储空间

## 故障排除

### 常见问题

1. **API密钥错误**
   - 检查环境变量是否正确设置
   - 确认API密钥有效

2. **网络连接问题**
   - 检查网络连接
   - 尝试增加超时时间

3. **文件路径问题**
   - 确认输入目录存在
   - 检查文件权限

4. **内存不足**
   - 减少并行处理数量
   - 使用顺序处理模式

### 获取帮助

如果遇到问题，请检查：
1. 日志文件 `png2model.log`
2. 配置是否正确
3. 网络连接是否正常
4. API密钥是否有效
