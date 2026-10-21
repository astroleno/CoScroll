import type { AppearanceSettings, PaletteId, ProjectConfig } from './types';

export interface ScenePalette {
  background: string; container: string; jade: string; emissive: string;
  light: string; currentText: string; adjacentText: string; accent: string;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {background: 'silk', palette: 'original-jade', hueOffset: 0};
export const PALETTES: Record<PaletteId, {name: string; colors: ScenePalette}> = {
  'original-jade': {name: '原玉蓝', colors: {background: '#1f2e38', container: '#202734', jade: '#2d6d8b',
    emissive: '#0f2b38', light: '#4A90E2', currentText: '#f8fafc', adjacentText: '#cbd5f5', accent: '#87CEEB'}},
  'ink-green': {name: '青竹', colors: {background: '#20342d', container: '#1e2c27', jade: '#36745a',
    emissive: '#102e23', light: '#71b79a', currentText: '#f4faf6', adjacentText: '#cee3d8', accent: '#9ed9bd'}},
  'warm-gold': {name: '沉金', colors: {background: '#382e20', container: '#302a22', jade: '#8b7037',
    emissive: '#382a10', light: '#d4ae64', currentText: '#fcfaf4', adjacentText: '#e6d9bb', accent: '#e5c78d'}},
  'violet-gray': {name: '烟紫', colors: {background: '#302b38', container: '#292632', jade: '#6d5d8b',
    emissive: '#291e38', light: '#a895ce', currentText: '#faf8fc', adjacentText: '#dcd2ea', accent: '#c3b0df'}},
};

function shiftHue(hex: string, degrees: number): string {
  if (degrees === 0) return hex;
  const rgb = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
  const max = Math.max(...rgb), min = Math.min(...rgb), delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return hex;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = max === rgb[0] ? ((rgb[1] - rgb[2]) / delta) % 6
    : max === rgb[1] ? (rgb[2] - rgb[0]) / delta + 2 : (rgb[0] - rgb[1]) / delta + 4;
  hue = ((hue * 60 + degrees) % 360 + 360) % 360 / 60;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(hue % 2 - 1)), m = lightness - chroma / 2;
  const channels = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x]
    : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return '#' + channels.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('');
}

export function resolvePalette(settings: AppearanceSettings): ScenePalette {
  return Object.fromEntries(Object.entries(PALETTES[settings.palette].colors)
    .map(([key, color]) => [key, shiftHue(color, settings.hueOffset)])) as unknown as ScenePalette;
}

export function validAppearance(value: unknown): value is AppearanceSettings {
  const item = value as AppearanceSettings | null;
  return Boolean(item && item.background === 'silk' && Object.hasOwn(PALETTES, item.palette) &&
    Number.isFinite(item.hueOffset) && item.hueOffset >= -180 && item.hueOffset <= 180);
}

const preferenceKey = (id: string) => `coscroll:appearance:v1:${id}`;
export function resolveAppearance(project: ProjectConfig): AppearanceSettings {
  const recommended = project.appearance ?? DEFAULT_APPEARANCE;
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(preferenceKey(project.project.id)) ?? 'null');
    return validAppearance(stored) ? stored : recommended;
  } catch { return recommended; }
}
export function saveAppearance(id: string, settings: AppearanceSettings | null) {
  try {
    if (settings) localStorage.setItem(preferenceKey(id), JSON.stringify(settings));
    else localStorage.removeItem(preferenceKey(id));
  } catch { /* Playback and colors remain usable with storage disabled. */ }
}
