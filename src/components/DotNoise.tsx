"use client";

import React from 'react';

/**
 * 点状噪点组件
 * 使用点状噪点实现明显的噪点效果
 */
interface DotNoiseProps {
  intensity?: number;        // 噪点强度 (0-1)
  opacity?: number;         // 整体透明度
  animated?: boolean;       // 是否动画
  className?: string;       // CSS 类名
}

export default function DotNoise({
  intensity = 0.3,
  opacity = 0.6,
  animated = true,
  className = ''
}: DotNoiseProps) {
  return (
    <div 
      className={`fixed inset-0 pointer-events-none z-50 ${className}`}
      style={{ 
        opacity: opacity,
        background: `
          radial-gradient(circle at 10% 20%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 30% 40%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 50% 10%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 70% 30%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 90% 50%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 20% 70%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 40% 90%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 60% 70%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 80% 90%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 15% 50%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 35% 80%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 55% 20%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 75% 60%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 95% 80%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 25% 10%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 45% 30%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 65% 50%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 85% 70%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 5% 60%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 95% 10%, rgba(255,255,255,${intensity}) 1px, transparent 1px)
        `,
        backgroundSize: '100px 100px, 80px 80px, 120px 120px, 90px 90px, 110px 110px, 70px 70px, 130px 130px, 85px 85px, 105px 105px, 95px 95px, 75px 75px, 115px 115px, 88px 88px, 108px 108px, 92px 92px, 78px 78px, 112px 112px, 86px 86px, 98px 98px, 102px 102px',
        animation: animated ? 'noise 3s steps(6) infinite' : 'none'
      }}
    >
      <style jsx>{`
        @keyframes noise {
          0% { 
            transform: translate(0, 0) rotate(0deg);
            filter: brightness(1);
          }
          16.66% { 
            transform: translate(-1px, -1px) rotate(1deg);
            filter: brightness(1.1);
          }
          33.33% { 
            transform: translate(1px, -1px) rotate(-1deg);
            filter: brightness(0.9);
          }
          50% { 
            transform: translate(-1px, 1px) rotate(0.5deg);
            filter: brightness(1.05);
          }
          66.66% { 
            transform: translate(1px, 1px) rotate(-0.5deg);
            filter: brightness(0.95);
          }
          83.33% { 
            transform: translate(-0.5px, -0.5px) rotate(0.3deg);
            filter: brightness(1.02);
          }
          100% { 
            transform: translate(0, 0) rotate(0deg);
            filter: brightness(1);
          }
        }
      `}</style>
    </div>
  );
}
