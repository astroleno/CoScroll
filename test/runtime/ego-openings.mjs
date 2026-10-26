// Import from an Ego browser round. All instrumentation is confined to that managed page.
function openingProbe({mode, delayProject}) {
  const q = window.__openingProbe = {active: new Set(), revoked: [], clicks: [], playCalls: [], errors: [], pending: [], aborts: 0, failuresServed: 0};
  addEventListener('error', e => {if (e.message) q.errors.push(e.message);});
  addEventListener('unhandledrejection', e => q.errors.push(String(e.reason)));
  const reportError = console.error;
  console.error = function(...args) {q.errors.push(args.map(String).join(' ')); return reportError.apply(this, args);};
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => {const url = create(blob); q.active.add(url); return url;};
  URL.revokeObjectURL = url => {q.active.delete(url); q.revoked.push(url); return revoke(url);};
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function(...args) {
    q.playCalls.push({gestureActive: navigator.userActivation.isActive, at: performance.now()});
    return play.apply(this, args);
  };
  addEventListener('click', e => {if (e.target.closest?.('[data-coscroll-intro]')) q.clicks.push(e.isTrusted);}, true);
  const fetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(input);
    if (!url.includes('/opening/') || !url.endsWith('.png')) return fetch(input, init);
    if (mode === 'missing') {q.failuresServed++; return new Response('', {status: 404});}
    if (mode === 'corrupt') {
      const response = await fetch(input, init), bytes = new Uint8Array(await response.arrayBuffer());
      bytes[bytes.length - 1] ^= 1;
      q.failuresServed++;
      return new Response(bytes, {headers: {'Content-Type': 'image/png'}});
    }
    if (mode === 'delayed' && (!delayProject || url.includes(`/opening/${delayProject}/`))) {
      return new Promise((resolve, reject) => {
        q.pending.push({release: () => fetch(input, init).then(resolve, reject)});
        const abort = () => {q.aborts++; reject(new DOMException('Opening canceled', 'AbortError'));};
        init?.signal?.addEventListener('abort', abort, {once: true});
        if (init?.signal?.aborted) abort();
      });
    }
    return fetch(input, init);
  };
}

async function openScenario(page, {baseUrl, projectId, mode, viewport, delayProject}) {
  await page.cdp('Network.enable', {});
  await page.cdp('Emulation.setDeviceMetricsOverride', {...viewport,
    screenWidth: viewport.width, screenHeight: viewport.height, deviceScaleFactor: 1});
  await page.cdp('Emulation.setTouchEmulationEnabled', {enabled: !!viewport.mobile, maxTouchPoints: 5});
  await page.cdp('Network.setUserAgentOverride', {userAgent: viewport.mobile
    ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36'
    : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36'});
  const injected = await page.cdp('Page.addScriptToEvaluateOnNewDocument', {source: `(${openingProbe.toString()})(${JSON.stringify({mode, delayProject})})`});
  try {
    await page.goto(`${baseUrl}?project=${projectId}`, {waitUntil: 'domcontentloaded', timeout: 45000});
    await page.waitForSelector('[data-coscroll-intro]', {state: 'visible', timeout: 60000});
    await page.waitForFunction(() => document.querySelectorAll('canvas').length === 2, undefined, {timeout: 30000});
    if (mode === 'normal') await page.waitForSelector('[data-coscroll-opening="handwriting"]', {state: 'visible', timeout: 20000});
    else if (mode === 'delayed') await page.waitForFunction(() => window.__openingProbe.pending.length > 0, undefined, {timeout: 10000});
    else await page.waitForFunction(() => window.__openingProbe.failuresServed > 0 && document.querySelector('[data-coscroll-opening="text"]') &&
      !document.querySelector('[data-coscroll-opening] img'), undefined, {timeout: 10000});
  } finally {await page.cdp('Page.removeScriptToEvaluateOnNewDocument', {identifier: injected.identifier});}
}

async function readState(page) {
  return page.evaluate(() => {
    const q = window.__openingProbe, image = document.querySelector('[data-coscroll-opening] img');
    const root = document.querySelector('[data-active-project]'), preface = document.querySelector('[data-coscroll-opening]');
    const bounds = preface?.getBoundingClientRect();
    return {url: location.href, title: document.title, projectId: root?.getAttribute('data-active-project'),
      mode: preface?.getAttribute('data-coscroll-opening'), text: document.querySelector('.opening-fallback')?.textContent,
      revision: preface?.getAttribute('data-opening-revision'), imageDecoded: !!image && image.complete && image.naturalWidth === 1440 && image.naturalHeight === 720,
      bounds: bounds && {left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom},
      viewport: {width: innerWidth, height: innerHeight}, overflow: document.documentElement.scrollWidth > innerWidth,
      canvases: document.querySelectorAll('canvas').length, activeUrls: q.active.size, aborted: q.aborts,
      clicks: q.clicks, playCalls: q.playCalls, errors: q.errors,
      inferenceRequests: performance.getEntriesByType('resource').filter(r => /https?:\/\/(?:api\.)?inkotype\.com/.test(r.name)).length};
  });
}

async function startAndCheck(page, activation) {
  if (activation === 'tap') {
    await page.cdp('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 80, y: 120, id: 1}]});
    await page.cdp('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  } else {
    await page.focus('[data-coscroll-intro]');
    await page.press('[data-coscroll-intro]', activation);
  }
  await page.waitForFunction(() => !document.querySelector('[data-coscroll-intro]') &&
    !document.querySelector('audio')?.paused && document.querySelector('audio')?.currentTime > .3 &&
    window.__openingProbe.active.size === 0, undefined, {timeout: 20000});
  await page.click('button[aria-label="Pause"]');
  await page.waitForFunction(() => document.querySelector('audio')?.paused, undefined, {timeout: 10000});
  const after = await readState(page);
  if (after.activeUrls || after.errors.length || !after.clicks.length || after.clicks.some(trusted => !trusted)
    || !after.playCalls.some(call => call.gestureActive) || after.canvases !== 2 || after.inferenceRequests) {
    throw new Error('Opening activation failed: ' + JSON.stringify(after));
  }
  return after;
}

export async function verifyTrackOpening(page, options) {
  await openScenario(page, options);
  if (options.awaitImageTimeout) {
    await page.waitForFunction(() => window.__openingProbe.aborts > 0 && !window.__openingProbe.playCalls.length &&
      document.querySelector('[data-coscroll-intro]'), undefined, {timeout: 12000});
  }
  const before = await readState(page);
  if (before.projectId !== options.projectId || before.text !== options.text || before.overflow || before.playCalls.length
    || before.canvases !== 2 || before.errors.length || before.inferenceRequests || !before.bounds
    || before.bounds.left < 0 || before.bounds.right > before.viewport.width || before.bounds.top < 0
    || before.bounds.bottom > before.viewport.height || (options.mode === 'normal' && !before.imageDecoded)) {
    throw new Error('Incorrect opening: ' + JSON.stringify(before));
  }
  if (options.screenshot) await page.screenshot({path: options.screenshot});
  const after = await startAndCheck(page, options.activation);
  if (options.mode === 'delayed' && after.aborted < 1) throw new Error('Start did not cancel the pending opening');
  return {before, after};
}

export async function verifyPendingOpeningSwitch(page, options) {
  await openScenario(page, {...options, projectId: 'heart-sutra', mode: 'delayed', delayProject: 'heart-sutra'});
  await page.evaluate(() => {
    const url = new URL(location.href); url.searchParams.set('project', 'lotus-sutra-zanshi');
    history.pushState(null, '', url); dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForFunction(() => document.querySelector('[data-active-project="lotus-sutra-zanshi"]') &&
    document.querySelector('[data-coscroll-opening="handwriting"]'), undefined, {timeout: 30000});
  const before = await readState(page);
  if (before.text !== options.text || !before.imageDecoded || before.aborted < 1 || before.activeUrls !== 1) {
    throw new Error('Stale opening survived a track switch: ' + JSON.stringify(before));
  }
  await page.evaluate(() => window.__openingProbe.pending.forEach(pending => pending.release()));
  return {before, after: await startAndCheck(page, 'Enter')};
}

export async function verifyEnteredOpeningSwitches(page, selectClassic) {
  await page.evaluate(() => {window.__openingSwitchNodes = {audio: document.querySelector('audio'), canvases: [...document.querySelectorAll('canvas')]};});
  const state = () => page.evaluate(() => {
    const audio = document.querySelector('audio'), nodes = window.__openingSwitchNodes;
    return {projectId: document.querySelector('[data-active-project]').getAttribute('data-active-project'),
      paused: audio.paused, time: audio.currentTime, introVisible: !!document.querySelector('[data-coscroll-intro]'),
      sameAudio: audio === nodes.audio,
      sameCanvases: document.querySelectorAll('canvas').length === 2 && [...document.querySelectorAll('canvas')].every((canvas, i) => canvas === nodes.canvases[i]),
      activeUrls: window.__openingProbe.active.size, errors: window.__openingProbe.errors};
  });
  try {
    await selectClassic(page, 'heart-sutra');
    const paused = await state();
    await page.click('button[aria-label="Play"]');
    await page.waitForFunction(() => !document.querySelector('audio').paused && document.querySelector('audio').currentTime > .3, undefined, {timeout: 20000});
    await selectClassic(page, 'lotus-sutra-zanshi');
    await page.waitForFunction(() => !document.querySelector('audio').paused && document.querySelector('audio').currentTime > .3, undefined, {timeout: 20000});
    const playing = await state();
    if (!paused.paused || playing.paused || paused.projectId !== 'heart-sutra' || playing.projectId !== 'lotus-sutra-zanshi' ||
      [paused, playing].some(s => s.introVisible || !s.sameAudio || !s.sameCanvases || s.activeUrls || s.errors.length)) {
      throw new Error('Entered track switch reopened the preface or replaced the session nodes: ' + JSON.stringify({paused, playing}));
    }
    await page.click('button[aria-label="Pause"]');
    return {paused, playing};
  } finally {await page.evaluate(() => {delete window.__openingSwitchNodes;});}
}
