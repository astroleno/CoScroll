import {DoubleSide, Matrix4, Vector4} from 'three';
import type {BufferGeometry, Camera, Material, Mesh, MeshPhysicalMaterial, OrthographicCamera, Scene} from 'three';

// Opt in only geometry whose vertex shader preserves its prepared bounding box.
export const TRANSMISSION_BOUNDS_USER_DATA = {coscrollTransmissionBounds: true};
/** Older prepared assets omit the box. Calculate it once, before publication;
 * neither the geometry buffers nor the frame loop need to change. */
export function prepareTransmissionBounds(geometry: BufferGeometry) {
  if (geometry.boundingBox === null) geometry.computeBoundingBox();
}
interface RenderItem {object: Mesh; geometry: BufferGeometry; material: Material; group: unknown}
export type TransmissionRegionProvider = (opaque: RenderItem[], transmissive: RenderItem[],
  scene: Scene, camera: Camera, width: number, height: number) => Vector4 | null;

/** Conservative previous/current opaque coverage. null means a full update.
 * Called inside Three after world matrices and the visible render list update.
 * Everything in the frame path is preallocated; no WebGL state is queried.
 */
export class TransmissionUpdateRegion {
  private readonly rect = new Vector4();
  private readonly projection = new Matrix4();
  private readonly view = new Matrix4();
  private readonly viewProjection = new Matrix4();
  private readonly projected = new Matrix4();
  private valid = false;
  private camera: Camera | null = null;
  private geometry: BufferGeometry | null = null;
  private object: Mesh | null = null;
  private material: Material | null = null;
  private positionVersion = -1;
  private materialVersion = -1;
  private layers = 0;
  private width = 0;
  private height = 0;
  private left = 0;
  private bottom = 0;
  private right = 0;
  private top = 0;

  reset = () => { this.valid = false; };

  update: TransmissionRegionProvider = (opaque, transmissive, scene, camera, width, height) => {
    if (!(camera as OrthographicCamera).isOrthographicCamera || scene.background !== null ||
        scene.overrideMaterial !== null || opaque.length !== 1 || transmissive.length !== 1 ||
        transmissive[0].material.side === DoubleSide || width < 1 || height < 1) {
      this.valid = false;
      return null;
    }
    const {object, geometry, material: baseMaterial} = opaque[0];
    const material = baseMaterial as MeshPhysicalMaterial;
    const bounds = geometry.boundingBox;
    const position = geometry.attributes.position;
    if (!object.isMesh || object.userData.coscrollTransmissionBounds !== true ||
        (object as Mesh & {isSkinnedMesh?: boolean; isInstancedMesh?: boolean}).isSkinnedMesh ||
        (object as Mesh & {isInstancedMesh?: boolean}).isInstancedMesh ||
        !material.isMeshPhysicalMaterial || material.displacementMap ||
        geometry.morphAttributes.position?.length || !bounds || !position || !('version' in position) ||
        !object.layers.test(camera.layers)) {
      this.valid = false;
      return null;
    }
    // Mutating positions can invalidate a prepared box. Stay on the full path
    // until a new geometry is published, rather than guessing when it was fixed.
    if (geometry === this.geometry && position.version !== this.positionVersion) {
      this.valid = false;
      return null;
    }
    const cameraChanged = camera !== this.camera || this.layers !== camera.layers.mask ||
      !this.projection.equals(camera.projectionMatrix) || !this.view.equals(camera.matrixWorldInverse);
    const full = !this.valid || cameraChanged || geometry !== this.geometry || object !== this.object ||
      material !== this.material || material.version !== this.materialVersion ||
      width !== this.width || height !== this.height;
    if (cameraChanged) {
      this.projection.copy(camera.projectionMatrix);
      this.view.copy(camera.matrixWorldInverse);
      this.viewProjection.multiplyMatrices(this.projection, this.view);
    }
    this.projected.multiplyMatrices(this.viewProjection, object.matrixWorld);
    const e = this.projected.elements;
    let left = Infinity, bottom = Infinity, right = -Infinity, top = -Infinity;
    // Orthographic projection is affine, including camera rotation and nonuniform
    // object scale. All eight corners conservatively bound the whole triangle set.
    for (let corner = 0; corner < 8; corner++) {
      const x = corner & 1 ? bounds.max.x : bounds.min.x;
      const y = corner & 2 ? bounds.max.y : bounds.min.y;
      const z = corner & 4 ? bounds.max.z : bounds.min.z;
      const px = (e[0] * x + e[4] * y + e[8] * z + e[12] + 1) * .5 * width;
      const py = (e[1] * x + e[5] * y + e[9] * z + e[13] + 1) * .5 * height;
      left = Math.min(left, px); bottom = Math.min(bottom, py);
      right = Math.max(right, px); top = Math.max(top, py);
    }
    if (!Number.isFinite(left + bottom + right + top)) {
      this.valid = false;
      return null;
    }
    // Three physical pixels cover rounding and MSAA sample positions. Bounds
    // include both poses so pixels uncovered by motion are cleared this frame.
    left = Math.max(0, Math.min(width, Math.floor(left) - 3));
    bottom = Math.max(0, Math.min(height, Math.floor(bottom) - 3));
    right = Math.max(0, Math.min(width, Math.ceil(right) + 3));
    top = Math.max(0, Math.min(height, Math.ceil(top) + 3));
    const unionLeft = Math.min(left, this.left), unionBottom = Math.min(bottom, this.bottom);
    this.rect.set(unionLeft, unionBottom, Math.max(right, this.right) - unionLeft,
      Math.max(top, this.top) - unionBottom);
    this.left = left; this.bottom = bottom; this.right = right; this.top = top;
    this.object = object; this.geometry = geometry; this.material = material;
    this.positionVersion = position.version; this.materialVersion = material.version;
    this.camera = camera; this.layers = camera.layers.mask;
    this.width = width; this.height = height; this.valid = true;
    return full ? null : this.rect;
  };
}
