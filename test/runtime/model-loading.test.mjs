import assert from 'node:assert/strict';
import { test } from 'node:test';
import {readFile} from 'node:fs/promises';
import { loadModelPipeline } from '../../deploy/prepare-models.mjs';
import { loadPreloaderModule } from './model-modules.mjs';

// Keep the compiled module under the repository so its real Three imports resolve.
const pipeline = await loadModelPipeline();
let ModelPreloader, assetUrl;
try {
  ({ ModelPreloader, assetUrl } = await loadPreloaderModule(pipeline.directory));
} finally {
  await pipeline.dispose();
}

test('visible and lookahead requests share a single download and cached geometry', async () => {
  const loader = new ModelPreloader();
  let resolveDownload, downloads = 0;
  loader.loadModelFromFile = () => {
    downloads++;
    return new Promise(resolve => { resolveDownload = resolve; });
  };
  const timeline = [{ time: 0, anchor: '观' }, { time: 10, anchor: '空' }];
  const mapping = { 观: '/guan.obj', 空: '/kong.obj' };
  const lookahead = loader.preloadNextModel(0, timeline, mapping);
  const visible = loader.loadModel('/kong.obj');
  assert.equal(downloads, 1);
  const geometry = { name: 'shared geometry' };
  resolveDownload(geometry);
  await lookahead;
  assert.equal(await visible, geometry);
  assert.equal(await loader.loadModel('/kong.obj'), geometry);
  assert.equal(downloads, 1);
});

async function withPreparedDownloads(run) {
  const registry = JSON.parse(await readFile('src/components/jade/prepared-models.json'));
  const entries = registry.models.filter(e => e.format === 'binary-v2').slice(0, 3);
  const data = new Map(await Promise.all(entries.map(async e => [assetUrl(e.preparedPath), await readFile('public' + e.preparedPath)])));
  const saved = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.ok(data.has(url), 'successful prepared loads must not download source fallbacks');
    return new Response(data.get(url));
  };
  try {await run(entries.map(e => assetUrl(e.sourcePath)));}
  finally {globalThis.fetch = saved;}
}
async function until(check) {
  const deadline = performance.now() + 5000;
  while (!check()) {
    if (performance.now() > deadline) throw Error('Model scheduling condition did not settle');
    await new Promise(resolve => setImmediate(resolve));
  }
}

test('real prepared decoding is serialized across yields and promotes current ahead of lookahead', async () => {
  await withPreparedDownloads(async ([a, b, c]) => {
    const loader = new ModelPreloader(), scheduled = [], started = [];
    let release, active = 0, peak = 0;
    const gate = new Promise(resolve => {release = resolve;});
    const original = loader.decoder.run.bind(loader.decoder);
    loader.decoder.run = (key, work, priority, signal) => {
      scheduled.push(key);
      return original(key, async () => {
        started.push(key); active++; peak = Math.max(peak, active);
        try {if (key === a) await gate; return await work();}
        finally {active--;}
      }, priority, signal);
    };
    const first = loader.loadModel(a);
    await until(() => started.length === 1);
    const next = loader.preloadNextModel(0, [{time: 0, anchor: 'a'}, {time: 1, anchor: 'b'}], {a, b});
    const current = loader.loadModel(c);
    try {
      await until(() => scheduled.length === 3); release();
      await Promise.all([first, next, current]);
      assert.equal(peak, 1); assert.deepEqual(started, [a, c, b]);
    } finally {release(); await Promise.allSettled([first, next, current]); loader.cancelPreloadNext(); loader.clearCache();}
  });
});

test('losing the final owner after restore disposes the unpublished pair without an orphan outer', async () => {
  await withPreparedDownloads(async ([path]) => {
    const loader = new ModelPreloader(), releases = [];
    const release = loader.retainPaths([path]), original = loader.decoder.run.bind(loader.decoder);
    loader.decoder.run = (key, work, priority, signal) => original(key, async () => {
      const pair = await work();
      for (const geometry of [pair.base, pair.outer]) {
        const count = {disposed: 0}; geometry.addEventListener('dispose', () => count.disposed++); releases.push(count);
      }
      release(); loader.trimCache();
      return pair;
    }, priority, signal);
    await assert.rejects(loader.loadModel(path), {name: 'AbortError'});
    assert.deepEqual(releases.map(r => r.disposed), [1, 1]);
    assert.equal(loader.getCacheStatus().loaded, 0); assert.equal(loader.offsetGeometryCache.size, 0);
    assert.deepEqual(loader.getDetailedStatus(), {}); loader.clearCache();
  });
});

test('a failed request is evicted so the next visible request can retry', async () => {
  const loader = new ModelPreloader();
  const geometry = { name: 'recovered geometry' };
  let attempts = 0;
  loader.loadModelFromFile = async () => {
    if (++attempts === 1) throw new Error('temporary network failure');
    return geometry;
  };
  await assert.rejects(loader.loadModel('/kong.obj'), /temporary network failure/);
  assert.equal(await loader.loadModel('/kong.obj'), geometry);
  assert.equal(attempts, 2);
});

test('lookahead skips repeated mappings and wraps at the end of the audio loop', () => {
  const loader = new ModelPreloader();
  const timeline = [{ time: 2, anchor: '观' }, { time: 5, anchor: '照' },
    { time: 10, anchor: '空' }, { time: 15, anchor: '无' }];
  const mapping = { 观: '/guan.obj', 照: '/guan.obj', 空: '/kong.obj', 无: '/wu.obj' };
  assert.equal(loader.predictNextModel(0, timeline, mapping), '/kong.obj');
  assert.equal(loader.predictNextModel(5, timeline, mapping), '/kong.obj');
  assert.equal(loader.predictNextModel(10, timeline, mapping), '/wu.obj');
  assert.equal(loader.predictNextModel(16, timeline, mapping), '/guan.obj');
  assert.equal(loader.predictNextModel(0, [], mapping), null);
  assert.equal(loader.predictNextModel(20, timeline, { 观: '/same.obj', 照: '/same.obj', 空: '/same.obj', 无: '/same.obj' }), null);
});

test('geometry cache keeps active owners, bounds idle history, and disposes both layers once', async () => {
  const loader = new ModelPreloader(), disposals = new Map();
  loader.loadModelFromFile = async path => ({dispose() {disposals.set(path, (disposals.get(path) || 0) + 1);}});
  const release = loader.retainPaths(['/active.obj']);
  await loader.loadModel('/active.obj');
  let offsetDisposals = 0;
  for (let i = 0; i < 24; i++) {
    const path = '/idle-' + i + '.obj';
    const base = await loader.loadModel(path);
    if (i === 0) loader.offsetGeometryCache.set(path, new Map([
      ['outer', {dispose() {offsetDisposals++;}}], ['fallback', base],
    ]));
  }
  loader.trimCache();
  assert.equal(loader.isModelLoaded('/active.obj'), true);
  assert.ok(loader.getCacheStatus().loaded <= 9);
  assert.equal(disposals.get('/active.obj'), undefined);
  assert.equal(offsetDisposals, 1);
  release();
  await loader.loadModel('/fresh.obj');
  loader.trimCache();
  assert.ok(loader.getCacheStatus().loaded <= 8);
  assert.equal(disposals.get('/active.obj'), 1);
  assert.ok(Array.from(disposals.values()).every(count => count === 1));
});
