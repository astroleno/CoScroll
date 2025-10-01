'use client';

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import * as THREE from 'three';

interface MochiComposerProps {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
}

export default function MochiComposer({
  bloomStrength,
  bloomRadius,
  bloomThreshold
}: MochiComposerProps) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);

  useEffect(() => {
    const composer = new EffectComposer(gl);

    // 渲染通道
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom 通道
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomStrength,
      bloomRadius,
      bloomThreshold
    );
    composer.addPass(bloomPass);

    composerRef.current = composer;

    return () => {
      composer.dispose();
    };
  }, [gl, scene, camera, size]);

  // 更新 Bloom 参数
  useEffect(() => {
    if (composerRef.current) {
      const bloomPass = composerRef.current.passes[1] as UnrealBloomPass;
      if (bloomPass) {
        bloomPass.strength = bloomStrength;
        bloomPass.radius = bloomRadius;
        bloomPass.threshold = bloomThreshold;
      }
    }
  }, [bloomStrength, bloomRadius, bloomThreshold]);

  // 窗口大小变化
  useEffect(() => {
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height);
    }
  }, [size]);

  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render();
    }
  }, 1);

  return null;
}
