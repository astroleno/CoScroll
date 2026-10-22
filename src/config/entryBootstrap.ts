import type { ProjectConfig } from './types';

export const ENTRY_DATA_ID = 'coscroll-entry-data';
export interface EntryProject { config: ProjectConfig; lyrics: string; }
export interface EntryData { version: 1; release: string; projects: Record<string, EntryProject>; }
declare global {
  interface Window {
    __coscrollEntryAudio?: {release: string; src: string; request: Promise<Response>};
  }
}

export function readEntryAudio(src: string): Promise<Response> | undefined {
  if (typeof window === 'undefined') return;
  const entry = window.__coscrollEntryAudio;
  const release = document.querySelector('meta[name="coscroll-release-id"]')?.getAttribute('content');
  if (entry?.src === src && entry.release === release) return entry.request;
}

/** An optional build-time hint. The loader and LRC parser remain authoritative. */
export function readEntryProject(id: string): EntryProject | null {
  if (typeof document === 'undefined') return null;
  try {
    const node = document.getElementById(ENTRY_DATA_ID);
    const data = JSON.parse(node?.textContent || '') as EntryData;
    const release = document.querySelector('meta[name="coscroll-release-id"]')?.getAttribute('content');
    if (data.version !== 1 || data.release !== release || !Object.hasOwn(data.projects, id)) return null;
    const project = data.projects[id];
    return project?.config?.project?.id === id && typeof project?.config?.assets?.lyrics?.src === 'string' &&
      typeof project.lyrics === 'string' ? project : null;
  } catch { return null; }
}

export function serializeEntryData(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
