"use client";

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * 噪点纹理生成器组件
 * 生成程序化噪点纹理，用于在 fragment shader 中添加噪点效果
 */
interface NoiseTextureProps {
  width?: number;           // 纹理宽度
  height?: number;         // 纹理高度
  scale?: number;          // 噪点缩放
  strength?: number;       // 噪点强度 (0-1)
  type?: 'perlin' | 'simplex' | 'white' | 'blue'; // 噪点类型
  animated?: boolean;       // 是否动画
  speed?: number;          // 动画速度
  onTextureReady?: (texture: THREE.Texture) => void; // 纹理准备完成回调
}

export default function NoiseTexture({
  width = 512,
  height = 512,
  scale = 1.0,
  strength = 0.03,
  type = 'perlin',
  animated = false,
  speed = 1.0,
  onTextureReady
}: NoiseTextureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);

  // 生成噪点纹理
  const generateNoiseTexture = useMemo(() => {
    return (time: number = 0) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % width;
        const y = Math.floor((i / 4) / width);
        
        let noiseValue = 0;
        
        switch (type) {
          case 'perlin':
            noiseValue = perlinNoise2D(x * scale / width, y * scale / height, time);
            break;
          case 'simplex':
            noiseValue = simplexNoise2D(x * scale / width, y * scale / height, time);
            break;
          case 'white':
            noiseValue = Math.random();
            break;
          case 'blue':
            noiseValue = blueNoise(x, y, width, height);
            break;
        }

        // 应用强度
        const value = Math.floor(noiseValue * strength * 255);
        data[i] = value;     // R
        data[i + 1] = value; // G
        data[i + 2] = value; // B
        data[i + 3] = 255;   // A
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas;
    };
  }, [width, height, scale, strength, type]);

  // 2D Perlin 噪声
  const perlinNoise2D = (x: number, y: number, time: number = 0): number => {
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
  };

  // 2D Simplex 噪声
  const simplexNoise2D = (x: number, y: number, time: number = 0): number => {
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
  };

  // 蓝噪声（Blue Noise）
  const blueNoise = (x: number, y: number, width: number, height: number): number => {
    const dx = x / width;
    const dy = y / height;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return Math.sin(distance * Math.PI * 8) * 0.5 + 0.5;
  };

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

  // 动画循环
  useEffect(() => {
    if (!animated) {
      generateNoiseTexture(0);
      return;
    }

    const animate = () => {
      timeRef.current += speed * 0.01;
      generateNoiseTexture(timeRef.current);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animated, speed, generateNoiseTexture]);

  // 初始生成
  useEffect(() => {
    generateNoiseTexture(0);
  }, [generateNoiseTexture]);

  // 创建 Three.js 纹理
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    if (onTextureReady) {
      onTextureReady(texture);
    }

    return () => {
      texture.dispose();
    };
  }, [onTextureReady]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'none' }}
    />
  );
}

/**
 * 噪点纹理 Hook
 * 提供便捷的噪点纹理管理
 */
export function useNoiseTexture(options: NoiseTextureProps = {}) {
  const [texture, setTexture] = React.useState<THREE.Texture | null>(null);
  const [loading, setLoading] = React.useState(true);

  const handleTextureReady = (newTexture: THREE.Texture) => {
    setTexture(newTexture);
    setLoading(false);
  };

  return {
    texture,
    loading,
    NoiseTextureComponent: (
      <NoiseTexture
        {...options}
        onTextureReady={handleTextureReady}
      />
    )
  };
}
