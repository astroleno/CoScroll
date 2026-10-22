/** Browser-only diagnostics; never imported by the product. */
export function frameDiagnosisScript() {return `(${installFrameDiagnosis.toString()})()`;}
function installFrameDiagnosis() {
  const q = window.__frameDiagnosis = {slow: [], long: [], tasks: [], heartbeats: [], totals: {}};
  const record = (kind, name, start, duration) => {
    const key = kind + '.' + name, total = q.totals[key] ||= {calls: 0, ms: 0, max: 0};
    total.calls++; total.ms += duration; total.max = Math.max(total.max, duration);
    if (duration >= 25 && q.slow.length < 1024) q.slow.push({kind, name, start, duration});
  };
  for (const name of ['WebGLRenderingContext', 'WebGL2RenderingContext', 'CanvasRenderingContext2D']) {
    const prototype = window[name]?.prototype;
    if (!prototype) continue;
    const methods = name === 'CanvasRenderingContext2D' ? ['fillText', 'measureText', 'getImageData'] :
      ['drawArrays', 'drawElements', 'texImage2D', 'texSubImage2D', 'bufferData', 'generateMipmap', 'compileShader', 'linkProgram', 'getProgramParameter', 'finish', 'flush'];
    for (const method of methods) {
      const original = prototype[method];
      if (!original) continue;
      prototype[method] = function(...args) {
        const start = performance.now();
        try {return original.apply(this, args);} finally {record(name, method, start, performance.now() - start);}
      };
    }
  }
  const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
  if (descriptor?.get) Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {...descriptor,
    get() {const start = performance.now();try {return descriptor.get.call(this);} finally {record('media', 'currentTime', start, performance.now() - start);}},
  });
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
    return raf.call(this, time => {
      const start = performance.now();
      try {return callback(time);} finally {record('raf', callback.name || 'anonymous', start, performance.now() - start);}
    });
  };
  let previous = performance.now();
  setInterval(() => {const now = performance.now(), gap = now - previous;previous = now;
    if (gap > 30 && q.heartbeats.length < 2048) q.heartbeats.push({at: now, gap});}, 10);
  for (const [type, key] of [['longtask', 'tasks'], ['long-animation-frame', 'long']]) {
    if (PerformanceObserver.supportedEntryTypes.includes(type)) new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (q[key].length < 2048) {
        const data = entry.toJSON();
        if (type === 'long-animation-frame') data.scripts = entry.scripts.map(script => ({
          duration: script.duration, executionStart: script.executionStart,
          forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration,
          pauseDuration: script.pauseDuration, invoker: script.invoker,
          invokerType: script.invokerType, sourceURL: script.sourceURL,
          sourceFunctionName: script.sourceFunctionName,
        }));
        q[key].push(data);
      }
    }).observe({type});
  }
}

export async function frameMetrics(page) {
  const result = await page.cdp('Performance.getMetrics', {});
  return Object.fromEntries(result.metrics.map(item => [item.name, item.value]));
}

/** Separate diagnostic: poll nonblocking fences to distinguish GPU queue waits
 * from missing animation callbacks while timers and GPU completion continue. */
export async function startGpuFences(page) {
  await page.evaluate(() => {
    const q = window.__gpuFenceDiagnosis = {results: [], errors: [], lastPoll: performance.now(), pollGaps: [], probes: []};
    for (const store of window.__renderProbe.stores) {
      const renderer = store.getState().gl, gl = renderer.getContext();
      if (!gl.fenceSync) continue;
      const p = {renderer, gl, original: renderer.render, pending: [], background: !!renderer.domElement.closest('[data-coscroll-background]')};
      renderer.render = function(...args) {
        try {return p.original.apply(this, args);} finally {
          if (p.pending.length < 8) {
            const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            if (sync) {p.pending.push({sync, start: performance.now()});gl.flush();}
          }
        }
      };
      q.probes.push(p);
    }
    q.timer = setInterval(() => {
      const now = performance.now(), gap = now - q.lastPoll;q.lastPoll = now;
      if (gap > 30) q.pollGaps.push({at: now, gap});
      for (const p of q.probes) {
        const keep = [];
        for (const entry of p.pending) {
          const result = p.gl.clientWaitSync(entry.sync, 0, 0);
          if (result === p.gl.TIMEOUT_EXPIRED) {keep.push(entry);continue;}
          if (result === p.gl.WAIT_FAILED) q.errors.push('GPU fence wait failed');
          q.results.push({background: p.background, start: entry.start, end: now, latency: now - entry.start});
          p.gl.deleteSync(entry.sync);
        }
        p.pending = keep;
      }
    }, 10);
  });
}

export async function stopGpuFences(page) {
  return page.evaluate(() => {
    const q = window.__gpuFenceDiagnosis;clearInterval(q.timer);
    for (const p of q.probes) {p.renderer.render = p.original;for (const entry of p.pending) p.gl.deleteSync(entry.sync);}
    return {results: q.results, errors: q.errors, pollGaps: q.pollGaps};
  });
}
