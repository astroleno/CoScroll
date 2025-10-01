'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { fresnelVertexShader } from '../shaders/fresnel.vert';
import { fresnelFragmentShader } from '../shaders/fresnel.frag';

interface FresnelShellProps {
  radius: number;
  segments: number;
  glowColor: string;
  fresnelPower: number;
  rimRange: [number, number];
  glowIntensity: number;
}

export default function FresnelShell({
  radius,
  segments,
  glowColor,
  fresnelPower,
  rimRange,
  glowIntensity
}: FresnelShellProps) {
  const uniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color(glowColor) },
      fresnelPower: { value: fresnelPower },
      rimStart: { value: rimRange[0] },
      rimEnd: { value: rimRange[1] },
      glowIntensity: { value: glowIntensity },
      ditherStrength: { value: 0.01 }
    }),
    [glowColor, fresnelPower, rimRange, glowIntensity]
  );

  return (
    <mesh renderOrder={1}>
      <sphereGeometry args={[radius * 1.01, segments, segments]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={fresnelVertexShader}
        fragmentShader={fresnelFragmentShader}
        transparent
        blending={THREE.AdditiveBlending}
        side={THREE.FrontSide}
        depthWrite={false}
      />
    </mesh>
  );
}
