"use client";

import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { StackedLayoutProps } from './types';
import TopLyrics from './TopLyrics';
import BottomLyrics from './BottomLyrics';
import JadeModelLoader from '@/components/jade/JadeModelLoader';

/**
 * 三层 Canvas 叠加布局
 *
 * - 底层：被模型遮挡的歌词（后层）
 * - 中层：Jade 模型
 * - 顶层：不被遮挡的歌词（前层）
 *
 * 手动滚动、速度控制等逻辑完全交由隐藏的 LyricsController 处理；
 * 该组件只负责按照前-后-后模式渲染 3D 视图。
 */
export default function StackedLyricsAndModel(props: StackedLayoutProps) {
  // 移除强制初始跳转，避免时间基准偏移

  return (
    <div className="relative flex items-center justify-center w-full h-full" style={{ minHeight: '60vh' }}>
      {/* 后层歌词（模型背后） */}
      <div className="absolute inset-0">
        <Canvas
          orthographic
          camera={{ position: [0, 0, 10], zoom: 110, near: -100, far: 100 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, depth: false, stencil: false, antialias: true }}
          style={{ background: '#202734' }}
        >
          <Suspense fallback={null}>
            <BottomLyrics {...props} />
          </Suspense>
        </Canvas>
      </div>

      {/* 模型层 */}
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          dpr={[1, 1.8]}
          gl={{ alpha: true, antialias: true }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[2, 2, 2]} intensity={1.2} />

            <JadeModelLoader
              modelPath={getModelPath(props.currentAnchor)}
              fitToView
              enableRotation
              rotationDurationSec={8}
              enableScrollControl
              baseSpeed={0.3}
              speedMultiplier={8.0}
              externalVelocity={props.scrollVelocity}
              maxAngularVelocity={1.5}
              enableDamping
              dampingFactor={0.92}
              velocitySmoothing={0.15}
              maxRotationPerFrame={0.08}
              environmentHdrPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
              environmentIntensity={1.0}
              background="transparent"
              showHdrBackground={false}
              innerColor="#2d6d8b"
              innerMetalness={1.0}
              innerRoughness={1.0}
              innerTransmission={0.0}
              enableEmissive
              innerEmissiveColor="#0f2b38"
              innerEmissiveIntensity={12.0}
              innerEnvMapIntensity={2.0}
              outerColor="#ffffff"
              outerMetalness={0.0}
              outerRoughness={0.82}
              outerTransmission={1.0}
              outerIor={1.52}
              outerReflectivity={0.3}
              outerThickness={0.24}
              outerClearcoat={0.0}
              outerClearcoatRoughness={1.0}
              outerEnvMapIntensity={5.0}
              outerOffset={0.001}
              creaseAngle={30}
              smoothShading
              innerSmoothShading
              outerSmoothShading
              normalMapPath="/textures/normal.jpg"
              normalScale={0.3}
              normalRepeat={3}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* 前层歌词（模型前面） */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <Canvas
          orthographic
          camera={{ position: [0, 0, 10], zoom: 110, near: -100, far: 100 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, depth: false, stencil: false, antialias: true }}
        >
          <Suspense fallback={null}>
            <TopLyrics {...props} />
          </Suspense>
        </Canvas>
      </div>
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
