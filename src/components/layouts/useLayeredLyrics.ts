import { useMemo } from 'react';
import type { LyricLine } from '@/types';

export type LayerType = 'front' | 'back-near' | 'back-far';

export interface LayeredLyricItem {
  key: string;
  text: string;
  absoluteIndex: number;
  relativeOffset: number;
  isCurrent: boolean;
  isLeft: boolean;
  layer: LayerType;
  x: number;
  y: number;
  z: number;
  opacity: number;
  scale: number;
  renderOrder: number;
}

export interface UseLayeredLyricsOptions {
  range?: number;
  horizontalOffset?: number;
  verticalSpacing?: number;
  frontDepth?: number;
  backNearDepth?: number;
  backFarDepth?: number;
}

interface UseLayeredLyricsParams {
  lyrics: LyricLine[];
  scrollTime: number;
  duration: number;
  options?: UseLayeredLyricsOptions;
}

export interface UseLayeredLyricsResult {
  front: LayeredLyricItem[];
  back: LayeredLyricItem[];
  current: LayeredLyricItem | null;
}

const DEFAULT_RANGE = 6;
const DEFAULT_HORIZONTAL_OFFSET = 1.5;
const DEFAULT_VERTICAL_SPACING = 1.15;
const DEFAULT_FRONT_DEPTH = 0;
const DEFAULT_BACK_NEAR_DEPTH = 0.1;
const DEFAULT_BACK_FAR_DEPTH = 0.2;
const SCROLL_AHEAD_MARGIN = 0;

export function useLayeredLyrics({
  lyrics,
  scrollTime,
  duration,
  options
}: UseLayeredLyricsParams): UseLayeredLyricsResult {
  const {
    range = DEFAULT_RANGE,
    horizontalOffset = DEFAULT_HORIZONTAL_OFFSET,
    verticalSpacing = DEFAULT_VERTICAL_SPACING,
    frontDepth = DEFAULT_FRONT_DEPTH,
    backNearDepth = DEFAULT_BACK_NEAR_DEPTH,
    backFarDepth = DEFAULT_BACK_FAR_DEPTH
  } = options || {};

  return useMemo(() => {
    if (!lyrics || lyrics.length === 0) {
      return { front: [], back: [], current: null };
    }

    const totalLines = lyrics.length;
    const safeDuration = Math.max(1, duration || 1);
    const normalizedTime = ((scrollTime % safeDuration) + safeDuration) % safeDuration;

    let currentIndex = -1;
    for (let i = 0; i < totalLines; i++) {
      if (lyrics[i].time <= normalizedTime) {
        currentIndex = i;
      } else {
        break;
      }
    }

    if (currentIndex < 0) {
      currentIndex = 0;
    }

    const loopCount = Math.floor(scrollTime / safeDuration);
    const absoluteCurrentIndex = loopCount * totalLines + currentIndex;

    const currentLine = lyrics[currentIndex];
    const currentTime = currentLine?.time ?? 0;

    let nextIndex = currentIndex + 1;
    let nextLoop = loopCount;
    if (nextIndex >= totalLines) {
      nextIndex = 0;
      nextLoop += 1;
    }

    const nextLine = lyrics[nextIndex];
    const nextTimeBase = nextLine?.time ?? 0;
    const nextTime = nextLoop * safeDuration + nextTimeBase;

    const currentAbsoluteTime = loopCount * safeDuration + currentTime;
    let adjustedTime = loopCount * safeDuration + normalizedTime;
    if (adjustedTime < currentAbsoluteTime && nextLoop > loopCount) {
      adjustedTime += safeDuration;
    }

    let progressToNext = 0;
    if (nextTime > currentAbsoluteTime) {
      progressToNext = (adjustedTime - currentAbsoluteTime) / (nextTime - currentAbsoluteTime);
    }
    progressToNext = Math.min(Math.max(progressToNext, 0), 0.999);

    const progressWithLead = Math.min(Math.max(progressToNext + SCROLL_AHEAD_MARGIN, 0), 0.999);
    const currentIndexContinuous = absoluteCurrentIndex + progressWithLead;

    const items: LayeredLyricItem[] = [];

    for (let offset = -range; offset <= range; offset++) {
      const targetAbsoluteIndex = absoluteCurrentIndex + offset;
      const wrappedIndex = ((targetAbsoluteIndex % totalLines) + totalLines) % totalLines;
      const lyric = lyrics[wrappedIndex];
      if (!lyric) continue;

      const rawText = lyric.text ?? '';
      const trimmedText = rawText.trim();
      const displayText = trimmedText === '' ? '　' : trimmedText;
      const relativeOffset = targetAbsoluteIndex - currentIndexContinuous;
      const isCurrent = Math.abs(relativeOffset) < 0.35;
      const loopParity = Math.floor(targetAbsoluteIndex / totalLines) % 2;
      const isLeft = ((wrappedIndex + loopParity) % 2) === 0;
      const sideOffset = isLeft ? -horizontalOffset : horizontalOffset;
      const verticalOffset = -relativeOffset * verticalSpacing;

      const layerCycle = wrappedIndex % 3;
      let layer: LayerType;
      let depth: number;
      if (layerCycle === 0) {
        layer = 'front';
        depth = frontDepth;
      } else if (layerCycle === 1) {
        layer = 'back-near';
        depth = backNearDepth;
      } else {
        layer = 'back-far';
        depth = backFarDepth;
      }

      const isBlank = trimmedText === '';
      const opacity = isBlank ? 0 : 1;
      const scale = 1;
      const renderOrder = layer === 'front'
        ? 2000 + targetAbsoluteIndex
        : 1000 + targetAbsoluteIndex;

      items.push({
        key: `${targetAbsoluteIndex}`,
        text: displayText,
        absoluteIndex: targetAbsoluteIndex,
        relativeOffset,
        isCurrent,
        isLeft,
        layer,
        x: sideOffset,
        y: verticalOffset,
        z: depth,
        opacity,
        scale,
        renderOrder
      });
    }

    const front = items
      .filter(item => item.layer === 'front')
      .sort((a, b) => a.relativeOffset - b.relativeOffset);
    const back = items
      .filter(item => item.layer !== 'front')
      .sort((a, b) => a.relativeOffset - b.relativeOffset);
    const current = items.find(item => item.isCurrent) || null;

    return { front, back, current };
  }, [
    lyrics,
    scrollTime,
    duration,
    range,
    horizontalOffset,
    verticalSpacing,
    frontDepth,
    backNearDepth,
    backFarDepth
  ]);
}
