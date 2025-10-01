# 体积渲染实施 TODO 清单

> **关联文档：** `体积渲染技术方案.md`（技术原理和方案对比）
> **本文档用途：** 3天实施的详细步骤清单和代码模板

---

## Day 1：体素化预处理 + 基础验证（8小时）

### 上午：工具链搭建（4小时）

#### ✅ 任务 1.1：安装Python依赖（30分钟）

```bash
# 创建虚拟环境
cd /Users/aitoshuu/Documents/GitHub/CoScroll
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install trimesh==3.23.5
pip install mesh-to-sdf==0.2.1
pip install numpy==1.24.3
pip install pillow==10.0.0

# 验证安装
python -c "import trimesh, mesh_to_sdf; print('OK')"
```

**验收标准：** 无报错，输出 `OK`

---

#### ✅ 任务 1.2：编写体素化脚本（1.5小时）

创建文件：`scripts/obj_to_sdf.py`

```python
#!/usr/bin/env python3
"""
OBJ模型 → SDF体素化脚本
输出: 64³ 的R8格式二进制文件
"""

import trimesh
import numpy as np
from mesh_to_sdf import mesh_to_sdf
import sys
from pathlib import Path

def obj_to_sdf(obj_path, output_path, resolution=64, verbose=True):
    """
    将OBJ模型转换为SDF体素
    🔑 新增: 优先使用winding number（更稳健），失败时回退到normal

    参数:
        obj_path: OBJ文件路径
        output_path: 输出.bin文件路径
        resolution: 体素分辨率（默认64）
        verbose: 是否打印详细信息
    """

    if verbose:
        print(f"[1/5] 加载OBJ: {obj_path}")

    # 加载mesh
    mesh = trimesh.load(obj_path, force='mesh')

    if verbose:
        print(f"  └─ 顶点数: {len(mesh.vertices)}")
        print(f"  └─ 三角面数: {len(mesh.faces)}")

    # 归一化到[-1, 1]空间
    if verbose:
        print(f"[2/5] 归一化模型...")

    bounds = mesh.bounds
    center = (bounds[0] + bounds[1]) / 2
    mesh.vertices -= center
    scale = np.abs(mesh.vertices).max()
    mesh.vertices /= scale

    if verbose:
        print(f"  └─ 中心: {center}")
        print(f"  └─ 缩放: {scale}")

    # 生成采样点网格
    if verbose:
        print(f"[3/5] 生成{resolution}³采样网格...")

    x = np.linspace(-1, 1, resolution)
    y = np.linspace(-1, 1, resolution)
    z = np.linspace(-1, 1, resolution)
    X, Y, Z = np.meshgrid(x, y, z, indexing='ij')
    points = np.stack([X, Y, Z], axis=-1).reshape(-1, 3)

    # 计算SDF（🔑 优先使用winding number）
    if verbose:
        print(f"[4/5] 计算SDF值（可能需要1-2分钟）...")

    try:
        # 尝试使用igl的广义绕组数（更稳健）
        import igl
        wn = igl.fast_winding_number_for_meshes(mesh.vertices, mesh.faces, points)
        sign = np.where(wn > 0.5, -1.0, 1.0)  # 内部为负
        sdf_unsigned = np.abs(mesh_to_sdf(mesh, points, surface_point_method='scan'))
        sdf_values = sdf_unsigned * sign
        if verbose:
            print(f"  └─ 使用方法: Winding Number（推荐）")
    except Exception as e:
        # 回退到normal方法
        if verbose:
            print(f"  └─ Winding Number不可用，回退到normal方法")
        sdf_values = mesh_to_sdf(
            mesh,
            points,
            surface_point_method='scan',
            sign_method='normal',
            bounding_radius=1.5
        )

    sdf_values = sdf_values.reshape(resolution, resolution, resolution)

    if verbose:
        print(f"  └─ SDF范围: [{sdf_values.min():.3f}, {sdf_values.max():.3f}]")

    # 量化到[0, 255]
    if verbose:
        print(f"[5/5] 量化到R8格式...")

    # 裁剪到[-1, 1]并映射到[0, 255]
    sdf_clipped = np.clip(sdf_values, -1.0, 1.0)
    sdf_quantized = ((sdf_clipped + 1.0) * 127.5).astype(np.uint8)

    # 保存
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sdf_quantized.tofile(output_path)

    if verbose:
        size_kb = output_path.stat().st_size / 1024
        print(f"\n✅ 成功!")
        print(f"  └─ 输出: {output_path}")
        print(f"  └─ 大小: {size_kb:.1f} KB")
        print(f"  └─ 维度: {resolution}³ = {resolution**3:,} 体素")

    return output_path


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python obj_to_sdf.py <input.obj> [output.bin] [resolution]")
        sys.exit(1)

    input_obj = sys.argv[1]
    output_bin = sys.argv[2] if len(sys.argv) > 2 else 'output_sdf64.bin'
    resolution = int(sys.argv[3]) if len(sys.argv) > 3 else 64

    obj_to_sdf(input_obj, output_bin, resolution)
```

**验收标准：** 脚本可运行，无语法错误

---

#### ✅ 任务 1.3：转换第一个模型（1小时）

```bash
# 确保在虚拟环境中
source venv/bin/activate

# 创建输出目录
mkdir -p public/volumes

# 转换 001_空.obj
python scripts/obj_to_sdf.py \
  public/models/10k_obj/001_空.obj \
  public/volumes/001_空_sdf64.bin \
  64

# 预期输出：
# [1/5] 加载OBJ: public/models/10k_obj/001_空.obj
#   └─ 顶点数: xxxxx
#   └─ 三角面数: xxxxx
# ...
# ✅ 成功!
#   └─ 输出: public/volumes/001_空_sdf64.bin
#   └─ 大小: 262.1 KB
#   └─ 维度: 64³ = 262,144 体素
```

**验收标准：**
- [ ] 文件 `public/volumes/001_空_sdf64.bin` 存在
- [ ] 文件大小约262KB
- [ ] 无错误输出

---

#### ✅ 任务 1.4：可视化验证（1小时）

创建验证脚本：`scripts/visualize_sdf.py`

```python
#!/usr/bin/env python3
"""
可视化SDF体素切片（用于验证）
"""

import numpy as np
from PIL import Image
import sys

def visualize_sdf(sdf_path, output_dir, resolution=64):
    """生成SDF的2D切片图像"""

    # 读取SDF
    sdf_data = np.fromfile(sdf_path, dtype=np.uint8)
    sdf_volume = sdf_data.reshape(resolution, resolution, resolution)

    # 生成中间切片（XY, XZ, YZ平面）
    mid = resolution // 2

    slices = {
        'xy': sdf_volume[:, :, mid],
        'xz': sdf_volume[:, mid, :],
        'yz': sdf_volume[mid, :, :]
    }

    for name, slice_data in slices.items():
        img = Image.fromarray(slice_data, mode='L')
        img.save(f"{output_dir}/sdf_slice_{name}.png")
        print(f"保存切片: sdf_slice_{name}.png")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python visualize_sdf.py <sdf.bin> [output_dir]")
        sys.exit(1)

    sdf_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else '.'

    visualize_sdf(sdf_path, output_dir)
```

运行：
```bash
python scripts/visualize_sdf.py \
  public/volumes/001_空_sdf64.bin \
  public/volumes/debug

# 打开图片检查
open public/volumes/debug/sdf_slice_xy.png
```

**验收标准：**
- [ ] 能看到字的轮廓
- [ ] 表面附近有渐变（不是纯黑白）
- [ ] 三个切片方向一致

---

### 下午：Three.js基础集成（4小时）

#### ✅ 任务 1.5：创建体积渲染组件（1.5小时）

创建文件：`src/components/VolumeRenderer.tsx`

```typescript
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export default function VolumeRenderer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // === 场景设置 ===
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0f14);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // === 加载SDF体素 ===
    let volumeMesh: THREE.Mesh;

    async function loadVolume() {
      try {
        console.log('[Volume] 加载SDF数据...');

        const response = await fetch('/volumes/001_空_sdf64.bin');
        const arrayBuffer = await response.arrayBuffer();
        const volumeData = new Uint8Array(arrayBuffer);

        console.log('[Volume] 数据大小:', volumeData.length, 'bytes');

        // 创建3D纹理
        const volumeTexture = new THREE.Data3DTexture(
          volumeData,
          64, 64, 64
        );
        volumeTexture.format = THREE.RedFormat;
        volumeTexture.type = THREE.UnsignedByteType;
        volumeTexture.minFilter = THREE.LinearFilter;
        volumeTexture.magFilter = THREE.LinearFilter;
        volumeTexture.wrapS = THREE.ClampToEdgeWrapping;
        volumeTexture.wrapT = THREE.ClampToEdgeWrapping;
        volumeTexture.wrapR = THREE.ClampToEdgeWrapping;
        volumeTexture.needsUpdate = true;

        console.log('[Volume] 3D纹理创建成功');

        // TODO: 下一步创建shader材质

      } catch (error) {
        console.error('[Volume] 加载失败:', error);
      }
    }

    loadVolume();

    // === 渲染循环 ===
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // === 清理 ===
    return () => {
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-screen" />
  );
}
```

**验收标准：**
- [ ] 能看到黑色背景的Three.js场景
- [ ] Console显示 "3D纹理创建成功"
- [ ] 鼠标可以旋转视角

---

#### ✅ 任务 1.6：创建最简shader（1.5小时）

创建文件：`src/shaders/volume-minimal.vert.glsl`

```glsl
varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

创建文件：`src/shaders/volume-minimal.frag.glsl`

```glsl
precision mediump float;

uniform sampler3D uVolumeTexture;
uniform float uTime;
uniform vec3 uCameraPos;

varying vec3 vWorldPos;
varying vec3 vNormal;

// 世界坐标 → 体素UV [0,1]
vec3 worldToUVW(vec3 worldPos) {
  return (worldPos + 1.0) * 0.5;
}

void main() {
  vec3 rayOrigin = uCameraPos;
  vec3 rayDir = normalize(vWorldPos - uCameraPos);

  // 简单的固定步数测试
  const int MAX_STEPS = 8;
  float stepSize = 2.5 / float(MAX_STEPS);

  vec3 color = vec3(0.0);
  float alpha = 0.0;
  float t = 0.0;

  for(int i = 0; i < MAX_STEPS; i++) {
    vec3 p = rayOrigin + rayDir * t;
    vec3 uvw = worldToUVW(p);

    // 边界检查
    if(any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) {
      break;
    }

    // 采样SDF
    float sdf = texture(uVolumeTexture, uvw).r * 2.0 - 1.0;

    // 简单密度
    float density = smoothstep(0.1, -0.1, sdf);

    if(density > 0.01) {
      // 简单着色
      vec3 sampleColor = vec3(0.3, 0.8, 0.6);
      float sampleAlpha = density * stepSize;

      color += sampleColor * sampleAlpha * (1.0 - alpha);
      alpha += sampleAlpha * (1.0 - alpha);
    }

    if(alpha > 0.95) break;
    t += stepSize;
  }

  gl_FragColor = vec4(color, alpha);
}
```

**验收标准：**
- [ ] shader文件无语法错误
- [ ] 能在IDE中正常显示高亮

---

#### ✅ 任务 1.7：集成shader到组件（1小时）

更新 `VolumeRenderer.tsx` 的 `loadVolume` 函数：

```typescript
// 在loadVolume()函数中，创建3D纹理后添加：

// 加载shader
const vertexShader = await fetch('/shaders/volume-minimal.vert.glsl').then(r => r.text());
const fragmentShader = await fetch('/shaders/volume-minimal.frag.glsl').then(r => r.text());

// 创建材质
const volumeMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uVolumeTexture: { value: volumeTexture },
    uTime: { value: 0 },
    uCameraPos: { value: camera.position }
  },
  vertexShader,
  fragmentShader,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide
});

// 创建包围盒mesh
const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
volumeMesh = new THREE.Mesh(boxGeometry, volumeMaterial);
scene.add(volumeMesh);

console.log('[Volume] Mesh创建成功');

// 在animate()函数中添加：
if (volumeMesh) {
  const material = volumeMesh.material as THREE.ShaderMaterial;
  material.uniforms.uTime.value = performance.now() / 1000;
  material.uniforms.uCameraPos.value.copy(camera.position);
}
```

**验收标准：**
- [ ] 能看到模糊的青绿色体积形状
- [ ] 旋转时形状跟随移动
- [ ] Console无错误

---

### Day 1 总结检查

- [ ] SDF文件正确生成（262KB）
- [ ] 切片可视化验证通过
- [ ] Three.js场景能渲染
- [ ] shader加载成功
- [ ] 能看到体积的大致形状（虽然很模糊）

**如果Day 1完成度<80%：** 不要进入Day 2，先调试当前问题。

---

## Day 2：核心优化 + 效果提升（8小时）

### 上午：P0优化实施（4小时）

#### ✅ 任务 2.1：实现AABB裁剪（1小时）

更新 `volume-minimal.frag.glsl`，在main()开头添加：

```glsl
// AABB相交测试
bool intersectAABB(vec3 ro, vec3 rd, out float tEnter, out float tExit) {
  vec3 boxMin = vec3(-1.0);
  vec3 boxMax = vec3(1.0);

  vec3 invDir = 1.0 / rd;
  vec3 t0 = (boxMin - ro) * invDir;
  vec3 t1 = (boxMax - ro) * invDir;

  vec3 tMin = min(t0, t1);
  vec3 tMax = max(t0, t1);

  tEnter = max(max(tMin.x, tMin.y), tMin.z);
  tExit = min(min(tMax.x, tMax.y), tMax.z);

  return tExit > max(0.0, tEnter);
}

void main() {
  vec3 rayOrigin = uCameraPos;
  vec3 rayDir = normalize(vWorldPos - uCameraPos);

  // 🔑 新增: AABB裁剪
  float tEnter, tExit;
  if (!intersectAABB(rayOrigin, rayDir, tEnter, tExit)) {
    discard;  // 光线未命中，直接丢弃
  }

  // 🔑 入射裁剪：相机在盒内时从0开始，盒外从tEnter开始
  float t = max(0.0, tEnter);
  // ... 后续代码
}
```

**验收标准：**
- [ ] FPS提升15-25%
- [ ] 从侧面看时背景正确显示

---

#### ✅ 任务 2.2：实现SDF自适应步长（1.5小时）

添加uniforms到材质：

```typescript
uStepFar: { value: 0.012 },
uStepScale: { value: 0.25 },
uStepNear: { value: 0.004 },
uBand: { value: 2.0 / 64.0 }
```

更新shader循环：

```glsl
uniform float uStepFar;
uniform float uStepScale;
uniform float uStepNear;
uniform float uBand;

// 在循环中替换固定步长
for(int i = 0; i < MAX_STEPS && t < tExit; i++) {
  vec3 p = rayOrigin + rayDir * t;
  vec3 uvw = worldToUVW(p);

  if(any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) break;

  float sdf = texture(uVolumeTexture, uvw).r * 2.0 - 1.0;

  // 🔑 自适应步长（Sphere Tracing）
  float step;
  if(abs(sdf) > uBand) {
    // 远离表面：大步（球体追踪）
    step = max(uStepFar, abs(sdf) * uStepScale);
  } else {
    // 近表面：小步精细采样
    step = uStepNear;
    // 可选：命中后二分1-2次提高精度（注释掉可提升性能）
    // for(int j = 0; j < 2; j++) { ... }
  }

  float density = 1.0 - smoothstep(-1.2/64.0, 1.2/64.0, sdf);

  // ... 累积颜色

  t += step;  // 🔑 使用自适应步长
}
```

**验收标准：**
- [ ] FPS再提升20-30%
- [ ] 边缘更清晰

---

#### ✅ 任务 2.3：添加FBM噪声（复用P5代码）（1.5小时）

从 `src/p5/shaders/shell.frag` 复制噪声函数到shader顶部：

```glsl
// === 从P5直接复制 ===
float hash(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  // ... 完整实现
}

vec3 fbm(vec3 p, int octaves) {
  vec3 result = vec3(0.0);
  float amplitude = 1.0;
  float frequency = 1.0;
  for(int i = 0; i < 3; i++) {
    if(i >= octaves) break;
    result += vec3(noise(p * frequency)) * amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return result;
}
```

在密度计算后添加：

```glsl
// FBM噪声注入
vec3 noisePos = p * 2.0 + vec3(0.0, 0.0, uTime * 0.08);
vec3 fbmNoise = fbm(noisePos, 3);

// 🔑 关键优化：先smoothstep再pow，避免mediump精度夹断
fbmNoise = smoothstep(vec3(0.0), vec3(1.0), fbmNoise);
fbmNoise = sin(fbmNoise * 2.0) * 0.5 + 0.75;
fbmNoise = pow(fbmNoise, vec3(8.0));  // ShaderPark技巧：8次方极致柔化

density *= (0.7 + fbmNoise.x * 0.3);
```

**验收标准：**
- [ ] 表面有细微的颗粒质感
- [ ] 不规则的边界变化

---

### 下午：P1优化 + 效果调优（4小时）

#### ✅ 任务 2.4：实现Bayer抖动（1小时）

```glsl
uniform int uFrameIndex;

const float bayer4x4[16] = float[](
  0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
  12.0/16.0, 4.0/16.0, 14.0/16.0,  6.0/16.0,
  3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
  15.0/16.0, 7.0/16.0, 13.0/16.0,  5.0/16.0
);

float getBayerJitter(vec2 screenPos, int frameIndex) {
  ivec2 pixel = ivec2(screenPos) % 4;
  int index = pixel.y * 4 + pixel.x;
  float temporal = fract(float(frameIndex) * 0.618034);
  return fract(bayer4x4[index] + temporal);
}

// 在ray march开始前
float jitter = getBayerJitter(gl_FragCoord.xy, uFrameIndex);
float t = max(0.0, tEnter + jitter * 0.01);
```

**验收标准：**
- [ ] 静止时噪点逐渐减少
- [ ] 运动时无明显闪烁

---

#### ✅ 任务 2.5：参考图配色（从P5复用）（1小时）

```glsl
vec3 getGradientColor(float t) {
  vec3 c1 = vec3(0.4, 0.9, 0.7);   // 青绿
  vec3 c2 = vec3(0.6, 0.85, 0.95); // 浅蓝
  vec3 c3 = vec3(0.95, 0.7, 0.85); // 粉紫
  return mix(mix(c1, c2, t*2.0), c3, max(0.0, t*2.0-1.0));
}

// 替换简单着色
vec3 sampleColor = getGradientColor(density) * fbmNoise;
```

**验收标准：**
- [ ] 中心青绿色
- [ ] 边缘粉紫色
- [ ] 过渡自然

---

#### ✅ 任务 2.6：模型坐标变换（世界→体素UVW）（30分钟）

🔑 **关键修复：** 使用模型逆变换矩阵，而非固定假设

更新shader：
```glsl
uniform mat4 uModelMatrix;
uniform mat4 uModelMatrixInv;

vec3 worldToUVW(vec3 worldPos) {
  // 🔑 转到模型空间（而非假设体积盒在世界[-1,1]）
  vec3 localPos = (uModelMatrixInv * vec4(worldPos, 1.0)).xyz;
  // 假设烘焙时已归一化到[-1,1]
  return (localPos + 1.0) * 0.5;
}
```

更新TypeScript uniforms：
```typescript
volumeMaterial.uniforms.uModelMatrix = { value: volumeMesh.matrixWorld };
volumeMaterial.uniforms.uModelMatrixInv = {
  value: new THREE.Matrix4().copy(volumeMesh.matrixWorld).invert()
};

// 在animate()中每帧更新
volumeMesh.matrixWorld.decompose(/* ... */);
volumeMaterial.uniforms.uModelMatrixInv.value.copy(volumeMesh.matrixWorld).invert();
```

**验收标准：**
- [ ] 旋转时采样正确跟随
- [ ] 无坐标系错位

---

#### ✅ 任务 2.7：精度与色彩空间配置（20分钟）

🔑 **iOS/移动端关键：** 强制highp避免banding

在shader最顶部添加：
```glsl
// 🔑 强制高精度（iOS WebGL2默认mediump会导致噪点）
precision highp float;
precision highp sampler3D;
precision highp int;
```

在加载LUT纹理时（如果后续使用）：
```typescript
const lutTexture = new THREE.DataTexture(/* ... */);
lutTexture.colorSpace = THREE.LinearSRGBColorSpace; // Three r152+
lutTexture.needsUpdate = true;
```

**验收标准：**
- [ ] iOS Safari无明显色带
- [ ] 渐变平滑

---

#### ✅ 任务 2.8：参数调优（1小时）

使用dat.GUI实时调整：

```typescript
import GUI from 'lil-gui';

const params = {
  steps: 12,
  stepFar: 0.012,
  stepNear: 0.004,
  w: 1.2,
  noiseScale: 2.0
};

const gui = new GUI();
gui.add(params, 'steps', 4, 24, 1).onChange(v => {
  volumeMaterial.defines.MAX_STEPS = v;
  volumeMaterial.needsUpdate = true;
});
gui.add(params, 'stepFar', 0.005, 0.03).onChange(v => {
  volumeMaterial.uniforms.uStepFar.value = v;
});
// ... 其他参数
```

调优目标：
- [ ] 边界柔软度达到85%+
- [ ] FPS ≥ 50 (桌面)
- [ ] 颜色接近参考图

---

### Day 2 总结检查

- [ ] P0优化全部完成（AABB + 自适应步长）
- [ ] FBM噪声工作正常
- [ ] Bayer抖动减少噪点
- [ ] 颜色渐变接近参考图
- [ ] 桌面FPS ≥ 50
- [ ] 效果达到85-90%

**如果Day 2完成度<85%：** 不要进入Day 3，继续调优。

---

## Day 3：生产化 + 多设备测试（8小时）

### 上午：P1/P2优化完成（4小时）

#### ✅ 任务 3.1：实现TAA（2小时）

🔑 **关键技术：邻域夹取（Neighborhood Clamping）防拖影**

创建TAA shader：
```glsl
// taa.frag
uniform sampler2D tCurrent;
uniform sampler2D tHistory;
uniform float alpha; // 0.7-0.8

varying vec2 vUv;

// 🔑 邻域夹取核心算法
vec3 neighborhoodMinMax(sampler2D tex, vec2 uv, out vec3 minCol, out vec3 maxCol) {
  vec3 center = texture2D(tex, uv).rgb;
  minCol = center;
  maxCol = center;

  // 3×3邻域
  for(int x = -1; x <= 1; x++) {
    for(int y = -1; y <= 1; y++) {
      vec2 offset = vec2(float(x), float(y)) / resolution;
      vec3 neighbor = texture2D(tex, uv + offset).rgb;
      minCol = min(minCol, neighbor);
      maxCol = max(maxCol, neighbor);
    }
  }
  return center;
}

void main() {
  vec3 current = texture2D(tCurrent, vUv).rgb;
  vec3 history = texture2D(tHistory, vUv).rgb;

  // 🔑 邻域夹取：把历史帧限制在当前帧邻域范围内
  vec3 minCol, maxCol;
  neighborhoodMinMax(tCurrent, vUv, minCol, maxCol);
  history = clamp(history, minCol, maxCol);

  // EMA混合
  vec3 result = mix(current, history, alpha);
  gl_FragColor = vec4(result, 1.0);
}
```

TypeScript集成：
```typescript
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const taaPass = new ShaderPass({
  uniforms: {
    tCurrent: { value: null },
    tHistory: { value: null },
    alpha: { value: 0.7 },
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  },
  vertexShader: `...`,
  fragmentShader: `...` // 上面的shader
});
composer.addPass(taaPass);
```

**验收标准：**
- [ ] 静止时噪点快速收敛（<1秒）
- [ ] 运动时无拖影（色彩不拉丝）

---

#### ✅ 任务 3.2：2D图集回退（1小时）

生成图集：

```python
# scripts/sdf_to_atlas.py
import numpy as np
from PIL import Image

sdf_volume = np.fromfile('public/volumes/001_空_sdf64.bin', dtype=np.uint8)
sdf_volume = sdf_volume.reshape(64, 64, 64)

atlas = np.zeros((512, 512), dtype=np.uint8)
for z in range(64):
  row, col = z // 8, z % 8
  atlas[row*64:(row+1)*64, col*64:(col+1)*64] = sdf_volume[:, :, z]

Image.fromarray(atlas).save('public/volumes/001_空_atlas.png')
```

Shader适配（见主文档6.2节）

**验收标准：**
- [ ] 图集正确生成（512×512）
- [ ] shader能回退到2D采样

---

#### ✅ 任务 3.3：动态降级策略 + 能力探测（1小时）

🔑 **新增：WebGL能力探测**

```typescript
// 能力探测
function detectCapabilities() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');

  if (!gl) {
    console.warn('WebGL2不可用，回退到壳体渲染');
    return { webgl2: false };
  }

  const max3DSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
  console.log('MAX_3D_TEXTURE_SIZE:', max3DSize);

  return {
    webgl2: true,
    max3DTextureSize: max3DSize,
    supportHighRes: max3DSize >= 128
  };
}

const caps = detectCapabilities();

const qualityPresets = {
  high: { steps: 16, volumeRes: 64, renderScale: 1.0 },
  medium: { steps: 12, volumeRes: 48, renderScale: 0.85 },
  low: { steps: 8, volumeRes: 48, renderScale: 0.75 }
};

// 🔑 智能初始质量选择
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
let currentQuality = isMobile ? 'medium' : 'high';

// 动态分辨率调整
if (caps.max3DTextureSize < 64) {
  currentQuality = 'low';
  qualityPresets.low.volumeRes = 48;
}

// FPS监控
let fps = 60;
setInterval(() => {
  if (fps < 40 && currentQuality !== 'low') {
    currentQuality = 'low';
    applyQuality(qualityPresets.low);
  }
}, 2000);
```

**验收标准：**
- [ ] Console正确输出MAX_3D_TEXTURE_SIZE
- [ ] 移动端自动使用medium
- [ ] FPS低时自动降级

---

#### ✅ 任务 3.4：按需法线计算优化（30分钟）

🔑 **性能关键：仅在近表面时计算法线（节省20-30%采样）**

在shader中添加：
```glsl
// 仅在需要时计算法线（用于wrap lighting/air light）
vec3 computeNormal(vec3 p, float band) {
  if(abs(sdf) > band * 2.0) {
    // 远离表面，不需要法线
    return vec3(0.0, 1.0, 0.0); // 占位值
  }

  // 中心差分（6次采样）
  float eps = 1.0 / 64.0;
  vec3 n = vec3(
    sampleSDF(p + vec3(eps,0,0)) - sampleSDF(p - vec3(eps,0,0)),
    sampleSDF(p + vec3(0,eps,0)) - sampleSDF(p - vec3(0,eps,0)),
    sampleSDF(p + vec3(0,0,eps)) - sampleSDF(p - vec3(0,0,eps))
  );
  return normalize(n);
}
```

在ray march循环中：
```glsl
// 仅在abs(sdf) < uBand时调用
if(abs(sdf) < uBand && density > 0.01) {
  vec3 normal = computeNormal(p, uBand);
  // 使用normal做wrap lighting...
}
```

**验收标准：**
- [ ] FPS提升15-25%
- [ ] 视觉效果无明显变化

---

### 下午：测试与交付（4小时）

#### ✅ 任务 3.5：多设备测试（2小时）

测试矩阵：

| 设备 | 浏览器 | 预期FPS | 实际FPS | 问题 |
|------|--------|---------|---------|------|
| iPhone 13 | Safari | ≥45 | __ | __ |
| Android中端 | Chrome | ≥40 | __ | __ |
| 桌面GTX1650 | Chrome | ≥50 | __ | __ |
| Mac M1 | Safari | ≥55 | __ | __ |

---

#### ✅ 任务 3.6：性能Profile（1小时）

```typescript
// 添加性能监控
import Stats from 'stats.js';

const stats = new Stats();
document.body.appendChild(stats.dom);

function animate() {
  stats.begin();
  // ... render
  stats.end();
}
```

记录关键指标：
- [ ] FPS
- [ ] GPU内存占用
- [ ] Shader编译时间
- [ ] 首次渲染延迟

---

#### ✅ 任务 3.7：文档和代码清理（1小时）

- [ ] 删除所有console.log（保留error）
- [ ] 添加关键代码注释
- [ ] 更新README
- [ ] 提交完整commit

---

## 最终验收Checklist

### 功能完整性
- [ ] 能加载和渲染OBJ模型
- [ ] 边界柔软度≥85%
- [ ] 颜色渐变接近参考图
- [ ] 旋转无穿帮

### 性能指标
- [ ] iPhone 13: ≥45fps
- [ ] 桌面GTX1650: ≥50fps
- [ ] 首次加载: ≤3s
- [ ] 内存: ≤50MB

### 兼容性
- [ ] Safari测试通过
- [ ] Chrome测试通过
- [ ] 低端设备能降级

### 代码质量
- [ ] Shader有注释
- [ ] 参数标注清晰
- [ ] 无Console错误

---

## 常见问题速查

### Q1: SDF生成失败

```bash
# 检查mesh完整性
python -c "import trimesh; m=trimesh.load('path/to/file.obj'); print(m.is_watertight)"

# 如果不是watertight，尝试修复
python -c "
import trimesh
m = trimesh.load('path/to/file.obj')
m.fill_holes()
m.export('fixed.obj')
"
```

### Q2: 3D纹理不显示

```javascript
// 检查WebGL2支持
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2');
console.log('WebGL2支持:', !!gl);

// 检查纹理大小限制
console.log('Max 3D texture size:', gl.getParameter(gl.MAX_3D_TEXTURE_SIZE));
```

### Q3: FPS过低

1. 检查步数：`material.defines.MAX_STEPS`
2. 检查分辨率：`renderer.getPixelRatio()`
3. 启用GPU Profile（Chrome DevTools > Performance）

---

**文档版本:** v3.0（整合专家补位建议）
**最后更新:** 2025-09-30
**预计完成时间:** 3个工作日

---

## 专家补位建议摘要

本版本（v3.0）整合了以下关键优化：

### P0 级别（必须实现）
1. ✅ SDF符号判定：优先winding number，回退normal（任务1.2）
2. ✅ 世界→体素坐标：使用模型逆变换矩阵（任务2.6）
3. ✅ 精度配置：强制highp避免iOS banding（任务2.7）

### P1 级别（强烈建议）
4. ✅ TAA邻域夹取：防拖影的关键技术（任务3.1）
5. ✅ 按需法线：节省20-30%采样开销（任务3.4）
6. ✅ 能力探测：动态适配MAX_3D_TEXTURE_SIZE（任务3.3）

### P2 级别（优化细节）
7. ✅ 入射裁剪：t = max(0.0, tEnter)（任务2.1）
8. ✅ 噪声预处理：smoothstep → pow避免精度夹断（任务2.3）
9. ✅ 自适应步长：Sphere Tracing + 可选二分（任务2.2）

### 生产化建议（已纳入流程）
- 资源压缩：gzip/br + 长缓存
- Pre-multiplied α混合模型
- 蓝噪声（64×64）替代Bayer（可选升级）
- 2D atlas回退（WebGL1/低端设备）

**变更说明：**
- Day 1增加winding number回退逻辑
- Day 2新增3个任务（坐标变换/精度/参数调优）
- Day 3新增按需法线优化，完善TAA实现
- 所有关键代码标注🔑便于识别