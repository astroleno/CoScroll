"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Text } from '@react-three/drei';
import * as THREE from 'three';

/**
 * 简化版3D字幕测试页面
 * 
 * 访问路径: /lyrics3d-simple
 * 功能: 基础3D字幕测试，避免复杂配置
 */

// 测试歌词数据
const testLyrics = [
  '观自在菩萨',
  '行深般若波罗蜜多时', 
  '照见五蕴皆空',
  '度一切苦厄',
  '舍利子',
  '色不异空',
  '空不异色',
  '色即是空',
  '空即是色'
];

/**
 * 简单的3D文字组件
 */
const Simple3DText: React.FC<{
  text: string;
  position: [number, number, number];
  isCurrent: boolean;
  index: number;
  currentIndex: number;
}> = ({ text, position, isCurrent, index, currentIndex }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // 计算层级 (前-后-后循环)
  const relativeIndex = Math.abs(index - currentIndex);
  const layerCycle = relativeIndex % 3;
  const isFront = layerCycle === 0;
  
  // 计算透明度
  const distance = Math.abs(index - currentIndex);
  const opacity = Math.max(0.1, 1 - distance * 0.3);
  
  // 计算颜色
  const color = isCurrent ? '#E2E8F0' : '#94A3B8';
  
  return (
    <Text
      ref={meshRef}
      position={position}
      fontSize={0.3}
      color={color}
      anchorX="center"
      anchorY="middle"
      renderOrder={isFront ? 1 : 0}
      material-transparent
      material-opacity={opacity}
      material-depthTest={isFront}
      material-depthWrite={isFront}
    >
      {text}
    </Text>
  );
};

/**
 * 锚字模型组件
 */
const AnchorModel: React.FC<{
  onModelReady: (model: THREE.Object3D) => void;
  currentAnchor: string;
}> = ({ onModelReady, currentAnchor }) => {
  const modelRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (modelRef.current) {
      onModelReady(modelRef.current);
    }
  }, [onModelReady]);

  // 根据锚字调整颜色
  const getAnchorColor = (anchor: string) => {
    const colors = {
      '观': '#2d6d8b',
      '空': '#4a90e2', 
      '心': '#e74c3c',
      '色': '#f39c12',
      '度': '#9b59b6'
    };
    return colors[anchor as keyof typeof colors] || '#2d6d8b';
  };

  return (
    <mesh ref={modelRef} position={[0, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshPhysicalMaterial
        color={getAnchorColor(currentAnchor)}
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
 * 简化版3D字幕测试页面
 */
export default function Lyrics3DSimplePage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [anchorModel, setAnchorModel] = useState<THREE.Object3D | null>(null);
  const [currentAnchor, setCurrentAnchor] = useState('观');
  const [isPlaying, setIsPlaying] = useState(false);

  // 锚字列表
  const anchors = ['观', '空', '心', '色', '度'];

  // 自动播放逻辑
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % testLyrics.length);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  // 锚字切换
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentAnchor(anchors[Math.floor(Math.random() * anchors.length)]);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  // 处理锚字模型准备
  const handleModelReady = (model: THREE.Object3D) => {
    setAnchorModel(model);
  };

  // 手动控制
  const handlePrevious = () => {
    setCurrentIndex(prev => (prev - 1 + testLyrics.length) % testLyrics.length);
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % testLyrics.length);
  };

  const handleAnchorChange = (anchor: string) => {
    setCurrentAnchor(anchor);
  };

  return (
    <div className="w-full h-screen bg-gray-900 relative">
      {/* 控制面板 */}
      <div className="absolute top-4 left-4 z-10 bg-black bg-opacity-70 p-4 rounded-lg text-white max-w-sm">
        <h3 className="text-lg font-bold mb-3">简化版3D字幕测试</h3>
        
        {/* 播放控制 */}
        <div className="space-y-2 mb-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 flex-1"
            >
              {isPlaying ? '⏸️ 暂停' : '▶️ 播放'}
            </button>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handlePrevious}
              className="px-3 py-2 bg-gray-600 rounded hover:bg-gray-700"
            >
              ⏮️ 上一行
            </button>
            <button
              onClick={handleNext}
              className="px-3 py-2 bg-gray-600 rounded hover:bg-gray-700"
            >
              ⏭️ 下一行
            </button>
          </div>
        </div>

        {/* 锚字控制 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">当前锚字:</label>
          <div className="flex space-x-1">
            {anchors.map((anchor) => (
              <button
                key={anchor}
                onClick={() => handleAnchorChange(anchor)}
                className={`px-3 py-1 rounded text-sm ${
                  currentAnchor === anchor 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                {anchor}
              </button>
            ))}
          </div>
        </div>

        {/* 状态信息 */}
        <div className="text-sm space-y-1">
          <p>当前行: {currentIndex + 1}/{testLyrics.length}</p>
          <p>当前锚字: {currentAnchor}</p>
          <p>当前文字: {testLyrics[currentIndex]}</p>
        </div>
      </div>

      {/* 说明面板 */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-70 p-4 rounded-lg text-white max-w-sm">
        <h3 className="text-lg font-bold mb-2">测试说明</h3>
        <div className="text-sm space-y-2">
          <p><strong>🎯 观察重点:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>第1、4、7行在前层 (锚字前面)</li>
            <li>第2、3、5、6行在后层 (锚字后面)</li>
            <li>后层文字被锚字模型遮挡</li>
            <li>透明度渐变效果</li>
          </ul>
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
        <AnchorModel 
          onModelReady={handleModelReady} 
          currentAnchor={currentAnchor}
        />
        
        {/* 3D字幕 */}
        {testLyrics.map((lyric, index) => {
          const isLeft = index % 2 === 0;
          const x = isLeft ? -2 : 2;
          const y = (index - currentIndex) * 0.8;
          
          // 计算层级
          const relativeIndex = Math.abs(index - currentIndex);
          const layerCycle = relativeIndex % 3;
          const z = layerCycle === 0 ? -0.5 : 0.8; // 前-后-后循环
          
          return (
            <Simple3DText
              key={index}
              text={lyric}
              position={[x, y, z]}
              isCurrent={index === currentIndex}
              index={index}
              currentIndex={currentIndex}
            />
          );
        })}
        
        {/* 轨道控制器 */}
        <OrbitControls 
          enablePan={true} 
          enableZoom={true} 
          enableRotate={true}
          minDistance={2}
          maxDistance={20}
        />
      </Canvas>

      {/* 底部信息栏 */}
      <div className="absolute bottom-4 left-4 right-4 z-10 bg-black bg-opacity-70 p-3 rounded-lg text-white text-sm">
        <div className="flex justify-between items-center">
          <div>
            <strong>简化版3D字幕测试</strong> - 访问路径: /lyrics3d-simple
          </div>
          <div className="text-gray-300">
            基础3D文字渲染 + 前-后-后循环布局
          </div>
        </div>
      </div>
    </div>
  );
}
