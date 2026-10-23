"use client";

import {useLayoutEffect} from 'react';
import {useThree} from '@react-three/fiber';
import {TransmissionUpdateRegion, type TransmissionRegionProvider} from './transmissionUpdateRegion';

/** Install only in the main Canvas; the background keeps its own renderer. */
export default function TransmissionRegionRendering() {
  const gl = useThree(state => state.gl);
  useLayoutEffect(() => {
    const renderer = gl as typeof gl & {transmissionUpdateRegion: TransmissionRegionProvider | null};
    const previous = renderer.transmissionUpdateRegion;
    const region = new TransmissionUpdateRegion();
    renderer.transmissionUpdateRegion = region.update;
    gl.domElement.addEventListener('webglcontextrestored', region.reset);
    return () => {
      if (renderer.transmissionUpdateRegion === region.update) renderer.transmissionUpdateRegion = previous;
      gl.domElement.removeEventListener('webglcontextrestored', region.reset);
    };
  }, [gl]);
  return null;
}
