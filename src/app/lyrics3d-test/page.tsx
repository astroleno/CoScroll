"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import Lyrics3DIntegration, { getAdaptiveConfig } from '@/components/lyrics/Lyrics3DIntegration';
import type { LyricLine } from '@/types/lyrics3D.types';

/**
 * 3D字幕测试页面
 * 
 * 访问路径: /lyrics3d-test
 * 功能: 测试3D字幕系统的所有功能
 */

// 测试歌词数据
const testLyrics: LyricLine[] = [
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
  { text: '亦复如是', time: 30 },
  { text: '舍利子', time: 33 },
  { text: '是诸法空相', time: 36 },
  { text: '不生不灭', time: 39 },
  { text: '不垢不净', time: 42 },
  { text: '不增不减', time: 45 }
];

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
      <boxGeometry args={[1.2, 1.2, 1.2]} />
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
 * 3D字幕测试页面
 */
export default function Lyrics3DTestPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollTime, setScrollTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [anchorModel, setAnchorModel] = useState<THREE.Object3D | null>(null);
  const [currentAnchor, setCurrentAnchor] = useState('观');
  const [enableDebug, setEnableDebug] = useState(false);
  const [enablePerformanceMonitor, setEnablePerformanceMonitor] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [speed, setSpeed] = useState(1);

  // 锚字列表
  const anchors = ['观', '空', '心', '色', '度'];

  // 自动播放逻辑
  useEffect(() => {
    if (autoPlay && isPlaying) {
      const interval = setInterval(() => {
        setScrollTime(prev => prev + 0.1 * speed);
        setCurrentIndex(prev => (prev + 1) % testLyrics.length);
        setScrollVelocity(Math.random() * 2 - 1);
      }, 100);

      return () => clearInterval(interval);
    }
  }, [autoPlay, isPlaying, speed]);

  // 锚字切换
  useEffect(() => {
    if (autoPlay) {
      const interval = setInterval(() => {
        setCurrentAnchor(anchors[Math.floor(Math.random() * anchors.length)]);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [autoPlay]);

  // 处理锚字模型准备
  const handleModelReady = (model: THREE.Object3D) => {
    setAnchorModel(model);
  };

  // 获取自适应配置
  const config = getAdaptiveConfig();

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
        <h3 className="text-lg font-bold mb-3">3D字幕测试控制台</h3>
        
        {/* 播放控制 */}
        <div className="space-y-2 mb-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 flex-1"
            >
              {isPlaying ? '⏸️ 暂停' : '▶️ 播放'}
            </button>
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              className={`px-4 py-2 rounded flex-1 ${
                autoPlay ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {autoPlay ? '🔄 自动' : '⏹️ 手动'}
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

        {/* 速度控制 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">播放速度: {speed}x</label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full"
          />
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

        {/* 调试选项 */}
        <div className="space-y-2 mb-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={enableDebug}
              onChange={(e) => setEnableDebug(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">调试模式</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={enablePerformanceMonitor}
              onChange={(e) => setEnablePerformanceMonitor(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">性能监控</span>
          </label>
        </div>

        {/* 状态信息 */}
        <div className="text-sm space-y-1">
          <p>当前行: {currentIndex + 1}/{testLyrics.length}</p>
          <p>滚动时间: {scrollTime.toFixed(1)}s</p>
          <p>当前锚字: {currentAnchor}</p>
          <p>当前文字: {testLyrics[currentIndex]?.text}</p>
        </div>
      </div>

      {/* 说明面板 */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-70 p-4 rounded-lg text-white max-w-sm">
        <h3 className="text-lg font-bold mb-2">测试说明</h3>
        <div className="text-sm space-y-2">
          <p><strong>🎯 测试目标:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>观察"前-后-后"循环布局</li>
            <li>测试与锚字模型的遮挡效果</li>
            <li>验证性能优化和LOD系统</li>
            <li>检查文字渲染质量</li>
          </ul>
          
          <p><strong>🎮 操作说明:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>鼠标拖拽旋转视角</li>
            <li>滚轮缩放</li>
            <li>使用控制面板切换锚字</li>
            <li>开启调试模式查看性能信息</li>
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
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        
        {/* 锚字模型 */}
        <AnchorModel 
          onModelReady={handleModelReady} 
          currentAnchor={currentAnchor}
        />
        
        {/* 3D字幕 */}
        {anchorModel && (
          <Lyrics3DIntegration
            lyricsData={testLyrics}
            currentIndex={currentIndex}
            scrollTime={scrollTime}
            isPlaying={isPlaying}
            scrollVelocity={scrollVelocity}
            anchorModel={anchorModel}
            anchorModelSize={new THREE.Vector3(1.2, 1.2, 1.2)}
            currentAnchor={currentAnchor}
            config={config}
            enableDebug={enableDebug}
            enablePerformanceMonitor={false} // 暂时禁用性能监控
            onError={(error) => {
              console.error('3D字幕错误:', error);
              // 不显示alert，避免干扰测试
            }}
            onLoad={() => {
              console.log('3D字幕加载完成');
            }}
          />
        )}
        
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
            <strong>3D字幕系统测试</strong> - 访问路径: /lyrics3d-test
          </div>
          <div className="text-gray-300">
            基于Troika Text + 前-后-后循环布局
          </div>
        </div>
      </div>
    </div>
  );
}
