import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {after, test} from 'node:test';
import * as THREE from 'three';
import {loadModelPipeline} from '../../deploy/prepare-models.mjs';
import {readDeliveryPair} from '../../deploy/prepare-model-delivery.mjs';
import {encodePreparedModelDelivery} from '../../deploy/lossless-model-codec.mjs';
import {fingerprintGeometry} from '../../deploy/model-fingerprint.mjs';
import {encodeDelivery} from '../../deploy/release-lib.mjs';

const pipeline = await loadModelPipeline();
after(() => pipeline.dispose());
const registry = JSON.parse(await readFile('src/components/jade/prepared-models.json'));
const baseline = JSON.parse(await readFile('test/runtime/fixtures/v2-75-geometry-baseline.json'));
const report = JSON.parse(await readFile('docs/model-assets/v2-75-lossless-delivery-20261024.json'));

test('all 75 selected payloads restore every original bit and never increase actual release wire bytes', async () => {
  assert.equal(report.models.length, 75);
  assert.equal(baseline.models.length, 75);
  for (const original of baseline.models) {
    const entry = registry.models.find(e => e.sourcePath === original.sourcePath);
    const metrics = report.models.find(e => e.sourcePath === original.sourcePath);
    const bytes = await readFile('public' + entry.preparedPath);
    const pair = await readDeliveryPair(entry, registry, pipeline, bytes);
    try {
      assert.deepEqual(fingerprintGeometry(pair.base), original.base, original.sourcePath + ' base');
      assert.deepEqual(fingerprintGeometry(pair.outer), original.outer, original.sourcePath + ' outer');
      assert.ok(encodeDelivery('assets', entry.preparedPath, bytes).bytes.length <= metrics.oldWireBytes);
    } finally {pair.base.dispose(); pair.outer.dispose();}
  }
});

function sample() {
  const base = new THREE.BufferGeometry();
  base.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0, 1, 2, 3, -0, 5, 6, 7, -0]), 3));
  base.setAttribute('uv', new THREE.BufferAttribute(new Float64Array([-0, 1, 2, 3, 4, 5]), 2));
  base.setAttribute('marker', new THREE.BufferAttribute(new Uint8ClampedArray([1, 128, 255]), 1, true));
  base.setIndex(new THREE.BufferAttribute(new Uint8Array([0, 1, 2]), 1));
  base.getAttribute('uv').name = 'full precision';
  base.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
  base.addGroup(0, 3, 2); base.setDrawRange(0, 3); base.name = 'typed'; base.userData = {fixture: true};
  base.computeBoundingBox(); base.computeBoundingSphere();
  const outer = base.clone();
  const identity = {generation: 'encoding-fixture', geometryGeneration: 'geometry-fixture',
    sourceSha256: 'source-fixture', preset: pipeline.PREPARED_MODEL_PRESET};
  return {base, outer, identity};
}

test('binary codec preserves negative zero, Float64 UV, integer arrays, metadata and non-indexed geometry', async () => {
  for (const indexed of [true, false]) {
    const input = sample();
    if (!indexed) {input.base.setIndex(null); input.outer.setIndex(null);}
    const encoded = encodePreparedModelDelivery(input);
    const pair = await pipeline.decodePreparedModelDelivery(encoded.bytes, input.identity);
    try {
      assert.deepEqual(fingerprintGeometry(pair.base), fingerprintGeometry(input.base));
      assert.deepEqual(fingerprintGeometry(pair.outer), fingerprintGeometry(input.outer));
      assert.ok(Object.is(pair.base.getAttribute('position').getX(0), -0));
      assert.ok(Object.is(pair.outer.getAttribute('uv').getX(0), -0));
    } finally {input.base.dispose(); input.outer.dispose(); pair.base.dispose(); pair.outer.dispose();}
  }
});

function mutateMetadata(bytes, change) {
  const size = bytes.readUInt32LE(8), metadata = JSON.parse(bytes.subarray(16, 16 + size));
  change(metadata);
  const json = Buffer.from(JSON.stringify(metadata)), header = Buffer.from(bytes.subarray(0, 16));
  header.writeUInt32LE(json.length, 8);
  return Buffer.concat([header, json, bytes.subarray(16 + size)]);
}

test('malformed metadata, mapping, lengths, checksums, versions and missing dependencies fail closed', async () => {
  const input = sample(), {bytes} = encodePreparedModelDelivery(input);
  try {
    const badHeader = Buffer.from(bytes); badHeader.writeUInt16LE(99, 4);
    const cases = [bytes.subarray(0, 10), bytes.subarray(0, bytes.length - 1), badHeader,
      mutateMetadata(bytes, m => m.base.attributes.position.type = '__proto__'),
      mutateMetadata(bytes, m => m.sections[0].rawBytes++),
      mutateMetadata(bytes, m => m.sections[0].payloadBytes = 64 * 1024 * 1024 + 1),
      mutateMetadata(bytes, m => m.sections[0].rawSha256 = '0'.repeat(64)),
      mutateMetadata(bytes, m => m.sections[1].id = m.sections[0].id),
      mutateMetadata(bytes, m => m.mapping.count++),
      mutateMetadata(bytes, m => m.mapping.sha256 = '0'.repeat(64)),
      mutateMetadata(bytes, m => m.outer.index = null),
      mutateMetadata(bytes, m => m.base.groups[0].start = -1),
      mutateMetadata(bytes, m => m.preset.outerOffset = .2)];
    for (const value of cases) await assert.rejects(() => pipeline.decodePreparedModelDelivery(value, input.identity));
    for (const key of ['generation', 'geometryGeneration', 'sourceSha256']) {
      await assert.rejects(() => pipeline.decodePreparedModelDelivery(bytes, {...input.identity, [key]: 'wrong'}));
    }
  } finally {input.base.dispose(); input.outer.dispose();}
});

test('chunk boundaries yield and an aborted restore never publishes a half pair', async () => {
  const input = sample(), {bytes} = encodePreparedModelDelivery(input);
  try {
    let boundaries = 0;
    const pair = await pipeline.decodePreparedModelDelivery(bytes, input.identity, {checkpoint: async () => {boundaries++;}});
    assert.ok(boundaries > 10); pair.base.dispose(); pair.outer.dispose();
    const controller = new AbortController(); let checks = 0;
    await assert.rejects(() => pipeline.decodePreparedModelDelivery(bytes, input.identity,
      {signal: controller.signal, checkpoint: async () => {if (++checks === 10) controller.abort();}}), {name: 'AbortError'});
  } finally {input.base.dispose(); input.outer.dispose();}
});
