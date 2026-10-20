"use client";

import React, { useMemo, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';

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
}

const DEFAULT_FONT_STACK = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Heiti SC", "Microsoft YaHei", sans-serif';
const BASE_FONT_PX = 96;
const LINE_HEIGHT_RATIO = 1.25;
const VERTICAL_LINE_HEIGHT_RATIO = 1.1;
const PADDING_RATIO = 0.45;

type Orientation = 'horizontal' | 'vertical';

interface BillboardData {
  texture: THREE.CanvasTexture;
  aspect: number;
  heightMultiplier: number;
  glyphCount: number;
  fontPx: number;
  canvasWidth: number;
}

function createTextBillboard({
  text,
  align,
  orientation,
  verticalAlign,
  fontFamily,
  fontSizeMultiplier = 1.0,
}: {
  text: string;
  align: 'left' | 'right';
  orientation: Orientation;
  verticalAlign: 'top' | 'bottom';
  fontFamily?: string;
  fontSizeMultiplier?: number;
}): BillboardData | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const dpr = window.devicePixelRatio || 1;
  const fontPx = BASE_FONT_PX * dpr * fontSizeMultiplier;
  const padding = fontPx * PADDING_RATIO;

  const resolvedStack = fontFamily ? `${fontFamily}, ${DEFAULT_FONT_STACK}` : DEFAULT_FONT_STACK;
  ctx.font = `${fontPx}px ${resolvedStack}`;
  
  ctx.textBaseline = 'middle';
  ctx.textAlign = orientation === 'horizontal' ? align : 'center';

  const glyphs = Array.from(text || ' ');
  const safeGlyphs = glyphs.length === 0 ? ['　'] : glyphs;
  const glyphCount = safeGlyphs.length;

  let canvasWidth: number;
  let canvasHeight: number;

  if (orientation === 'horizontal') {
    const lineHeight = fontPx * LINE_HEIGHT_RATIO;
    const measured = ctx.measureText(text || ' ');
    const textWidth = Math.max(measured.width, fontPx * 0.5);
    canvasWidth = Math.ceil(textWidth + padding * 2);
    canvasHeight = Math.ceil(lineHeight + padding * 2);
  } else {
    const columnWidth = fontPx;
    const verticalSpacing = fontPx * VERTICAL_LINE_HEIGHT_RATIO;
    canvasWidth = Math.ceil(columnWidth + padding * 2);
    canvasHeight = Math.ceil(verticalSpacing * glyphCount + padding * 2);
  }

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  ctx.font = `${fontPx}px ${resolvedStack}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = orientation === 'horizontal' ? align : 'center';
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  // Bake only glyph coverage. Color, opacity and feathering are material uniforms.
  ctx.fillStyle = '#ffffff';

  if (orientation === 'horizontal') {
    const textX = align === 'left' ? padding : canvasWidth - padding;
    const textY = canvasHeight / 2;
    ctx.fillText(text || ' ', textX, textY);
  } else {
    const centerX = canvasWidth / 2;
    const verticalSpacing = fontPx * VERTICAL_LINE_HEIGHT_RATIO;
    const alignMode = verticalAlign;
    const startY = alignMode === 'top'
      ? padding + verticalSpacing / 2
      : canvasHeight - padding - verticalSpacing * (glyphCount - 0.5);

    safeGlyphs.forEach((glyph, index) => {
      const charY = startY + verticalSpacing * index;
      ctx.fillText(glyph, centerX, charY);
    });
  }

  const baseCanvasHeight = fontPx * (LINE_HEIGHT_RATIO + 2 * PADDING_RATIO);
  const heightMultiplier = baseCanvasHeight > 0 ? canvasHeight / baseCanvasHeight : 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return {
    texture,
    aspect: canvasWidth / canvasHeight,
    heightMultiplier,
    glyphCount,
    fontPx,
    canvasWidth,
  };
}

const LyricBillboard: React.FC<LyricBillboardProps> = ({
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
}) => {
  const billboard = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return createTextBillboard({
      text,
      align,
      orientation,
      verticalAlign,
      fontFamily,
      fontSizeMultiplier,
    });
  }, [align, orientation, text, verticalAlign, fontFamily, fontSizeMultiplier, fontRevision]);

  const feather = useRef({ value: 0 });
  if (billboard && edgeFeather > 0) {
    const base = billboard.fontPx * (orientation === 'vertical' ? 1.35 : 0.85);
    const extra = billboard.fontPx * (orientation === 'vertical' ? 2.6 : 1.8) * Math.min(edgeFeather, 1);
    feather.current.value = Math.min(Math.max(base + extra, billboard.fontPx * 0.35) / billboard.canvasWidth, 0.49);
  } else {
    feather.current.value = 0;
  }
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

  useEffect(() => {
    return () => {
      billboard?.texture.dispose();
    };
  }, [billboard]);

  if (!billboard || opacity <= 0) {
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
    <mesh position={[x + offsetX, y + anchorYOffset, z]} scale={[planeWidth, planeHeight, 1]} renderOrder={renderOrder}>
      <planeGeometry args={[1, 1]} />
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
};

export default LyricBillboard;
