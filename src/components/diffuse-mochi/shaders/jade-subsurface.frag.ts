/**
 * Jade Subsurface Scattering Fragment Shader
 * 基于subsurface-refraction-shader实现
 * 核心技术：Parallax shift + Mip-level scattering + Triplanar projection
 */

import { noise3DFunctions } from './noise3d.glsl';

export const jadeSubsurfaceFragmentShader = /* glsl */ `
precision highp float;

${noise3DFunctions}

// Varyings
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;

// Uniforms - 基础参数
uniform samplerCube uNormalCubeMap;     // 法线cubemap
uniform sampler2D uColorTexture;        // 内部纹理（可选）
uniform float uTextureScale;            // 纹理缩放
uniform float uColorBoost;              // 颜色增强
uniform vec3 uModelSpaceCameraPos;      // 模型空间的相机位置

// Uniforms - Subsurface参数
uniform float uDepth;                   // 次表面深度
uniform vec3 uMediumColor;              // 厚处介质颜色（深玉色）
uniform vec3 uThinMediumColor;          // 薄处介质颜色（透光玉色）
uniform vec3 uSubsurfaceTint;           // 次表面着色

// Uniforms - Scattering参数
uniform float uMipMultiplier;           // Mip级别乘数（控制散射强度）
uniform float uMinMipLevel;             // 最小mip级别

// Uniforms - 玉石特有参数
uniform float uRoughness;               // 粗糙度
uniform float uTranslucency;            // 透光性
uniform vec3 uJadeColor;                // 玉石基础颜色

// ========================================
// 工具函数
// ========================================

// 三平面投影采样
vec4 triplanarSample(sampler2D tex, vec3 position, vec3 normal, float mipLevel, float scale) {
  vec3 absN = abs(normal);
  vec3 posScaled = position * scale;

  // 三个平面的UV坐标
  vec2 uvX = posScaled.yz;
  vec2 uvY = posScaled.xz;
  vec2 uvZ = posScaled.xy;

  // 混合权重（基于法线）
  float totalWeight = absN.x + absN.y + absN.z;
  vec3 blend = absN / totalWeight;

  // 采样三个平面并混合
  vec4 xColor = texture2D(tex, uvX, mipLevel);
  vec4 yColor = texture2D(tex, uvY, mipLevel);
  vec4 zColor = texture2D(tex, uvZ, mipLevel);

  return xColor * blend.x + yColor * blend.y + zColor * blend.z;
}

// 从cubemap获取法线
vec3 getNormalFromCubeMap(samplerCube cubeMap, vec3 position) {
  vec3 encodedNormal = textureCube(cubeMap, position).xyz;
  // 从[0,1]解码到[-1,1]
  return normalize(encodedNormal * 2.0 - 1.0);
}

// 计算次表面交点位置（Parallax shift）
vec3 calcSubsurfacePosition(vec3 position, vec3 viewVec, vec3 normal, float depth) {
  // 根据深度和视角计算缩放因子
  float scaleFactor = depth / max(dot(viewVec, normal), 0.01);

  // 沿视线方向反向偏移
  vec3 subsurfaceOffset = -viewVec * scaleFactor;

  return position + subsurfaceOffset;
}

// 计算最终颜色混合
vec3 calcFinalColor(
  vec3 surfaceColor,
  vec3 mediumColor,
  vec3 thinMediumColor,
  vec3 subsurfaceTint,
  float viewDotSubsurfaceNormal
) {
  // 厚处：介质色 → 表面色*tint（正视角）
  float thickBlend = pow(max(viewDotSubsurfaceNormal, 0.0), 4.0);
  vec3 thickColor = mix(mediumColor, surfaceColor * subsurfaceTint, min(thickBlend, 1.0));

  // 薄处：透光色（负视角，背光）
  float thinBlend = pow(max(-viewDotSubsurfaceNormal, 0.0), 4.0);

  return mix(thickColor, thinMediumColor, thinBlend);
}

// ========================================
// Main
// ========================================

void main() {
  // 1. 计算view vector（模型空间）
  vec3 V = normalize(uModelSpaceCameraPos - vPosition);
  vec3 N = normalize(vNormal);

  // 2. 计算次表面位置（Parallax shift核心！）
  vec3 subsurfacePosition = calcSubsurfacePosition(vPosition, V, N, uDepth);

  // 3. 获取表面法线（从当前位置的cubemap）
  vec3 surfaceNormal = getNormalFromCubeMap(uNormalCubeMap, vPosition);

  // 4. 获取次表面法线（从偏移后位置的cubemap）
  vec3 subsurfaceNormal = getNormalFromCubeMap(uNormalCubeMap, subsurfacePosition);

  // 5. 计算Mip级别（控制散射程度）
  // 视角越偏，光线穿透越深，使用更模糊的mip（更高的散射）
  float viewDotSubsurface = dot(subsurfaceNormal, V);
  float mipLevel = (1.0 - viewDotSubsurface) * uMipMultiplier + uMinMipLevel;

  // 6. 三平面投影采样内部纹理（使用计算的mip level）
  vec3 surfaceColor;

  // 使用噪声或纹理作为内部结构
  #ifdef USE_COLOR_TEXTURE
    vec4 texColor = triplanarSample(
      uColorTexture,
      subsurfacePosition,
      surfaceNormal,
      mipLevel,
      uTextureScale
    );
    surfaceColor = texColor.rgb * uColorBoost;
  #else
    // 使用3D噪声模拟玉石内部纹理
    vec3 noiseCoord = subsurfacePosition * uTextureScale;
    float noise1 = perlinNoise3D(noiseCoord * 2.0);
    float noise2 = perlinNoise3D(noiseCoord * 5.0);
    float noise = noise1 * 0.7 + noise2 * 0.3;

    // 玉石基础颜色 + 噪声变化
    surfaceColor = uJadeColor * (0.8 + noise * 0.4) * uColorBoost;
  #endif

  // 7. 计算最终颜色（厚处/薄处混合）
  vec3 finalColor = calcFinalColor(
    surfaceColor,
    uMediumColor,
    uThinMediumColor,
    uSubsurfaceTint,
    viewDotSubsurface
  );

  // 8. 添加玉石特有效果

  // 8a. Fresnel边缘光泽
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 fresnelColor = uThinMediumColor * fresnel * (1.0 - uRoughness);
  finalColor += fresnelColor * 0.3;

  // 8b. 透光性（薄处更透）
  float translucency = pow(max(-viewDotSubsurface, 0.0), 2.0) * uTranslucency;
  finalColor = mix(finalColor, uThinMediumColor, translucency * 0.5);

  // 8c. 粗糙度影响（粗糙度高→降低光泽）
  finalColor = mix(finalColor, finalColor * 0.8, uRoughness * 0.5);

  // 9. 输出
  gl_FragColor = vec4(finalColor, 1.0);
}
`;
