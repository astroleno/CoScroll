"use client";

import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { LyricLine } from '@/types';
import LyricBillboard, { LyricBillboardHandle } from './LyricBillboard';
import { calculateLayeredLyrics, lyricWindowKey } from './layeredLyrics';
import type { LayeredLyricItem, UseLayeredLyricsOptions, UseLayeredLyricsResult } from './layeredLyrics';
import { advanceLyricMotion, LyricMotionInput, LyricMotionState } from './lyricMotion';
import {LyricTextureCache, BillboardRecipe} from './lyricTextureCache';
import {scheduleIdle} from '@/utils/scheduleIdle';
import {prepareMaterialPrograms} from '@/utils/prepareMaterialPrograms';
import {loopPhase} from '@/utils/loopTimeline';
import type {OrthographicCamera} from 'three';

interface LayeredLyricsSceneProps {
  lyrics: LyricLine[];
  inputRef: React.MutableRefObject<LyricMotionInput>;
  options: UseLayeredLyricsOptions;
  frontFontSize: number;
  backFontSize: number;
  yOffset: number;
  fontFamily?: string;
  fontRevision: number;
  currentColor: string;
  adjacentColor: string;
}

function LayeredLyricsScene({lyrics, inputRef, options, frontFontSize, backFontSize, yOffset, fontFamily, fontRevision, currentColor, adjacentColor}: LayeredLyricsSceneProps) {
  const {gl, scene, camera, get, size} = useThree();
  const viewportClip = useMemo(() => {
    const c = camera as OrthographicCamera;
    if (!c.isOrthographicCamera || c.view?.enabled || c.parent ||
        Math.abs(c.quaternion.x) + Math.abs(c.quaternion.y) + Math.abs(c.quaternion.z) > 1e-10) return undefined;
    return {left: c.left / c.zoom + c.position.x, right: c.right / c.zoom + c.position.x,
      top: c.top / c.zoom + c.position.y, bottom: c.bottom / c.zoom + c.position.y, margin: 1 / c.zoom};
  }, [camera, size.width, size.height]);
  const textureCache = useMemo(() => new LyricTextureCache(), []);
  const calculate = (time: number) => calculateLayeredLyrics({lyrics, scrollTime: time, duration: inputRef.current.duration, options});
  const [windowLayout, setWindowLayout] = useState(() => calculate(inputRef.current.scrollTimeRef?.current ?? inputRef.current.scrollTime));
  const windowKey = useRef(lyricWindowKey(windowLayout));
  const latestLayout = useRef(windowLayout);
  const handles = useRef(new Map<string, LyricBillboardHandle>());
  const motion = useRef<LyricMotionState | null>(null);
  const travelDirection = useRef(1);

  useEffect(() => textureCache.retainOwner(), [textureCache]);

  useEffect(() => {
    if (!lyrics.length) return;
    let cancelled = false, cancel = () => {};
    const recipes: BillboardRecipe[] = [];
    const add = (text: string, top: boolean) => recipes.push({text: text.trim() ? text : '　',
      align: top ? 'left' : 'right', orientation: 'vertical', verticalAlign: top ? 'top' : 'bottom',
      fontFamily, fontRevision, fontSizeMultiplier: 1});
    // Upload the existing window during the cover, then prepare two columns
    // beyond either edge so bidirectional movement does not rasterize on entry.
    const direction = travelDirection.current;
    const center = viewportClip ? (viewportClip.left + viewportClip.right) / 2 : 0;
    const warmLimit = viewportClip ? (viewportClip.right - viewportClip.left) / 2 + (options.travelSpacing ?? .85) * 2 + 1 : Infinity;
    const nearby = [...windowLayout.back, ...windowLayout.front]
      .filter(item => Math.abs(item.x - center) <= warmLimit)
      .sort((a,b) => Number(a.relativeOffset * direction > 0) - Number(b.relativeOffset * direction > 0) || Math.abs(b.x - center) - Math.abs(a.x - center));
    for (const item of nearby) add(item.text, item.isLeft);
    const current = windowLayout.current;
    if (current && options.movementAxis === 'horizontal' && !viewportClip) {
      const range = options.range ?? 6;
      // Prepare the likely next column last, so it remains newest if a long
      // lyric makes the idle-byte budget evict less useful look-behind data.
      for (const offset of [-direction * (range + 2), -direction * (range + 1), direction * (range + 2), direction * (range + 1)]) {
        const index = loopPhase(current.absoluteIndex + offset, lyrics.length);
        add(lyrics[index].text, index % 2 === 0);
      }
    }
    const prepare = () => {
      if (cancelled) return;
      const recipe = recipes.shift();
      if (recipe) {
        const entry = textureCache.get(recipe);
        if (recipe.text.trim()) gl.initTexture(entry.value.texture);
        textureCache.trim();
        cancel = scheduleIdle(prepare);
      } else {
        // Public async compiler keeps first-use program linking out of a line
        // transition. Rendering formulas, samples and material values are intact.
        void prepareMaterialPrograms(gl, scene, camera).then(() => {
          if (!cancelled && get().frameloop === 'never') gl.render(scene, camera);
        }).catch(error => console.warn('[Lyrics] Material preparation failed', error));
      }
    };
    cancel = scheduleIdle(prepare);
    return () => { cancelled = true; cancel(); };
  }, [windowLayout, lyrics, options, fontFamily, fontRevision, textureCache, gl, scene, camera, get, viewportClip]);

  const applyLayout = (layout: UseLayeredLyricsResult) => {
    // The old window can survive one concurrent React commit at a line boundary.
    handles.current.forEach(handle => handle.hide());
    const update = (items: LayeredLyricItem[], back: boolean) => items.forEach((item, index) => {
      handles.current.get(item.key)?.update({
        position: [item.x, item.y + yOffset, item.z + (back ? index * .01 : 0)],
        color: item.isCurrent ? currentColor : adjacentColor, opacity: item.opacity,
        scale: item.scale, edgeFeather: item.edgeFeather,
      });
    });
    update(layout.back, true);
    update(layout.front, false);
  };

  useFrame(() => {
    const previousTime = motion.current?.profile.time;
    motion.current = advanceLyricMotion(motion.current, inputRef.current, performance.now());
    if (previousTime !== undefined && Math.abs(motion.current.profile.time - previousTime) > 1e-6) {
      travelDirection.current = Math.sign(motion.current.profile.time - previousTime);
    }
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
      color={item.isCurrent ? currentColor : adjacentColor}
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
      textureCache={textureCache}
      viewportClip={viewportClip}
    />
  ));

  return <>
    <group renderOrder={1000}>{renderItems(windowLayout.back, true)}</group>
    <group renderOrder={3000}>{renderItems(windowLayout.front, false)}</group>
  </>;
}

export default memo(LayeredLyricsScene);
