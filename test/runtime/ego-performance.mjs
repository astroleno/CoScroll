// Import from an ego-browser Node.js round and pass its managed Page.
// Instrumentation stays in the test page; nothing is included in the application.
export function performanceInstrumentation() {
  return `(${installInstrumentation.toString()})()`;
}

function installInstrumentation() {
  if (window.__coscrollPerf) return;
  const q = window.__coscrollPerf = {
    errors: [], warnings: [], milestones: {}, contexts: [], commits: [], renderers: {}, uploads: 0,
  };
  addEventListener('error', e => {if (q.errors.length < 50) q.errors.push(e.message || e.target?.src || e.target?.href || 'resource error');}, true);
  addEventListener('unhandledrejection', e => {if (q.errors.length < 50) q.errors.push(String(e.reason?.message || e.reason));});
  const warn = console.warn;
  console.warn = function(...args) {if (q.warnings.length < 50) q.warnings.push(args.map(String).join(' ')); return warn.apply(this, args);};
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || {
    supportsFiber: true, renderers: new Map(),
    inject(renderer) {const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id;},
    onCommitFiberRoot() {}, onCommitFiberUnmount() {},
  };
  const inject = hook.inject;
  hook.inject = function(renderer) {const id = inject.call(this, renderer); q.renderers[id] = {name: renderer.rendererPackageName, version: renderer.version}; return id;};
  const commit = hook.onCommitFiberRoot;
  hook.onCommitFiberRoot = function(id, ...args) {if (q.commits.length < 10000) q.commits.push({id, at: performance.now()}); return commit?.call(this, id, ...args);};
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
  const recorded = new WeakMap();
  for (const name of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
    const proto = window[name]?.prototype;
    if (!proto) continue;
    for (const method of ['drawArrays', 'drawElements']) {
      const original = proto[method];
      proto[method] = function(...args) {
        let context = recorded.get(this);
        if (!context) {context = {canvas: this.canvas, draws: 0}; recorded.set(this, context); q.contexts.push(context);}
        context.draws++;
        if (!q.milestones.shaderFirstDrawMs && this.canvas.closest('[data-coscroll-background]')) q.milestones.shaderFirstDrawMs = performance.now();
        return original.apply(this, args);
      };
    }
    for (const method of ['texImage2D', 'texSubImage2D']) {
      const original = proto[method];
      proto[method] = function(...args) {if (args.some(x => x instanceof HTMLCanvasElement)) q.uploads++; return original.apply(this, args);};
    }
  }
  const timer = setInterval(() => {
    const now = performance.now();
    if (!q.milestones.coverReadyMs && document.querySelector('[data-coscroll-intro]')) q.milestones.coverReadyMs = now;
    if (!q.milestones.audioReadyMs && document.querySelector('audio')?.readyState >= 2) q.milestones.audioReadyMs = now;
    if (!q.milestones.fontReadyMs && [...document.fonts].some(f => f.family.replace(/['"]/g, '') === 'RunZhiJiaKangXiZidian' && f.status === 'loaded')) q.milestones.fontReadyMs = now;
    if (q.milestones.coverReadyMs && q.milestones.audioReadyMs && q.milestones.fontReadyMs) clearInterval(timer);
  }, 100);
}

// CDP overrides and startup scripts are scoped to the current Ego round/session.
// Reapply them at the beginning of every round that navigates and measures.
export async function prepareMobilePerformance(page) {
  await page.cdp('Network.enable', {});
  await page.cdp('Network.setCacheDisabled', {cacheDisabled: true});
  await page.cdp('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, screenWidth: 390, screenHeight: 844, deviceScaleFactor: 2, mobile: true});
  await page.cdp('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
  await page.cdp('Network.setUserAgentOverride', {userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36'});
  await page.cdp('Emulation.setFocusEmulationEnabled', {enabled: true});
  await page.cdp('Emulation.setCPUThrottlingRate', {rate: 1});
  await page.cdp('Network.emulateNetworkConditions', {offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1});
  await page.cdp('Page.addScriptToEvaluateOnNewDocument', {source: performanceInstrumentation()});
}

export async function touchTap(page, selector) {
  const point = await page.evaluate(selector => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return {x: r.x + r.width / 2, y: r.y + r.height / 2, id: 1, radiusX: 2, radiusY: 2, force: 1};
  }, selector);
  await page.cdp('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
  await page.cdp('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}

export async function samplePerformance(page, duration = 6000) {
  return await page.evaluate(async duration => {
    const q = window.__coscrollPerf, start = performance.now(), frames = [];
    const before = q?.contexts.map(c => ({context: c, draws: c.draws})) || [];
    const uploads = q?.uploads || 0;
    let previous = start;
    await new Promise(resolve => {const tick = now => {frames.push(now - previous); previous = now; if (now - start >= duration) resolve(); else requestAnimationFrame(tick);}; requestAnimationFrame(tick);});
    const sorted = frames.slice().sort((a, b) => a - b), elapsed = previous - start;
    return {
      fps: frames.length * 1000 / elapsed, frames: frames.length, elapsedMs: elapsed,
      p95FrameMs: sorted[Math.floor(sorted.length * .95)], focused: document.hasFocus(), visible: document.visibilityState,
      draws: before.map(({context, draws}) => ({background: !!context.canvas.closest('[data-coscroll-background]'), count: context.draws - draws})),
      commits: Object.entries(q?.renderers || {}).map(([id, renderer]) => ({...renderer, count: q.commits.filter(c => String(c.id) === id && c.at >= start && c.at < previous).length})),
      textUploads: (q?.uploads || 0) - uploads,
    };
  }, duration);
}

export async function measurePage(page, {url, screenshotPrefix}) {
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 45000});
  await page.waitForFunction(() => Boolean(window.__coscrollPerf), undefined, {timeout: 10000});
  await page.waitForFunction(() => Boolean(window.__coscrollPerf?.milestones.audioReadyMs && window.__coscrollPerf?.milestones.fontReadyMs && window.__coscrollPerf?.milestones.shaderFirstDrawMs && document.querySelectorAll('canvas').length === 2), undefined, {timeout: 90000});
  const startup = await page.evaluate(() => ({
    url: location.href, release: document.querySelector('meta[name="coscroll-release-id"]')?.content,
    milestones: window.__coscrollPerf.milestones, paint: performance.getEntriesByType('paint').map(e => ({name: e.name, at: e.startTime})),
    resources: performance.getEntriesByType('resource').filter(e => /\.woff2|projects\/heart-sutra\.json|\.obj(?:\?|$)/.test(e.name)).map(e => ({url: e.name, start: e.startTime, duration: e.duration, initiator: e.initiatorType, bytes: e.encodedBodySize})),
    viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
    canvases: [...document.querySelectorAll('canvas')].map(c => ({pixels: [c.width, c.height], css: [c.clientWidth, c.clientHeight]})),
  }));
  const intro = await samplePerformance(page, 3000);
  if (screenshotPrefix) await page.screenshot({path: screenshotPrefix + '-intro.png'});
  await touchTap(page, '[data-coscroll-intro]');
  await page.waitForFunction(() => !document.querySelector('audio').paused && document.querySelector('audio').currentTime > .5, undefined, {timeout: 15000});
  const reading = await samplePerformance(page);
  await touchTap(page, 'button[aria-label="Pause"]');
  await page.waitForFunction(() => document.querySelector('audio').paused, undefined, {timeout: 10000});
  if (screenshotPrefix) await page.screenshot({path: screenshotPrefix + '-reading.png'});
  const final = await page.evaluate(() => ({errors: window.__coscrollPerf.errors, warnings: window.__coscrollPerf.warnings,
    overflow: document.documentElement.scrollWidth > innerWidth, canvases: document.querySelectorAll('canvas').length,
    paused: document.querySelector('audio').paused, audioTime: document.querySelector('audio').currentTime}));
  return {startup, intro, reading, final};
}
