// Run with playwright-cli run-code --filename after opening the app in a touch-enabled session.
async (page) => {
  let requests = 0;
  await page.route('**/audio/**', async route => {
    requests++;
    if (requests === 1) await route.abort('timedout');
    else await route.continue();
  });
  await page.addInitScript(() => {
    window.__audioRegression = { settled: 0, lastSettledAt: 0, events: [] };
    const play = window.__originalPlay || HTMLMediaElement.prototype.play;
    window.__originalPlay = play;
    HTMLMediaElement.prototype.play = function(...args) {
      return play.apply(this, args).then(() => new Promise(resolve => setTimeout(() => {
        window.__audioRegression.settled++;
        window.__audioRegression.lastSettledAt = performance.now();
        resolve();
      }, 1500)));
    };
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, e => {
      if (e.pointerType === 'touch') window.__audioRegression.events.push(type);
    }, true);
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('audio')?.readyState >= 2 && document.fonts.check('96px RunZhiJiaKangXiZidian', '心经'), undefined, { timeout: 45000 });
  if (requests < 2) throw new Error('Startup failure was not retried');
  const recovery = await page.evaluate(() => ({ ready: document.querySelector('audio').readyState, duration: document.querySelector('audio').duration }));
  await page.getByText('点击开始', { exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('audio').paused);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio').paused);
  await page.waitForFunction(() => window.__audioRegression.settled > 0 && performance.now() - window.__audioRegression.lastSettledAt > 300);
  const pause = await page.evaluate(() => ({ paused: document.querySelector('audio').paused, button: document.querySelector('button[aria-label]').getAttribute('aria-label') }));
  if (!pause.paused || pause.button !== 'Play') throw new Error('A late play promise overrode the pause intent');
  await page.evaluate(() => { HTMLMediaElement.prototype.play = window.__originalPlay; });
  await page.unroute('**/audio/**');

  const cdp = await page.context().newCDPSession(page);
  const point = (x, y) => ({ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 });
  async function swipe(from, to) {
    const before = await page.evaluate(() => { window.__audioRegression.events = []; return document.querySelector('audio').currentTime; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(from, 400)] });
    for (let step = 1; step <= 6; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(from + (to - from) * step / 6, 400)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const expected = await page.evaluate(({ before, delta }) => { const d = document.querySelector('audio').duration; return ((before + delta) % d + d) % d; }, { before, delta: (from - to) / 12 });
    await page.waitForFunction(expected => Math.abs(document.querySelector('audio').currentTime - expected) < 1, expected);
    const result = await page.evaluate(() => ({ after: document.querySelector('audio').currentTime, paused: document.querySelector('audio').paused, events: window.__audioRegression.events }));
    if (!result.paused || result.events.includes('pointercancel') || !result.events.includes('pointerup')) throw new Error('Touch preview was canceled or changed playback state');
    return { before, expected, ...result };
  }
  const forward = await swipe(290, 110), reverse = await swipe(110, 290);
  await page.locator('input[type="range"]').press('Home');
  await page.waitForFunction(() => document.querySelector('audio').currentTime < .1);
  const wrap = await swipe(110, 290);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(before => !document.querySelector('audio').paused && document.querySelector('audio').currentTime > before + .5, wrap.after);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio').paused);
  await page.setViewportSize({ width: 360, height: 800 });
  const range = await page.locator('input[type="range"]').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(range.x + range.width * .3, range.y + range.height / 2)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(range.x + range.width * .5, range.y + range.height / 2)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => { const a = document.querySelector('audio'); return a.currentTime > 60 && a.currentTime < 300 && Math.abs(a.currentTime - Number(document.querySelector('input[type="range"]').value)) < 2; });
  const progress = await page.evaluate(() => document.querySelector('audio').currentTime);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(before => !document.querySelector('audio').paused && document.querySelector('audio').currentTime > before + .5, progress);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('audio').paused);
  const narrow = await page.evaluate(() => { const r = document.querySelector('input[type="range"]').getBoundingClientRect(); return { viewport: [innerWidth, innerHeight], overflow: document.documentElement.scrollWidth > innerWidth, progressInsideViewport: r.x >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
  if (narrow.overflow || !narrow.progressInsideViewport) throw new Error('Narrow portrait controls overflow the viewport');
  await cdp.detach();
  return { requests, recovery, pause, forward, reverse, wrap, progress, narrow };
}
