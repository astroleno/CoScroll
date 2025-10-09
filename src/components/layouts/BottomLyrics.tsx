"use client";

import React from 'react';
import type { LyricLine } from '@/types';
import { StackedLayoutProps } from './types';
import { useLayeredLyrics } from './useLayeredLyrics';
import LyricBillboard from './LyricBillboard';

interface BottomLyricsProps extends StackedLayoutProps {}

export default function BottomLyrics(props: BottomLyricsProps) {
  const { scrollTime, duration, lyrics } = props;
  const lyricData = (lyrics || []) as LyricLine[];

  const isMobile = typeof navigator !== 'undefined'
    ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    : false;
  const isCompactMobile = isMobile && typeof window !== 'undefined' && window.innerHeight < 667;

  const baseFontSize = isMobile ? (isCompactMobile ? 0.44 : 0.5) : 0.58;
  const horizontalOffset = isMobile ? 1.6 : 1.85;
  const verticalSpacing = isMobile ? 1.1 : 1.26;

  const { back } = useLayeredLyrics({
    lyrics: lyricData,
    scrollTime,
    duration,
    options: {
      range: 6,
      horizontalOffset,
      verticalSpacing,
      frontDepth: -0.7,
      backNearDepth: 0.45,
      backFarDepth: 0.85
    }
  });

  const sortedBack = back.slice().sort((a, b) => a.relativeOffset - b.relativeOffset);

  return (
    <>
      {sortedBack.map((line, idx) => (
        <LyricBillboard
          key={line.key}
          text={line.text}
          position={[line.x, line.y, line.z + idx * 0.01]}
          fontSize={baseFontSize}
          color={line.isCurrent ? '#f8fafc' : '#cbd5f5'}
          opacity={line.opacity}
          align={line.isLeft ? 'left' : 'right'}
          scale={line.scale}
          depthTest={false}
          depthWrite={false}
          renderOrder={line.renderOrder}
        />
      ))}
    </>
  );
}
