import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

async function load(name) {
  const source = await readFile(new URL(`../../src/utils/${name}.ts`, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020}}).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
}
const {loopPhase, loopCycle, timeInCurrentCycle, playbackCycle} = await load('loopTimeline');
const {RetainedResourceCache} = await load('retainedResourceCache');
const {default: timeline} = await load('../stores/timelineStore');
const {lyricIntersectsViewport} = await load('../components/layouts/lyricViewport');

test('switching recording clears the old clock, pending seek, visual phase, and inertia', () => {
  const oldClock = timeline.registerAudioClock(() => ({display: 20, absolute: 620}));
  timeline.requestAudioTime(25, -575);
  timeline.setVisualTime(28, -572);
  timeline.setScrollVelocity(3);
  timeline.setPlaying(true);
  timeline.reset();
  assert.deepEqual(timeline.sampleAudioTime(), {display: 0, absolute: 0});
  assert.equal(timeline.pendingAudioSeek, null);
  assert.equal(timeline.visualAbsoluteTime, 0);
  assert.equal(timeline.scrollVelocity, 0);
  assert.equal(timeline.isPlaying, false);
  const newClock = timeline.registerAudioClock(() => ({display: 1, absolute: 1}));
  oldClock();
  assert.deepEqual(timeline.sampleAudioTime(), {display: 1, absolute: 1});
  newClock(); timeline.reset();
});

test('signed cycles preserve relative keyboard seeks and scrubber phase in either direction', () => {
  for (const cycle of [-1000000, -2, -1, 0, 1, 2, 1000000]) {
    const absolute = cycle * 40 + 5;
    assert.equal(loopCycle(absolute, 40), cycle);
    assert.equal(loopPhase(absolute, 40), 5);
    assert.equal(timeInCurrentCycle(absolute, 25, 40), cycle * 40 + 25);
    assert.equal(timeInCurrentCycle(absolute, -1, 40), cycle * 40 - 1);
    assert.equal(timeInCurrentCycle(absolute, 41, 40), cycle * 40 + 41);
  }
  assert.equal(loopPhase(Number.NaN, 0), 0);
  assert.equal(Object.is(loopPhase(-80, 40), -0), false);
});

test('each native loop advances once after either a positive or negative manual seek', () => {
  for (const cycle of [-100, -1, 0, 100]) {
    const next = playbackCycle(39.99, .01, cycle, 40);
    assert.equal(next, cycle + 1);
    assert.equal(playbackCycle(.01, .02, next, 40), next);
    assert.equal(playbackCycle(7, 7.1, cycle, 40), cycle);
  }
});

test('resource cache pins shared active entries, evicts oldest idle data and releases once', async () => {
  const disposed = [];
  const cache = new RetainedResourceCache(value => disposed.push(value), 2, 20);
  const get = key => cache.get(key, () => ({value: key, bytes: 8}));
  const a = get('active'), releaseA = cache.retain(a), releaseA2 = cache.retain(a);
  for (let i = 0; i < 1000; i++) { get(i); cache.trim(); }
  assert.equal(cache.size, 3);
  assert.equal(get('active'), a);
  assert.equal(disposed.includes('active'), false);
  releaseA(); releaseA();
  await Promise.resolve();
  assert.equal(a.users, 1);
  releaseA2(); await Promise.resolve();
  assert.equal(cache.size, 2);
  cache.clear(); cache.clear();
  assert.equal(new Set(disposed).size, disposed.length);
  assert.equal(disposed.filter(value => value === 'active').length, 1);
});

test('idle byte limits apply even when the entry count is below its limit', () => {
  const disposed = [];
  const cache = new RetainedResourceCache(value => disposed.push(value), 8, 10);
  cache.get('large', () => ({value: 'large', bytes: 20})); cache.trim();
  assert.equal(cache.size, 0);
  assert.deepEqual(disposed, ['large']);
});

test('fractional seek commands remain pending until their exact target is acknowledged', () => {
  const target = 16.048146, duration = 374.256327;
  const reconstructed = ((target % duration) + duration) % duration;
  assert.notEqual(reconstructed, target);
  const unregister = timeline.registerAudioClock(() => ({display: 17, absolute: 17}));
  timeline.requestAudioTime(target, target);
  assert.equal(timeline.sampleAudioTime().absolute, target);
  timeline.acknowledgeAudioSeek(reconstructed, reconstructed);
  assert.equal(timeline.sampleAudioTime().absolute, target);
  timeline.acknowledgeAudioSeek(target, target);
  assert.equal(timeline.sampleAudioTime().absolute, 17);
  unregister();
});

test('an obsolete seek or clock cleanup cannot replace the latest timeline command', () => {
  const unregisterOld = timeline.registerAudioClock(() => ({display: 1, absolute: 1}));
  const unregisterNew = timeline.registerAudioClock(() => ({display: 2, absolute: 2}));
  unregisterOld();
  assert.equal(timeline.sampleAudioTime().absolute, 2);
  timeline.requestAudioTime(9, -31);
  timeline.requestAudioTime(7, -33);
  timeline.acknowledgeAudioSeek(9, -31);
  assert.deepEqual(timeline.sampleAudioTime(), {display: 7, absolute: -33});
  timeline.acknowledgeAudioSeek(7, -33);
  unregisterNew();
});

test('flat lyric bounds keep partial pixels and cull only quads entirely outside the viewport', () => {
  const clip = {left: -2, right: 2, top: 4, bottom: -4, margin: .01};
  assert.equal(lyricIntersectsViewport(5, 0, .6, 20, clip), false);
  assert.equal(lyricIntersectsViewport(2.3, 0, .6, 20, clip), true);
  assert.equal(lyricIntersectsViewport(-2.3, 0, .6, 20, clip), true);
  assert.equal(lyricIntersectsViewport(0, 5.31, .6, 2.6, clip), true);
  assert.equal(lyricIntersectsViewport(0, 5.32, .6, 2.6, clip), false);
  assert.equal(lyricIntersectsViewport(100, 100, 1, 1), true);
});
