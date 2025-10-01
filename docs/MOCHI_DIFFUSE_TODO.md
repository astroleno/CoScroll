# DiffuseMochi 开发待办（TODO）

> 目标：实现"深度预pass + 多层半透明壳体 + 厚度/噪声扰动 + 简化次表面散射"的麻薯弥散组件，支持 OBJ/GLTF，移动端稳定运行。

## 🎯 参考效果目标

**视觉特征**（参见 `ref/ref1.png`, `ref/ref2.png`, `ref/ref3.png`）：
- ✅ 半透明体积感（像麻薯/雪媚娘）
- ✅ 中心实心 → 边缘渐变透明（自然消散）
- ✅ 整体雾化/模糊（柔软发光）
- ✅ 边缘光晕（Bloom增强）
- ✅ 无明显分层感（多层壳体完美融合）

## 🔥 核心挑战（Technical Challenges）

### 挑战 1：层间自然融合
**问题**：多层壳体容易产生"洋葱皮"分层感，破坏统一的雾化效果。

**解决方案**：
1. **透明度平滑曲线**：使用指数/三次曲线而非线性
   ```glsl
   // ❌ 线性：分层明显
   alpha = baseAlpha * (1.0 - layerT);

   // ✅ 指数：平滑融合
   alpha = baseAlpha * pow(1.0 - layerT, 2.5);
   ```

2. **3D噪声扰动**：打破层的规律性
   ```glsl
   float noise = perlinNoise3D(worldPos * noiseScale + layerT * 10.0);
   alpha *= mix(0.7, 1.3, noise); // ±30% 扰动
   ```

3. **层间偏移抖动**：每层厚度略微随机化
   ```js
   const layerOffset = baseOffset * (1.0 + (Math.random() - 0.5) * 0.15);
   ```

4. **颜色微调**：内层略微偏暖/外层偏冷，增强深度
   ```glsl
   vec3 innerColor = baseColor * vec3(1.05, 1.0, 0.98); // 微暖
   vec3 outerColor = baseColor * vec3(0.98, 1.0, 1.02); // 微冷
   vec3 color = mix(innerColor, outerColor, layerT);
   ```

### 挑战 2：实心→半透渐变
**问题**：如何让中心有真实体积感，同时边缘自然消散（不能是硬切）。

**解决方案**：
1. **Fresnel边缘检测**：核心技术
   ```glsl
   float fresnel = pow(1.0 - dot(normalize(vNormal), normalize(vViewDir)), 2.5);
   // fresnel: 正面=0（实心），侧面=1（透明）
   ```

2. **密度累积**：内层密度高，外层密度低
   ```glsl
   float density = baseDensity * mix(1.2, 0.4, layerT); // 内120% → 外40%
   alpha *= density;
   ```

3. **距离衰减**：结合视距，远处更模糊
   ```glsl
   float distFade = smoothstep(nearDist, farDist, length(vViewPosition));
   alpha *= mix(1.0, 0.6, distFade);
   ```

4. **双阈值Fresnel**：中心完全实心，边缘完全透
   ```glsl
   float rim = smoothstep(0.2, 0.8, fresnel); // 中心20%实心，边缘80%透
   alpha = baseAlpha * rim * density;
   ```

## 里程碑与验收标准

- M1 最小可运行（MVP）
  - [ ] 深度预通道（只写深度，不输出颜色）
  - [ ] 两层 Shell 体积假体积（InstancedMesh 或重复绘制）
  - [ ] 基础 3D 噪声（Perlin/Simplex 任一）
  - [ ] 在线性工作流下（renderer.outputColorSpace=sRGB，贴图颜色空间正确；premultipliedAlpha=true）渲染，无半透明发灰
  - [ ] 在球体与“含凹槽/薄片”的测试网格上验证：无自遮挡发白、边缘柔和

- M2 完整特性（对照参考图）
  - [ ] 2–6 层可配 Shell、厚度与透明度曲线（线性/指数/自定义采样表），并与距离联动
  - [ ] Henyey–Greenstein 前向散射近似（g∈[0.0,0.8]；移动端默认 0.4–0.6）
  - [ ] 屏幕空间抖动弃片（或 A2C）减少排序问题
  - [ ] OBJ 集成与 10k 字模型验证（支持法线重建/重算与去重合并）

- M3 优化与文档
  - [ ] 移动端预设（低层数、降分辨率体积 pass）
  - [ ] 性能参数表与推荐配置
  - [ ] README：调参对照表与九宫格效果图；示例页含“抖动路径/透明混合/WBOIT 开关”和分辨率缩放控件

## 任务拆分

1. 架构与目录
   - [x] 组件命名：`DiffuseMochi`
   - [x] 确定渲染顺序：Depth → Volumetric Shells → Post

2. 深度预通道（进行中）
   - [ ] `DepthPrepass.tsx`：`MeshDepthMaterial`，`colorWrite=false`，`depthWrite=true`
   - [ ] 渲染顺序：`prepass.renderOrder=0`，`volumetric.renderOrder=1`
  - [ ] 统一 renderer：`alpha:true, premultipliedAlpha:true, outputColorSpace=sRGB`；贴图颜色空间区分“颜色/数据”

3. Shell-based Volumetric（核心难点）
   - [ ] `shell-volumetric.vert.ts`：法线方向位移，层索引 `gl_InstanceID`
   - [ ] `shell-volumetric.frag.ts`：实现以下关键逻辑
     - [ ] **Fresnel边缘检测**（挑战2解决方案1）
     - [ ] **指数透明度曲线**（挑战1解决方案1）
     - [ ] **3D Perlin噪声**（挑战1解决方案2）
     - [ ] **密度累积函数**（挑战2解决方案2）
     - [ ] **颜色温度渐变**（挑战1解决方案4）
   - [ ] WebGL1 回退：重复绘制 + 顶点属性 `shellIndex`
   - [ ] 关键Shader代码结构：
     ```glsl
     // Fragment Shader核心
     void main() {
       // 1. Fresnel边缘
       vec3 N = normalize(vNormal);
       vec3 V = normalize(-vViewPosition);
       float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.5);
       float rim = smoothstep(0.2, 0.8, fresnel);

       // 2. 密度梯度（内实外虚）
       float density = uDensity * mix(1.2, 0.4, layerT);

       // 3. 3D噪声扰动
       float noise = perlinNoise3D(vWorldPosition * uNoiseScale + layerT * 10.0);
       density *= mix(0.7, 1.3, noise);

       // 4. 指数透明度
       float alpha = uBaseAlpha * pow(1.0 - layerT, 2.5) * rim * density;

       // 5. 颜色温度
       vec3 color = mix(
         shellColor * vec3(1.05, 1.0, 0.98), // 内层暖
         shellColor * vec3(0.98, 1.0, 1.02), // 外层冷
         layerT
       );

       // 6. 散射增亮（可选HG相位函数）
       float scatter = computeScattering(V, uLightDir, uAnisotropy);
       color *= (0.8 + 0.2 * scatter);

       gl_FragColor = vec4(color, alpha);
     }
     ```

4. 散射与相位函数
  - [ ] 实现 HG 相位函数（`g` 0.2–0.8；移动端默认 0.4–0.6）
   - [ ] 基于视方向与光方向计算散射强度

5. 抗叠加/排序
  - [ ] Dither 抛弃（Bayer 8×8 或蓝噪）路径 + `depthWrite=true, gl_FragColor.a=1.0`
  - [ ] 简版 WBOIT（桌面可选）：accumColor/accumAlpha 两纹理累积与合成

6. 背面深度 + 模糊（可选增强）
   - [ ] 背面深度 RT，厚度=正面深度 - 背面深度
  - [ ] 小核高斯模糊提升“糯糊感”（3×3 或 5×5；移动端单轴双 pass）

7. 后期处理管线（实现参考图光晕效果）
   - [ ] **UnrealBloomPass**（最关键！）
     - [ ] 强度：2.0-3.0（非常强，制造边缘光晕）
     - [ ] 阈值：0.08-0.15（很低，让半透明部分也发光）
     - [ ] 半径：1.0-1.5
     - [ ] 平滑度：0.85-0.95
   - [ ] **ChromaticAberration**（可选，ref3效果）
     - [ ] offset: [0.002, 0.003]（制造红蓝边缘）
   - [ ] **DepthOfField**（可选柔焦）
     - [ ] focusDistance: 0.5
     - [ ] focalLength: 0.3
     - [ ] bokehScale: 2.0
   - [ ] 集成到 `@react-three/postprocessing`
     ```tsx
     <EffectComposer multisampling={8}>
       <Bloom
         intensity={2.5}
         threshold={0.1}
         luminanceSmoothing={0.9}
         mipmapBlur
       />
       <ChromaticAberration offset={[0.003, 0.003]} />
     </EffectComposer>
     ```

8. 集成与示例
   - [ ] `DiffuseMochiCore.tsx`：统一 props 与预设
   - [ ] 示例页 `/app/mochi-diffuse/page.tsx`
   - [ ] 加载 `public/models/10k/*.glb` 模型
   - [ ] 交互控制面板（调试用）：
     - [ ] 层数切换（2/4/6层）
     - [ ] Bloom强度（0-5）
     - [ ] 噪声强度（0-2）
     - [ ] 色温调节（冷/暖）
     - [ ] 实时FPS显示

9. 兼容性与材质 API
  - [ ] 噪声优先 3D 纹理（三线性插值）；函数噪声作回退（Noise3D.ts 独立）
  - [ ] 抖动模块：`dither-bayer.frag`、`dither-blue-noise.frag`（含 `uTime`）
  - [ ] 语义化 API：`softness/chewiness/grain/glow` 高层参数 + 底层精细参数

## 关键参数建议（针对两大挑战优化）

### 核心材质参数
| 参数 | 推荐值 | 作用 | 关联挑战 |
|------|--------|------|----------|
| `shellCount` | 4（移动端2） | 壳体层数 | 挑战1 |
| `shellThickness` | 包围盒1.5-2.5% | 层间距离 | 挑战1 |
| `alphaCurveExp` | 2.5-3.5 | 指数透明度曲线 | 挑战1 |
| `fresnelPower` | 2.5-3.0 | Fresnel锐度 | 挑战2 |
| `fresnelThreshold` | [0.2, 0.8] | 双阈值范围 | 挑战2 |
| `densityInner` | 1.2 | 内层密度 | 挑战2 |
| `densityOuter` | 0.4 | 外层密度 | 挑战2 |
| `noiseScale` | 0.8-1.5 | 噪声频率 | 挑战1 |
| `noiseAmplitude` | 0.3 | 噪声强度（±30%） | 挑战1 |
| `colorTempInner` | [1.05, 1.0, 0.98] | 内层暖色偏移 | 挑战1 |
| `colorTempOuter` | [0.98, 1.0, 1.02] | 外层冷色偏移 | 挑战1 |

### 后期处理参数
| 参数 | 推荐值 | 作用 |
|------|--------|------|
| `bloomIntensity` | 2.5-3.0 | 边缘光晕强度 |
| `bloomThreshold` | 0.08-0.12 | 发光阈值（很低！） |
| `bloomRadius` | 1.2 | 光晕扩散半径 |
| `chromaticOffset` | [0.002, 0.003] | 色彩分离（可选） |

### 调试优先级（从易到难）
1. **先调Fresnel** → 确保边缘透明度正确
2. **再调密度梯度** → 确保内实外虚
3. **加入噪声** → 打破规律性
4. **微调透明度曲线** → 消除分层感
5. **最后调Bloom** → 增强光晕效果

## 默认路径建议

- 移动端：深度预通道 + 抖动弃片（深度可写）+ 2–3 层壳
- 桌面：可切 WBOIT + 4–6 层壳以提升纯净度

## 视觉验收标准（对照参考图）

### 挑战1验收：层间融合是否成功？
- [ ] **无洋葱皮感**：旋转模型时，看不到明显的同心层
- [ ] **平滑雾化**：整体呈现统一的半透明雾状
- [ ] **噪声自然**：颗粒感细腻，不是规律的图案
- [ ] **色温渐变**：内外颜色有微妙温度变化（不刺眼）

**测试方法**：
```
1. 用纯白色材质（#ffffff）测试
2. 4层壳体，相机360°环绕
3. 如果看到明显"圈"，说明失败
4. 应该像ref2.png那样，是统一的雾
```

### 挑战2验收：实心→半透是否自然？
- [ ] **中心有体积**：正面看不是全透明，有实体感
- [ ] **边缘自然消散**：侧面看逐渐透明，没有硬切边界
- [ ] **Fresnel正确**：边缘比中心亮（rim light效果）
- [ ] **密度合理**：远离相机的部分更透明

**测试方法**：
```
1. 相机固定，模型旋转90°
2. 观察从正面→侧面的透明度变化
3. 应该像ref1.png的人形轮廓：
   - 正面：有体积，能看到形状
   - 侧面：边缘发光，逐渐消失
```

### 整体效果验收
- [ ] **对比ref1.png**：人形轮廓的柔和感
- [ ] **对比ref2.png**：整体发光，边缘光晕
- [ ] **对比ref3.png**：（可选）色彩分离边缘
- [ ] **移动端45fps+**：性能达标
- [ ] **无闪烁/穿透**：深度排序正确

## 风险与对策

### 技术风险
- **透明排序闪烁** → 深度预通道 + 抖动弃片
- **条带/噪声脏点** → 半浮点 RT + 细噪抖动
- **性能瓶颈** → 降分辨率体积 pass、减少层数、简化噪声
- **分层感明显** → 调整alphaCurveExp（2.5→3.5），增大噪声
- **边缘过硬** → 调整fresnelPower（2.5→3.0），用smoothstep

### 调试技巧
1. **先关闭噪声和Bloom** → 专注解决分层问题
2. **单层测试** → 确保单层透明度曲线正确
3. **逐层增加** → 2层→4层→6层，观察叠加效果
4. **最后加后期** → 确保材质本身已经80%像参考图

—— 本文档随实现过程持续更新 ——


