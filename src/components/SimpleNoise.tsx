"use client";

import React, { useRef, useEffect, useState } from 'react';

/**
 * 简单噪点组件
 * 使用CSS和Canvas实现明显的噪点效果
 */
interface SimpleNoiseProps {
  intensity?: number;        // 噪点强度 (0-1)
  opacity?: number;         // 整体透明度
  animated?: boolean;       // 是否动画
  className?: string;       // CSS 类名
}

export default function SimpleNoise({
  intensity = 0.1,
  opacity = 0.3,
  animated = true,
  className = ''
}: SimpleNoiseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const generateNoise = (time: number = 0) => {
      // 设置画布尺寸
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % canvas.width;
        const y = Math.floor((i / 4) / canvas.width);
        
        // 生成噪点值
        let noiseValue = 0;
        
        if (animated) {
          // 动画噪点
          noiseValue = Math.sin(x * 0.01 + y * 0.01 + time * 0.1) * 0.5 + 0.5;
        } else {
          // 静态噪点
          noiseValue = Math.random();
        }
        
        // 应用强度
        const value = Math.floor(noiseValue * intensity * 255);
        
        data[i] = value;     // R
        data[i + 1] = value; // G
        data[i + 2] = value; // B
        data[i + 3] = Math.floor(value * opacity); // A
      }

      ctx.putImageData(imageData, 0, 0);
      setIsLoaded(true);
    };

    const animate = () => {
      timeRef.current += 0.1;
      generateNoise(timeRef.current);
      animationRef.current = requestAnimationFrame(animate);
    };

    if (animated) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      generateNoise(0);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [intensity, opacity, animated]);

  if (!isLoaded) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 pointer-events-none z-50 ${className}`}
      style={{ 
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
