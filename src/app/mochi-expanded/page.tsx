'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import MochiCoreExpanded from '@/components/mochi/core/MochiCoreExpanded';
import FresnelShell from '@/components/mochi/core/FresnelShell';
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

        {/* 方案A：顶点膨胀核心球体（糯米团子质感）*/}
        <MochiCoreExpanded
          radius={1}
          segments={64}
          autoRotate={true}
          rotationSpeed={0.2}
          shellLayers={4}
          shellThickness={0.015}
        />

        {/* Fresnel 发光壳（扩大边缘范围，增强发光）*/}
        <FresnelShell
          radius={1}
          segments={64}
          glowColor="#ffd4b3"
          fresnelPower={2.2}
          rimRange={[0.10, 0.95]}
          glowIntensity={0.6}
        />

        {/* 暂停 Bloom，避免白屏问题 */}
        {false && (
          <MochiComposerFixed
            bloomStrength={1.8}
            bloomRadius={1.05}
            bloomThreshold={0.34}
          />
        )}

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
        🍡 方案A - 顶点膨胀糯米团子质感
      </div>
    </div>
  );
}
