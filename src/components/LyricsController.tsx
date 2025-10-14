import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { LyricsControllerProps, LyricLine } from '@/types';

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

type LayerType = 'top' | 'bottom' | undefined;

const LyricsController: React.FC<LyricsControllerProps & { layer?: LayerType; verticalPercent?: number }> = ({
  lyrics,
  currentTime,
  duration,
  scrollTime,
  onSeek,
  isPlaying,
  onScrollVelocityChange,
  onActiveLineChange,
  onPreviewStart,
  onPreviewTime,
  onPreviewEnd,
  layer,
  verticalPercent,
  fontFamily,
  fontSize = 1.0,
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
  // 竖排模式（布局优先阶段）
  const VERTICAL_MODE = true;
  
  // 虚拟化参数
  const WINDOW_SIZE_SEC = 30; // 渲染窗口：当前时间前后各30秒
  const PREFETCH_SEC = 10; // 预取缓冲：额外10秒

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

  // 跨轮次歌词显示：支持显示前一轮结尾
  const visibleLyrics = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return [];
    
    // 计算当前轮次和需要显示的歌词范围
    const safeDuration = Math.max(1, duration);
    const currentLoop = Math.floor(scrollTime / safeDuration);
    const timeWithin = ((scrollTime % safeDuration) + safeDuration) % safeDuration;
    
    // 扩展显示范围：前一轮结尾 + 当前轮次 + 下一轮开头
    const extendedLyrics = [];

    // 添加前一轮的结尾歌词（如果当前轮次 > 0）
    if (currentLoop > 0) {
      const prevLoopLyrics = lyrics.map(line => ({
        ...line,
        time: line.time + (currentLoop - 1) * safeDuration
      }));
      extendedLyrics.push(...prevLoopLyrics);
    }

    // 添加当前轮次的歌词
    const currentLoopLyrics = lyrics.map(line => ({
      ...line,
      time: line.time + currentLoop * safeDuration
    }));
    extendedLyrics.push(...currentLoopLyrics);

    // 添加下一轮的开头歌词，保证 seek 能跨轮定位
    const nextLoopLyrics = lyrics.map(line => ({
      ...line,
      time: line.time + (currentLoop + 1) * safeDuration
    }));
    extendedLyrics.push(...nextLoopLyrics);

    return extendedLyrics;
  }, [lyrics, scrollTime, duration]);

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
    const centerViewport = VERTICAL_MODE
      ? (scroller.scrollLeft + scroller.clientWidth / 2)
      : (scroller.scrollTop + scroller.clientHeight / 2);
    const samples: Array<{ index: number; center: number }> = [];

    for (let i = 0; i < visibleLyrics.length; i++) {
      const lineEl = lineRefs.current[i];
      const lyricLine = visibleLyrics[i];
      if (!lineEl || !lyricLine?.text.trim()) continue;
      const lineCenter = VERTICAL_MODE
        ? (lineEl.offsetLeft + lineEl.offsetWidth / 2)
        : (lineEl.offsetTop + lineEl.offsetHeight / 2);
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
  }, [duration, indexToTime, lyrics, visibleLyrics]);

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

    // 将索引映射到 visibleLyrics 的范围内
    const visibleLength = visibleLyrics.length;
    const normalizedIndex = ((target.selectedIndex % visibleLength) + visibleLength) % visibleLength;
    scrollToLine(normalizedIndex, { immediate: true });

    onSeek(target.newTime);
    // seek 后禁止自动滚动覆盖：播放时 500ms，暂停时 1000ms
    const protectionDuration = isPlayingRef.current ? 500 : 1000;
    antiAutoScrollUntilRef.current = Date.now() + protectionDuration;
  }, [duration, visibleLyrics, onSeek, onPreviewEnd, resolveScrollTarget, scrollToLine]);

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
    const currentTop = VERTICAL_MODE ? scroller.scrollLeft : scroller.scrollTop;

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

  // 自动滚动：保留功能，但避免高亮时的位置跳动
  useEffect(() => {
    if (!isInitialized || lyrics.length === 0) return;
    
    // 通知行变化
    if (onActiveLineChange && currentLineIndex !== currentLineIndexRef.current) {
      onActiveLineChange(lyrics[currentLineIndex] || null, currentLineIndex);
    }
    currentLineIndexRef.current = currentLineIndex;
    
    // 自动滚动：仅在用户未交互时且不在预览模式时执行
    if (!isUserInteractingRef.current && !previewActiveRef.current && currentLineIndex >= 0) {
      const now = Date.now();
      // 避免在 seek 后立即自动滚动
      if (now > antiAutoScrollUntilRef.current) {
        const normalizedIndex = ((currentLineIndex % visibleLyrics.length) + visibleLyrics.length) % visibleLyrics.length;
        scrollToLine(normalizedIndex, { immediate: false });
      }
    }
  }, [currentLineIndex, isInitialized, lyrics, duration, visibleLyrics, scrollToLine, onActiveLineChange]);

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
  // 用于高光插值的当前时间（落在 [0, safeDuration)）
  const timeWithin = ((scrollTime % safeDuration) + safeDuration) % safeDuration;
  const visibleLength = visibleLyrics.length;
  const absoluteCurrentIndex = currentLineIndex >= 0 ? loopCount * lyrics.length + currentLineIndex : -1;
  // 以精确映射的归一化索引作为唯一高亮依据，去掉“接近阈值”判断
  const normalizedCurrentIndex = absoluteCurrentIndex >= 0
    ? ((absoluteCurrentIndex % visibleLength) + visibleLength) % visibleLength
    : -1;

  // 统一时间→像素映射，使用viewport中心点
  const viewportCenter = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 0;
  const LINE_SPACING_PX = 180;
  const MIN_TIME_DELTA = 0.25;
  const loopSpanPx = LINE_SPACING_PX * Math.max(lyrics.length, 1);

  // 基础循环内的位置映射：每行使用固定间距，按真实时间调整速度
  const basePositionMap = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return [];

    const safeDuration = Math.max(1, duration);
    return lyrics.map((line, index) => {
      const nextIndex = (index + 1) % lyrics.length;
      const nextLine = lyrics[nextIndex];

      let timeDelta: number;
      if (index === lyrics.length - 1) {
        const wrapOffset = nextLine ? nextLine.time : 0;
        timeDelta = safeDuration - line.time + wrapOffset;
      } else {
        timeDelta = nextLine.time - line.time;
      }

      const clampedDelta = Math.max(timeDelta, MIN_TIME_DELTA);

      return {
        time: line.time,
        position: index * LINE_SPACING_PX,
        speed: LINE_SPACING_PX / clampedDelta,
        duration: clampedDelta
      };
    });
  }, [lyrics, duration]);

  // 计算循环内指定时间对应的位置
  const calculateLoopPosition = useCallback((timeValue: number): number => {
    if (basePositionMap.length === 0) return 0;

    const safeDuration = Math.max(1, duration);
    const normalizedTime = ((timeValue % safeDuration) + safeDuration) % safeDuration;

    let segmentIndex = basePositionMap.length - 1;
    for (let i = 0; i < basePositionMap.length; i++) {
      if (normalizedTime < basePositionMap[i].time) {
        segmentIndex = i - 1;
        break;
      }
    }

    if (segmentIndex < 0) {
      segmentIndex = basePositionMap.length - 1;
    }

    const segment = basePositionMap[segmentIndex];
    const elapsedRaw = normalizedTime - segment.time;
    const elapsed = elapsedRaw >= 0 ? elapsedRaw : elapsedRaw + safeDuration;
    const cappedElapsed = Math.min(Math.max(elapsed, 0), segment.duration);

    return segment.position + cappedElapsed * segment.speed;
  }, [basePositionMap, duration]);

  // 获取绝对时间对应的位置（包含循环偏移）
  const getAbsolutePositionForTime = useCallback((timeValue: number): number => {
    if (basePositionMap.length === 0) return 0;
    const safeDuration = Math.max(1, duration);
    const loopIndex = safeDuration > 0 ? Math.floor(timeValue / safeDuration) : 0;
    return loopIndex * loopSpanPx + calculateLoopPosition(timeValue);
  }, [basePositionMap, duration, loopSpanPx, calculateLoopPosition]);

  return (
    <div
      ref={scrollerRef}
      className={`w-full h-full ${VERTICAL_MODE ? '' : 'no-scrollbar'} ${isMobile ? (VERTICAL_MODE ? 'touch-pan-x' : 'touch-pan-y') : ''}`}
      style={{
        WebkitOverflowScrolling: 'auto',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        overscrollBehavior: 'contain',
        whiteSpace: VERTICAL_MODE ? 'nowrap' : undefined,
        display: VERTICAL_MODE ? 'flex' : undefined,
        flexDirection: VERTICAL_MODE ? 'row' : undefined,
        alignItems: VERTICAL_MODE ? 'center' : undefined,
        width: VERTICAL_MODE ? '100%' : undefined,
        height: VERTICAL_MODE ? '100%' : undefined,
        overflow: 'hidden', // 作为固定视口
        pointerEvents: 'none' // 交互交给父容器
      }}
      // 去掉 onScroll，固定视口
    >
      <div 
        className={`${VERTICAL_MODE ? 'h-full' : 'w-full'}`} 
        style={{ 
          position: 'relative',
          height: '100%',
          width: '100%'
        }}
      >
        {visibleLyrics.map((line, index) => {
          const isCurrent = index === currentLineIndex;
          const isBlank = !line.text.trim();
          // 使用新的位置计算方法：每行固定间距，时间驱动偏移
          const currentPosition = getAbsolutePositionForTime(scrollTime);
          const linePosition = getAbsolutePositionForTime(line.time || 0);
          const delta = linePosition - currentPosition;
          const leftPx = viewportCenter + delta;

          // 仅渲染对应层的行：按绝对行号奇偶决定上下
          // 计算在扩展歌词列表中的绝对行号
          const safeDuration = Math.max(1, duration);
          const currentLoop = Math.floor(scrollTime / safeDuration);
          const isPrevLoop = index < lyrics.length; // 前一轮歌词

          let absLineNumber: number;
          if (isPrevLoop) {
            // 前一轮歌词：使用前一轮的行号
            absLineNumber = (currentLoop - 1) * lyrics.length + index;
          } else {
            // 当前轮歌词：使用当前轮的行号
            const currentIndex = index - lyrics.length;
            absLineNumber = currentLoop * lyrics.length + currentIndex;
          }
          
          const shouldBeTop = (absLineNumber % 2 + 2) % 2 === 0;
          // 判断是否应该在该层显示内容
          const shouldShowContent = (layer === 'top' && shouldBeTop) || (layer === 'bottom' && !shouldBeTop);

          const verticalStyle: React.CSSProperties = layer === 'top'
            ? { top: `${verticalPercent ?? 28}%` }
            : layer === 'bottom'
              ? { bottom: `${100 - (verticalPercent ?? 65)}%` }
              : { top: '50%', transform: 'translateY(-50%)' };

          return (
            <p
              key={`${line.time}-${index}-${layer ?? 'single'}`}
              ref={(el) => { lineRefs.current[index] = el; }}
              className={`text-3xl font-semibold`}
              style={{
                position: 'absolute',
                left: `${leftPx}px`,
                ...verticalStyle,
                // 不属于该层时完全透明作为占位，属于该层时根据是否空白决定透明度
                opacity: shouldShowContent ? (isBlank ? 0 : 1) : 0,
                color: isCurrent ? '#FFFFFF' : '#94A3B8',
                // 占位元素不响应交互
                pointerEvents: shouldShowContent ? 'none' : 'none',
                userSelect: (shouldShowContent && !isBlank) ? 'auto' : 'none',
                display: 'flex',
                alignItems: layer === 'top' ? 'flex-start' : (layer === 'bottom' ? 'flex-end' : 'center'),
                justifyContent: 'center',
                height: 'auto',
                minWidth: '6rem',
                maxWidth: '8rem',
                marginLeft: 0,
                marginRight: 0,
                lineHeight: isBlank ? '1' : '1.6',
                fontSize: `${(isMobile ? (window.innerHeight < 667 ? 1.5 : 1.8) : 2) * fontSize}rem`,
                fontFamily: fontFamily || '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif',
                backfaceVisibility: 'hidden' as const,
                writingMode: 'vertical-rl' as const,
                textOrientation: 'mixed' as const,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                fontWeight: isCurrent ? 800 : 600,
              }}
            >
              {shouldShowContent ? (line.text || '\u00A0') : '\u00A0'}
            </p>
          );
        })}
      </div>
    </div>
  );
};

export default LyricsController;
