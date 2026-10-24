import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { loadModelPipeline } from '../../deploy/prepare-models.mjs';
import { loadPreloaderModule } from './model-modules.mjs';

const pipeline = await loadModelPipeline();
let ModelPreloader;
try {
  ({ ModelPreloader } = await loadPreloaderModule(pipeline.directory));
} finally {
  await pipeline.dispose();
}

const MIB = 1024 * 1024;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function trackDisposals(geometry, name, counts) {
  const dispose = geometry.dispose.bind(geometry);
  geometry.dispose = () => {
    counts.set(name, (counts.get(name) || 0) + 1);
    dispose();
  };
  return geometry;
}

function geometryOfBytes(bytes, name, counts) {
  const geometry = new THREE.BufferGeometry();
  const values = new Float32Array(Math.max(3, Math.ceil(bytes / 4)));
  geometry.setAttribute('position', new THREE.BufferAttribute(values, 3));
  return trackDisposals(geometry, name, counts);
}

function uniqueGeometryBytes(...geometries) {
  const buffers = new Set();
  for (const geometry of geometries) {
    if (!geometry) continue;
    const add = attribute => {
      if (!attribute) return;
      const array = attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array;
      buffers.add(array.buffer);
    };
    add(geometry.index);
    for (const attribute of Object.values(geometry.attributes)) add(attribute);
  }
  let total = 0;
  for (const buffer of buffers) total += buffer.byteLength;
  return total;
}

function triangleGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
  ]), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]), 3));
  return geometry;
}

test('idle model count uses LRU and a genuine read refreshes recency', async () => {
  const loader = new ModelPreloader();
  loader.loadModelFromFile = async path => geometryOfBytes(4, path, new Map());
  for (let index = 0; index < 10; index++) await loader.loadModel(`/model-${index}.obj`);
  loader.trimCache();
  assert.equal(loader.getCacheStatus().idleModels, 8);
  assert.equal(loader.getCacheStatus().loaded, 8);
  assert.equal(loader.isModelLoaded('/model-0.obj'), false);
  assert.equal(loader.isModelLoaded('/model-1.obj'), false);
  assert.equal(loader.isModelLoaded('/model-9.obj'), true);

  await loader.loadModel('/model-2.obj');
  await loader.loadModel('/model-10.obj');
  loader.trimCache();
  assert.equal(loader.isModelLoaded('/model-2.obj'), true);
  assert.equal(loader.isModelLoaded('/model-3.obj'), false);
  assert.equal(loader.getCacheStatus().idleModels, 8);
});

test('idle geometry bytes respect the 8 MiB ceiling and the exact boundary', async () => {
  const loader = new ModelPreloader();
  const counts = new Map();
  loader.loadModelFromFile = async path => geometryOfBytes({
    '/large-a.obj': 3 * MIB, '/large-b.obj': 3 * MIB, '/large-c.obj': 3 * MIB,
    '/small.obj': 1 * MIB,
  }[path], path, counts);
  for (const path of ['/large-a.obj', '/large-b.obj', '/large-c.obj', '/small.obj']) {
    await loader.loadModel(path);
  }
  loader.trimCache();
  const status = loader.getCacheStatus();
  assert.ok(status.idleBytes <= 8 * MIB);
  assert.equal(status.idleModels, 3);
  assert.equal(loader.isModelLoaded('/large-a.obj'), false);
  assert.equal(loader.isModelLoaded('/large-b.obj'), true);
  assert.equal(loader.isModelLoaded('/large-c.obj'), true);
  assert.equal(loader.isModelLoaded('/small.obj'), true);
  assert.equal(counts.get('/large-a.obj'), 1);

  const boundary = new ModelPreloader();
  boundary.loadModelFromFile = async path => geometryOfBytes(2 * MIB, path, new Map());
  for (let index = 0; index < 4; index++) await boundary.loadModel(`/boundary-${index}.obj`);
  boundary.trimCache();
  assert.equal(boundary.getCacheStatus().idleBytes, 8 * MIB);
  assert.equal(boundary.getCacheStatus().idleModels, 4);
  assert.equal(boundary.getCacheStatus().loaded, 4);
});

test('bytes count unique ArrayBuffers, indices, interleaved data, and aliases once', async () => {
  const loader = new ModelPreloader();
  const shared = new Float32Array(64 * 1024);
  shared.fill(7);
  const snapshot = shared.slice();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(shared, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(shared, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(1024), 1));
  loader.addToCache('/shared.obj', geometry);

  const interleaved = new THREE.InterleavedBuffer(new Float32Array(3000), 3);
  const interleavedGeometry = new THREE.BufferGeometry();
  interleavedGeometry.setAttribute('position', new THREE.InterleavedBufferAttribute(interleaved, 3, 0));
  loader.addToCache('/interleaved.obj', interleavedGeometry);

  loader.trimCache();
  const status = loader.getCacheStatus();
  assert.equal(status.idleBytes, shared.byteLength + 1024 * 4 + interleaved.array.byteLength);
  assert.equal(status.residentBytes, status.idleBytes);
  assert.deepEqual(shared, snapshot);
});

test('same-geometry aliases are counted once and disposed exactly once', async () => {
  const loader = new ModelPreloader();
  const counts = new Map();
  const alias = geometryOfBytes(128 * 1024, 'alias', counts);
  loader.loadModelFromFile = async () => alias;
  await loader.loadModel('/alias-a.obj');
  await loader.loadModel('/alias-b.obj');
  loader.trimCache();
  const status = loader.getCacheStatus();
  assert.equal(status.idleModels, 2);
  assert.equal(status.idleBytes, uniqueGeometryBytes(alias));
  assert.equal(status.residentBytes, status.idleBytes);
  assert.equal(counts.get('alias'), undefined);

  loader.clearCache();
  assert.equal(counts.get('alias'), 1);
  assert.equal(loader.getCacheStatus().loaded, 0);
});

test('outer parameter variants are counted and released with their evicted entry', async () => {
  const loader = new ModelPreloader();
  const counts = new Map();
  const base = triangleGeometry();
  trackDisposals(base, 'base', counts);
  loader.loadModelFromFile = async () => base;
  await loader.loadModel('/variants.obj');

  const first = loader.getOffsetGeometry('/variants.obj', {
    outerOffset: 0.001, maxEdge: 0, subdivisions: 0, creaseAngle: 90, smoothShading: false,
  });
  const second = loader.getOffsetGeometry('/variants.obj', {
    outerOffset: 0.002, maxEdge: 0, subdivisions: 0, creaseAngle: 90, smoothShading: false,
  });
  assert.ok(first && second && first !== second && first !== base && second !== base);
  trackDisposals(first, 'outer-1', counts);
  trackDisposals(second, 'outer-2', counts);

  loader.trimCache();
  const status = loader.getCacheStatus();
  assert.equal(status.idleBytes, uniqueGeometryBytes(base, first, second));
  assert.equal(status.residentBytes, status.idleBytes);

  for (let index = 0; index < 8; index++) {
    loader.addToCache(`/later-${index}.obj`, geometryOfBytes(4, `/later-${index}.obj`, counts));
  }
  loader.trimCache();
  assert.equal(loader.isModelLoaded('/variants.obj'), false);
  assert.equal(counts.get('base'), 1);
  assert.equal(counts.get('outer-1'), 1);
  assert.equal(counts.get('outer-2'), 1);
});

test('active target, old visible and next owners stay resident beyond the idle budget', async () => {
  const loader = new ModelPreloader();
  const counts = new Map();
  loader.loadModelFromFile = async path => geometryOfBytes(3 * MIB, path, counts);
  const releaseTarget = loader.retainPaths(['/target.obj']);
  const releaseVisible = loader.retainPaths(['/visible.obj']);
  const releaseNext = loader.retainPaths(['/next.obj']);
  for (const path of ['/target.obj', '/visible.obj', '/next.obj']) await loader.loadModel(path);
  for (let index = 0; index < 4; index++) await loader.loadModel(`/idle-${index}.obj`);

  loader.trimCache();
  let status = loader.getCacheStatus();
  assert.equal(loader.isModelLoaded('/target.obj'), true);
  assert.equal(loader.isModelLoaded('/visible.obj'), true);
  assert.equal(loader.isModelLoaded('/next.obj'), true);
  assert.ok(status.idleModels <= 8);
  assert.ok(status.idleBytes <= 8 * MIB);
  assert.ok(status.residentBytes >= 9 * MIB);
  assert.equal(counts.get('/target.obj'), undefined);

  releaseNext();
  loader.trimCache();
  status = loader.getCacheStatus();
  assert.equal(status.idleModels, 2);
  assert.equal(loader.isModelLoaded('/next.obj'), false);
  assert.equal(counts.get('/next.obj'), 1);
  assert.equal(loader.isModelLoaded('/target.obj'), true);
  assert.equal(loader.isModelLoaded('/visible.obj'), true);
  assert.ok(status.idleBytes <= 8 * MIB);
  releaseVisible();
  releaseTarget();
  loader.clearCache();
});

test('clear preserves active owners, disposes idle entries once, and fences in-flight requests', async () => {
  const loader = new ModelPreloader();
  const counts = new Map();
  let lateResolve;
  let lateDownloads = 0;
  loader.loadModelFromFile = async path => {
    if (path === '/late.obj') {
      lateDownloads++;
      return new Promise(resolve => { lateResolve = resolve; });
    }
    return geometryOfBytes(1 * MIB, path, counts);
  };
  const releaseActive = loader.retainPaths(['/active.obj']);
  await loader.loadModel('/active.obj');
  await loader.loadModel('/idle-a.obj');
  await loader.loadModel('/idle-b.obj');
  loader.trimCache();

  const firstWait = loader.loadModel('/late.obj');
  const dedupedWait = loader.loadModel('/late.obj');
  const aborted = Promise.all([assert.rejects(firstWait, {name: 'AbortError'}),
    assert.rejects(dedupedWait, {name: 'AbortError'})]);
  assert.equal(lateDownloads, 1);
  loader.clearCache();
  assert.equal(loader.isModelLoaded('/active.obj'), true);
  assert.equal(loader.isModelLoaded('/idle-a.obj'), false);
  assert.equal(loader.isModelLoaded('/idle-b.obj'), false);
  assert.equal(counts.get('/idle-a.obj'), 1);
  assert.equal(counts.get('/idle-b.obj'), 1);
  assert.equal(counts.get('/active.obj'), undefined);
  assert.equal(loader.getCacheStatus().loaded, 1);

  const lateGeometry = geometryOfBytes(2 * MIB, 'late', counts);
  lateResolve(lateGeometry);
  await aborted;
  await settle();
  loader.trimCache();
  assert.equal(loader.isModelLoaded('/late.obj'), false);
  assert.equal(counts.get('late'), 1, 'cleared unpublished result is disposed, rather than detached');
  assert.equal(loader.getCacheStatus().loaded, 1);

  loader.loadModelFromFile = async path => {
    if (path === '/late.obj') lateDownloads++;
    return geometryOfBytes(2 * MIB, path, counts);
  };
  await loader.loadModel('/late.obj');
  assert.equal(lateDownloads, 2);
  loader.trimCache();
  assert.equal(loader.isModelLoaded('/late.obj'), true);

  releaseActive();
  loader.clearCache();
  assert.equal(counts.get('/active.obj'), 1);
  assert.equal(counts.get('/late.obj'), 1);
  assert.equal(loader.getCacheStatus().loaded, 0);
});

test('late completion is reconciled by the automatic trim', async () => {
  const loader = new ModelPreloader();
  for (let index = 0; index < 7; index++) {
    loader.loadModelFromFile = async () => geometryOfBytes(1 * MIB, `early-${index}`, new Map());
    await loader.loadModel(`/early-${index}.obj`);
  }
  let lateResolve;
  loader.loadModelFromFile = () => new Promise(resolve => { lateResolve = resolve; });
  const pending = loader.loadModel('/late-large.obj');
  lateResolve(geometryOfBytes(4 * MIB, 'late-large', new Map()));
  await pending;
  await settle();
  const status = loader.getCacheStatus();
  assert.ok(status.idleModels <= 8);
  assert.ok(status.idleBytes <= 8 * MIB);
  assert.equal(status.residentBytes, status.idleBytes);
  assert.equal(loader.isModelLoaded('/late-large.obj'), true);
});

test('a failed synthetic geometry request is retried instead of returning a dead cache entry', async () => {
  const loader = new ModelPreloader();
  const counts = new Map();
  let attempts = 0;
  loader.loadModelFromFile = async path => {
    if (++attempts === 1) throw new Error('temporary geometry failure');
    return geometryOfBytes(64 * 1024, path, counts);
  };
  await assert.rejects(loader.loadModel('/retry.obj'), /temporary geometry failure/);
  assert.equal(loader.isModelLoaded('/retry.obj'), false);
  const geometry = await loader.loadModel('/retry.obj');
  assert.equal(attempts, 2);
  loader.trimCache();
  assert.equal(loader.isModelLoaded('/retry.obj'), true);
  assert.equal(loader.getModel('/retry.obj'), geometry);
  assert.equal(loader.getCacheStatus().idleBytes, uniqueGeometryBytes(geometry));
});
