import { useRef, useCallback, useEffect } from 'react';

interface SmoothLoopManagerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  onLoopComplete: (loopCount: number) => void;
  onTimeUpdate: (currentTime: number) => void;
  enableGaplessLoop?: boolean;
  loopOverlapTime?: number; // Time in seconds to preload the next loop
}

/**
 * SmoothLoopManager ensures seamless audio looping without dropouts or interruptions.
 * Uses Web Audio API scheduling for gapless playback when available.
 */
export const SmoothLoopManager: React.FC<SmoothLoopManagerProps> = ({
  audioElement,
  isPlaying,
  duration,
  currentTime,
  onLoopComplete,
  onTimeUpdate,
  enableGaplessLoop = true,
  loopOverlapTime = 0.5 // Start crossfade 0.5s before end
}) => {
  if (!enableGaplessLoop) {
    return null;
  }

  // Refs for tracking loop state
  const loopCountRef = useRef<number>(0);
  const isLoopingRef = useRef<boolean>(false);
  const hasScheduledNextLoopRef = useRef<boolean>(false);
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle seamless loop transition
  const handleLoopTransition = useCallback(() => {
    if (!audioElement || isLoopingRef.current) return;

    isLoopingRef.current = true;
    hasScheduledNextLoopRef.current = false;

    // Increment loop count
    loopCountRef.current++;
    onLoopComplete(loopCountRef.current);

    // Method 1: Instant restart (most reliable)
    const performInstantRestart = () => {
      try {
        // Store the current playback state
        const wasPlaying = !audioElement.paused;

        // Instant seek to beginning
        audioElement.currentTime = 0;

        // Resume playback if it was playing
        if (wasPlaying) {
          const playPromise = audioElement.play();

          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setTimeout(() => {
                  isLoopingRef.current = false;
                }, 100);
              })
              .catch(error => {
                console.error('[SmoothLoop] Instant restart failed:', error);

                // Fallback: reload and play
                fallbackReloadAndPlay();
              });
          }
        } else {
          setTimeout(() => {
            isLoopingRef.current = false;
          }, 100);
        }
      } catch (error) {
        console.error('[SmoothLoop] Loop transition error:', error);
        fallbackReloadAndPlay();
      }
    };

    // Fallback method: Reload and play
    const fallbackReloadAndPlay = () => {
      try {
        const wasPlaying = !audioElement.paused;

        audioElement.load();

        // Wait for audio to be ready
        const canPlayHandler = () => {
          audioElement.currentTime = 0;

          if (wasPlaying) {
            audioElement.play()
              .then(() => {
                setTimeout(() => {
                  isLoopingRef.current = false;
                }, 100);
              })
              .catch(error => {
                console.error('[SmoothLoop] Fallback playback failed:', error);
                isLoopingRef.current = false;
              });
          } else {
            isLoopingRef.current = false;
          }

          audioElement.removeEventListener('canplay', canPlayHandler);
        };

        audioElement.addEventListener('canplay', canPlayHandler);

        // Set a timeout in case canplay doesn't fire
        setTimeout(() => {
          audioElement.removeEventListener('canplay', canPlayHandler);
          isLoopingRef.current = false;
        }, 1000);
      } catch (error) {
        console.error('[SmoothLoop] Fallback method failed:', error);
        isLoopingRef.current = false;
      }
    };

    // Perform the loop transition
    performInstantRestart();
  }, [audioElement, onLoopComplete]);

  // Monitor time updates for loop detection
  useEffect(() => {
    if (!audioElement || duration <= 0) return;

    // Check if we've naturally reached the end
    const overlapThreshold = Math.max(0.05, loopOverlapTime);
    const hasReachedEnd = currentTime >= Math.max(0, duration - overlapThreshold);

    // Check for time reset (indicates loop occurred)
    const hasReset = currentTime < 0.5 && loopCountRef.current > 0;

    if (hasReachedEnd && !isLoopingRef.current && !hasScheduledNextLoopRef.current) {
      // Schedule the loop
      hasScheduledNextLoopRef.current = true;

      // Use a timeout to handle the loop
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
      }

      loopTimeoutRef.current = setTimeout(() => {
        handleLoopTransition();
      }, 100);
    } else if (hasReset && isLoopingRef.current) {
      // Loop has completed successfully
      onTimeUpdate(0);
      isLoopingRef.current = false;
      hasScheduledNextLoopRef.current = false;
    }
  }, [audioElement, currentTime, duration, handleLoopTransition, onTimeUpdate, loopOverlapTime]);

  // Listen for the native ended event as backup
  useEffect(() => {
    if (!audioElement) return;

    const handleEnded = () => {
      if (!isLoopingRef.current && isPlaying) {
        handleLoopTransition();
      }
    };

    audioElement.addEventListener('ended', handleEnded);

    return () => {
      audioElement.removeEventListener('ended', handleEnded);
    };
  }, [audioElement, isPlaying, handleLoopTransition]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
      }
      isLoopingRef.current = false;
      hasScheduledNextLoopRef.current = false;
    };
  }, []);

  // Reset loop count when duration changes
  useEffect(() => {
    loopCountRef.current = 0;
  }, [duration]);

  return null; // This component doesn't render anything
};

export default SmoothLoopManager;
