"use client";
import { assetUrl } from '@/utils/assetUrl';


import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Text } from '@react-three/drei';
import Simple3DText from '@/components/lyrics/Simple3DText';
import JadeModelLoader from '@/components/jade/JadeModelLoader';
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

// 可用的3D模型列表
const AVAILABLE_MODELS = [
  assetUrl('/models/10k_obj/001_空.obj'),
  assetUrl('/models/10k_obj/002_心.obj'),
  assetUrl('/models/10k_obj/003_道.obj'),
];

// JadeV6 硬编码设置常量
const JADE_V6_SETTINGS = {
  // 相机设置（来自JadeV6.tsx第951行）
  camera: {
    position: [0, 0, 5] as [number, number, number],
    fov: 45,
    // 动态相机距离计算（来自JadeV6.tsx第407行）
    distanceMultiplier: 2.5, // distance = maxDim * 2.5
  },
  
  // 模型设置（来自JadeV6.tsx标准化处理）
  model: {
    // 标准化后的包围盒尺寸（来自Jade.tsx第238行）
    standardSize: 2.0, // 所有模型被缩放到最大尺寸为2个单位
    boundingBox: {
      width: 2.0,
      height: 2.0, 
      depth: 2.0
    },
    // 模型中心位置（标准化后居中到原点）
    center: [0, 0, 0] as [number, number, number],
  },
  
  // 渲染设置（来自JadeV6.tsx第952-959行）
  renderer: {
    toneMapping: THREE.ACESFilmicToneMapping,
    outputColorSpace: THREE.SRGBColorSpace,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance' as const
  }
};

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
  const [showGrid, setShowGrid] = useState(true); // 显示网格线
  const [frontScale, setFrontScale] = useState(0.28); // 前层字体缩放
  const [backScale, setBackScale] = useState(0.40); // 后层字体缩放

  // x坐标位置控制：区分前后层的左右位置
  const [frontLeftX, setFrontLeftX] = useState(-0.48); // 前层左对齐x坐标
  const [frontRightX, setFrontRightX] = useState(0.48); // 前层右对齐x坐标
  const [backLeftX, setBackLeftX] = useState(-0.72); // 后层左对齐x坐标
  const [backRightX, setBackRightX] = useState(0.72); // 后层右对齐x坐标

  // 字幕颜色和行距控制
  const [textColor, setTextColor] = useState('#0091EB'); // 字幕颜色
  const [lineSpacing, setLineSpacing] = useState(0.5); // 行距
  const [emissiveIntensity, setEmissiveIntensity] = useState(0.3); // 自发光强度

  // 模型控制
  const [currentModelIndex, setCurrentModelIndex] = useState(0);

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
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`px-4 py-2 rounded flex-1 ${
                showGrid ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {showGrid ? '📐 网格' : '📐 网格'}
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

        {/* 模型控制 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">模型切换:</label>
          <div className="flex space-x-1">
            {AVAILABLE_MODELS.map((model, index) => (
              <button
                key={model}
                onClick={() => setCurrentModelIndex(index)}
                className={`px-3 py-1 rounded text-sm ${
                  currentModelIndex === index 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                {index + 1}
              </button>
            ))}
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
                min="0.1"
                max="1.5"
                step="0.01"
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
                min="0.1"
                max="2.0"
                step="0.01"
                value={backScale}
                onChange={(e) => setBackScale(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 字幕颜色和行距控制 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">字幕样式:</label>
          <div className="space-y-2">
            <div>
              <div className="text-xs mb-1">字幕颜色:</div>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-full h-8 border border-gray-600 rounded"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>行距: {lineSpacing.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.01"
                value={lineSpacing}
                onChange={(e) => setLineSpacing(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>自发光强度: {emissiveIntensity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.01"
                value={emissiveIntensity}
                onChange={(e) => setEmissiveIntensity(parseFloat(e.target.value))}
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
                    <span>左对齐: {frontLeftX.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-3"
                    max="3"
                    step="0.01"
                    value={frontLeftX}
                    onChange={(e) => setFrontLeftX(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>右对齐: {frontRightX.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-3"
                    max="3"
                    step="0.01"
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
                    <span>左对齐: {backLeftX.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-3"
                    max="3"
                    step="0.01"
                    value={backLeftX}
                    onChange={(e) => setBackLeftX(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>右对齐: {backRightX.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-3"
                    max="3"
                    step="0.01"
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
          <p>当前模型: {AVAILABLE_MODELS[currentModelIndex].split('/').pop()}</p>
          <p>字幕颜色: {textColor}</p>
          <p>行距: {lineSpacing.toFixed(2)}</p>
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
              <p className="mt-2 text-yellow-300">模型设置:</p>
              <p>• 相机: 位置{JADE_V6_SETTINGS.camera.position.join(',')}, FOV{JADE_V6_SETTINGS.camera.fov}°</p>
              <p>• 模型: 尺寸{JADE_V6_SETTINGS.model.standardSize}×{JADE_V6_SETTINGS.model.standardSize}×{JADE_V6_SETTINGS.model.standardSize}</p>
              <p>• 相机距离: 模型尺寸 × {JADE_V6_SETTINGS.camera.distanceMultiplier} = {JADE_V6_SETTINGS.model.standardSize * JADE_V6_SETTINGS.camera.distanceMultiplier}</p>
              <p>• 材质: 玉质效果 (自发光+折射)</p>
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
            <li>玉质效果模型（自发光+折射）</li>
          </ul>
          
          <p><strong>🎮 操作说明:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>鼠标拖拽旋转视角</li>
            <li>滚轮缩放</li>
            <li>使用控制面板切换锚字</li>
            <li>点击1、2、3按钮切换3D模型</li>
            <li>开启调试模式查看层级信息</li>
            <li>点击网格按钮显示/隐藏辅助线</li>
          </ul>
          
          <p><strong>📐 网格线说明:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
            <li>红绿网格: 10×10单位，100条线（0.1×0.1精细网格，XZ平面）</li>
            <li>红点: 原点(0,0,0)</li>
            <li>红绿蓝轴: X/Y/Z坐标轴</li>
            <li>橙色线: 前层左右对齐位置</li>
            <li>蓝色线: 后层左右对齐位置</li>
          </ul>
          
          <p><strong>🔧 JadeV6硬编码设置:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
            <li>相机: 位置(0,0,5), FOV45°</li>
            <li>模型: 2×2×2标准化尺寸</li>
            <li>相机距离: 模型尺寸×2.5=5.0</li>
            <li>渲染: ACES色调映射</li>
          </ul>
        </div>
      </div>

      {/* 3D场景 - 使用JadeV6的硬编码设置 */}
      <Canvas
        camera={{ 
          position: JADE_V6_SETTINGS.camera.position, 
          fov: JADE_V6_SETTINGS.camera.fov 
        }}
        gl={JADE_V6_SETTINGS.renderer}
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
        
        {/* 网格线辅助对齐 - 可控制显示/隐藏 */}
        {showGrid && (
          <>
            <gridHelper 
              args={[10, 100, '#ff0000', '#00ff00']} 
              position={[0, 0, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            />
            
            {/* 坐标轴辅助线 */}
            <axesHelper args={[3]} />
            
            {/* 中心点标记 */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color="#ff0000" />
            </mesh>
            
            {/* 左右对齐参考线 */}
            <mesh position={[frontLeftX, 0, 0]}>
              <boxGeometry args={[0.02, 4, 0.02]} />
              <meshBasicMaterial color="#ff6600" />
            </mesh>
            <mesh position={[frontRightX, 0, 0]}>
              <boxGeometry args={[0.02, 4, 0.02]} />
              <meshBasicMaterial color="#ff6600" />
            </mesh>
            <mesh position={[backLeftX, 0, 0]}>
              <boxGeometry args={[0.02, 4, 0.02]} />
              <meshBasicMaterial color="#0066ff" />
            </mesh>
            <mesh position={[backRightX, 0, 0]}>
              <boxGeometry args={[0.02, 4, 0.02]} />
              <meshBasicMaterial color="#0066ff" />
            </mesh>
          </>
        )}

        {/* 锚字模型 - 使用JadeModelLoader加载真实3D模型 */}
        <group renderOrder={2}>
          <JadeModelLoader
            modelPath={AVAILABLE_MODELS[currentModelIndex]}
            rotationDurationSec={8}
            direction={1}
            fitToView={true}
            enableRotation={true}
          
          // 滚动控制参数
          enableScrollControl={true}
          baseSpeed={0.4}
          speedMultiplier={3.0}
          externalVelocity={0}
          
          // 内层材质参数（自发光层）
          innerColor="#2d6d8b"
          innerMetalness={1.0}
          innerRoughness={1.0}
          innerTransmission={0.0}
          innerEmissiveColor="#0f2b38"
          innerEmissiveIntensity={12.0}
          enableEmissive={true}
          innerEnvMapIntensity={2.0}
          
          // 图层控制
          showInnerLayer={true}
          showOuterLayer={true}
          outerOffset={0.001}
          
          // 外层材质参数（折射层）
          outerColor="#ffffff"
          outerMetalness={0.0}
          outerRoughness={0.85}
          outerTransmission={1.0}
          outerIor={1.5}
          outerReflectivity={0.30}
          outerThickness={0.24}
          outerClearcoat={0.0}
          outerClearcoatRoughness={1.0}
          outerEnvMapIntensity={5.0}
          
          // 几何体优化
          maxEdge={0.15}
          subdivisions={0}
          creaseAngle={30}
          
          // 平滑着色控制
          smoothShading={true}
          innerSmoothShading={true}
          outerSmoothShading={true}
        />
        </group>

        {/* 3D字幕 - 固定前-后-后循环布局 */}
        {testLyrics.map((lyric, index) => {
          // 固定的前-后-后循环：第1、4、7行在前层（index%3=0），其他行在后层
          const layerCycle = index % 3;
          const isFront = layerCycle === 0; // index%3=0的是前（第1、4、7行...）
          const z = isFront ? 0.5 : -0.5; // 前面z=0.5，后面z=-0.5（相对于模型z=0）

          // 左右布局：偶数行左，奇数行右，区分前后层位置
          const isLeft = index % 2 === 0;
          const x = isLeft
            ? (isFront ? frontLeftX : backLeftX)   // 根据前后层选择左对齐位置
            : (isFront ? frontRightX : backRightX); // 根据前后层选择右对齐位置
          const y = (currentIndex - index) * lineSpacing; // 使用可调整的行距
          
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
              color={textColor} // 传递字幕颜色
              emissiveIntensity={emissiveIntensity} // 传递自发光强度
            />
          );
        })}
        
        {/* 调试信息 */}
        {showDebug && (
          <>
            <Text
              position={[0, 3, 0]}
              fontSize={0.2}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              {`当前行: ${currentIndex + 1}/${testLyrics.length} | 文字: ${testLyrics[currentIndex]} | 层级: ${currentIndex % 3 === 0 ? '前' : '后'} (index%3=${currentIndex % 3})`}
            </Text>
            
            {/* 左右对齐测试线 */}
            <Text
              position={[frontLeftX, 2.5, 1]}
              fontSize={0.15}
              color="red"
              anchorX="left"
              anchorY="middle"
            >
              前层左对齐线
            </Text>
            <Text
              position={[frontRightX, 2.5, 1]}
              fontSize={0.15}
              color="red"
              anchorX="right"
              anchorY="middle"
            >
              前层右对齐线
            </Text>
            <Text
              position={[backLeftX, 2.5, -1]}
              fontSize={0.15}
              color="blue"
              anchorX="left"
              anchorY="middle"
            >
              后层左对齐线
            </Text>
            <Text
              position={[backRightX, 2.5, -1]}
              fontSize={0.15}
              color="blue"
              anchorX="right"
              anchorY="middle"
            >
              后层右对齐线
            </Text>
          </>
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
            <strong>基础版3D字幕测试 + 真实3D模型</strong> - 访问路径: /lyrics3d-basic
          </div>
          <div className="text-gray-300">
            前-后-后循环布局 + JadeV6双层材质渲染
          </div>
        </div>
      </div>
    </div>
  );
}
