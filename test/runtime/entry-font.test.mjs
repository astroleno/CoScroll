import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';

const code = ts.transpileModule(await readFile('src/config/entryFont.ts', 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
const exports = {};
vm.runInNewContext(code, {exports});
const {entryFontRanges} = exports;
const manifest = JSON.parse(await readFile('src/config/entry-font.json', 'utf8'));
const ranges = entryFontRanges(manifest.codepoints);
const intervals = value => value.split(',').map(range => {
  const [from, to = from] = range.slice(2).split('-').map(v => Number.parseInt(v, 16));
  return {from, to};
});
const covers = (face, point) => intervals(ranges[face]).some(r => point >= r.from && point <= r.to);

test('entry, complete fallback and supplement partition every Unicode value without overlap or gaps', () => {
  const all = Object.values(ranges).flatMap(intervals).sort((a, b) => a.from - b.from);
  let next = 0;
  for (const range of all) {
    assert.equal(range.from, next);
    assert.ok(range.to >= range.from);
    next = range.to + 1;
  }
  assert.equal(next, 0x110000);
  for (const point of manifest.codepoints) assert.equal(covers('entry', point), true);
  assert.equal(covers('supplement', '栴'.codePointAt(0)), true);
  assert.equal(covers('full', '龍'.codePointAt(0)), true);
  assert.equal(covers('entry', ' '.codePointAt(0)), true);
});

test('published font bytes match the audited manifest and retain the original complete file', async () => {
  for (const [path, sha] of [[manifest.source, manifest.sourceSha256], [manifest.entry, manifest.entrySha256]]) {
    const bytes = await readFile('public' + path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha);
    if (path === manifest.entry) assert.ok(bytes.byteLength < 128 * 1024);
  }
  assert.equal(manifest.sourceSha256, '76e1269db23aa03c8515da4a937bc5a2cb437db3caf65bf3a0fe7b7b26a57af6');
  for (const path of ['public/lyrics/心经.lrc', 'public/lyrics/lotus-sutra-zanshi.lrc']) {
    for (const char of new Set(await readFile(path, 'utf8'))) {
      const point = char.codePointAt(0);
      if (point >= 0x4e00 && point <= 0x9fff) assert.ok(covers('entry', point) || covers('supplement', point), char);
    }
  }
});

test('invalid manifests cannot silently remove fallback characters or override the rare-character face', () => {
  for (const bad of [[], [-1], [NaN], [1.5], [0x110000], [0x6834]]) assert.throws(() => entryFontRanges(bad));
  assert.equal(entryFontRanges([33, 32, 32]).entry, 'U+20-21');
});

test('vertical blank columns retain their cells without requesting a glyph from the fallback face', async () => {
  const fills = [], context = {clearRect() {}, fillText(text) {fills.push(text);}},
    canvas = {getContext: () => context}, local = {};
  const code = ts.transpileModule(await readFile('src/components/layouts/lyricTextureCache.ts', 'utf8'),
    {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code, {exports: local, require: name => name === 'three' ? THREE : {RetainedResourceCache: class {}},
    window: {devicePixelRatio: 3}, document: {createElement: () => canvas}});
  const recipe = {align: 'left', orientation: 'vertical', verticalAlign: 'top'};
  const blank = local.createTextBillboard({...recipe, text: '　'});
  assert.deepEqual(fills, []);
  const visible = local.createTextBillboard({...recipe, text: '经　文'});
  assert.deepEqual(fills, ['经', '文']);
  assert.equal(blank.glyphCount, 1);
  assert.equal(visible.glyphCount, 3);
  assert.equal(blank.fontPx, 288);
  blank.texture.dispose(); visible.texture.dispose();
});
