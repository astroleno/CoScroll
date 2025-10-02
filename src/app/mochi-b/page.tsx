'use client';

import { Canvas } from '@react-three/fiber';
import MochiBackground from '@/components/backgrounds/MochiBackground';

export default function Page() {
  return (
    <div style={{ width: '100%', height: '100vh', background: '#000' }}>
      <Canvas camera={{ position: [0, 0, 1], fov: 45 }}>
        <color attach="background" args={[0x000000]} />
        <MochiBackground />
      </Canvas>
      <div style={{ position: 'absolute', top: 10, left: 10, color: '#fff', fontSize: 12, background: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 6 }}>
        mochi-b：应看到“弥散球状体”在屏幕中心，边缘柔和
      </div>
    </div>
  );
}


