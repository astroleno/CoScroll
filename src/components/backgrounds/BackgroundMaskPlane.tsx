/**
 * BackgroundMaskPlane - 全屏背景遮罩平面
 * 
 * 原理：
 * 1. 使用 EqualDepth 深度测试，只在深度值=1.0（背景）的像素处绘制
 * 2. 固定 z=1.0（NDC 空间），确保深度值恰好等于背景默认深度
 * 3. depthWrite=false，不改写深度缓冲，避免影响其他物体
 * 4. renderOrder=999，确保最后绘制（在主体之后）
 * 
 * 用途：
 * - 在保持 HDRI 作为 scene.background（供 transmission 采样）的同时
 * - 视觉上用自定义背景（纯色/渐变/纹理）替换 HDRI
 * - 不影响主体的颜色/曝光/高光
 * 
 * @author AI Assistant
 * @date 2025-10-02
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 全屏四边形顶点着色器
 * - 直接输出 NDC 坐标，无需 MVP 变换
 * - z=1.0 确保深度值为 1（背景深度）
 */
const MASK_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    // 直接使用 position 作为 NDC 坐标（-1 到 1）
    // z=1.0 确保深度测试时只匹配背景像素
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

/**
 * 背景遮罩片段着色器
 * - 支持纯色、渐变、纹理等多种模式
 */
const MASK_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;           // 纯色模式
  uniform bool uUseGradient;     // 是否使用渐变
  uniform vec3 uGradientTop;     // 渐变顶部颜色
  uniform vec3 uGradientBottom;  // 渐变底部颜色
  uniform sampler2D uTexture;    // 纹理模式
  uniform bool uUseTexture;      // 是否使用纹理

  varying vec2 vUv;

  void main() {
    vec3 finalColor = uColor;

    // 渐变模式
    if (uUseGradient) {
      finalColor = mix(uGradientBottom, uGradientTop, vUv.y);
    }

    // 纹理模式（优先级最高）
    if (uUseTexture) {
      vec4 texColor = texture2D(uTexture, vUv);
      finalColor = texColor.rgb;
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export interface BackgroundMaskPlaneProps {
  /** 纯色模式：背景颜色 */
  color?: THREE.ColorRepresentation;
  /** 渐变模式：是否启用 */
  useGradient?: boolean;
  /** 渐变模式：顶部颜色 */
  gradientTop?: THREE.ColorRepresentation;
  /** 渐变模式：底部颜色 */
  gradientBottom?: THREE.ColorRepresentation;
  /** 纹理模式：是否启用 */
  useTexture?: boolean;
  /** 纹理模式：纹理对象 */
  texture?: THREE.Texture | null;
  /** 是否可见 */
  visible?: boolean;
}

/**
 * BackgroundMaskPlane 组件
 * 
 * 使用示例：
 * ```tsx
 * // 纯色背景
 * <BackgroundMaskPlane color="#f5f5dc" />
 * 
 * // 渐变背景
 * <BackgroundMaskPlane 
 *   useGradient 
 *   gradientTop="#87CEEB" 
 *   gradientBottom="#F0E68C" 
 * />
 * 
 * // 纹理背景
 * <BackgroundMaskPlane useTexture texture={myTexture} />
 * ```
 */
export function BackgroundMaskPlane({
  color = '#f5f5dc',           // 默认米色（宣纸风格）
  useGradient = false,
  gradientTop = '#87CEEB',     // 默认天蓝色
  gradientBottom = '#F0E68C',  // 默认金黄色
  useTexture = false,
  texture = null,
  visible = true,
}: BackgroundMaskPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // 创建全屏四边形几何体（NDC 空间，-1 到 1）
  const geometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(2, 2);
    return geom;
  }, []);

  // 创建自定义 ShaderMaterial
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: MASK_VERTEX,
      fragmentShader: MASK_FRAGMENT,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uUseGradient: { value: useGradient },
        uGradientTop: { value: new THREE.Color(gradientTop) },
        uGradientBottom: { value: new THREE.Color(gradientBottom) },
        uUseTexture: { value: useTexture },
        uTexture: { value: texture },
      },
      // 关键：LessEqualDepth 深度测试（默认行为）
      // 由于我们的 z=1.0（最远），会在所有"没有被主体遮挡"的像素绘制（即背景区域）
      depthTest: true,
      depthWrite: false,
      depthFunc: THREE.LessEqualDepth,
      // 色彩管理：与主场景保持一致
      toneMapped: true,
    });

    return mat;
  }, []);

  // 同步 props 到 uniforms
  useFrame(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.ShaderMaterial;
    
    try {
      mat.uniforms.uColor.value.set(color);
      mat.uniforms.uUseGradient.value = useGradient;
      mat.uniforms.uGradientTop.value.set(gradientTop);
      mat.uniforms.uGradientBottom.value.set(gradientBottom);
      mat.uniforms.uUseTexture.value = useTexture;
      mat.uniforms.uTexture.value = texture;
    } catch (e) {
      console.warn('[BackgroundMaskPlane] 更新 uniforms 失败:', e);
    }
  });

  if (!visible) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      renderOrder={999} // 确保最后绘制
      frustumCulled={false} // 禁用视锥剔除，因为使用 NDC 坐标
    />
  );
}

/**
 * 使用说明：
 * 
 * 1. 基础用法（纯色背景）：
 *    <BackgroundMaskPlane color="#f5f5dc" />
 * 
 * 2. 渐变背景：
 *    <BackgroundMaskPlane 
 *      useGradient 
 *      gradientTop="#87CEEB" 
 *      gradientBottom="#F0E68C" 
 *    />
 * 
 * 3. 纹理背景：
 *    const texture = useLoader(THREE.TextureLoader, '/path/to/texture.jpg');
 *    <BackgroundMaskPlane useTexture texture={texture} />
 * 
 * 4. 配合 JadeV2 使用：
 *    - 确保 JadeV2 的 showBackground={true}（让 HDRI 成为 scene.background）
 *    - BackgroundMaskPlane 会自动替换视觉背景，但不影响 transmission
 * 
 * 5. 透明边缘优化（如需要）：
 *    - 当前使用 EqualDepth，可能在半透明边缘有细微白边
 *    - 如需优化，可在 shader 中采样 depthTexture，做阈值+扩张处理
 *    - 对于大多数场景，当前方案已足够
 */

