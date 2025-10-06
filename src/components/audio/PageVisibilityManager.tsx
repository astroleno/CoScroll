import { useEffect, useRef, useCallback } from 'react';

interface PageVisibilityManagerProps {
  isPlaying: boolean;
  currentTime: number;
  onVisibilityChange: (isVisible: boolean, wasHidden: boolean) => void;
  onTimeSync?: (expectedTime: number, actualTime: number) => void;
  children?: React.ReactNode;
}

/**
 * PageVisibilityManager handles audio playback during page visibility changes.
 * Ensures smooth transitions between background and foreground without audio interruption.
 */
export const PageVisibilityManager: React.FC<PageVisibilityManagerProps> = ({
  isPlaying,
  currentTime,
  onVisibilityChange,
  onTimeSync,
  children
}) => {
  const lastKnownTimeRef = useRef<number>(currentTime);
  const wasHiddenRef = useRef<boolean>(false);
  const visibilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeAttemptRef = useRef<number>(0);

  // Handle visibility changes
  const handleVisibilityChange = useCallback(() => {
    const isHidden = document.hidden;
    const wasHidden = wasHiddenRef.current;

    // Clear any pending timeout
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current);
      visibilityTimeoutRef.current = null;
    }

    if (isHidden) {
      // Page is becoming hidden
      console.log('[PageVisibility] Page hidden - maintaining audio state');
      wasHiddenRef.current = true;
      lastKnownTimeRef.current = currentTime;

      // On some browsers, we might need to ensure audio continues playing
      // Don't pause - let it continue if it was playing
    } else {
      // Page is becoming visible
      console.log('[PageVisibility] Page visible - checking audio state');
      wasHiddenRef.current = false;

      // Check if we need to sync time
      if (onTimeSync && Math.abs(currentTime - lastKnownTimeRef.current) > 0.5) {
        console.log('[PageVisibility] Time drift detected, syncing...', {
          expected: lastKnownTimeRef.current,
          actual: currentTime
        });
        onTimeSync(lastKnownTimeRef.current, currentTime);
      }

      // Notify parent component
      onVisibilityChange(true, wasHidden);

      // Attempt to resume playback if needed (with retries)
      if (isPlaying) {
        resumeAttemptRef.current = 0;
        const attemptResume = (attempt: number = 0) => {
          const audio = document.querySelector('audio');
          if (audio && audio.paused && isPlaying) {
            resumeAttemptRef.current = attempt;
            console.log(`[PageVisibility] Attempting to resume playback (attempt ${attempt + 1})`);

            audio.play()
              .then(() => {
                console.log('[PageVisibility] Playback resumed successfully');
                resumeAttemptRef.current = 0;
              })
              .catch((error) => {
                console.warn(`[PageVisibility] Resume attempt ${attempt + 1} failed:`, error);

                // Retry up to 3 times with increasing delays
                if (attempt < 2) {
                  const delay = (attempt + 1) * 200;
                  visibilityTimeoutRef.current = setTimeout(() => attemptResume(attempt + 1), delay);
                } else {
                  console.error('[PageVisibility] Failed to resume playback after 3 attempts');
                  // At this point, we might need user interaction
                }
              });
          }
        };

        // Start resume attempts with a small delay
        visibilityTimeoutRef.current = setTimeout(() => attemptResume(0), 100);
      }
    }
  }, [isPlaying, currentTime, onVisibilityChange, onTimeSync]);

  // Set up visibility change listener
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also listen for page focus/blur events as backup
    const handleFocus = () => {
      if (!document.hidden) {
        handleVisibilityChange();
      }
    };

    const handleBlur = () => {
      if (document.hidden) {
        handleVisibilityChange();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);

      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, [handleVisibilityChange]);

  // Update last known time when it changes significantly
  useEffect(() => {
    if (!wasHiddenRef.current && Math.abs(currentTime - lastKnownTimeRef.current) > 0.1) {
      lastKnownTimeRef.current = currentTime;
    }
  }, [currentTime]);

  return <>{children}</>;
};

export default PageVisibilityManager;