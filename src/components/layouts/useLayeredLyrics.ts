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
  verticalAlign: 'top' | 'bottom';
  edgeFeather: number;
}

export interface UseLayeredLyricsOptions {
  range?: number;
  horizontalOffset?: number;
  verticalSpacing?: number;
  frontDepth?: number;
  backNearDepth?: number;
  backFarDepth?: number;
  movementAxis?: 'vertical' | 'horizontal';
  travelSpacing?: number;
  laneSeparation?: number;
  topLaneY?: number;
  bottomLaneY?: number;
  edgeFeatherStart?: number;
  edgeFadeStart?: number;
  edgeFeatherExponent?: number;
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
const DEFAULT_MOVEMENT_AXIS: 'vertical' | 'horizontal' = 'vertical';
const DEFAULT_TOP_LANE_Y = 2.6;
const DEFAULT_BOTTOM_LANE_Y = -2.6;
const DEFAULT_EDGE_FEATHER_START = 0.28;
const DEFAULT_EDGE_FADE_START = 0.48;
const DEFAULT_EDGE_FEATHER_EXPONENT = 0.85;

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
    backFarDepth = DEFAULT_BACK_FAR_DEPTH,
    movementAxis = DEFAULT_MOVEMENT_AXIS,
    travelSpacing,
    topLaneY = DEFAULT_TOP_LANE_Y,
    bottomLaneY = DEFAULT_BOTTOM_LANE_Y,
    edgeFeatherStart = DEFAULT_EDGE_FEATHER_START,
    edgeFadeStart = DEFAULT_EDGE_FADE_START,
    edgeFeatherExponent = DEFAULT_EDGE_FEATHER_EXPONENT,
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

    const movement = movementAxis === 'horizontal' ? 'horizontal' : 'vertical';
    const travelStep = Math.max(0.01, travelSpacing ?? verticalSpacing * 0.85);

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
      const isTopLane = (wrappedIndex % 2) === 0;
      const isLeft = isTopLane; // 竖排下用于 renderOrder 的占位变量
      let x: number;
      let y: number;
      let verticalAlign: 'top' | 'bottom';
      const isCurrent = targetAbsoluteIndex === absoluteCurrentIndex;
      let distanceRatio = 0;

      if (movement === 'horizontal') {
        const clampedOffset = Math.max(-range, Math.min(range, relativeOffset));
        const travelLimit = range * travelStep;
        const travelOffset = Math.max(-travelLimit, Math.min(travelLimit, clampedOffset * travelStep));
        x = travelOffset;
        y = isTopLane ? topLaneY : bottomLaneY;
        verticalAlign = isTopLane ? 'top' : 'bottom';
        distanceRatio = travelLimit > 0 ? Math.abs(travelOffset) / travelLimit : 0;
      } else {
        const sideOffset = isLeft ? -horizontalOffset : horizontalOffset;
        const verticalOffset = -relativeOffset * verticalSpacing;
        x = sideOffset;
        y = verticalOffset;
        verticalAlign = verticalOffset >= 0 ? 'top' : 'bottom';
      }

      // 固定前后层：靠近当前的歌词位于前景，超出的歌词放置在后景
      let layer: LayerType;
      let depth: number;
      if (movement === 'horizontal') {
        const patternIndex = wrappedIndex % 3;
        if (patternIndex === 0) {
          layer = 'back-far';
          depth = backFarDepth;
        } else if (patternIndex === 1) {
          layer = 'front';
          depth = frontDepth - 0.45;
        } else {
          layer = 'front';
          depth = frontDepth;
        }
      } else {
        const absOffset = Math.abs(relativeOffset);
        if (absOffset <= 0.55) {
          layer = 'front';
          depth = frontDepth;
        } else if (relativeOffset < 0) {
          layer = 'back-near';
          depth = backNearDepth;
        } else {
          layer = 'back-far';
          depth = backFarDepth;
        }
      }

      const isBlank = trimmedText === '';
      let opacity = isBlank ? 0 : 1;
      let edgeFeather = 0;
      if (!isBlank && movement === 'horizontal') {
        const effectiveFeatherStart = Math.min(Math.max(edgeFeatherStart, 0), 0.95);
        const effectiveFadeStart = Math.min(Math.max(edgeFadeStart, effectiveFeatherStart + 0.02), 0.98);

        if (distanceRatio >= effectiveFeatherStart) {
          const denom = Math.max(1 - effectiveFeatherStart, 1e-3);
          const featherNorm = Math.min(1, (distanceRatio - effectiveFeatherStart) / denom);
          edgeFeather = Math.pow(featherNorm, Math.max(0.1, edgeFeatherExponent));
        }

        if (distanceRatio >= effectiveFadeStart) {
          const denom = Math.max(1 - effectiveFadeStart, 1e-3);
          const fadeNorm = Math.min(1, (distanceRatio - effectiveFadeStart) / denom);
          const eased = fadeNorm * fadeNorm * (3 - 2 * fadeNorm);
          opacity = Math.max(0, 1 - eased);
        }
      }
      const scale = 1;
      let renderOrder: number;
      if (movement === 'horizontal') {
        const patternIndex = wrappedIndex % 3;
        if (patternIndex === 0) {
          renderOrder = 2100 + wrappedIndex;
        } else if (patternIndex === 1) {
          renderOrder = 3300 + (isTopLane ? 120 : 80) + wrappedIndex;
        } else {
          renderOrder = 3400 + (isTopLane ? 120 : 80) + wrappedIndex;
        }
      } else {
        renderOrder = layer === 'front'
          ? 2000 + targetAbsoluteIndex + (isTopLane ? 120 : 80)
          : 1000 + targetAbsoluteIndex;
      }

      items.push({
        key: `${targetAbsoluteIndex}`,
        text: displayText,
        absoluteIndex: targetAbsoluteIndex,
        relativeOffset,
        isCurrent,
        isLeft,
        layer,
        x,
        y,
        z: depth,
        opacity,
        scale,
        renderOrder,
        verticalAlign,
        edgeFeather
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
    backFarDepth,
    movementAxis,
    travelSpacing,
    topLaneY,
    bottomLaneY,
    edgeFeatherStart,
    edgeFadeStart,
    edgeFeatherExponent
  ]);
}
