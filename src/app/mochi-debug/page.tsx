'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import MochiCoreV3Fixed from '@/components/mochi/core/MochiCoreV3Fixed';
import GradientBackgroundV3 from '@/components/mochi/backgrounds/GradientBackgroundV3';

export default function MochiDebugPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* 背景 */}
        <GradientBackgroundV3 />

        {/* 灯光 */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />

        {/* 只有核心球体，不加外壳和后期 */}
        <MochiCoreV3Fixed
          radius={1}
          segments={64}
          autoRotate={true}
          rotationSpeed={0.2}
        />

        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
}
