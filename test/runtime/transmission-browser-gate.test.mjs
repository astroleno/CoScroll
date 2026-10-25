import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assertRegionComparison} from './transmission-region-browser.mjs';

const valid = () => ({frames: Array.from({length: 11}, () => ({changedPixels: 0,
  maxChannelDifference: 0, meanChannelDifference: 0})), glError: 0, partial: 11,
  full: 1, meanArea: .2, canvases: 2, originalScissor: false, scissorAfter: false});

test('browser gate accepts exact pixels and the required initial full update', () => {
  assert.doesNotThrow(() => assertRegionComparison(valid()));
});

test('browser gate rejects a single changed channel, GL errors and a skipped region path', () => {
  for (const mutate of [r => {r.frames[0].changedPixels = 1;},
    r => {r.frames[0].maxChannelDifference = 1;}, r => {r.frames[0].meanChannelDifference = .001;},
    r => {r.glError = 1282;}, r => {r.partial = 0;}, r => {r.frames = [];},
    r => {r.meanArea = NaN;}, r => {r.canvases = 3;}, r => {r.scissorAfter = true;}]) {
    const result = valid(); mutate(result);
    assert.throws(() => assertRegionComparison(result));
  }
});
