/**
 * LyricRenderer - 歌词渲染组件
 * 负责渲染歌词列表，支持无限循环和虚拟滚动
 */

'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

interface Lyric {
  time: number;
  text: string;
  anchor: string;
}

interface LyricRendererProps {
  lyrics: Lyric[];
  currentIndex: number;
  containerRef: React.RefObject<HTMLDivElement>;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  onLyricClick?: (index: number) => void;
  className?: string;
}

export const LyricRenderer: React.FC<LyricRendererProps> = ({
  lyrics,
  currentIndex,
  containerRef,
  onScroll,
  onLyricClick,
  className = ''
}) => {
  const lyricRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  // 行高配置
  const LINE_HEIGHT = 3.2; // rem
  const VISIBLE_LINES = 5;
  const BUFFER_LINES = 3; // 缓冲行数

  // 创建虚拟歌词列表（原始 + 克隆）
  const virtualLyrics = useMemo(() => {
    if (!lyrics.length) return [];
    return [...lyrics, ...lyrics]; // 原始 + 克隆
  }, [lyrics]);

  // 计算可见范围
  const calculateVisibleRange = useCallback(() => {
    const start = Math.max(0, currentIndex - BUFFER_LINES);
    const end = Math.min(virtualLyrics.length, currentIndex + VISIBLE_LINES + BUFFER_LINES);
    return { start, end };
  }, [currentIndex, virtualLyrics.length]);

  // 更新可见范围
  useEffect(() => {
    const newRange = calculateVisibleRange();
    setVisibleRange(newRange);
  }, [currentIndex, calculateVisibleRange]);

  // 初始化 lyricRefs
  useEffect(() => {
    lyricRefs.current = new Array(virtualLyrics.length).fill(null);
  }, [virtualLyrics.length]);

  // 滚动到当前歌词
  const scrollToCurrentLyric = useCallback(() => {
    const container = containerRef.current;
    const currentLyricElement = lyricRefs.current[currentIndex];

    if (!container || !currentLyricElement || !isInitialized) {
      return;
    }

    const containerHeight = container.clientHeight;
    const containerCenter = containerHeight / 2;
    const targetOffset = currentLyricElement.offsetTop - containerCenter;

    container.scrollTo({
      top: targetOffset,
      behavior: 'auto'
    });
  }, [currentIndex, containerRef, isInitialized]);

  // 组件挂载后初始化
  useEffect(() => {
    if (lyrics.length > 0 && !isInitialized) {
      setIsInitialized(true);
      // 延迟滚动到初始位置
      setTimeout(scrollToCurrentLyric, 100);
    }
  }, [lyrics.length, isInitialized, scrollToCurrentLyric]);

  // 当前歌词变化时滚动
  useEffect(() => {
    if (isInitialized) {
      scrollToCurrentLyric();
    }
  }, [currentIndex, isInitialized, scrollToCurrentLyric]);

  // 获取歌词样式类名
  const getLyricClassName = useCallback((index: number) => {
    const originalIndex = index % lyrics.length;
    const distance = Math.abs(originalIndex - currentIndex);

    // 当前歌词
    if (originalIndex === currentIndex) {
      return 'lyric-line current';
    }

    // 相邻歌词
    if (distance === 1) {
      return 'lyric-line adjacent';
    }

    // 次相邻歌词
    if (distance === 2) {
      return 'lyric-line near';
    }

    // 远距离歌词
    return 'lyric-line distant';
  }, [currentIndex, lyrics.length]);

  // 处理歌词点击
  const handleLyricClick = useCallback((event: React.MouseEvent<HTMLParagraphElement>, index: number) => {
    event.preventDefault();
    const originalIndex = index % lyrics.length;
    if (onLyricClick) {
      onLyricClick(originalIndex);
    }
  }, [lyrics.length, onLyricClick]);

  // 渲染歌词行
  const renderLyricLine = useCallback((lyric: Lyric, index: number, isOriginal: boolean) => {
    const originalIndex = index % lyrics.length;
    const isActive = originalIndex === currentIndex;
    const className = getLyricClassName(index);

    return (
      <p
        key={`${isOriginal ? 'original' : 'duplicate'}-${lyric.time}-${index}`}
        ref={element => {
          lyricRefs.current[index] = element;
        }}
        data-lyric-index={originalIndex}
        data-cycle={isOriginal ? '0' : '1'}
        className={className}
        onClick={(e) => handleLyricClick(e, index)}
        role="button"
        tabIndex={0}
        aria-label={`歌词: ${lyric.text}`}
        aria-current={isActive}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleLyricClick(e as any, index);
          }
        }}
      >
        {lyric.text || '♪'}
      </p>
    );
  }, [
    currentIndex,
    lyrics.length,
    getLyricClassName,
    handleLyricClick
  ]);

  if (!lyrics.length) {
    return (
      <div className={`lyric-renderer empty ${className}`}>
        <div className="empty-state">
          <p>暂无歌词内容</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`lyric-renderer ${className}`}>
      {/* 顶部占位空间 */}
      <div className="spacer-top" />

      {/* 歌词列表 */}
      <div className="lyric-list">
        {/* 原始歌词 */}
        {lyrics.map((lyric, index) =>
          renderLyricLine(lyric, index, true)
        )}

        {/* 克隆歌词（无限循环视觉效果） */}
        {lyrics.map((lyric, index) =>
          renderLyricLine(lyric, index + lyrics.length, false)
        )}
      </div>

      {/* 底部占位空间 */}
      <div className="spacer-bottom" />

      <style jsx>{`
        .lyric-renderer {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .lyric-renderer.empty {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .empty-state {
          text-align: center;
          color: #6b7280;
        }

        .spacer-top,
        .spacer-bottom {
          height: calc(var(--visible-lines) / 2 * var(--line-height));
          min-height: calc(${VISIBLE_LINES} / 2 * ${LINE_HEIGHT}rem);
        }

        .lyric-list {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .lyric-line {
          line-height: var(--line-height);
          min-height: var(--line-height);
          padding: 0 1.25rem;
          margin: 0;
          width: 100%;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
          font-size: 1.125rem;
          font-weight: 400;
          border-radius: 0.5rem;
          transform-origin: center;
          outline: none;
        }

        /* 当前歌词样式 */
        .lyric-line.current {
          color: white;
          font-size: 1.25rem;
          font-weight: 600;
          transform: scale(1.05);
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          background: linear-gradient(
            135deg,
            rgba(244, 114, 182, 0.1),
            rgba(107, 114, 255, 0.1)
          );
          backdrop-filter: blur(8px);
        }

        /* 相邻歌词样式 */
        .lyric-line.adjacent {
          color: #e5e7eb;
          font-size: 1rem;
          opacity: 0.9;
          transform: scale(1.02);
        }

        /* 次相邻歌词样式 */
        .lyric-line.near {
          color: #9ca3af;
          font-size: 0.875rem;
          opacity: 0.7;
        }

        /* 远距离歌词样式 */
        .lyric-line.distant {
          color: #6b7280;
          font-size: 0.75rem;
          opacity: 0.5;
        }

        /* 悬停效果 */
        .lyric-line:hover {
          background: linear-gradient(
            135deg,
            rgba(244, 114, 182, 0.05),
            rgba(107, 114, 255, 0.05)
          );
          transform: scale(1.02);
          transition: all 0.2s ease-in-out;
        }

        .lyric-line.current:hover {
          transform: scale(1.08);
        }

        /* 焦点样式 */
        .lyric-line:focus-visible {
          outline: 2px solid rgba(244, 114, 182, 0.5);
          outline-offset: 2px;
          background: linear-gradient(
            135deg,
            rgba(244, 114, 182, 0.15),
            rgba(107, 114, 255, 0.15)
          );
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
          .lyric-line {
            font-size: 1rem;
            padding: 0 1rem;
          }

          .lyric-line.current {
            font-size: 1.125rem;
          }

          .lyric-line.adjacent {
            font-size: 0.875rem;
          }
        }

        @media (max-width: 480px) {
          .lyric-line {
            font-size: 0.875rem;
            padding: 0 0.75rem;
          }

          .lyric-line.current {
            font-size: 1rem;
          }
        }

        /* 高对比度模式 */
        @media (prefers-contrast: high) {
          .lyric-line.current {
            color: #ffffff;
            background: rgba(0, 0, 0, 0.8);
            border: 1px solid #ffffff;
          }

          .lyric-line:hover {
            background: rgba(0, 0, 0, 0.6);
          }
        }

        /* 减少动画模式 */
        @media (prefers-reduced-motion: reduce) {
          .lyric-line {
            transition: color 0.2s ease-in-out, background-color 0.2s ease-in-out;
          }

          .lyric-line.current {
            transform: none;
          }
        }

        /* 深色模式支持 */
        @media (prefers-color-scheme: light) {
          .lyric-line.distant {
            color: #9ca3af;
          }

          .lyric-line.near {
            color: #6b7280;
          }

          .lyric-line.adjacent {
            color: #374151;
          }

          .lyric-line.current {
            color: #111827;
            text-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
          }
        }

        /* CSS变量定义 */
        :global(.lyrics-wrapper) {
          --visible-lines: ${VISIBLE_LINES};
          --line-height: ${LINE_HEIGHT}rem;
        }
      `}</style>
    </div>
  );
};