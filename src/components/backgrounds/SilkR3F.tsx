/* eslint-disable react/no-unknown-property */
"use client";

import React, { useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Color } from "three";
import type { IUniform, Mesh } from "three";

type NormalizedRGB = [number, number, number];

// One opaque plane covers the viewport. There are no geometry edges to smooth
// or overlapping surfaces to depth-test in this background-only renderer.
const BACKGROUND_GL = { alpha: false, antialias: false, depth: false, stencil: false };

const hexToNormalizedRGB = (hex: string): NormalizedRGB => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
};

interface UniformValue<T = number | Color> {
  value: T;
}

interface SilkUniforms {
  uSpeed: UniformValue<number>;
  uScale: UniformValue<number>;
  uNoiseIntensity: UniformValue<number>;
  uColor: UniformValue<Color>;
  uRotation: UniformValue<number>;
  uTime: UniformValue<number>;
  [uniform: string]: IUniform;
}

const vertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vPosition = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;
varying vec3 vPosition;

uniform float uTime;
uniform vec3  uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2  r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2  rot = mat2(c, -s, s, c);
  return rot * uv;
}

void main() {
  float rnd        = noise(gl_FragCoord.xy);
  vec2  uv         = rotateUvs(vUv * uScale, uRotation);
  vec2  tex        = uv * uScale;
  float tOffset    = uSpeed * uTime;

  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

  float pattern = 0.6 +
                  0.4 * sin(5.0 * (tex.x + tex.y +
                                   cos(3.0 * tex.x + 5.0 * tex.y) +
                                   0.02 * tOffset) +
                           sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

  vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
  col.a = 1.0;
  gl_FragColor = col;
}
`;

export interface SilkR3FProps {
  speed?: number;
  scale?: number;
  color?: string;
  noiseIntensity?: number;
  rotation?: number;
  className?: string;
  style?: React.CSSProperties;
  reducedMotion?: boolean;
}

type SilkPlaneProps = Required<Pick<SilkR3FProps, 'speed' | 'scale' | 'color' | 'noiseIntensity' | 'rotation' | 'reducedMotion'>>;

function SilkPlane({speed, scale, color, noiseIntensity, rotation, reducedMotion}: SilkPlaneProps) {
  const meshRef = useRef<Mesh>(null);
  const {gl, invalidate, viewport: {width, height}} = useThree();

  const uniforms = useMemo<SilkUniforms>(
    () => ({
      uSpeed: { value: 5 },
      uScale: { value: 1 },
      uNoiseIntensity: { value: 1.5 },
      uColor: { value: new Color() },
      uRotation: { value: 0 },
      uTime: { value: 0 },
    }),
    []
  );

  useLayoutEffect(() => {
    meshRef.current?.scale.set(width, height, 1);
    uniforms.uSpeed.value = speed;
    uniforms.uScale.value = scale;
    uniforms.uNoiseIntensity.value = noiseIntensity;
    uniforms.uColor.value.setRGB(...hexToNormalizedRGB(color));
    uniforms.uRotation.value = rotation;
    // Demand mode needs a frame after imperative changes to the plane.
    invalidate();
  }, [width, height, uniforms, speed, scale, noiseIntensity, color, rotation, reducedMotion, invalidate]);

  useEffect(() => {
    const canvas = gl.domElement;
    const redraw = () => invalidate();
    canvas.addEventListener('webglcontextrestored', redraw);
    return () => canvas.removeEventListener('webglcontextrestored', redraw);
  }, [gl, invalidate]);

  useFrame((_, delta) => {
    if (!reducedMotion) uniforms.uTime.value += 0.1 * delta;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} depthTest={false} depthWrite={false} />
    </mesh>
  );
}

const SilkR3F: React.FC<SilkR3FProps> = ({ speed = 5, scale = 1, color = "#7B7481", noiseIntensity = 1.5, rotation = 0, className, style, reducedMotion = false }) => {
  return (
    <div className={className} style={{ position: "fixed", inset: 0, pointerEvents: "none", ...style }} aria-hidden>
      <Canvas dpr={[1, 2]} frameloop={reducedMotion ? 'demand' : 'always'} gl={BACKGROUND_GL}>
        <SilkPlane speed={speed} scale={scale} color={color} noiseIntensity={noiseIntensity} rotation={rotation} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
};

export default React.memo(SilkR3F);


