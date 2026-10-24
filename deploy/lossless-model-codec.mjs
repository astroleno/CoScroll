import * as THREE from 'three';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';

/**
 * Lossless prepared model container. Node-only writer; the browser reader lives in preparedModelDelivery.ts.
 * Fixed 16-byte header, compact JSON metadata, then independent gzip sections.
 * Every section is restored to the exact original byte view before a
 * BufferAttribute is constructed.
 *
 * Codecs:
 *   gzip                              - raw bytes, gzip only
 *   gzip-xor-byte-planes              - existing v1 byte-plane/XOR delta + gzip
 *   gzip-cross-xor                    - outer XOR base[mapping] residual + gzip
 *   gzip-cross-xor-byte-planes        - same residual, then existing byte planes + gzip
 *   gzip-cross-sub                    - outer index minus base index (mod 2^32), gzip
 *   gzip-cross-sub-byte-planes        - same modular difference, then byte planes + gzip
 *
 * Cross-layer prediction uses integer views only. No floating point arithmetic
 * derives a prediction, so NaN, -0, and every Float32/Float64 bit are exact.
 */

export const CONTAINER_MAGIC = 'CSB2';
export const CONTAINER_VERSION = 2;
export const HEADER_BYTES = 16;
export const CODECS = Object.freeze([
  'gzip', 'gzip-xor-byte-planes', 'gzip-cross-xor',
  'gzip-cross-xor-byte-planes', 'gzip-cross-sub', 'gzip-cross-sub-byte-planes',
]);
const ARRAY_TYPES = {
  Float32Array, Float64Array, Uint32Array, Uint16Array, Uint8Array,
  Int32Array, Int16Array, Int8Array, Uint8ClampedArray,
};
const INDEX_TYPES = {Uint8Array, Uint16Array, Uint32Array};
const CODEC_PRIORITY = new Map(CODECS.map((codec, index) => [codec, index]));

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const asBytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const typeName = array => array.constructor.name;

function bytePlanePredict(bytes, itemSize, width) {
  if (!Number.isSafeInteger(itemSize) || itemSize < 1 || !Number.isSafeInteger(width) || width < 1 ||
      bytes.length % width !== 0) throw new Error('Invalid byte-plane shape');
  const count = bytes.length / width;
  const predicted = Buffer.alloc(bytes.length);
  for (let lane = 0; lane < width; lane++) {
    for (let i = 0; i < count; i++) {
      predicted[lane * count + i] = bytes[i * width + lane] ^
        (i >= itemSize ? bytes[(i - itemSize) * width + lane] : 0);
    }
  }
  return predicted;
}

function u32Bytes(values) {
  const bytes = Buffer.alloc(values.length * 4);
  for (let i = 0; i < values.length; i++) bytes.writeUInt32LE(values[i] >>> 0, i * 4);
  return bytes;
}

function readIndexValue(bytes, index, width) {
  if (width === 1) return bytes[index];
  if (width === 2) return bytes.readUInt16LE(index * 2);
  if (width === 4) return bytes.readUInt32LE(index * 4);
  throw new Error('Unsupported index width');
}

function makeCandidate(raw, codec, payload) {
  const stored = gzipSync(payload, {level: 9});
  return {codec, payload, stored};
}

function smallest(candidates) {
  return [...candidates].sort((a, b) =>
    a.stored.length - b.stored.length || CODEC_PRIORITY.get(a.codec) - CODEC_PRIORITY.get(b.codec))[0];
}

function ordinaryCandidates(raw, itemSize, width) {
  return [
    makeCandidate(raw, 'gzip-xor-byte-planes', bytePlanePredict(raw, itemSize, width)),
    makeCandidate(raw, 'gzip', raw),
  ];
}

function chooseOrdinary(raw, itemSize, width) {
  return smallest(ordinaryCandidates(raw, itemSize, width));
}

function buildTriangleCornerMapping(baseIndex, outerIndex, outerCount) {
  if (!baseIndex || !outerIndex || baseIndex.count !== outerIndex.count || outerIndex.count % 3 !== 0) {
    return {mode: 'none', map: null, reason: 'index sequence or triangle count cannot be aligned'};
  }
  const map = new Int32Array(outerCount).fill(-1);
  for (let i = 0; i < outerIndex.count; i++) {
    const outerVertex = outerIndex.getX(i);
    const baseVertex = baseIndex.getX(i);
    if (outerVertex < 0 || outerVertex >= outerCount || baseVertex < 0) {
      return {mode: 'none', map: null, reason: 'index outside vertex domain'};
    }
    if (map[outerVertex] === -1) map[outerVertex] = baseVertex;
    else if (map[outerVertex] !== baseVertex) {
      return {mode: 'none', map: null, reason: `triangle-corner conflict at outer vertex ${outerVertex}`};
    }
  }
  for (let vertex = 0; vertex < map.length; vertex++) {
    if (map[vertex] < 0) return {mode: 'none', map: null, reason: `unmapped outer vertex ${vertex}`};
  }
  return {mode: 'triangle-corner', map, reason: null};
}

function crossResidual(raw, baseRaw, mapping, itemSize, width) {
  const stride = itemSize * width;
  if (!mapping || mapping.mode !== 'triangle-corner' || raw.length !== mapping.map.length * stride) return null;
  if (baseRaw.length % stride !== 0) return null;
  const baseCount = baseRaw.length / stride;
  const residual = Buffer.alloc(raw.length);
  for (let vertex = 0; vertex < mapping.map.length; vertex++) {
    const baseVertex = mapping.map[vertex];
    if (baseVertex < 0 || baseVertex >= baseCount) return null;
    for (let component = 0; component < stride; component++) {
      residual[vertex * stride + component] = raw[vertex * stride + component] ^
        baseRaw[baseVertex * stride + component];
    }
  }
  return residual;
}

function chooseOuterAttribute(raw, itemSize, width, baseRaw, mapping) {
  const ordinary = chooseOrdinary(raw, itemSize, width);
  const residual = baseRaw ? crossResidual(raw, baseRaw, mapping, itemSize, width) : null;
  if (!residual) return ordinary;
  const cross = smallest([
    makeCandidate(raw, 'gzip-cross-xor-byte-planes', bytePlanePredict(residual, itemSize, width)),
    makeCandidate(raw, 'gzip-cross-xor', residual),
  ]);
  // Keep the existing lossless representation on an exact tie.
  return cross.stored.length < ordinary.stored.length ? cross : ordinary;
}

function chooseOuterIndex(raw, width, baseIndexValues) {
  const ordinary = chooseOrdinary(raw, 1, width);
  if (!baseIndexValues || raw.length % width !== 0) return ordinary;
  const count = raw.length / width;
  if (count !== baseIndexValues.length) return ordinary;
  const differences = Buffer.alloc(count * 4);
  for (let i = 0; i < count; i++) {
    const value = readIndexValue(raw, i, width);
    differences.writeUInt32LE((value - baseIndexValues[i]) >>> 0, i * 4);
  }
  const cross = smallest([
    makeCandidate(raw, 'gzip-cross-sub-byte-planes', bytePlanePredict(differences, 1, 4)),
    makeCandidate(raw, 'gzip-cross-sub', differences),
  ]);
  return cross.stored.length < ordinary.stored.length ? cross : ordinary;
}

function sectionFor(id, candidate, raw) {
  return {
    id, codec: candidate.codec,
    storedBytes: candidate.stored.length,
    payloadBytes: candidate.payload.length,
    rawBytes: raw.length,
    rawSha256: sha256(raw),
    _stored: candidate.stored,
  };
}

function publicSection(section) {
  const {_stored, ...value} = section;
  return value;
}

function attributeRef(section, attribute) {
  return {
    section: section.id,
    type: typeName(attribute.array),
    itemSize: attribute.itemSize,
    normalized: attribute.normalized,
    name: attribute.name,
    usage: attribute.usage,
    gpuType: attribute.gpuType,
  };
}

function encodeBaseAttribute(name, attribute, sections) {
  if (!(attribute?.array) || !ARRAY_TYPES[typeName(attribute.array)]) throw new Error('Unsupported base attribute');
  const raw = asBytes(attribute.array);
  if (!Number.isSafeInteger(attribute.itemSize) || attribute.itemSize < 1 ||
      raw.length % (attribute.array.BYTES_PER_ELEMENT * attribute.itemSize) !== 0) {
    throw new Error('Invalid base attribute shape');
  }
  const candidate = chooseOrdinary(raw, attribute.itemSize, attribute.array.BYTES_PER_ELEMENT);
  const section = sectionFor(`base.attribute:${name}`, candidate, raw);
  sections.push(section);
  return attributeRef(section, attribute);
}

function encodeOuterAttribute(name, attribute, baseAttribute, mapping, sections) {
  if (!(attribute?.array) || !ARRAY_TYPES[typeName(attribute.array)]) throw new Error('Unsupported outer attribute');
  const raw = asBytes(attribute.array);
  const width = attribute.array.BYTES_PER_ELEMENT;
  if (!Number.isSafeInteger(attribute.itemSize) || attribute.itemSize < 1 ||
      raw.length % (width * attribute.itemSize) !== 0) throw new Error('Invalid outer attribute shape');
  const sameShape = baseAttribute && typeName(baseAttribute.array) === typeName(attribute.array) &&
    baseAttribute.itemSize === attribute.itemSize;
  const candidate = chooseOuterAttribute(raw, attribute.itemSize, width,
    sameShape ? asBytes(baseAttribute.array) : null, mapping);
  const section = sectionFor(`outer.attribute:${name}`, candidate, raw);
  sections.push(section);
  return attributeRef(section, attribute);
}

function encodeIndex(prefix, index, baseIndexValues, sections) {
  if (!index) return null;
  if (!INDEX_TYPES[typeName(index.array)] || index.itemSize !== 1) throw new Error('Unsupported index attribute');
  const raw = asBytes(index.array);
  const candidate = prefix === 'base'
    ? chooseOrdinary(raw, 1, index.array.BYTES_PER_ELEMENT)
    : chooseOuterIndex(raw, index.array.BYTES_PER_ELEMENT, baseIndexValues);
  const section = sectionFor(`${prefix}.index`, candidate, raw);
  sections.push(section);
  return attributeRef(section, index);
}

function encodeBound(prefix, name, value, sections) {
  if (!value) return null;
  const array = name === 'boundingBox'
    ? new Float64Array([...value.min.toArray(), ...value.max.toArray()])
    : new Float64Array([...value.center.toArray(), value.radius]);
  const attribute = new THREE.BufferAttribute(array, name === 'boundingBox' ? 3 : 4);
  const raw = asBytes(array);
  const candidate = chooseOrdinary(raw, attribute.itemSize, array.BYTES_PER_ELEMENT);
  const section = sectionFor(`${prefix}.${name}`, candidate, raw);
  sections.push(section);
  return attributeRef(section, attribute);
}

function geometryDescriptor(geometry, attributes, index, bounds) {
  return {
    name: geometry.name,
    attributes,
    index,
    groups: geometry.groups.map(group => ({...group})),
    drawRange: {
      start: geometry.drawRange.start,
      count: Number.isFinite(geometry.drawRange.count) ? geometry.drawRange.count : null,
    },
    boundingBox: bounds.boundingBox,
    boundingSphere: bounds.boundingSphere,
    userData: geometry.userData,
    morphTargetsRelative: geometry.morphTargetsRelative,
  };
}

/**
 * Encode a decoded v1 base/outer pair into the binary container.
 * The mapping is implicit when every outer triangle corner maps consistently
 * to the base triangle corner at the same sequence position; only its count and
 * SHA-256 live in metadata. Otherwise cross-layer prediction is not used.
 */
export function encodePreparedModelDelivery({base, outer, identity}) {
  if (!(base instanceof THREE.BufferGeometry) || !(outer instanceof THREE.BufferGeometry)) {
    throw new Error('encodePreparedModelDelivery requires two decoded geometries');
  }
  if (!identity || typeof identity.generation !== 'string' || typeof identity.sourceSha256 !== 'string' ||
      !isObject(identity.preset)) throw new Error('Missing container identity');
  const outerPosition = outer.getAttribute('position');
  const basePosition = base.getAttribute('position');
  if (!outerPosition || !basePosition) throw new Error('Both layers need position attributes');
  const mapping = buildTriangleCornerMapping(base.index, outer.index, outerPosition.count);
  const sections = [];

  const baseAttributes = {};
  for (const name of Object.keys(base.attributes).sort()) {
    baseAttributes[name] = encodeBaseAttribute(name, base.getAttribute(name), sections);
  }
  const baseIndexValues = base.index
    ? Array.from({length: base.index.count}, (_, i) => base.index.getX(i)) : null;
  const baseIndex = encodeIndex('base', base.index, null, sections);
  const baseBounds = {
    boundingBox: encodeBound('base', 'boundingBox', base.boundingBox, sections),
    boundingSphere: encodeBound('base', 'boundingSphere', base.boundingSphere, sections),
  };

  const outerIndex = encodeIndex('outer', outer.index, baseIndexValues, sections);
  const outerAttributes = {};
  for (const name of Object.keys(outer.attributes).sort()) {
    outerAttributes[name] = encodeOuterAttribute(name, outer.getAttribute(name),
      base.getAttribute(name), mapping, sections);
  }
  const outerBounds = {
    boundingBox: encodeBound('outer', 'boundingBox', outer.boundingBox, sections),
    boundingSphere: encodeBound('outer', 'boundingSphere', outer.boundingSphere, sections),
  };

  const mappingMetadata = mapping.mode === 'triangle-corner'
    ? {
      mode: 'triangle-corner',
      count: mapping.map.length,
      sha256: sha256(u32Bytes(mapping.map)),
      payloadBytes: 0,
      source: 'base.index and outer.index at the same triangle-corner sequence position',
    }
    : {mode: 'none', count: 0, sha256: null, payloadBytes: 0, reason: mapping.reason};

  const metadata = {
    format: 'coscroll-prepared-binary',
    version: CONTAINER_VERSION,
    generation: identity.generation,
    geometryGeneration: identity.geometryGeneration,
    sourceSha256: identity.sourceSha256,
    preset: identity.preset,
    mapping: mappingMetadata,
    sections: sections.map(publicSection),
    base: geometryDescriptor(base, baseAttributes, baseIndex, baseBounds),
    outer: geometryDescriptor(outer, outerAttributes, outerIndex, outerBounds),
  };
  const metadataBytes = Buffer.from(JSON.stringify(metadata));
  const sectionBytes = sections.reduce((sum, section) => sum + section.storedBytes, 0);
  const totalBytes = HEADER_BYTES + metadataBytes.length + sectionBytes;
  const output = Buffer.alloc(totalBytes);
  output.write(CONTAINER_MAGIC, 0, 4, 'ascii');
  output.writeUInt16LE(CONTAINER_VERSION, 4);
  output.writeUInt16LE(0, 6);
  output.writeUInt32LE(metadataBytes.length, 8);
  output.writeUInt32LE(sections.length, 12);
  metadataBytes.copy(output, HEADER_BYTES);
  let offset = HEADER_BYTES + metadataBytes.length;
  for (const section of sections) {
    section._stored.copy(output, offset);
    offset += section.storedBytes;
  }
  if (offset !== output.length) throw new Error('Container section length mismatch');

  return {
    bytes: output,
    metadata,
    mapping: mappingMetadata,
    metrics: {
      totalBytes,
      headerBytes: HEADER_BYTES,
      metadataBytes: metadataBytes.length,
      sectionBytes,
      sectionCount: sections.length,
      mappingDescriptorBytes: Buffer.byteLength(JSON.stringify(mappingMetadata)),
      mappingPayloadBytes: 0,
    },
  };
}


