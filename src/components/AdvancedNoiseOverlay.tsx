"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * 高级噪点覆盖层组件
 * 使用程序化生成的噪点纹理，支持多种噪点类型和混合模式
 */
interface AdvancedNoiseOverlayProps {
  intensity?: number;        // 噪点强度 (0-1)
  scale?: number;           // 噪点缩放
  speed?: number;           // 动画速度
  opacity?: number;         // 整体透明度
  blendMode?: 'normal' | 'multiply' | 'overlay' | 'screen' | 'soft-light' | 'hard-light' | 'color-dodge' | 'color-burn';
  color?: string;           // 噪点颜色
  animated?: boolean;       // 是否动画
  className?: string;       // CSS 类名
  noiseType?: 'perlin' | 'simplex' | 'white' | 'blue' | 'pink'; // 噪点类型
  frequency?: number;       // 噪点频率
  octaves?: number;         // 噪点八度
  lacunarity?: number;      // 噪点间隙
  persistence?: number;      // 噪点持续性
}

export default function AdvancedNoiseOverlay({
  intensity = 0.03,
  scale = 1.0,
  speed = 1.0,
  opacity = 1.0,
  blendMode = 'normal',
  color = '#ffffff',
  animated = true,
  className = '',
  noiseType = 'perlin',
  frequency = 1.0,
  octaves = 4,
  lacunarity = 2.0,
  persistence = 0.5
}: AdvancedNoiseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // 2D Perlin 噪声实现
  const perlinNoise2D = useCallback((x: number, y: number, time: number = 0): number => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const xf = x - X;
    const yf = y - Y;

    // 添加时间维度
    const xt = x + time * 0.1;
    const yt = y + time * 0.1;

    const u = fade(xf);
    const v = fade(yf);

    const n00 = grad(hash(X, Y), xt, yt);
    const n01 = grad(hash(X, Y + 1), xt, yt - 1);
    const n10 = grad(hash(X + 1, Y), xt - 1, yt);
    const n11 = grad(hash(X + 1, Y + 1), xt - 1, yt - 1);

    const x1 = lerp(n00, n10, u);
    const x2 = lerp(n01, n11, u);
    return lerp(x1, x2, v);
  }, []);

  // 2D Simplex 噪声实现
  const simplexNoise2D = useCallback((x: number, y: number, time: number = 0): number => {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);

    let i1, j1;
    if (x0 > y0) {
      i1 = 1; j1 = 0;
    } else {
      i1 = 0; j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = perm[ii + perm[jj]] % 12;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    let n0 = 0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * dot(grad3[gi0], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    let n1 = 0;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * dot(grad3[gi1], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    let n2 = 0;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * dot(grad3[gi2], x2, y2);
    }

    return 70.0 * (n0 + n1 + n2);
  }, []);

  // 分形布朗运动 (FBM)
  const fbm = useCallback((x: number, y: number, time: number = 0): number => {
    let value = 0.0;
    let amplitude = 0.5;
    let frequency = frequency;
    let maxValue = 0.0;

    for (let i = 0; i < octaves; i++) {
      let noiseValue = 0;
      
      switch (noiseType) {
        case 'perlin':
          noiseValue = perlinNoise2D(x * frequency, y * frequency, time);
          break;
        case 'simplex':
          noiseValue = simplexNoise2D(x * frequency, y * frequency, time);
          break;
        case 'white':
          noiseValue = Math.random();
          break;
        case 'blue':
          noiseValue = blueNoise(x * frequency, y * frequency);
          break;
        case 'pink':
          noiseValue = pinkNoise(x * frequency, y * frequency);
          break;
      }

      value += amplitude * noiseValue;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }, [noiseType, frequency, octaves, lacunarity, persistence, perlinNoise2D, simplexNoise2D]);

  // 蓝噪声
  const blueNoise = useCallback((x: number, y: number): number => {
    const dx = x - Math.floor(x);
    const dy = y - Math.floor(y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    return Math.sin(distance * Math.PI * 8) * 0.5 + 0.5;
  }, []);

  // 粉噪声
  const pinkNoise = useCallback((x: number, y: number): number => {
    let value = 0.0;
    let amplitude = 0.5;
    let frequency = 1.0;

    for (let i = 0; i < 6; i++) {
      value += amplitude * Math.sin(x * frequency + y * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value * 0.5 + 0.5;
  }, []);

  // 生成噪点数据
  const generateNoise = useCallback((time: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const imageData = ctx.createImageData(rect.width, rect.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % rect.width;
      const y = Math.floor((i / 4) / rect.width);
      
      // 归一化坐标
      const nx = x / rect.width;
      const ny = y / rect.height;
      
      // 生成噪声值
      const noiseValue = fbm(nx * scale, ny * scale, time);
      
      // 应用强度
      const value = Math.floor(noiseValue * intensity * 255);
      
      // 解析颜色
      const colorValue = parseInt(color.replace('#', ''), 16);
      const r = (colorValue >> 16) & 255;
      const g = (colorValue >> 8) & 255;
      const b = colorValue & 255;
      
      data[i] = r;     // R
      data[i + 1] = g; // G
      data[i + 2] = b; // B
      data[i + 3] = Math.floor(value * opacity); // A
    }

    ctx.putImageData(imageData, 0, 0);
    setIsLoaded(true);
  }, [scale, intensity, color, opacity, fbm]);

  // 动画循环
  useEffect(() => {
    if (!animated) {
      generateNoise(0);
      return;
    }

    const animate = () => {
      timeRef.current += speed * 0.01;
      generateNoise(timeRef.current);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animated, generateNoise]);

  // 初始生成
  useEffect(() => {
    generateNoise(0);
  }, [generateNoise]);

  // 响应式处理
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        generateNoise(timeRef.current);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [generateNoise]);

  if (!isLoaded) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 pointer-events-none z-50 ${className}`}
      style={{ 
        mixBlendMode: blendMode as any,
        opacity: opacity 
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          imageRendering: 'pixelated'
        }}
      />
    </div>
  );
}

// 辅助函数
const hash = (x: number, y: number): number => {
  const n = x + y * 57;
  return Math.sin(n) * 43758.5453;
};

const grad = (hash: number, x: number, y: number): number => {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
};

const fade = (t: number): number => {
  return t * t * t * (t * (t * 6 - 15) + 10);
};

const lerp = (a: number, b: number, t: number): number => {
  return a + t * (b - a);
};

const dot = (g: number[], x: number, y: number): number => {
  return g[0] * x + g[1] * y;
};

// Simplex 噪声的置换表和梯度表
const perm = new Array(512);
const grad3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
];

// 初始化置换表
for (let i = 0; i < 512; i++) {
  perm[i] = Math.floor(Math.random() * 256);
}

/**
 * 高级噪点效果 Hook
 * 提供便捷的噪点效果管理
 */
export function useAdvancedNoiseEffect(options: AdvancedNoiseOverlayProps = {}) {
  const [isEnabled, setIsEnabled] = useState(true);
  const [settings, setSettings] = useState(options);

  const updateSettings = (newSettings: Partial<AdvancedNoiseOverlayProps>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const toggle = () => setIsEnabled(prev => !prev);

  return {
    isEnabled,
    settings,
    updateSettings,
    toggle,
    AdvancedNoiseOverlayComponent: isEnabled ? (
      <AdvancedNoiseOverlay {...settings} />
    ) : null
  };
}
