import React, { useRef, useCallback, useEffect } from 'react';

interface AudioEngineProps {
  audioSrc: string;
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  loopCount: number; // 添加：外部传入的轮次
  duration: number;
  onTimeUpdate: (currentTime: number, absoluteTime: number) => void;
  onDurationChange: (duration: number) => void;
  onReady: () => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  onLoopComplete: (loopCount: number) => void;
  enableWebAudio?: boolean;
  initialTime?: number;
  seekSignal?: number;
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
  loopCount: desiredLoopCount,
  duration,
  onTimeUpdate,
  onDurationChange,
  onReady,
  onPlayStateChange,
  onLoopComplete,
  enableWebAudio = true,
  initialTime = 0,
  seekSignal = 0
}) => {
  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastPlaybackTimeRef = useRef(0);
  const playingIntentRef = useRef(desiredPlayingState);
  const sourceRef = useRef(audioSrc);
  const playGenerationRef = useRef(0);
  const startupRetriesRef = useRef(0);
  const startupRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (playingIntentRef.current !== desiredPlayingState || sourceRef.current !== audioSrc) {
    playGenerationRef.current++;
    playingIntentRef.current = desiredPlayingState;
    sourceRef.current = audioSrc;
  }

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

  useEffect(() => {
    stateRef.current.isReady = false;
    startupRetriesRef.current = 0;
    return () => {
      playGenerationRef.current++;
      if (startupRetryTimerRef.current) clearTimeout(startupRetryTimerRef.current);
      startupRetryTimerRef.current = null;
    };
  }, [audioSrc]);

  // Seek management
  const isSeekingRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const lastSeekTimeRef = useRef(0);
  const seekThrottleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastForcedSeekRef = useRef<number>(0);
  const lastAppliedSeekSignalRef = useRef(seekSignal);

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
        const pending = pendingSeekRef.current;
        pendingSeekRef.current = null;
        seekThrottleTimeoutRef.current = null;
        if (pending !== null) performSeek(pending);
      }, 100 - timeSinceLastSeek);
      return;
    }

    // An immediately applied target supersedes any older queued seek.
    if (seekThrottleTimeoutRef.current) clearTimeout(seekThrottleTimeoutRef.current);
    seekThrottleTimeoutRef.current = null;
    pendingSeekRef.current = null;

    const audio = audioRef.current;
    if (!audio) return;

    isSeekingRef.current = true;
    lastSeekTimeRef.current = now;
    lastForcedSeekRef.current = now;

    const base = Math.max(1, duration || audio.duration || 1);
    const displayTime = ((time % base) + base) % base;
    const loopIndex = Math.floor(time / base);

    console.log('[AudioEngine] performSeek', {
      time,
      displayTime,
      currentLoopCount: stateRef.current.loopCount,
      targetLoopIndex: loopIndex
    });

    try {
      audio.currentTime = displayTime;
      stateRef.current.currentTime = displayTime;
      stateRef.current.loopCount = loopIndex;
      lastPlaybackTimeRef.current = displayTime;

      // Notify parent of time change (使用当前的 loopCount)
      const absoluteTime = loopIndex * base + displayTime;
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

  const cancelAnimationLoop = useCallback(() => {
    if (!enableWebAudio) {
      animationFrameRef.current = null;
      return;
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [enableWebAudio]);

  const animationStep = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !stateRef.current.isPlaying) {
      animationFrameRef.current = null;
      return;
    }

    const newTime = audio.currentTime;
    const base = Math.max(1, duration || audio.duration || 1);
    const absoluteTime = stateRef.current.loopCount * base + newTime;
    onTimeUpdate(newTime, absoluteTime);

    animationFrameRef.current = requestAnimationFrame(animationStep);
  }, [duration, onTimeUpdate]);

  const startAnimationLoop = useCallback(() => {
    if (!enableWebAudio) {
      return;
    }
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = requestAnimationFrame(animationStep);
  }, [animationStep, enableWebAudio]);

  // Handle time updates with buffering detection
  const handleTimeUpdate = useCallback((event: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = event.currentTarget;
    if (!audio || isSeekingRef.current) return;

    const newTime = audio.currentTime;
    const previousTime = lastPlaybackTimeRef.current;

    if (previousTime - newTime > 0.5) {
      stateRef.current.loopCount += 1;
      onLoopComplete(stateRef.current.loopCount);
    }
    lastPlaybackTimeRef.current = newTime;

    const buffered = audio.buffered;

    let isBuffering = false;
    if (buffered.length > 0) {
      const currentBufferEnd = buffered.end(buffered.length - 1);
      const bufferThreshold = 2;
      isBuffering = currentBufferEnd - newTime < bufferThreshold;
    }

    stateRef.current.currentTime = newTime;
    stateRef.current.isBuffering = isBuffering;

    if (animationFrameRef.current === null) {
      const absoluteTime = stateRef.current.loopCount * Math.max(1, duration || audio.duration || 1) + newTime;
      onTimeUpdate(newTime, absoluteTime);
    }
  }, [duration, onLoopComplete, onTimeUpdate]);

  // Handle audio metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const realDuration = Math.max(1, audio.duration);
    stateRef.current.duration = realDuration;
    onDurationChange(realDuration);
    lastPlaybackTimeRef.current = audio.currentTime || 0;

    // Apply initial seek if specified
    if (initialTime > 0) {
      performSeek(initialTime);
    }
  }, [initialTime, onDurationChange, performSeek]);

  // Handle audio ready to play
  const handleCanPlay = useCallback(() => {
    if (startupRetryTimerRef.current) {
      clearTimeout(startupRetryTimerRef.current);
      startupRetryTimerRef.current = null;
    }
    if (!stateRef.current.isReady) {
      stateRef.current.isReady = true;
      onReady();
    }

      if (playingIntentRef.current) {
        const audio = audioRef.current;
        if (!audio) return;

        initAudioContext();
        resumeAudioContext();

        const generation = playGenerationRef.current;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (generation !== playGenerationRef.current || !playingIntentRef.current || audio !== audioRef.current || audio.paused) return;
              stateRef.current.isPlaying = true;
              onPlayStateChange(true);
            })
            .catch(error => {
              if (generation !== playGenerationRef.current || !playingIntentRef.current || audio !== audioRef.current) return;
              console.error('[AudioEngine] Play on ready failed:', error);
            });
        }
      }
  }, [initAudioContext, resumeAudioContext, onPlayStateChange, onReady]);

  // Sync with desired playing state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // Pause also cancels a pending play(), before its native play event arrives.
    if (!desiredPlayingState) {
      audio.pause();
      if (stateRef.current.isPlaying) {
        stateRef.current.isPlaying = false;
        onPlayStateChange(false);
      }
      return;
    }
    if (!stateRef.current.isReady) return;

    // Initialize audio context on first play
      if (desiredPlayingState && !stateRef.current.isPlaying) {
        initAudioContext();
        resumeAudioContext();
      }

    const currentState = stateRef.current.isPlaying;

    if (desiredPlayingState && !currentState) {
      const generation = playGenerationRef.current;
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (generation !== playGenerationRef.current || !playingIntentRef.current || audio !== audioRef.current || audio.paused) return;
            stateRef.current.isPlaying = true;
            onPlayStateChange(true);
          })
          .catch(error => {
            if (generation !== playGenerationRef.current || !playingIntentRef.current || audio !== audioRef.current) return;
            console.error('[AudioEngine] Play failed:', error);
            stateRef.current.isPlaying = false;
            onPlayStateChange(false);
          });
      }
    }
  }, [desiredPlayingState, initAudioContext, resumeAudioContext, onPlayStateChange]);

  const handleAudioError = useCallback((event: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = event.currentTarget;
    // Retry only startup failures. Never restart a track that has already played.
    if (!stateRef.current.isReady && startupRetriesRef.current < 2) {
      if (startupRetryTimerRef.current) return;
      const attempt = ++startupRetriesRef.current;
      console.warn(`[AudioEngine] Initial audio request failed; retry ${attempt}/2`);
      startupRetryTimerRef.current = setTimeout(() => {
        startupRetryTimerRef.current = null;
        if (audio !== audioRef.current || sourceRef.current !== audioSrc || stateRef.current.isReady) return;
        playGenerationRef.current++;
        audio.load();
      }, attempt * 1000);
      return;
    }
    console.error('[AudioEngine] Audio error:', audio.error);
  }, [audioSrc]);

  // Sync external loopCount to internal state
  useEffect(() => {
    if (stateRef.current.loopCount !== desiredLoopCount) {
      console.log('[AudioEngine] 外部同步 loopCount', {
        old: stateRef.current.loopCount,
        new: desiredLoopCount
      });
      stateRef.current.loopCount = desiredLoopCount;
    }
  }, [desiredLoopCount]);

  // Sync with desired time position
  useEffect(() => {
    if (!stateRef.current.isReady) return;

    const base = Math.max(1, duration || audioRef.current?.duration || 1);
    const targetTime = desiredLoopCount * base + desiredTime;
    if (seekSignal !== lastAppliedSeekSignalRef.current) {
      lastAppliedSeekSignalRef.current = seekSignal;
      performSeek(targetTime);
      return;
    }
    if (isSeekingRef.current) return;

    const currentTime = stateRef.current.currentTime;
    const timeDiff = Math.abs(desiredTime - currentTime);

    // Only seek if the difference is significant (more than 100ms)
    const diff = desiredTime - currentTime;
    if (Math.abs(diff) > 0.1) {
      const now = Date.now();
      const recentlyForced = now - lastForcedSeekRef.current < 500;
      const shouldSeek = diff > 0 || recentlyForced;
      if (shouldSeek) {
        performSeek(targetTime);
      }
    }
  }, [desiredTime, desiredLoopCount, duration, isReady, seekSignal, performSeek]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (seekThrottleTimeoutRef.current) {
        clearTimeout(seekThrottleTimeoutRef.current);
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      cancelAnimationLoop();
    };
  }, [cancelAnimationLoop]);

  return (
    <audio
      ref={audioRef}
      src={audioSrc}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onCanPlay={handleCanPlay}
      onPlay={(event) => {
        if (!playingIntentRef.current) {
          event.currentTarget.pause();
          return;
        }
        stateRef.current.isPlaying = true;
      onPlayStateChange(true);
      startAnimationLoop();
      }}
      onPause={() => {
        stateRef.current.isPlaying = false;
        onPlayStateChange(false);
        cancelAnimationLoop();
      }}
      onError={handleAudioError}
      preload="auto"
      playsInline
      webkit-playsinline="true"
      controls={false}
      crossOrigin="anonymous"
      loop
    />
  );
};

export default AudioEngine;
