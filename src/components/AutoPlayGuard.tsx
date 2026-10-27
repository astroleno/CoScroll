"use client";

import { useEffect, useId, useState } from "react";
import OpeningPrompt from './OpeningPrompt';
import type { OpeningConfig } from '@/config/types';

interface AutoPlayGuardProps {
  title?: string;
  opening?: OpeningConfig;
  onUserInteraction: () => void;
  isReady: boolean;
  isPlaying: boolean;
}

export default function AutoPlayGuard({ onUserInteraction, title = '心经', opening }: AutoPlayGuardProps) {
  const [mounted, setMounted] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [hasClicked, setHasClicked] = useState(false);
  const prefaceId = useId();

  useEffect(() => {
    if (!hasClicked) {
      setShouldShow(true);
    }
    setMounted(true);
  }, [hasClicked]);

  const handleClick = () => {
    setHasClicked(true);
    setShouldShow(false);
    onUserInteraction();
  };

  if (!mounted || !shouldShow) return null;

  return (
    <button
      type="button"
      aria-label={`点击开始${title}`}
      aria-describedby={opening ? prefaceId : undefined}
      data-coscroll-intro
      className="intro-start"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // The page owns the shared shader; this layer only handles the gesture.
        background: 'transparent',
        border: 0,
        padding: 0,
        fontFamily: 'inherit',
        color: '#e2e8f0',
        zIndex: 2147483647,
        cursor: 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
        fontSize: '16px'
      }}
      onClick={handleClick}
    >
      <span className="intro-copy" style={{ display: 'block', textAlign: 'center' }}>
        {opening && <OpeningPrompt key={opening.revision} opening={opening} textId={prefaceId} />}
      </span>
      <style jsx>{`
        .intro-start:focus-visible { outline: none; }
        .intro-start:focus-visible .intro-copy {
          outline: 2px solid #e2e8f0;
          outline-offset: 16px;
          border-radius: 4px;
        }
      `}</style>
    </button>
  );
}
