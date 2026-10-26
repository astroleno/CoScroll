#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {ensureInkoSdk, INKO_REVISION, pythonJson} from './handwriting/inko-sdk.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const STYLE = '12', RENDER_VERSION = 1;
const validId = id => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);

function publicPath(root, path) {
  if (typeof path !== 'string' || !path.startsWith('/') || /[\\%?#]/.test(path)) throw new Error('Use a logical public asset path');
  const target = resolve(root, 'public', '.' + path);
  if (!target.startsWith(join(root, 'public') + sep)) throw new Error('Asset path escapes public');
  return target;
}

export function validatePreface(preface) {
  const {text, kind} = preface || {};
  if (!['original', 'excerpt'].includes(kind) || typeof text !== 'string' || text !== text.trim()
    || text.length < 12 || text.length > 64 || /[\u0000-\u0009\u000b-\u001f\u007f<>]/.test(text)) throw new Error('Invalid preface text or kind');
  const lines = text.split('\n');
  if (lines.length < 2 || lines.length > 3 || lines.some(line => !line || line !== line.trim() || Array.from(line).length > 16)) {
    throw new Error('Preface must contain 2–3 lines, each at most 16 characters');
  }
  if (/点击|点一下|点击开始/.test(text)) throw new Error('Write a track-specific preface, not an operation reminder');
  return {text, kind};
}

export async function readTrack(root, id) {
  if (!validId(id)) throw new Error('Invalid project ID');
  const path = join(root, 'public/projects', `${id}.json`);
  const bytes = await readFile(path);
  const config = JSON.parse(bytes);
  if (config.project?.id !== id || !config.project.name?.trim()) throw new Error('Project identity mismatch');
  const lyrics = await readFile(publicPath(root, config.assets.lyrics.src), 'utf8');
  const audioSha256 = sha(await readFile(publicPath(root, config.assets.audio.src)));
  const input = {version: 1, project: {id, name: config.project.name, description: config.project.description || ''},
    audio: config.assets.audio, lyrics: {src: config.assets.lyrics.src, sha256: sha(lyrics)}, audioSha256};
  return {path, bytes, config, lyrics, input, sourceDigest: sha(JSON.stringify(input))};
}

export function trackBrief(track) {
  return {project: track.input.project, recording: track.config.assets.audio, sourceDigest: track.sourceDigest,
    lyrics: track.lyrics,
    instructions: '作为制曲步骤直接创作该录音专属的中文开场短序。推荐 20–35 字，2–3 行，每行至多 16 字。依据实际歌词意境，不编造经文原句、出处、演唱者或全本诵读身份；不写点击提示。返回 JSON {"text":"第一行\\n第二行\\n第三行","kind":"original","sourceDigest":"此资料的 sourceDigest"}。短序由正在制曲的模型完成，随后交给 tracks:prepare 自动制作 Inko 资源，无须用户另写。'};
}

export function verifyOpening(track, opening, manifest, png) {
  const id = track.config.project.id;
  if (!opening) throw new Error(`${id}: missing dedicated opening; run tracks:prepare`);
  validatePreface(opening);
  if (opening.sourceDigest !== track.sourceDigest) throw new Error(`${id}: recording or lyrics changed; regenerate the preface`);
  const prefix = `/opening/${id}/`;
  if (!opening.asset?.src?.startsWith(prefix) || !opening.manifest?.startsWith(prefix)) throw new Error(`${id}: opening belongs to another track`);
  if (json(manifest.opening) !== json(opening) || manifest.projectId !== id || manifest.generationCostCny !== '0.00'
    || manifest.provider !== 'Inko' || manifest.sdkRevision !== INKO_REVISION || manifest.render?.layoutVersion !== RENDER_VERSION
    || sha(JSON.stringify(manifest.inputs)) !== track.sourceDigest
    || manifest.render?.sceneText?.replace(/\s/g, '') !== opening.text.replace(/\s/g, '')
    || manifest.render?.glyphs?.join('').replace(/\s/g, '') !== opening.text.replace(/\s/g, '')) {
    throw new Error(`${id}: mismatched opening production manifest`);
  }
  const asset = opening.asset;
  const revision = sha(JSON.stringify({sourceDigest: track.sourceDigest, text: opening.text, kind: opening.kind,
    style: STYLE, sdk: INKO_REVISION, renderer: RENDER_VERSION}));
  if (png.length < 33 || png.length > 2 * 1024 * 1024 || png.length !== asset.bytes || sha(png) !== asset.sha256
    || asset.src !== `${prefix}preface.${asset.sha256.slice(0, 16)}.png` || opening.revision !== revision
    || opening.manifest !== `${prefix}manifest.${revision.slice(0, 16)}.json`
    || asset.width !== 1440 || asset.height !== 720
    || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || png.readUInt32BE(16) !== asset.width || png.readUInt32BE(20) !== asset.height || png[25] !== 6
    || !png.includes(Buffer.from('AIGC\0')) || !png.includes(Buffer.from('XML:com.adobe.xmp\0'))
    || !png.includes(Buffer.from('InkoEdited\0true'))) throw new Error(`${id}: corrupt or unlabelled opening PNG`);
  if (opening.attribution !== 'AI生成 · Inko') throw new Error(`${id}: missing Inko attribution`);
}

export async function checkTrackOpening(root, id) {
  const track = await readTrack(root, id), opening = track.config.opening;
  if (!opening) throw new Error(`${id}: missing dedicated opening; run tracks:prepare`);
  const [manifestBytes, png] = await Promise.all([readFile(publicPath(root, opening.manifest)), readFile(publicPath(root, opening.asset.src))]);
  verifyOpening(track, opening, JSON.parse(manifestBytes), png);
  return track;
}

export async function checkTrackOpenings(root = ROOT) {
  const ids = (await readdir(join(root, 'public/projects'))).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5)).sort();
  const texts = new Set();
  for (const id of ids) {
    const track = await checkTrackOpening(root, id), key = track.config.opening.text.replace(/\s/g, '');
    if (texts.has(key)) throw new Error(`${id}: shared prefaces are not dedicated track openings`);
    texts.add(key);
  }
  if (!ids.length) throw new Error('No public tracks found');
  return ids;
}

export async function prepareTrack({root = ROOT, id, preface, sdkCommand = pythonJson, sdkDirectory}) {
  const track = await readTrack(root, id);
  if (!preface) {
    await checkTrackOpening(root, id);
    return {projectId: id, reused: true, opening: track.config.opening};
  }
  const text = validatePreface(preface);
  if (preface.sourceDigest !== track.sourceDigest) throw new Error('Preface was written for different or outdated track inputs; read --brief again');
  if (text.kind === 'excerpt' && text.text.split('\n').some(line => !track.lyrics.includes(line))) throw new Error('Excerpt lines must exist in this recording’s lyrics');
  const revision = sha(JSON.stringify({sourceDigest: track.sourceDigest, ...text, style: STYLE, sdk: INKO_REVISION, renderer: RENDER_VERSION}));
  if (track.config.opening?.revision === revision) {
    await checkTrackOpening(root, id);
    return {projectId: id, reused: true, opening: track.config.opening};
  }
  const sdk = sdkDirectory || await ensureInkoSdk(root);
  const stage = join(root, '.cache/track-openings', `${id}-${revision.slice(0, 16)}`);
  await mkdir(stage, {recursive: true});
  const prefacePath = join(stage, 'preface.json'), layoutPath = join(stage, 'layout.json');
  await writeFile(prefacePath, json(text));
  // A centred blank layout gives one scene with explicit, intentional line breaks.
  await writeFile(layoutPath, json({text: text.text, paperId: 'blank',
    d: {size: 9, line: 1.8, align: 'center', indent: 0, margins: [30, 20, 40, 20]}}));
  const generated = await sdkCommand(root, join(sdk, 'inko.py'), ['generate', '--layout', layoutPath,
    '--model', 'lyric-1', '--style', STYLE, '--seed', String(parseInt(revision.slice(0, 7), 16)),
    '--max-cents', '0', '--idempotency-key', `coscroll-${revision}`, '--yes', '--what', 'png,scene',
    '--out', join(stage, 'generation'), '--timeout', '600']);
  if (!generated.job_id || generated.status !== 'succeeded') throw new Error('Inko generation did not succeed');
  const generation = join(stage, 'generation');
  const job = JSON.parse(await readFile(join(generation, 'job.json'), 'utf8'));
  if (job.cost_cents !== 0) throw new Error('Inko returned an unexpected nonzero or missing generation cost');
  const render = await sdkCommand(root, join(root, 'deploy/handwriting/render-opening.py'), ['--sdk', sdk,
    '--scene', join(generation, 'scene.zip'), '--preface', prefacePath, '--out', join(stage, 'opening.png')]);
  const asset = {src: `/opening/${id}/preface.${render.sha256.slice(0, 16)}.png`,
    width: render.width, height: render.height, bytes: render.bytes, sha256: render.sha256};
  const opening = {...text, sourceDigest: track.sourceDigest, revision, attribution: 'AI生成 · Inko', asset,
    manifest: `/opening/${id}/manifest.${revision.slice(0, 16)}.json`};
  const [source, sceneBytes] = await Promise.all([readFile(join(generation, 'page-1.png')), readFile(join(generation, 'scene.zip'))]);
  const manifest = {schemaVersion: 1, projectId: id, opening, provider: 'Inko', model: 'lyric-1', style: STYLE,
    sdkRevision: INKO_REVISION, generationCostCny: '0.00', jobId: generated.job_id,
    inputs: track.input, source: {pngSha256: sha(source), sceneSha256: sha(sceneBytes)}, render};
  const png = await readFile(join(stage, 'opening.png'));
  verifyOpening(track, opening, manifest, png);
  // Do not overwrite an editor's changes or attach an old preface to replacement media.
  const current = await readTrack(root, id);
  if (current.sourceDigest !== track.sourceDigest || !current.bytes.equals(track.bytes)) throw new Error('Track changed while generating; original configuration kept');
  await mkdir(dirname(publicPath(root, asset.src)), {recursive: true});
  const archive = join(root, 'docs/handwriting', id, revision.slice(0, 16));
  await mkdir(archive, {recursive: true});
  await Promise.all([writeFile(publicPath(root, asset.src), png), writeFile(publicPath(root, opening.manifest), json(manifest)),
    writeFile(join(archive, 'source.png'), source), writeFile(join(archive, 'scene.zip'), sceneBytes),
    writeFile(join(archive, 'manifest.json'), json(manifest))]);
  const updated = {...track.config, opening};
  const candidate = track.path + `.${revision.slice(0, 16)}.tmp`;
  await writeFile(candidate, json(updated));
  await rename(candidate, track.path);
  await checkTrackOpening(root, id);
  await rm(stage, {recursive: true, force: true});
  return {projectId: id, reused: false, opening};
}

async function main(args) {
  if (args.length === 1 && args[0] === '--check') {
    console.log(json({ok: true, projects: await checkTrackOpenings()})); return;
  }
  let id, preface, brief = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') id = args[++i];
    else if (args[i] === '--preface') preface = args[++i];
    else if (args[i] === '--brief') brief = true;
    else throw new Error('Usage: tracks:prepare -- --project <id> [--brief | --preface <JSON file>]');
  }
  if (brief) console.log(json(trackBrief(await readTrack(ROOT, id))));
  else console.log(json(await prepareTrack({id, preface: preface ? JSON.parse(await readFile(resolve(preface), 'utf8')) : undefined})));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => {console.error(error.message); process.exitCode = 1;});
}
