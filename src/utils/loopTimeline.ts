/** Shared arithmetic for an unbounded, bidirectional timeline. */
export function loopDuration(duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

export function loopPhase(time: number, duration: number): number {
  const base = loopDuration(duration);
  if (!Number.isFinite(time)) return 0;
  const phase = time % base;
  return phase < 0 ? phase + base : phase === 0 ? 0 : phase;
}

export function loopCycle(time: number, duration: number): number {
  return Number.isFinite(time) ? Math.floor(time / loopDuration(duration)) : 0;
}

/** A scrubber selects a phase in the current cycle; duration selects its end. */
export function timeInCurrentCycle(absoluteTime: number, phase: number, duration: number): number {
  const base = loopDuration(duration);
  return loopCycle(absoluteTime, base) * base + (Number.isFinite(phase) ? phase : 0);
}

/** Called only for native playback samples, after explicit seeks reset previous. */
export function playbackCycle(previousPhase: number, phase: number, cycle: number, duration: number): number {
  return previousPhase - phase > loopDuration(duration) * .5 ? cycle + 1 : cycle;
}

/** Stable slots retain lyric identity, including playlists shorter than a window. */
export function lyricSlot(cycle: number, index: number, lineCount: number, range: number): string {
  const cycles = Math.max(1, Math.ceil((range * 2 + 1) / lineCount));
  return String(loopPhase(loopPhase(cycle, cycles) * lineCount + index, cycles * lineCount));
}
