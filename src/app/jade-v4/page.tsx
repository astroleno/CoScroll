'use client';

import JadeV4 from '@/components/jade/JadeV4';

export default function Page() {
  return (
    <div style={{ width: '100%', height: '100vh', background: '#1f1e1c' }}>
      <JadeV4 
        showBackground={true}
        enableRotation={true}
        hdrExposure={1.5}
        backgroundColor={'#101014'}
        // 可分别指定：背景与折射/IBL 环境
        backgroundHdrPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
        refractionEnvPath="/textures/qwantani_moon_noon_puresky_1k.hdr"
        modelPath="/models/10k_obj/001_空.obj"
        normalMapPath="/textures/normal.jpg"
        debugForceReflection={false}
      />
    </div>
  );
}


