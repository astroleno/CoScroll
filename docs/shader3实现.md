# Shader Park 风格在 Three.js 的复现方案（方案 2）

目标：在保持现有 Three.js / react-three-fiber 基础的前提下，复刻 Shader Park 示例的“弥散 + 噪点 + 梦幻感”视觉效果，并支持 GLTF 模型、统一交互与后期。

---

## 1. 方案定位
- **保留现有架构**：继续使用 `NeonModel3D` + GLTF + 后期管线。
- **重写 Shader 逻辑**：参考 Shader Park 的噪声、颜色调制、体厚感，在 Three.js 中自定义 `ShaderMaterial`。
- **不依赖 Shader Park runtime / p5**，避免额外 canvas、交互隔离、GLTF 不支持等问题。
- **无需 Blender 起步**：初期用程序噪声+半透明即可达到“梦幻雾化”效果，后续再决定是否接体积贴图。

---

## 2. 核心技术要点

### 2.1 噪声与颜色调制
- 在 Fragment Shader 中实现与 Shader Park 类似的 FBM：`noise3D`、多层叠加、累乘。
- 使用噪声值驱动颜色渐变（粉橙 ↔ 青蓝）和透明度。
- 仿照 Shader Park 的 `pow(n, vec3(8))`，对噪声结果做幂次强化，获得雾状高光。

### 2.2 体厚感 & 发光
- 基于法线与视线点积 (`dot(normal, viewDir)`) 计算 Fresnel，控制边缘发光强度。
- 利用 alpha blending + bloom（现有后期）营造“发光弥散”边缘。
- 在 shader 内混合多级噪声（大尺度 + 小尺度）模拟体积颗粒。

### 2.3 动态效果
- 时间偏移：`noise(p + vec3(0, 0, -time * speed))` 实现缓慢流动。
- 鼠标/滚动交互：通过 uniforms 调节旋转、颜色偏移、噪声强度等，与现有配置面板统一。

### 2.4 与 GLTF 集成
- `GLTFLoader` 载入模型后，用自定义 `ShaderMaterial` 替换 mesh 材质。
- 仍可使用现有参数系统（Fresnel 强度、噪声强度、颜色等）。
- 字幕遮挡、相机控制、动画延续现有 `NeonModel3D` 逻辑。

---

## 3. 开发步骤

1. **Shader 原型**
   - 在 `shaders/` 新建 `volumetricSurfaceMaterial.ts`（或类似文件），实现基于 FBM + Fresnel 的 Fragment Shader。
   - 先在简单球体上调试，确认颜色/噪点/发光效果。

2. **与组件集成**
   - 在 `NeonModel3D` 中替换材质创建逻辑：
     ```ts
     const material = useMemo(() => createShader3Material(config), [config]);
     ```
   - 保留原有 uniform 更新（颜色、时间、交互参数）。

3. **交互绑定**
   - 将鼠标、滚动、音频等输入通过 uniforms 注入 shader。
   - 支持自动旋转、呼吸感（如 `sin(time * breathingSpeed)`）。

4. **后期与效果调节**
   - 复用现有 Bloom/Noise/Vignette，微调强度以配合新材质。
   - 如需更厚的体积感，可叠加简易 screen-space blur 或后续引入体积贴图。

5. **调优 & 兼容性**
   - 桌面：开启高分辨率 FBM；移动端：降低噪声层次/迭代。
   - 与配置面板整合：增加“噪声尺度”“边缘发光”等滑块方便调试。

---

## 4. 可选增强（非必需）
- 引入 3D 噪声纹理替代程序噪声（性能更好）。
- 未来若需要更真实体积，可把当前 shader 与体积贴图方案结合：
  - 把噪声用于体积密度调制。
  - 保留现有 shader 作为 fallback/过渡层。

---

## 5. 优劣权衡
| 项目 | 优点 | 缺点 |
| --- | --- | --- |
| 方案 2 | 保留现有三维架构；可加载 GLTF；交互统一；视觉可调控 | 需手写 shader，调试工作量较大 |
| 方案 1（直接 Shader Park） | 视觉“原汁原味”，开发快 | 无法与 GLTF、现有 UI/后期融合；交互、遮挡、滚动需重写 |

---

## 6. 下一步建议
1. 编写 `ShaderMaterial` 原型，并在简单几何上调试效果。
2. 接入 `NeonModel3D`，用现有参数系统驱动；收敛视觉风格。
3. 与团队确认视觉质量、性能表现，决定是否进一步引入体积贴图或保留为终版方案。

---

此文即方案 2 的实施说明，可在团队内部流转，作为后续开发的蓝本。
