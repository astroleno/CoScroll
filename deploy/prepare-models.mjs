#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import ts from 'typescript';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import {Mesh} from 'three';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = join(root, 'src/components/jade/prepared-models.json');
const modelDirectory = join(root, 'public/models/10k_obj');
const preparedDirectory = join(root, 'public/models/prepared');
const pipelineInputs = ['src/components/jade/modelGeometry.ts', 'src/components/jade/preparedModelGeometry.ts',
  'deploy/prepare-models.mjs', 'package-lock.json'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function loadModelPipeline() {
  await mkdir(join(root, '.cache'), {recursive:true});
  const directory = await mkdtemp(join(root, '.cache/model-pipeline-'));
  try {
    const modules = {};
    for (const name of ['modelGeometry', 'preparedModelGeometry']) {
      const source = await readFile(join(root, 'src/components/jade', name + '.ts'), 'utf8');
      const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,
        target:ts.ScriptTarget.ES2020}}).outputText;
      const path = join(directory, name + '.mjs');
      await writeFile(path, compiled);
      Object.assign(modules, await import(pathToFileURL(path).href));
    }
    return {...modules, directory, dispose:() => rm(directory, {recursive:true, force:true})};
  } catch (error) {
    await rm(directory, {recursive:true, force:true});
    throw error;
  }
}

async function generationIdentity() {
  const hash = createHash('sha256');
  for (const path of pipelineInputs) hash.update(path).update('\0').update(await readFile(join(root, path))).update('\0');
  return hash.digest('hex');
}

async function sourceModels() {
  return (await readdir(modelDirectory)).filter(name => name.endsWith('.obj')).sort();
}

export async function checkPreparedModels() {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const names = await sourceModels();
  if (registry.version !== 1 || registry.generation !== await generationIdentity() ||
      registry.models.length !== names.length || names.some((name, i) => registry.models[i].sourcePath !== '/models/10k_obj/' + name)) {
    throw new Error('Prepared model data is stale; run npm run models:prepare');
  }
  const expectedFiles = [];
  for (const entry of registry.models) {
    const name = entry.sourcePath.slice('/models/10k_obj/'.length);
    const preparedName = name.replace(/\.obj$/, '.json');
    if (entry.preparedPath !== '/models/prepared/' + preparedName ||
        entry.sourceSha256 !== sha(await readFile(join(modelDirectory, name)))) {
      throw new Error('Prepared source changed: ' + name);
    }
    const bytes = await readFile(join(preparedDirectory, preparedName));
    if (bytes.length !== entry.bytes || sha(bytes) !== entry.preparedSha256) throw new Error('Prepared payload changed: ' + name);
    const payload = JSON.parse(bytes);
    if (payload.version !== registry.version || payload.generation !== registry.generation || payload.sourceSha256 !== entry.sourceSha256 ||
        JSON.stringify(payload.preset) !== JSON.stringify(registry.preset)) throw new Error('Prepared payload identity mismatch: ' + name);
    expectedFiles.push(preparedName);
  }
  if (JSON.stringify((await readdir(preparedDirectory)).sort()) !== JSON.stringify(expectedFiles.sort())) {
    throw new Error('Unexpected prepared model files');
  }
  return {models:registry.models.length, bytes:registry.models.reduce((sum, entry) => sum + entry.bytes, 0), generation:registry.generation};
}

async function generatePreparedModels() {
  const pipeline = await loadModelPipeline();
  try {
    const generation = await generationIdentity();
    const preset = pipeline.PREPARED_MODEL_PRESET;
    const registry = {version:pipeline.PREPARED_MODEL_VERSION, generation, preset, models:[]};
    await mkdir(preparedDirectory, {recursive:true});
    for (const name of await sourceModels()) {
      const bytes = await readFile(join(modelDirectory, name));
      const sourceSha256 = sha(bytes);
      let extracted;
      new OBJLoader().parse(bytes.toString('utf8')).traverse(child => {
        // Preserve the existing loader's traversal behavior, including multiple meshes.
        if (child instanceof Mesh && child.geometry) extracted = child.geometry;
      });
      if (!extracted) throw new Error('No model geometry: ' + name);
      const base = pipeline.normalizeModelGeometry(extracted);
      const outer = pipeline.createOffsetGeometry(base, preset.outerOffset, preset);
      const payload = {version:pipeline.PREPARED_MODEL_VERSION, generation, sourceSha256, preset,
        base:await pipeline.encodeGeometry(base), outer:await pipeline.encodeGeometry(outer)};
      const preparedPath = '/models/prepared/' + name.replace(/\.obj$/, '.json');
      const encoded = JSON.stringify(payload) + '\n';
      await writeFile(join(root, 'public', preparedPath), encoded);
      registry.models.push({sourcePath:'/models/10k_obj/' + name, sourceSha256,
        preparedPath, preparedSha256:sha(encoded), bytes:Buffer.byteLength(encoded)});
      extracted.dispose(); base.dispose(); outer.dispose();
      console.log(name, Buffer.byteLength(encoded));
    }
    // A removed OBJ must not leave a deliverable that bypasses freshness checks.
    const expected = new Set(registry.models.map(entry => entry.preparedPath.split('/').at(-1)));
    for (const name of await readdir(preparedDirectory)) if (!expected.has(name)) await rm(join(preparedDirectory, name));
    await writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n');
    return await checkPreparedModels();
  } finally { await pipeline.dispose(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== '--check')) throw new Error('Usage: prepare-models.mjs [--check]');
  (args[0] === '--check' ? checkPreparedModels() : generatePreparedModels())
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => {console.error(error.message); process.exitCode = 1;});
}
