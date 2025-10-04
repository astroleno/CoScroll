"use client";

import React, { useEffect, useState } from 'react';

/**
 * CSS噪点组件
 * 使用CSS和伪元素实现明显的噪点效果
 */
interface CSSNoiseProps {
  intensity?: number;        // 噪点强度 (0-1)
  opacity?: number;         // 整体透明度
  animated?: boolean;       // 是否动画
  className?: string;       // CSS 类名
}

export default function CSSNoise({
  intensity = 0.1,
  opacity = 0.3,
  animated = true,
  className = ''
}: CSSNoiseProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  if (!isLoaded) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 pointer-events-none z-50 ${className}`}
      style={{ 
        opacity: opacity,
        background: `
          radial-gradient(circle at 20% 20%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 40% 40%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 60% 60%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 80% 80%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 10% 90%, rgba(255,255,255,${intensity}) 1px, transparent 1px),
          radial-gradient(circle at 90% 10%, rgba(255,255,255,${intensity}) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px, 30px 30px, 40px 40px, 60px 60px, 20px 20px, 70px 70px',
        animation: animated ? 'noise 0.5s steps(8) infinite' : 'none'
      }}
    >
      <style jsx>{`
        @keyframes noise {
          0% { transform: translate(0, 0); }
          10% { transform: translate(-5px, -5px); }
          20% { transform: translate(-10px, 5px); }
          30% { transform: translate(5px, -10px); }
          40% { transform: translate(-5px, 10px); }
          50% { transform: translate(10px, -5px); }
          60% { transform: translate(-10px, -10px); }
          70% { transform: translate(5px, 5px); }
          80% { transform: translate(-5px, -5px); }
          90% { transform: translate(10px, 10px); }
          100% { transform: translate(0, 0); }
        }
      `}</style>
    </div>
  );
}
