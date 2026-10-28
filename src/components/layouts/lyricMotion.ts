import getSpeedProfile, { SpeedProfileState } from './speedProfile';
import type {LyricLine} from '@/types';
import {loopCycle, loopDuration, loopPhase} from '@/utils/loopTimeline';

export interface LyricMotionInput {
  scrollTime: number;
  scrollTimeRef?: { readonly current: number };
  duration: number;
  velocity: number;
  velocityRef?: { readonly current: number };
  isPreviewMode: boolean;
  isPlaying?: boolean;
  seekRevision?: number;
  reducedMotion?: boolean;
}

/** Whole-line updates keep the current recording/cycle while avoiding autonomous travel. */
export function reducedLyricTime(time: number, duration: number, lyrics: LyricLine[]) {
  if (!lyrics.length) return time;
  const base = loopDuration(duration), phase = loopPhase(time, base);
  let index = lyrics.length - 1, cycle = loopCycle(time, base) - 1;
  for (let i = 0; i < lyrics.length && lyrics[i].time <= phase; i++) {
    index = i; cycle = loopCycle(time, base);
  }
  return cycle * base + lyrics[index].time;
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
  const velocity = input.velocityRef?.current ?? input.velocity;
  const reset = !previous || input.reducedMotion || input.isPreviewMode || input.isPlaying === false || previous.seekRevision !== input.seekRevision ||
    Math.abs(time - previous.profile.baseTime) > duration * .5;
  let manualHoldUntil = previous?.manualHoldUntil || 0;
  if (input.isPreviewMode || Math.abs(velocity) >= .016) manualHoldUntil = now + 520;

  if (reset) {
    return {profile: {time, baseTime: time, timestamp: now / 1000, baseSampleTimestamp: now / 1000,
      baseVelocity: 0, manualOffset: 0}, manualHoldUntil, preview: input.isPreviewMode, seekRevision: input.seekRevision};
  }

  const manualActive = now < manualHoldUntil || Math.abs(previous.profile.manualOffset) > .4;
  const result = getSpeedProfile({baseTime: time, duration, velocity, previous: previous.profile,
    now, manualActive, manualScale: manualActive ? .58 : .38, correctionStrength: manualActive ? 0 : .16});
  return {profile: result.state, manualHoldUntil, preview: input.isPreviewMode, seekRevision: input.seekRevision};
}
