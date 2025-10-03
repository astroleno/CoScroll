'use client';
'use client';

import JadeV3b from '@/components/jade/JadeV3b';
import OrientationGuard from '@/components/OrientationGuard';

export default function Page() {
  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: '#1f1e1c', overflow: 'hidden', touchAction: 'none' }}>
      {/* 横屏遮罩：提示竖屏观看（软锁定方案） */}
      <div className="landscapeMask" style={{
        position: 'absolute', inset: 0,
        display: 'none',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)', color: '#fff',
        zIndex: 10,
        textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: 18, marginBottom: 8 }}>请旋转至竖屏查看</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Rotate your device to portrait</div>
        </div>
      </div>
      <style jsx>{`
        /* 横屏时显示遮罩 */
        @media (orientation: landscape) {
          .landscapeMask { display: flex; }
        }
      `}</style>
      <JadeV3b 
        showBackground 
        enableRotation 
        hdrExposure={1.0} 
        baseSpeed={0.5} 
        speedMultiplier={20} 
      />
      <OrientationGuard />
    </div>
  );
}


