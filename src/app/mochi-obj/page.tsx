'use client';

import React from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import GradientBackgroundV3 from '@/components/mochi/backgrounds/GradientBackgroundV3';
import VolumeShells from '@/components/mochi/core/VolumeShells';
import { mochiShellModelVertexShader } from '@/components/mochi/shaders/shell-model.vert';
import { mochiShellFragmentShader } from '@/components/mochi/shaders/shell.frag';
import MochiComposerFixed from '@/components/mochi/effects/MochiComposerFixed';
import { mochiVertexShader } from '@/components/mochi/shaders/mochi.vert';
import { mochiFixedFragmentShader } from '@/components/mochi/shaders/mochi-fixed.frag';
import { useMemo } from 'react';

function MochiObj({ path = '/models/10k_obj/001_空.obj' }) {
  const obj = useLoader(OBJLoader, path);

  const uniforms = useMemo(
    () => ({
      color1: { value: new THREE.Color('#85b8ff') },
      color2: { value: new THREE.Color('#c4a0ff') },
      color3: { value: new THREE.Color('#ffb380') },
      color4: { value: new THREE.Color('#ffe680') },
      fresnelPower: { value: 2.0 },
      alphaMax: { value: 0.5 },     // 降低最大值，核心更实
      alphaBias: { value: 0.15 }    // 提高偏置，保证主体可读
    }),
    []
  );

  // 统一几何：平滑法线、居中、缩放到半径≈1（烘焙进几何，避免 normalMatrix 错误）
  obj.traverse((child: any) => {
    if (child.isMesh) {
      const geo = child.geometry as THREE.BufferGeometry;
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const bbox = geo.boundingBox!;
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const target = 2.0; // 直径=2 → 半径≈1
      const scale = target / (maxDim || 1);

      // 获取中心并构建变换矩阵（平移 + 缩放）
      const center = new THREE.Vector3();
      bbox.getCenter(center);

      const matrix = new THREE.Matrix4();
      matrix.makeTranslation(-center.x, -center.y, -center.z);
      matrix.scale(new THREE.Vector3(scale, scale, scale));

      // 烘焙进几何，避免运行时 mesh.scale 影响 normalMatrix
      geo.applyMatrix4(matrix);
      geo.computeVertexNormals(); // 重新计算法线
      geo.computeBoundingSphere(); // 计算包围球

      // 重置 mesh 变换，确保 scale = (1,1,1)
      child.scale.set(1, 1, 1);
      child.position.set(0, 0, 0);
      child.rotation.set(0, 0, 0);
      child.updateMatrixWorld(true);

      // 使用带 fake SSS 的 ShaderMaterial
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          ...uniforms,
          lightPosition: { value: new THREE.Vector3(5, 5, 5) },
          sssStrength: { value: 0.6 }, // SSS 强度
          sssColor: { value: new THREE.Color('#ffe0f0') } // SSS 颜色（偏白粉）
        },
        vertexShader: mochiVertexShader,
        fragmentShader: mochiFixedFragmentShader,
        side: THREE.FrontSide,
        transparent: true,
        depthWrite: true  // 内核写深度
      });
      child.material = mat as any;
      child.renderOrder = 0;
    }
  });

  return <primitive object={obj} />;
}

function ModelShellsFromPath({ path = '/models/10k_obj/001_空.obj' }) {
  const obj = useLoader(OBJLoader, path);
  // 统一到与主体相同的居中与缩放（烘焙进几何）
  const meshes: any[] = [];
  let boundingRadius = 1.0; // 默认值

  obj.traverse((child: any) => {
    if (child.isMesh) {
      const geo = child.geometry.clone() as THREE.BufferGeometry; // clone 避免修改原始
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const bbox = geo.boundingBox!;
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const target = 2.0;
      const scale = target / (maxDim || 1);
      const center = new THREE.Vector3();
      bbox.getCenter(center);

      // 烘焙变换进几何
      const matrix = new THREE.Matrix4();
      matrix.makeTranslation(-center.x, -center.y, -center.z);
      matrix.scale(new THREE.Vector3(scale, scale, scale));
      geo.applyMatrix4(matrix);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();

      // 获取包围球半径（世界单位）
      boundingRadius = geo.boundingSphere?.radius || 1.0;

      const mesh = new THREE.Mesh(geo);
      mesh.scale.set(1, 1, 1);
      mesh.position.set(0, 0, 0);
      mesh.rotation.set(0, 0, 0);
      meshes.push(mesh);
    }
  });

  // 用包围球半径计算真实壳厚：0.8% 和 1.2% 半径
  const R = boundingRadius;
  const offsets = [R * 0.008, R * 0.012];
  const colors = ['#b0d0ff', '#ffc8e0'];

  return (
    <>
      {meshes.map((m, mi) =>
        offsets.map((off, i) => {
          const t = i / Math.max(offsets.length - 1, 1);

          // 按用户建议：uAlpha=0.28, uGlow=0.35
          const uAlpha = 0.28;
          const uGlow = 0.35;

          return (
            <mesh
              key={`m${mi}-shell${i}`}
              geometry={m.geometry}
              renderOrder={2 + i}
            >
              <shaderMaterial
                uniforms={{
                  shellColor: { value: new THREE.Color(colors[i]) },
                  uAlpha: { value: uAlpha },
                  uGlow: { value: uGlow },
                  layerT: { value: t },
                  shellOffset: { value: off }
                }}
                vertexShader={mochiShellModelVertexShader}
                fragmentShader={mochiShellFragmentShader}
                transparent
                depthWrite={false}
                depthTest={true}
                side={THREE.BackSide}
                blending={THREE.NormalBlending}
              />
            </mesh>
          );
        })
      )}
    </>
  );
}

function PhysicalEnv() {
  const { gl, scene } = useThree();
  React.useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new RoomEnvironment();
    const envTex = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envTex;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.95; // 略降曝光，增强层次
    return () => {
      pmrem.dispose();
      envScene.dispose?.();
    };
  }, [gl, scene]);
  return null;
}

export default function MochiObjPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      >
        {/* 麻薯背景渐变（参考 shaderpark）*/}
        <GradientBackgroundV3 />

        {/* Physical 环境（支持 transmission）*/}
        <PhysicalEnv />

        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.7} />

        {/* 主体 + 贴合模型的法线膨胀外壳 */}
        <MochiObj path="/models/10k_obj/001_空.obj" />
        <ModelShellsFromPath path="/models/10k_obj/001_空.obj" />

        {/* Bloom 阈值拉高、强度适中，避免多层发光累加烧穿 */}
        <MochiComposerFixed bloomStrength={0.7} bloomRadius={0.75} bloomThreshold={0.62} />

        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: 18,
          fontSize: 14,
          fontWeight: 'bold'
        }}
      >
        🍡 OBJ 测试（可变透明内核 + 体积外壳）
      </div>
    </div>
  );
}


