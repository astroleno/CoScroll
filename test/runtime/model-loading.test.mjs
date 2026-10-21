import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModelPipeline } from '../../deploy/prepare-models.mjs';
import { loadPreloaderModule } from './model-modules.mjs';

// Keep the compiled module under the repository so its real Three imports resolve.
const pipeline = await loadModelPipeline();
let ModelPreloader;
try {
  ({ ModelPreloader } = await loadPreloaderModule(pipeline.directory));
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
