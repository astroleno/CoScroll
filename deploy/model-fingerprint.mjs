import {createHash} from 'node:crypto';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function attribute(value) {
  return {type: value.array.constructor.name, itemSize: value.itemSize, count: value.count,
    normalized: value.normalized, usage: value.usage, gpuType: value.gpuType, name: value.name,
    byteLength: value.array.byteLength,
    sha256: hash(Buffer.from(value.array.buffer, value.array.byteOffset, value.array.byteLength))};
}

/** Hash original bytes, including negative zero, rather than converting components to numbers. */
export function expandedAttributeHash(geometry, name) {
  const value = geometry.getAttribute(name), index = geometry.index;
  const stride = value.itemSize * value.array.BYTES_PER_ELEMENT;
  const source = Buffer.from(value.array.buffer, value.array.byteOffset, value.array.byteLength);
  const count = index?.count ?? value.count;
  const expanded = Buffer.allocUnsafe(count * stride);
  for (let i = 0; i < count; i++) {
    const vertex = index ? index.array[i] : i;
    source.copy(expanded, i * stride, vertex * stride, (vertex + 1) * stride);
  }
  return hash(expanded);
}

/** Matches the immutable pre-optimization fixture; never regenerate that fixture from candidates. */
export function fingerprintGeometry(geometry) {
  if (Object.keys(geometry.morphAttributes).length) throw new Error('Unexpected morph attributes');
  const attributes = Object.fromEntries(Object.keys(geometry.attributes).sort().map(name =>
    [name, {...attribute(geometry.attributes[name]), expandedSha256: expandedAttributeHash(geometry, name)}]));
  const box = geometry.boundingBox ? [...geometry.boundingBox.min.toArray(), ...geometry.boundingBox.max.toArray()] : null;
  const sphere = geometry.boundingSphere ? [...geometry.boundingSphere.center.toArray(), geometry.boundingSphere.radius] : null;
  return {name: geometry.name, attributes, index: geometry.index ? attribute(geometry.index) : null,
    triangles: (geometry.index?.count ?? geometry.getAttribute('position').count) / 3,
    geometryBytes: Object.values(geometry.attributes).reduce((s, a) => s + a.array.byteLength, 0) + (geometry.index?.array.byteLength ?? 0),
    groups: geometry.groups, drawRange: {start: geometry.drawRange.start,
      count: Number.isFinite(geometry.drawRange.count) ? geometry.drawRange.count : 'Infinity'},
    boundingBox: box, boundingBoxSha256: box ? hash(Buffer.from(new Float64Array(box).buffer)) : null,
    boundingSphere: sphere, boundingSphereSha256: sphere ? hash(Buffer.from(new Float64Array(sphere).buffer)) : null,
    userData: geometry.userData, morphTargetsRelative: geometry.morphTargetsRelative};
}
