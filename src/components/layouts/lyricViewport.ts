export interface LyricViewport { left: number; right: number; top: number; bottom: number; margin: number; }

/** A tall column's bounding sphere is much wider than the actual flat quad. */
export function lyricIntersectsViewport(x: number, y: number, width: number, height: number, clip?: LyricViewport): boolean {
  if (!clip) return true;
  return x + width / 2 >= clip.left - clip.margin && x - width / 2 <= clip.right + clip.margin &&
    y + height / 2 >= clip.bottom - clip.margin && y - height / 2 <= clip.top + clip.margin;
}
