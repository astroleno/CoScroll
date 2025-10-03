'use client';

import JadeV3b from '@/components/jade/JadeV3b';

export default function Page() {
  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: '#1f1e1c', overflow: 'hidden', touchAction: 'none' }}>
      <JadeV3b 
        showBackground 
        enableRotation 
        hdrExposure={1.0} 
        baseSpeed={0.5} 
        speedMultiplier={20} 
      />
    </div>
  );
}


