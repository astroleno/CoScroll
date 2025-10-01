'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { mochiExpandedVertexShader } from '../shaders/mochi-expanded.vert';
import { mochiExpandedFragmentShader } from '../shaders/mochi-expanded.frag';

interface MochiCoreExpandedProps {
  radius: number;
  segments: number;
  autoRotate?: boolean;
  rotationSpeed?: number;
  shellLayers?: number;
  shellThickness?: number;
}

export default function MochiCoreExpanded({
  radius,
  segments,
  autoRotate = true,
  rotationSpeed = 0.2,
  shellLayers = 5,
  shellThickness = 0.01
}: MochiCoreExpandedProps) {
  // 糯米团子配色（饱和度降低，更糯米感）
  const coreColors = useMemo(() => {
    const c1 = new THREE.Color('#a8c8ff');
    const c2 = new THREE.Color('#d4b0e8');
    const c3 = new THREE.Color('#ffc8a0');
    const c4 = new THREE.Color('#ffe8a0');
    return {
      color1: { value: new THREE.Vector3(c1.r, c1.g, c1.b) },
      color2: { value: new THREE.Vector3(c2.r, c2.g, c2.b) },
      color3: { value: new THREE.Vector3(c3.r, c3.g, c3.b) },
      color4: { value: new THREE.Vector3(c4.r, c4.g, c4.b) }
    };
  }, []);

  // 外壳颜色（偏冷色，冰凉糯感）
  const shellColor = useMemo(() => {
    const c = new THREE.Color('#b8d4ff');
    return { value: new THREE.Vector3(c.r, c.g, c.b) };
  }, []);

  return (
    <group>
      {/* 内核 */}
      <mesh>
        <sphereGeometry args={[radius, segments, segments]} />
        <shaderMaterial
          uniforms={{
            ...coreColors,
            shellOffset: { value: 0.0 },
            shellOpacity: { value: 0.0 },
            shellColor: shellColor,
            shellMaxOffset: { value: shellLayers * shellThickness }
          }}
          vertexShader={mochiExpandedVertexShader}
          fragmentShader={mochiExpandedFragmentShader}
          transparent={false}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* 多层外壳 */}
      {Array.from({ length: shellLayers }, (_, index) => {
        const shellOffset = (index + 1) * shellThickness;
        // 更柔的透明度曲线：更薄更糯
        const baseOpacity = 0.05; // 再轻一点，避免形成明显白壳
        const decay = 1.6;
        const shellOpacity = baseOpacity * Math.pow(1.0 - index / shellLayers, decay);
        
        return (
          <mesh key={index} renderOrder={1 + index}>
            <sphereGeometry args={[radius, segments, segments]} />
            <shaderMaterial
              uniforms={{
                ...coreColors,
                shellOffset: { value: shellOffset },
                shellOpacity: { value: shellOpacity },
                shellColor: shellColor,
                shellMaxOffset: { value: shellLayers * shellThickness }
              }}
              vertexShader={mochiExpandedVertexShader}
              fragmentShader={mochiExpandedFragmentShader}
              transparent={true}
              blending={THREE.NormalBlending}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
