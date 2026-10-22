import { useState, useEffect, useCallback, useRef } from 'react';
import timelineStore from '@/stores/timelineStore';

/**
 * 滚动速度管理Hook
 * 用于整合LyricsController的滚动事件和3D模型旋转控制
 */
export function useScrollVelocity(publishState = true) {
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [externalVelocity, setExternalVelocity] = useState(0);
  const rafIdRef = useRef<number | null>(null);
  const internalRef = useRef(0);
  const externalRef = useRef(0);
  const lastEmitRef = useRef(0);
  const lastPublishedRef = useRef(0);
  const velocityRef = useRef(0);
  const rotationVelocityRef = useRef(0);
  const wakeRef = useRef(() => {});

  // 处理来自LyricsController的滚动速度变化
  const handleScrollVelocityChange = useCallback((velocity: number, rotationImpulse = velocity) => {
    externalRef.current = velocity;
    rotationVelocityRef.current = rotationImpulse;
    velocityRef.current = internalRef.current + velocity;
    timelineStore.setScrollVelocity(velocityRef.current, false);
    wakeRef.current();
    if (velocity === 0) {
      // A gesture release must publish zero even if the decay loop is idle.
      // Comparing against the effect's initial state used to leave a nonzero
      // velocity permanently published after the underlying ref reached zero.
      lastPublishedRef.current = internalRef.current;
      if (publishState) {setExternalVelocity(0); setScrollVelocity(internalRef.current);}
      timelineStore.setScrollVelocity(internalRef.current, false);
    }
  }, [publishState]);

  // 速度衰减（基于 requestAnimationFrame，避免20Hz步进）
  useEffect(() => {
    const step = () => {
      rafIdRef.current = null;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const nextInternal = Math.abs(internalRef.current) < 0.0005 ? 0 : internalRef.current * 0.95;
      const nextExternal = Math.abs(externalRef.current) < 0.0005 ? 0 : externalRef.current * 0.9;
      rotationVelocityRef.current = Math.abs(rotationVelocityRef.current) < .0005 ? 0 : rotationVelocityRef.current * .9;
      internalRef.current = nextInternal;
      externalRef.current = nextExternal;

      // 每帧将合并速度发布到 timelineStore（不触发订阅者重渲染）
      const totalNext = nextInternal + nextExternal;
      velocityRef.current = totalNext;
      timelineStore.setScrollVelocity(totalNext, false);

      // 限频与阈值：仅在必要时同步到state，减少3D重渲染
      const emitIntervalMs = 33; // ~30Hz
      const totalPrev = lastPublishedRef.current;
      const changedEnough = Math.abs(totalNext - totalPrev) > 0.001 || (totalNext === 0 && totalPrev !== 0);
      if (publishState && changedEnough && (now - lastEmitRef.current >= emitIntervalMs || totalNext === 0)) {
        lastEmitRef.current = now;
        lastPublishedRef.current = totalNext;
        setScrollVelocity(nextInternal);
        setExternalVelocity(nextExternal);
      }

      if (nextInternal || nextExternal || rotationVelocityRef.current) rafIdRef.current = requestAnimationFrame(step);
    };

    wakeRef.current = () => {
      if (rafIdRef.current === null && (internalRef.current || externalRef.current || rotationVelocityRef.current)) rafIdRef.current = requestAnimationFrame(step);
    };
    wakeRef.current();
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      wakeRef.current = () => {};
    };
  }, [publishState]);

  // 合并内部和外部速度
  const totalVelocity = scrollVelocity + externalVelocity;
  const setInternalScrollVelocity = useCallback((value: number | ((previous: number) => number)) => {
    internalRef.current = typeof value === 'function' ? value(internalRef.current) : value;
    velocityRef.current = internalRef.current + externalRef.current;
    timelineStore.setScrollVelocity(velocityRef.current, false);
    wakeRef.current();
  }, []);

  return {
    scrollVelocity: totalVelocity,
    scrollVelocityRef: velocityRef,
    rotationVelocityRef,
    handleScrollVelocityChange,
    setInternalScrollVelocity
  };
}
