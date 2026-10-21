// Simple global timeline store using refs and a minimal subscribe API

type Subscriber = () => void;
export interface AudioClockSample { display: number; absolute: number; }

class TimelineStore {
  // core timeline refs
  audioDisplayTime = 0; // within-loop time for audio
  audioAbsoluteTime = 0; // accumulated absolute time
  visualDisplayTime = 0; // UI-smoothed time
  visualAbsoluteTime = 0;
  scrollVelocity = 0;
  isPlaying = false;
  pendingAudioSeek: number | null = null;
  private audioClock: (() => AudioClockSample) | null = null;

  private subs: Set<Subscriber> = new Set();

  subscribe(fn: Subscriber) {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  }

  private emit() {
    this.subs.forEach(fn => fn());
  }

  setAudioTime(display: number, absolute: number) {
    this.audioDisplayTime = display;
    this.audioAbsoluteTime = absolute;
    // no emit by default to avoid high-frequency updates
  }

  requestAudioTime(display: number, absolute: number) {
    this.pendingAudioSeek = absolute;
    this.setAudioTime(display, absolute);
  }

  acknowledgeAudioSeek(display: number, absolute: number) {
    if (this.pendingAudioSeek !== null && this.pendingAudioSeek !== absolute) return;
    this.pendingAudioSeek = null;
    this.setAudioTime(display, absolute);
  }

  registerAudioClock(read: () => AudioClockSample) {
    this.audioClock = read;
    return () => { if (this.audioClock === read) this.audioClock = null; };
  }

  sampleAudioTime(): AudioClockSample {
    if (this.pendingAudioSeek !== null) return {display: this.audioDisplayTime, absolute: this.pendingAudioSeek};
    return this.audioClock?.() ?? {display: this.audioDisplayTime, absolute: this.audioAbsoluteTime};
  }

  setVisualTime(display: number, absolute: number) {
    this.visualDisplayTime = display;
    this.visualAbsoluteTime = absolute;
    // UI components that need it can subscribe; callers can throttle emits externally
  }

  setScrollVelocity(v: number, notify = false) {
    this.scrollVelocity = v;
    if (notify) this.emit();
  }

  setPlaying(p: boolean, notify = false) {
    this.isPlaying = p;
    if (notify) this.emit();
  }
}

const timelineStore = new TimelineStore();
export default timelineStore;

