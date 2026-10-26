'use client';

import { useEffect, useState } from 'react';
import type { OpeningConfig } from '@/config/types';
import { loadOpeningImage } from '@/utils/openingImage';

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
        // A verified, already decoded local blob; Next's image service is unnecessary.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} width={opening.asset.width} height={opening.asset.height} alt="" />
      )}
      {!source && <span className="opening-attribution">{opening.attribution}</span>}
      <style jsx>{`
        .opening-prompt {
          position: relative;
          display: block;
          width: min(30rem, calc(100vw - 3rem), 65dvh);
          aspect-ratio: ${opening.asset.width} / ${opening.asset.height};
          margin: 0 auto 1.5rem;
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
        .opening-attribution { position: absolute; right: 0; bottom: 0; color: #cbd5e1; font-size: 0.75rem; }
        img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: contain; }
      `}</style>
    </span>
  );
}
