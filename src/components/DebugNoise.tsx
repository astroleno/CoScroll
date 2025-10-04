"use client";

import React, { useState, useEffect } from 'react';

/**
 * 调试噪点组件
 * 用于调试噪点效果是否正常工作
 */
interface DebugNoiseProps {
  intensity?: number;        // 噪点强度 (0-1)
  opacity?: number;         // 整体透明度
  animated?: boolean;       // 是否动画
  className?: string;       // CSS 类名
}

export default function DebugNoise({
  intensity = 0.5,
  opacity = 0.8,
  animated = true,
  className = ''
}: DebugNoiseProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [time, setTime] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    console.log('噪点组件已加载，参数:', { intensity, opacity, animated });
  }, [intensity, opacity, animated]);

  useEffect(() => {
    if (animated) {
      const interval = setInterval(() => {
        setTime(prev => prev + 1);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [animated]);

  if (!isVisible) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-red-500 text-white p-2 rounded">
        噪点组件加载中...
      </div>
    );
  }

  return (
    <>
      {/* 调试信息 */}
      <div className="fixed top-4 right-4 z-50 bg-black/80 text-white p-2 rounded text-xs">
        <div>噪点强度: {intensity}</div>
        <div>透明度: {opacity}</div>
        <div>动画: {animated ? '开启' : '关闭'}</div>
        <div>时间: {time}</div>
      </div>

      {/* 噪点效果 */}
      <div 
        className={`fixed inset-0 pointer-events-none z-40 ${className}`}
        style={{ 
          opacity: opacity,
          background: `
            radial-gradient(circle at 20% 20%, rgba(255,255,255,${intensity}) 2px, transparent 2px),
            radial-gradient(circle at 40% 40%, rgba(255,255,255,${intensity}) 2px, transparent 2px),
            radial-gradient(circle at 60% 60%, rgba(255,255,255,${intensity}) 2px, transparent 2px),
            radial-gradient(circle at 80% 80%, rgba(255,255,255,${intensity}) 2px, transparent 2px),
            radial-gradient(circle at 10% 90%, rgba(255,255,255,${intensity}) 2px, transparent 2px),
            radial-gradient(circle at 90% 10%, rgba(255,255,255,${intensity}) 2px, transparent 2px),
            radial-gradient(circle at 30% 70%, rgba(255,255,255,${intensity}) 2px, transparent 2px),
            radial-gradient(circle at 70% 30%, rgba(255,255,255,${intensity}) 2px, transparent 2px),
            radial-gradient(circle at 50% 10%, rgba(255,255,255,${intensity}) 2px, transparent 2px),
            radial-gradient(circle at 10% 50%, rgba(255,255,255,${intensity}) 2px, transparent 2px)
          `,
          backgroundSize: '50px 50px, 60px 60px, 40px 40px, 70px 70px, 30px 30px, 80px 80px, 45px 45px, 55px 55px, 35px 35px, 65px 65px',
          animation: animated ? 'noise 2s steps(4) infinite' : 'none'
        }}
      >
        <style jsx>{`
          @keyframes noise {
            0% { 
              transform: translate(0, 0);
              filter: brightness(1);
            }
            25% { 
              transform: translate(-2px, -2px);
              filter: brightness(1.2);
            }
            50% { 
              transform: translate(2px, -2px);
              filter: brightness(0.8);
            }
            75% { 
              transform: translate(-2px, 2px);
              filter: brightness(1.1);
            }
            100% { 
              transform: translate(0, 0);
              filter: brightness(1);
            }
          }
        `}</style>
      </div>
    </>
  );
}
