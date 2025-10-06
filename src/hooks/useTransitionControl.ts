import { useRef, useEffect, useCallback } from 'react';

/**
 * Smooth transition control hook for managing background/foreground state changes
 * Prevents sudden rotation spikes during state transitions
 */
export function useTransitionControl({
  transitionDuration = 500,
  enableVelocityReset = true,
  maxTransitionVelocity = 0.5,
  smoothingFactor = 0.1
}: {
  transitionDuration?: number;
  enableVelocityReset?: boolean;
  maxTransitionVelocity?: number;
  smoothingFactor?: number;
} = {}) {
  const isTransitioningRef = useRef(false);
  const transitionStartTimeRef = useRef(0);
  const previousVelocityRef = useRef(0);
  const targetVelocityRef = useRef(0);
  const currentVelocityRef = useRef(0);

  // Start a controlled transition
  const startTransition = useCallback((fromVelocity: number, toVelocity: number) => {
    if (isTransitioningRef.current) return;

    isTransitioningRef.current = true;
    transitionStartTimeRef.current = performance.now();
    previousVelocityRef.current = fromVelocity;
    targetVelocityRef.current = Math.abs(toVelocity) > maxTransitionVelocity
      ? maxTransitionVelocity * Math.sign(toVelocity)
      : toVelocity;

    console.log('[useTransitionControl] Starting transition:', {
      fromVelocity,
      toVelocity: targetVelocityRef.current,
      duration: transitionDuration
    });
  }, [transitionDuration, maxTransitionVelocity]);

  // Get current interpolated velocity
  const getCurrentVelocity = useCallback(() => {
    if (!isTransitioningRef.current) {
      return currentVelocityRef.current;
    }

    const now = performance.now();
    const elapsed = now - transitionStartTimeRef.current;
    const progress = Math.min(elapsed / transitionDuration, 1);

    // Smooth easing function (ease-in-out cubic)
    const easedProgress = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    // Interpolate velocity
    const interpolatedVelocity = previousVelocityRef.current +
      (targetVelocityRef.current - previousVelocityRef.current) * easedProgress;

    // Smooth current velocity
    currentVelocityRef.current += (interpolatedVelocity - currentVelocityRef.current) * smoothingFactor;

    // Check if transition is complete
    if (progress >= 1) {
      isTransitioningRef.current = false;
      currentVelocityRef.current = targetVelocityRef.current;
      console.log('[useTransitionControl] Transition complete');
    }

    return currentVelocityRef.current;
  }, [transitionDuration, smoothingFactor]);

  // Check if currently transitioning
  const isTransitioning = useCallback(() => {
    return isTransitioningRef.current;
  }, []);

  // Force stop transition
  const stopTransition = useCallback(() => {
    if (isTransitioningRef.current) {
      isTransitioningRef.current = false;
      currentVelocityRef.current = targetVelocityRef.current;
      console.log('[useTransitionControl] Transition stopped');
    }
  }, []);

  // Reset velocity to safe value
  const resetVelocity = useCallback((safeVelocity = 0.1) => {
    previousVelocityRef.current = currentVelocityRef.current;
    targetVelocityRef.current = safeVelocity;
    currentVelocityRef.current = safeVelocity;

    if (enableVelocityReset) {
      startTransition(previousVelocityRef.current, safeVelocity);
    }
  }, [enableVelocityReset, startTransition]);

  // Handle background to foreground transition
  const onBackgroundToForeground = useCallback((currentVelocity: number) => {
    const safeVelocity = Math.abs(currentVelocity) > maxTransitionVelocity
      ? maxTransitionVelocity * Math.sign(currentVelocity)
      : currentVelocity * 0.3; // Reduce velocity by 70%

    startTransition(currentVelocity, safeVelocity);
  }, [maxTransitionVelocity, startTransition]);

  // Handle foreground to background transition
  const onForegroundToBackground = useCallback((currentVelocity: number) => {
    const safeVelocity = currentVelocity * 0.5; // Reduce velocity by 50%

    startTransition(currentVelocity, safeVelocity);
  }, [startTransition]);

  return {
    startTransition,
    getCurrentVelocity,
    isTransitioning,
    stopTransition,
    resetVelocity,
    onBackgroundToForeground,
    onForegroundToBackground,
    currentVelocity: currentVelocityRef.current
  };
}