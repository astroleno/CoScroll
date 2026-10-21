/** One small preparation job per idle turn, with cancellation on navigation. */
export function scheduleIdle(work: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(work, {timeout: 1500});
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(work, 32);
  return () => clearTimeout(id);
}
