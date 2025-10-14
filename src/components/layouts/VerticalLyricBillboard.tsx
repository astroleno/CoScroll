"use client";

import React, { useMemo } from 'react';
import * as THREE from 'three';

interface VerticalLyricBillboardProps {
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

function createVerticalTextBillboard({
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

  // 设置字体
  ctx.font = `${fontPx}px ${FONT_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // 测量文字尺寸
  const measured = ctx.measureText(text || ' ');
  const textWidth = Math.max(measured.width, fontPx * 0.5);
  const textHeight = lineHeight;

  // 创建竖向画布 - 宽度是文字高度，高度是文字宽度
  const canvasWidth = Math.ceil(textHeight + padding * 2);
  const canvasHeight = Math.ceil(textWidth + padding * 2);

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // 设置字体
  ctx.font = `${fontPx}px ${FONT_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 使用CSS writing-mode实现真正的竖向显示
  ctx.save();
  
  // 设置竖向显示样式
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  
  // 将文字按字符分割，每个字符单独绘制
  const characters = (text || ' ').split('');
  const charHeight = textHeight / characters.length;
  
  characters.forEach((char, index) => {
    const charY = (index + 0.5) * charHeight;
    
    // Draw outer stroke
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    const strokeWidth = Math.max(0.75 * dpr, fontPx * 0.02);
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = 'rgba(6, 16, 28, 0.88)';
    ctx.strokeText(char, canvasWidth / 2, charY);
    
    // Fill main glyphs
    ctx.fillStyle = color;
    ctx.fillText(char, canvasWidth / 2, charY);
  });

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return {
    texture,
    aspect: canvasWidth / canvasHeight,
  };
}

const VerticalLyricBillboard: React.FC<VerticalLyricBillboardProps> = ({
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
    return createVerticalTextBillboard({
      text,
      color,
      align,
    });
  }, [align, color, opacity, text]);

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

export default VerticalLyricBillboard;
