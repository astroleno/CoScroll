'use client';

import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';

interface MochiComposerFixedProps {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
}

export default function MochiComposerFixed({
  bloomStrength,
  bloomRadius,
  bloomThreshold
}: MochiComposerFixedProps) {
  return (
    <EffectComposer>
      <Bloom
        intensity={bloomStrength}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.9}
        height={300}
        kernelSize={KernelSize.LARGE}
        mipmapBlur={true}
      />
    </EffectComposer>
  );
}
