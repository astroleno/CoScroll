import React, { useCallback, useRef, useState, useEffect } from 'react';

interface EnhancedAudioPlayerProps {
  isPlaying: boolean;
  isReady: boolean;
  duration: number;
  currentTime: number;
  isBuffering?: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  showDebugInfo?: boolean;
}

const formatTime = (timeInSeconds: number): string => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const EnhancedAudioPlayer: React.FC<EnhancedAudioPlayerProps> = ({
  isPlaying,
  isReady,
  duration,
  currentTime,
  isBuffering = false,
  onPlayPause,
  onSeek,
  showDebugInfo = false
}) => {
  // State for visual feedback
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(currentTime);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Refs for seek debouncing
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeekTimeRef = useRef(0);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const dragProgress = duration > 0 ? (dragTime / duration) * 100 : 0;
  const displayTime = isDragging ? dragTime : currentTime;
  const displayProgress = isDragging ? dragProgress : progress;

  // Debounced seek handler
  const handleSeekDebounced = useCallback((time: number, immediate = false) => {
    const now = Date.now();
    const timeSinceLastSeek = now - lastSeekTimeRef.current;

    // Always allow immediate seeks during drag
    if (immediate || isDragging) {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
      lastSeekTimeRef.current = now;
      onSeek(time);
      return;
    }

    // Debounce non-drag seeks to prevent stuttering
    if (timeSinceLastSeek < 100) {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
      seekTimeoutRef.current = setTimeout(() => {
        lastSeekTimeRef.current = Date.now();
        onSeek(time);
      }, 100 - timeSinceLastSeek);
    } else {
      lastSeekTimeRef.current = now;
      onSeek(time);
    }
  }, [isDragging, onSeek]);

  // Handle input change during drag
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setDragTime(time);
    handleSeekDebounced(time, true); // Immediate update during drag
  };

  // Handle seek release
  const handleInputEnd = useCallback(() => {
    setIsDragging(false);
    handleSeekDebounced(dragTime, true);
  }, [dragTime, handleSeekDebounced]);

  // Handle mouse move on progress bar
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    if (!e.currentTarget) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = percent * duration;
    setHoverTime(time);
  }, [duration]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!e.currentTarget) return;

    let newTime = currentTime;
    const step = e.shiftKey ? 10 : 1; // 10 seconds with shift, 1 second normally

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        newTime = Math.max(0, currentTime - step);
        handleSeekDebounced(newTime, true);
        break;
      case 'ArrowRight':
        e.preventDefault();
        newTime = Math.min(duration, currentTime + step);
        handleSeekDebounced(newTime, true);
        break;
      case 'Home':
        e.preventDefault();
        handleSeekDebounced(0, true);
        break;
      case 'End':
        e.preventDefault();
        handleSeekDebounced(duration, true);
        break;
    }
  }, [currentTime, duration, handleSeekDebounced]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
    };
  }, []);

  const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
    </svg>
  );

  const PauseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Zm9 0a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
    </svg>
  );

  const BufferingIcon = () => (
    <div className="w-8 h-8 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#87CEEB] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="w-full max-w-2xl p-4">
      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        <button
          onClick={onPlayPause}
          disabled={!isReady || isBuffering}
          className="text-[#87CEEB] hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isBuffering ? <BufferingIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* Time Display and Progress Bar */}
        <div className="flex-grow flex items-center gap-3">
          {/* Current Time */}
          <span className="text-sm font-mono text-gray-400 w-12 text-right select-none">
            {formatTime(displayTime)}
          </span>

          {/* Progress Bar Container */}
          <div className="relative flex-grow group">
            {/* Hover Time Tooltip */}
            {hoverTime !== null && (
              <div
                className="absolute -top-8 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none z-10"
                style={{
                  left: `${(hoverTime / duration) * 100}%`,
                  transform: 'translateX(-50%)'
                }}
              >
                {formatTime(hoverTime)}
              </div>
            )}

            {/* Progress Bar */}
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={displayTime}
              onChange={handleInputChange}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={handleInputEnd}
              onMouseLeave={() => {
                handleInputEnd();
                setHoverTime(null);
              }}
              onMouseMove={handleMouseMove}
              onKeyDown={handleKeyDown}
              disabled={!isReady || isBuffering}
              className="w-full h-1.5 bg-gray-600/40 rounded-lg appearance-none cursor-pointer range-lg disabled:cursor-not-allowed transition-all duration-150"
              style={{
                background: `linear-gradient(to right, #87CEEB ${displayProgress}%, rgba(74,85,104,0.4) ${displayProgress}%)`,
              }}
            />

            {/* Buffering Indicator */}
            {isBuffering && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-full h-0.5 bg-gray-600/20 rounded-full overflow-hidden">
                  <div className="h-full bg-[#87CEEB]/50 animate-pulse" style={{ width: '30%' }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Duration */}
          <span className="text-sm font-mono text-gray-400 w-12 text-left select-none">
            {formatTime(duration)}
          </span>
        </div>

        {/* Debug Info */}
        {showDebugInfo && (
          <div className="text-xs text-gray-500 space-y-1">
            <div>Buffering: {isBuffering ? 'Yes' : 'No'}</div>
            <div>Ready: {isReady ? 'Yes' : 'No'}</div>
            <div>Dragging: {isDragging ? 'Yes' : 'No'}</div>
          </div>
        )}
      </div>

      {/* Styles */}
      <style jsx>{`
        .range-lg::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #87CEEB;
          border-radius: 50%;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .range-lg:hover::-webkit-slider-thumb {
          opacity: 1;
        }
        .range-lg::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #87CEEB;
          border-radius: 50%;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
          border: none;
        }
        .range-lg:hover::-moz-range-thumb {
          opacity: 1;
        }
        .range-lg:focus {
          outline: none;
        }
        .range-lg:focus::-webkit-slider-thumb {
          opacity: 1;
          box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.3);
        }
        .range-lg:focus::-moz-range-thumb {
          opacity: 1;
          box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.3);
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default EnhancedAudioPlayer;