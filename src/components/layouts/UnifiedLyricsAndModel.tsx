"use client";

import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { UnifiedLayoutProps } from './types';
import { useLayeredLyrics } from './useLayeredLyrics';
import LyricBillboard from './LyricBillboard';
import JadeModelLoader from '@/components/jade/JadeModelLoader';
import type { LyricLine } from '@/types';

/**
 * 统一单Canvas布局 - 实现真实的3D遮挡关系
 * 
 * 核心改进：
 * 1. 单一Canvas：所有元素（歌词+模型）在同一3D场景中
 * 2. 真实深度测试：启用WebGL深度缓冲实现遮挡
 * 3. 渲染顺序控制：通过renderOrder和Z轴位置控制前后关系
 * 4. 统一光照：所有元素共享同一套光照系统
 */
interface UnifiedLyricsAndModelProps extends UnifiedLayoutProps {
  /** 可选：歌词渲染使用的字体族（需在页面注册 @font-face） */
  fontFamily?: string;
  /** 可选：字体大小倍数 */
  fontSize?: number;
}

export default function UnifiedLyricsAndModel(props: UnifiedLyricsAndModelProps) {
  const { scrollTime, duration, lyrics, currentAnchor, scrollVelocity, fontFamily, fontSize = 1.0 } = props;
  const lyricData = (lyrics || []) as LyricLine[];

  const isMobile = typeof navigator !== 'undefined'
    ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    : false;
  const isCompactMobile = isMobile && typeof window !== 'undefined' && window.innerHeight < 667;

  // 歌词分层配置 - 正交相机下的遮挡、竖排布局
  const lyricsConfig = useMemo(() => ({
    range: 6,
    horizontalOffset: isMobile ? 1.6 : 1.85,
    verticalSpacing: isMobile ? 1.1 : 1.26,
    movementAxis: 'horizontal' as const,
    travelSpacing: isMobile ? 0.85 : 1.0,
    laneSeparation: isMobile ? 0.65 : 0.85,
    topLaneY: isMobile ? 2.1 : 2.8,
    bottomLaneY: isMobile ? -2.3 : -3.0,
    // 正交相机中：Z 越大越靠近相机
    frontDepth: 6.0,
    backNearDepth: -2.2,
    backFarDepth: -3.5,
    edgeFeatherStart: isMobile ? 0.34 : 0.28,
    edgeFadeStart: isMobile ? 0.52 : 0.48,
    edgeFeatherExponent: isMobile ? 1.05 : 0.85,
  }), [isMobile]);

  // 获取分层歌词数据
  const { front, back } = useLayeredLyrics({
    lyrics: lyricData,
    scrollTime,
    duration,
    options: lyricsConfig
  });

  // 调试信息
  console.log('[UnifiedLyricsAndModel] 歌词数据:', {
    totalLyrics: lyricData.length,
    frontCount: front.length,
    backCount: back.length,
    scrollTime,
    duration
  });

  // 字体大小配置
  const frontFontSize = (isMobile ? (isCompactMobile ? 0.48 : 0.54) : 0.62) * fontSize;
  const backFontSize = (isMobile ? (isCompactMobile ? 0.44 : 0.5) : 0.58) * fontSize;
  const baseModelScale = isMobile ? 2.2 : 2.8;
  // 在现有基础上再放大 1.1 倍
  const modelScale = baseModelScale * 1.2 * 1.1;
  const stageYOffset = isMobile ? (isCompactMobile ? -0.7 : -0.85) : -1.05;

  return (
    <div className="relative flex items-center justify-center w-full h-full" style={{ minHeight: '60vh' }}>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 12], zoom: isMobile ? 92 : 100, near: 0.1, far: 50 }}
        dpr={[1, 1.8]}
        gl={{ 
          alpha: true, 
          depth: true,        // 启用深度测试
          stencil: false, 
          antialias: true 
        }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          {/* 统一光照系统 */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[2, 2, 2]} intensity={1.2} />
          <pointLight position={[-2, 2, -2]} intensity={0.3} color="#4A90E2" />

          {/* 后层歌词组 - 模型背后，Z轴为负数，被模型遮挡 */}
          <group renderOrder={1000}>
            {back.map((line, idx) => (
              <LyricBillboard
                key={line.key}
                text={line.text}
                position={[line.x, line.y + stageYOffset, line.z + idx * 0.01]}
                fontSize={backFontSize}
                color={line.isCurrent ? '#f8fafc' : '#cbd5f5'}
                opacity={line.opacity}
                align={line.isLeft ? 'left' : 'right'}
                scale={line.scale}
                depthTest={true}      // 启用深度测试，参与遮挡计算
                depthWrite={true}     // 启用深度写入，影响后续渲染
                renderOrder={line.renderOrder}
                orientation="vertical"
                verticalAlign={line.verticalAlign}
                fontFamily={fontFamily}
                fontSizeMultiplier={fontSize}
                edgeFeather={line.edgeFeather}
              />
            ))}
          </group>

          {/* 3D模型 - 中间层，Z轴在0，遮挡后层歌词 */}
          <group renderOrder={2000} position={[0, stageYOffset, 0]} scale={[modelScale, modelScale, modelScale]}>
            <JadeModelLoader
              modelPath={getModelPath(currentAnchor)}
              fitToView={false}
              enableRotation
              rotationDurationSec={8}
              direction={-1}
              enableScrollControl
              baseSpeed={-0.32}
              speedMultiplier={-7.5}
              externalVelocity={scrollVelocity}
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
          </group>

          {/* 前层歌词组 - 模型前面，Z轴为正值，不被模型遮挡 */}
          <group renderOrder={3000}>
            {front.map((line) => (
              <LyricBillboard
                key={line.key}
                text={line.text}
                position={[line.x, line.y + stageYOffset, line.z]}
                fontSize={frontFontSize}
                color={line.isCurrent ? '#f8fafc' : '#cbd5f5'}
                opacity={line.opacity}
                align={line.isLeft ? 'left' : 'right'}
                scale={line.scale}
                depthTest={true}      // 启用深度测试，参与遮挡计算
                depthWrite={true}     // 启用深度写入，影响后续渲染
                renderOrder={line.renderOrder}
                orientation="vertical"
                verticalAlign={line.verticalAlign}
                fontFamily={fontFamily}
                fontSizeMultiplier={fontSize}
                edgeFeather={line.edgeFeather}
              />
            ))}
          </group>
        </Suspense>
      </Canvas>
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
