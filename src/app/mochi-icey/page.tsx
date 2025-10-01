'use client';

import React from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import GradientBackgroundV3 from '@/components/mochi/backgrounds/GradientBackgroundV3';
import { MochiIcey } from '@/components/mochi';
import MochiComposerFixed from '@/components/mochi/effects/MochiComposerFixed';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

function PhysicalMochi({ path = '/models/10k_obj/001_空.obj' }) {
  const obj = useLoader(OBJLoader, path);
  obj.traverse((child: any) => {
    if (child.isMesh) {
      const geo = child.geometry as THREE.BufferGeometry;
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
      const m = new THREE.Matrix4();
      m.makeTranslation(-center.x, -center.y, -center.z);
      m.scale(new THREE.Vector3(scale, scale, scale));
      geo.applyMatrix4(m);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();

      const mat = new THREE.MeshPhysicalMaterial({
        color: '#fff0e0',
        metalness: 0,
        roughness: 0.6,
        transmission: 0.75,
        thickness: 0.8,
        ior: 1.35,
        clearcoat: 0.2,
        clearcoatRoughness: 0.25,
        attenuationColor: new THREE.Color('#ffe7cc'),
        attenuationDistance: 2.5
      });
      child.material = mat;
      child.castShadow = false;
      child.receiveShadow = false;
      child.position.set(0, 0, 0);
      child.rotation.set(0, 0, 0);
      child.scale.set(1, 1, 1);
    }
  });
  return <primitive object={obj} />;
}

export default function MochiIceyPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas camera={{ position: [0, 0, 3], fov: 50 }} gl={{ antialias: true, alpha: true }}>
        <GradientBackgroundV3 />

        {/* 柔和光照：一主一辅，适合背光透亮 */}
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 5, 5]} intensity={0.7} />

        {/* 左：MochiIcey（厚度透光近似） + 深度预通道 */}
        <group position={[-1.1, 0, 0]}>
          {/* 预通道：只写深度，不输出颜色 */}
          <mesh renderOrder={0}>
            <primitive object={useLoader(OBJLoader, '/models/10k_obj/001_空.obj')} />
          </mesh>
          {/* 主渲染 */}
          <MochiIcey key="ice-left" modelPath={'/models/10k_obj/001_空.obj'} />
        </group>

        {/* 右：MeshPhysicalMaterial（transmission 对照） */}
        <group position={[1.1, 0, 0]}>
          <PhysicalMochi path={'/models/10k_obj/001_空.obj'} />
        </group>

        {/* 温和 Bloom，避免“冰/玻璃”的强高光 */}
        {/* Bloom 稍降，避免洗白细节 */}
        <MochiComposerFixed bloomStrength={0.7} bloomRadius={0.75} bloomThreshold={0.62} />

        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>

      <div
        style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '10px 18px', borderRadius: 18,
          fontSize: 14, fontWeight: 'bold'
        }}
      >
        🍡 mochi-icey 对比：左=厚度透光近似（Ice风格），右=Physical transmission
      </div>

      <div style={{ position: 'absolute', bottom: 20, left: '25%', transform: 'translateX(-50%)', color: '#888', fontSize: 12 }}>Ice 近似</div>
      <div style={{ position: 'absolute', bottom: 20, left: '75%', transform: 'translateX(-50%)', color: '#888', fontSize: 12 }}>Physical 透射</div>
    </div>
  );
}


