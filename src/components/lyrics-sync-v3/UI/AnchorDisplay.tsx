/**
 * AnchorDisplay - 锚字显示组件
 * 负责显示当前歌词的锚字，具有呼吸动画和颜色变化效果
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';

interface AnchorDisplayProps {
  anchor: string;
  isVisible: boolean;
  onTransitionComplete?: () => void;
}

export const AnchorDisplay: React.FC<AnchorDisplayProps> = ({
  anchor,
  isVisible,
  onTransitionComplete
}) => {
  const [displayAnchor, setDisplayAnchor] = useState(anchor);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousAnchorRef = useRef(anchor);

  // 监听锚字变化
  useEffect(() => {
    if (previousAnchorRef.current !== anchor) {
      setIsTransitioning(true);

      // 延迟更新显示的锚字，创建过渡效果
      const timer = setTimeout(() => {
        setDisplayAnchor(anchor);
        setIsTransitioning(false);
        previousAnchorRef.current = anchor;

        if (onTransitionComplete) {
          onTransitionComplete();
        }
      }, 150); // 与CSS过渡时间匹配

      return () => clearTimeout(timer);
    }
  }, [anchor, onTransitionComplete]);

  // 监听可见性变化
  useEffect(() => {
    if (isVisible) {
      setDisplayAnchor(anchor);
    }
  }, [isVisible, anchor]);

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <div className="anchor-display">
        <span
          className={`anchor-character ${isTransitioning ? 'transitioning' : ''}`}
          aria-label={`当前锚字: ${displayAnchor}`}
        >
          {displayAnchor}
        </span>
      </div>

      <style jsx>{`
        .anchor-display {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          position: relative;
        }

        .anchor-character {
          display: inline-block;
          font-size: 20rem;
          line-height: 1;
          font-weight: 700;
          color: white;
          text-shadow:
            0 0 25px rgba(244, 114, 182, 0.3),
            0 0 60px rgba(107, 114, 255, 0.3);

          /* 呼吸动画 */
          animation: breath 8s ease-in-out infinite;

          /* 颜色变化动画 */
          animation: color-shift 15s ease-in-out infinite alternate, breath 8s ease-in-out infinite;

          /* 性能优化 */
          will-change: transform, opacity, text-shadow;
          transform: translateZ(0); /* 启用GPU加速 */

          /* 选择和用户交互 */
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;

          /* 过渡效果 */
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .anchor-character.transitioning {
          opacity: 0.3;
          transform: scale(0.95);
          filter: blur(2px);
        }

        /* 呼吸动画 */
        @keyframes breath {
          0%, 100% {
            transform: scale(1);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.03);
            opacity: 0.9;
          }
        }

        /* 颜色变化动画 */
        @keyframes color-shift {
          0% {
            text-shadow:
              0 0 25px rgba(244, 114, 182, 0.3),
              0 0 60px rgba(107, 114, 255, 0.3);
          }
          50% {
            text-shadow:
              0 0 30px rgba(107, 114, 255, 0.35),
              0 0 70px rgba(244, 114, 182, 0.35);
          }
          100% {
            text-shadow:
              0 0 25px rgba(244, 114, 182, 0.3),
              0 0 60px rgba(107, 114, 255, 0.3);
          }
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
          .anchor-character {
            font-size: 12rem;
          }
        }

        @media (max-width: 480px) {
          .anchor-character {
            font-size: 8rem;
          }
        }

        /* 高对比度模式支持 */
        @media (prefers-contrast: high) {
          .anchor-character {
            color: #ffffff;
            text-shadow:
              0 0 10px rgba(0, 0, 0, 0.8),
              0 0 20px rgba(0, 0, 0, 0.6);
          }
        }

        /* 减少动画模式支持 */
        @media (prefers-reduced-motion: reduce) {
          .anchor-character {
            animation: none;
            transition: opacity 0.2s ease-in-out;
          }
        }

        /* 深色模式支持 */
        @media (prefers-color-scheme: light) {
          .anchor-character {
            color: #1a1a1a;
            text-shadow:
              0 0 25px rgba(244, 114, 182, 0.4),
              0 0 60px rgba(107, 114, 255, 0.4);
          }
        }
      `}</style>
    </>
  );
};