import * as THREE from 'three';

export const PREPARED_MODEL_VERSION = 1;
export const PREPARED_MODEL_PRESET = {
  outerOffset: 0.001, maxEdge: 0.15, subdivisions: 0, creaseAngle: 30, smoothShading: true,
} as const;

const arrayTypes = {
  Float32Array, Float64Array, Uint32Array, Uint16Array, Uint8Array,
  Int32Array, Int16Array, Int8Array, Uint8ClampedArray,
};

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

async function decodeAttribute(value: EncodedAttribute): Promise<THREE.BufferAttribute> {
  if (!value || !Object.prototype.hasOwnProperty.call(arrayTypes, value.type) ||
      !Number.isSafeInteger(value.itemSize) || value.itemSize < 1 || value.itemSize > 16 ||
      typeof value.normalized !== 'boolean' || typeof value.bytes !== 'string' ||
      value.encoding !== 'gzip-xor-byte-planes' || !Number.isSafeInteger(value.byteLength) || value.byteLength < 1) {
    throw new Error('Invalid prepared geometry attribute');
  }
  const ArrayType = arrayTypes[value.type];
  const binary = atob(value.bytes);
  const compressed = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) compressed[i] = binary.charCodeAt(i);
  const predicted = await transformBytes(compressed, new DecompressionStream('gzip'));
  const width = ArrayType.BYTES_PER_ELEMENT, count = predicted.length / width;
  if (predicted.length !== value.byteLength || predicted.length % (width * value.itemSize)) {
    throw new Error('Invalid prepared geometry byte length');
  }
  const bytes = new Uint8Array(predicted.length);
  for (let lane = 0; lane < width; lane++) {
    for (let i = 0; i < count; i++) {
      bytes[i * width + lane] = predicted[lane * count + i] ^
        (i >= value.itemSize ? bytes[(i - value.itemSize) * width + lane] : 0);
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

export async function decodeGeometry(value: EncodedGeometry): Promise<THREE.BufferGeometry> {
  if (!value?.attributes || !value.attributes.position || !Array.isArray(value.groups) || !value.drawRange) {
    throw new Error('Invalid prepared geometry');
  }
  const geometry = new THREE.BufferGeometry();
  try {
    for (const [name, attribute] of Object.entries(value.attributes)) geometry.setAttribute(name, await decodeAttribute(attribute));
    const count = geometry.getAttribute('position').count;
    if (geometry.getAttribute('position').itemSize !== 3 || Object.values(geometry.attributes).some(attribute => attribute.count !== count)) {
      throw new Error('Mismatched prepared geometry attributes');
    }
    if (value.index) {
      if (!['Uint16Array', 'Uint32Array', 'Uint8Array'].includes(value.index.type) || value.index.itemSize !== 1) {
        throw new Error('Invalid prepared geometry index');
      }
      geometry.setIndex(await decodeAttribute(value.index));
    }
    geometry.name = value.name;
    geometry.groups = value.groups.map(group => ({...group}));
    geometry.setDrawRange(value.drawRange.start, value.drawRange.count === null ? Infinity : value.drawRange.count);
    if (value.boundingBox) {
      const box = await decodeAttribute(value.boundingBox);
      if (box.itemSize !== 3 || box.count !== 2) throw new Error('Invalid prepared bounding box');
      geometry.boundingBox = new THREE.Box3(new THREE.Vector3().fromArray(box.array), new THREE.Vector3().fromArray(box.array, 3));
    }
    if (value.boundingSphere) {
      const sphere = await decodeAttribute(value.boundingSphere);
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

export async function decodePreparedModel(value: PreparedModel, expected: {generation: string; sourceSha256: string}) {
  if (value?.version !== PREPARED_MODEL_VERSION || value.generation !== expected.generation ||
      value.sourceSha256 !== expected.sourceSha256 || Object.entries(PREPARED_MODEL_PRESET)
        .some(([key, setting]) => value.preset?.[key] !== setting)) {
    throw new Error('Prepared model version, source or preset mismatch');
  }
  const base = await decodeGeometry(value.base);
  try {
    return {base, outer: await decodeGeometry(value.outer)};
  } catch (error) {
    base.dispose();
    throw error;
  }
}
