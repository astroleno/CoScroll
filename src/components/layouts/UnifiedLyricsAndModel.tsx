"use client";
import { assetUrl } from '@/utils/assetUrl';


import React, { Suspense, memo, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { UnifiedLayoutProps } from './types';
import LayeredLyricsScene from './LayeredLyricsScene';
import type { LyricMotionInput } from './lyricMotion';
import JadeModelLoader from '@/components/jade/JadeModelLoader';
import type { LyricLine } from '@/types';
import type { ScenePalette } from '@/config/appearance';
import { PALETTES } from '@/config/appearance';
import { DEFAULT_PROJECT_CONFIG } from '@/config/defaults';
import { resolveAnchor } from '@/config/resolveAnchor';
import TransmissionRegionRendering from '@/rendering/TransmissionRegionRendering';

const MemoizedJadeModel = memo(JadeModelLoader);

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
  sceneKey?: number;
  modelPath?: string;
  palette?: ScenePalette;
  onModelDisplayed?: (path: string) => void;
  onModelError?: (path: string) => void;
  /** Keep the warm scene mounted without rendering it behind the cover. */
  active?: boolean;
  scrollTimeRef?: { readonly current: number };
  scrollVelocityRef?: { readonly current: number };
  rotationVelocityRef?: { readonly current: number };
  seekRevision?: number;
  /** 可选：歌词渲染使用的字体族（需在页面注册 @font-face） */
  fontFamily?: string;
  /** 可选：字体大小倍数 */
  fontSize?: number;
  /** 字体加载完成后的修订号，用于刷新纹理 */
  fontRevision?: number;
}

function UnifiedLyricsAndModel(props: UnifiedLyricsAndModelProps) {
  const {
    scrollTime,
    duration,
    lyrics,
    currentAnchor,
    scrollVelocity,
    fontFamily,
    fontSize = 1.0,
    fontRevision = 0,
    isPreviewMode = false,
    isPlaying = true,
    active = true,
    scrollTimeRef,
    scrollVelocityRef,
    rotationVelocityRef,
    seekRevision,
    modelPath = resolveAnchor(currentAnchor, DEFAULT_PROJECT_CONFIG).modelPath,
    palette = PALETTES['original-jade'].colors,
    onModelDisplayed,
    onModelError,
    sceneKey = 0,
  } = props;
  const lyricData = (lyrics || []) as LyricLine[];

  const inputRef = useRef<LyricMotionInput>({scrollTime, scrollTimeRef, duration,
    velocity: scrollVelocity, velocityRef: scrollVelocityRef, isPreviewMode, isPlaying, seekRevision});
  inputRef.current = {scrollTime, scrollTimeRef, duration, velocity: scrollVelocity, velocityRef: scrollVelocityRef, isPreviewMode, isPlaying, seekRevision};

  const isMobile = typeof navigator !== 'undefined'
    ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    : false;
  const [compactHeight, setCompactHeight] = useState(() => typeof window !== 'undefined' && window.innerHeight < 667);
  useEffect(() => {
    const resize = () => setCompactHeight(window.innerHeight < 667);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const isCompactMobile = isMobile && compactHeight;

  // 歌词分层配置 - 正交相机下的遮挡、竖排布局
  const lyricsConfig = useMemo(() => ({
    range: 6,
    horizontalOffset: isMobile ? 1.6 : 1.85,
    verticalSpacing: isMobile ? 1.1 : 1.26,
    movementAxis: 'horizontal' as const,
    travelSpacing: isMobile ? 0.85 : 1.0,
    laneSeparation: isMobile ? 0.65 : 0.85,
    topLaneY: isMobile ? 2.1 : 2.8,
    bottomLaneY: isMobile ? -2.05 : -2.7,
    // 正交相机中：Z 越大越靠近相机
    frontDepth: 6.0,
    backNearDepth: -2.2,
    backFarDepth: -3.5,
    edgeFeatherStart: isMobile ? 0.34 : 0.28,
    edgeFadeStart: isMobile ? 0.52 : 0.48,
    edgeFeatherExponent: isMobile ? 1.05 : 0.85,
  }), [isMobile]);

  // 字体大小配置
  const baseFontScale = isMobile ? (isCompactMobile ? 0.48 : 0.54) : 0.6;
  const frontFontSize = baseFontScale * fontSize;
  const backFontSize = baseFontScale * fontSize;
  const baseModelScale = isMobile ? 2.2 : 2.8;
  // 在现有基础上再放大 1.1 倍
  const modelScale = baseModelScale * 1.2 * 1.1;
  const lyricsYOffset = isMobile ? (isCompactMobile ? -0.52 : -0.6) : -0.82;
  const modelYOffset = lyricsYOffset * 0.5;
  const edgeMask = useMemo(() => {
    const edgePercent = isMobile ? 18 : 12;
    const left = `${edgePercent}%`;
    const right = `${100 - edgePercent}%`;
    return `linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) ${left}, rgba(0,0,0,1) ${right}, rgba(0,0,0,0) 100%)`;
  }, [isMobile]);

  return (
    <div className="relative flex items-center justify-center w-full h-full" style={{ minHeight: '60vh' }}>
      <div
        className="w-full h-full"
        style={{
          WebkitMaskImage: edgeMask as any,
          maskImage: edgeMask as any,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%'
        }}
      >
      <Canvas
        frameloop={active ? 'always' : 'never'}
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
        <TransmissionRegionRendering />
        <Suspense fallback={null}>
          {/* 统一光照系统 */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[2, 2, 2]} intensity={1.2} />
          <pointLight position={[-2, 2, -2]} intensity={0.3} color={palette.light} />

          <LayeredLyricsScene
            key={sceneKey}
            lyrics={lyricData}
            inputRef={inputRef}
            options={lyricsConfig}
            frontFontSize={frontFontSize}
            backFontSize={backFontSize}
            yOffset={lyricsYOffset}
            fontFamily={fontFamily}
            fontRevision={fontRevision}
            currentColor={palette.currentText}
            adjacentColor={palette.adjacentText}
          />

          {/* 3D模型 - 中间层，Z轴在0，遮挡后层歌词 */}
          <group renderOrder={2000} position={[0, modelYOffset, 0]} scale={[modelScale, modelScale, modelScale]}>
            <MemoizedJadeModel
              rotationRevision={sceneKey}
              modelPath={modelPath}
              onModelDisplayed={onModelDisplayed}
              onModelError={onModelError}
              fitToView={false}
              enableRotation
              rotationDurationSec={8}
              direction={-1}
              enableScrollControl
              baseSpeed={-0.32}
              speedMultiplier={-7.5}
              externalVelocity={scrollVelocity}
              controlledVelocityRef={rotationVelocityRef ?? scrollVelocityRef}
              maxAngularVelocity={8}
              enableDamping
              dampingFactor={0.92}
              velocitySmoothing={0.15}
              maxRotationPerFrame={0.18}
              environmentHdrPath={assetUrl("/textures/qwantani_moon_noon_puresky_1k.hdr")}
              environmentIntensity={1.0}
              background="transparent"
              showHdrBackground={false}
              innerColor={palette.jade}
              innerMetalness={1.0}
              innerRoughness={1.0}
              innerTransmission={0.0}
              enableEmissive
              innerEmissiveColor={palette.emissive}
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
              normalMapPath={assetUrl("/textures/normal.jpg")}
              normalScale={0.3}
              normalRepeat={3}
            />
          </group>

        </Suspense>
      </Canvas>
      </div>
    </div>
  );
}

// A live time ref already supplies each frame. Media time notifications should
// update the player without reconciling the whole Canvas four times a second.
export default memo(UnifiedLyricsAndModel, (previous, next) => {
  const live = previous.scrollTimeRef && previous.scrollTimeRef === next.scrollTimeRef;
  const keys = Object.keys(previous) as (keyof UnifiedLyricsAndModelProps)[];
  return keys.length === Object.keys(next).length && keys.every(key =>
    (live && (key === 'scrollTime' || key === 'currentTime')) || Object.is(previous[key], next[key]));
});
