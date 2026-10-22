'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useProjectConfigStore } from '@/stores/projectConfigStore';
import { DEFAULT_APPEARANCE, resolveAppearance, resolvePalette } from '@/config/appearance';
import type { AppearanceSettings } from '@/config/types';
import { isCatalogProject, PROJECT_CATALOG } from '@/config/catalog';
import ReadingSession from './ReadingSession';
import ClassicControls from './ClassicControls';
import SilkBackground from './backgrounds/SilkR3F';

export default function ClassicExperience() {
  const {config, lyrics, mediaDuration, sessionRevision, isLoading, pendingProjectId, error, loadProject, releasePreparation, cancelPendingProject} = useProjectConfigStore();
  const [entered, setEntered] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const playingIntent = useRef(false);
  const revisionRef = useRef(sessionRevision);
  revisionRef.current = sessionRevision;
  const navigationMode = useRef<'push' | 'replace' | 'none'>('replace');
  const [entryError, setEntryError] = useState<string | null>(null);
  const palette = useMemo(() => resolvePalette(appearance), [appearance]);

  useEffect(() => {
    const readLocation = () => {
      const id = new URL(location.href).searchParams.get('project') || 'heart-sutra';
      if (!isCatalogProject(id)) { cancelPendingProject(); setEntryError('没有找到这首曲目，请选择经典。'); return; }
      setEntryError(null);
      void loadProject(id);
    };
    readLocation();
    const onBack = () => { navigationMode.current = 'none'; readLocation(); };
    window.addEventListener('popstate', onBack);
    return () => { window.removeEventListener('popstate', onBack); cancelPendingProject(); };
  }, [loadProject, cancelPendingProject]);

  useLayoutEffect(() => {
    if (!config) return;
    const settings = resolveAppearance(config);
    setAppearance(settings);
    document.title = `${config.project.name} · ${config.assets.audio.artist ?? ''} | CoScroll`;
    const url = new URL(location.href);
    if (config.project.id === 'heart-sutra') url.searchParams.delete('project');
    else url.searchParams.set('project', config.project.id);
    if (navigationMode.current === 'push') history.pushState(null, '', url);
    else if (navigationMode.current === 'replace') history.replaceState(null, '', url);
    navigationMode.current = 'replace';
  }, [config, sessionRevision]);

  // Child model owners are established before releasing the staging reference.
  useEffect(() => { releasePreparation(); }, [sessionRevision, releasePreparation]);
  const onPlayingChange = useCallback((playing: boolean) => {
    if (revisionRef.current === sessionRevision) playingIntent.current = playing;
  }, [sessionRevision]);
  const onEnter = useCallback(() => { setEntered(true); }, []);
  const selectProject = useCallback((id: string) => {
    navigationMode.current = 'push'; setEntryError(null); void loadProject(id);
  }, [loadProject]);

  return <div data-active-project={config?.project.id ?? ''} data-session-revision={sessionRevision}
    data-palette={appearance.palette} data-hue={appearance.hueOffset}
    style={{height: '100dvh', '--scene-text': palette.currentText, '--scene-accent': palette.accent,
      '--scene-container': palette.container} as CSSProperties}>
    <div data-coscroll-background className="fixed inset-0 pointer-events-none"
      style={{zIndex: entered ? 0 : 2147483646, background: palette.container}}>
      <SilkBackground speed={4.9} scale={1} noiseIntensity={1.3} rotation={2.42} color={palette.background} />
    </div>
    {config ? <>
      <ReadingSession sessionRevision={sessionRevision} config={config} lyrics={lyrics} mediaDuration={mediaDuration}
        palette={palette} entered={entered} initialPlaying={entered && playingIntent.current}
        onEnter={onEnter} onPlayingChange={onPlayingChange} />
      <ClassicControls config={config} pendingProjectId={pendingProjectId}
        error={error}
        onSelect={selectProject} />
    </> : <div className="fixed inset-0 flex items-center justify-center text-center p-6"
      style={{zIndex: 2147483647, color: palette.currentText}}>
      <div><p role="status">{error || entryError || '正在准备经文与声音…'}</p>
        {(error || entryError) && <button type="button" className="mt-6 underline" onClick={() => selectProject('heart-sutra')}>打开心经</button>}
      </div>
    </div>}
    {config && (isLoading || error || entryError) && <div role={error || entryError ? 'alert' : 'status'}
      className="fixed left-4 right-4 text-center text-xs" style={{zIndex: 2147483647, top: 68, color: palette.adjacentText}}>
      {error || entryError || `正在准备${PROJECT_CATALOG.find(item => item.id === pendingProjectId)?.title ?? '曲目'}…`}
    </div>}
  </div>;
}
