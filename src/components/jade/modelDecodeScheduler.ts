/** Downloads may overlap; geometry restoration owns a single slot across asynchronous yields. */
export class ModelDecodeScheduler {
  private active = false;
  private sequence = 0;
  private queue: Array<{key: string; priority: number; sequence: number; start: () => void; cancel: () => void}> = [];

  promote(key: string) {
    for (const job of this.queue) if (job.key === key) job.priority = 0;
  }

  run<T>(key: string, work: () => Promise<T>, priority = 0, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {reject(signal.reason); return;}
      const cleanup = () => signal?.removeEventListener('abort', abort);
      const abort = () => {
        const index = this.queue.indexOf(job);
        if (index >= 0) {this.queue.splice(index, 1); cleanup(); reject(signal!.reason);}
      };
      const job = {key, priority, sequence: this.sequence++, cancel: abort, start: () => {
        cleanup(); this.active = true;
        Promise.resolve().then(() => {signal?.throwIfAborted(); return work();}).then(resolve, reject)
          .finally(() => {this.active = false; this.pump();});
      }};
      this.queue.push(job); signal?.addEventListener('abort', abort, {once: true});
      queueMicrotask(() => this.pump());
    });
  }

  private pump() {
    if (this.active || !this.queue.length) return;
    this.queue.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
    this.queue.shift()!.start();
  }
}
