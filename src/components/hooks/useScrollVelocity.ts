import { useState, useEffect, useCallback, useRef } from 'react';
import timelineStore from '@/stores/timelineStore';

/**
 * 滚动速度管理Hook
 * 用于整合LyricsController的滚动事件和3D模型旋转控制
 */
export function useScrollVelocity() {
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [externalVelocity, setExternalVelocity] = useState(0);
  const rafIdRef = useRef<number | null>(null);
  const internalRef = useRef(0);
  const externalRef = useRef(0);
  const lastEmitRef = useRef(0);

  // 处理来自LyricsController的滚动速度变化
  const handleScrollVelocityChange = useCallback((velocity: number) => {
    externalRef.current = velocity;
  }, []);

  // 速度衰减（基于 requestAnimationFrame，避免20Hz步进）
  useEffect(() => {
    const step = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const nextInternal = Math.abs(internalRef.current) < 0.0005 ? 0 : internalRef.current * 0.95;
      const nextExternal = Math.abs(externalRef.current) < 0.0005 ? 0 : externalRef.current * 0.9;
      internalRef.current = nextInternal;
      externalRef.current = nextExternal;

      // 每帧将合并速度发布到 timelineStore（不触发订阅者重渲染）
      const totalNext = nextInternal + nextExternal;
      timelineStore.setScrollVelocity(totalNext, false);

      // 限频与阈值：仅在必要时同步到state，减少3D重渲染
      const emitIntervalMs = 33; // ~30Hz
      const totalPrev = scrollVelocity + externalVelocity;
      const changedEnough = Math.abs(totalNext - totalPrev) > 0.001;
      if (changedEnough && now - lastEmitRef.current >= emitIntervalMs) {
        lastEmitRef.current = now;
        setScrollVelocity(nextInternal);
        setExternalVelocity(nextExternal);
      }

      rafIdRef.current = requestAnimationFrame(step);
    };

    rafIdRef.current = requestAnimationFrame(step);
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, []);

  // 合并内部和外部速度
  const totalVelocity = scrollVelocity + externalVelocity;

  return {
    scrollVelocity: totalVelocity,
    handleScrollVelocityChange,
    setInternalScrollVelocity: setScrollVelocity
  };
}
