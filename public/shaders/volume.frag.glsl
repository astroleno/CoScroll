// 体积渲染 - 片段着色器
// 麻薯体积感 + 模糊边界版本
precision highp float;
precision highp sampler3D;

uniform sampler3D uVolumeTexture;
uniform float uTime;
uniform vec3 uCameraPos;
uniform mat4 uModelMatrixInv;

// 可调参数
uniform float uSoftEdgeWidth;    // 软边宽度 (0.1-0.5)
uniform float uDensityMultiplier; // 密度倍增器 (1.0-5.0)
uniform float uCoreBoost;        // 核心密度增强 (0.0-1.0)
uniform float uNoiseStrength;    // 噪声强度 (0.0-0.5)
uniform float uBrightness;       // 整体亮度 (0.5-3.0)
uniform float uOpacityMultiplier; // 整体不透明度倍增器 (0.1-3.0)
uniform float uEdgeGlowStrength; // 边缘发光强度 (0.0-8.0)
uniform float uDensityCutoff;    // 密度阈值 (0.0-0.5)
uniform vec3 uColorBottom;       // 底部颜色（蓝）
uniform vec3 uColorMiddle;       // 中部颜色（黄）
uniform vec3 uColorTop;          // 顶部颜色（粉）
uniform vec3 uVolumeScale;       // 体积盒缩放（用于非立方体）
uniform int uAxisMapping;        // 轴向映射模式 (0-5)

varying vec3 vWorldPos;
varying vec3 vNormal;

// === 3D FBM噪声 ===
vec3 hash3(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
}

float noise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep

  return mix(
    mix(
      mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
          dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), f.x),
      mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
          dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), f.x), f.y),
    mix(
      mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
          dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), f.x),
      mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
          dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise3D(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// 世界坐标 → 体素UVW [0,1]
vec3 worldToUVW(vec3 worldPos) {
  // 转到模型局部坐标
  vec3 localPos = (uModelMatrixInv * vec4(worldPos, 1.0)).xyz;
  // 考虑非均匀缩放：除以实际的体积盒半尺寸
  vec3 normalizedPos = localPos / uVolumeScale;
  return (normalizedPos + 1.0) * 0.5;
}

// AABB相交测试（在局部空间，考虑非均匀缩放）
bool intersectAABB(vec3 rayOrigin, vec3 rayDir, out float tEnter, out float tExit) {
  vec3 boxMin = -uVolumeScale;
  vec3 boxMax = uVolumeScale;

  vec3 invDir = 1.0 / rayDir;
  vec3 t0 = (boxMin - rayOrigin) * invDir;
  vec3 t1 = (boxMax - rayOrigin) * invDir;

  vec3 tMin = min(t0, t1);
  vec3 tMax = max(t0, t1);

  tEnter = max(max(tMin.x, tMin.y), tMin.z);
  tExit = min(min(tMax.x, tMax.y), tMax.z);

  return tExit > max(0.0, tEnter);
}

void main() {
  // 世界空间的射线
  vec3 rayOrigin = uCameraPos;
  vec3 rayDir = normalize(vWorldPos - uCameraPos);

  // 转到局部空间做AABB测试
  vec3 localOrigin = (uModelMatrixInv * vec4(rayOrigin, 1.0)).xyz;
  vec3 localDir = normalize((uModelMatrixInv * vec4(rayDir, 0.0)).xyz);

  float tEnter, tExit;
  if (!intersectAABB(localOrigin, localDir, tEnter, tExit)) {
    discard; // 未命中体积盒
  }

  // Ray Marching参数（在局部空间）
  const int MAX_STEPS = 16;  // 降低步数优化性能
  float rayLength = tExit - tEnter;
  float stepSize = rayLength / float(MAX_STEPS);

  vec3 color = vec3(0.0);
  float alpha = 0.0;
  float t = max(0.0, tEnter);

  for (int i = 0; i < MAX_STEPS; i++) {
    // 在局部空间推进射线
    vec3 localSamplePos = localOrigin + localDir * t;

    // 局部空间 → UVW [0,1]
    vec3 normalizedPos = localSamplePos / uVolumeScale;
    vec3 uvw = (normalizedPos + 1.0) * 0.5;

    // 边界检查
    if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) {
      break;
    }

    // 采样SDF值（R8格式：[0,255] → [0,1] → [-1,1]）
    // 动态轴向映射（6种排列）
    vec3 sampleUVW;
    if (uAxisMapping == 0) {
      sampleUVW = uvw.xyz; // xyz
    } else if (uAxisMapping == 1) {
      sampleUVW = uvw.xzy; // xzy
    } else if (uAxisMapping == 2) {
      sampleUVW = uvw.yxz; // yxz
    } else if (uAxisMapping == 3) {
      sampleUVW = uvw.yzx; // yzx
    } else if (uAxisMapping == 4) {
      sampleUVW = uvw.zxy; // zxy
    } else {
      sampleUVW = uvw.zyx; // zyx
    }

    float sdfSample = texture(uVolumeTexture, sampleUVW).r;
    float sdf = sdfSample * 2.0 - 1.0;

    // DEBUG: 检查SDF值范围
    // 内部应该<0，外部>0，表面≈0
    // if (i == 0) { gl_FragColor = vec4(vec3(sdfSample), 1.0); return; } // 灰阶查看

    // === 真体积密度（简化版，先确保基础工作）===
    float w = uSoftEdgeWidth;

    // 基础羽化层（SDF标准做法）
    float density = 1.0 - smoothstep(-w, w, sdf);

    // 只在真正的内部/边缘保留密度
    // SDF<0是内部，SDF>w是远外部（应该为0）
    if (sdf > w) density = 0.0;

    // 使用可调阈值过滤碎片噪点
    if (density > uDensityCutoff) {
      // === 渐变色彩系统：基于UVW.y（垂直方向）===
      vec3 sampleColor;
      if (uvw.y < 0.4) {
        // 底部：纯蓝色
        sampleColor = uColorBottom;
      } else if (uvw.y < 0.7) {
        // 中部过渡：蓝→黄
        float t = (uvw.y - 0.4) / 0.3;
        sampleColor = mix(uColorBottom, uColorMiddle, t);
      } else {
        // 顶部：黄→粉
        float t = (uvw.y - 0.7) / 0.3;
        sampleColor = mix(uColorMiddle, uColorTop, t);
      }

      // === 简化Alpha累积（先确保基础工作）===
      float sampleAlpha = density * stepSize * uDensityMultiplier;

      // === 应用整体亮度 ===
      sampleColor *= uBrightness;

      // 前向混合
      float alphaMultiplier = 1.0 - alpha;
      color += sampleColor * sampleAlpha * alphaMultiplier;
      alpha += sampleAlpha * alphaMultiplier;
    }

    // 提前终止
    if (alpha > 0.95) break;

    // 推进到下一个采样点
    t += stepSize;
    if (t > tExit) break;
  }

  gl_FragColor = vec4(color, alpha);
}