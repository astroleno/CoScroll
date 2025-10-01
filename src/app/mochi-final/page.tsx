'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import MochiCoreV3Fixed from '@/components/mochi/core/MochiCoreV3Fixed';
import FresnelShell from '@/components/mochi/core/FresnelShell';
import VolumeShells from '@/components/mochi/core/VolumeShells';
import GradientBackgroundV3 from '@/components/mochi/backgrounds/GradientBackgroundV3';
import MochiComposerFixed from '@/components/mochi/effects/MochiComposerFixed';

export default function MochiFinalPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* 背景 */}
        <GradientBackgroundV3 />

        {/* 灯光（降低环境光，增强体积对比）*/}
        <ambientLight intensity={0.32} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />

        {/* 核心球体（4色渐变）*/}
        <MochiCoreV3Fixed
          radius={1}
          segments={64}
          autoRotate={true}
          rotationSpeed={0.2}
        />

        {/* Fresnel 发光壳（扩大边缘范围，增强发光）*/}
        <FresnelShell
          radius={1}
          segments={64}
          glowColor="#ffcc99"
          fresnelPower={3.2}
          rimRange={[0.15, 0.95]}
          glowIntensity={2.2}
        />

        {/* 体积外壳（5层彩色，增强厚度感）*/}
        <VolumeShells
          radius={1}
          segments={64}
          shellOffsets={[0.02, 0.04, 0.07, 0.10, 0.13]}
          glowColor="#ffb3d9"
        />

        {/* 修复版后期效果（增强Bloom，营造奶油光晕）*/}
        <MochiComposerFixed
          bloomStrength={2.4}
          bloomRadius={1.1}
          bloomThreshold={0.32}
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
        ✨ V3 Final - 完整效果（4色渐变 + Bloom）
      </div>
    </div>
  );
}
