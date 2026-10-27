'use client';

import { useEffect, useState } from 'react';
import type { OpeningConfig } from '@/config/types';
import { loadOpeningImage } from '@/utils/openingImage';

// The frozen 1440×720 layout keeps handwriting above y=600 and its label below y=631.
const PREFACE_CONTENT_HEIGHT = 600;

/** One track's preface. The owner remounts it when the frozen revision changes. */
export default function OpeningPrompt({ opening, textId }: { opening: OpeningConfig; textId: string }) {
  const [source, setSource] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let objectUrl: string | undefined;
    loadOpeningImage(opening.asset, controller.signal)
      .then(url => {
        objectUrl = url;
        if (controller.signal.aborted) URL.revokeObjectURL(url);
        else setSource(url);
      })
      .catch(() => { /* Keep the readable start prompt on every image failure. */ })
      .finally(() => clearTimeout(timer));
    return () => {
      controller.abort();
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [opening.asset]);

  return (
    <span className="opening-prompt" data-coscroll-opening={source ? 'handwriting' : 'text'} data-opening-revision={opening.revision}>
      <span id={textId} className="opening-fallback" style={{ opacity: source ? 0 : 1 }}>{opening.text}</span>
      {source && (
        <span className="opening-image" aria-hidden="true">
          {/* A verified local blob; display only the handwriting, retaining the frozen source. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={source} width={opening.asset.width} height={opening.asset.height} alt="" />
        </span>
      )}
      <style jsx>{`
        .opening-prompt {
          position: relative;
          display: block;
          width: min(30rem, calc(100vw - 3rem), 65dvh);
          aspect-ratio: ${opening.asset.width} / ${PREFACE_CONTENT_HEIGHT};
          margin: 0 auto;
        }
        .opening-fallback {
          display: flex;
          height: 100%;
          align-items: center;
          justify-content: center;
          color: #e2e8f0;
          font-size: clamp(1rem, 4.6vw, 1.5rem);
          font-weight: 400;
          line-height: 1.9;
          white-space: pre-line;
        }
        .opening-image { position: absolute; inset: 0; overflow: hidden; }
        img { display: block; width: 100%; height: auto; }
      `}</style>
    </span>
  );
}
