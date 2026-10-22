import assert from 'node:assert/strict';
import {test, after} from 'node:test';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

await mkdir(resolve('.cache'), {recursive: true});
const folder = await mkdtemp(join(resolve('.cache'), 'project-session-test-'));
after(() => rm(folder, {recursive: true, force: true}));
async function compile(source, name, replacements = {}) {
  let output = ts.transpileModule(await readFile(resolve(source), 'utf8'),
    {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020}}).outputText;
  for (const [from, to] of Object.entries(replacements)) output = output.replaceAll(from, to);
  const file = join(folder, name + '.mjs');
  await writeFile(file, output);
  return import(pathToFileURL(file).href);
}
await compile('src/utils/assetUrl.ts', 'assetUrl');
const {safeValidateProjectConfig} = await compile('src/config/schema.ts', 'schema');
const {parseLRC} = await compile('src/config/lyrics.ts', 'lyrics');
const {resolveAnchor} = await compile('src/config/resolveAnchor.ts', 'resolveAnchor', {"'@/utils/assetUrl'": "'./assetUrl.mjs'"});
const appearance = await compile('src/config/appearance.ts', 'appearance');
const {readEntryProject, serializeEntryData} = await compile('src/config/entryBootstrap.ts', 'entryBootstrap');
const heart = JSON.parse(await readFile(resolve('public/projects/heart-sutra.json'), 'utf8'));
const lotus = JSON.parse(await readFile(resolve('public/projects/lotus-sutra-zanshi.json'), 'utf8'));
const lrc = await readFile(resolve('public/lyrics/lotus-sutra-zanshi.lrc'), 'utf8');

test('entry data is release-bound, optional, and safe to embed in HTML', () => {
  const oldDocument = globalThis.document;
  let data = {version: 1, release: 'release-test', projects: {'heart-sutra': {config: heart, lyrics: '[00:00]心经'}}};
  globalThis.document = {getElementById: () => ({textContent: JSON.stringify(data)}),
    querySelector: () => ({getAttribute: () => 'release-test'})};
  try {
    assert.equal(readEntryProject('heart-sutra').config.project.id, 'heart-sutra');
    assert.equal(readEntryProject('__proto__'), null);
    assert.equal(readEntryProject('missing'), null);
    data.release = 'old-release'; assert.equal(readEntryProject('heart-sutra'), null);
    data.release = 'release-test'; data.projects['heart-sutra'].config = {project: {id: 'heart-sutra'}};
    assert.equal(readEntryProject('heart-sutra'), null);
    assert.ok(!serializeEntryData('</script>\u2028\u2029').includes('<'));
    assert.equal(JSON.parse(serializeEntryData('</script>\u2028\u2029')), '</script>\u2028\u2029');
  } finally {globalThis.document = oldDocument;}
});

test('both recordings validate and every timeline anchor resolves to an existing asset', async () => {
  for (const project of [heart, lotus]) {
    assert.equal(safeValidateProjectConfig(project).success, true);
    for (const item of project.timeline) {
      const model = resolveAnchor(item.anchor, project);
      assert.ok((await readFile(resolve('public' + model.modelPath))).byteLength > 0);
    }
  }
  assert.equal(resolveAnchor('圆', heart).renderedCharacter, '空');
  assert.equal(resolveAnchor('海', lotus).renderedCharacter, '水');
  assert.match(resolveAnchor('海', lotus).modelPath, /013_水\.obj$/);
  assert.equal(resolveAnchor('水', lotus).isPlaceholder, false);
});

test('invalid placeholders, missing timeline mappings, and out-of-range hue cannot enter a session', () => {
  for (const edit of [p => {delete p.anchors.mappings.find(item => item.status === 'placeholder').pendingReason;},
    p => {p.timeline[0].anchor = '未映射';}, p => {p.appearance.hueOffset = 181;}]) {
    const invalid = structuredClone(lotus); edit(invalid);
    assert.equal(safeValidateProjectConfig(invalid).success, false);
  }
});

test('timed lyrics retain repeated phrases, blank interludes, and the actual 栴 character', () => {
  const lines = parseLRC(lrc);
  assert.equal(lines.filter(line => line.text).length, 33);
  assert.ok(lines.filter(line => !line.text).length >= 4);
  assert.equal(lines.filter(line => line.text === '众生处处令得出').length, 5);
  assert.equal(lines.filter(line => line.text === '无上教化诸菩萨').length, 5);
  assert.ok(lines.some(line => line.text.includes('栴')));
  assert.ok(!lrc.includes('丛生') && !lrc.includes('说的法利') && !lrc.includes('於'));
  assert.ok(lines.every((line, index) => line.time >= 0 && line.time < lotus.assets.audio.duration &&
    (!index || line.time >= lines[index - 1].time)));
  assert.throws(() => parseLRC('[00:61.000]bad'), /小于 60/);
  assert.throws(() => parseLRC('not timed'), /没有有效/);
});

test('the original palette is byte-for-byte unchanged at zero hue offset', () => {
  assert.deepEqual(appearance.resolvePalette(appearance.DEFAULT_APPEARANCE), {
    background: '#1f2e38', container: '#202734', jade: '#2d6d8b', emissive: '#0f2b38',
    light: '#4A90E2', currentText: '#f8fafc', adjacentText: '#cbd5f5', accent: '#87CEEB',
  });
  assert.notDeepEqual(appearance.resolvePalette({...appearance.DEFAULT_APPEARANCE, hueOffset: 120}),
    appearance.resolvePalette(appearance.DEFAULT_APPEARANCE));
});

test('local appearance preferences are per recording and reject corrupt storage', () => {
  const values = new Map();
  globalThis.localStorage = {getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
  const selected = {...appearance.DEFAULT_APPEARANCE, hueOffset: 75};
  appearance.saveAppearance(heart.project.id, selected);
  assert.deepEqual(appearance.resolveAppearance(heart), selected);
  assert.deepEqual(appearance.resolveAppearance(lotus), lotus.appearance);
  appearance.saveAppearance(heart.project.id, null);
  assert.deepEqual(appearance.resolveAppearance(heart), appearance.DEFAULT_APPEARANCE);
  assert.equal(appearance.validAppearance({background: 'silk', palette: '__proto__', hueOffset: 0}), false);
  assert.equal(appearance.validAppearance({...selected, hueOffset: NaN}), false);
  delete globalThis.localStorage;
});

await writeFile(join(folder, 'prepareMock.mjs'), `export const requests=[];
export function prepareProject(id,signal){return new Promise((resolve,reject)=>requests.push({id,signal,resolve,reject}));}`);
await writeFile(join(folder, 'loaderMock.mjs'), 'export const projectConfigLoader={clearCache(){}};');
await writeFile(join(folder, 'modelMock.mjs'), 'export default class ModelPreloader {}');
const {prepareAudio} = await compile('src/config/prepareProject.ts', 'prepareProject', {
  "'./loader'": "'./loaderMock.mjs'", "'./lyrics'": "'./lyrics.mjs'", "'./resolveAnchor'": "'./resolveAnchor.mjs'",
  "'@/utils/assetUrl'": "'./assetUrl.mjs'", "'@/components/jade/ModelPreloader'": "'./modelMock.mjs'",
  "'./entryBootstrap'": "'./entryBootstrap.mjs'",
});

test('verified recordings use HEAD without a throwaway audio download; failed objects are rejected', async () => {
  const oldAudio = globalThis.Audio, oldFetch = globalThis.fetch;
  let constructed = 0, requestedMethod;
  globalThis.Audio = class {
    constructor() {constructed++;}
    load() {} removeAttribute() {}
  };
  globalThis.fetch = async (_, options) => {requestedMethod = options.method; return {ok: true, body: {cancel: async () => {}}};};
  try {
    assert.equal(await prepareAudio('/recording.mp3', new AbortController().signal, 241.843771), 241.843771);
    assert.equal(requestedMethod, 'HEAD');
    assert.equal(constructed, 0);
    globalThis.fetch = async () => ({ok: false, status: 404});
    await assert.rejects(prepareAudio('/missing.mp3', new AbortController().signal, 242), /录音加载失败/);
  } finally {globalThis.Audio = oldAudio; globalThis.fetch = oldFetch;}
});

test('HEAD-incompatible origins fall back to one byte; unknown recordings still read native duration', async () => {
  const oldAudio = globalThis.Audio, oldFetch = globalThis.fetch;
  const requests = []; let cleaned = false;
  globalThis.fetch = async (_, options) => {
    requests.push(options);
    return options.method === 'HEAD' ? {ok: false, status: 405} : {ok: true};
  };
  globalThis.Audio = class {
    duration = 374.256327;
    load() {if (this.src && this.onloadedmetadata) queueMicrotask(() => this.onloadedmetadata?.());}
    removeAttribute() {this.src = ''; cleaned = true;}
  };
  try {
    assert.equal(await prepareAudio('/recording.mp3', new AbortController().signal), 374.256327);
    assert.equal(requests[1].headers.Range, 'bytes=0-0');
    assert.equal(cleaned, true);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(prepareAudio('/recording.mp3', controller.signal, 374), {name: 'AbortError'});
  } finally {globalThis.Audio = oldAudio; globalThis.fetch = oldFetch;}
});
await compile('src/config/defaults.ts', 'defaults');
const {projectConfigLoader: entryLoader} = await compile('src/config/loader.ts', 'entryLoader', {
  "'./schema'": "'./schema.mjs'", "'./defaults'": "'./defaults.mjs'",
  "'@/utils/assetUrl'": "'./assetUrl.mjs'", "'./entryBootstrap'": "'./entryBootstrap.mjs'",
});
test('validated HTML entries avoid a configuration round trip; corrupt hints and forced reload use HTTP', async () => {
  const oldDocument=globalThis.document, oldFetch=globalThis.fetch;
  let requests=0, payload={version:1,release:'entry-test',projects:{'heart-sutra':{config:heart,lyrics:'[00:00]心经'}}};
  globalThis.document={getElementById:()=>({textContent:JSON.stringify(payload)}),querySelector:()=>({getAttribute:()=>'entry-test'})};
  globalThis.fetch=async()=>{requests++;return {ok:true,json:async()=>heart};};
  try {
    entryLoader.clearCache();
    assert.equal((await entryLoader.load('heart-sutra',{fallbackToDefault:false})).project.id,'heart-sutra');
    assert.equal(requests,0);
    await entryLoader.load('heart-sutra',{fallbackToDefault:false,useCache:false});assert.equal(requests,1);
    entryLoader.clearCache();payload.projects['heart-sutra'].config={...heart,timeline:[]};
    assert.equal((await entryLoader.load('heart-sutra',{fallbackToDefault:false})).project.id,'heart-sutra');
    assert.equal(requests,2);
  } finally {entryLoader.clearCache();globalThis.document=oldDocument;globalThis.fetch=oldFetch;}
});
const {requests} = await import(pathToFileURL(join(folder, 'prepareMock.mjs')).href);
const {useProjectConfigStore: store} = await compile('src/stores/projectConfigStore.ts', 'store', {
  "'@/config/prepareProject'": "'./prepareMock.mjs'", "'@/config/loader'": "'./loaderMock.mjs'",
  "'@/config/defaults'": "'./defaults.mjs'",
});
function prepared(config, release = () => {}) {return {config, lyrics: [{time: 0, text: config.project.name}], duration: 242, release};}

test('latest prepared recording wins; a late canceled result releases its staging owner', async () => {
  let released = false;
  const a = store.getState().loadProject('heart-sutra');
  const first = requests.at(-1);
  const b = store.getState().loadProject('lotus-sutra-zanshi');
  const last = requests.at(-1);
  assert.equal(first.signal.aborted, true);
  last.resolve(prepared(lotus)); await b;
  first.resolve(prepared(heart, () => {released = true;})); await a;
  assert.equal(store.getState().currentProjectId, 'lotus-sutra-zanshi');
  assert.equal(store.getState().lyrics[0].text, lotus.project.name);
  assert.equal(released, true);
});

test('load failure keeps the complete old session, and reselecting it cancels a pending switch', async () => {
  const before = store.getState();
  const fail = store.getState().loadProject('heart-sutra');
  requests.at(-1).reject(new Error('test offline')); await fail;
  assert.equal(store.getState().config, before.config);
  assert.equal(store.getState().lyrics, before.lyrics);
  assert.match(store.getState().error, /offline/);
  const pending = store.getState().loadProject('heart-sutra');
  const canceled = requests.at(-1);
  await store.getState().loadProject('lotus-sutra-zanshi');
  assert.equal(canceled.signal.aborted, true);
  canceled.resolve(prepared(heart)); await pending;
  assert.equal(store.getState().currentProjectId, 'lotus-sutra-zanshi');
  assert.equal(store.getState().isLoading, false);
});
