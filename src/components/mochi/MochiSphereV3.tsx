'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import MochiCoreV3 from './core/MochiCoreV3';
import FresnelShell from './core/FresnelShell';
import VolumeShells from './core/VolumeShells';
import GradientBackgroundV3 from './backgrounds/GradientBackgroundV3';
import MochiComposer from './effects/MochiComposer';
import { defaultMochiConfig } from './presets';

interface MochiSphereV3Props {
  radius?: number;
  segments?: number;
  autoRotate?: boolean;
  rotationSpeed?: number;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
}

export default function MochiSphereV3(props: MochiSphereV3Props = {}) {
  const config = { ...defaultMochiConfig, ...props };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* 多色渐变背景 */}
        <GradientBackgroundV3 />

        {/* 环境光 */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />

        {/* 核心球体（V3 全新 ShaderMaterial）*/}
        <MochiCoreV3
          radius={config.radius!}
          segments={config.segments!}
          autoRotate={config.autoRotate!}
          rotationSpeed={config.rotationSpeed!}
        />

        {/* Fresnel 发光壳 */}
        <FresnelShell
          radius={config.radius!}
          segments={config.segments!}
          glowColor="#ffcc99"
          fresnelPower={2.8}
          rimRange={[0.25, 0.85]}
          glowIntensity={1.3}
        />

        {/* 体积外壳 */}
        <VolumeShells
          radius={config.radius!}
          segments={config.segments!}
          shellOffsets={config.shellOffsets!}
          glowColor="#ffb3d9"
        />

        {/* 强化后期效果 */}
        <MochiComposer
          bloomStrength={config.bloomStrength!}
          bloomRadius={config.bloomRadius!}
          bloomThreshold={config.bloomThreshold!}
        />

        {/* 轨道控制 */}
        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
}
