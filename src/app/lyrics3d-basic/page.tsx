"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Text } from '@react-three/drei';
import Simple3DText from '@/components/lyrics/Simple3DText';
import * as THREE from 'three';

/**
 * 基础版3D字幕测试页面
 * 
 * 访问路径: /lyrics3d-basic
 * 功能: 最基础的3D字幕测试，无复杂配置
 */

// 测试歌词数据 - 按照constants.ts的正确顺序
const testLyrics = [
  '观自在菩萨',
  '行深般若波罗蜜多时', 
  '照见五蕴皆空',
  '度ー切苦厄',
  '舍利子',
  '色不异空',
  '空不异色',
  '色即是空',
  '空即是色',
  '受想行识',
  '亦复如是',
  '舍利子',
  '是诸法空相',
  '不生不灭',
  '不垢不净',
  '不增不减'
];

// 使用简化的3D文字组件

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
 * 基础版3D字幕测试页面
 */
export default function Lyrics3DBasicPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [anchorModel, setAnchorModel] = useState<THREE.Object3D | null>(null);
  const [currentAnchor, setCurrentAnchor] = useState('观');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [frontScale, setFrontScale] = useState(0.85); // 前层字体缩放
  const [backScale, setBackScale] = useState(1.15); // 后层字体缩放

  // x坐标位置控制：区分前后层的左右位置
  const [frontLeftX, setFrontLeftX] = useState(-2); // 前层左对齐x坐标
  const [frontRightX, setFrontRightX] = useState(2); // 前层右对齐x坐标
  const [backLeftX, setBackLeftX] = useState(-2); // 后层左对齐x坐标
  const [backRightX, setBackRightX] = useState(2); // 后层右对齐x坐标

  // 锚字列表
  const anchors = ['观', '空', '心', '色', '度'];

  // 自动播放逻辑
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentIndex(prev => {
          const next = prev + 1;
          return next >= testLyrics.length ? 0 : next; // 确保从0开始
        });
      }, 3000); // 增加间隔时间，让动画更明显

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
        <h3 className="text-lg font-bold mb-3">基础版3D字幕测试</h3>
        
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
              onClick={() => setShowDebug(!showDebug)}
              className={`px-4 py-2 rounded flex-1 ${
                showDebug ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {showDebug ? '🔍 调试' : '📊 信息'}
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

        {/* 字体大小调节 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">字体大小调节:</label>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>前层字体: {frontScale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={frontScale}
                onChange={(e) => setFrontScale(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>后层字体: {backScale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={backScale}
                onChange={(e) => setBackScale(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 左右位置调节 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">左右位置调节:</label>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-gray-300 mb-1">前层位置:</div>
              <div className="space-y-1">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>左对齐: {frontLeftX.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="-4"
                    max="-0.5"
                    step="0.1"
                    value={frontLeftX}
                    onChange={(e) => setFrontLeftX(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>右对齐: {frontRightX.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="4"
                    step="0.1"
                    value={frontRightX}
                    onChange={(e) => setFrontRightX(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-300 mb-1">后层位置:</div>
              <div className="space-y-1">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>左对齐: {backLeftX.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="-4"
                    max="-0.5"
                    step="0.1"
                    value={backLeftX}
                    onChange={(e) => setBackLeftX(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>右对齐: {backRightX.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="4"
                    step="0.1"
                    value={backRightX}
                    onChange={(e) => setBackRightX(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 状态信息 */}
        <div className="text-sm space-y-1">
          <p>当前行: {currentIndex + 1}/{testLyrics.length}</p>
          <p>当前锚字: {currentAnchor}</p>
          <p>当前文字: {testLyrics[currentIndex]}</p>
          {showDebug && (
            <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
              <p>调试信息:</p>
              <p>• 前层: 第1、4、7、10、13行 (index%3=0, z = 0.5)</p>
              <p>• 后层: 第2、3、5、6、8、9、11、12、14、15行 (index%3=1/2, z = -0.5)</p>
              <p>• 当前层级: {currentIndex % 3 === 0 ? '前' : '后'}</p>
              <p>• 前层字体: {frontScale.toFixed(2)}x, 后层字体: {backScale.toFixed(2)}x</p>
              <p>• 前层位置: 左{frontLeftX.toFixed(1)}, 右{frontRightX.toFixed(1)}</p>
              <p>• 后层位置: 左{backLeftX.toFixed(1)}, 右{backRightX.toFixed(1)}</p>
              <p>• 透明度: 当前行不透明，其他行半透明</p>
            </div>
          )}
        </div>
      </div>

      {/* 说明面板 */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-70 p-4 rounded-lg text-white max-w-sm">
        <h3 className="text-lg font-bold mb-2">测试说明</h3>
        <div className="text-sm space-y-2">
          <p><strong>🎯 观察重点:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>第1、4、7、10行在前层 (index%3=0, 锚字前面)</li>
            <li>第2、3、5、6、8、9行在后层 (index%3=1/2, 锚字后面)</li>
            <li>后层文字被锚字模型遮挡</li>
            <li>透明度渐变效果</li>
            <li>前后层不同字体大小调整</li>
          </ul>
          
          <p><strong>🎮 操作说明:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>鼠标拖拽旋转视角</li>
            <li>滚轮缩放</li>
            <li>使用控制面板切换锚字</li>
            <li>开启调试模式查看层级信息</li>
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
        
        {/* 锚字模型 - 暂时隐藏，避免遮挡文字 */}
        {/* <AnchorModel 
          onModelReady={handleModelReady} 
          currentAnchor={currentAnchor}
        /> */}
        
        {/* 锚字模型 - 作为遮挡物 */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="red" opacity={1.0} transparent={false} />
        </mesh>

        {/* 3D字幕 - 固定前-后-后循环布局 */}
        {testLyrics.map((lyric, index) => {
          // 固定的前-后-后循环：第1、4、7行在前层（index%3=0），其他行在后层
          const layerCycle = index % 3;
          const isFront = layerCycle === 0; // index%3=0的是前（第1、4、7行...）
          const z = isFront ? 1 : -1; // 前面z=1，后面z=-1（相对于模型z=0）

          // 左右布局：偶数行左，奇数行右，区分前后层位置
          const isLeft = index % 2 === 0;
          const x = isLeft
            ? (isFront ? frontLeftX : backLeftX)   // 根据前后层选择左对齐位置
            : (isFront ? frontRightX : backRightX); // 根据前后层选择右对齐位置
          const y = (currentIndex - index) * 1.2; // 修复：从下到上，当前行在中间
          
          // 透明度渐变：距离越远越透明
          const distance = Math.abs(index - currentIndex);
          const opacity = Math.max(0.1, 1 - distance * 0.2);
          
          return (
            <Simple3DText
              key={index}
              text={lyric}
              position={[x, y, z]}
              isCurrent={index === currentIndex}
              index={index}
              currentIndex={currentIndex}
              isLeft={isLeft}
              opacity={opacity} // 传递透明度
              isFront={isFront} // 传递前后层信息
              frontScale={frontScale} // 传递前层字体缩放
              backScale={backScale} // 传递后层字体缩放
            />
          );
        })}
        
        {/* 调试信息 */}
        {showDebug && (
          <Text
            position={[0, 3, 0]}
            fontSize={0.2}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            {`当前行: ${currentIndex + 1}/${testLyrics.length} | 文字: ${testLyrics[currentIndex]} | 层级: ${currentIndex % 3 === 0 ? '前' : '后'} (index%3=${currentIndex % 3})`}
          </Text>
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
            <strong>基础版3D字幕测试</strong> - 访问路径: /lyrics3d-basic
          </div>
          <div className="text-gray-300">
            无复杂配置 + 前-后-后循环布局
          </div>
        </div>
      </div>
    </div>
  );
}
