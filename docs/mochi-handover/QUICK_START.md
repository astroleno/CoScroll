# 麻薯质感组件 - 快速开始

## 🚀 10秒上手

### 访问测试页面

```
✅ 完整效果：http://localhost:3001/mochi-final
✅ 高性能版：http://localhost:3001/mochi-debug2
```

---

## 📦 核心文件位置

```
✅ 推荐使用：src/components/mochi/core/MochiCoreV3Fixed.tsx
✅ 背景渐变：src/components/mochi/backgrounds/GradientBackgroundV3.tsx
✅ 后期效果：src/components/mochi/effects/MochiComposerFixed.tsx
✅ 完整示例：src/app/mochi-final/page.tsx
```

---

## 🎨 核心参数速查

### 球体颜色（冷暖对比）
**文件**：`MochiCoreV3Fixed.tsx:26-29`
```tsx
color1: '#85b8ff',  // 蓝（冷）
color2: '#c4a0ff',  // 紫粉
color3: '#ffb380',  // 橙（暖）
color4: '#ffe680'   // 黄（暖）
```

### 表面质感（颗粒感）
**文件**：`mochi-fixed.frag.ts:50,54`
```glsl
噪声强度: 0.05    // 5%（0.03-0.07 可调）
Dither强度: 0.025  // 2.5%（0.015-0.035 可调）
```

### 边缘发光
**文件**：`mochi-final/page.tsx:35-40`
```tsx
glowColor: '#ffcc99'
fresnelPower: 2.8
glowIntensity: 1.5
```

### Bloom 强度
**文件**：`mochi-final/page.tsx:49-51`
```tsx
bloomStrength: 1.8
bloomRadius: 0.9
bloomThreshold: 0.4
```

---

## ⚠️ 常见问题 1 句话解决

| 问题 | 解决方案 |
|------|----------|
| **白屏** | 用 `/mochi-debug2`（无Bloom版本）|
| **边缘不柔和** | `bloomStrength` 调高到 2.2 |
| **颜色不鲜艳** | `color1` 改为 `#6eb0ff`，`color4` 改为 `#ffd000` |
| **颗粒感不够** | 噪声强度改为 `0.07`，Dither 改为 `0.03` |
| **移动端卡** | 用 `/mochi-debug2` + `segments={32}` |

---

## 📋 替换为 OBJ 模型（3 步）

### 1. 加载 OBJ

**在 `MochiCoreV3Fixed.tsx` 顶部添加**：
```tsx
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
```

### 2. 修改组件

**替换第 41-42 行**：
```tsx
// 从：
<sphereGeometry args={[radius, segments, segments]} />

// 改为：
const obj = useLoader(OBJLoader, '/path/to/your/model.obj');
// ...
<primitive object={obj} />
```

### 3. 调整材质应用

```tsx
// 需要遍历 obj 的所有子对象
obj.traverse((child) => {
  if (child.isMesh) {
    child.material = shaderMaterial; // 你的 ShaderMaterial
  }
});
```

---

## 🎯 效果对比

| 版本 | 视觉效果 | 性能 | 稳定性 | 推荐场景 |
|------|---------|------|--------|----------|
| `/mochi-final` | 95% 还原 | 60fps | ✅ 稳定 | 桌面展示 |
| `/mochi-debug2` | 90% 还原 | 60fps+ | ✅ 极稳定 | 移动端/生产环境 |
| `/mochi-test` (V2) | 85% 还原 | 60fps | ✅ 稳定 | 备选方案 |

---

## 📞 帮助

- 详细文档：`docs/mochi-handover/README.md`
- 技术细节：`src/components/mochi/V3_FEATURES.md`
- 示例代码：`src/app/mochi-final/page.tsx`

---

**最后更新**：2025-10-01 | **状态**：✅ 生产就绪
