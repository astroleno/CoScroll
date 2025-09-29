# Shader3 参考分析

## 1. 项目概览
- 来源：`ref/Shader3/sketch1732356`，依赖 Shader Park (shader-park-core) + WebGL
- 核心文件：
  - `spCode.js`：以 Shader Park DSL 编写的 shader 逻辑
  - `index.html`：引入 Shader Park runtime 渲染到 `<canvas>`
  - `style.css`/`screenShot.js` 等为辅助文件
- 效果：基于噪声调制的柔性体，具备动态鼠标驱动的旋转与形变

## 2. Shader 结构解析
```js
setMaxIterations(8);
let click = input();
let offset = .1;

function fbm(p) {
  return vec3(
    noise(p),
    noise(p + offset),
    noise(p + offset * 2),
  );
}

let s = getRayDirection();
let n = sin(fbm(s + vec3(0, 0, -time * .1)) * 2) * .5 + .75;
n = pow(n, vec3(8));
color(n);

let scale = .5 + n.x * .05;
shape(() => {
  rotateX(PI / 2);
  rotateX(mouse.x * click);
  rotateZ(-mouse.y * click);
  torus(scale, .2);
  reset();
  mixGeo(click);
  sphere(scale);
})();

blend(.4);
displace(mouse.x * 2, mouse.y, 0);
sphere(.2);
```

### 2.1 关键函数
- `fbm(p)`: 通过三个噪声样本返回 vec3，用于构造三通道噪声 (类似 fractal brownian motion)。
- `getRayDirection()`: Shader Park 提供的 raymarch 光线方向，常用于环境噪声/背景。
- `color(n)`: 设置全局颜色，基于噪声结果对背景着色。
- `shape(...)`: 在隐式建模系统中堆叠几何体。
- `blend(.4)` 与 `displace(...)`: 对场景整体混合、位移。

### 2.2 生成几何
- 初始几何为 `torus` 与 `sphere` 的组合，鼠标点击时逐渐从球体变成圆环。
- `mixGeo(click)` 让几何在点击时平滑过渡，表现为柔性结构。
- `n` 噪声提供了颜色/缩放输入，使整个体量呈现柔雾效果。

### 2.3 动态表现
- `getRayDirection()` 随 `time` 偏移噪声，实现背景的缓慢流动。
- 鼠标输入：`click` 控制形状混合、`mouse.x/y` 驱动旋转和位移。

## 3. 风格对比与优势
- Shader3 通过噪声驱动的 soft-body 感，与我们想要的霓虹雾化风格有相似之处。
- 优势：噪声直接与光线方向关联，产生“体积感”的渐层；
  但仍属于 procedural shader 慢射线步进，未使用真实体积数据。

## 4. 借鉴要点
1. **噪声用法**：
   - 利用 `getRayDirection()` 混入噪声，创造空间感。
   - `pow(n, vec3(8))` 突出边缘，形成发光效果。
2. **几何混合**：通过 `shape` + `mixGeo` 将多个基础体平滑过渡，可套用于我们的体积基础形变。
3. **交互**：鼠标控制旋转/位移/形变，可作为我们 VR/滚动交互的参考。
4. **局限**：Shader Park 直接写射线步进，受限于平台；我们当前项目需求为基于已有模型的体积渲染，仍需结合体积贴图方案。

## 5. 实现建议
- 将 Shader3 的噪声调制逻辑移植到自定义 shader，通过三向噪声 + fresnel 控制颜色与密度。
- 结合我们规划的体积数据：
  - 使用体积采样时，将密度与噪声相乘，模拟 Shader3 的动态纹理。
  - 在 raymarch pass 中加入类似 `pow` 的高次处理，强化边缘发光。
- 若需要 Shader Park 的环境噪声风格，可在 JS 层利用 `noise3D(UVW + time)` 做背景渐层，保持统一氛围。

## 6. 与现有组件的集成可行性

### 6.1 Shader Park 直接嵌入？
- Shader Park 代码是通过 `sculptToMinimalRenderer` 将 DSL 编译成 WebGL 着色器并渲染到独立 `<canvas>`。
- 该运行时**不提供**与 three.js 场景的共享上下文；无法直接和我们现有的 `NeonModel3D` (three/fiber) 组件混合使用。
- 要在同一页面同时展示的话，只能额外创建一个全屏 canvas，失去我们现有的交互、灯光、后期管线。

### 6.2 需要怎样的改写？
- 若想在 `three.js`/`react-three-fiber` 中使用，需要：
  1. **提取 Shader Park 生成的 GLSL** 并改写为 `ShaderMaterial`，或参考其 DSL 逻辑重写 Fragment/Surface Shader。
  2. 将几何部分改写为基于 GLTF 模型的 raymarch/体积采样，而非 Shader Park 内置的 `sphere/torus` 隐式体。
  3. 手动处理鼠标/滚动交互，与我们的相机和 UI 状态统一。
- 也可以保持 Shader Park runtime，但需要额外同步相机视角、鼠标事件等，成本并不低。

### 6.3 能否直接使用 GLB/GLTF 模型？
- Shader Park 原生只支持隐式几何（sphere、torus 等）以及布尔组合，**无法直接加载 GLTF 模型**。
- 若坚持使用 Shader Park，需要将模型转换为 SDF/隐式表达式，或在外部 raymarch 中采样，这基本等价于重新实现一套体积管线。

### 6.4 推荐做法
- 将 Shader Park 的**噪声与色彩调制思路**迁移到我们自研的体积 shader 内（即前述体积贴图方案），在 three.js 环境中实现。
- `NeonModel3D` 保持 three/fiber 体系，体积渲染用我们的 shader，交互与模型加载自然继承。
- 如果需要，Shader Park 示例可作为快速原型/视觉参考，但正式项目不建议直接依赖其运行时。

---

总体而言，Shader3 提供了“柔性噪声 + 形体混合 + 发光”的良好范例，我们可以把其中的噪声融合、颜色调制方式引入到体积渲染方案中，但最终仍需基于真实体积数据来获得稳定的雾化厚度。
