"use client";

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { StackedLayoutProps } from './types';
import TopLyrics from './TopLyrics';
import BottomLyrics from './BottomLyrics';
import JadeModelLoader from '@/components/jade/JadeModelLoader';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';

/**
 * 三层 Canvas 叠加布局组件
 * 实现歌词和模型的分层渲染
 * 注意：滚动控制由隐藏的LyricsController处理，此组件专注于渲染
 */
export default function StackedLyricsAndModel(props: StackedLayoutProps) {
  const { scrollTime, duration, lyrics, onSeek, onScrollVelocityChange } = props;
  const [midOpacity, setMidOpacity] = useState(1.0);
  const middleCanvasRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollTopRef = useRef(0);
  const isInitializedRef = useRef(false);

  // 使用平滑滚动hook
  const { isScrolling, scrollToTime, scrollContainerRef, cleanup } = useSmoothScroll();

  // 计算当前行索引
  const findCurrentLineIndex = useCallback((lyricLines: any[], time: number, durationParam: number): number => {
    if (!lyricLines || lyricLines.length === 0) return -1;
    const base = Math.max(1, durationParam || 364);
    const loopTime = time % base;
    let lineIndex = -1;
    for (let i = 0; i < lyricLines.length; i++) {
      if (lyricLines[i].time <= loopTime) {
        lineIndex = i;
      } else {
        break;
      }
    }
    return lineIndex;
  }, []);

  // 初始化滚动位置到第三轮
  useEffect(() => {
    if (scrollContainerRef.current && !isInitializedRef.current) {
      const scroller = scrollContainerRef.current;

      // 设置初始时间到第三轮开始位置
      const initialTime = duration * 2; // 第三轮开始
      const scrollHeight = scroller.scrollHeight - scroller.clientHeight;
      const timeProgress = (initialTime % duration) / duration;
      const targetScrollTop = timeProgress * scrollHeight;

      // 平滑滚动到初始位置
      scrollToTime(scroller, initialTime, duration, scrollTime, {
        duration: 800, // 稍长的初始化动画
        easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      });

      isInitializedRef.current = true;
    }
  }, [duration, scrollTime, scrollToTime]);

  // 同步滚动位置到当前时间（使用平滑滚动）
  useEffect(() => {
    if (scrollContainerRef.current && !isUserScrollingRef.current && isInitializedRef.current) {
      const scroller = scrollContainerRef.current;

      // 使用平滑滚动同步到当前时间
      scrollToTime(scroller, scrollTime, duration, scrollTime, {
        duration: 200, // 快速同步
        easing: (t: number) => t // Linear for time sync
      });
    }
  }, [scrollTime, duration, isUserScrollingRef.current, isInitializedRef.current, scrollToTime]);

  // 传统滚动处理（带平滑动画）
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const scroller = event.currentTarget;
    const currentTop = scroller.scrollTop;

    if (!isUserScrollingRef.current) {
      isUserScrollingRef.current = true;
    }

    // 计算滚动速度
    const scrollDelta = currentTop - lastScrollTopRef.current;
    const velocity = scrollDelta;
    onScrollVelocityChange(velocity);
    lastScrollTopRef.current = currentTop;

    // 清除之前的计时器
    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current);
    }

    // 设置新的计时器
    scrollEndTimerRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 150);

    // 根据滚动位置计算时间
    const scrollHeight = scroller.scrollHeight - scroller.clientHeight;
    const scrollProgress = scrollHeight > 0 ? currentTop / scrollHeight : 0;

    // 将滚动进度转换为时间
    const loopTime = scrollProgress * duration;
    const currentLoop = Math.floor(scrollTime / duration);
    const newTime = currentLoop * duration + loopTime;

    // 调用 onSeek 来更新时间
    onSeek(newTime);
  }, [scrollTime, duration, onSeek, onScrollVelocityChange]);

  // 清理动画
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <div className="relative w-full" style={{ height: '80vh' }}>
      {/* Bottom Layer: 后层歌词 */}
      <div className="absolute inset-0">
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
        className="absolute inset-0"
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
              // 旋转控制增强参数
              maxAngularVelocity={1.5} // 降低最大角速度防止过快旋转
              enableDamping={true} // 启用阻尼系统
              dampingFactor={0.92} // 阻尼系数，越高阻尼越强
              velocitySmoothing={0.15} // 速度平滑系数，防止突变
              maxRotationPerFrame={0.08} // 每帧最大旋转限制
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

      {/* Top Layer: 前层歌词 */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
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

      {/* Hidden Scroll Layer: 传统滚动行为驱动 */}
      <div
        ref={scrollContainerRef}
        className="absolute inset-0 opacity-0 pointer-events-auto overflow-y-auto"
        style={{ zIndex: 10 }}
        onScroll={handleScroll}
      >
        <div style={{ height: '300vh' }}>
          {/* 生成虚拟歌词内容用于滚动 */}
          {Array.from({ length: Math.floor(lyrics.length * 3) }, (_, index) => {
            const lyricIndex = index % lyrics.length;
            const lyric = lyrics[lyricIndex];
            return (
              <div
                key={index}
                style={{
                  height: '60px',
                  padding: '20px',
                  fontSize: '16px',
                  color: 'transparent',
                  userSelect: 'none'
                }}
              >
                {lyric?.text || ''}
              </div>
            );
          })}
        </div>
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