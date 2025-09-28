# 弥散霓虹风格模型渲染组件 TODO

> 基于参考图的独立组件开发计划 - 用于抵消低面数，实现氛围感

## 📋 项目目标

创建一个独立的弥散霓虹风格模型渲染组件，能够：
- **弥散发光**：柔和的边缘发光和内部光芒
- **模糊效果**：柔和的边缘过渡，掩盖低面数
- **噪点质感**：胶片颗粒感，增加艺术氛围
- **渐变色彩**：粉橙到青蓝的平滑过渡
- **项目集成**：无缝接入现有 CoScroll 项目

## 🎯 核心功能需求

### 1. 视觉效果目标
- [ ] **弥散发光效果**：模型边缘柔和发光，仿佛由光线构成
- [ ] **模糊边缘**：柔和的轮廓过渡，掩盖低面数模型的生硬感
- [ ] **噪点质感**：均匀的颗粒覆盖，增加胶片艺术感
- [ ] **渐变色彩**：从粉橙 (#ff6b9d) 到青蓝 (#4ecdc4) 的平滑过渡
- [ ] **动态响应**：滚动驱动的光效强度变化

### 2. 技术实现目标
- [ ] **独立组件**：可复用的 NeonModel3D 组件
- [ ] **项目集成**：与现有 CoScroll 架构兼容
- [ ] **性能优化**：桌面端 60fps，移动端 45fps+
- [ ] **质量分级**：支持低/中/高三种质量模式
- [ ] **响应式**：支持不同屏幕尺寸和性能等级

## 🏗️ 组件架构设计

### 文件结构
```
src/components/core/NeonModel3D/
├── NeonModel3D.tsx              # 主组件
├── shaders/
│   ├── fresnel.vert             # Fresnel 顶点着色器
│   ├── fresnel.frag             # Fresnel 片段着色器
│   └── gradient.frag             # 渐变色彩着色器
├── materials/
│   ├── FresnelMaterial.ts       # Fresnel 材质类
│   ├── GradientMaterial.ts      # 渐变材质类
│   └── NeonMaterial.ts          # 组合材质类
├── effects/
│   ├── BloomEffect.tsx          # Bloom 光晕效果
│   ├── GrainEffect.tsx          # 颗粒质感效果
│   └── FogEffect.tsx            # 雾化效果
└── utils/
    ├── colorUtils.ts            # 色彩工具函数
    ├── performanceUtils.ts      # 性能工具函数
    └── deviceDetection.ts       # 设备检测
```

### 组件接口设计
```typescript
interface NeonModel3DProps {
  // 基础属性
  modelPath: string
  anchorChar?: string
  
  // 视觉效果控制
  neonIntensity?: number          // 0-1, 整体发光强度
  rimGlowIntensity?: number       // 0-1, 边缘发光强度
  innerGlowIntensity?: number     // 0-1, 内部发光强度
  grainIntensity?: number         // 0-1, 颗粒质感强度
  blurIntensity?: number          // 0-1, 模糊效果强度
  
  // 色彩控制
  rimColor?: string              // 边缘颜色
  baseColor?: string             // 基础颜色
  gradientStrength?: number      // 0-1, 渐变强度
  
  // 动态响应 (归一化输入) ⭐ 更新
  scrollVelocity?: number        // 归一化滚动速度 (0-1)
  scrollProgress?: number        // 归一化滚动进度 (0-1)
  time?: number                 // 时间驱动动画
  
  // 性能控制
  quality?: 'low' | 'medium' | 'high'
  enableBloom?: boolean
  enableGrain?: boolean
  enableFog?: boolean
  
  // 项目集成
  className?: string
  style?: React.CSSProperties
}
```

## 🚀 开发计划

### 阶段零：原型验证 (1-2天) ⭐ 新增

#### 0.1 核心效果原型验证 ⭐ 更新
- [ ] **极简场景验证**：单模型 + 背景渐变，快速拼出核心视觉
- [ ] **目标机型测试**：至少一台安卓一台 iPhone，确认帧率和热降频
- [ ] **效果保真度确认**：根据性能表现决定 Shader 复杂度
- [ ] 使用现有 postprocessing 效果快速验证
- [ ] **里程碑验收**：原型效果可接受，性能达标

#### 0.2 技术路线确认 ⭐ 更新
- [ ] **Vapor/Dreamcore 风格确认**：体积感 SSScattering + 超柔雾化 + 颗粒噪点 + 渐变色调
- [ ] **模型基础检查**：确保法线顺滑，轮廓可被体积光吞没
- [ ] **Shader 分层设计**：SSS假体积 + 内发光渐变两层架构
- [ ] **后期处理管线**：Bloom + Film Grain + 色彩漂移 + 全屏混合
- [ ] **苹果竖屏优化**：高分辨率显示下的轮廓质量检查
- [ ] 评估自定义 Shader vs 现成效果的平衡
- [ ] 确定性能瓶颈和优化方向
- [ ] 制定质量分级策略
- [ ] 确认依赖组件的可用性

### 阶段一：基础材质系统 (3-4天)

#### 1.1 创建 SSS 假体积材质 ⭐ 更新
- [ ] **纯程序化 SSS Shader**：基于视角与法线的点积，无需厚度贴图
- [ ] **视角驱动厚度近似**：`abs(dot(normal, viewDir)) + 曲率近似`
- [ ] **扩展法线技术**：模拟毛绒感轮廓，避免粒子毛发
- [ ] **深度偏移**：增强体积感效果
- [ ] **几何清理**：合并顶点、填洞、重新计算平滑法线、移除重叠面
- [ ] **轮廓优化**：subdivision→decimate 流程，确保轮廓平滑
- [ ] **法线质量**：运行时重算法线，避免噪点
- [ ] **附加项：厚度贴图**：可选，用于差异化发光效果
- [ ] 测试 SSS 假体积效果

#### 1.2 实现内发光渐变系统 ⭐ 更新
- [ ] **纯程序化渐变**：基于 Fresnel 和法线点积的色彩混合
- [ ] **滚动驱动色彩**：动态色彩变化，无需 LUT 纹理
- [ ] **时间驱动色彩**：呼吸动效，程序化实现
- [ ] **内发光 Shader**：内部光芒效果
- [ ] **附加项：1D LUT 渐变纹理**：可选，用于更精确的色彩控制
- [ ] 测试渐变色彩效果

#### 1.3 基础光照系统
- [ ] 配置环境光 (柔和基础照明)
- [ ] 配置主光源 (温暖方向光)
- [ ] 配置补光 (冷色调补光)
- [ ] 配置点光源 (动态呼吸光)

#### 1.4 阶段一里程碑复盘 ⭐ 更新
- [ ] **视觉效果验收**：SSS假体积 + 内发光效果达标
- [ ] **性能验收**：目标设备帧率达标（iPhone 12 实测）
- [ ] **技术路线确认**：自定义 vs 现成方案
- [ ] **模型质量检查**：法线顺滑度，轮廓可被体积光吞没
- [ ] **苹果竖屏验收**：高分辨率显示下的轮廓质量检查
- [ ] **几何质量验收**：无破面、洞、边界断裂、翻转法线
- [ ] **必要时调整Scope**：削减非核心功能

### 阶段二：后期处理效果 (3-4天)

#### 2.1 Bloom 光晕效果 ⭐ 更新
- [ ] **高阈值 Bloom**：精确控制发光区域
- [ ] **多级模糊**：渐进式模糊效果
- [ ] **动态强度控制**：滚动驱动强度变化
- [ ] 集成 @react-three/postprocessing
- [ ] 测试光晕效果

#### 2.2 Film Grain 颗粒质感 ⭐ 更新
- [ ] **程序噪声生成**：Shader 噪声函数实时生成噪点
- [ ] **Gamma 后叠加**：避免压暗效果
- [ ] **程序化"糖霜"感**：基于噪声函数的质感控制
- [ ] **动态颗粒控制**：滚动驱动强度
- [ ] **附加项：蓝噪点/抖动纹理**：可选，用于更精确的颗粒控制
- [ ] 测试颗粒质感效果

#### 2.3 色彩漂移和全屏混合 ⭐ 更新
- [ ] **Chromatic Aberration**：轻微色彩漂移
- [ ] **全屏 Soft Light/Overlay 混合**：保持粉橙→青蓝氛围
- [ ] **屏幕空间雾化**：深度纹理 + 指数衰减
- [ ] **地面投光**：Billboard Quad + 圆形渐变
- [ ] 测试整体氛围效果

### 阶段三：滚动驱动效果 (2-3天)

#### 3.1 滚动响应系统 ⭐ 更新
- [ ] **滚动输入解耦**：组件只接收归一化的 progress/velocity (0-1)
- [ ] **内部平滑处理**：滤波、缓动，避免抖动
- [ ] **明确数据来源**：确认与现有 scrollStore 的对接方式
- [ ] **依赖关系梳理**：scrollVelocity, scrollProgress 的数据流
- [ ] 实现滚动速度响应
- [ ] 实现滚动进度响应
- [ ] 测试滚动同步效果

#### 3.2 动态材质参数
- [ ] 滚动驱动 Fresnel 强度
- [ ] 滚动驱动发光颜色
- [ ] 滚动驱动 Bloom 强度
- [ ] 测试动态效果

#### 3.3 呼吸动效
- [ ] 实现时间驱动的呼吸效果
- [ ] 配置呼吸频率和强度
- [ ] 结合滚动响应
- [ ] 测试呼吸动效

### 阶段四：项目集成 (2-3天)

#### 4.1 组件集成
- [ ] 创建 NeonModel3D 主组件
- [ ] 配置组件接口
- [ ] 实现错误边界
- [ ] 测试组件基础功能

#### 4.2 项目兼容性 ⭐ 更新
- [ ] **确认依赖组件状态**：Model3D, ScrollCanvas, DreamyLayout 的可用性
- [ ] 与现有 Model3D 组件兼容
- [ ] 与 ScrollCanvas 集成
- [ ] 与 DreamyLayout 集成 (确认是否存在)
- [ ] 测试整体集成效果

#### 4.3 性能优化 ⭐ 更新
- [ ] **分级渲染策略**：内置 quality 参数，自动探测设备性能
- [ ] **动态裁剪**：Bloom 阶数、噪点分辨率、模糊采样数
- [ ] **降级视觉指引**：明确各级别期望表现
- [ ] 实现质量分级系统
- [ ] 移动端降级方案
- [ ] 性能监控系统
- [ ] 测试性能表现

### 阶段五：测试和优化 (2-3天)

#### 5.1 功能测试 ⭐ 更新
- [ ] 视觉效果验收
- [ ] 交互响应测试
- [ ] **性能压力测试**：定义量化方法（帧率采集、GPU profiling）
- [ ] **测试机型确认**：iPhone 12, 桌面端等目标设备
- [ ] 兼容性测试

#### 5.2 优化调整
- [ ] 视觉效果微调
- [ ] 性能参数优化
- [ ] 用户体验优化
- [ ] 最终验收测试

## 🎨 视觉效果验收标准

### 基础效果验收
- [ ] 模型具有柔和的边缘发光效果
- [ ] 边缘过渡柔和，有效掩盖低面数
- [ ] 颗粒质感均匀，增加艺术氛围
- [ ] 色彩渐变平滑，从粉橙到青蓝
- [ ] 整体效果与参考图高度一致

### 动态效果验收
- [ ] 滚动时材质参数动态变化
- [ ] 滚动速度影响光效强度
- [ ] 滚动进度影响色彩变化
- [ ] 呼吸动效自然流畅
- [ ] 响应延迟 <100ms

### 性能验收
- [ ] 桌面端保持 60fps
- [ ] 移动端保持 45fps 以上
- [ ] 内存使用合理 (<200MB)
- [ ] 加载时间 <3秒
- [ ] 质量分级有效

## 🔧 技术实现细节

### Shader 材质实现
```glsl
// Fresnel 顶点着色器
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vViewDirection;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  vViewDirection = normalize(cameraPosition - position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// Fresnel 片段着色器
uniform float fresnelPower;
uniform vec3 rimColor;
uniform vec3 baseColor;
uniform float scrollIntensity;
uniform float time;

varying vec3 vNormal;
varying vec3 vViewDirection;

void main() {
  // Fresnel 计算
  float fresnel = 1.0 - max(0.0, dot(vNormal, vViewDirection));
  fresnel = pow(fresnel, fresnelPower);
  
  // 动态强度
  float dynamicIntensity = 0.5 + scrollIntensity * 0.5;
  
  // 渐变色彩混合
  vec3 color = mix(baseColor, rimColor, fresnel);
  color *= dynamicIntensity;
  
  // 内部发光效果
  float innerGlow = 1.0 - fresnel;
  color += rimColor * innerGlow * 0.3;
  
  gl_FragColor = vec4(color, 0.8);
}
```

### 后期处理配置
```typescript
const postProcessingConfig = {
  bloom: {
    intensity: 0.8,
    luminanceThreshold: 0.15,
    luminanceSmoothing: 0.95,
    mipmapBlur: true
  },
  filmGrain: {
    intensity: 0.3,
    opacity: 0.1,
    blendMode: 'multiply'
  },
  fog: {
    color: '#ff6b9d',
    near: 5,
    far: 20
  }
}
```

### 性能优化策略 ⭐ 更新
```typescript
const performanceConfig = {
  desktop: {
    bloomIterations: 3,
    grainIntensity: 0.3,
    fogEnabled: true,
    targetFPS: 60,
    // 新增：Vapor/Dreamcore 风格优化
    sssQuality: 'high',
    lutResolution: 256,
    enableChromaticAberration: true
  },
  mobile: {
    bloomIterations: 1,
    grainIntensity: 0.1,
    fogEnabled: false,
    targetFPS: 45,
    // 移动端降级
    sssQuality: 'medium',
    lutResolution: 128,
    enableChromaticAberration: false
  },
  lowEnd: {
    bloomIterations: 0,
    grainIntensity: 0.05,
    fogEnabled: false,
    targetFPS: 30,
    // 低端设备降级
    sssQuality: 'low',
    lutResolution: 64,
    enableChromaticAberration: false
  }
}

// 性能监控工具
const performanceUtils = {
  // 帧率采集
  collectFPS: () => { /* 实现帧率监控 */ },
  // GPU profiling
  profileGPU: () => { /* 实现GPU性能分析 */ },
  // 设备检测
  detectDevice: () => { /* 检测设备性能等级 */ },
  // 新增：Vapor 风格性能监控
  monitorSSS: () => { /* 监控SSS假体积性能 */ },
  monitorLUT: () => { /* 监控LUT纹理性能 */ }
}
```

## 📱 响应式设计

### 桌面端 (≥1024px)
- 完整后期处理效果
- 高质量 Shader 材质
- 60fps 目标帧率

### 平板端 (768px - 1024px)
- 中等后期处理效果
- 中等质量 Shader 材质
- 45fps 目标帧率

### 移动端 (≤768px)
- 基础后期处理效果
- 简化 Shader 材质
- 30fps 目标帧率

## 🎯 预期效果

实现完成后，NeonModel3D 组件将呈现：

1. **空灵质感**：模型具有柔和的发光边缘，仿佛由光线构成
2. **模糊过渡**：柔和的轮廓过渡，有效掩盖低面数模型的生硬感
3. **颗粒质感**：均匀的胶片颗粒感，增加艺术氛围
4. **渐变色彩**：从粉橙到青蓝的平滑色彩过渡
5. **动态响应**：滚动时材质、光照、后期效果实时变化
6. **性能稳定**：在各种设备上都能流畅运行

## 🚀 下一步行动

1. **确认技术方案** - 你同意这个开发计划吗？
2. **选择开发优先级** - 你希望先实现哪个阶段？
3. **开始编码实现** - 我们可以立即开始创建组件！
4. **迭代优化** - 根据测试结果不断调整效果

## 📝 简化设计原则 ⭐ 更新

### 核心功能优先
- **只做必要的**：SSS假体积 + 内发光 + Bloom + 颗粒质感
- **纯程序化方案**：基于 Fresnel、法线点积，无需额外贴图
- **避免过度设计**：不集成调试工具、测试工具、复杂优化
- **保持组件简洁**：专注于视觉效果，不包含开发工具

### 性能优化策略
- **分级渲染**：内置 quality 参数，自动探测设备性能
- **动态裁剪**：根据设备性能调整效果复杂度
- **降级指引**：明确各级别期望表现

### 输入输出设计
- **归一化输入**：只接收 0-1 范围的 progress/velocity
- **内部平滑**：组件内部处理滤波、缓动
- **解耦设计**：避免主程序直接传入原始滚动事件

### 苹果竖屏特殊优化 ⭐ 更新
- **几何清理**：合并顶点、填洞、重新计算平滑法线、移除重叠面
- **轮廓优化**：subdivision→decimate 流程，确保轮廓平滑
- **法线质量**：运行时重算法线，避免噪点
- **纯程序化方案**：基于 Fresnel、法线点积和顶点/时间驱动参数
- **视角驱动厚度近似**：`abs(dot(normal, viewDir)) + 曲率近似`
- **轮廓检查**：特别关注与背景形成高对比的边缘区域
- **附加项：厚度贴图**：可选，用于差异化发光效果

## ⚠️ 风险控制机制 ⭐ 更新

### 里程碑复盘节点
- **阶段零结束**：原型验证，确认技术路线
- **阶段一结束**：SSS假体积 + 内发光效果验收，必要时削减Scope
- **阶段二结束**：后期处理效果验收，性能调优
- **阶段三结束**：滚动响应验收，集成测试

### 风险缓解策略 ⭐ 更新
- **技术风险**：优先使用现成效果，减少自定义Shader
- **性能风险**：早期性能测试，及时降级方案
- **集成风险**：提前确认依赖组件状态
- **时间风险**：里程碑复盘，必要时调整Scope
- **新增：Vapor 风格风险**：
  - **WebGL 限制**：接受"作弊"实现，控制场景对比度
  - **研发投入**：预留 Shader 编写、调色、参数调试时间
  - **素材统一**：为每个模型制作单独配置，避免"一套参数打天下"
  - **性能调优**：特别关注 SSS 假体积、Bloom/Blur 叠加以及移动端帧率

---

**重要提醒**：
- 每完成一个阶段都会及时更新 TODO 状态
- 确保进度透明可控
- 随时可以调整开发计划
- 优先保证基础功能可用
- **新增**：里程碑复盘机制，风险控制
