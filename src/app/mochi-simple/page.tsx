'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

function SimpleSphere() {
  const uniforms = useMemo(
    () => ({
      color1: { value: new THREE.Color('#a0c4ff') },
      color2: { value: new THREE.Color('#ffb3d9') }
    }),
    []
  );

  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 color1;
    uniform vec3 color2;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      float gradient = (vPosition.y + 1.0) * 0.5;
      vec3 color = mix(color1, color2, gradient);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}

export default function MochiSimplePage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f0f0f0' }}>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <ambientLight intensity={0.5} />
        <SimpleSphere />
        <OrbitControls />
      </Canvas>
    </div>
  );
}
