'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

function SimpleTest() {
  const { scene, gl } = useThree();
  const [status, setStatus] = useState('开始测试...');
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    console.log('[SimpleTest] 开始加载 HDR...');
    setStatus('正在加载 HDR...');
    
    const rgbe = new RGBELoader();
    rgbe.load(
      '/textures/qwantani_moon_noon_puresky_1k.hdr',
      (texture) => {
        console.log('[SimpleTest] HDR 加载成功!', texture);
        
        // 设置环境贴图
        scene.environment = texture;
        setStatus('HDR 加载成功!');
        
        console.log('[SimpleTest] 场景环境贴图设置完成:', !!scene.environment);
      },
      undefined,
      (error) => {
        console.error('[SimpleTest] HDR 加载失败:', error);
        setStatus('HDR 加载失败');
      }
    );
  }, [scene]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <>
      {/* 基础球体 - 不透明，确保可见 */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.0}
          roughness={0.1}
          envMapIntensity={2.0}
        />
      </mesh>
      
      {/* 透明球体 - 测试折射 */}
      <mesh ref={meshRef} position={[2, 0, 0]}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={0.0}
          roughness={0.1}
          transmission={0.5}
          ior={1.5}
          thickness={0.5}
          envMapIntensity={2.0}
          transparent={false}
          opacity={1.0}
        />
      </mesh>
    </>
  );
}

export default function SimpleTestPage() {
  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: '#1f1e1c',
      color: 'white',
      fontFamily: 'monospace'
    }}>
      {/* 状态显示 */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(0,0,0,0.8)',
        padding: '15px',
        borderRadius: '8px',
        zIndex: 10,
        maxWidth: '300px'
      }}>
        <h3>简单测试</h3>
        <div>状态: {status}</div>
        <div style={{ marginTop: '10px', fontSize: '12px' }}>
          <div>• 左侧：标准材质球体</div>
          <div>• 右侧：物理材质球体（折射）</div>
          <div>• 两个球体都应该有环境反射</div>
        </div>
      </div>

      <Canvas 
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ 
          alpha: true,  // 先试试 alpha: true
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace
        }}
      >
        <SimpleTest />
      </Canvas>
    </div>
  );
}
