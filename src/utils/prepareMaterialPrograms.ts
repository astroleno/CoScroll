import type { Camera, Material, Object3D, Scene, WebGLRenderer } from 'three';

interface CompilationLease {
  count: number;
  disposeRequested: boolean;
  original: Material['dispose'];
  ownDescriptor?: PropertyDescriptor;
  deferred: Material['dispose'];
}

const leases = new WeakMap<Material, CompilationLease>();

/** Keep material properties alive while Three polls asynchronous program linking. */
export function prepareMaterialPrograms(renderer: Pick<WebGLRenderer, 'compileAsync'>, scene: Scene, camera: Camera): Promise<Object3D> {
  const materials = new Set<Material>();
  scene.traverse(object => {
    const value = (object as Object3D & {material?: Material | Material[]}).material;
    for (const material of Array.isArray(value) ? value : value ? [value] : []) materials.add(material);
  });
  for (const material of Array.from(materials)) {
    let lease = leases.get(material);
    if (!lease) {
      lease = {count: 0, disposeRequested: false, original: material.dispose,
        ownDescriptor: Object.getOwnPropertyDescriptor(material, 'dispose'), deferred: () => {}};
      const current = lease;
      lease.deferred = () => { current.disposeRequested = true; };
      material.dispose = lease.deferred;
      leases.set(material, lease);
    }
    lease.count++;
  }
  const release = () => {
    for (const material of Array.from(materials)) {
      const lease = leases.get(material)!;
      if (--lease.count > 0) continue;
      leases.delete(material);
      if (material.dispose === lease.deferred) {
        if (lease.ownDescriptor) Object.defineProperty(material, 'dispose', lease.ownDescriptor);
        else delete (material as Partial<Material>).dispose;
      }
      if (lease.disposeRequested) lease.original.call(material);
    }
  };
  try { return renderer.compileAsync(scene, camera).finally(release); }
  catch (error) { release(); return Promise.reject(error); }
}
