"use client";

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { StackedLayoutProps } from './types';
import TopLyrics from './TopLyrics';
import BottomLyrics from './BottomLyrics';
import JadeModelLoader from '@/components/jade/JadeModelLoader';

/**
 * 三层 Canvas 叠加布局组件
 * 实现歌词和模型的分层渲染
 * 注意：滚动控制由隐藏的LyricsController处理，此组件专注于渲染
 */
export default function StackedLyricsAndModel(props: StackedLayoutProps) {
  const [midOpacity, setMidOpacity] = useState(1.0);
  const middleCanvasRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative w-full h-screen grid grid-cols-1 grid-rows-1">
      {/* Bottom Layer: 后两行歌词 */}
      <div className="col-start-1 row-start-1">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{
            alpha: true,
            devicePixelRatio: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1)
          }}
          style={{ background: '#202734' }}
        >
          <Suspense fallback={null}>
            <BottomLyrics {...props} />
          </Suspense>
        </Canvas>
      </div>

      {/* Middle Layer: 3D 模型 */}
      <div
        ref={middleCanvasRef}
        className="col-start-1 row-start-1"
        style={{ opacity: midOpacity }}
      >
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{
            alpha: true,
            devicePixelRatio: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1)
          }}
        >
          <Suspense fallback={null}>
            {/* 环境和光照 */}
            <ambientLight intensity={0.4} />
            <directionalLight position={[2, 2, 2]} intensity={1.2} />
            <Environment
              files="/textures/qwantani_moon_noon_puresky_1k.hdr"
              background={false}
            />

            {/* 3D 模型 */}
            <JadeModelLoader
              modelPath={getModelPath(props.currentAnchor)}
              fitToView
              enableRotation
              rotationDurationSec={8}
              enableScrollControl={true}
              baseSpeed={0.3}
              speedMultiplier={8.0}
              externalVelocity={props.scrollVelocity} // 使用来自LyricsController的滚动速度
              // 材质参数 - 与 JadeV6 保持一致
              innerColor="#2d6d8b"
              innerMetalness={1.0}
              innerRoughness={1.0}
              innerTransmission={0.0}
              enableEmissive
              innerEmissiveColor="#0f2b38"
              innerEmissiveIntensity={12.0} // 修正为与JadeV6相同
              innerEnvMapIntensity={2.0} // 修正为与JadeV6相同
              outerColor="#ffffff" // 修正为白色
              outerMetalness={0.0}
              outerRoughness={0.85} // 修正为与JadeV6相同
              outerTransmission={1.0}
              outerIor={1.5}
              outerReflectivity={0.30} // 修正为与JadeV6相同
              outerThickness={0.24} // 修正为与JadeV6相同
              outerClearcoat={0.0} // 修正为与JadeV6相同
              outerClearcoatRoughness={1.0} // 修正为与JadeV6相同
              outerEnvMapIntensity={5.0} // 修正为与JadeV6相同
              outerOffset={0.001} // 修正为与JadeV6相同的偏移距离
              creaseAngle={30}
              smoothShading
              innerSmoothShading
              outerSmoothShading
            />

            {/* 交互控制 */}
            <OrbitControls />
          </Suspense>
        </Canvas>
      </div>

      {/* Top Layer: 前一行歌词 */}
      <div className="col-start-1 row-start-1 pointer-events-none" aria-hidden>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{
            alpha: true,
            devicePixelRatio: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1)
          }}
        >
          <Suspense fallback={null}>
            <TopLyrics {...props} />
          </Suspense>
        </Canvas>
      </div>

      {/* 调试控制面板（可选） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed left-4 top-4 z-50 bg-black/80 p-4 rounded-lg space-y-4 text-white">
          <h3 className="text-sm font-semibold">三层叠加调试</h3>
          <div>
            <label className="block text-xs mb-2">
              模型透明度: {midOpacity.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={midOpacity}
              onChange={(e) => setMidOpacity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// 辅助函数：根据锚字获取模型路径
function getModelPath(anchorChar: string): string {
  const ANCHOR_MODEL_MAPPING = {
    '观': '/models/10k_obj/101_观.obj',
    '空': '/models/10k_obj/001_空.obj',
    '苦': '/models/10k_obj/045_苦.obj',
    '色': '/models/10k_obj/094_色.obj',
    '法': '/models/10k_obj/022_法.obj',
    '生': '/models/10k_obj/019_生.obj',
    '无': '/models/10k_obj/012_无.obj',
    '死': '/models/10k_obj/020_死.obj',
    '道': '/models/10k_obj/003_道.obj',
    '心': '/models/10k_obj/002_心.obj',
    '悟': '/models/10k_obj/008_悟.obj',
    '明': '/models/10k_obj/007_明.obj',
    '真': '/models/10k_obj/009_真.obj',
    '圆': '/models/10k_obj/001_空.obj',
    default: '/models/10k_obj/001_空.obj'
  };

  return ANCHOR_MODEL_MAPPING[anchorChar as keyof typeof ANCHOR_MODEL_MAPPING] || ANCHOR_MODEL_MAPPING.default;
}