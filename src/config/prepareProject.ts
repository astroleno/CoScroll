import { projectConfigLoader } from './loader';
import { parseLRC } from './lyrics';
import { resolveAnchor } from './resolveAnchor';
import { assetUrl } from '@/utils/assetUrl';
import ModelPreloader from '@/components/jade/ModelPreloader';

export async function prepareAudio(src: string, signal: AbortSignal, verifiedDuration?: number): Promise<number> {
  // A policy-blocked media preload must not hide the gesture that can start it.
  // Check the actual object over HTTP, prefer native metadata, then use the
  // recording's offline-verified duration until AudioEngine reports its clock.
  const response = await fetch(src, {signal, headers: {Range: 'bytes=0-0'}});
  if (!response.ok) throw new Error(`录音加载失败（${response.status}）`);
  await response.body?.cancel();
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      audio.onloadedmetadata = audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
    };
    const abort = () => { cleanup(); reject(new DOMException('切曲已取消', 'AbortError')); };
    const timer = setTimeout(() => {
      cleanup();
      if (Number.isFinite(verifiedDuration) && verifiedDuration > 0) resolve(verifiedDuration);
      else reject(new Error('录音缺少可用时长，请重试'));
    }, 1200);
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      cleanup();
      if (Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error('无法读取实际音频时长'));
    };
    audio.onerror = () => { cleanup(); reject(new Error('录音加载失败，请重试')); };
    signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) { abort(); return; }
    audio.src = src;
    audio.load();
  });
}

export async function prepareProject(projectId: string, signal: AbortSignal, useCache = true) {
  const config = await projectConfigLoader.load(projectId, {signal, useCache, fallbackToDefault: false});
  const initialModel = resolveAnchor(config.timeline[0].anchor, config).modelPath;
  const preloader = ModelPreloader.getInstance();
  const release = preloader.retainPaths([initialModel]);
  let abort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason ?? new DOMException('切曲已取消', 'AbortError'));
    signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) abort();
  });
  try {
    const [lyrics, duration] = await Promise.race([aborted, Promise.all([
      fetch(assetUrl(config.assets.lyrics.src), {signal}).then(async response => {
        if (!response.ok) throw new Error(`歌词加载失败（${response.status}）`);
        const lines = parseLRC(await response.text());
        if (document.fonts) {
          await document.fonts.load('16px RunZhiJiaKangXiZidian', lines.map(line => line.text).join(''));
        }
        signal.throwIfAborted();
        return lines;
      }),
      prepareAudio(assetUrl(config.assets.audio.src), signal, config.assets.audio.duration),
      preloader.loadModel(initialModel),
    ])]);
    signal.throwIfAborted();
    if (lyrics.some(line => line.time >= duration) || config.timeline.some(item => item.time >= duration)) {
      throw new Error('唱词或锚点超出这份录音的实际时长');
    }
    return {config, lyrics, duration, release};
  } catch (error) { release(); throw error; }
  finally { signal.removeEventListener('abort', abort); }
}
