import {touchTap} from './ego-performance.mjs';

/** Run on a fresh, ready cover in an Ego Page with native touch emulation. */
export async function verifyTouchFlow(page, {screenshotPrefix} = {}) {
  const point = (x, y) => ({x, y, id: 1, radiusX: 2, radiusY: 2, force: 1});
  await page.evaluate(() => {
    window.__touchRegression = {events: [], phase: 'start', inputs: [], background: document.querySelector('[data-coscroll-background] canvas')};
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, e => {
      if (e.pointerType === 'touch') window.__touchRegression.events.push(type);
    }, true);
    document.addEventListener('input', e => {if (e.target.matches?.('input[type="range"]')) window.__touchRegression.inputs.push({at: performance.now(), value: Number(e.target.value)});}, true);
  });
  await touchTap(page, '[data-coscroll-intro]');
  await page.waitForFunction(() => !document.querySelector('audio').paused && document.querySelector('audio').currentTime > .5, undefined, {timeout: 15000});
  await touchTap(page, 'button[aria-label="Pause"]');
  await page.waitForFunction(() => document.querySelector('audio').paused && !!document.querySelector('button[aria-label="Play"]'), undefined, {timeout: 10000});
  const transition = await page.evaluate(() => ({sameBackground: window.__touchRegression.background === document.querySelector('[data-coscroll-background] canvas'), canvasCount: document.querySelectorAll('canvas').length}));

  async function swipe(from, to) {
    const before = await page.evaluate(() => {window.__touchRegression.phase = 'horizontal-swipe'; window.__touchRegression.events = []; return document.querySelector('audio').currentTime;});
    await page.cdp('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point(from, 400)]});
    for (let step = 1; step <= 6; step++) await page.cdp('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [point(from + (to - from) * step / 6, 400)]});
    await page.cdp('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    const expected = await page.evaluate(({before, delta}) => {const d = document.querySelector('audio').duration; return ((before + delta) % d + d) % d;}, {before, delta: (from - to) / 12});
    await page.waitForFunction(expected => Math.abs(document.querySelector('audio').currentTime - expected) < .5, expected, {timeout: 10000});
    const result = await page.evaluate(() => ({after: document.querySelector('audio').currentTime, paused: document.querySelector('audio').paused, events: window.__touchRegression.events}));
    if (!result.paused || result.events.includes('pointercancel') || !result.events.includes('pointerup')) throw new Error('Touch preview canceled or changed playback intent');
    return {before, expected, ...result};
  }

  async function dragProgress(startFraction, endFraction) {
    const r = await page.evaluate(() => {window.__touchRegression.phase = 'progress-drag'; const r = document.querySelector('input[type="range"]').getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height};});
    await page.cdp('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point(r.x + r.width * startFraction, r.y + r.height / 2)]});
    await page.cdp('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [point(r.x + (endFraction === 0 ? 1 : r.width * endFraction), r.y + r.height / 2)]});
    await page.cdp('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  }

  const forward = await swipe(290, 110), reverse = await swipe(110, 290);
  await dragProgress(.5, 0);
  await page.waitForFunction(() => document.querySelector('audio').currentTime < .1, undefined, {timeout: 10000});
  const wrap = await swipe(110, 290);
  await touchTap(page, 'button[aria-label="Play"]');
  await page.waitForFunction(before => !document.querySelector('audio').paused && document.querySelector('audio').currentTime > before + .5, wrap.after, {timeout: 10000});
  await touchTap(page, 'button[aria-label="Pause"]');
  await page.waitForFunction(() => document.querySelector('audio').paused, undefined, {timeout: 10000});

  // Leaving the range without an active mouse drag must not seek to an old
  // dragTime after a touch swipe or keyboard seek has changed the timeline.
  const hover = await page.evaluate(() => {window.__touchRegression.phase = 'inactive-hover'; const r = document.querySelector('input[type="range"]').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2, time: document.querySelector('audio').currentTime};});
  await page.mouse.move(hover.x, hover.y);
  await page.mouse.move(20, 20);
  await page.evaluate(async () => {await new Promise(resolve => setTimeout(resolve, 300));});
  const afterHover = await page.evaluate(() => document.querySelector('audio').currentTime);
  if (Math.abs(afterHover - hover.time) > .1) throw new Error('Inactive range hover restored an old seek position');

  await page.cdp('Emulation.setDeviceMetricsOverride', {width: 360, height: 800, screenWidth: 360, screenHeight: 800, deviceScaleFactor: 2, mobile: true});
  await page.waitForFunction(() => innerWidth === 360, undefined, {timeout: 10000});
  await dragProgress(.3, .5);
  await page.waitForFunction(() => {const a = document.querySelector('audio'); return a.currentTime > 60 && a.currentTime < 300 && Math.abs(a.currentTime - Number(document.querySelector('input[type="range"]').value)) < 2;}, undefined, {timeout: 10000});
  const progress = await page.evaluate(() => document.querySelector('audio').currentTime);
  const rapidRange = await page.evaluate(() => {window.__touchRegression.phase = 'rapid-progress-drag'; const r = document.querySelector('input[type="range"]').getBoundingClientRect(); return {x: r.x, y: r.y + r.height / 2, width: r.width};});
  await page.cdp('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point(rapidRange.x + rapidRange.width * .5, rapidRange.y)]});
  for (const fraction of [.8, .2, .7, .4, .6, .5]) await page.cdp('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [point(rapidRange.x + rapidRange.width * fraction, rapidRange.y)]});
  await page.cdp('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  // Let the 100ms seek-coalescing window expire before asserting latest-wins.
  await page.evaluate(async () => {await new Promise(resolve => setTimeout(resolve, 200));});
  await page.waitForFunction(() => {const a = document.querySelector('audio'); return Math.abs(a.currentTime - a.duration / 2) < 1.5 && Math.abs(a.currentTime - Number(document.querySelector('input[type="range"]').value)) < 1;}, undefined, {timeout: 10000});
  await touchTap(page, 'button[aria-label="Play"]');
  await page.waitForFunction(before => !document.querySelector('audio').paused && document.querySelector('audio').currentTime > before + .5, progress, {timeout: 10000});
  await touchTap(page, 'button[aria-label="Pause"]');
  await page.waitForFunction(() => document.querySelector('audio').paused, undefined, {timeout: 10000});
  if (screenshotPrefix) await page.screenshot({path: screenshotPrefix + '-narrow.png'});
  const final = await page.evaluate(() => {const r = document.querySelector('input[type="range"]').getBoundingClientRect(); return {
    viewport: [innerWidth, innerHeight], overflow: document.documentElement.scrollWidth > innerWidth,
    progressInside: r.x >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    errors: window.__coscrollPerf?.errors || [], canvasCount: document.querySelectorAll('canvas').length,
    inputs: window.__touchRegression.inputs,
  };});
  if (!transition.sameBackground || transition.canvasCount !== 2 || final.canvasCount !== 2 || final.errors.length || final.overflow || !final.progressInside) throw new Error(JSON.stringify({transition, final}));
  return {transition, forward, reverse, wrap, progress, afterHover, final};
}

/** Exercise several real React input handlers inside the seek throttle window. */
export async function verifyRapidSeekQueue(page) {
  const result = await page.evaluate(async () => {
    const input = document.querySelector('input[type="range"]'), audio = document.querySelector('audio');
    const inputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    const mediaTime = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
    const inputs = [], applied = [];
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {...mediaTime, set(value) {
      if (this === audio) applied.push({at: performance.now(), value});
      return mediaTime.set.call(this, value);
    }});
    try {
      for (const value of [2, 9, 3, 8, 4, 7]) {
        inputValue.set.call(input, String(value));
        input.dispatchEvent(new Event('input', {bubbles: true}));
        inputs.push({at: performance.now(), value});
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      await new Promise(resolve => setTimeout(resolve, 250));
      return {inputs, applied, audioTime: audio.currentTime, rangeValue: Number(input.value), paused: audio.paused};
    } finally {
      Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', mediaTime);
    }
  });
  if (!result.paused || Math.abs(result.audioTime - 7) > .1 || Math.abs(result.rangeValue - 7) > .1) throw new Error('A queued seek overrode the latest input: ' + JSON.stringify(result));
  return result;
}
