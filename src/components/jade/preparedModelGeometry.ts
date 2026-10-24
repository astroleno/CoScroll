import * as THREE from 'three';

export const PREPARED_MODEL_VERSION = 1;
export const PREPARED_MODEL_PRESET = {
  outerOffset: 0.001, maxEdge: 0.15, subdivisions: 0, creaseAngle: 30, smoothShading: true,
} as const;

const arrayTypes = {
  Float32Array, Float64Array, Uint32Array, Uint16Array, Uint8Array,
  Int32Array, Int16Array, Int8Array, Uint8ClampedArray,
};

// Bound synchronous restoration work on the UI thread. This changes scheduling,
// not the format or any floating point bits. Offline preparation stays immediate.
function decodeBudget() {
  let deadline = typeof window === 'undefined' ? Infinity : performance.now() + 4;
  return {
    expired: () => performance.now() >= deadline,
    async yield() {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      deadline = performance.now() + 4;
    },
  };
}
type DecodeBudget = ReturnType<typeof decodeBudget>;

interface EncodedAttribute {
  type: keyof typeof arrayTypes;
  itemSize: number;
  normalized: boolean;
  name: string;
  usage: number;
  gpuType: number;
  encoding: 'gzip-xor-byte-planes';
  byteLength: number;
  bytes: string;
}

export interface EncodedGeometry {
  name: string;
  attributes: Record<string, EncodedAttribute>;
  index: EncodedAttribute | null;
  groups: THREE.BufferGeometry['groups'];
  drawRange: {start: number; count: number | null};
  boundingBox: EncodedAttribute | null;
  boundingSphere: EncodedAttribute | null;
  userData: Record<string, unknown>;
}

export interface PreparedModel {
  version: number;
  generation: string;
  sourceSha256: string;
  preset: typeof PREPARED_MODEL_PRESET;
  base: EncodedGeometry;
  outer: EncodedGeometry;
}

async function transformBytes(bytes: Uint8Array, codec: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([bytes.slice().buffer as ArrayBuffer]).stream().pipeThrough(codec);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function encodeAttribute(attribute: THREE.BufferAttribute): Promise<EncodedAttribute> {
  if (!(attribute instanceof THREE.BufferAttribute)) throw new Error('Prepared geometry requires non-interleaved attributes');
  const type = attribute.array.constructor.name as EncodedAttribute['type'];
  if (!Object.prototype.hasOwnProperty.call(arrayTypes, type)) throw new Error('Unsupported geometry array');
  const bytes = new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
  const width = attribute.array.BYTES_PER_ELEMENT, count = bytes.length / width;
  const predicted = new Uint8Array(bytes.length);
  // Lossless component prediction and byte planes improve compression of full precision floats.
  for (let lane = 0; lane < width; lane++) {
    for (let i = 0; i < count; i++) {
      predicted[lane * count + i] = bytes[i * width + lane] ^
        (i >= attribute.itemSize ? bytes[(i - attribute.itemSize) * width + lane] : 0);
    }
  }
  const compressed = await transformBytes(predicted, new CompressionStream('gzip'));
  // Chunking avoids spread argument limits without altering any floating point bits.
  let binary = '';
  for (let offset = 0; offset < compressed.length; offset += 0x8000) {
    binary += String.fromCharCode(...Array.from(compressed.subarray(offset, offset + 0x8000)));
  }
  return {type, itemSize: attribute.itemSize, normalized: attribute.normalized, name: attribute.name,
    usage: attribute.usage, gpuType: attribute.gpuType, encoding: 'gzip-xor-byte-planes', byteLength: bytes.length, bytes: btoa(binary)};
}

async function decodeAttribute(value: EncodedAttribute, budget: DecodeBudget): Promise<THREE.BufferAttribute> {
  if (!value || !Object.prototype.hasOwnProperty.call(arrayTypes, value.type) ||
      !Number.isSafeInteger(value.itemSize) || value.itemSize < 1 || value.itemSize > 16 ||
      typeof value.normalized !== 'boolean' || typeof value.bytes !== 'string' ||
      value.encoding !== 'gzip-xor-byte-planes' || !Number.isSafeInteger(value.byteLength) || value.byteLength < 1) {
    throw new Error('Invalid prepared geometry attribute');
  }
  const ArrayType = arrayTypes[value.type];
  const binary = atob(value.bytes);
  const compressed = new Uint8Array(binary.length);
  for (let start = 0; start < binary.length; start += 16384) {
    const end = Math.min(start + 16384, binary.length);
    for (let i = start; i < end; i++) compressed[i] = binary.charCodeAt(i);
    if (budget.expired()) await budget.yield();
  }
  const predicted = await transformBytes(compressed, new DecompressionStream('gzip'));
  const width = ArrayType.BYTES_PER_ELEMENT, count = predicted.length / width;
  if (predicted.length !== value.byteLength || predicted.length % (width * value.itemSize)) {
    throw new Error('Invalid prepared geometry byte length');
  }
  const bytes = new Uint8Array(predicted.length);
  for (let lane = 0; lane < width; lane++) {
    for (let start = 0; start < count; start += 16384) {
      const end = Math.min(start + 16384, count);
      for (let i = start; i < end; i++) {
        bytes[i * width + lane] = predicted[lane * count + i] ^
          (i >= value.itemSize ? bytes[(i - value.itemSize) * width + lane] : 0);
      }
      if (budget.expired()) await budget.yield();
    }
  }
  const attribute = new THREE.BufferAttribute(new ArrayType(bytes.buffer), value.itemSize, value.normalized);
  attribute.name = value.name;
  attribute.setUsage(value.usage as THREE.Usage);
  attribute.gpuType = value.gpuType as typeof attribute.gpuType;
  return attribute;
}

/** Lossless, deterministic storage: no quantization, simplification or UUIDs. */
export async function encodeGeometry(geometry: THREE.BufferGeometry): Promise<EncodedGeometry> {
  if (Object.keys(geometry.morphAttributes).length || geometry.morphTargetsRelative) {
    throw new Error('Prepared OBJ geometry cannot contain morph targets');
  }
  return {
    name: geometry.name,
    attributes: Object.fromEntries(await Promise.all(Object.keys(geometry.attributes).sort()
      .map(async name => [name, await encodeAttribute(geometry.getAttribute(name) as THREE.BufferAttribute)]))),
    index: geometry.index ? await encodeAttribute(geometry.index) : null,
    groups: geometry.groups.map(group => ({...group})),
    drawRange: {start: geometry.drawRange.start, count: Number.isFinite(geometry.drawRange.count) ? geometry.drawRange.count : null},
    boundingBox: geometry.boundingBox ? await encodeAttribute(new THREE.BufferAttribute(new Float64Array([
      ...geometry.boundingBox.min.toArray(), ...geometry.boundingBox.max.toArray(),
    ]), 3)) : null,
    boundingSphere: geometry.boundingSphere ? await encodeAttribute(new THREE.BufferAttribute(new Float64Array([
      ...geometry.boundingSphere.center.toArray(), geometry.boundingSphere.radius,
    ]), 4)) : null,
    userData: geometry.userData,
  };
}

export async function decodeGeometry(value: EncodedGeometry, budget = decodeBudget()): Promise<THREE.BufferGeometry> {
  if (!value?.attributes || !value.attributes.position || !Array.isArray(value.groups) || !value.drawRange) {
    throw new Error('Invalid prepared geometry');
  }
  const geometry = new THREE.BufferGeometry();
  try {
    for (const [name, attribute] of Object.entries(value.attributes)) geometry.setAttribute(name, await decodeAttribute(attribute, budget));
    const count = geometry.getAttribute('position').count;
    if (geometry.getAttribute('position').itemSize !== 3 || Object.values(geometry.attributes).some(attribute => attribute.count !== count)) {
      throw new Error('Mismatched prepared geometry attributes');
    }
    if (value.index) {
      if (!['Uint16Array', 'Uint32Array', 'Uint8Array'].includes(value.index.type) || value.index.itemSize !== 1) {
        throw new Error('Invalid prepared geometry index');
      }
      geometry.setIndex(await decodeAttribute(value.index, budget));
    }
    geometry.name = value.name;
    geometry.groups = value.groups.map(group => ({...group}));
    geometry.setDrawRange(value.drawRange.start, value.drawRange.count === null ? Infinity : value.drawRange.count);
    if (value.boundingBox) {
      const box = await decodeAttribute(value.boundingBox, budget);
      if (box.itemSize !== 3 || box.count !== 2) throw new Error('Invalid prepared bounding box');
      geometry.boundingBox = new THREE.Box3(new THREE.Vector3().fromArray(box.array), new THREE.Vector3().fromArray(box.array, 3));
    }
    if (value.boundingSphere) {
      const sphere = await decodeAttribute(value.boundingSphere, budget);
      if (sphere.itemSize !== 4 || sphere.count !== 1) throw new Error('Invalid prepared bounding sphere');
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3().fromArray(sphere.array), sphere.array[3]);
    }
    geometry.userData = value.userData;
    return geometry;
  } catch (error) {
    geometry.dispose();
    throw error;
  }
}

export async function decodePreparedModel(value: PreparedModel, expected: {generation: string; sourceSha256: string},
  options: {signal?: AbortSignal} = {}) {
  if (value?.version !== PREPARED_MODEL_VERSION || value.generation !== expected.generation ||
      value.sourceSha256 !== expected.sourceSha256 || Object.entries(PREPARED_MODEL_PRESET)
        .some(([key, setting]) => value.preset?.[key] !== setting)) {
    throw new Error('Prepared model version, source or preset mismatch');
  }
  const clock = decodeBudget();
  const budget = {
    expired() {options.signal?.throwIfAborted(); return clock.expired();},
    async yield() {options.signal?.throwIfAborted(); await clock.yield(); options.signal?.throwIfAborted();},
  };
  options.signal?.throwIfAborted();
  const base = await decodeGeometry(value.base, budget);
  try {
    return {base, outer: await decodeGeometry(value.outer, budget)};
  } catch (error) {
    base.dispose();
    throw error;
  }
}
