import * as THREE from 'three';
import {RetainedResourceCache} from '@/utils/retainedResourceCache';

const DEFAULT_FONT_STACK = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Heiti SC", "Microsoft YaHei", sans-serif';
const BASE_FONT_PX = 96;
const LINE_HEIGHT_RATIO = 1.25;
const VERTICAL_LINE_HEIGHT_RATIO = 1.1;
const PADDING_RATIO = 0.45;

type Orientation = 'horizontal' | 'vertical';

export interface BillboardData {
  texture: THREE.CanvasTexture;
  aspect: number;
  heightMultiplier: number;
  glyphCount: number;
  fontPx: number;
  canvasWidth: number;
}

export function featherWidth(billboard: BillboardData, orientation: Orientation, amount: number): number {
  if (amount <= 0) return 0;
  const base = billboard.fontPx * (orientation === 'vertical' ? 1.35 : .85);
  const extra = billboard.fontPx * (orientation === 'vertical' ? 2.6 : 1.8) * Math.min(amount, 1);
  return Math.min(Math.max(base + extra, billboard.fontPx * .35) / billboard.canvasWidth, .49);
}

export function createTextBillboard({
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


export type BillboardRecipe = Parameters<typeof createTextBillboard>[0] & {fontRevision: number};
export class LyricTextureCache {
  readonly geometry = new THREE.PlaneGeometry(1, 1);
  private cache = new RetainedResourceCache<string, BillboardData>(data => data.texture.dispose());
  private owners = 0;
  retainOwner() {
    this.owners++;
    return () => {
      this.owners--;
      // React StrictMode remounts effects before this microtask runs.
      queueMicrotask(() => { if (this.owners === 0) this.dispose(); });
    };
  }
  get(recipe: BillboardRecipe) {
    const key = JSON.stringify([recipe.text, recipe.align, recipe.orientation, recipe.verticalAlign,
      recipe.fontFamily, recipe.fontSizeMultiplier ?? 1, recipe.fontRevision,
      typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1]);
    return this.cache.get(key, () => {
      const value = createTextBillboard(recipe);
      if (!value) throw new Error('A 2D canvas is required for lyric text');
      return {value, bytes: Math.ceil(value.texture.image.width * value.texture.image.height * 4 * 4 / 3)};
    });
  }
  retain(entry: ReturnType<LyricTextureCache['get']>) { return this.cache.retain(entry); }
  trim() { this.cache.trim(); }
  dispose() { this.cache.clear(); this.geometry.dispose(); }
}
