# 麻薯质感渲染组件（Mochi Sphere）

## 概述

完全独立的 Three.js + React 组件，实现柔软、发光、半透明的"麻薯质感"3D 渲染效果。

**核心特性**：
- ✅ **无需 SDF**：纯 Mesh 渲染（支持球体、OBJ、GLTF）
- ✅ **物理材质基底**：MeshPhysicalMaterial（transmission、roughness）
- ✅ **程序化冷暖渐变**：基于世界坐标的 3 色混合（Simplex Noise）
- ✅ **Fresnel 边缘发光**：自定义 shader 实现柔和边缘
- ✅ **多色体积外壳**：3 层渐变色叠加（蓝→粉→暖白）
- ✅ **表面颗粒细节**：避免色带的细微噪声
- ✅ **强化 Bloom 后期**：低阈值 + 大半径模糊（奶油光感）
- ✅ **Pastel 背景**：三层径向渐变 + 噪声
- ✅ **主题预设**：4 种配色方案（pastel、rainbow、warm、cool）
- ✅ **完全独立**：不依赖项目其他模块

---

## 快速开始

### 访问测试页面

```bash
npm run dev
# 访问 http://localhost:3001/mochi-test
```

### 基础使用

```tsx
import { MochiSphere } from '@/components/mochi';

export default function MyPage() {
  return <MochiSphere theme="pastel" />;
}
```

---

## API 文档

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| **几何** ||||
| `radius` | `number` | `1` | 球体半径 |
| `segments` | `number` | `64` | 球体分段数（越高越平滑） |
| **主材质** ||||
| `roughness` | `number` | `0.95` | 粗糙度（0-1，越高越磨砂） |
| `transmission` | `number` | `0.8` | 透射度（0-1，半透明玻璃感） |
| `thickness` | `number` | `1.5` | 厚度（SSS 近似） |
| `baseColor` | `string` | `'#ffd4e5'` | 主体颜色 |
| `attenuationColor` | `string` | `'#b8d4ff'` | 透射衰减色 |
| **Fresnel 发光** ||||
| `glowColor` | `string` | `'#ffb3d9'` | 边缘发光颜色 |
| `fresnelPower` | `number` | `2.5` | Fresnel 幂指数（2-3 推荐） |
| `rimRange` | `[number, number]` | `[0.2, 0.8]` | 边缘宽度控制 |
| `glowIntensity` | `number` | `1.0` | 发光强度 |
| **外壳层** ||||
| `shellCount` | `number` | `3` | 体积外壳层数 |
| `shellOffsets` | `number[]` | `[0.02, 0.04, 0.06]` | 每层偏移量 |
| **Bloom 后期** ||||
| `bloomStrength` | `number` | `1.2` | Bloom 强度（0.8-1.5） |
| `bloomRadius` | `number` | `0.7` | Bloom 半径（0.5-0.9） |
| `bloomThreshold` | `number` | `0.6` | Bloom 阈值（较低让更多区域发光） |
| **交互** ||||
| `autoRotate` | `boolean` | `true` | 自动旋转 |
| `rotationSpeed` | `number` | `0.3` | 旋转速度 |
| **主题** ||||
| `theme` | `'pastel' \| 'rainbow' \| 'warm' \| 'cool'` | - | 预设主题（会覆盖颜色配置） |
| **性能** ||||
| `enableTransmission` | `boolean` | `true` | 移动端可关闭以提升性能 |

---

## 主题预设

### Pastel（粉蓝柔和）
```tsx
<MochiSphere theme="pastel" />
```
- 基底：粉色 `#ffd4e5`
- 透射：蓝色 `#b8d4ff`
- 发光：粉紫 `#ffb3d9`

### Rainbow（彩虹渐变）
```tsx
<MochiSphere theme="rainbow" />
```
- 基底：黄色 `#ffeb3b`
- 透射：橙红 `#ff5722`
- 发光：青色 `#00bcd4`

### Warm（暖色调）
```tsx
<MochiSphere theme="warm" />
```
- 基底：奶油色 `#ffe5cc`
- 透射：橙色 `#ffccb3`
- 发光：粉红 `#ff9999`

### Cool（冷色调）
```tsx
<MochiSphere theme="cool" />
```
- 基底：浅蓝 `#cce5ff`
- 透射：蓝色 `#b3d9ff`
- 发光：天蓝 `#99ccff`

---

## 高级定制

### 自定义颜色

```tsx
<MochiSphere
  baseColor="#ff6ec7"
  attenuationColor="#00d4ff"
  glowColor="#ffdd00"
/>
```

### 调整柔和度

```tsx
<MochiSphere
  // 更柔和的边缘
  fresnelPower={2.0}
  rimRange={[0.1, 0.9]}

  // 更强的 Bloom
  bloomStrength={1.8}
  bloomRadius={0.9}
/>
```

### 性能优化（移动端）

```tsx
<MochiSphere
  enableTransmission={false}  // 关闭透射（改用 opacity）
  segments={32}               // 降低分段数
  shellCount={2}              // 减少外壳层数
  bloomStrength={0.8}         // 降低 Bloom 强度
/>
```

---

## 技术原理

### 渲染管线（5 层优化版）

#### 1️⃣ 主体材质（MeshPhysicalMaterial + Shader 注入）
- `roughness: 0.95` → 磨砂玻璃质感
- `transmission: 0.8` → 半透明（真实光学）
- `thickness: 1.5` → SSS 体积感近似
- **程序化渐变**（onBeforeCompile 注入）：
  ```glsl
  // Y 轴渐变（上冷下暖）
  float yGradient = vWorldPosition.y * 0.5 + 0.5;
  vec3 baseGradient = mix(warmColor, coolColor, yGradient);

  // Fresnel 边缘强化
  float fresnel = pow(1.0 - dot(vWorldNormal, viewDir), 2.0);
  vec3 gradientColor = mix(baseGradient, accentColor, fresnel * 0.3);

  // 细微噪声
  float noise = snoise(vWorldPosition * 8.0) * 0.03;
  gradientColor += vec3(noise);
  ```

#### 2️⃣ Fresnel 发光壳（ShaderMaterial）
```glsl
fresnel = pow(1.0 - dot(N, V), 2.5)
rim = smoothstep(0.2, 0.8, fresnel)
glow = rim * glowColor * 1.2  // 增强到 1.2
```

#### 3️⃣ 多色体积外壳（3 层渐变色）
- **第 1 层**（内）：浅蓝 `#b8d4ff` | opacity: 0.2
- **第 2 层**（中）：粉色 `#ffd4e5` | opacity: 0.13
- **第 3 层**（外）：暖白 `#ffe5d0` | opacity: 0.07
- 每层 `AdditiveBlending` 叠加 → 多彩体积雾

#### 4️⃣ Pastel 背景（三层径向渐变）
```glsl
// 中心 → 中间（淡紫）→ 边缘
vec3 color = mix(color1, color3, smoothstep(0.0, 0.6, dist));
color = mix(color, color2, smoothstep(0.6, 1.2, dist));
// 噪声抗色带
color += noise(vUv * 500.0) * 0.008;
```

#### 5️⃣ 强化 Bloom（UnrealBloomPass）
- **更低阈值**（0.4）→ 更多区域参与发光
- **更大半径**（0.9）→ 极度柔和晕散
- **更高强度**（1.8）→ 奶油般的边缘光感

### 关键技术点

**✅ 边缘可见但柔和**：
- `smoothstep(0.2, 0.8, fresnel)` 控制边缘宽度
- Bloom 大半径模糊但不完全消失

**✅ 抗色带（dither）**：
```glsl
float noise = fract(sin(dot(fragCoord.xy, vec2(12.9898, 78.233))) * 43758.5);
rim += (noise - 0.5) * 0.01;
```

**✅ 透明排序**：
- 主球体 `renderOrder: 0`
- Fresnel 壳 `renderOrder: 1`
- 外壳层 `renderOrder: 2+`

---

## 文件结构

```
src/components/mochi/
├── MochiSphere.tsx              # 主入口（Canvas 组合）
├── types.ts                     # TypeScript 类型定义
├── presets.ts                   # 主题预设配置
├── index.ts                     # 导出
├── core/
│   ├── MochiCore.tsx            # 核心球体（MeshPhysicalMaterial）
│   ├── FresnelShell.tsx         # Fresnel 发光壳
│   └── VolumeShells.tsx         # 多层体积外壳
├── shaders/
│   ├── fresnel.vert.ts          # Fresnel 顶点着色器
│   └── fresnel.frag.ts          # Fresnel 片元着色器
├── effects/
│   └── MochiComposer.tsx        # 后期效果组合（Bloom）
├── backgrounds/
│   └── GradientBackground.tsx   # 径向渐变背景
└── README.md                    # 本文档
```

---

## 常见问题

### Q: 为什么不用 SDF？
**A**: 参考图的柔和效果 90% 来自后期（Bloom、半透明、Fresnel），和几何表示无关。OBJ 模型 + 这套管线完全够用，且性能更好（GPU 光栅化比 raymarching 快 10-100 倍）。

### Q: 能否替换成 10k 书法模型？
**A**: 完全可以！只需修改 `MochiCore.tsx`：
```tsx
<mesh ref={meshRef}>
  <primitive object={yourOBJModel} />  {/* 替换 sphereGeometry */}
  <meshPhysicalMaterial ... />
</mesh>
```

### Q: 移动端卡顿怎么办？
**A**:
1. 关闭 `enableTransmission`（改用 opacity）
2. 降低 `segments`（32 足够）
3. 减少 `shellCount`（2 层）
4. 降低 Bloom 分辨率（修改 `MochiComposer.tsx`，使用 1/2 RT）

### Q: 边缘太亮/太暗？
**A**: 调整参数：
```tsx
<MochiSphere
  glowIntensity={0.5}        // 降低发光强度
  bloomStrength={0.8}        // 降低 Bloom 强度
  rimRange={[0.3, 0.7]}      // 缩小边缘宽度
/>
```

---

## 扩展计划

### 未来功能

- [ ] 支持加载 OBJ/GLTF 模型
- [ ] 动画系统（形变、颜色过渡）
- [ ] 多材质支持（不同区域不同质感）
- [ ] SSR（屏幕空间反射）增强
- [ ] 交互热区（鼠标悬停发光）

### 性能优化

- [ ] LOD（远处降低细节）
- [ ] Frustum Culling（视锥裁剪）
- [ ] 实例化渲染（多个麻薯球）

---

## 致谢

本组件实现参考了以下技术文档和案例：
- Three.js 官方文档（MeshPhysicalMaterial、EffectComposer）
- Shader Park 噪声驱动渲染案例
- 参考图：ref1-3（粉蓝人形）、IMG_6605（彩虹球）

---

**记住**：这是纯 Mesh 渲染，完全不依赖 SDF！换成 10k 书法模型也能达到同样的柔软效果！🍡
