'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import MochiCoreV3Fixed from '@/components/mochi/core/MochiCoreV3Fixed';
import FresnelShell from '@/components/mochi/core/FresnelShell';
import VolumeShells from '@/components/mochi/core/VolumeShells';
import GradientBackgroundV3 from '@/components/mochi/backgrounds/GradientBackgroundV3';

export default function MochiDebug2Page() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <GradientBackgroundV3 />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />

        {/* 核心球体 */}
        <MochiCoreV3Fixed
          radius={1}
          segments={64}
          autoRotate={true}
          rotationSpeed={0.2}
        />

        {/* 添加 Fresnel 发光壳 */}
        <FresnelShell
          radius={1}
          segments={64}
          glowColor="#ffcc99"
          fresnelPower={2.8}
          rimRange={[0.25, 0.85]}
          glowIntensity={1.3}
        />

        {/* 添加体积外壳 */}
        <VolumeShells
          radius={1}
          segments={64}
          shellOffsets={[0.02, 0.04, 0.06]}
          glowColor="#ffb3d9"
        />

        {/* 注意：没有加 MochiComposer（后期效果）*/}

        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
}
