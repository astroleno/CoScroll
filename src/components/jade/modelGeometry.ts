import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TessellateModifier, toCreasedNormals } from "three-stdlib";

export interface OffsetGeometryOptions {
  maxEdge?: number;
  subdivisions?: number;
  creaseAngle?: number;
  smoothShading?: boolean;
}

/** The same full precision pipeline is used offline and for custom model parameters. */
export function normalizeModelGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const merged = mergeVertices(geometry);
  merged.computeVertexNormals();
  return merged;
}

export function createOffsetGeometry(
  geometry: THREE.BufferGeometry,
  offsetDistance: number,
  options: OffsetGeometryOptions
): THREE.BufferGeometry {
  const { maxEdge = 0.15, subdivisions = 0, creaseAngle = 30, smoothShading = true } = options;

  let workingGeometry = geometry.clone();

  try {
    workingGeometry = mergeVertices(workingGeometry);
    workingGeometry = workingGeometry.toNonIndexed();

    if (maxEdge > 0 && maxEdge <= 0.15) {
      const tess = new TessellateModifier(maxEdge);
      workingGeometry = tess.modify(workingGeometry);
    }

    if (subdivisions > 0) {
      const iterations = Math.min(subdivisions, 1);
      workingGeometry = loopSubdivide(workingGeometry, iterations);
    }

    workingGeometry.computeVertexNormals();

    if (creaseAngle < 90) {
      const creaseRad = THREE.MathUtils.degToRad(creaseAngle);
      workingGeometry = toCreasedNormals(workingGeometry, creaseRad);
    }

    if (smoothShading) {
      workingGeometry = mergeVertices(workingGeometry);
      workingGeometry.computeVertexNormals();
    }
  } catch (error) {
    console.warn('[ModelPreloader] Offset 几何体优化失败，使用原始几何:', error);
    workingGeometry = geometry.clone();
    workingGeometry.computeVertexNormals();
  }

  const positionAttribute = workingGeometry.getAttribute('position');
  const normalAttribute = workingGeometry.getAttribute('normal');
  const newPositions = new Float32Array(positionAttribute.count * 3);

  for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    const z = positionAttribute.getZ(i);

    const nx = normalAttribute.getX(i);
    const ny = normalAttribute.getY(i);
    const nz = normalAttribute.getZ(i);

    newPositions[i * 3] = x + nx * offsetDistance;
    newPositions[i * 3 + 1] = y + ny * offsetDistance;
    newPositions[i * 3 + 2] = z + nz * offsetDistance;
  }

  workingGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  workingGeometry.computeVertexNormals();

  return workingGeometry;
}

function loopSubdivide(geometry: THREE.BufferGeometry, iterations: number): THREE.BufferGeometry {
  let geo = geometry;

  for (let i = 0; i < iterations; i++) {
    const positions = geo.attributes.position.array as Float32Array;
    const newPositions: number[] = [];

    for (let j = 0; j < positions.length; j += 9) {
      const v1 = [positions[j], positions[j + 1], positions[j + 2]];
      const v2 = [positions[j + 3], positions[j + 4], positions[j + 5]];
      const v3 = [positions[j + 6], positions[j + 7], positions[j + 8]];

      const m1 = [(v1[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2, (v1[2] + v2[2]) / 2];
      const m2 = [(v2[0] + v3[0]) / 2, (v2[1] + v3[1]) / 2, (v2[2] + v3[2]) / 2];
      const m3 = [(v3[0] + v1[0]) / 2, (v3[1] + v1[1]) / 2, (v3[2] + v1[2]) / 2];

      newPositions.push(...v1, ...m1, ...m3);
      newPositions.push(...m1, ...v2, ...m2);
      newPositions.push(...m2, ...v3, ...m3);
      newPositions.push(...m1, ...m2, ...m3);
    }

    const newGeo = new THREE.BufferGeometry();
    newGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newPositions), 3));
    geo = newGeo;
  }

  return geo;
}
