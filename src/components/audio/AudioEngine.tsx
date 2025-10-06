import React, { useRef, useCallback, useEffect } from 'react';

interface AudioEngineProps {
  audioSrc: string;
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  duration: number;
  onTimeUpdate: (currentTime: number, absoluteTime: number) => void;
  onDurationChange: (duration: number) => void;
  onReady: () => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  onLoopComplete: (loopCount: number) => void;
  enableWebAudio?: boolean;
  initialTime?: number;
}

interface AudioState {
  isPlaying: boolean;
  isReady: boolean;
  duration: number;
  currentTime: number;
  loopCount: number;
  isBuffering: boolean;
}

export const AudioEngine: React.FC<AudioEngineProps> = ({
  audioSrc,
  isPlaying: desiredPlayingState,
  isReady,
  currentTime: desiredTime,
  duration,
  onTimeUpdate,
  onDurationChange,
  onReady,
  onPlayStateChange,
  onLoopComplete,
  enableWebAudio = true,
  initialTime = 0
}) => {
  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Expose audio element to parent
  useEffect(() => {
    if (audioRef.current && typeof window !== 'undefined') {
      (window as any).__audioElement = audioRef.current;
    }
  }, []);

  // State tracking
  const stateRef = useRef<AudioState>({
    isPlaying: false,
    isReady: false,
    duration: 0,
    currentTime: 0,
    loopCount: 0,
    isBuffering: false
  });

  // Seek management
  const isSeekingRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const lastSeekTimeRef = useRef(0);
  const seekThrottleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio context management
  const initAudioContext = useCallback(() => {
    if (!enableWebAudio || audioContextRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      gainNodeRef.current = audioContextRef.current.createGain();

      if (audioRef.current) {
        sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
        sourceNodeRef.current.connect(gainNodeRef.current);
        gainNodeRef.current.connect(audioContextRef.current.destination);

        // Set initial gain to prevent clipping
        gainNodeRef.current.gain.value = 0.8;
      }
    } catch (error) {
      console.error('[AudioEngine] Failed to initialize Web Audio API:', error);
    }
  }, [enableWebAudio]);

  // Resume audio context on user interaction
  const resumeAudioContext = useCallback(async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (error) {
        console.error('[AudioEngine] Failed to resume audio context:', error);
      }
    }
  }, []);

  // Handle seek operations with throttling
  const performSeek = useCallback((time: number) => {
    const now = Date.now();
    const timeSinceLastSeek = now - lastSeekTimeRef.current;

    // Throttle seeks to prevent stuttering (minimum 100ms between seeks)
    if (timeSinceLastSeek < 100) {
      pendingSeekRef.current = time;
      if (seekThrottleTimeoutRef.current) {
        clearTimeout(seekThrottleTimeoutRef.current);
      }
      seekThrottleTimeoutRef.current = setTimeout(() => {
        if (pendingSeekRef.current !== null) {
          performSeek(pendingSeekRef.current);
          pendingSeekRef.current = null;
        }
      }, 100 - timeSinceLastSeek);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    isSeekingRef.current = true;
    lastSeekTimeRef.current = now;

    // Calculate display time (within current loop)
    const displayTime = time % Math.max(1, duration || audio.duration || 1);

    try {
      audio.currentTime = displayTime;
      stateRef.current.currentTime = displayTime;

      // Notify parent of time change
      const absoluteTime = stateRef.current.loopCount * Math.max(1, duration || audio.duration || 1) + displayTime;
      onTimeUpdate(displayTime, absoluteTime);

      // Clear seeking state after a short delay
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 50);
    } catch (error) {
      console.error('[AudioEngine] Seek failed:', error);
      isSeekingRef.current = false;
    }
  }, [duration, onTimeUpdate]);

  // Handle time updates with buffering detection
  const handleTimeUpdate = useCallback((event: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = event.currentTarget;
    if (!audio || isSeekingRef.current) return;

    const newTime = audio.currentTime;
    const buffered = audio.buffered;

    // Check if we're buffering
    let isBuffering = false;
    if (buffered.length > 0) {
      const currentBufferEnd = buffered.end(buffered.length - 1);
      const bufferThreshold = 2; // 2 seconds ahead
      isBuffering = currentBufferEnd - newTime < bufferThreshold;
    }

    stateRef.current.currentTime = newTime;
    stateRef.current.isBuffering = isBuffering;

    // Calculate absolute time (including loops)
    const absoluteTime = stateRef.current.loopCount * Math.max(1, duration || audio.duration || 1) + newTime;
    onTimeUpdate(newTime, absoluteTime);
  }, [duration, onTimeUpdate]);

  // Handle audio metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const realDuration = Math.max(1, audio.duration);
    stateRef.current.duration = realDuration;
    onDurationChange(realDuration);

    // Apply initial seek if specified
    if (initialTime > 0) {
      performSeek(initialTime);
    }
  }, [initialTime, onDurationChange, performSeek]);

  // Handle audio ready to play
  const handleCanPlay = useCallback(() => {
    if (!stateRef.current.isReady) {
      stateRef.current.isReady = true;
      onReady();
    }
  }, [onReady]);

  // Handle audio ended (for smooth looping)
  const handleAudioEnded = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Increment loop count
    stateRef.current.loopCount++;
    onLoopComplete(stateRef.current.loopCount);

    // Smooth loop without interruption
    try {
      // For smooth looping, seek to beginning and play immediately
      audio.currentTime = 0;
      stateRef.current.currentTime = 0;

      // Only play if we're supposed to be playing
      if (desiredPlayingState) {
        const playPromise = audio.play();

        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('[AudioEngine] Loop playback failed:', error);
            // Fallback: try to reload and play
            audio.load();
            audio.play().catch(e => {
              console.error('[AudioEngine] Loop fallback playback failed:', e);
            });
          });
        }
      }
    } catch (error) {
      console.error('[AudioEngine] Loop handling failed:', error);
    }
  }, [desiredPlayingState, onLoopComplete]);

  // Sync with desired playing state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stateRef.current.isReady) return;

    // Initialize audio context on first play
    if (desiredPlayingState && !stateRef.current.isPlaying) {
      initAudioContext();
      resumeAudioContext();
    }

    const currentState = stateRef.current.isPlaying;

    if (desiredPlayingState && !currentState) {
      // Start playing
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            stateRef.current.isPlaying = true;
            onPlayStateChange(true);
          })
          .catch(error => {
            console.error('[AudioEngine] Play failed:', error);
            stateRef.current.isPlaying = false;
            onPlayStateChange(false);
          });
      }
    } else if (!desiredPlayingState && currentState) {
      // Pause
      audio.pause();
      stateRef.current.isPlaying = false;
      onPlayStateChange(false);
    }
  }, [desiredPlayingState, initAudioContext, resumeAudioContext, onPlayStateChange]);

  // Sync with desired time position
  useEffect(() => {
    if (!stateRef.current.isReady || isSeekingRef.current) return;

    const currentTime = stateRef.current.currentTime;
    const timeDiff = Math.abs(desiredTime - currentTime);

    // Only seek if the difference is significant (more than 100ms)
    if (timeDiff > 0.1) {
      performSeek(desiredTime);
    }
  }, [desiredTime, performSeek]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (seekThrottleTimeoutRef.current) {
        clearTimeout(seekThrottleTimeoutRef.current);
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      src={audioSrc}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onCanPlay={handleCanPlay}
      onEnded={handleAudioEnded}
      onPlay={() => {
        stateRef.current.isPlaying = true;
        onPlayStateChange(true);
      }}
      onPause={() => {
        stateRef.current.isPlaying = false;
        onPlayStateChange(false);
      }}
      onError={(e) => {
        console.error('[AudioEngine] Audio error:', e.currentTarget.error);
      }}
      preload="auto"
      playsInline
      webkit-playsinline="true"
      controls={false}
      crossOrigin="anonymous"
    />
  );
};

export default AudioEngine;