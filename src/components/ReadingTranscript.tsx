'use client';

import {memo} from 'react';
import type {LyricLine} from '@/types';

/** A stable, non-live reading path backed by the same verified lyric array as the scene. */
function ReadingTranscript({title, description, lyrics}: {title: string; description?: string; lyrics: LyricLine[]}) {
  return <section className="sr-only" aria-labelledby="reading-text-title" data-coscroll-transcript>
    <h1 id="reading-text-title">{title} · 歌词</h1>
    {description && <p>{description}</p>}
    <ol>{lyrics.map((line, index) => line.text.trim() && <li key={index}>{line.text.trim()}</li>)}</ol>
  </section>;
}

export default memo(ReadingTranscript);
