"use client";

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import NoiseTexture, { useNoiseTexture } from './NoiseTexture';

/**
 * 噪点覆盖层组件
 * 在页面顶部添加噪点效果，支持多种混合模式
 */
interface NoiseOverlayProps {
  intensity?: number;        // 噪点强度 (0-1)
  scale?: number;           // 噪点缩放
  speed?: number;           // 动画速度
  opacity?: number;         // 整体透明度
  blendMode?: 'normal' | 'multiply' | 'overlay' | 'screen' | 'soft-light';
  color?: string;           // 噪点颜色
  animated?: boolean;       // 是否动画
  className?: string;       // CSS 类名
}

export default function NoiseOverlay({
  intensity = 0.03,
  scale = 1.0,
  speed = 1.0,
  opacity = 1.0,
  blendMode = 'normal',
  color = '#ffffff',
  animated = true,
  className = ''
}: NoiseOverlayProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [noiseTexture, setNoiseTexture] = useState<THREE.Texture | null>(null);

  // 创建噪点纹理
  const { texture, loading } = useNoiseTexture({
    width: 512,
    height: 512,
    scale: scale,
    strength: intensity,
    type: 'perlin',
    animated: animated,
    speed: speed
  });

  useEffect(() => {
    if (texture) {
      setNoiseTexture(texture);
    }
  }, [texture]);

  // 创建噪点着色器材质
  const noiseMaterial = React.useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uNoiseTexture: { value: null },
        uTime: { value: 0 },
        uIntensity: { value: intensity },
        uOpacity: { value: opacity },
        uColor: { value: new THREE.Color(color) },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uNoiseTexture;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uOpacity;
        uniform vec3 uColor;
        uniform vec2 uResolution;
        
        varying vec2 vUv;
        
        void main() {
          // 获取噪点纹理
          vec2 noiseUv = vUv;
          vec4 noiseColor = texture2D(uNoiseTexture, noiseUv);
          
          // 应用强度
          float noiseValue = noiseColor.r * uIntensity;
          
          // 应用颜色
          vec3 finalColor = uColor * noiseValue;
          
          // 应用透明度
          float finalAlpha = noiseValue * uOpacity;
          
          gl_FragColor = vec4(finalColor, finalAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false
    });
  }, [intensity, opacity, color]);

  // 更新材质
  useEffect(() => {
    if (materialRef.current && noiseTexture) {
      materialRef.current.uniforms.uNoiseTexture.value = noiseTexture;
      materialRef.current.needsUpdate = true;
    }
  }, [noiseTexture]);

  // 动画更新
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  // 响应式更新
  useEffect(() => {
    const handleResize = () => {
      if (materialRef.current) {
        materialRef.current.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
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
      <mesh ref={meshRef} material={materialRef.current}>
        <planeGeometry args={[2, 2]} />
        <primitive object={noiseMaterial} ref={materialRef} />
      </mesh>
    </div>
  );
}

/**
 * 噪点效果 Hook
 * 提供便捷的噪点效果管理
 */
export function useNoiseEffect(options: NoiseOverlayProps = {}) {
  const [isEnabled, setIsEnabled] = useState(true);
  const [settings, setSettings] = useState(options);

  const updateSettings = (newSettings: Partial<NoiseOverlayProps>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const toggle = () => setIsEnabled(prev => !prev);

  return {
    isEnabled,
    settings,
    updateSettings,
    toggle,
    NoiseOverlayComponent: isEnabled ? (
      <NoiseOverlay {...settings} />
    ) : null
  };
}
