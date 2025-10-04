"use client";

import React from 'react';

/**
 * 可见噪点组件
 * 使用纯CSS实现明显的噪点效果
 */
interface VisibleNoiseProps {
  intensity?: number;        // 噪点强度 (0-1)
  opacity?: number;         // 整体透明度
  animated?: boolean;       // 是否动画
  className?: string;       // CSS 类名
}

export default function VisibleNoise({
  intensity = 0.2,
  opacity = 0.5,
  animated = true,
  className = ''
}: VisibleNoiseProps) {
  return (
    <div 
      className={`fixed inset-0 pointer-events-none z-50 ${className}`}
      style={{ 
        opacity: opacity,
        background: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255,255,255,${intensity}) 2px,
            rgba(255,255,255,${intensity}) 4px
          ),
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 2px,
            rgba(255,255,255,${intensity}) 2px,
            rgba(255,255,255,${intensity}) 4px
          )
        `,
        backgroundSize: '20px 20px',
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
            filter: brightness(1.1);
          }
          50% { 
            transform: translate(2px, -2px);
            filter: brightness(0.9);
          }
          75% { 
            transform: translate(-2px, 2px);
            filter: brightness(1.05);
          }
          100% { 
            transform: translate(0, 0);
            filter: brightness(1);
          }
        }
      `}</style>
    </div>
  );
}
