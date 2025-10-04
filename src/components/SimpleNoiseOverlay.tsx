"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * 简单噪点覆盖层组件
 * 使用Canvas 2D API生成噪点效果，性能更好
 */
interface SimpleNoiseOverlayProps {
  intensity?: number;        // 噪点强度 (0-1)
  scale?: number;           // 噪点缩放
  speed?: number;           // 动画速度
  opacity?: number;         // 整体透明度
  blendMode?: 'normal' | 'multiply' | 'overlay' | 'screen' | 'soft-light';
  color?: string;           // 噪点颜色
  animated?: boolean;       // 是否动画
  className?: string;       // CSS 类名
  width?: number;           // 画布宽度
  height?: number;          // 画布高度
}

export default function SimpleNoiseOverlay({
  intensity = 0.03,
  scale = 1.0,
  speed = 1.0,
  opacity = 1.0,
  blendMode = 'normal',
  color = '#ffffff',
  animated = true,
  className = '',
  width = 512,
  height = 512
}: SimpleNoiseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // 生成噪点数据
  const generateNoise = useCallback((time: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % width;
      const y = Math.floor((i / 4) / width);
      
      // 使用简单的噪声函数
      const noiseValue = Math.sin(x * scale * 0.01 + y * scale * 0.01 + time * speed * 0.1) * 0.5 + 0.5;
      
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
  }, [width, height, scale, speed, intensity, color, opacity]);

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
        width={width}
        height={height}
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

/**
 * 噪点效果 Hook
 * 提供便捷的噪点效果管理
 */
export function useSimpleNoiseEffect(options: SimpleNoiseOverlayProps = {}) {
  const [isEnabled, setIsEnabled] = useState(true);
  const [settings, setSettings] = useState(options);

  const updateSettings = (newSettings: Partial<SimpleNoiseOverlayProps>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const toggle = () => setIsEnabled(prev => !prev);

  return {
    isEnabled,
    settings,
    updateSettings,
    toggle,
    SimpleNoiseOverlayComponent: isEnabled ? (
      <SimpleNoiseOverlay {...settings} />
    ) : null
  };
}
