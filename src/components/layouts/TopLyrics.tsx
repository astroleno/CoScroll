"use client";

import React from 'react';
import type { LyricLine } from '@/types';
import { StackedLayoutProps } from './types';
import { useLayeredLyrics } from './useLayeredLyrics';
import LyricBillboard from './LyricBillboard';

interface TopLyricsProps extends StackedLayoutProps {}

export default function TopLyrics(props: TopLyricsProps) {
  const { scrollTime, duration, lyrics } = props;
  const lyricData = (lyrics || []) as LyricLine[];

  const isMobile = typeof navigator !== 'undefined'
    ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    : false;
  const isCompactMobile = isMobile && typeof window !== 'undefined' && window.innerHeight < 667;

  const baseFontSize = isMobile ? (isCompactMobile ? 0.48 : 0.54) : 0.62;
  const horizontalOffset = isMobile ? 1.6 : 1.85;
  const verticalSpacing = isMobile ? 1.1 : 1.26;

  const { front } = useLayeredLyrics({
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

  return (
    <>
      {front.map((line) => (
        <LyricBillboard
          key={line.key}
          text={line.text}
          position={[line.x, line.y, line.z]}
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
