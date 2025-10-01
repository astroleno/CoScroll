'use client';

import MochiSphere from '@/components/mochi/MochiSphere';

export default function MochiTestPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <MochiSphere
        theme="pastel"
        autoRotate={true}
        rotationSpeed={0.2}
      />
    </div>
  );
}
