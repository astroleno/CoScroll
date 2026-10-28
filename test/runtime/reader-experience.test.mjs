import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const require = createRequire(import.meta.url);
async function load(path) {
  const compiled = ts.transpileModule(await readFile(new URL('../../src/' + path, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX},
  }).outputText;
  const module = {exports: {}};
  vm.runInNewContext('(function(require,module,exports){' + compiled + '\n})', {})(require, module, module.exports);
  return module.exports;
}
const {readerBounds, fitReaderFrame} = await load('components/layouts/readerFraming.ts');
const {default: Transcript} = await load('components/ReadingTranscript.tsx');
const recordings = await Promise.all(['heart-sutra', 'lotus-sutra-zanshi'].map(async id => {
  const config = JSON.parse(await readFile(new URL(`../../public/projects/${id}.json`, import.meta.url), 'utf8'));
  const lrc = await readFile(new URL('../../public' + config.assets.lyrics.src, import.meta.url), 'utf8');
  const lyrics = lrc.split(/\r?\n/).filter(line => /^\[\d{2}:\d{2}/.test(line)).map(line => ({time: 0, text: line.replace(/^\[[^\]]+\]/, '')}));
  return {config, lyrics};
}));
const preset = mobile => ({fontSize: (mobile ? .54 : .6) * 1.6, topLaneY: mobile ? 2.1 : 2.8,
  bottomLaneY: mobile ? -2.05 : -2.7, yOffset: mobile ? -.6 : -.82,
  modelScale: (mobile ? 2.2 : 2.8) * 1.2 * 1.1, modelYOffset: mobile ? -.3 : -.41});

test('both admitted recordings keep the original portrait and tall desktop camera', () => {
  for (const {lyrics} of recordings) for (const mobile of [false, true]) {
    const base = mobile ? 92 : 100;
    const frame = fitReaderFrame(mobile ? 716 : 772, base, readerBounds({lyrics, ...preset(mobile)}));
    assert.equal(frame.zoom, base);
    assert.equal(frame.centerY, 0);
  }
});

test('short viewports contain every full column and the jade envelope with title clearance', () => {
  for (const {lyrics} of recordings) for (const mobile of [false, true]) {
    const bounds = readerBounds({lyrics, ...preset(mobile)});
    for (const height of [262, 314, 585]) {
      const {zoom, centerY} = fitReaderFrame(height, mobile ? 92 : 100, bounds);
      const top = height / 2 - (bounds.maxY - centerY) * zoom;
      const bottom = height / 2 - (bounds.minY - centerY) * zoom;
      assert.ok(zoom > 0 && zoom <= (mobile ? 92 : 100));
      assert.ok(top >= 64 - 1e-7);
      assert.ok(bottom <= height - 8 + 1e-7);
      assert.ok(preset(mobile).fontSize * zoom / 2.15 >= (height >= 314 ? 16 : 14),
        'glyphs retain at least 16px at the new 390px landscape height, and 14px at the former 262px content height');
    }
  }
});

test('the source geometry of every active anchor fits the fixed framing contract', async () => {
  const paths = new Set(recordings.flatMap(({config}) => config.anchors.mappings.map(m => m.modelPath)));
  for (const path of paths) {
    const bytes = await readFile(new URL('../../public/models/10k_obj/' + path, import.meta.url));
    let ranges;
    if (path.endsWith('.obj')) {
      const y = bytes.toString().split(/\r?\n/).filter(line => line.startsWith('v ')).map(line => Number(line.trim().split(/\s+/)[2]));
      ranges = [[Math.min(...y), Math.max(...y)]];
    } else {
      const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
      ranges = document.meshes.flatMap(mesh => mesh.primitives.map(primitive => {
        const accessor = document.accessors[primitive.attributes.POSITION];
        return [accessor.min[1], accessor.max[1]];
      }));
    }
    for (const [min, max] of ranges) assert.ok(min >= -.5 && max <= .5, path + ' exceeds the admitted unit-height envelope');
  }
});

test('semantic lyrics preserve recording order and repeats, omit spacers, and do not auto-announce', () => {
  const lyrics = [{time: 0, text: ' '}, {time: 1, text: '第一句'}, {time: 2, text: '第一句'}, {time: 3, text: '<终句>'}];
  const html = renderToStaticMarkup(React.createElement(Transcript, {title: '曲名', description: '摘编歌曲', lyrics}));
  assert.match(html, /<h1[^>]*>曲名 · 歌词<\/h1>/);
  assert.match(html, /<li>第一句<\/li><li>第一句<\/li><li>&lt;终句&gt;<\/li>/);
  assert.doesNotMatch(html, /aria-live|<li> <\/li>/);
  const switched = renderToStaticMarkup(React.createElement(Transcript, {title: '新曲', lyrics: [{time: 0, text: '新句'}]}));
  assert.match(switched, /新句/);
  assert.doesNotMatch(switched, /第一句|终句|摘编歌曲/);
});
