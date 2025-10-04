'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

function HDRTestComponent() {
  const { scene, gl } = useThree();
  const [status, setStatus] = useState('开始加载...');
  const [hdrLoaded, setHdrLoaded] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    console.log('[HDRTest] 开始加载 HDR 文件...');
    setStatus('正在加载 HDR...');
    
    const rgbe = new RGBELoader();
    
    // 测试不同的 HDR 文件路径
    const hdrPath = '/textures/qwantani_moon_noon_puresky_1k.hdr';
    console.log('[HDRTest] 尝试加载路径:', hdrPath);
    
    rgbe.load(
      hdrPath,
      (texture) => {
        console.log('[HDRTest] ✅ HDR 加载成功!', texture);
        console.log('[HDRTest] 纹理信息:', {
          width: texture.image?.width,
          height: texture.image?.height,
          format: texture.format,
          type: texture.type
        });
        
        // 设置环境贴图
        scene.environment = texture;
        setHdrLoaded(true);
        setStatus('HDR 加载成功!');
        
        console.log('[HDRTest] 场景环境贴图设置完成:', {
          hasEnvironment: !!scene.environment,
          environmentType: scene.environment?.constructor.name,
          textureMapping: scene.environment?.mapping
        });
      },
      (progress) => {
        console.log('[HDRTest] 加载进度:', progress);
        setStatus(`加载中... ${Math.round(progress.loaded / progress.total * 100)}%`);
      },
      (error) => {
        console.error('[HDRTest] ❌ HDR 加载失败:', error);
        setStatus(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
          roughness={0.1}  // 稍微增加粗糙度确保可见
          transmission={0.8}  // 降低透射度，保持可见性
          ior={1.5}
          thickness={0.5}  // 增加厚度
          envMapIntensity={2.0}  // 增加环境贴图强度
          transparent={false}
          opacity={1.0}
        />
      </mesh>
      
      {/* 状态显示平面 */}
      <mesh position={[0, -2, 0]}>
        <planeGeometry args={[4, 0.5]} />
        <meshBasicMaterial 
          color={hdrLoaded ? "#00ff00" : "#ff0000"} 
          transparent 
          opacity={0.7} 
        />
      </mesh>
    </>
  );
}

export default function HDRTestPage() {
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
        <h3>HDR 加载测试</h3>
        <div>状态: {status}</div>
        <div>文件路径: /textures/qwantani_moon_noon_puresky_1k.hdr</div>
        <div style={{ marginTop: '10px', fontSize: '12px' }}>
          <div>• 绿色平面 = HDR 加载成功</div>
          <div>• 红色平面 = HDR 加载失败</div>
          <div>• 球体应该有环境反射</div>
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
        <HDRTestComponent />
      </Canvas>
    </div>
  );
}
