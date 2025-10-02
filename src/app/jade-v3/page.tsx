'use client';

import JadeV3 from '@/components/jade/JadeV3';

export default function Page() {
  return (
    <div style={{ width: '100%', height: '100vh', background: '#1f1e1c' }}>
      <JadeV3 showBackground={true} enableRotation={true} hdrExposure={1.5} />
    </div>
  );
}


