# Blender 体积切片制作流程

适用于将 500k / 10k 面的 GLTF 模型转换为“雾化体积”并导出供前端采样的密度切片。流程分为：模型准备 → 体积生成 → 噪声调节 → 切片渲染 → 数据打包。

---

## 1. 环境准备
- 建议使用 **Blender 3.4+**（内建 Geometry Nodes 与 OpenVDB 导出功能稳定）。
- 安装插件：
  - `Import-Export: glTF 2.0`（默认启用）。
  - `Import-Export: OpenVDB`（如需直接导出 VDB，可在 Preferences > Add-ons 搜索 “OpenVDB” 勾选）。
- 渲染设置：
  - Render Engine 选 `Cycles`（支持体积渲染），Device 可用 GPU；若要快速预览，可在调节时切换到 `Eevee`。
  - Color Management 中将 View Transform 改为 `Filmic`，Look 设 `Medium High Contrast`，有助于观察亮度层级。

---

## 2. 导入与模型准备
1. `File > Import > glTF 2.0 (.glb/.gltf)` 导入字形。
2. 选中模型 `Ctrl+A` → Apply All（位置/旋转/缩放）。
3. 如模型包含多个部分，执行 `Ctrl+J` 合并；再 `RMB > Shade Smooth`。
4. **细分 / 平滑建议：**
   - 500k 面模型通常已足够，可直接使用。
   - 10k 面模型建议加 `Subdivision Surface`（1~2 级）或 `Remesh (Blocks: Smooth)` 保证轮廓平滑后再应用。
5. 确认模型朝向：通常将笔画朝向 +Z 方向，便于 Z 轴切片。

> **Tips：** 如果需要将字放在坐标原点，可用 `Shift+S > Cursor to World Origin`，再 `Object > Set Origin > Origin to Geometry`，最后 `Alt+G` 归零位置。

---

## 3. Geometry Nodes 生成体积
1. 选中模型，新建 `Geometry Nodes`，命名 `GlyphVolume`。
2. 在节点编辑器搭建如下流程：

```
Group Input (Geometry)
  └─> Mesh to Volume  (Voxel Size 0.01~0.03, Density 1.0)
       └─ Volume Displace (Strength 0.05~0.15, Noise Texture → Vector)
             └─ Volume (Group Output)
```
- `Mesh to Volume`：决定体素密度。Voxel Size 控制分辨率，值越小细节越高（建议 0.015 左右，依据模型尺寸可微调）。
- `Volume Displace`：接一个 `Noise Texture(4D)` + `Vector Math(Add)` 叠加动画噪声，或使用 `Musgrave`/`Voronoi` 组合，模拟内部颗粒。
- 如需保留原网格轮廓供参考，可在 `Group Output` 前用 `Join Geometry` 将原 Geometry + Volume 同时输出；之后删除网格部分（只保留 Volume 对象）。

3. 切换到对象模式后，会看到对象类型变为 Volume。
4. **材质设置：**
   - 给 Volume 赋予新材质 `GlyphVolume_Mat`。
   - 在 Shader Editor 中使用 `Principled Volume`：
     - Density 0.3~1.2（可接 ColorRamp 控制内部渐层）。
     - Emission Color/Strength 控制自发光（可用 ColorRamp 做粉-蓝过渡）。
     - 使用 `Volume Info` 节点读取 Density，乘以噪声输出到 Emission/Density，形成杂色体积。

> **若想导出 OpenVDB：** 保留 Volume 对象 → `File > Export > OpenVDB (.vdb)`。后续可在 Node/脚本中转换为 3D 纹理或切片。

---

## 4. 设置切片摄像机
1. 添加立方体 `Shift+A > Mesh > Cube`，缩放成刚好包裹体积的边界盒（记下尺寸，后续写入 meta.json）。可创建空对象 `SliceBounds` 记录中心与尺寸。
2. 新建正交相机：
   - `Shift+A > Camera`，切换到正交模式（Camera Properties > Lens > Type = Orthographic）。
   - Orthographic Scale 设为包围盒的最大边长。
   - 将相机对齐到 +Z 方向：在视图中 `Numpad 7`，然后选中相机 `Ctrl+Alt+0` 捕捉位置。
   - 将相机放在盒子外上方，并对准中心；设置剪裁面 Clipping Start 0.001，End 大于包围盒深度。
3. 在 `Output Properties` 里设置输出尺寸（建议 256×256 或 512×512）。
4. 将世界背景改为黑色（World > Color = #000000）。

---

## 5. 渲染密度切片
使用 Python 脚本批量渲染：

```python
import bpy
import math

# 配置
output_dir = "/path/to/slices"  # 修改为自己的输出路径
slice_count = 128                # 切片数量
start_z = -bound/2               # 绑定包围盒尺寸
end_z = bound/2

scene = bpy.context.scene
cam = scene.camera

# 计算每帧的 z 位移
step = (end_z - start_z) / slice_count

for i in range(slice_count):
    z = start_z + step * (i + 0.5)
    cam.location.z = z
    scene.frame_set(i)
    scene.render.filepath = f"{output_dir}/slice_{i:03d}.png"
    bpy.ops.render.render(write_still=True)
```

执行脚本前：
- 将包围盒尺寸赋值给 `bound`，或直接在脚本中填入数值（单位米）。
- 确保体积的密度已经调好，渲染时可关闭灯光（Principled Volume 自发光即可）。
- 渲染结果是灰度 PNG，可在 post 中进行压缩。

> **输出检查**：随机打开几张切片，确认密度中心白亮、边缘渐变到黑；若过曝或过暗，可调整材质中的 Density/Emission 或在 Compositor 中添加 `Gamma`、`ColorRamp`。

---

## 6. 生成 meta.json（前端需要）
记录以下元数据，供前端定位：
```json
{
  "slices": 128,
  "rows": 16,
  "cols": 8,
  "resolution": 256,
  "bounding_box": [width, height, depth],
  "center": [cx, cy, cz],
  "gamma": 1.0,
  "density_range": [min, max],
  "color_ramp": [
    {"pos": 0.0, "color": [r, g, b]},
    {"pos": 1.0, "color": [r, g, b]}
  ]
}
```
- `rows/cols` 用于切片拼图（如果将 128 张图片合成 16×8 图集）；若直接保留单张 PNG 切片，可忽略。
- `density_range` 可记录在 Blender 中测得的最小/最大密度，前端据此归一化。

---

## 7. 500k vs 10k 模型差异建议
| 场景 | 建议 | 备注 |
| --- | --- | --- |
| 500k 高模 | 直接用于 Mesh to Volume。若体积过细，可适当增大 Voxel Size，避免超高密度。 | 高模保持精细剪影，体积转换更准确。 |
| 10k 低模 | 加一层 `Subdivision Surface` 或 `Remesh (Voxel)` 保证轮廓平顺，再进入体积流程。 | Subdivision 后记得应用并再次 `Shade Smooth`。 |
| 超大场景 | 可先 Scale 模型，让整体包围盒在 1~2 米内，便于设定 voxel 尺寸。 | 体素大小与模型尺度成比例。 |

---

## 8. 额外技巧
- **噪声层叠**：在 Shader 或 Geometry Nodes 中叠加多层 FBM/Noise，分别控制细颗粒与大尺度模糊。
- **动画呼吸**：在 `Noise Texture` 的 W 输入中接 `#frame/50` 或驱动，导出序列时即可带有轻微呼吸效果（前端也可通过 shader 再加动态扰动）。
- **z-颠倒问题**：渲染切片时注意 Blender 与前端坐标系。若前端使用右手坐标，可能需要在加载时翻转 Z 索引。
- **压缩**：渲染出的 PNG 可使用 `pngquant` 等工具压缩，保证细节同时减少体积。
- **预览验证**：
  - 在 Blender 中可再创建一个立方体使用 `Volume Info` + `ColorRamp` 预览切片组合效果。
  - 也可以在 Substance Designer 或 Houdini 中加载切片检查密度。

---

完成以上步骤后，即可将切片与 meta.json 提交给前端，由前端的体积采样管线（Data3DTexture 或 Atlas）加载并渲染，实现类似参考图的弥散模糊与颗粒质感。
