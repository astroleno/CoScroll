"use client";

import React, { forwardRef, useMemo, useLayoutEffect, useState, useCallback, useRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import {createTextBillboard, featherWidth, LyricTextureCache} from './lyricTextureCache';
import {lyricIntersectsViewport, LyricViewport} from './lyricViewport';

interface LyricBillboardProps {
  text: string;
  position: [number, number, number];
  color: string;
  opacity: number;
  fontSize: number;
  align: 'left' | 'right';
  scale?: number;
  depthTest?: boolean;
  depthWrite?: boolean;
  renderOrder?: number;
  orientation?: 'horizontal' | 'vertical';
  verticalAlign?: 'top' | 'bottom';
  /** 可选：自定义字体族（需在外部通过 @font-face 注册） */
  fontFamily?: string;
  /** 可选：字体大小倍数（覆盖 fontSize） */
  fontSizeMultiplier?: number;
  /** 靠近边缘时的羽化强度（0-1） */
  edgeFeather?: number;
  /** 字体刷新修订号 */
  fontRevision?: number;
  /** Scene-owned cache; other layouts can retain their original local lifetime. */
  textureCache?: LyricTextureCache;
  viewportClip?: LyricViewport;
}

export interface LyricBillboardFrame {
  position: [number, number, number];
  color: string;
  opacity: number;
  scale: number;
  edgeFeather: number;
}

export interface LyricBillboardHandle {
  update(frame: LyricBillboardFrame): void;
  hide(): void;
}


const LyricBillboard = forwardRef<LyricBillboardHandle, LyricBillboardProps>(function LyricBillboard({
  text,
  position,
  color,
  opacity,
  fontSize,
  align,
  scale = 1,
  depthTest = false,
  depthWrite = false,
  renderOrder,
  orientation = 'horizontal',
  verticalAlign = 'top',
  fontFamily,
  fontSizeMultiplier = 1.0,
  edgeFeather = 0,
  fontRevision = 0,
  textureCache,
  viewportClip,
}, ref) {
  const meshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null);
  const recipe = useMemo(() => ({text, align, orientation, verticalAlign,
    fontFamily, fontSizeMultiplier, fontRevision}),
    [text, align, orientation, verticalAlign, fontFamily, fontSizeMultiplier, fontRevision]);
  const [cached, setCached] = useState<ReturnType<LyricTextureCache['get']> | null>(null);
  const localBillboard = useMemo(() => textureCache || typeof window === 'undefined'
    ? null : createTextBillboard(recipe), [textureCache, recipe]);
  const billboard = textureCache ? cached?.value : localBillboard;

  useLayoutEffect(() => {
    if (!textureCache) return;
    // Acquire and pin in the same committed effect. An abandoned concurrent
    // render must not leave unowned GPU textures or reference an evicted entry.
    const entry = textureCache.get(recipe);
    const release = textureCache.retain(entry);
    setCached(entry);
    return release;
  }, [textureCache, recipe]);
  useLayoutEffect(() => () => {localBillboard?.texture.dispose();}, [localBillboard]);

  const feather = useRef({ value: 0 });
  feather.current.value = billboard ? featherWidth(billboard, orientation, edgeFeather) : 0;

  useImperativeHandle(ref, () => ({
    hide() {if (meshRef.current) meshRef.current.visible = false;},
    update(frame) {
      const mesh = meshRef.current;
      if (!mesh || !billboard) return;
      const height = fontSize * frame.scale * billboard.heightMultiplier;
      const width = height * billboard.aspect;
      const offsetX = orientation === 'vertical' ? 0 : (align === 'left' ? width / 2 : -width / 2);
      const offsetY = orientation === 'vertical' ? (verticalAlign === 'top' ? -height / 2 : height / 2) : 0;
      mesh.position.set(frame.position[0] + offsetX, frame.position[1] + offsetY, frame.position[2]);
      mesh.scale.set(width, height, 1);
      mesh.visible = frame.opacity > 0 && text.trim().length > 0 &&
        lyricIntersectsViewport(mesh.position.x, mesh.position.y, width, height, viewportClip);
      mesh.material.opacity = frame.opacity;
      // React may have just committed a new window or font; restore the actual
      // material value instead of trusting a cache of its previous prop.
      mesh.material.color.set(frame.color);
      feather.current.value = featherWidth(billboard, orientation, frame.edgeFeather);
    },
  }), [billboard, fontSize, orientation, align, verticalAlign, text, viewportClip]);
  const applyFeather = useCallback((shader: Parameters<THREE.MeshBasicMaterial['onBeforeCompile']>[0]) => {
    shader.uniforms.uLyricFeather = feather.current;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLyricFeather;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
          if (uLyricFeather > 0.0) {
            diffuseColor.a *= clamp(min(vMapUv.x, 1.0 - vMapUv.x) / uLyricFeather, 0.0, 1.0);
          }
        #endif`);
  }, []);

  if (!billboard) {
    return null;
  }

  const [x, y, z] = position;
  const baseHeight = fontSize * scale;
  const planeHeight = baseHeight * billboard.heightMultiplier;
  const planeWidth = planeHeight * billboard.aspect;
  const offsetX = orientation === 'vertical'
    ? 0
    : (align === 'left' ? planeWidth / 2 : -planeWidth / 2);
  const anchorYOffset = orientation === 'vertical'
    ? (verticalAlign === 'top' ? -planeHeight / 2 : planeHeight / 2)
    : 0;

  return (
    <mesh ref={meshRef} geometry={textureCache?.geometry} visible={opacity > 0 && text.trim().length > 0 && lyricIntersectsViewport(x + offsetX, y + anchorYOffset, planeWidth, planeHeight, viewportClip)} position={[x + offsetX, y + anchorYOffset, z]} scale={[planeWidth, planeHeight, 1]} renderOrder={renderOrder}>
      {!textureCache && <planeGeometry args={[1, 1]} />}
      <meshBasicMaterial
        map={billboard.texture}
        color={color}
        onBeforeCompile={applyFeather}
        transparent
        opacity={opacity}
        depthWrite={depthWrite}
        depthTest={depthTest}
        premultipliedAlpha={false}
        toneMapped={false}
      />
    </mesh>
  );
});

export default LyricBillboard;
