import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
import ts from 'typescript';

await mkdir(resolve('.cache'), {recursive: true});
const directory = await mkdtemp(join(resolve('.cache'), 'lyric-motion-test-'));
let calculateLayeredLyrics, lyricWindowKey, advanceLyricMotion;
try {
  for (const name of ['speedProfile', 'lyricMotion', 'layeredLyrics']) {
    const source = await readFile(new URL(`../../src/components/layouts/${name}.ts`, import.meta.url), 'utf8');
    const output = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020}}).outputText
      .replace(/from ['"]\.\/speedProfile['"]/g, "from './speedProfile.mjs'");
    await writeFile(join(directory, `${name}.mjs`), output);
  }
  ({calculateLayeredLyrics, lyricWindowKey} = await import(pathToFileURL(join(directory, 'layeredLyrics.mjs')).href));
  ({advanceLyricMotion} = await import(pathToFileURL(join(directory, 'lyricMotion.mjs')).href));
} finally {
  await rm(directory, {recursive: true, force: true});
}

const lyrics = [{time: 0, text: '观自在菩萨'}, {time: 10, text: '照见五蕴皆空'},
  {time: 20, text: '度一切苦厄'}, {time: 30, text: '色不异空'}];
const options = {range: 6, movementAxis: 'horizontal', travelSpacing: .85,
  frontDepth: 6, backNearDepth: -2.2, backFarDepth: -3.5, topLaneY: 2.1, bottomLaneY: -2.05};
const layoutAt = scrollTime => calculateLayeredLyrics({lyrics, scrollTime, duration: 40, options});

test('continuous motion reuses a lyric window and changes it at a line boundary', () => {
  const start = layoutAt(1), end = layoutAt(9);
  assert.equal(lyricWindowKey(start), lyricWindowKey(end));
  assert.notEqual(start.current.x, end.current.x);
  assert.notEqual(lyricWindowKey(end), lyricWindowKey(layoutAt(10)));
});

test('horizontal layout retains lane alignment, depth, travel and current-line emphasis', () => {
  const layout = layoutAt(5), items = [...layout.front, ...layout.back];
  assert.equal(layout.current.text, '观自在菩萨');
  assert.equal(layout.current.verticalAlign, 'top');
  assert.equal(layout.current.y, 2.1);
  assert.equal(layout.current.z, -3.5);
  assert.equal(layout.current.x, -.425);
  const next = items.find(item => item.absoluteIndex === 1);
  assert.equal(next.verticalAlign, 'bottom');
  assert.equal(next.y, -2.05);
  assert.equal(next.z, 5.55);
  assert.equal(items.filter(item => item.isCurrent).length, 1);
});

test('backward preview and loop boundaries keep unique absolute keys', () => {
  for (const time of [-80, -40.1, -.1, 0, 39.99, 40, 80.1]) {
    const layout = layoutAt(time), items = [...layout.front, ...layout.back];
    assert.equal(items.length, 13);
    assert.equal(new Set(items.map(item => item.key)).size, 13);
    assert.equal(items.filter(item => item.isCurrent).length, 1);
    assert.ok(items.every(item => Number.isFinite(item.x) && item.opacity >= 0 && item.opacity <= 1));
  }
  assert.equal(layoutAt(-.1).current.text, '色不异空');
  assert.equal(layoutAt(40).current.text, '观自在菩萨');
  assert.notEqual(lyricWindowKey(layoutAt(0)), lyricWindowKey(layoutAt(40)));
});

test('edge fading and feathering vary without changing glyph-window membership', () => {
  const before = layoutAt(1), after = layoutAt(9);
  const a = [...before.front, ...before.back].find(item => item.absoluteIndex === -4);
  const b = [...after.front, ...after.back].find(item => item.absoluteIndex === -4);
  assert.equal(lyricWindowKey(before), lyricWindowKey(after));
  assert.ok(b.opacity < a.opacity);
  assert.ok(b.edgeFeather > a.edgeFeather);
});

test('empty and blank lyric lines remain safe for an imperative scene', () => {
  assert.deepEqual(calculateLayeredLyrics({lyrics: [], scrollTime: 0, duration: 0}), {front: [], back: [], current: null});
  const layout = calculateLayeredLyrics({lyrics: [{time: 0, text: ' '}], scrollTime: -.1, duration: 0, options});
  assert.ok([...layout.front, ...layout.back].every(item => item.opacity === 0));
});

const inputAt = (time, updates = {}) => ({scrollTime: time, duration: 374, velocity: 0, isPreviewMode: false, seekRevision: 0, ...updates});

test('the scene reads a changing time ref without waiting for React props', () => {
  const clock = {current: 12.5}, input = inputAt(0, {scrollTimeRef: clock});
  const first = advanceLyricMotion(null, input, 1000);
  assert.equal(first.profile.time, 12.5);
  clock.current = 12.6;
  const next = advanceLyricMotion(first, input, 1016);
  assert.equal(next.profile.baseTime, 12.6);
  assert.ok(next.profile.time > first.profile.time);
});

test('touch preview follows exact negative absolute time without inertia', () => {
  let state = advanceLyricMotion(null, inputAt(10), 1000);
  state.profile.manualOffset = 3;
  state = advanceLyricMotion(state, inputAt(-15, {velocity: 8, isPreviewMode: true}), 1016);
  assert.equal(state.profile.time, -15);
  assert.equal(state.profile.manualOffset, 0);
  assert.equal(state.manualHoldUntil, 1536);
});

test('a seek revision immediately clears old smoothing even for a small backward seek', () => {
  const state = advanceLyricMotion(null, inputAt(20), 1000);
  state.profile.manualOffset = 4;
  state.profile.baseVelocity = 1;
  const sought = advanceLyricMotion(state, inputAt(5, {seekRevision: 1}), 1016);
  assert.equal(sought.profile.time, 5);
  assert.equal(sought.profile.manualOffset, 0);
  assert.equal(sought.profile.baseVelocity, 0);
});

test('the motion clock resets cleanly at a loop jump and tolerates invalid input', () => {
  const state = advanceLyricMotion(null, inputAt(373), 1000);
  assert.equal(advanceLyricMotion(state, inputAt(0), 1016).profile.time, 0);
  const invalid = advanceLyricMotion(null, inputAt(Number.NaN, {duration: 0}), 0);
  assert.ok(Number.isFinite(invalid.profile.time));
});
