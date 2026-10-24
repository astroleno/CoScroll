import * as THREE from 'three';
import {PREPARED_MODEL_PRESET} from './preparedModelGeometry';

const types = {Float32Array, Float64Array, Uint32Array, Uint16Array, Uint8Array,
  Int32Array, Int16Array, Int8Array, Uint8ClampedArray};
const codecs = new Set(['gzip', 'gzip-xor-byte-planes', 'gzip-cross-xor',
  'gzip-cross-xor-byte-planes', 'gzip-cross-sub', 'gzip-cross-sub-byte-planes']);
const MAX_BYTES = 64 * 1024 * 1024;
const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
const integer = (n: number, max = MAX_BYTES) => Number.isSafeInteger(n) && n >= 0 && n <= max;
interface Attribute {
  section: string; type: keyof typeof types; itemSize: number; normalized: boolean;
  name: string; usage: number; gpuType: number;
}
interface Section {id: string; codec: string; storedBytes: number; payloadBytes: number; rawBytes: number; rawSha256: string; offset: number}
interface Geometry {
  name: string; attributes: Record<string, Attribute>; index: Attribute | null;
  groups: THREE.BufferGeometry['groups']; drawRange: {start: number; count: number | null};
  boundingBox: Attribute | null; boundingSphere: Attribute | null;
  userData: Record<string, unknown>; morphTargetsRelative: boolean;
}
interface Metadata {
  format: string; version: number; generation: string; geometryGeneration: string;
  sourceSha256: string; preset: typeof PREPARED_MODEL_PRESET;
  mapping: {mode: 'triangle-corner' | 'none'; count: number; sha256: string | null};
  sections: Section[]; base: Geometry; outer: Geometry;
}
export interface DeliveryIdentity {generation: string; geometryGeneration?: string; sourceSha256: string}
export interface DeliveryDecodeOptions {signal?: AbortSignal; checkpoint?: () => Promise<void>}

export function inspectPreparedModelDelivery(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 16 || bytes.byteLength > MAX_BYTES ||
      String.fromCharCode(...Array.from(bytes.subarray(0, 4))) !== 'CSB2') throw new Error('Invalid binary model header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = view.getUint32(8, true), count = view.getUint32(12, true);
  if (view.getUint16(4, true) !== 2 || view.getUint16(6, true) !== 0 ||
      length < 2 || length > 1024 * 1024 || 16 + length > bytes.length || count < 1 || count > 512) {
    throw new Error('Unsupported binary model version or metadata');
  }
  const metadata: Metadata = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(16, 16 + length)));
  if (metadata?.format !== 'coscroll-prepared-binary' || metadata.version !== 2 ||
      !Array.isArray(metadata.sections) || metadata.sections.length !== count ||
      !['none', 'triangle-corner'].includes(metadata.mapping?.mode)) throw new Error('Invalid binary model identity');
  let offset = 16 + length, totalRaw = 0;
  const sections = new Map<string, Section>();
  for (const section of metadata.sections) {
    if (!section || typeof section.id !== 'string' || sections.has(section.id) || !codecs.has(section.codec) ||
        !integer(section.storedBytes) || !section.storedBytes || !integer(section.payloadBytes) || !section.payloadBytes ||
        !integer(section.rawBytes) || !section.rawBytes || !/^[a-f0-9]{64}$/.test(section.rawSha256) ||
        offset + section.storedBytes > bytes.length) throw new Error('Invalid binary model section');
    sections.set(section.id, {...section, offset}); offset += section.storedBytes;
    totalRaw += section.rawBytes;
  }
  if (offset !== bytes.length || totalRaw > MAX_BYTES) throw new Error('Binary model length mismatch');
  return {bytes, metadata, sections};
}

/** Restore full original bit patterns. Only the current attribute has a temporary prediction buffer. */
export async function decodePreparedModelDelivery(input: ArrayBuffer | Uint8Array, expected: DeliveryIdentity,
  options: DeliveryDecodeOptions = {}): Promise<{base: THREE.BufferGeometry; outer: THREE.BufferGeometry}> {
  const {bytes, metadata, sections} = inspectPreparedModelDelivery(input);
  if (metadata.generation !== expected.generation || metadata.sourceSha256 !== expected.sourceSha256 ||
      (expected.geometryGeneration !== undefined && metadata.geometryGeneration !== expected.geometryGeneration) ||
      Object.entries(PREPARED_MODEL_PRESET).some(([key, value]) => metadata.preset?.[key] !== value)) {
    throw new Error('Binary model generation, source or preset mismatch');
  }
  let deadline = typeof window === 'undefined' ? Infinity : performance.now() + 4;
  async function checkpoint() {
    options.signal?.throwIfAborted();
    if (options.checkpoint) await options.checkpoint();
    else if (performance.now() >= deadline) {
      await new Promise<void>(resolve => setTimeout(resolve, 0)); deadline = performance.now() + 4;
    }
    options.signal?.throwIfAborted();
  }
  const used = new Set<string>();
  function sectionFor(ref: Attribute) {
    if (!ref || !own(types, ref.type) || !integer(ref.itemSize, 16) || ref.itemSize < 1 ||
        typeof ref.normalized !== 'boolean' || typeof ref.name !== 'string' ||
        !integer(ref.usage) || !integer(ref.gpuType) || !sections.has(ref.section) || used.has(ref.section)) {
      throw new Error('Invalid binary model attribute');
    }
    const section = sections.get(ref.section)!;
    if (section.rawBytes % (types[ref.type].BYTES_PER_ELEMENT * ref.itemSize)) throw new Error('Invalid attribute shape');
    used.add(ref.section);
    return section;
  }
  async function inflate(section: Section) {
    // Blob accepts the existing section view; avoid first cloning the entire input.
    const stored = bytes.subarray(section.offset, section.offset + section.storedBytes);
    const reader = new Blob([stored as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const output = new Uint8Array(section.payloadBytes);
    let offset = 0;
    try {
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        if (offset + value.byteLength > output.length) throw new Error('Expanded binary section exceeds declared length');
        output.set(value, offset); offset += value.byteLength; await checkpoint();
      }
    } catch (error) {await reader.cancel().catch(() => {}); throw error;}
    finally {reader.releaseLock();}
    if (offset !== output.length) throw new Error('Expanded binary section length mismatch');
    return output;
  }
  async function restorePlanes(predicted: Uint8Array, itemSize: number, width: number) {
    const count = predicted.length / width;
    if (!Number.isSafeInteger(count)) throw new Error('Invalid byte planes');
    const raw = new Uint8Array(predicted.length);
    for (let lane = 0; lane < width; lane++) {
      for (let start = 0; start < count; start += 16384) {
        const end = Math.min(count, start + 16384);
        for (let i = start; i < end; i++) raw[i * width + lane] = predicted[lane * count + i] ^
          (i >= itemSize ? raw[(i - itemSize) * width + lane] : 0);
        await checkpoint();
      }
    }
    return raw;
  }
  const hash = async (data: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource)))
    .map(n => n.toString(16).padStart(2, '0')).join('');
  type IndexArray = Uint8Array | Uint16Array | Uint32Array;
  async function attribute(ref: Attribute, context: {base?: THREE.BufferAttribute; mapping?: Uint32Array; index?: IndexArray} = {}) {
    const section = sectionFor(ref), ArrayType = types[ref.type], width = ArrayType.BYTES_PER_ELEMENT;
    let raw = await inflate(section);
    if (section.codec.endsWith('byte-planes')) raw = await restorePlanes(raw, ref.itemSize,
      section.codec.startsWith('gzip-cross-sub') ? 4 : width);
    if (section.codec.startsWith('gzip-cross-xor')) {
      const base = context.base, map = context.mapping;
      if (!base || !map || base.array.constructor.name !== ref.type || base.itemSize !== ref.itemSize) {
        throw new Error('Cross-layer attribute predictor missing');
      }
      const stride = width * ref.itemSize;
      const source = new Uint8Array(base.array.buffer, base.array.byteOffset, base.array.byteLength);
      if (raw.length !== map.length * stride) throw new Error('Cross-layer mapping length mismatch');
      for (let start = 0; start < map.length; start += 4096) {
        const end = Math.min(map.length, start + 4096);
        for (let i = start; i < end; i++) {
          if (map[i] >= base.count) throw new Error('Cross-layer mapping out of range');
          for (let c = 0; c < stride; c++) raw[i * stride + c] ^= source[map[i] * stride + c];
        }
        await checkpoint();
      }
    } else if (section.codec.startsWith('gzip-cross-sub')) {
      if (!context.index || !['Uint8Array', 'Uint16Array', 'Uint32Array'].includes(ref.type) || ref.itemSize !== 1 ||
          raw.length !== context.index.length * 4 || section.rawBytes !== context.index.length * width) {
        throw new Error('Cross-layer index predictor mismatch');
      }
      const residual = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const output = new Uint8Array(section.rawBytes), values = new DataView(output.buffer);
      const max = width === 1 ? 255 : width === 2 ? 65535 : 0xffffffff;
      for (let start = 0; start < context.index.length; start += 16384) {
        const end = Math.min(context.index.length, start + 16384);
        for (let i = start; i < end; i++) {
          const value = (context.index[i] + residual.getUint32(i * 4, true)) >>> 0;
          if (value > max) throw new Error('Restored index exceeds array width');
          if (width === 1) values.setUint8(i, value);
          else if (width === 2) values.setUint16(i * 2, value, true);
          else values.setUint32(i * 4, value, true);
        }
        await checkpoint();
      }
      raw = output;
    }
    if (raw.length !== section.rawBytes || await hash(raw) !== section.rawSha256) throw new Error('Restored binary attribute integrity mismatch');
    await checkpoint();
    const value = new THREE.BufferAttribute(new ArrayType(raw.buffer, raw.byteOffset, raw.byteLength / width), ref.itemSize, ref.normalized);
    value.name = ref.name; value.setUsage(ref.usage as THREE.Usage); value.gpuType = ref.gpuType as typeof value.gpuType;
    return value;
  }
  async function readIndex(ref: Attribute | null, vertices: number, base?: IndexArray) {
    if (!ref) return null;
    if (!['Uint8Array', 'Uint16Array', 'Uint32Array'].includes(ref.type) || ref.itemSize !== 1) throw new Error('Invalid binary index');
    const value = await attribute(ref, {index: base}), values = value.array as IndexArray;
    if (values.length % 3) throw new Error('Incomplete triangle sequence');
    for (let start = 0; start < values.length; start += 16384) {
      const end = Math.min(values.length, start + 16384);
      for (let i = start; i < end; i++) if (values[i] >= vertices) throw new Error('Binary index outside vertex domain');
      await checkpoint();
    }
    return value;
  }
  function vertexCount(value: Geometry) {
    const ref = value?.attributes?.position;
    if (!ref || !own(types, ref.type) || ref.itemSize !== 3 || !sections.has(ref.section)) throw new Error('Missing binary position');
    const count = sections.get(ref.section)!.rawBytes / (types[ref.type].BYTES_PER_ELEMENT * 3);
    if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid binary vertex count');
    return count;
  }
  async function geometry(value: Geometry, index: THREE.BufferAttribute | null, base?: THREE.BufferGeometry, mapping?: Uint32Array) {
    const result = new THREE.BufferGeometry(), count = vertexCount(value);
    try {
      for (const [name, ref] of Object.entries(value.attributes)) {
        const restored = await attribute(ref, {base: base?.getAttribute(name) as THREE.BufferAttribute, mapping});
        if (restored.count !== count) throw new Error('Mismatched binary geometry attributes');
        result.setAttribute(name, restored);
      }
      if (!Array.isArray(value.groups) || !value.drawRange || !integer(value.drawRange.start) ||
          (value.drawRange.count !== null && !integer(value.drawRange.count)) ||
          typeof value.name !== 'string' || !value.userData || typeof value.userData !== 'object' ||
          typeof value.morphTargetsRelative !== 'boolean') throw new Error('Invalid binary geometry metadata');
      for (const group of value.groups) {
        if (!integer(group.start) || !integer(group.count) ||
            (group.materialIndex !== undefined && !integer(group.materialIndex))) throw new Error('Invalid binary geometry group');
      }
      result.setIndex(index); result.name = value.name; result.groups = value.groups.map(g => ({...g}));
      result.setDrawRange(value.drawRange.start, value.drawRange.count ?? Infinity);
      if (value.boundingBox) {
        if (value.boundingBox.type !== 'Float64Array' || value.boundingBox.itemSize !== 3) throw new Error('Invalid binary box type');
        const box = await attribute(value.boundingBox);
        if (box.count !== 2) throw new Error('Invalid binary box count');
        result.boundingBox = new THREE.Box3(new THREE.Vector3().fromArray(box.array), new THREE.Vector3().fromArray(box.array, 3));
      }
      if (value.boundingSphere) {
        if (value.boundingSphere.type !== 'Float64Array' || value.boundingSphere.itemSize !== 4) throw new Error('Invalid binary sphere type');
        const sphere = await attribute(value.boundingSphere);
        if (sphere.count !== 1) throw new Error('Invalid binary sphere count');
        result.boundingSphere = new THREE.Sphere(new THREE.Vector3().fromArray(sphere.array), sphere.array[3]);
      }
      result.userData = value.userData; result.morphTargetsRelative = value.morphTargetsRelative;
      return result;
    } catch (error) {result.dispose(); throw error;}
  }
  await checkpoint();
  const baseIndex = await readIndex(metadata.base.index, vertexCount(metadata.base));
  const base = await geometry(metadata.base, baseIndex);
  let outer: THREE.BufferGeometry | undefined;
  try {
    const count = vertexCount(metadata.outer);
    const outerIndex = await readIndex(metadata.outer.index, count, baseIndex?.array as IndexArray);
    let mapping: Uint32Array | undefined;
    if (metadata.mapping.mode === 'triangle-corner') {
      if (!baseIndex || !outerIndex || baseIndex.count !== outerIndex.count || metadata.mapping.count !== count) {
        throw new Error('Invalid triangle-corner mapping');
      }
      mapping = new Uint32Array(count).fill(0xffffffff);
      const bases = baseIndex.array, outers = outerIndex.array;
      for (let start = 0; start < outerIndex.count; start += 16384) {
        const end = Math.min(outerIndex.count, start + 16384);
        for (let i = start; i < end; i++) {
          if (mapping[outers[i]] === 0xffffffff) mapping[outers[i]] = bases[i];
          else if (mapping[outers[i]] !== bases[i]) throw new Error('Conflicting triangle-corner mapping');
        }
        await checkpoint();
      }
      for (let start = 0; start < mapping.length; start += 16384) {
        const end = Math.min(mapping.length, start + 16384);
        for (let i = start; i < end; i++) if (mapping[i] === 0xffffffff) throw new Error('Incomplete triangle-corner mapping');
        await checkpoint();
      }
      if (await hash(new Uint8Array(mapping.buffer)) !== metadata.mapping.sha256) throw new Error('Mapping integrity mismatch');
    } else if (metadata.mapping.count !== 0) throw new Error('Invalid empty triangle-corner mapping');
    outer = await geometry(metadata.outer, outerIndex, base, mapping);
    if (used.size !== sections.size) throw new Error('Unreferenced binary model sections');
    await checkpoint();
    return {base, outer};
  } catch (error) {base.dispose(); outer?.dispose(); throw error;}
}
