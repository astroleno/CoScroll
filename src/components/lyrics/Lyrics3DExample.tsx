"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import Lyrics3DIntegration, { getAdaptiveConfig } from './Lyrics3DIntegration';
import type { LyricLine } from '@/types/lyrics3D.types';

/**
 * 3D字幕使用示例
 * 
 * 这个组件展示了如何在JadeV6中集成3D字幕功能
 * 包含了完整的配置、状态管理和性能优化
 */

// 示例歌词数据
const sampleLyrics: LyricLine[] = [
  { text: '观自在菩萨', time: 0 },
  { text: '行深般若波罗蜜多时', time: 3 },
  { text: '照见五蕴皆空', time: 6 },
  { text: '度一切苦厄', time: 9 },
  { text: '舍利子', time: 12 },
  { text: '色不异空', time: 15 },
  { text: '空不异色', time: 18 },
  { text: '色即是空', time: 21 },
  { text: '空即是色', time: 24 },
  { text: '受想行识', time: 27 },
  { text: '亦复如是', time: 30 }
];

/**
 * 锚字模型组件
 */
const AnchorModel: React.FC<{
  onModelReady: (model: THREE.Object3D) => void;
}> = ({ onModelReady }) => {
  const modelRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (modelRef.current) {
      onModelReady(modelRef.current);
    }
  }, [onModelReady]);

  return (
    <mesh ref={modelRef} position={[0, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshPhysicalMaterial
        color="#2d6d8b"
        metalness={0.1}
        roughness={0.1}
        transmission={0.9}
        thickness={0.5}
        ior={1.5}
        clearcoat={0.1}
        clearcoatRoughness={0.1}
      />
    </mesh>
  );
};

/**
 * 3D字幕示例组件
 */
const Lyrics3DExample: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollTime, setScrollTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [anchorModel, setAnchorModel] = useState<THREE.Object3D | null>(null);
  const [currentAnchor, setCurrentAnchor] = useState('观');
  const [enableDebug, setEnableDebug] = useState(false);
  const [enablePerformanceMonitor, setEnablePerformanceMonitor] = useState(true);

  // 模拟滚动和播放
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying) {
        setScrollTime(prev => prev + 0.1);
        setCurrentIndex(prev => (prev + 1) % sampleLyrics.length);
        setScrollVelocity(Math.random() * 2 - 1); // 模拟滚动速度变化
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // 锚字切换
  useEffect(() => {
    const anchors = ['观', '空', '心', '色', '度'];
    const interval = setInterval(() => {
      setCurrentAnchor(anchors[Math.floor(Math.random() * anchors.length)]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // 处理锚字模型准备
  const handleModelReady = (model: THREE.Object3D) => {
    setAnchorModel(model);
  };

  // 获取自适应配置
  const config = getAdaptiveConfig();

  return (
    <div className="w-full h-screen bg-gray-900">
      {/* 控制面板 */}
      <div className="absolute top-4 left-4 z-10 bg-black bg-opacity-50 p-4 rounded-lg text-white">
        <h3 className="text-lg font-bold mb-2">3D字幕控制</h3>
        <div className="space-y-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600"
          >
            {isPlaying ? '暂停' : '播放'}
          </button>
          <button
            onClick={() => setEnableDebug(!enableDebug)}
            className="px-4 py-2 bg-green-500 rounded hover:bg-green-600"
          >
            调试: {enableDebug ? '开启' : '关闭'}
          </button>
          <button
            onClick={() => setEnablePerformanceMonitor(!enablePerformanceMonitor)}
            className="px-4 py-2 bg-purple-500 rounded hover:bg-purple-600"
          >
            性能监控: {enablePerformanceMonitor ? '开启' : '关闭'}
          </button>
        </div>
        <div className="mt-4 text-sm">
          <p>当前行: {currentIndex + 1}/{sampleLyrics.length}</p>
          <p>滚动时间: {scrollTime.toFixed(1)}s</p>
          <p>当前锚字: {currentAnchor}</p>
        </div>
      </div>

      {/* 3D场景 */}
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* 环境光照 */}
        <Environment preset="sunset" />
        
        {/* 基础光照 */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        {/* 锚字模型 */}
        <AnchorModel onModelReady={handleModelReady} />
        
        {/* 3D字幕 */}
        {anchorModel && (
          <Lyrics3DIntegration
            lyricsData={sampleLyrics}
            currentIndex={currentIndex}
            scrollTime={scrollTime}
            isPlaying={isPlaying}
            scrollVelocity={scrollVelocity}
            anchorModel={anchorModel}
            anchorModelSize={new THREE.Vector3(1, 1, 1)}
            currentAnchor={currentAnchor}
            config={config}
            enableDebug={enableDebug}
            enablePerformanceMonitor={enablePerformanceMonitor}
            onError={(error) => console.error('3D字幕错误:', error)}
            onLoad={() => console.log('3D字幕加载完成')}
          />
        )}
        
        {/* 轨道控制器 */}
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
      </Canvas>
    </div>
  );
};

export default Lyrics3DExample;
