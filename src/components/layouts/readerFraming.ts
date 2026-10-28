import type {LyricLine} from '@/types';

export interface ReaderBounds { minY: number; maxY: number }

/** Full columns, including the texture's transparent padding, in scene coordinates. */
export function readerBounds({lyrics, fontSize, topLaneY, bottomLaneY, yOffset, modelScale, modelYOffset}: {
  lyrics: LyricLine[]; fontSize: number; topLaneY: number; bottomLaneY: number;
  yOffset: number; modelScale: number; modelYOffset: number;
}): ReaderBounds {
  // The admitted models have a unit-height source envelope; .01 includes the outer shell.
  let minY = modelYOffset - modelScale * .51;
  let maxY = modelYOffset + modelScale * .51;
  lyrics.forEach((line, index) => {
    const count = Array.from(line.text.trim()).length;
    if (!count) return;
    const height = fontSize * ((count * 1.1 + .9) / 2.15 + 1 / 96);
    const anchor = (index % 2 === 0 ? topLaneY : bottomLaneY) + yOffset;
    minY = Math.min(minY, index % 2 === 0 ? anchor - height : anchor);
    maxY = Math.max(maxY, index % 2 === 0 ? anchor : anchor + height);
  });
  return {minY: minY - .02, maxY: maxY + .02};
}

/** Keep the original view whenever it fits; otherwise frame the entire composition once. */
export function fitReaderFrame(height: number, baseZoom: number, bounds: ReaderBounds) {
  const top = Math.min(64, height * .25), bottom = Math.min(8, height * .1);
  if (height <= 0 || (height / 2 - bounds.maxY * baseZoom >= top &&
      height / 2 + bounds.minY * baseZoom >= bottom)) return {zoom: baseZoom, centerY: 0};
  const zoom = Math.min(baseZoom, Math.max(1, height - top - bottom) / (bounds.maxY - bounds.minY));
  return {zoom, centerY: (bounds.minY + bounds.maxY) / 2 + (top - bottom) / (2 * zoom)};
}
