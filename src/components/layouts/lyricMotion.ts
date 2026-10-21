import getSpeedProfile, { SpeedProfileState } from './speedProfile';

export interface LyricMotionInput {
  scrollTime: number;
  scrollTimeRef?: { readonly current: number };
  duration: number;
  velocity: number;
  isPreviewMode: boolean;
  isPlaying?: boolean;
  seekRevision?: number;
}

export interface LyricMotionState {
  profile: SpeedProfileState;
  manualHoldUntil: number;
  preview: boolean;
  seekRevision?: number;
}

/** Preserve the existing smoothing while keeping animation state outside React. */
export function advanceLyricMotion(previous: LyricMotionState | null, input: LyricMotionInput, now: number): LyricMotionState {
  const sampledTime = input.scrollTimeRef?.current ?? input.scrollTime;
  const time = Number.isFinite(sampledTime) ? sampledTime : 0;
  const duration = Math.max(1, input.duration || 1);
  const reset = !previous || input.isPreviewMode || input.isPlaying === false || previous.seekRevision !== input.seekRevision ||
    Math.abs(time - previous.profile.baseTime) > duration * .5;
  let manualHoldUntil = previous?.manualHoldUntil || 0;
  if (input.isPreviewMode || Math.abs(input.velocity) >= .016) manualHoldUntil = now + 520;

  if (reset) {
    return {profile: {time, baseTime: time, timestamp: now / 1000, baseSampleTimestamp: now / 1000,
      baseVelocity: 0, manualOffset: 0}, manualHoldUntil, preview: input.isPreviewMode, seekRevision: input.seekRevision};
  }

  const manualActive = now < manualHoldUntil || Math.abs(previous.profile.manualOffset) > .4;
  const result = getSpeedProfile({baseTime: time, duration, velocity: input.velocity, previous: previous.profile,
    now, manualActive, manualScale: manualActive ? .58 : .38, correctionStrength: manualActive ? 0 : .16});
  return {profile: result.state, manualHoldUntil, preview: input.isPreviewMode, seekRevision: input.seekRevision};
}
