import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {checkTrackOpening, checkTrackOpenings, prepareTrack, readTrack, trackBrief, validatePreface} from '../../deploy/prepare-track.mjs';

const root = resolve('.'), temporary = [];
after(async () => {for (const path of temporary) await rm(path, {recursive: true, force: true});});
const source = JSON.parse(await readFile(join(root, 'public/projects/heart-sutra.json'), 'utf8'));
const frozen = source.opening;
const png = await readFile(join(root, 'public', frozen.asset.src));
const manuscript = JSON.parse(await readFile(join(root, 'public', frozen.manifest), 'utf8'));
const json = value => JSON.stringify(value, null, 2) + '\n';
const hash = value => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const folder = await mkdtemp(join(root, '.cache/track-opening-test-')); temporary.push(folder);
  const project = structuredClone(source); delete project.opening;
  const config = join(folder, 'public/projects/heart-sutra.json');
  for (const [path, value] of [[config, json(project)], [join(folder, 'public', project.assets.audio.src), 'fixture recording'],
    [join(folder, 'public', project.assets.lyrics.src), '[00:00.000]照见五蕴皆空\n[00:03.000]心无挂碍\n']]) {
    await mkdir(dirname(path), {recursive: true}); await writeFile(path, value);
  }
  const track = await readTrack(folder, 'heart-sutra');
  return {folder, config, project, track,
    preface: {text: frozen.text, kind: 'original', sourceDigest: track.sourceDigest}};
}

function service({cost = 0, corrupt = false, beforeRender} = {}) {
  const calls = [];
  return {calls, run: async (folder, script, args) => {
    calls.push({script, args});
    const arg = name => args[args.indexOf(name) + 1];
    if (script.endsWith('/inko.py')) {
      assert.equal(arg('--max-cents'), '0'); assert.ok(args.includes('--yes'));
      assert.match(arg('--idempotency-key'), /^coscroll-[a-f0-9]{64}$/);
      const out = arg('--out'); await mkdir(out, {recursive: true});
      await Promise.all([writeFile(join(out, 'job.json'), json({cost_cents: cost})),
        writeFile(join(out, 'page-1.png'), png), writeFile(join(out, 'scene.zip'), 'fixture scene')]);
      return {job_id: 'fixture-job', status: 'succeeded'};
    }
    await beforeRender?.(folder);
    const text = JSON.parse(await readFile(arg('--preface'), 'utf8')).text;
    const output = corrupt ? Buffer.from('broken PNG') : png;
    await writeFile(arg('--out'), output);
    return {...manuscript.render, sceneText: text, glyphs: Array.from(text.replace(/\s/g, '')),
      sha256: hash(output), bytes: output.length};
  }};
}

test('both actual recordings have distinct, current, verified Inko openings', async () => {
  assert.deepEqual(await checkTrackOpenings(root), ['heart-sutra', 'lotus-sutra-zanshi']);
});

test('a new track without a preface cannot pass production or silently reuse a common prompt', async () => {
  const f = await fixture();
  await assert.rejects(checkTrackOpenings(f.folder), /missing dedicated opening/);
  await assert.rejects(prepareTrack({root: f.folder, id: 'heart-sutra'}), /missing dedicated opening/);
  assert.throws(() => validatePreface({text: '点击开始\n请点击一下开始聆听', kind: 'original'}), /operation reminder/);
});

test('production freezes a new preface, then reuses it without any further generation', async () => {
  const f = await fixture(), sdk = service();
  const options = {root: f.folder, id: 'heart-sutra', preface: f.preface, sdkDirectory: '/fixture-sdk', sdkCommand: sdk.run};
  const first = await prepareTrack(options);
  assert.equal(first.reused, false); assert.equal(sdk.calls.length, 2);
  await checkTrackOpening(f.folder, 'heart-sutra');
  assert.equal((await prepareTrack(options)).reused, true);
  assert.equal((await prepareTrack({...options, preface: undefined})).reused, true);
  assert.equal(sdk.calls.length, 2);
  assert.equal((await readFile(f.config, 'utf8')).includes('fixture-sdk'), false);
  assert.equal(trackBrief(f.track).sourceDigest, f.preface.sourceDigest);
});

test('replacement MP3 bytes and changed LRC invalidate a previously verified preface', async () => {
  for (const resource of ['audio', 'lyrics']) {
    const f = await fixture(), sdk = service();
    await prepareTrack({root: f.folder, id: 'heart-sutra', preface: f.preface, sdkDirectory: '/fixture-sdk', sdkCommand: sdk.run});
    await writeFile(join(f.folder, 'public', f.project.assets[resource].src), 'replacement content');
    await assert.rejects(checkTrackOpening(f.folder, 'heart-sutra'), /changed/);
    await assert.rejects(prepareTrack({root: f.folder, id: 'heart-sutra', preface: f.preface,
      sdkDirectory: '/fixture-sdk', sdkCommand: sdk.run}), /outdated track inputs/);
    assert.equal(sdk.calls.length, 2);
  }
});

test('unexpected cost, corrupt output and concurrent edits never replace the original configuration', async () => {
  for (const options of [{cost: 1}, {corrupt: true}, {beforeRender: async folder => {
    const path = join(folder, 'public/projects/heart-sutra.json');
    const data = JSON.parse(await readFile(path, 'utf8')); data.project.description = 'concurrent edit';
    await writeFile(path, json(data));
  }}]) {
    const f = await fixture(), sdk = service(options);
    await assert.rejects(prepareTrack({root: f.folder, id: 'heart-sutra', preface: f.preface,
      sdkDirectory: '/fixture-sdk', sdkCommand: sdk.run}), /cost|corrupt|changed/);
    const preserved = JSON.parse(await readFile(f.config, 'utf8'));
    assert.equal(preserved.opening, undefined);
    assert.equal(preserved.project.description, options.beforeRender ? 'concurrent edit' : f.project.project.description);
  }
});

test('invalid and invented excerpts, traversing project IDs and incompatible text are rejected before Inko', async () => {
  const f = await fixture();
  await assert.rejects(readTrack(f.folder, '../other'), /Invalid project ID/);
  await assert.rejects(prepareTrack({root: f.folder, id: 'heart-sutra', preface: {...f.preface, kind: 'excerpt'}}), /must exist/);
  for (const text of ['只有一行短序', '第一行文字\n第二行文字\n第三行文字\n第四行文字', '第一行\n\n第三行', '第一行文字\n<script>bad</script>']) {
    assert.throws(() => validatePreface({text, kind: 'original'}));
  }
});

test('mismatched manifests and damaged PNGs fail the delivery gate', async () => {
  for (const part of ['manifest', 'image']) {
    const f = await fixture(), sdk = service();
    const result = await prepareTrack({root: f.folder, id: 'heart-sutra', preface: f.preface,
      sdkDirectory: '/fixture-sdk', sdkCommand: sdk.run});
    if (part === 'image') await writeFile(join(f.folder, 'public', result.opening.asset.src), png.subarray(0, 40));
    else {
      const path = join(f.folder, 'public', result.opening.manifest);
      const data = JSON.parse(await readFile(path, 'utf8')); data.opening.text = '借用了另一首曲目的序言\n这不是当前录音的内容';
      await writeFile(path, json(data));
    }
    await assert.rejects(checkTrackOpening(f.folder, 'heart-sutra'), /mismatched|corrupt/);
  }
});
