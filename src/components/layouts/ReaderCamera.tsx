'use client';

import {useLayoutEffect, useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import type {OrthographicCamera} from 'three';
import {fitReaderFrame, type ReaderBounds} from './readerFraming';

export default function ReaderCamera({bounds, baseZoom}: {bounds: ReaderBounds; baseZoom: number}) {
  const {camera, size, gl, get, set, invalidate} = useThree();
  const frame = useMemo(() => fitReaderFrame(size.height, baseZoom, bounds), [size.height, baseZoom, bounds]);
  useLayoutEffect(() => {
    const orthographic = camera as OrthographicCamera;
    if (!orthographic.isOrthographicCamera) return;
    orthographic.zoom = frame.zoom;
    orthographic.position.y = frame.centerY;
    orthographic.updateProjectionMatrix();
    const viewport = get().viewport;
    set({viewport: {...viewport, ...viewport.getCurrentViewport(camera, undefined, size)}});
    gl.domElement.dataset.readerZoom = String(frame.zoom);
    gl.domElement.dataset.readerCenterY = String(frame.centerY);
    gl.domElement.dataset.readerMinY = String(bounds.minY);
    gl.domElement.dataset.readerMaxY = String(bounds.maxY);
    invalidate();
  }, [camera, frame, bounds, gl, get, set, invalidate, size]);
  return null;
}
