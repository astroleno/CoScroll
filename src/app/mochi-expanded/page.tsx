'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import MochiCoreV3Fixed from '@/components/mochi/core/MochiCoreV3Fixed';
import VolumeShells from '@/components/mochi/core/VolumeShells';
import GradientBackgroundV3 from '@/components/mochi/backgrounds/GradientBackgroundV3';
import MochiComposerFixed from '@/components/mochi/effects/MochiComposerFixed';

export default function MochiExpandedPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* 强制背景为黑色，便于排错 */}
        {/* @ts-ignore */}
        <color attach="background" args={["#000000"]} />
        {/* 背景 */}
        <GradientBackgroundV3 />

        {/* 灯光（降低环境光，增强体积对比）*/}
        <ambientLight intensity={0.28} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />

        {/* 方案B：成熟组合（V3 Fixed + VolumeShells）*/}
        <MochiCoreV3Fixed
          radius={1}
          segments={64}
          autoRotate
          rotationSpeed={0.2}
        />

        <VolumeShells
          radius={1}
          segments={64}
          shellOffsets={[0.012, 0.024, 0.038, 0.055, 0.075, 0.10]}
          glowColor="#ffb3d9"
        />

        {/* 降低 Bloom，避免洗白半透明 */}
        <MochiComposerFixed
          bloomStrength={1.3}
          bloomRadius={1.0}
          bloomThreshold={0.5}
        />

        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>

      {/* 版本标签 */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        🍡 方案B - V3Fixed + 多层体积壳（成熟方案）
      </div>
    </div>
  );
}
