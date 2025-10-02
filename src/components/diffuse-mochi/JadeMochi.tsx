'use client';

import * as THREE from 'three';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { jadeSubsurfaceVertexShader } from './shaders/jade-subsurface.vert';
import { jadeSubsurfaceFragmentShader } from './shaders/jade-subsurface.frag';
import { createNormalCubemap } from './utils/createNormalCubemap';

/**
 * JadeMochi组件参数
 */
export interface JadeMochiProps {
  modelPath: string;

  // Subsurface参数
  depth?: number;                     // 次表面深度 (0.05-0.15)
  mediumColor?: string;               // 厚处介质颜色
  thinMediumColor?: string;           // 薄处透光颜色
  subsurfaceTint?: string;            // 次表面着色

  // Scattering参数
  mipMultiplier?: number;             // Mip级别乘数 (0-20)
  minMipLevel?: number;               // 最小mip级别 (0-10)

  // 玉石参数
  jadeColor?: string;                 // 玉石基础颜色
  roughness?: number;                 // 粗糙度 (0-1)
  translucency?: number;              // 透光性 (0-1)

  // 纹理参数
  textureScale?: number;              // 噪声/纹理缩放
  colorBoost?: number;                // 颜色增强

  // 其他
  autoRotate?: boolean;
}

/**
 * 玉石质感麻薯组件
 * 使用完整的subsurface scattering实现
 */
export default function JadeMochi({
  modelPath,
  // Subsurface默认值
  depth = 0.08,
  mediumColor = '#1a3a2e',            // 深绿（厚玉）
  thinMediumColor = '#7ed957',        // 透亮绿（薄玉透光）
  subsurfaceTint = '#4a7c59',         // 玉色调
  // Scattering默认值
  mipMultiplier = 8,
  minMipLevel = 1,
  // 玉石默认值
  jadeColor = '#6fa86f',              // 玉绿
  roughness = 0.3,
  translucency = 0.6,
  // 纹理默认值
  textureScale = 2.0,
  colorBoost = 1.5,
  // 其他
  autoRotate = true,
}: JadeMochiProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { gl } = useThree();

  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [normalCubemap, setNormalCubemap] = useState<THREE.CubeTexture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载OBJ模型
  useEffect(() => {
    const loader = new OBJLoader();

    loader.load(
      modelPath,
      (obj) => {
        console.log('[JadeMochi] OBJ loaded:', obj);

        let foundGeometry: THREE.BufferGeometry | null = null;
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh && !foundGeometry) {
            foundGeometry = child.geometry;
          }
        });

        if (foundGeometry) {
          // 计算法线
          if (!foundGeometry.attributes.normal) {
            foundGeometry.computeVertexNormals();
          }

          // 计算切线（需要UV，OBJ可能没有，跳过）
          // 注意：computeTangents需要index, position, normal和uv属性
          // 我们的shader不依赖切线，可以跳过
          console.log('[JadeMochi] Geometry attributes:', Object.keys(foundGeometry.attributes));

          // 居中和缩放
          foundGeometry.center();
          foundGeometry.computeBoundingBox();
          const bbox = foundGeometry.boundingBox!;
          const size = bbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.0 / maxDim;
          foundGeometry.scale(scale, scale, scale);

          setGeometry(foundGeometry);
        } else {
          setError('No mesh found in OBJ file');
          setLoading(false);
        }
      },
      (progress) => {
        console.log('[JadeMochi] Loading:', (progress.loaded / progress.total) * 100 + '%');
      },
      (err) => {
        console.error('[JadeMochi] Error loading OBJ:', err);
        setError('Failed to load OBJ file');
        setLoading(false);
      }
    );
  }, [modelPath]);

  // 生成法线cubemap
  useEffect(() => {
    if (!geometry || !gl) return;

    console.log('[JadeMochi] Generating normal cubemap...');

    createNormalCubemap(gl, geometry, 256)
      .then((cubemap) => {
        console.log('[JadeMochi] Cubemap generated:', cubemap);
        setNormalCubemap(cubemap);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[JadeMochi] Error generating cubemap:', err);
        setError('Failed to generate cubemap');
        setLoading(false);
      });
  }, [geometry, gl]);

  // 创建shader material
  const material = useMemo(() => {
    if (!normalCubemap) return null;

    return new THREE.ShaderMaterial({
      uniforms: {
        // Cubemap
        uNormalCubeMap: { value: normalCubemap },

        // 相机位置（模型空间，每帧更新）
        uModelSpaceCameraPos: { value: new THREE.Vector3() },

        // Subsurface
        uDepth: { value: depth },
        uMediumColor: { value: new THREE.Color(mediumColor) },
        uThinMediumColor: { value: new THREE.Color(thinMediumColor) },
        uSubsurfaceTint: { value: new THREE.Color(subsurfaceTint) },

        // Scattering
        uMipMultiplier: { value: mipMultiplier },
        uMinMipLevel: { value: minMipLevel },

        // 玉石
        uJadeColor: { value: new THREE.Color(jadeColor) },
        uRoughness: { value: roughness },
        uTranslucency: { value: translucency },

        // 纹理
        uTextureScale: { value: textureScale },
        uColorBoost: { value: colorBoost },
      },
      vertexShader: jadeSubsurfaceVertexShader,
      fragmentShader: jadeSubsurfaceFragmentShader,
      side: THREE.DoubleSide,
    });
  }, [
    normalCubemap,
    depth,
    mediumColor,
    thinMediumColor,
    subsurfaceTint,
    mipMultiplier,
    minMipLevel,
    jadeColor,
    roughness,
    translucency,
    textureScale,
    colorBoost,
  ]);

  // 自动旋转 + 更新相机位置
  useFrame((state, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }

    // 更新模型空间的相机位置
    if (material && groupRef.current) {
      const inverseMatrix = new THREE.Matrix4();
      inverseMatrix.copy(groupRef.current.matrixWorld).invert();

      const modelSpaceCameraPos = new THREE.Vector3();
      modelSpaceCameraPos.copy(state.camera.position);
      modelSpaceCameraPos.applyMatrix4(inverseMatrix);

      material.uniforms.uModelSpaceCameraPos.value.copy(modelSpaceCameraPos);
    }
  });

  // 加载中
  if (loading) {
    return (
      <group>
        <mesh>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshBasicMaterial color="#666666" wireframe />
        </mesh>
      </group>
    );
  }

  // 错误
  if (error || !geometry || !material) {
    console.error('[JadeMochi] Render error:', error);
    return (
      <group>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#ff0000" wireframe />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <mesh geometry={geometry} material={material} />
      <gridHelper args={[10, 10]} position={[0, -1.5, 0]} />
    </group>
  );
}
