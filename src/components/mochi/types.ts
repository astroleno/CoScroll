export interface MochiSphereProps {
  // 几何
  radius?: number;
  segments?: number;

  // 主材质
  roughness?: number;
  transmission?: number;
  thickness?: number;
  baseColor?: string;
  attenuationColor?: string;

  // Fresnel 边缘发光
  glowColor?: string;
  fresnelPower?: number;
  rimRange?: [number, number];
  glowIntensity?: number;

  // 外壳层
  shellCount?: number;
  shellOffsets?: number[];

  // Bloom 后期
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;

  // 交互
  autoRotate?: boolean;
  rotationSpeed?: number;

  // 主题预设
  theme?: 'pastel' | 'rainbow' | 'warm' | 'cool';

  // 性能
  enableTransmission?: boolean; // 移动端可关闭
}

export interface MochiTheme {
  baseColor: string;
  attenuationColor: string;
  glowColor: string;
  background: [string, string]; // 渐变双色
}
