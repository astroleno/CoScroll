/**
 * ProgressBar - 进度条组件
 * 显示播放进度，支持点击跳转和时间显示
 */

'use client';

import React, { useCallback, useRef, useEffect, useMemo } from 'react';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onProgressClick: (percentage: number) => void;
  className?: string;
  showTime?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentTime,
  duration,
  onProgressClick,
  className = '',
  showTime = true
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);

  // 格式化时间显示
  const formatTime = useCallback((time: number): string => {
    if (!Number.isFinite(time) || time < 0) return '0:00';

    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }, []);

  // 计算进度百分比
  const progressPercentage = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  // 处理进度条点击
  const handleProgressClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const clampedPercentage = Math.max(0, Math.min(1, percentage));

    onProgressClick(clampedPercentage);
  }, [duration, onProgressClick]);

  // 处理键盘导航
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!duration) return;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        const newPercentageLeft = Math.max(0, (currentTime - 5) / duration);
        onProgressClick(newPercentageLeft);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        const newPercentageRight = Math.min(1, (currentTime + 5) / duration);
        onProgressClick(newPercentageRight);
        break;
      case 'Home':
        event.preventDefault();
        onProgressClick(0);
        break;
      case 'End':
        event.preventDefault();
        onProgressClick(1);
        break;
    }
  }, [currentTime, duration, onProgressClick]);

  return (
    <div className={`progress-bar-container ${className}`}>
      {/* 进度条 */}
      <div
        ref={progressBarRef}
        className="progress-bar"
        onClick={handleProgressClick}
        onKeyDown={handleKeyDown}
        role="slider"
        tabIndex={0}
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
      >
        {/* 进度填充 */}
        <div
          className="progress-fill"
          style={{ width: `${progressPercentage}%` }}
        />

        {/* 进度指示器 */}
        <div
          className="progress-indicator"
          style={{ left: `${progressPercentage}%` }}
        />

        {/* 缓冲指示器（如果需要） */}
        <div className="progress-buffer" />
      </div>

      {/* 时间显示 */}
      {showTime && (
        <div className="time-display">
          <span className="current-time" aria-live="polite">
            {formatTime(currentTime)}
          </span>
          <span className="time-separator" aria-hidden="true">
            /
          </span>
          <span className="total-time">
            {formatTime(duration)}
          </span>
        </div>
      )}

      <style jsx>{`
        .progress-bar-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }

        .progress-bar {
          position: relative;
          width: 100%;
          height: 0.5rem;
          background: rgba(107, 114, 128, 0.3);
          border-radius: 0.25rem;
          cursor: pointer;
          overflow: hidden;
          transition: height 0.2s ease-in-out;
        }

        .progress-bar:hover {
          height: 0.75rem;
        }

        .progress-bar:focus-visible {
          outline: 2px solid rgba(244, 114, 182, 0.5);
          outline-offset: 2px;
        }

        .progress-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: linear-gradient(
            90deg,
            rgb(244, 114, 182),
            rgb(167, 139, 250)
          );
          border-radius: 0.25rem;
          transition: width 0.1s ease-in-out;
          will-change: width;
        }

        .progress-indicator {
          position: absolute;
          top: 50%;
          width: 1rem;
          height: 1rem;
          background: white;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow:
            0 0 0 2px rgba(244, 114, 182, 0.5),
            0 2px 8px rgba(0, 0, 0, 0.3);
          transition: left 0.1s ease-in-out, transform 0.2s ease-in-out;
          opacity: 0;
        }

        .progress-bar:hover .progress-indicator,
        .progress-bar:focus .progress-indicator {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.2);
        }

        .progress-buffer {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: rgba(107, 114, 128, 0.2);
          border-radius: 0.25rem;
          width: 0%; /* 可以根据音频缓冲情况设置 */
          transition: width 0.3s ease-in-out;
        }

        .time-display {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
          font-size: 0.875rem;
          font-weight: 500;
          color: #9ca3af;
        }

        .current-time {
          color: #e5e7eb;
          font-weight: 600;
        }

        .time-separator {
          color: #6b7280;
          user-select: none;
        }

        .total-time {
          color: #9ca3af;
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
          .progress-bar-container {
            gap: 0.375rem;
          }

          .progress-bar {
            height: 0.375rem;
          }

          .progress-bar:hover {
            height: 0.5rem;
          }

          .progress-indicator {
            width: 0.75rem;
            height: 0.75rem;
          }

          .time-display {
            font-size: 0.75rem;
          }
        }

        /* 高对比度模式 */
        @media (prefers-contrast: high) {
          .progress-bar {
            background: #374151;
            border: 1px solid #6b7280;
          }

          .progress-fill {
            background: #10b981;
          }

          .progress-indicator {
            background: #ffffff;
            border: 2px solid #10b981;
          }

          .current-time {
            color: #ffffff;
          }

          .total-time {
            color: #d1d5db;
          }
        }

        /* 减少动画模式 */
        @media (prefers-reduced-motion: reduce) {
          .progress-fill,
          .progress-indicator,
          .progress-buffer {
            transition: none;
          }

          .progress-bar:hover {
            height: 0.5rem;
          }
        }

        /* 深色模式支持 */
        @media (prefers-color-scheme: light) {
          .progress-bar {
            background: rgba(156, 163, 175, 0.3);
          }

          .current-time {
            color: #111827;
          }

          .time-separator {
            color: #6b7280;
          }

          .total-time {
            color: #6b7280;
          }
        }

        /* 触摸设备优化 */
        @media (hover: none) and (pointer: coarse) {
          .progress-bar {
            height: 0.75rem;
          }

          .progress-indicator {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.1);
          }
        }
      `}</style>
    </div>
  );
};

