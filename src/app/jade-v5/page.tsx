'use client';

import { useState } from 'react';
import JadeV5 from '@/components/jade/JadeV5';

const MODELS = [
  '/models/10k_obj/001_空.obj',
  '/models/10k_obj/002_心.obj',
  '/models/10k_obj/003_道.obj',
];

export default function Page() {
  const [idx, setIdx] = useState(0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1f1e1c' }}>
      {/* 顶部简单切换按钮 */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 8 }}>
        {MODELS.map((m, i) => (
          <button key={m} onClick={() => setIdx(i)} style={{ padding: '6px 10px', borderRadius: 6 }}>
            {i + 1}
          </button>
        ))}
      </div>

      <JadeV5
        modelPath={MODELS[idx]}
        rotationDurationSec={8}
        direction={1}
        fitToView
        background="#1f1e1c"
      />
    </div>
  );
}


