import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
import ts from 'typescript';

await mkdir(resolve('.cache'), {recursive: true});
const directory = await mkdtemp(join(resolve('.cache'), 'lyric-motion-test-'));
let calculateLayeredLyrics, lyricWindowKey, advanceLyricMotion, reducedLyricTime;
try {
  for (const name of ['speedProfile', 'lyricMotion', 'layeredLyrics', 'loopTimeline']) {
    const source = await readFile(new URL(name === 'loopTimeline' ? '../../src/utils/loopTimeline.ts' : `../../src/components/layouts/${name}.ts`, import.meta.url), 'utf8');
    const output = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020}}).outputText
      .replace(/from ['"]\.\/speedProfile['"]/g, "from './speedProfile.mjs'")
      .replace(/from ['"]@\/utils\/loopTimeline['"]/g, "from './loopTimeline.mjs'");
    await writeFile(join(directory, `${name}.mjs`), output);
  }
  ({calculateLayeredLyrics, lyricWindowKey} = await import(pathToFileURL(join(directory, 'layeredLyrics.mjs')).href));
  ({advanceLyricMotion, reducedLyricTime} = await import(pathToFileURL(join(directory, 'lyricMotion.mjs')).href));
} finally {
  await rm(directory, {recursive: true, force: true});
}

const lyrics = [{time: 0, text: '观自在菩萨'}, {time: 10, text: '照见五蕴皆空'},
  {time: 20, text: '度一切苦厄'}, {time: 30, text: '色不异空'}];
const options = {range: 6, movementAxis: 'horizontal', travelSpacing: .85,
  frontDepth: 6, backNearDepth: -2.2, backFarDepth: -3.5, topLaneY: 2.1, bottomLaneY: -2.05};
const layoutAt = scrollTime => calculateLayeredLyrics({lyrics, scrollTime, duration: 40, options});

test('reduced motion follows whole recording lines through blank intervals and either loop direction', () => {
  for (const [time, expected] of [[0, 0], [9.9, 0], [10, 10], [19.99, 10], [40.1, 40], [-.1, -10]]) {
    assert.equal(reducedLyricTime(time, 40, lyrics), expected);
  }
  assert.equal(reducedLyricTime(0, 40, [{time: 3, text: '首句'}, {time: 30, text: '末句'}]), -10);
  assert.equal(reducedLyricTime(12.34, 40, []), 12.34);
  const blank = [{time: 0, text: '句'}, {time: 10, text: ' '}, {time: 20, text: '新句'}];
  assert.equal(reducedLyricTime(15, 40, blank), 10);
});

test('reduced mode removes autonomous smoothing without delaying direct manipulation', () => {
  const input = {scrollTime: 12.5, duration: 40, velocity: 4, isPlaying: true, isPreviewMode: false, reducedMotion: true};
  let previous = advanceLyricMotion(null, input, 1000);
  previous = advanceLyricMotion(previous, {...input, scrollTime: 12.7}, 2000);
  assert.equal(previous.profile.time, 12.7);
  const direct = advanceLyricMotion(previous, {...input, scrollTime: 23.45, isPreviewMode: true}, 2010);
  assert.equal(direct.profile.time, 23.45);
});

test('the immediate gesture ref preserves the existing motion equations without waiting for React state', () => {
  const input={scrollTime:12,duration:40,velocity:0,isPlaying:true,isPreviewMode:false};
  const previous=advanceLyricMotion(null,input,1000);
  const referenced=advanceLyricMotion(previous,{...input,velocityRef:{current:2}},1033);
  const published=advanceLyricMotion(previous,{...input,velocity:2},1033);
  assert.deepEqual(referenced,published);
});

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

test('a full ring reuses keys and keeps positions precise through large positive and negative cycles', () => {
  const baseline = layoutAt(5);
  for (const cycle of [-1000000000, -10000, -4, 4, 10000, 1000000000]) {
    const layout = layoutAt(cycle * 40 + 5);
    assert.equal(lyricWindowKey(layout), lyricWindowKey(baseline));
    assert.deepEqual([...layout.front, ...layout.back].map(item => [item.text, item.x, item.y, item.z, item.opacity]),
      [...baseline.front, ...baseline.back].map(item => [item.text, item.x, item.y, item.z, item.opacity]));
  }
});

test('loop seams retain shared columns and continuous positions in both directions', () => {
  for (const boundary of [-80, -40, 0, 40, 80]) {
    const before = [...layoutAt(boundary - .000001).front, ...layoutAt(boundary - .000001).back];
    const after = [...layoutAt(boundary + .000001).front, ...layoutAt(boundary + .000001).back];
    const shared = before.map(a => [a, after.find(b => b.key === a.key)]).filter(([, b]) => b);
    assert.equal(shared.length, 12);
    for (const [a, b] of shared) {
      assert.equal(a.text, b.text);
      assert.ok(Math.abs(a.x - b.x) < .000001);
      assert.equal(a.y, b.y);
      assert.equal(a.z, b.z);
    }
  }
});

test('nonzero first timestamps traverse the preceding last line without a reset', () => {
  const lines = [{time: 5, text: 'first'}, {time: 15, text: 'last'}];
  const at = time => calculateLayeredLyrics({lyrics: lines, scrollTime: time, duration: 20, options});
  assert.equal(at(0).current.text, 'last');
  assert.equal(at(0).current.x, -.425);
  assert.equal(at(5).current.text, 'first');
  assert.equal(at(-20).current.text, 'last');
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

test('pause freezes lyrics at the actual media time instead of integrating stale velocity', () => {
  const state = advanceLyricMotion(null, inputAt(7), 1000);
  state.profile.baseVelocity = 1;
  state.profile.manualOffset = 4;
  const paused = advanceLyricMotion(state, inputAt(7, {isPlaying: false, velocity: 650}), 1033);
  assert.equal(paused.profile.time, 7);
  assert.equal(paused.profile.baseVelocity, 0);
  assert.equal(paused.profile.manualOffset, 0);
  assert.equal(advanceLyricMotion(paused, inputAt(7, {isPlaying: false}), 3000).profile.time, 7);
});

test('the motion clock resets cleanly at a loop jump and tolerates invalid input', () => {
  const state = advanceLyricMotion(null, inputAt(373), 1000);
  assert.equal(advanceLyricMotion(state, inputAt(0), 1016).profile.time, 0);
  const invalid = advanceLyricMotion(null, inputAt(Number.NaN, {duration: 0}), 0);
  assert.ok(Number.isFinite(invalid.profile.time));
});
