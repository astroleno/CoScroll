import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {after, test} from 'node:test';
import * as THREE from 'three';
import {checkPreparedModels, loadModelPipeline} from '../../deploy/prepare-models.mjs';
import {loadPreloaderModule} from './model-modules.mjs';

const root = resolve('.');
const pipeline = await loadModelPipeline();
const baseline = JSON.parse(await readFile(new URL('./fixtures/model-geometry-baseline.json', import.meta.url)));
const registry = JSON.parse(await readFile(new URL('../../src/components/jade/prepared-models.json', import.meta.url)));
const delivery = JSON.parse(await readFile(new URL('../../docs/model-assets/priority7-integration-20261022.json', import.meta.url)));
const {ModelPreloader, assetUrl} = await loadPreloaderModule(pipeline.directory);
const preloader = ModelPreloader.getInstance();
after(() => pipeline.dispose());
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function attribute(value) {
  return {type:value.array.constructor.name, itemSize:value.itemSize, count:value.count,
    normalized:value.normalized, usage:value.usage, name:value.name,
    sha256:hash(Buffer.from(value.array.buffer, value.array.byteOffset, value.array.byteLength))};
}
function fingerprint(geometry) {
  return {name:geometry.name, attributes:Object.fromEntries(Object.keys(geometry.attributes).sort()
    .map(key => [key, attribute(geometry.attributes[key])])),
    index:geometry.index ? attribute(geometry.index) : null,
    groups:geometry.groups, drawRange:{start:geometry.drawRange.start,
      count:Number.isFinite(geometry.drawRange.count) ? geometry.drawRange.count : 'Infinity'},
    morphAttributes:geometry.morphAttributes, morphTargetsRelative:geometry.morphTargetsRelative,
    boundingBox:geometry.boundingBox, boundingSphere:geometry.boundingSphere, userData:geometry.userData};
}

async function payload(entry) {
  return JSON.parse(await readFile(join(root, 'public', entry.preparedPath), 'utf8'));
}

test('all 26 complete prepared models match independently recorded legacy geometry bytes and custom parameters', async () => {
  assert.equal(baseline.models.length, 26);
  assert.ok(registry.models.length >= baseline.models.length);
  assert.deepEqual(pipeline.PREPARED_MODEL_PRESET, baseline.preset);
  for (const old of baseline.models) {
    const entry = registry.models.find(entry => entry.sourcePath === old.path);
    assert.equal(entry.sourceSha256, old.sourceSha256, old.path);
    assert.equal(hash(await readFile(join(root, 'public', old.path))), old.sourceSha256);
    const stored = await payload(entry);
    const decoded = await pipeline.decodePreparedModel(stored, registryEntryIdentity(entry));
    try {
      assert.deepEqual(fingerprint(decoded.base), old.base, old.path + ' base');
      assert.deepEqual(fingerprint(decoded.outer), old.outer, old.path + ' outer');
      assert.equal(JSON.stringify(await pipeline.encodeGeometry(decoded.base)), JSON.stringify(stored.base));
      assert.equal(JSON.stringify(await pipeline.encodeGeometry(decoded.outer)), JSON.stringify(stored.outer));
      const custom = pipeline.createOffsetGeometry(decoded.base, baseline.custom.outerOffset, baseline.custom);
      assert.deepEqual(fingerprint(custom), old.custom, old.path + ' custom algorithm');
      custom.dispose();
    } finally {decoded.base.dispose(); decoded.outer.dispose();}
  }
});

function registryEntryIdentity(entry) {return {generation:registry.generation, sourceSha256:entry.sourceSha256};}

function expandedPositions(geometry) {
  const positions = geometry.getAttribute('position'), index = geometry.index;
  const expanded = new Float32Array((index?.count ?? positions.count) * 3);
  for (let i = 0; i < expanded.length / 3; i++) {
    const vertex = index ? index.getX(i) : i;
    expanded.set([positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)], i * 3);
  }
  return Buffer.from(expanded.buffer);
}

function components(geometry) {
  const count = geometry.getAttribute('position').count;
  const parents = Array.from({length:count}, (_, i) => i);
  const rootOf = i => {while (parents[i] !== i) {parents[i] = parents[parents[i]]; i = parents[i];} return i;};
  const index = geometry.index;
  for (let i = 0; i < index.count; i += 3) {
    const a = rootOf(index.getX(i));
    parents[rootOf(index.getX(i + 1))] = a;
    parents[rootOf(index.getX(i + 2))] = a;
  }
  const sizes = new Map();
  for (let i = 0; i < count; i++) {const id = rootOf(i); sizes.set(id, (sizes.get(id) || 0) + 1);}
  return [...sizes.values()].sort((a,b) => b-a);
}

test('seven GLBs retain every delivered triangle, winding, stroke component and bound in complete prepared pairs', async () => {
  assert.equal(delivery.models.length, 7);
  assert.equal(registry.models.length, baseline.models.length + delivery.models.length);
  for (const model of delivery.models) {
    const entry = registry.models.find(entry => entry.sourcePath === model.modelPath);
    const source = await readFile(join(root, 'public', model.modelPath));
    assert.equal(hash(source), model.sha256);
    assert.equal(source.length, model.bytes);
    assert.ok(source.length < 1_000_000);
    const decoded = await pipeline.decodePreparedModel(await payload(entry), registryEntryIdentity(entry));
    try {
      // This hash was read directly from the supplied GLB accessors, without
      // GLTFLoader or the project's geometry preparation implementation.
      assert.equal(hash(expandedPositions(decoded.base)), model.expandedPositionSha256, model.character);
      assert.equal(decoded.base.index.count / 3, model.topology.triangles);
      assert.equal(decoded.base.getAttribute('position').count, model.topology.vertices);
      assert.deepEqual(components(decoded.base), model.topology.component_vertices, model.character + ' components');
      decoded.base.computeBoundingBox();
      assert.deepEqual(decoded.base.boundingBox.min.toArray(), model.bounds.min);
      assert.deepEqual(decoded.base.boundingBox.max.toArray(), model.bounds.max);
      assert.equal(decoded.outer.index.count / 3, model.outerTriangles);
      assert.notEqual(decoded.outer, decoded.base);
      assert.equal(decoded.base.getAttribute('uv'), undefined, 'do not invent UV coordinates absent from the delivery');
      for (const geometry of [decoded.base, decoded.outer]) {
        const normals = geometry.getAttribute('normal');
        for (let i = 0; i < normals.count; i++) {
          const length = Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i));
          assert.ok(Number.isFinite(length) && Math.abs(length - 1) < .0001, model.character + ' unit normal');
        }
      }
    } finally {decoded.base.dispose(); decoded.outer.dispose();}
  }
});

test('lossless codec preserves negative zero, array types and geometry metadata', async () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0, 1, 2, 3, -0, 5, 6, 7, -0]), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float64Array([-0, 1, 2, 3, 4, 5]), 2));
  geometry.setIndex([0, 1, 2]);
  geometry.getAttribute('uv').name = 'coordinates';
  geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
  geometry.addGroup(0, 3, 2);
  geometry.setDrawRange(0, 3);
  geometry.name = 'complete'; geometry.userData = {fixture:true};
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const encoded = await pipeline.encodeGeometry(geometry);
  const decoded = await pipeline.decodeGeometry(JSON.parse(JSON.stringify(encoded)));
  assert.deepEqual(fingerprint(decoded), fingerprint(geometry));
  assert.ok(Object.is(decoded.getAttribute('position').getX(0), -0));
  assert.equal(JSON.stringify(await pipeline.encodeGeometry(decoded)), JSON.stringify(encoded));
  geometry.dispose(); decoded.dispose();
});

test('cooperative restoration allows queued UI work between chunks without altering complete geometry', async () => {
  const entry = registry.models.find(entry => entry.sourcePath === delivery.models[0].modelPath);
  let turns = 0, queuedWork = 0;
  const stored = await payload(entry);
  const budget = {expired: () => true, yield: () => new Promise(resolve => {
    turns++;
    setImmediate(() => {queuedWork++; resolve();});
  })};
  const decoded = await pipeline.decodeGeometry(stored.base, budget);
  const immediate = await pipeline.decodeGeometry(stored.base);
  try {
    assert.ok(turns > 10, 'a full model does not restore in one uninterrupted task');
    assert.equal(queuedWork, turns);
    assert.deepEqual(fingerprint(decoded), fingerprint(immediate));
  } finally {decoded.dispose(); immediate.dispose();}
});

test('wrong versions, presets, source identity, array types and truncated buffers are rejected', async () => {
  const entry = registry.models[0], original = await payload(entry), expected = registryEntryIdentity(entry);
  for (const change of [value => value.version++, value => value.sourceSha256 = 'wrong',
    value => value.generation = 'wrong', value => value.preset.outerOffset = .02,
    value => value.base.attributes.position.type = '__proto__',
    value => value.base.attributes.position.bytes = 'AA==']) {
    const value = structuredClone(original); change(value);
    await assert.rejects(() => pipeline.decodePreparedModel(value, expected));
  }
});

async function withLoaderIO(options, run) {
  const savedFetch = globalThis.fetch, savedLoad = THREE.FileLoader.prototype.load;
  const fetches = [], objLoads = [];
  preloader.clearCache();
  globalThis.fetch = async url => {
    fetches.push(url);
    const entry = registry.models.find(entry => assetUrl(entry.preparedPath) === url);
    assert.ok(entry, 'only the mapped release URL is requested');
    let bytes = await readFile(join(root, 'public', entry.preparedPath));
    if (options.corrupt) bytes = Buffer.from(bytes.toString().replace('Float32Array', 'Float64Array'));
    return new Response(bytes, {status:options.status || 200});
  };
  THREE.FileLoader.prototype.load = function(url, onLoad, onProgress, onError) {
    objLoads.push(url);
    const original = options.objSource || registry.models.find(entry => assetUrl(entry.sourcePath) === url)?.sourcePath;
    assert.ok(original, 'fallback source is explicit');
    readFile(join(root, 'public', original)).then(bytes => onLoad(this.responseType === 'arraybuffer'
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes.toString('utf8'))).catch(onError);
    return this;
  };
  try {await run({fetches, objLoads});}
  finally {globalThis.fetch = savedFetch; THREE.FileLoader.prototype.load = savedLoad; preloader.clearCache();}
}

test('concurrent default loads fill both caches without OBJ parsing or runtime outer generation', async () => {
  await withLoaderIO({}, async ({fetches, objLoads}) => {
    const path = assetUrl(registry.models[0].sourcePath);
    const [a, b] = await Promise.all([preloader.loadModel(path), preloader.loadModel(path)]);
    assert.equal(a, b); assert.equal(fetches.length, 1); assert.equal(objLoads.length, 0);
    const cachedOuter = preloader.offsetGeometryCache.get(path).get(JSON.stringify(baseline.preset));
    assert.ok(cachedOuter, 'outer was populated before the caller requests it');
    assert.equal(preloader.getOffsetGeometry(path, baseline.preset), cachedOuter);
    assert.equal(preloader.getOffsetGeometry(path, {outerOffset:.001}), cachedOuter);
    assert.equal(preloader.getOffsetGeometry(path, {smoothShading:true, creaseAngle:30,
      subdivisions:0, maxEdge:.15, outerOffset:.001}), cachedOuter);
    assert.deepEqual(fingerprint(a), baseline.models[0].base);
    assert.deepEqual(fingerprint(cachedOuter), baseline.models[0].outer);
    const custom = preloader.getOffsetGeometry(path, baseline.custom);
    assert.deepEqual(fingerprint(custom), baseline.models[0].custom);
    assert.equal(await preloader.loadModel(path), a); assert.equal(fetches.length, 1);
  });
});

test('missing and corrupt prepared data fall back to the original OBJ and geometry algorithm', async () => {
  for (const options of [{status:404}, {corrupt:true}]) {
    await withLoaderIO(options, async ({fetches, objLoads}) => {
      const path = assetUrl(registry.models[0].sourcePath);
      assert.deepEqual(fingerprint(await preloader.loadModel(path)), baseline.models[0].base);
      assert.deepEqual(fingerprint(preloader.getOffsetGeometry(path, baseline.preset)), baseline.models[0].outer);
      assert.equal(fetches.length, 1); assert.equal(objLoads.length, 1);
    });
  }
});

test('all delivered GLBs use prepared pairs and retain matching full source fallback for corrupt payloads or missing decompression', async () => {
  const saved = globalThis.DecompressionStream;
  try {
    for (const options of [{}, {corrupt:true}, {nativeDecompression:false}]) {
      await withLoaderIO(options, async ({fetches, objLoads}) => {
        for (const model of delivery.models) {
          const entry = registry.models.find(entry => entry.sourcePath === model.modelPath);
          const expected = await pipeline.decodePreparedModel(await payload(entry), registryEntryIdentity(entry));
          globalThis.DecompressionStream = options.nativeDecompression === false ? undefined : saved;
          try {
            const path = assetUrl(model.modelPath);
            assert.deepEqual(fingerprint(await preloader.loadModel(path)), fingerprint(expected.base), model.character);
            assert.deepEqual(fingerprint(preloader.getOffsetGeometry(path, baseline.preset)), fingerprint(expected.outer), model.character + ' outer');
          } finally {
            globalThis.DecompressionStream = saved;
            expected.base.dispose(); expected.outer.dispose();
          }
        }
        assert.equal(fetches.length, options.nativeDecompression === false ? 0 : 7);
        assert.equal(objLoads.length, options.corrupt || options.nativeDecompression === false ? 7 : 0);
      });
    }
  } finally {globalThis.DecompressionStream = saved;}
});

test('an external custom model with a shipped basename keeps its original loading path', async () => {
  await withLoaderIO({objSource:registry.models[0].sourcePath}, async ({fetches, objLoads}) => {
    const path = 'https://custom.example.invalid/models/001_空.obj';
    assert.deepEqual(fingerprint(await preloader.loadModel(path)), baseline.models[0].base);
    assert.deepEqual(fingerprint(preloader.getOffsetGeometry(path, baseline.custom)), baseline.models[0].custom);
    assert.equal(fetches.length, 0); assert.deepEqual(objLoads, [path]);
  });
});

test('browsers without native decompression use the original model without downloading prepared data', async () => {
  const saved = globalThis.DecompressionStream;
  try {
    globalThis.DecompressionStream = undefined;
    await withLoaderIO({}, async ({fetches, objLoads}) => {
      const path = assetUrl(registry.models[0].sourcePath);
      assert.deepEqual(fingerprint(await preloader.loadModel(path)), baseline.models[0].base);
      assert.deepEqual(fingerprint(preloader.getOffsetGeometry(path, baseline.preset)), baseline.models[0].outer);
      assert.equal(fetches.length, 0); assert.equal(objLoads.length, 1);
    });
  } finally {globalThis.DecompressionStream = saved;}
});

test('release preflight validates the complete source set, pipeline identity and payload hashes', async () => {
  const checked = await checkPreparedModels();
  assert.equal(checked.models, registry.models.length);
  assert.equal(checked.generation, registry.generation);
});
