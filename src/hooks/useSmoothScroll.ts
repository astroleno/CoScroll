import { useRef, useCallback, useState } from 'react';

export interface SmoothScrollOptions {
  duration?: number;
  easing?: (t: number) => number;
}

export function useSmoothScroll() {
  const [isScrolling, setIsScrolling] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Default easing function (ease-in-out)
  const defaultEasing = (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  };

  const smoothScrollTo = useCallback((
    element: HTMLElement,
    targetScrollTop: number,
    options: SmoothScrollOptions = {}
  ) => {
    const {
      duration = 300,
      easing = defaultEasing
    } = options;

    // Cancel any ongoing animation
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startScrollTop = element.scrollTop;
    const distance = targetScrollTop - startScrollTop;
    let startTime: number | null = null;

    setIsScrolling(true);

    const animateScroll = (currentTime: number) => {
      if (startTime === null) {
        startTime = currentTime;
      }

      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      const easedProgress = easing(progress);

      element.scrollTop = startScrollTop + (distance * easedProgress);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animateScroll);
      } else {
        setIsScrolling(false);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animateScroll);
  }, []);

  const scrollToTime = useCallback((
    element: HTMLElement,
    targetTime: number,
    duration: number,
    currentScrollTime: number,
    options: SmoothScrollOptions = {}
  ) => {
    const currentLoopTime = targetTime % duration;
    const timeProgress = currentLoopTime / duration;
    const scrollHeight = element.scrollHeight - element.clientHeight;
    const targetScrollTop = timeProgress * scrollHeight;

    smoothScrollTo(element, targetScrollTop, options);
  }, [smoothScrollTo]);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsScrolling(false);
  }, []);

  return {
    isScrolling,
    smoothScrollTo,
    scrollToTime,
    scrollContainerRef,
    cleanup
  };
}