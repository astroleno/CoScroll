import { MochiTheme } from './types';

export const mochiThemes: Record<string, MochiTheme> = {
  pastel: {
    baseColor: '#ffd4e5',
    attenuationColor: '#b8d4ff',
    glowColor: '#ffb3d9',
    background: ['#e8d4f2', '#d4e8ff']
  },
  rainbow: {
    baseColor: '#ffeb3b',
    attenuationColor: '#ff5722',
    glowColor: '#00bcd4',
    background: ['#b3e5fc', '#ffe0f0']
  },
  warm: {
    baseColor: '#ffe5cc',
    attenuationColor: '#ffccb3',
    glowColor: '#ff9999',
    background: ['#fff0e5', '#ffe6cc']
  },
  cool: {
    baseColor: '#cce5ff',
    attenuationColor: '#b3d9ff',
    glowColor: '#99ccff',
    background: ['#e6f2ff', '#cce0ff']
  }
};

export const defaultMochiConfig = {
  radius: 1,
  segments: 64,
  roughness: 0.95,
  transmission: 0.8,
  thickness: 1.5,
  fresnelPower: 2.5,
  rimRange: [0.2, 0.8] as [number, number],
  glowIntensity: 1.2,       // 提高发光强度
  shellCount: 3,
  shellOffsets: [0.02, 0.04, 0.06],
  bloomStrength: 1.8,       // 1.2 → 1.8（更强发光）
  bloomRadius: 0.9,         // 0.7 → 0.9（更大扩散）
  bloomThreshold: 0.4,      // 0.6 → 0.4（更低阈值，更多区域发光）
  autoRotate: true,
  rotationSpeed: 0.3,
  enableTransmission: true
};
