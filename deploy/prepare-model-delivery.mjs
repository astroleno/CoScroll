import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadModelPipeline, readSourceGeometry} from './prepare-models.mjs';
import {encodePreparedModelDelivery} from './lossless-model-codec.mjs';
import {fingerprintGeometry} from './model-fingerprint.mjs';
import {encodeDelivery} from './release-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryFile = join(root, 'src/components/jade/prepared-models.json');
const publicDirectory = join(root, 'public/models/prepared');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const geometryHash = pair => sha(JSON.stringify({base: fingerprintGeometry(pair.base), outer: fingerprintGeometry(pair.outer)}));
const geometryInputs = ['src/components/jade/modelGeometry.ts', 'package-lock.json'];
const encodingInputs = ['src/components/jade/preparedModelGeometry.ts', 'src/components/jade/preparedModelDelivery.ts',
  'deploy/lossless-model-codec.mjs', 'deploy/prepare-model-delivery.mjs', 'deploy/prepare-models.mjs'];

async function identity(paths, preset) {
  const hashes = {};
  for (const path of paths) hashes[path] = sha(await readFile(join(root, path)));
  return sha(JSON.stringify({hashes, preset}));
}
async function fixtures() {
  return JSON.parse(await readFile(join(root, 'test/runtime/fixtures/v2-75-geometry-baseline.json')));
}
function assertFrozen(pair, reference) {
  assert.deepEqual(fingerprintGeometry(pair.base), reference.base, reference.sourcePath + ' base');
  assert.deepEqual(fingerprintGeometry(pair.outer), reference.outer, reference.sourcePath + ' outer');
}
export async function readDeliveryPair(entry, registry, pipeline, bytes) {
  bytes ??= await readFile(join(root, 'public', entry.preparedPath));
  const expected = {generation: entry.generation ?? registry.generation,
    geometryGeneration: entry.geometryGeneration, sourceSha256: entry.sourceSha256};
  return entry.format === 'binary-v2' ? pipeline.decodePreparedModelDelivery(bytes, expected)
    : pipeline.decodePreparedModel(JSON.parse(bytes), expected);
}

/** Per-entry generations keep the 26 existing JSON payloads byte-for-byte intact. */
export async function checkDeliveryRegistry(registry) {
  const reference = await fixtures();
  if (registry.version !== 2 || registry.geometryGeneration !== await identity(geometryInputs, registry.preset) ||
      registry.encodingGeneration !== await identity(encodingInputs, registry.preset)) {
    throw new Error('Prepared geometry or delivery pipeline is stale; run npm run models:prepare');
  }
  const names = (await readdir(join(root, 'public/models/10k_obj'))).filter(n => /\.(obj|glb)$/.test(n)).sort();
  if (registry.models.length !== names.length || names.some((n, i) => registry.models[i].sourcePath !== '/models/10k_obj/' + n)) {
    throw new Error('Prepared source set mismatch');
  }
  const expectedFiles = [], pipeline = await loadModelPipeline();
  try {
    for (const entry of registry.models) {
      const name = entry.sourcePath.split('/').at(-1), binary = entry.format === 'binary-v2';
      if (!['json-v1', 'binary-v2'].includes(entry.format) || (binary && !name.endsWith('.glb')) ||
          entry.preparedPath !== '/models/prepared/' + name.replace(/\.(obj|glb)$/, binary ? '.bin' : '.json') ||
          entry.generation !== (binary ? registry.encodingGeneration : registry.legacyGeneration) ||
          entry.geometryGeneration !== registry.geometryGeneration ||
          entry.sourceSha256 !== sha(await readFile(join(root, 'public', entry.sourcePath)))) {
        throw new Error('Prepared descriptor mismatch: ' + name);
      }
      const bytes = await readFile(join(root, 'public', entry.preparedPath));
      if (bytes.length !== entry.bytes || sha(bytes) !== entry.preparedSha256) throw new Error('Prepared payload changed: ' + name);
      const pair = await readDeliveryPair(entry, registry, pipeline, bytes);
      try {
        if (entry.geometrySha256 !== geometryHash(pair)) throw new Error('Prepared geometry fingerprint mismatch: ' + name);
        if (name.endsWith('.glb')) {
          const frozen = reference.models.find(m => m.sourcePath === entry.sourcePath);
          if (!frozen || frozen.sourceSha256 !== entry.sourceSha256) throw new Error('Unapproved V2 source: ' + name);
          assertFrozen(pair, frozen);
        }
      } finally {pair.base.dispose(); pair.outer.dispose();}
      expectedFiles.push(name.replace(/\.(obj|glb)$/, binary ? '.bin' : '.json'));
    }
  } finally {await pipeline.dispose();}
  if (JSON.stringify((await readdir(publicDirectory)).sort()) !== JSON.stringify(expectedFiles.sort())) {
    throw new Error('Unexpected or missing prepared model files');
  }
  return {models: registry.models.length, bytes: registry.models.reduce((s, e) => s + e.bytes, 0),
    generation: registry.generation, geometryGeneration: registry.geometryGeneration, encodingGeneration: registry.encodingGeneration};
}

export async function generateModelDelivery() {
  const previous = JSON.parse(await readFile(registryFile)), reference = await fixtures();
  const transport = JSON.parse(await readFile(join(root, 'test/runtime/fixtures/v2-75-delivery-baseline.json')));
  const pipeline = await loadModelPipeline(), preset = pipeline.PREPARED_MODEL_PRESET;
  const geometryGeneration = await identity(geometryInputs, preset), encodingGeneration = await identity(encodingInputs, preset);
  const legacyGeneration = previous.legacyGeneration ?? previous.generation;
  const registry = {version: 2, generation: legacyGeneration, legacyGeneration, geometryGeneration, encodingGeneration, preset, models: []};
  const staging = await mkdtemp(join(root, '.cache/model-delivery-'));
  const report = {version: 2, geometryGeneration, encodingGeneration, models: []};
  try {
    for (const entry of previous.models) {
      const source = await readFile(join(root, 'public', entry.sourcePath));
      if (sha(source) !== entry.sourceSha256) throw new Error('Source changed: ' + entry.sourcePath);
      let pair;
      try {pair = await readDeliveryPair(entry, previous, pipeline);}
      catch {
        const extracted = await readSourceGeometry(entry.sourcePath.split('/').at(-1), source);
        try {
          const base = pipeline.normalizeModelGeometry(extracted);
          try {pair = {base, outer: pipeline.createOffsetGeometry(base, preset.outerOffset, preset)};}
          catch (error) {base.dispose(); throw error;}
        } finally {extracted.dispose();}
      }
      try {
        const pairHash = geometryHash(pair);
        if (entry.sourcePath.endsWith('.obj')) {
          // Legacy objects stay in the existing representation, with the original generation and digest.
          const bytes = await readFile(join(root, 'public', entry.preparedPath));
          if (sha(bytes) !== entry.preparedSha256 || bytes.length !== entry.bytes ||
              JSON.parse(bytes).generation !== legacyGeneration) throw new Error('Legacy prepared payload changed');
          registry.models.push({...entry, format: 'json-v1', generation: legacyGeneration, geometryGeneration, geometrySha256: pairHash});
          continue;
        }
        const frozen = reference.models.find(m => m.sourcePath === entry.sourcePath);
        if (!frozen || frozen.sourceSha256 !== entry.sourceSha256) throw new Error('Unapproved V2 source');
        assertFrozen(pair, frozen);
        let oldBytes;
        if (!entry.format || entry.format === 'json-v1') oldBytes = await readFile(join(root, 'public', entry.preparedPath));
        else oldBytes = Buffer.from(JSON.stringify({version: 1, generation: legacyGeneration,
          sourceSha256: entry.sourceSha256, preset, base: await pipeline.encodeGeometry(pair.base), outer: await pipeline.encodeGeometry(pair.outer)}) + '\n');
        const original = transport.models.find(m => m.sourcePath === entry.sourcePath);
        if (!original || original.sourceSha256 !== frozen.sourceSha256 ||
            original.preparedSha256 !== frozen.preparedSha256 || original.preparedBytes !== frozen.preparedBytes) {
          throw new Error('Original transport measurement identity mismatch');
        }
        const stem = entry.sourcePath.split('/').at(-1).replace('.glb', '');
        // Equivalent gzip streams need not be byte-identical across implementations.
        // Always compare with the recorded original release, not a newly generated JSON baseline.
        const oldWire = original.wireBytes;
        const candidate = encodePreparedModelDelivery({...pair, identity: {generation: encodingGeneration,
          geometryGeneration, sourceSha256: entry.sourceSha256, preset}}).bytes;
        const candidateWire = encodeDelivery('assets', stem + '.bin', candidate).bytes.length;
        const binary = candidateWire < oldWire, chosen = binary ? candidate : oldBytes;
        if (!binary && encodeDelivery('assets', stem + '.json', oldBytes).bytes.length > oldWire) {
          throw new Error('No candidate meets the original transport budget: ' + entry.sourcePath);
        }
        const name = stem + (binary ? '.bin' : '.json');
        const descriptor = {sourcePath: entry.sourcePath, sourceSha256: entry.sourceSha256,
          preparedPath: '/models/prepared/' + name, preparedSha256: sha(chosen), bytes: chosen.length,
          format: binary ? 'binary-v2' : 'json-v1', generation: binary ? encodingGeneration : legacyGeneration,
          geometryGeneration, geometrySha256: pairHash};
        const restored = await readDeliveryPair(descriptor, registry, pipeline, chosen);
        try {assertFrozen(restored, frozen);} finally {restored.base.dispose(); restored.outer.dispose();}
        await writeFile(join(staging, name), chosen);
        registry.models.push(descriptor);
        report.models.push({...descriptor, oldPreparedBytes: original.preparedBytes, oldPreparedSha256: original.preparedSha256, oldWireBytes: oldWire,
          candidateWireBytes: candidateWire, selectedWireBytes: binary ? candidateWire : oldWire,
          geometryBytes: frozen.base.geometryBytes + frozen.outer.geometryBytes, exact: true});
        console.log(stem, descriptor.format, oldWire, '->', binary ? candidateWire : oldWire);
      } finally {pair.base.dispose(); pair.outer.dispose();}
    }
    if (report.models.length !== reference.models.length || previous.models.length !== reference.models.length + 26) throw new Error('Incomplete approved model set');
    // All candidates passed before changing the deliverable set. Raw source files are never edited.
    await mkdir(publicDirectory, {recursive: true});
    for (const name of await readdir(staging)) await rename(join(staging, name), join(publicDirectory, name));
    await writeFile(join(staging, 'registry.json'), JSON.stringify(registry, null, 2) + '\n');
    await rename(join(staging, 'registry.json'), registryFile);
    const chosenNames = new Set(registry.models.map(e => e.preparedPath.split('/').at(-1)));
    for (const name of await readdir(publicDirectory)) if (!chosenNames.has(name)) await rm(join(publicDirectory, name));
    report.totals = {oldWireBytes: report.models.reduce((s, e) => s + e.oldWireBytes, 0),
      selectedWireBytes: report.models.reduce((s, e) => s + e.selectedWireBytes, 0),
      binaryModels: report.models.filter(e => e.format === 'binary-v2').length};
    await writeFile(join(root, 'docs/model-assets/v2-75-lossless-delivery-20261024.json'), JSON.stringify(report, null, 2) + '\n');
    return await checkDeliveryRegistry(registry);
  } finally {await pipeline.dispose(); await rm(staging, {recursive: true, force: true});}
}
