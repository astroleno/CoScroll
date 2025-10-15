export type SpeedProfileMode = 'constant' | 'screened';

export interface SpeedProfileState {
  /** Last emitted effective time (absolute seconds). */
  time: number;
  /** Last base time sample (absolute seconds). */
  baseTime: number;
  /** Timestamp (seconds) when the state was calculated. */
  timestamp: number;
  /** Timestamp (seconds) when base velocity was last estimated. */
  baseSampleTimestamp: number;
  /** Estimated base timeline velocity (seconds per second). */
  baseVelocity: number;
  /** Accumulated manual offset applied to the base timeline. */
  manualOffset: number;
}

interface SpeedProfileOptions {
  /** Current absolute base time coming from the audio timeline. */
  baseTime: number;
  /** Loop duration, used to detect large seeks. */
  duration: number;
  /** External velocity from UI scroll, arbitrary units. */
  velocity?: number;
  /** Previous state snapshot. */
  previous?: SpeedProfileState | null;
  /** Optional timestamp override (ms). */
  now?: number;
  /** Clamp per-frame delta to avoid jumps (ms). */
  maxDeltaMs?: number;
  /** Whether the user is actively manipulating the scroll timeline. */
  manualActive?: boolean;
  /** Gain applied to convert velocity into seconds-per-second. */
  manualScale?: number;
  /** Strength towards base timeline when not manual (0-1). */
  correctionStrength?: number;
}

interface SpeedProfileResult {
  time: number;
  state: SpeedProfileState;
}

const DEFAULT_MAX_DELTA_MS = 32;
const MAX_BASE_VELOCITY = 4;      // seconds of timeline per real second
const MAX_MANUAL_VELOCITY = 20;   // clamp manual influence
const DEFAULT_MANUAL_SCALE = 0.45;
const DEFAULT_CORRECTION = 0.18;
const MANUAL_OFFSET_LIMIT = 240;  // seconds, prevent runaway

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function isFiniteNumber(value: number): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Computes a smooth timeline that blends audio-driven time with manual scroll velocity.
 * - Integrates inferred base velocity between sparse audio updates to avoid visible stepping.
 * - Adds manual scroll velocity scaled by a configurable gain.
 * - Applies gentle correction back to the audio timeline when the user is not interacting.
 */
export function getSpeedProfile(options: SpeedProfileOptions): SpeedProfileResult {
  const {
    baseTime,
    duration,
    velocity = 0,
    previous,
    now = (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    maxDeltaMs = DEFAULT_MAX_DELTA_MS,
    manualActive = false,
    manualScale = DEFAULT_MANUAL_SCALE,
    correctionStrength = DEFAULT_CORRECTION,
  } = options;

  const safeTime = isFiniteNumber(baseTime) ? baseTime : previous?.time ?? 0;
  const safeDuration = isFiniteNumber(duration) && duration > 0 ? duration : 1;
  const nowSec = now / 1000;

  const prevState: SpeedProfileState = previous ?? {
    time: safeTime,
    baseTime: safeTime,
    timestamp: nowSec,
    baseSampleTimestamp: nowSec,
    baseVelocity: 0,
    manualOffset: 0,
  };

  const rawDeltaSec = Math.max(0, nowSec - prevState.timestamp);
  const deltaSec = Math.min(rawDeltaSec, maxDeltaMs / 1000);

  const baseJump = safeTime - prevState.baseTime;
  const seekThreshold = Math.max(1.5, safeDuration * 0.4);
  const isSeek = Math.abs(baseJump) > seekThreshold;

  if (isSeek || deltaSec <= 0) {
    const clampedOffset = clamp(prevState.manualOffset, -MANUAL_OFFSET_LIMIT, MANUAL_OFFSET_LIMIT);
    const state: SpeedProfileState = {
      time: safeTime + clampedOffset,
      baseTime: safeTime,
      timestamp: nowSec,
      baseSampleTimestamp: nowSec,
      baseVelocity: 0,
      manualOffset: clampedOffset,
    };
    return { time: state.time, state };
  }

  let baseVelocity = prevState.baseVelocity;
  let baseSampleTimestamp = prevState.baseSampleTimestamp;

  if (Math.abs(baseJump) > 1e-5) {
    const sampleDelta = Math.max(nowSec - prevState.baseSampleTimestamp, 1e-3);
    const measuredVelocity = clamp(baseJump / sampleDelta, -MAX_BASE_VELOCITY, MAX_BASE_VELOCITY);
    const smoothing = Math.abs(measuredVelocity - baseVelocity) > 1.2 ? 0.5 : 0.22;
    baseVelocity += (measuredVelocity - baseVelocity) * smoothing;
    baseSampleTimestamp = nowSec;
  }

  const manualVelocity = clamp(velocity * manualScale, -MAX_MANUAL_VELOCITY, MAX_MANUAL_VELOCITY);
  let manualOffset = prevState.manualOffset;
  const manualGain = manualActive ? 1 : 0.25;
  manualOffset += manualVelocity * manualGain * deltaSec;
  manualOffset = clamp(manualOffset, -MANUAL_OFFSET_LIMIT, MANUAL_OFFSET_LIMIT);

  const baseComponentPrev = prevState.time - prevState.manualOffset;
  let predictedBase = baseComponentPrev + baseVelocity * deltaSec;

  if (!manualActive) {
    const correction = clamp(correctionStrength, 0, 0.6);
    predictedBase += (safeTime - predictedBase) * correction;
    manualOffset *= Math.max(0, 1 - correction * 1.2);
  }

  let predictedTime = predictedBase + manualOffset;

  if (!isFiniteNumber(predictedTime)) {
    predictedTime = safeTime + manualOffset;
  }

  const state: SpeedProfileState = {
    time: predictedTime,
    baseTime: safeTime,
    timestamp: nowSec,
    baseSampleTimestamp,
    baseVelocity,
    manualOffset,
  };

  return {
    time: predictedTime,
    state,
  };
}

export default getSpeedProfile;
