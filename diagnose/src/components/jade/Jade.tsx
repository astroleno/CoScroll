'use client';

import * as THREE from 'three';
import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TessellateModifier } from 'three-stdlib';
import { toCreasedNormals } from 'three-stdlib';

/**
 * 【方案A+B】几何体优化流程
 *
 * 优化流程：
 * 1. mergeVertices() - 焊接重复顶点
 * 2. TessellateModifier - 均匀化三角形（方案A）
 * 3. loopSubdivide() - 细分增加面数（方案A）
 * 4. toCreasedNormals() - 角度焊接法线（方案B）
 */
function optimizeGeometry(
  geometry: THREE.BufferGeometry,
  options: {
    maxEdge?: number;       // 方案A：均匀化边长
    subdivisions?: number;  // 方案A：细分次数
    creaseAngle?: number;   // 方案B：折痕角度
  } = {}
): THREE.BufferGeometry {
  const {
    maxEdge = 0.06,         // 默认0.06（方案A建议）
    subdivisions = 1,       // 默认1次细分（移动端优化）
    creaseAngle = 50,       // 默认50度（方案B建议）
  } = options;

  let geo = geometry;

  // Step 1: 焊接重复顶点
  geo = mergeVertices(geo);
  console.log('[Jade] Step 1: Merged vertices');

  // Step 2: 转换为非索引几何体（细分需要）
  geo = geo.toNonIndexed();

  // Step 3: 均匀化三角形（方案A：TessellateModifier）
  if (maxEdge > 0 && maxEdge <= 0.15) {
    const tess = new TessellateModifier(maxEdge);
    geo = tess.modify(geo);
    console.log('[Jade] Step 2: Tessellated geometry, maxEdge:', maxEdge);
  }

  // Step 4: 细分（方案A：Loop细分）
  if (subdivisions > 0) {
    const iterations = Math.min(subdivisions, 1); // 移动端限制
    console.log(`[Jade] Step 3: Applying Loop subdivision, iterations:`, iterations);
    const startTime = performance.now();
    geo = loopSubdivide(geo, iterations);
    const endTime = performance.now();
    console.log(`[Jade] Subdivision completed in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`[Jade] Triangle count: ${geo.attributes.position.count / 3}`);
  }

  // Step 5: 平滑法线
  geo.computeVertexNormals();

  // Step 6: 角度焊接法线（方案B：toCreasedNormals）
  if (creaseAngle < 90) {
    const creaseRad = THREE.MathUtils.degToRad(creaseAngle);
    geo = toCreasedNormals(geo, creaseRad);
    console.log('[Jade] Step 4: Applied creased normals, angle:', creaseAngle);
  } else {
    console.log('[Jade] Step 4: Skipped creased normals (angle=90), using smooth normals');
  }

  return geo;
}

/**
 * 简化版Loop细分算法
 * 每个三角形分割为4个
 */
function loopSubdivide(geometry: THREE.BufferGeometry, iterations: number): THREE.BufferGeometry {
  if (iterations <= 0) return geometry;

  let geo = geometry;

  for (let i = 0; i < iterations; i++) {
    const positions = geo.attributes.position.array;
    const triangleCount = positions.length / 9;
    const newPositions: number[] = [];

    for (let t = 0; t < triangleCount; t++) {
      const offset = t * 9;

      const v0 = new THREE.Vector3(positions[offset], positions[offset + 1], positions[offset + 2]);
      const v1 = new THREE.Vector3(positions[offset + 3], positions[offset + 4], positions[offset + 5]);
      const v2 = new THREE.Vector3(positions[offset + 6], positions[offset + 7], positions[offset + 8]);

      const m01 = new THREE.Vector3().lerpVectors(v0, v1, 0.5);
      const m12 = new THREE.Vector3().lerpVectors(v1, v2, 0.5);
      const m20 = new THREE.Vector3().lerpVectors(v2, v0, 0.5);

      // 4个新三角形
      newPositions.push(m01.x, m01.y, m01.z, m12.x, m12.y, m12.z, m20.x, m20.y, m20.z);
      newPositions.push(v0.x, v0.y, v0.z, m01.x, m01.y, m01.z, m20.x, m20.y, m20.z);
      newPositions.push(v1.x, v1.y, v1.z, m12.x, m12.y, m12.z, m01.x, m01.y, m01.z);
      newPositions.push(v2.x, v2.y, v2.z, m20.x, m20.y, m20.z, m12.x, m12.y, m12.z);
    }

    const newGeo = new THREE.BufferGeometry();
    newGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    geo = newGeo;
  }

  return geo;
}

/**
 * Jade组件参数
 * 基于Three.js MeshPhysicalMaterial实现玉石质感
 */
export interface JadeProps {
  modelPath: string;

  // 材质参数
  color?: string;                    // 玉石颜色
  transmission?: number;             // 透射（0-1，光穿透程度）
  thickness?: number;                // 厚度（0-5，影响透射效果）
  ior?: number;                      // 折射率（1-2.33，玉石约1.5-1.7）
  roughness?: number;                // 粗糙度（0-1）
  metalness?: number;                // 金属度（0-1，玉石通常为0）
  reflectivity?: number;             // 反射率（0-1）
  attenuationColor?: string;         // 衰减颜色（光在玉内的颜色）
  attenuationDistance?: number;      // 衰减距离（0.1-2，光穿透距离）

  // Clearcoat（清漆层，模拟玉石表面光泽）
  clearcoat?: number;                // 清漆强度（0-1）
  clearcoatRoughness?: number;       // 清漆粗糙度（0-1）

  // 法线贴图
  normalScale?: number;              // 法线强度（0-5）
  clearcoatNormalScale?: number;     // 清漆法线强度（0-5）
  normalRepeat?: number;             // 法线重复次数（1-4）

  // 环境贴图
  envMapIntensity?: number;          // 环境贴图强度（0-3）

  // 几何体优化（移动端优化方案）
  maxEdge?: number;                  // 均匀化：最大边长（0.01-0.15）
  subdivisions?: number;             // 细分次数（0-1）
  creaseAngle?: number;              // 折痕角度（30-90度，保留尖角）

  // 其他
  autoRotate?: boolean;
}

/**
 * Jade组件
 * 使用MeshPhysicalMaterial实现玉石质感
 */
export default function Jade({
  modelPath,
  // 材质默认值（玉绿主色系，明度对比30%）
  color = '#65B39A',             // 玉绿主色（调暗以达到30%对比度）
  transmission = 1,
  thickness = 5,
  ior = 1.5,
  roughness = 0.76,              // 用户指定：表面光滑度
  metalness = 0,
  reflectivity = 0.42,           // 降低反射率才能看到穿透效果
  attenuationColor = '#ffffff',  // 内透色：白色
  attenuationDistance = 0.8,     // 光穿透距离
  // Clearcoat默认值（用户指定）
  clearcoat = 0.70,              // 用户指定
  clearcoatRoughness = 0.78,     // 用户指定
  // 法线默认值
  normalScale = 0.86,
  clearcoatNormalScale = 1.34,
  normalRepeat = 3,
  // 环境贴图默认值
  envMapIntensity = 1.8,
  // 几何体优化（用户指定值优先）
  maxEdge = 0.15,                // 用户指定：0.150（方案A建议0.04-0.08）
  subdivisions = 0,              // 用户指定：0（0=关闭，1=开启）
  creaseAngle = 30,              // 用户指定：30度（保留尖角）
  // 其他
  autoRotate = true,
}: JadeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { gl, viewport } = useThree();

  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [envMap, setEnvMap] = useState<THREE.Texture | null>(null);
  const [normalMap, setNormalMap] = useState<THREE.Texture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载OBJ模型
  useEffect(() => {
    const loader = new OBJLoader();

    loader.load(
      modelPath,
      (obj) => {
        console.log('[Jade] OBJ loaded:', obj);

        let foundGeometry: THREE.BufferGeometry | null = null;
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh && !foundGeometry) {
            foundGeometry = child.geometry;
          }
        });

        if (foundGeometry) {
          // 【优化方案A+B】均匀化 + 细分 + 角度焊接
          console.log(`[Jade] Starting geometry optimization...`);
          const startTime = performance.now();

          // 转换为非索引几何体
          let optimizedGeometry = foundGeometry.toNonIndexed();

          // 应用优化流程
          optimizedGeometry = optimizeGeometry(optimizedGeometry, {
            maxEdge,
            subdivisions,
            creaseAngle,
          });

          const endTime = performance.now();
          console.log(`[Jade] Optimization completed in ${(endTime - startTime).toFixed(2)}ms`);
          console.log(`[Jade] Final triangle count: ${optimizedGeometry.attributes.position.count / 3}`);

          // 居中和缩放
          optimizedGeometry.center();
          optimizedGeometry.computeBoundingBox();
          const bbox = optimizedGeometry.boundingBox!;
          const size = bbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.0 / maxDim;
          optimizedGeometry.scale(scale, scale, scale);

          setGeometry(optimizedGeometry);
        } else {
          setError('No mesh found in OBJ file');
          setLoading(false);
        }
      },
      (progress) => {
        console.log('[Jade] Loading OBJ:', (progress.loaded / progress.total) * 100 + '%');
      },
      (err) => {
        console.error('[Jade] Error loading OBJ:', err);
        setError('Failed to load OBJ file');
        setLoading(false);
      }
    );
  }, [modelPath, maxEdge, subdivisions, creaseAngle]);

  // 加载HDR环境贴图
  useEffect(() => {
    const rgbeLoader = new RGBELoader();

    rgbeLoader.load(
      '/textures/qwantani_moon_noon_puresky_1k.hdr',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        console.log('[Jade] HDR envMap loaded');
        setEnvMap(texture);
      },
      (progress) => {
        console.log('[Jade] Loading HDR:', (progress.loaded / progress.total) * 100 + '%');
      },
      (err) => {
        console.error('[Jade] Error loading HDR:', err);
        setError('Failed to load HDR environment map');
        setLoading(false);
      }
    );
  }, []);

  // 加载法线贴图
  useEffect(() => {
    const textureLoader = new THREE.TextureLoader();

    textureLoader.load(
      '/textures/normal.jpg',
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(normalRepeat, normalRepeat);
        console.log('[Jade] Normal map loaded');
        setNormalMap(texture);
        setLoading(false);
      },
      (progress) => {
        console.log('[Jade] Loading normal map:', (progress.loaded / progress.total) * 100 + '%');
      },
      (err) => {
        console.error('[Jade] Error loading normal map:', err);
        // 法线贴图是可选的，不阻止渲染
        setLoading(false);
      }
    );
  }, [normalRepeat]);

  // 创建MeshPhysicalMaterial（方案C：玉质感材质优化）
  const material = useMemo(() => {
    if (!envMap) return null;

    const mat = new THREE.MeshPhysicalMaterial({
      // 基础参数
      color: new THREE.Color(color),
      metalness,
      roughness,

      // 透射参数（玉石半透效果）
      transmission,
      ior,
      reflectivity,
      thickness,

      // 【C方案】衰减参数（光在玉内的颜色和穿透距离）
      attenuationColor: new THREE.Color(attenuationColor),
      attenuationDistance,

      // 环境贴图
      envMap,
      envMapIntensity,

      // 清漆层（表面光泽）
      clearcoat,
      clearcoatRoughness,

      // 法线贴图
      normalScale: normalMap ? new THREE.Vector2(normalScale, normalScale) : undefined,
      normalMap: normalMap || undefined,
      clearcoatNormalMap: normalMap || undefined,
      clearcoatNormalScale: normalMap ? new THREE.Vector2(clearcoatNormalScale, clearcoatNormalScale) : undefined,

    });

    return mat;
  }, [
    envMap,
    normalMap,
    color,
    metalness,
    roughness,
    transmission,
    ior,
    reflectivity,
    thickness,
    attenuationColor,
    attenuationDistance,
    envMapIntensity,
    clearcoat,
    clearcoatRoughness,
    normalScale,
    clearcoatNormalScale,
  ]);

  // 更新法线贴图重复
  useEffect(() => {
    if (normalMap) {
      normalMap.repeat.set(normalRepeat, normalRepeat);
      normalMap.needsUpdate = true;
    }
  }, [normalMap, normalRepeat]);

  // 响应式尺寸：画面短边的 38-55%（移动端取上限）
  useEffect(() => {
    if (groupRef.current && geometry) {
      const isMobile = viewport.width < 768;
      const targetRatio = isMobile ? 0.55 : 0.45; // 移动端55%，桌面45%
      const shortEdge = Math.min(viewport.width, viewport.height);
      const targetSize = shortEdge * targetRatio;

      // 计算当前几何体的实际尺寸
      geometry.computeBoundingBox();
      const bbox = geometry.boundingBox!;
      const size = bbox.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // 计算缩放系数
      const scale = targetSize / maxDim;
      groupRef.current.scale.setScalar(scale);

      console.log(`[Jade] Responsive scale: ${scale.toFixed(3)} (viewport: ${viewport.width.toFixed(0)}x${viewport.height.toFixed(0)}, target: ${targetRatio * 100}%)`);
    }
  }, [viewport.width, viewport.height, geometry]);

  // 自动旋转
  useFrame((state, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
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
    console.error('[Jade] Render error:', error);
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
    </group>
  );
}
