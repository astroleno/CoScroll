'use client';

import MochiSphereV3 from '@/components/mochi/MochiSphereV3';

export default function MochiV3Page() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <MochiSphereV3
        autoRotate={true}
        rotationSpeed={0.2}
      />
    </div>
  );
}
