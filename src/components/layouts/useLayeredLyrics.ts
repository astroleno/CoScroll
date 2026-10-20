import { useMemo } from 'react';
import { calculateLayeredLyrics } from './layeredLyrics';
import type { UseLayeredLyricsParams } from './layeredLyrics';

export type { LayerType, LayeredLyricItem, UseLayeredLyricsOptions, UseLayeredLyricsResult } from './layeredLyrics';

export function useLayeredLyrics({lyrics, scrollTime, duration, options}: UseLayeredLyricsParams) {
  return useMemo(() => calculateLayeredLyrics({lyrics, scrollTime, duration, options}),
    [lyrics, scrollTime, duration, options]);
}
