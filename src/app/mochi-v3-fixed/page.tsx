'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import MochiCoreV3Fixed from '@/components/mochi/core/MochiCoreV3Fixed';
import FresnelShell from '@/components/mochi/core/FresnelShell';
import VolumeShells from '@/components/mochi/core/VolumeShells';
import GradientBackgroundV3 from '@/components/mochi/backgrounds/GradientBackgroundV3';
import MochiComposer from '@/components/mochi/effects/MochiComposer';
import { defaultMochiConfig } from '@/components/mochi/presets';

export default function MochiV3FixedPage() {
  const config = defaultMochiConfig;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <GradientBackgroundV3 />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />

        <MochiCoreV3Fixed
          radius={config.radius!}
          segments={config.segments!}
          autoRotate={config.autoRotate!}
          rotationSpeed={config.rotationSpeed!}
        />

        <FresnelShell
          radius={config.radius!}
          segments={config.segments!}
          glowColor="#ffcc99"
          fresnelPower={2.8}
          rimRange={[0.25, 0.85]}
          glowIntensity={1.3}
        />

        <VolumeShells
          radius={config.radius!}
          segments={config.segments!}
          shellOffsets={config.shellOffsets!}
          glowColor="#ffb3d9"
        />

        <MochiComposer
          bloomStrength={config.bloomStrength!}
          bloomRadius={config.bloomRadius!}
          bloomThreshold={config.bloomThreshold!}
        />

        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
}
