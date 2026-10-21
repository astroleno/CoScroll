export interface RetainedResource<K, V> {
  key: K;
  value: V;
  bytes: number;
  users: number;
  used: number;
}

/** Active resources are pinned; only a bounded LRU of unused resources survives. */
export class RetainedResourceCache<K, V> {
  private entries = new Map<K, RetainedResource<K, V>>();
  private revision = 0;

  constructor(private dispose: (value: V) => void,
    private maxIdleEntries = 8, private maxIdleBytes = 12 * 1024 * 1024) {}

  get(key: K, create: () => {value: V; bytes: number}): RetainedResource<K, V> {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {key, ...create(), users: 0, used: 0};
      this.entries.set(key, entry);
    }
    entry.used = ++this.revision;
    return entry;
  }

  retain(entry: RetainedResource<K, V>): () => void {
    entry.users++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      entry.users--;
      entry.used = ++this.revision;
      // All layout effects in the current React commit pin their new entries
      // before we decide which old, unused textures may be released.
      queueMicrotask(() => this.trim());
    };
  }

  trim(): void {
    const idle = Array.from(this.entries.values()).filter(entry => entry.users === 0).sort((a, b) => a.used - b.used);
    let count = idle.length, bytes = idle.reduce((sum, entry) => sum + entry.bytes, 0);
    for (const entry of idle) {
      if (count <= this.maxIdleEntries && bytes <= this.maxIdleBytes) break;
      this.entries.delete(entry.key);
      this.dispose(entry.value);
      count--; bytes -= entry.bytes;
    }
  }

  clear(): void {
    this.entries.forEach(entry => this.dispose(entry.value));
    this.entries.clear();
  }

  get size(): number { return this.entries.size; }
}
