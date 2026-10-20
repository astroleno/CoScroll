"use client";

import React, { memo, useLayoutEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { LyricLine } from '@/types';
import LyricBillboard, { LyricBillboardHandle } from './LyricBillboard';
import { calculateLayeredLyrics, lyricWindowKey } from './layeredLyrics';
import type { LayeredLyricItem, UseLayeredLyricsOptions, UseLayeredLyricsResult } from './layeredLyrics';
import { advanceLyricMotion, LyricMotionInput, LyricMotionState } from './lyricMotion';

interface LayeredLyricsSceneProps {
  lyrics: LyricLine[];
  inputRef: React.MutableRefObject<LyricMotionInput>;
  options: UseLayeredLyricsOptions;
  frontFontSize: number;
  backFontSize: number;
  yOffset: number;
  fontFamily?: string;
  fontRevision: number;
}

function LayeredLyricsScene({lyrics, inputRef, options, frontFontSize, backFontSize, yOffset, fontFamily, fontRevision}: LayeredLyricsSceneProps) {
  const calculate = (time: number) => calculateLayeredLyrics({lyrics, scrollTime: time, duration: inputRef.current.duration, options});
  const [windowLayout, setWindowLayout] = useState(() => calculate(inputRef.current.scrollTimeRef?.current ?? inputRef.current.scrollTime));
  const windowKey = useRef(lyricWindowKey(windowLayout));
  const latestLayout = useRef(windowLayout);
  const handles = useRef(new Map<string, LyricBillboardHandle>());
  const motion = useRef<LyricMotionState | null>(null);

  const applyLayout = (layout: UseLayeredLyricsResult) => {
    // The old window can survive one concurrent React commit at a line boundary.
    handles.current.forEach(handle => handle.hide());
    const update = (items: LayeredLyricItem[], back: boolean) => items.forEach((item, index) => {
      handles.current.get(item.key)?.update({
        position: [item.x, item.y + yOffset, item.z + (back ? index * .01 : 0)],
        color: item.isCurrent ? '#f8fafc' : '#cbd5f5', opacity: item.opacity,
        scale: item.scale, edgeFeather: item.edgeFeather,
      });
    });
    update(layout.back, true);
    update(layout.front, false);
  };

  useFrame(() => {
    motion.current = advanceLyricMotion(motion.current, inputRef.current, performance.now());
    const layout = calculate(motion.current.profile.time);
    latestLayout.current = layout;
    const nextKey = lyricWindowKey(layout);
    if (windowKey.current !== nextKey) {
      windowKey.current = nextKey;
      setWindowLayout(layout);
    }
    applyLayout(layout);
  });

  // Apply the freshest positions before painting a new window or font texture.
  useLayoutEffect(() => {applyLayout(latestLayout.current);});

  const renderItems = (items: LayeredLyricItem[], back: boolean) => items.map((item, index) => (
    <LyricBillboard
      key={item.key}
      ref={handle => {if (handle) handles.current.set(item.key, handle); else handles.current.delete(item.key);}}
      text={item.text}
      position={[item.x, item.y + yOffset, item.z + (back ? index * .01 : 0)]}
      fontSize={back ? backFontSize : frontFontSize}
      color={item.isCurrent ? '#f8fafc' : '#cbd5f5'}
      opacity={item.opacity}
      align={item.isLeft ? 'left' : 'right'}
      scale={item.scale}
      depthTest
      depthWrite
      renderOrder={item.renderOrder}
      orientation="vertical"
      verticalAlign={item.verticalAlign}
      fontFamily={fontFamily}
      edgeFeather={item.edgeFeather}
      fontRevision={fontRevision}
    />
  ));

  return <>
    <group renderOrder={1000}>{renderItems(windowLayout.back, true)}</group>
    <group renderOrder={3000}>{renderItems(windowLayout.front, false)}</group>
  </>;
}

export default memo(LayeredLyricsScene);
