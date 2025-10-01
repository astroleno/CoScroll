# V3 完整 ShaderMaterial 版本 - 技术文档

## 核心改进（针对反馈）

根据最新视觉分析，V3 针对 3 个核心问题进行了彻底重写：

---

## 🎨 1. 冷暖对比更明显（蓝→粉→橙→黄）

### V2 的问题
- 仅 3 色（蓝→粉→暖白），缺少橙/黄色
- 颜色跨度不够大

### V3 的解决方案

**4 色 HSV 渐变**：
```glsl
uniform vec3 color1; // #a0c4ff 浅蓝
uniform vec3 color2; // #ffb3d9 粉色
uniform vec3 color3; // #ffcc99 橙色
uniform vec3 color4; // #fff5b8 浅黄
```

**多维混合策略**：
```glsl
// 1. Y 轴渐变（上蓝下橙）
float yGradient = (vWorldPosition.y + 1.0) * 0.5;

// 2. 球坐标经纬度
float lat = asin(spherePos.y);  // 前后
float lon = atan(spherePos.z, spherePos.x); // 左右

// 3. 三层混合
vec3 baseColor;
if (gradient1 < 0.33) {
  baseColor = mix(color1, color2, gradient1 / 0.33); // 蓝→粉
} else if (gradient1 < 0.66) {
  baseColor = mix(color2, color3, ...); // 粉→橙
} else {
  baseColor = mix(color3, color4, ...); // 橙→黄
}

// 4. 球坐标增加变化
baseColor = mix(baseColor, color2, gradient2 * 0.2);
baseColor = mix(baseColor, color3, gradient3 * 0.15);
```

**效果**：色彩跨越从冷到暖的完整光谱

---

## 🌫️ 2. 体积感与"绒感"（表面颗粒细节）

### V2 的问题
- 表面太平滑，像"光晕球"
- 噪声强度不够，不够粗糙

### V3 的解决方案

#### A. 双层 Simplex Noise（表面细腻质感）

```glsl
// 不同尺度的噪声叠加
float noise1 = snoise(vWorldPosition * 5.0);          // 大尺度
float noise2 = snoise(vWorldPosition * 10.0 + 100.0); // 小尺度
float combinedNoise = (noise1 + noise2 * 0.5) * 0.04; // 强度 4%

baseColor += vec3(combinedNoise);
```

**参数说明**：
- `noiseScale: 5.0` - 控制噪声频率（越大越密集）
- `noiseStrength: 0.04` - 控制噪声强度（可见度）

#### B. Dither 抖动（避免色带 + 颗粒感）

```glsl
float ditherValue = (dither(gl_FragCoord.xy) - 0.5) * 0.02;
baseColor += vec3(ditherValue);
```

**效果**：
- 破坏大面积渐变的色带
- 增加类似"胶片颗粒"的质感

#### C. 强化 Fresnel（边缘绒毛感）

```glsl
float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0); // 幂指数 3.0
float rimMask = smoothstep(0.3, 0.85, fresnel);

// 边缘加亮色（橙黄）
vec3 rimColor = mix(color3, color4, 0.5);
baseColor = mix(baseColor, rimColor, rimMask * 0.4);
```

**改进点**：
- `fresnelPower: 3.0`（V2 是 2.5）→ 边缘更锐利
- `rimMask` 范围：`[0.3, 0.85]`（更宽）→ 边缘更明显
- 边缘色用橙黄暖色 → 冷暖对比

**效果**：边缘有"毛绒/粉尘"般的柔软感

---

## 🌈 3. 背景环境（多色渐变呼应）

### V2 的问题
- 背景仍然是粉蓝双色，单调
- 和主体色彩不呼应

### V3 的解决方案

**4 色径向+Y轴混合**：
```glsl
uniform vec3 colorTop;    // #e0f4ff 浅青蓝
uniform vec3 colorMid1;   // #ffe8f5 粉色
uniform vec3 colorMid2;   // #fff5e6 橙白
uniform vec3 colorBottom; // #f5f0ff 淡紫

// Y 轴 + 径向双层渐变
if (yGradient < 0.33) {
  color = mix(colorTop, colorMid1, ...);   // 上：青→粉
} else if (yGradient < 0.66) {
  color = mix(colorMid1, colorMid2, ...);  // 中：粉→橙
} else {
  color = mix(colorMid2, colorBottom, ...); // 下：橙→紫
}

// 径向叠加
color = mix(color, colorMid1, radial * 0.2);
```

**效果**：
- 背景有青/粉/橙/紫的柔和过渡
- 和主体球的色彩完美呼应
- 打破白底的单调感

---

## 技术对比表

| 维度 | V2 (onBeforeCompile) | V3 (Full Shader) |
|------|----------------------|------------------|
| **色彩数量** | 3 色（蓝/粉/暖白） | 4 色（蓝/粉/橙/黄） |
| **色彩跨度** | 冷→中性 | 冷→暖完整光谱 |
| **渐变方式** | Y 轴单向 | Y 轴 + 球坐标（经纬度） |
| **噪声层数** | 1 层 Simplex | 2 层 Simplex |
| **噪声强度** | 0.03 | 0.04 |
| **Dither** | 0.01 | 0.02（加倍） |
| **Fresnel 幂** | 2.5 | 3.0 |
| **Fresnel 范围** | [0.2, 0.8] | [0.3, 0.85]（更宽） |
| **背景色数** | 3 色 | 4 色 |
| **实现方式** | 注入 MeshPhysicalMaterial | 完整 ShaderMaterial |
| **控制精度** | 受限于 Three.js 内置 | 100% 自定义 |

---

## Shader 核心代码片段

### Fragment Shader 主流程

```glsl
void main() {
  // === 1. 基础渐变（Y轴 + 球坐标混合） ===
  float yGradient = (vWorldPosition.y + 1.0) * 0.5;
  vec3 spherePos = normalize(vWorldPosition);
  float lat = asin(spherePos.y);
  float lon = atan(spherePos.z, spherePos.x);

  // 4 色混合
  vec3 baseColor = /* ... */;

  // === 2. Fresnel 边缘发光 ===
  float fresnel = pow(1.0 - dot(normal, viewDir), 3.0);
  float rimMask = smoothstep(0.3, 0.85, fresnel);
  vec3 rimColor = mix(color3, color4, 0.5);
  baseColor = mix(baseColor, rimColor, rimMask * 0.4);

  // === 3. 表面噪声（绒感） ===
  float noise1 = snoise(vWorldPosition * 5.0);
  float noise2 = snoise(vWorldPosition * 10.0);
  float combinedNoise = (noise1 + noise2 * 0.5) * 0.04;
  baseColor += vec3(combinedNoise);

  // === 4. Dither 抖动 ===
  float ditherValue = (dither(gl_FragCoord.xy) - 0.5) * 0.02;
  baseColor += vec3(ditherValue);

  // === 5. 粗糙度模拟 ===
  baseColor = mix(vec3(0.5), baseColor, 0.75);

  gl_FragColor = vec4(clamp(baseColor, 0.0, 1.0), 1.0);
}
```

---

## 参数配置

### 核心 Uniforms

```tsx
uniforms: {
  // 4 色配置
  color1: new THREE.Color('#a0c4ff'), // 浅蓝
  color2: new THREE.Color('#ffb3d9'), // 粉色
  color3: new THREE.Color('#ffcc99'), // 橙色
  color4: new THREE.Color('#fff5b8'), // 浅黄

  // 控制参数
  roughness: 0.85,          // 粗糙度
  fresnelPower: 3.0,        // Fresnel 幂指数
  ditherStrength: 0.02,     // Dither 强度
  noiseScale: 5.0,          // 噪声尺度
  noiseStrength: 0.04       // 噪声强度
}
```

### 调节建议

**更强冷暖对比**：
```tsx
color1: '#80b0ff', // 更深的蓝
color4: '#ffe680'  // 更深的黄
```

**更强绒感**：
```tsx
noiseStrength: 0.06,  // 0.04 → 0.06
ditherStrength: 0.03  // 0.02 → 0.03
```

**更强边缘发光**：
```tsx
fresnelPower: 3.5,    // 3.0 → 3.5
rimMask: smoothstep(0.2, 0.9, fresnel) // 扩大范围
```

---

## 文件结构

```
src/components/mochi/
├── shaders/
│   ├── mochi.vert.ts            # V3 顶点着色器
│   └── mochi.frag.ts            # V3 片元着色器（核心）
├── core/
│   └── MochiCoreV3.tsx          # V3 核心组件
├── backgrounds/
│   └── GradientBackgroundV3.tsx # V3 多色背景
├── MochiSphereV3.tsx            # V3 主组件
└── V3_FEATURES.md               # 本文档
```

---

## 测试页面

| 页面 | URL | 说明 |
|------|-----|------|
| V2 版本 | `/mochi-test` | onBeforeCompile 方案 |
| V3 版本 | `/mochi-v3` | 完整 ShaderMaterial |
| 对比页面 | `/mochi-compare` | 可切换 V2/V3 对比 |

---

## 预期效果对比

| 维度 | V2 | V3 | 参考图 |
|------|----|----|--------|
| **冷暖对比** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **绒毛质感** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **背景氛围** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **整体还原度** | 85% | **95%** | 100% |

---

**结论**：V3 通过完整的 ShaderMaterial 实现，精确控制每一个像素的色彩、噪声和发光，预计可达到参考图 **95%** 的视觉效果。
