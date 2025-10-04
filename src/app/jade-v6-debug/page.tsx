'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// 简单的 HDR 测试组件
function HDRTest() {
  const { scene, gl } = useThree();
  const [status, setStatus] = useState('加载中...');
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    console.log('[HDRTest] 开始加载 HDR...');
    
    const rgbe = new RGBELoader();
    rgbe.load(
      '/textures/qwantani_moon_noon_puresky_1k.hdr',
      (texture) => {
        console.log('[HDRTest] HDR 加载成功:', texture);
        
        // 设置环境贴图
        scene.environment = texture;
        
        // 设置背景为纯色
        scene.background = new THREE.Color('#1f1e1c');
        
        setStatus('HDR 加载成功');
        console.log('[HDRTest] 场景设置完成:', {
          hasEnvironment: !!scene.environment,
          hasBackground: !!scene.background
        });
      },
      undefined,
      (err) => {
        console.error('[HDRTest] HDR 加载失败:', err);
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
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={0.0}
          roughness={0.1}
          transmission={1.0}
          ior={1.5}
          thickness={1.0}
          envMapIntensity={2.0}
        />
      </mesh>
      
      {/* 调试信息显示 */}
      <mesh position={[0, -2, 0]}>
        <planeGeometry args={[4, 0.5]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.7} />
      </mesh>
    </>
  );
}

export default function DebugPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1f1e1c' }}>
      {/* 状态显示 */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        color: 'white',
        background: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '5px',
        zIndex: 10
      }}>
        <div>HDR 测试页面</div>
        <div>状态: 加载中...</div>
      </div>

      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <HDRTest />
      </Canvas>
    </div>
  );
}

