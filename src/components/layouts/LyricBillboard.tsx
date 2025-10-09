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
}

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Heiti SC", "Microsoft YaHei", sans-serif';
const BASE_FONT_PX = 96;
const LINE_HEIGHT_RATIO = 1.25;
const PADDING_RATIO = 0.45;

interface BillboardData {
  texture: THREE.CanvasTexture;
  aspect: number;
}

function createTextBillboard({
  text,
  color,
  align,
}: {
  text: string;
  color: string;
  align: 'left' | 'right';
}): BillboardData | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const dpr = window.devicePixelRatio || 1;
  const fontPx = BASE_FONT_PX * dpr;
  const padding = fontPx * PADDING_RATIO;
  const lineHeight = fontPx * LINE_HEIGHT_RATIO;

  ctx.font = `${fontPx}px ${FONT_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;

  const measured = ctx.measureText(text || ' ');
  const textWidth = Math.max(measured.width, fontPx * 0.5);

  const canvasWidth = Math.ceil(textWidth + padding * 2);
  const canvasHeight = Math.ceil(lineHeight + padding * 2);

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  ctx.font = `${fontPx}px ${FONT_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const textX = align === 'left' ? padding : canvasWidth - padding;
  const textY = canvasHeight / 2;

  // Draw outer stroke to preserve readability against dark backgrounds
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const strokeWidth = Math.max(0.75 * dpr, fontPx * 0.02);
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = 'rgba(6, 16, 28, 0.88)';
  ctx.strokeText(text || ' ', textX, textY);

  // Fill main glyphs
  ctx.fillStyle = color;
  ctx.fillText(text || ' ', textX, textY);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return {
    texture,
    aspect: canvasWidth / canvasHeight,
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
}) => {
  const billboard = useMemo(() => {
    if (typeof window === 'undefined' || opacity <= 0) return null;
    return createTextBillboard({
      text,
      color,
      align,
    });
  }, [align, color, opacity, text]);

  useEffect(() => {
    return () => {
      billboard?.texture.dispose();
    };
  }, [billboard]);

  if (!billboard || opacity <= 0) {
    return null;
  }

  const [x, y, z] = position;
  const planeHeight = fontSize * scale;
  const planeWidth = planeHeight * billboard.aspect;
  const offsetX = align === 'left' ? planeWidth / 2 : -planeWidth / 2;

  return (
    <mesh position={[x + offsetX, y, z]} renderOrder={renderOrder}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshBasicMaterial
        map={billboard.texture}
        transparent
        opacity={opacity}
        depthWrite={depthWrite}
        depthTest={depthTest}
        toneMapped={false}
      />
    </mesh>
  );
};

export default LyricBillboard;
