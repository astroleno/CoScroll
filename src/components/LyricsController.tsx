import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { LyricsControllerProps } from '@/types';

const findCurrentLineIndex = (lyricLines: any[], time: number, durationParam: number): number => {
  if (!lyricLines || lyricLines.length === 0) return -1;
  const base = Math.max(1, durationParam || durationParam);
  const loopTimeRaw = time % base;
  // 轻微滞后，避免高亮提前抖动
  const epsilon = 0.06;
  const loopTime = Math.max(0, loopTimeRaw - epsilon);
  let lo = 0;
  let hi = lyricLines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lyricLines[mid].time <= loopTime) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
};

const LyricsController: React.FC<LyricsControllerProps> = ({
  lyrics,
  currentTime,
  duration,
  scrollTime,
  onSeek,
  isPlaying,
  isPreviewMode = false,
  onScrollVelocityChange,
  onActiveLineChange,
  onPreviewStart,
  onPreviewTime,
  onPreviewEnd,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const isUserInteractingRef = useRef(false);
  const interactionEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeekTimeRef = useRef<number>(0);
  const lastAutoScrollIndexRef = useRef<number>(-1);
  const programmaticScrollRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const scrollDirectionRef = useRef<-1 | 0 | 1>(0);
  const pointerInteractionRef = useRef(false);
  const previewActiveRef = useRef(false);
  const lastLoopFromScrollRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null);
  const seekAnimationFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const userPriorityUntilRef = useRef<number>(0); // 用户优先权：交互后保护期内禁止自动滚动覆盖
  const antiAutoScrollUntilRef = useRef<number>(0); // seek 后短暂禁止自动滚动覆盖
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const releaseProgrammaticScroll = useCallback(() => {
    programmaticScrollRef.current = false;
    if (programmaticReleaseTimerRef.current) {
      clearTimeout(programmaticReleaseTimerRef.current);
      programmaticReleaseTimerRef.current = null;
    }
  }, []);

  const [isInitialized, setIsInitialized] = useState(false);

  // 高亮计算：必须使用 scrollTime，保证和显示的轮次一致
  const currentLineIndex = useMemo(() => {
    if (!isInitialized || !lyrics || lyrics.length === 0) return -1;
    const safeDuration = Math.max(1, duration);
    // 关键：用 scrollTime 而不是 currentTime，保证轮次同步
    const timeWithin = ((scrollTime % safeDuration) + safeDuration) % safeDuration;
    return findCurrentLineIndex(lyrics, timeWithin, safeDuration);
  }, [scrollTime, duration, lyrics, isInitialized]);

  const currentLineIndexRef = useRef(currentLineIndex);
  const scrollTimeRef = useRef(scrollTime);

  // 同步 scrollTime 到 ref
  useEffect(() => {
    scrollTimeRef.current = scrollTime;
  }, [scrollTime]);

  // 增大重复缓冲，支持更长的无尽滚动
  const repeatedLyrics = useMemo(() => Array(21).fill(null).flatMap(() => lyrics), [lyrics]);

  const indexToTime = useCallback((absoluteIndex: number) => {
    if (lyrics.length === 0) return 0;
    const total = lyrics.length;
    const loop = Math.floor(absoluteIndex / total);
    const rem = absoluteIndex % total;
    const lyricIndex = ((rem % total) + total) % total; // 支持负索引
    const line = lyrics[lyricIndex];
    const baseTime = line?.time ?? 0;
    return loop * duration + baseTime;
  }, [duration, lyrics]);

  const computeScrollPosition = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || lyrics.length === 0 || duration <= 0) {
      return null;
    }

    const centerViewport = scroller.scrollTop + scroller.clientHeight / 2;
    const samples: Array<{ index: number; center: number }> = [];

    for (let i = 0; i < repeatedLyrics.length; i++) {
      const lineEl = lineRefs.current[i];
      const lyricLine = repeatedLyrics[i];
      if (!lineEl || !lyricLine?.text.trim()) continue;
      const lineCenter = lineEl.offsetTop + lineEl.offsetHeight / 2;
      samples.push({ index: i, center: lineCenter });
    }

    if (samples.length === 0) {
      return null;
    }

    // 找到viewport中心点的上下边界
    let lower = samples[0];
    let upper = samples[0];

    // 如果viewport在第一个sample之前（向上滚动超出当前轮），让lower指向上一轮
    if (centerViewport < samples[0].center) {
      // lower 使用最后一个sample，但时间减去一个duration（上一轮）
      lower = { index: samples[samples.length - 1].index, center: samples[samples.length - 1].center };
      upper = samples[0];
    } else {
      // 正常查找
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        if (sample.center <= centerViewport) {
          lower = sample;
        }
        if (sample.center >= centerViewport) {
          upper = sample;
          break;
        }
      }
      // 如果没找到upper（viewport在最后一个sample之后），让upper指向下一轮第一个
      if (upper.center < centerViewport) {
        upper = samples[0];
      }
    }

    const lowerCenter = lower.center;
    const upperCenter = upper.center;
    const centerDelta = Math.max(upperCenter - lowerCenter, 1e-3);
    const ratio = Math.min(Math.max((centerViewport - lowerCenter) / centerDelta, 0), 1);

    let lowerTime = indexToTime(lower.index);
    let upperTime = indexToTime(upper.index);

    // 跨轮边界处理
    if (centerViewport < samples[0].center) {
      // 向上滚动超出当前轮：lower是上一轮的最后一个，需要减去duration
      lowerTime -= duration;
    } else if (centerViewport > samples[samples.length - 1].center) {
      // 向下滚动超出当前轮：upper是下一轮的第一个，需要加上duration
      upperTime += duration;
    } else if (upperTime <= lowerTime) {
      // 正常跨轮边界：upper在下一轮
      upperTime += duration;
    }

    const targetTime = lowerTime + ratio * (upperTime - lowerTime);
    const continuousIndex = lower.index + ratio;

    return {
      time: targetTime,
      indexContinuous: continuousIndex
    };
  }, [duration, indexToTime, lyrics, repeatedLyrics]);

  // 移动端检测
  const isIOS = typeof navigator !== 'undefined' ? /iPad|iPhone|iPod/.test(navigator.userAgent) : false;
  const isMobile = typeof navigator !== 'undefined' ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) : false;

  const scrollAnimationRef = useRef<number | null>(null);
  const targetScrollTopRef = useRef<number>(0);
  const smoothScrollSpeedRef = useRef<number>(0.15); // 平滑跟随速度

  // 连续插值滚动 - 不再使用离散动画，而是每帧平滑跟随
  const scrollToLine = useCallback((index: number, options?: { immediate?: boolean }) => {
    const lineEl = lineRefs.current[index];
    const scroller = scrollerRef.current;
    if (!lineEl || !scroller) return;

    const targetTop = lineEl.offsetTop - (scroller.clientHeight / 2) + (lineEl.offsetHeight / 2);
    targetScrollTopRef.current = targetTop;

    // 大跳跃或立即模式：直接跳转
    if (options?.immediate) {
      programmaticScrollRef.current = true;
      scroller.scrollTop = targetTop;
      lastScrollTopRef.current = targetTop;

      if (programmaticReleaseTimerRef.current) {
        clearTimeout(programmaticReleaseTimerRef.current);
      }
      programmaticReleaseTimerRef.current = setTimeout(() => {
        programmaticScrollRef.current = false;
        programmaticReleaseTimerRef.current = null;
      }, 50);
      return;
    }

    // 启动平滑跟随动画（如果还没启动）
    if (scrollAnimationRef.current === null) {
      const smoothScroll = () => {
        const scroller = scrollerRef.current;
        if (!scroller) {
          scrollAnimationRef.current = null;
          return;
        }

        const current = scroller.scrollTop;
        const target = targetScrollTopRef.current;
        const distance = target - current;

        // 如果已经很接近目标，直接设置
        if (Math.abs(distance) < 0.5) {
          scroller.scrollTop = target;
          lastScrollTopRef.current = target;
          programmaticScrollRef.current = false;
          scrollAnimationRef.current = null;
          return;
        }

        // 平滑插值：每帧移动距离的 15%
        programmaticScrollRef.current = true;
        const nextTop = current + distance * smoothScrollSpeedRef.current;
        scroller.scrollTop = nextTop;
        lastScrollTopRef.current = nextTop;

        scrollAnimationRef.current = requestAnimationFrame(smoothScroll);
      };

      scrollAnimationRef.current = requestAnimationFrame(smoothScroll);
    }
  }, []);

  const resolveScrollTarget = useCallback((direction: -1 | 0 | 1) => {
    const position = computeScrollPosition();
    if (!position) {
      return null;
    }

    const { indexContinuous } = position;

    let snappedIndex = Math.round(indexContinuous);
    if (direction > 0) {
      snappedIndex = Math.ceil(indexContinuous);
    } else if (direction < 0) {
      snappedIndex = Math.floor(indexContinuous);
    }

    const newTime = indexToTime(snappedIndex);
    return { selectedIndex: snappedIndex, newTime };
  }, [computeScrollPosition, indexToTime]);

  // 处理交互结束
  const handleInteractionEnd = useCallback(() => {
    isUserInteractingRef.current = false;

    if (!pointerInteractionRef.current) {
      scrollDirectionRef.current = 0;
      if (onPreviewEnd && previewActiveRef.current) {
        onPreviewEnd();
      }
      previewActiveRef.current = false;
      return;
    }

    const target = resolveScrollTarget(scrollDirectionRef.current);
    scrollDirectionRef.current = 0;
    pointerInteractionRef.current = false;
    if (onPreviewEnd && previewActiveRef.current) {
      onPreviewEnd();
    }
    previewActiveRef.current = false;

    if (!target) {
      return;
    }

    const now = Date.now();
    if (now - lastSeekTimeRef.current < 80) {
      return;
    }
    lastSeekTimeRef.current = now;

    // 立即无动画对齐到目标行，避免手动结束后的滚动动画
    const safeDuration = Math.max(1, duration);
    const targetLoop = Math.floor(target.newTime / safeDuration);
    lastAutoScrollIndexRef.current = target.selectedIndex;
    lastLoopFromScrollRef.current = targetLoop;

    // 将索引映射到 repeatedLyrics 的范围内
    const repeatedLength = repeatedLyrics.length;
    const normalizedIndex = ((target.selectedIndex % repeatedLength) + repeatedLength) % repeatedLength;
    scrollToLine(normalizedIndex, { immediate: true });

    onSeek(target.newTime);
    // seek 后禁止自动滚动覆盖：播放时 500ms，暂停时 1000ms
    const protectionDuration = isPlayingRef.current ? 500 : 1000;
    antiAutoScrollUntilRef.current = Date.now() + protectionDuration;
  }, [duration, repeatedLyrics, onSeek, onPreviewEnd, resolveScrollTarget, scrollToLine]);

  // 统一的交互开始处理
  const handleInteractionStart = useCallback(() => {
    if (programmaticScrollRef.current) {
      return;
    }

    if (interactionEndTimerRef.current) {
      clearTimeout(interactionEndTimerRef.current);
    }

    isUserInteractingRef.current = true;
    pointerInteractionRef.current = true;
    lastAutoScrollIndexRef.current = -1;
    scrollDirectionRef.current = 0;
    // 用户优先权保护期：统一 500ms
    const protectionDuration = 500;
    userPriorityUntilRef.current = Date.now() + protectionDuration;

    interactionEndTimerRef.current = setTimeout(() => {
      handleInteractionEnd();
    }, 800); // 延长到 800ms，避免频繁 seek
  }, [handleInteractionEnd]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const scroller = event.currentTarget;
    const currentTop = scroller.scrollTop;

    if (programmaticScrollRef.current && !pointerInteractionRef.current) {
      lastScrollTopRef.current = currentTop;
      return;
    }

    const isUserInitiated = pointerInteractionRef.current || isUserInteractingRef.current;
    if (!isUserInitiated) {
      lastScrollTopRef.current = currentTop;
      return;
    }

    const delta = currentTop - lastScrollTopRef.current;
    if (Math.abs(delta) > 1) {
      scrollDirectionRef.current = delta > 0 ? 1 : -1;
      // 通知父组件滚动速度变化
      if (onScrollVelocityChange) {
        onScrollVelocityChange(delta * 0.1);
      }
    }

    lastScrollTopRef.current = currentTop;

    handleInteractionStart();

    const position = computeScrollPosition();
    if (!position) {
      return;
    }

    if (isPlayingRef.current) {
      // 播放时：仅做预览，seek 延后到交互结束
      if (onPreviewStart && !previewActiveRef.current) {
        onPreviewStart();
        previewActiveRef.current = true;
      }
      if (onPreviewTime) {
        onPreviewTime(position.time);
      }
      pendingSeekRef.current = position.time;
      return;
    }

    // 暂停时：启用预览模式，不立刻 seek，仅更新预览时间
    if (onPreviewStart && !previewActiveRef.current) {
      onPreviewStart();
      previewActiveRef.current = true;
    }
    if (onPreviewTime) {
      onPreviewTime(position.time);
    }
    pendingSeekRef.current = position.time;
    return;
  }, [computeScrollPosition, handleInteractionStart, onPreviewTime, onScrollVelocityChange, onSeek]);

  const handlePointerInitiatedInteraction = useCallback(() => {
    pointerInteractionRef.current = true;
    releaseProgrammaticScroll();
    isUserInteractingRef.current = true;
    if (interactionEndTimerRef.current) {
      clearTimeout(interactionEndTimerRef.current);
    }
    handleInteractionStart();
    if (scrollerRef.current) {
      lastScrollTopRef.current = scrollerRef.current.scrollTop;
    }
    if (onPreviewStart && !previewActiveRef.current) {
      onPreviewStart();
      previewActiveRef.current = true;
    }
  }, [handleInteractionStart, onPreviewStart, releaseProgrammaticScroll]);

  // 同步currentLineIndex和ref（移除直接同步，统一在自动滚动 effect 内更新）

  // 初始化组件
  useEffect(() => {
    if (!isInitialized && lyrics.length > 0) {
      setIsInitialized(true);
      pointerInteractionRef.current = false;
      lastAutoScrollIndexRef.current = -1;
      lastLoopFromScrollRef.current = 0;
    }
  }, [lyrics, isInitialized]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) {
      lastScrollTopRef.current = scroller.scrollTop;
    }
  }, [isInitialized]);

  // 自动滚动：只在行变化时触发；预览态/用户交互/保护期内跳过
  useEffect(() => {
    if (!isInitialized || lyrics.length === 0) return;

    // 用户正在手动交互时，禁用自动滚动，让用户自由控制
    if (isUserInteractingRef.current) return;

    // 预览态时（由外部控制时间显示），不进行自动滚动
    if (isPreviewMode) return;

    // 检查保护期：如果在保护期内，也禁用自动滚动
    const now = Date.now();
    if (now < antiAutoScrollUntilRef.current) {
      console.log('[自动滚动] 保护期内，跳过', {
        remaining: (antiAutoScrollUntilRef.current - now).toFixed(0)
      });
      return;
    }

    if (currentLineIndex < 0) return;

    // 通知行变化
    if (onActiveLineChange && currentLineIndex !== currentLineIndexRef.current) {
      onActiveLineChange(lyrics[currentLineIndex] || null, currentLineIndex);
    }

    // 只在行索引变化时滚动
    if (currentLineIndex === currentLineIndexRef.current) return;

    // 计算绝对索引 - 从 ref 读取 scrollTime，避免加入依赖
    const safeDuration = Math.max(1, duration);
    const currentScrollTime = scrollTimeRef.current;
    const loopFromScroll = Math.floor(currentScrollTime / safeDuration);
    const targetIndex = loopFromScroll * lyrics.length + currentLineIndex;

    // 映射到 repeatedLyrics 范围
    const repeatedLength = repeatedLyrics.length;
    const normalizedIndex = ((targetIndex % repeatedLength) + repeatedLength) % repeatedLength;

    // 检测是否是大跳跃
    const previousIndex = lastAutoScrollIndexRef.current;
    const isLargeJump = previousIndex >= 0 && Math.abs(targetIndex - previousIndex) > 3;

    lastAutoScrollIndexRef.current = targetIndex;
    lastLoopFromScrollRef.current = loopFromScroll;

    scrollToLine(normalizedIndex, { immediate: isLargeJump });

    // 在完成滚动后再更新当前行引用，避免竞态
    currentLineIndexRef.current = currentLineIndex;
  }, [currentLineIndex, isPreviewMode, isInitialized, lyrics, duration, repeatedLyrics, scrollToLine, onActiveLineChange]);

  // 初始化时通知当前行（移除，已在自动滚动 useEffect 中处理）

  // 清理定时器
  useEffect(() => {
    return () => {
      if (interactionEndTimerRef.current) {
        clearTimeout(interactionEndTimerRef.current);
      }
      if (programmaticReleaseTimerRef.current) {
        clearTimeout(programmaticReleaseTimerRef.current);
      }
      if (seekAnimationFrameRef.current !== null) {
        cancelAnimationFrame(seekAnimationFrameRef.current);
      }
      if (scrollAnimationRef.current !== null) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
      pendingSeekRef.current = null;
      pointerInteractionRef.current = false;
      programmaticScrollRef.current = false;
    };
  }, []);

  // 计算当前循环和索引
  const safeDuration = Math.max(1, duration);
  const loopCount = Math.floor(scrollTime / safeDuration);
  const repeatedLength = repeatedLyrics.length;
  const absoluteCurrentIndex = currentLineIndex >= 0 ? loopCount * lyrics.length + currentLineIndex : -1;
  // 以精确映射的归一化索引作为唯一高亮依据，去掉“接近阈值”判断
  const normalizedCurrentIndex = absoluteCurrentIndex >= 0
    ? ((absoluteCurrentIndex % repeatedLength) + repeatedLength) % repeatedLength
    : -1;

  return (
    <div
      ref={scrollerRef}
      className={`w-full h-full overflow-y-scroll no-scrollbar ${isMobile ? 'touch-pan-y' : ''}`}
      style={{
        WebkitOverflowScrolling: 'touch',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        overscrollBehavior: 'contain'
      }}
      onScroll={handleScroll}
      onWheel={handlePointerInitiatedInteraction}
      onTouchStart={handlePointerInitiatedInteraction}
      onMouseDown={handlePointerInitiatedInteraction}
    >
      <div className="w-full py-[50vh]">
        {repeatedLyrics.map((line, index) => {
          const isCurrent = normalizedCurrentIndex >= 0 && index === normalizedCurrentIndex;
          const total = Math.max(lyrics.length, 1);
          const lyricIndex = ((index % total) + total) % total;
          // 以 scrollTime 为基准计算当前渲染行的“绝对索引”，与 3D 逻辑一致
          const safeDuration = Math.max(1, duration);
          const loopFromScroll = Math.floor(scrollTime / safeDuration);
          // 估算该渲染项所处的相对轮偏移：与 normalizedCurrentIndex 同侧的偏移
          const relativeFromCurrent = normalizedCurrentIndex >= 0 ? (index - normalizedCurrentIndex) : 0;
          const absoluteIndex = loopFromScroll * total + currentLineIndex + Math.round(relativeFromCurrent);
          const loopParity = Math.floor(absoluteIndex / total) % 2; // 奇偶轮左右相反（基于绝对索引）
          const isLeft = ((lyricIndex + loopParity) % 2) === 0;
          const isBlank = !line.text.trim();

          return (
            <p
              key={`${line.time}-${index}`}
              ref={(el) => { lineRefs.current[index] = el; }}
              className={`text-3xl font-semibold w-full px-16 ${
                isLeft ? 'text-left' : 'text-right'
              }`}
              style={{
                opacity: isBlank ? 0 : (isCurrent ? 1 : 0.5),
                color: isCurrent ? '#E2E8F0' : '#94A3B8',
                pointerEvents: isBlank ? 'none' : 'auto',
                userSelect: isBlank ? 'none' : 'auto',
                height: isBlank ? '5rem' : 'auto',
                paddingTop: isBlank ? '0' : '3rem',
                paddingBottom: isBlank ? '0' : '3rem',
                lineHeight: isBlank ? '1' : '1.6',
                fontSize: isMobile ? (window.innerHeight < 667 ? '1.5rem' : '1.8rem') : '2rem',
                fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif',
                transition: 'none',
                backfaceVisibility: 'hidden' as const,
                touchAction: 'pan-y'
              }}
            >
              {line.text || '\u00A0'}
            </p>
          );
        })}
      </div>
    </div>
  );
};

export default LyricsController;
