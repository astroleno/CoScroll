'use client';

import * as THREE from 'three';
import { mochiShellVertexShader } from '../shaders/shell.vert';
import { mochiShellFragmentShader } from '../shaders/shell.frag';

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
        // 更厚的雾带：内层更实、外层仍可读
        const innerBase = 0.42; // 内层基准
        const outerBase = 0.26; // 最外层目标
        const t = index / Math.max(shellOffsets.length - 1, 1);
        const baseOpacity = innerBase * (1.0 - t) + outerBase * t;
        const decayFactor = 1.1; // 放缓衰减
        let opacity = baseOpacity * Math.pow(1 - t, decayFactor);
        // 最外两层加权，专门增厚雾带外缘
        if (index >= shellOffsets.length - 2) opacity *= 1.2;

        // 每层使用不同颜色
        const color = shellColors[index % shellColors.length];

        return (
          <mesh key={index} renderOrder={2 + index}>
            <sphereGeometry args={[shellRadius, segments / 2, segments / 2]} />
            <shaderMaterial
              uniforms={{
                shellColor: { value: new THREE.Color(color).toArray ? new THREE.Color(color) : new THREE.Color(color) },
                baseOpacity: { value: opacity },
                layerT: { value: t }
              }}
              vertexShader={mochiShellVertexShader}
              fragmentShader={mochiShellFragmentShader}
              transparent
              depthWrite={false}
              side={THREE.BackSide}
              blending={THREE.CustomBlending}
              blendEquation={THREE.AddEquation}
              blendSrc={THREE.SrcAlphaFactor}
              blendDst={THREE.OneMinusSrcAlphaFactor}
            />
          </mesh>
        );
      })}
    </>
  );
}
