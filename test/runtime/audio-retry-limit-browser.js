// Fault injection: the app must stop after two explicit startup reloads.
async (page) => {
  await page.addInitScript(() => {
    window.__retryLimit = { reloads: 0, errors: 0, lastErrorAt: 0 };
    const load = window.__originalLoad || HTMLMediaElement.prototype.load;
    window.__originalLoad = load;
    HTMLMediaElement.prototype.load = function(...args) {
      window.__retryLimit.reloads++;
      return load.apply(this, args);
    };
    document.addEventListener('error', e => {
      if (e.target instanceof HTMLAudioElement && e.target.currentSrc.includes('/audio/')) {
        window.__retryLimit.errors++;
        window.__retryLimit.lastErrorAt = performance.now();
      }
    }, true);
  });
  await page.route('**/audio/**', route => route.abort('timedout'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__retryLimit.errors >= 3 && performance.now() - window.__retryLimit.lastErrorAt > 3500, undefined, { timeout: 20000 });
  const result = await page.evaluate(() => ({ ...window.__retryLimit, ready: document.querySelector('audio').readyState }));
  if (result.reloads !== 2 || result.errors !== 3 || result.ready !== 0) throw new Error('Startup retries did not stop at the configured limit');
  await page.unroute('**/audio/**');
  await page.evaluate(() => { HTMLMediaElement.prototype.load = window.__originalLoad; });
  return result;
}
