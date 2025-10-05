"use client";

import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Text, Text3D, Center } from '@react-three/drei';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';

/**
 * 简化的3D文字组件
 * 避免复杂的依赖和hooks问题
 */
interface Simple3DTextProps {
  text: string;
  position: [number, number, number];
  isCurrent: boolean;
  index: number;
  currentIndex: number;
  fontSize?: number;
  color?: string;
  opacity?: number;
  renderOrder?: number;
  isLeft?: boolean; // 新增属性
  isFront?: boolean; // 是否在前层
  frontScale?: number; // 前层字体缩放
  backScale?: number; // 后层字体缩放
  emissiveIntensity?: number; // 自发光强度
}

const Simple3DText: React.FC<Simple3DTextProps> = ({
  text,
  position,
  isCurrent,
  index,
  currentIndex,
  fontSize = 0.4,
  color = '#E2E8F0',
  opacity = 1,
  renderOrder = 0,
  isLeft = true, // 默认左对齐
  isFront = true, // 默认在前层
  frontScale = 0.85, // 默认前层缩放
  backScale = 1.15, // 默认后层缩放
  emissiveIntensity = 0.3 // 默认自发光强度
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // 计算透明度 - 关闭透明度，所有文字都不透明
  const finalOpacity = 1.0;

  // 计算颜色 - 使用传入的颜色参数
  const finalColor = color;

  // 计算缩放 - 前后层不同字体大小，补偿透视效果
  // 使用传入的缩放参数，后层字体稍大，前层字体稍小，因为透视会使后层看起来更小
  const scale = isFront ? frontScale : backScale; // 前层使用frontScale，后层使用backScale
  
  // 使用简化的Text设置，强制不透明通道
  return (
    <Text
      ref={meshRef}
      position={position}
      fontSize={fontSize * scale}
      color={finalColor}
      anchorX={isLeft ? "left" : "right"}
      anchorY="middle"
      renderOrder={isFront ? 1 : 0}
      material-transparent={false}
      material-opacity={1}
      material-alphaTest={0.5}
      material-depthWrite={true}
      material-depthTest={true}
      material-toneMapped={false}
    >
      <meshStandardMaterial
        color={finalColor}
        emissive={finalColor}
        emissiveIntensity={emissiveIntensity}
        toneMapped={false}
        transparent={false}
        opacity={1}
        depthWrite={true}
        depthTest={true}
        side={THREE.FrontSide}
      />
      {text}
    </Text>
  );
};

export default Simple3DText;
