'use client';

import { useEffect, useRef, useState } from 'react';
import type { AppearanceSettings, ProjectConfig } from '@/config/types';
import { PROJECT_CATALOG } from '@/config/catalog';
import { PALETTES } from '@/config/appearance';

interface Props {
  config: ProjectConfig;
  pendingProjectId: string | null;
  error?: string | null;
  appearance: AppearanceSettings;
  onSelect: (id: string) => void;
  onAppearance: (settings: AppearanceSettings, persist?: boolean) => void;
  onCommitAppearance: () => void;
  onResetAppearance: () => void;
}

export default function ClassicControls({config, pendingProjectId, error, appearance, onSelect, onAppearance, onCommitAppearance, onResetAppearance}: Props) {
  const [panel, setPanel] = useState<'classics' | 'appearance' | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const projectId = config.project.id;
  useEffect(() => { setPanel(null); }, [projectId]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (panel) {
      previousFocus.current = document.activeElement as HTMLElement;
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
      previousFocus.current?.focus();
    }
  }, [panel]);
  const pending = config.anchors.mappings.filter(item => item.status === 'placeholder');
  return <>
    <header className="classic-controls" aria-label="曲目与配色">
      <button type="button" className="classic-title" onClick={() => setPanel('classics')} aria-haspopup="dialog"
        aria-expanded={panel === 'classics'} aria-label={`切换经典，当前${config.project.name}`}>
        <span>{config.project.name}</span><span className="artist">{config.assets.audio.artist}</span><span aria-hidden>⌄</span>
      </button>
      <button type="button" onClick={() => setPanel('appearance')} aria-haspopup="dialog" aria-expanded={panel === 'appearance'}>画面</button>
    </header>
    <dialog ref={dialogRef} aria-labelledby="classic-panel-title" onCancel={() => setPanel(null)} onClose={() => setPanel(null)}
      onClick={event => { if (event.target === event.currentTarget) setPanel(null); }}
      onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <div className="panel-heading"><h2 id="classic-panel-title">{panel === 'classics' ? '经典' : '画面'}</h2>
        <button type="button" aria-label="关闭面板" onClick={() => setPanel(null)}>关闭</button></div>
      {panel === 'classics' ? <>
        {error && <p role="alert" className="panel-note">{error}</p>}
        <div className="track-list">{PROJECT_CATALOG.map(project => <button type="button" key={project.id}
          data-project-option={project.id} aria-pressed={projectId === project.id} onClick={() => onSelect(project.id)}>
          <span className="track-title">{project.title}<span>{pendingProjectId === project.id ? '准备中…' : projectId === project.id ? '当前' : project.duration}</span></span>
          <span className="track-description">{project.artist} · {project.recording}</span>
        </button>)}</div>
        {pending.length > 0 && <details><summary>当前曲目有 {pending.length} 个占位字</summary>
          <ul>{pending.map(item => <li key={item.anchor}>{item.anchor} → {item.renderedCharacter} · {item.pendingReason === 'pending-simplification' ? '制作中' : '待替换'}</li>)}</ul>
        </details>}
        <p className="panel-note">切换后从曲首开始，保留当前播放或暂停状态。</p>
      </> : <>
        <p className="panel-note">选择配色，让背景、玉字和经文色调相随。</p>
        <div className="palette-options" aria-label="配色预设">{Object.entries(PALETTES).map(([id, preset]) => <button
          type="button" key={id} aria-pressed={appearance.palette === id}
          onClick={() => onAppearance({...appearance, palette: id as AppearanceSettings['palette'], hueOffset: 0}, true)}>
          <span className="swatch" style={{background: preset.colors.accent}} aria-hidden />{preset.name}
        </button>)}</div>
        <label className="hue-label" htmlFor="scene-hue">色调 <output>{appearance.hueOffset}°</output></label>
        <input id="scene-hue" aria-label="整体色调" type="range" min={-180} max={180} step={1} value={appearance.hueOffset}
          onChange={event => onAppearance({...appearance, hueOffset: Number(event.target.value)})}
          onPointerUp={onCommitAppearance} onKeyUp={onCommitAppearance} onBlur={onCommitAppearance} />
        <div className="appearance-actions"><button type="button" onClick={onResetAppearance}>恢复推荐画面</button><span>按曲目保存在本机</span></div>
      </>}
    </dialog>
    <style jsx>{`
      .classic-controls { position:fixed; top:max(14px, env(safe-area-inset-top)); left:20px; right:20px; display:flex; align-items:center; justify-content:space-between; gap:16px; z-index:2147483647; color:var(--scene-text); }
      button { font:inherit; color:inherit; cursor:pointer; border:0; background:transparent; padding:10px 8px; border-radius:5px; }
      button:hover { background:rgba(255,255,255,.06); }
      button:focus-visible, input:focus-visible, summary:focus-visible { outline:2px solid var(--scene-accent); outline-offset:4px; }
      .classic-title { display:flex; align-items:center; gap:10px; min-width:0; font-size:14px; letter-spacing:.08em; }
      .artist { font-size:11px; opacity:.6; letter-spacing:0; }
      dialog { position:fixed; inset:auto 12px max(14px,env(safe-area-inset-bottom)); box-sizing:border-box; width:calc(100% - 24px); max-width:480px; max-height:80dvh; overflow:auto; margin:0 auto; border:1px solid rgba(255,255,255,.14); border-radius:12px; padding:22px; color:var(--scene-text); background:var(--scene-container); box-shadow:0 16px 64px rgba(0,0,0,.3); }
      dialog::backdrop { background:rgba(0,0,0,.4); }
      .panel-heading { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
      h2 { font-size:18px; font-weight:500; letter-spacing:.15em; margin:0; }
      .panel-heading button { font-size:12px; opacity:.7; }
      .track-list { display:grid; gap:6px; }
      .track-list button { display:grid; text-align:left; padding:16px 12px; border:1px solid transparent; }
      button[aria-pressed=true] { border-color:var(--scene-accent); background:rgba(255,255,255,.045); }
      .track-title { display:flex; align-items:center; justify-content:space-between; font-size:17px; }
      .track-title span { font-size:11px; opacity:.65; }
      .track-description { margin-top:7px; font-size:12px; opacity:.6; }
      .panel-note { font-size:12px; line-height:1.8; opacity:.65; margin:16px 0 6px; }
      details { font-size:12px; margin:18px 4px 0; line-height:1.9; opacity:.8; }
      summary { cursor:pointer; } ul { margin:8px 0 0; padding-left:20px; }
      .palette-options { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:18px 0 24px; }
      .palette-options button { display:flex; align-items:center; gap:10px; border:1px solid rgba(255,255,255,.12); padding:13px; font-size:13px; }
      .palette-options button[aria-pressed=true] { border-color:var(--scene-accent); }
      .swatch { width:15px; height:15px; border-radius:50%; }
      .hue-label { display:flex; justify-content:space-between; font-size:13px; }
      output { opacity:.7; font-variant-numeric:tabular-nums; }
      input { width:100%; margin:20px 0; accent-color:var(--scene-accent); }
      .appearance-actions { display:flex; align-items:center; justify-content:space-between; font-size:12px; }
      .appearance-actions span { font-size:11px; opacity:.5; }
      @media(min-width:640px) { dialog { inset:70px 22px auto auto; width:380px; margin:0; } }
    `}</style>
  </>;
}
