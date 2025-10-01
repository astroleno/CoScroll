'use client';

import * as THREE from 'three';

interface VolumeShellsProps {
  radius: number;
  segments: number;
  shellOffsets: number[];
  glowColor: string;
}

export default function VolumeShells({
  radius,
  segments,
  shellOffsets,
  glowColor
}: VolumeShellsProps) {
  // 多色外壳层（从内到外：蓝→粉→暖白，增强奶油感）
  const shellColors = [
    '#b8d4ff', // 浅蓝（内层，冷色）
    '#ffd1e0', // 粉色（中层，偏暖）
    '#ffe0c7', // 暖白（外层，更奶）
    '#ffd4b8', // 更暖的奶色（第4层）
    '#ffe5d0'  // 最外层暖白
  ];

  return (
    <>
      {shellOffsets.map((offset, index) => {
        const shellRadius = radius * (1 + offset);

        // 递减透明度（外层更透明，增强厚度感）
        const baseOpacity = 0.32; // 提高基础透明度
        const decayFactor = 1.3; // 更缓慢的衰减
        const opacity = baseOpacity * Math.pow(1 - index / shellOffsets.length, decayFactor);

        // 每层使用不同颜色
        const color = shellColors[index % shellColors.length];

        return (
          <mesh key={index} renderOrder={2 + index}>
            <sphereGeometry args={[shellRadius, segments / 2, segments / 2]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={opacity}
              blending={THREE.NormalBlending}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </>
  );
}
