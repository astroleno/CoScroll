import { useState, useEffect, useCallback } from 'react';

/**
 * 滚动速度管理Hook
 * 用于整合LyricsController的滚动事件和3D模型旋转控制
 */
export function useScrollVelocity() {
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [externalVelocity, setExternalVelocity] = useState(0);

  // 处理来自LyricsController的滚动速度变化
  const handleScrollVelocityChange = useCallback((velocity: number) => {
    setExternalVelocity(velocity);
  }, []);

  // 速度衰减
  useEffect(() => {
    const interval = setInterval(() => {
      setScrollVelocity(prev => prev * 0.95);
      setExternalVelocity(prev => prev * 0.9);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // 合并内部和外部速度
  const totalVelocity = scrollVelocity + externalVelocity;

  return {
    scrollVelocity: totalVelocity,
    handleScrollVelocityChange,
    setInternalScrollVelocity: setScrollVelocity
  };
}