"use client";

import React, { useMemo, useEffect } from 'react';
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
}

function createTextBillboard({
  text,
  color,
  align,
  orientation,
  verticalAlign,
  fontFamily,
  fontSizeMultiplier = 1.0,
  edgeFeather = 0,
}: {
  text: string;
  color: string;
  align: 'left' | 'right';
  orientation: Orientation;
  verticalAlign: 'top' | 'bottom';
  fontFamily?: string;
  fontSizeMultiplier?: number;
  edgeFeather?: number;
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
  
  // 调试：检查字体是否正确应用
  if (fontFamily) {
    console.log('[LyricBillboard] 使用字体:', fontFamily, '完整栈:', resolvedStack);
    console.log('[LyricBillboard] 实际字体:', ctx.font);
  }
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
  ctx.fillStyle = color;

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

  if (edgeFeather > 0) {
    const clamped = Math.min(Math.max(edgeFeather, 0), 1);
    const baseFeatherPx = fontPx * (orientation === 'vertical' ? 1.35 : 0.85);
    const extraFeatherPx = fontPx * (orientation === 'vertical' ? 2.6 : 1.8) * clamped;
    const featherPx = Math.min(Math.max(baseFeatherPx + extraFeatherPx, fontPx * 0.35), canvasWidth * 0.49);

    const innerStartRatio = canvasWidth > 0 ? Math.min(Math.max(featherPx / canvasWidth, 0), 0.49) : 0.0;
    const innerEndRatio = 1 - innerStartRatio;

    if (innerEndRatio > innerStartRatio) {
      const gradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(innerStartRatio, 'rgba(0,0,0,1)');
      gradient.addColorStop(innerEndRatio, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.globalCompositeOperation = 'source-over';
    }
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
}) => {
  const billboard = useMemo(() => {
    if (typeof window === 'undefined' || opacity <= 0) return null;
    return createTextBillboard({
      text,
      color,
      align,
      orientation,
      verticalAlign,
      fontFamily,
      fontSizeMultiplier,
      edgeFeather,
    });
  }, [align, color, opacity, orientation, text, verticalAlign, fontFamily, fontSizeMultiplier, edgeFeather]);

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
    <mesh position={[x + offsetX, y + anchorYOffset, z]} renderOrder={renderOrder}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshBasicMaterial
        map={billboard.texture}
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
