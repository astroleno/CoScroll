import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BoxGeometry, DoubleSide, Matrix4, Mesh, MeshPhysicalMaterial, OrthographicCamera,
  PerspectiveCamera, Scene, Vector3} from 'three';
import {patchThreeTransmissionRegion} from '../../deploy/three-transmission-region.mjs';

await mkdir(resolve('.cache'), {recursive:true});
const temporary = await mkdtemp(join(resolve('.cache'), 'transmission-region-test-'));
let TransmissionUpdateRegion, prepareTransmissionBounds;
try {
  const source = await readFile(new URL('../../src/rendering/transmissionUpdateRegion.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2020}}).outputText;
  const path = join(temporary, 'region.mjs');
  await writeFile(path, compiled);
  ({TransmissionUpdateRegion, prepareTransmissionBounds} = await import(pathToFileURL(path).href));
} finally { await rm(temporary, {recursive:true, force:true}); }

function fixture() {
  const controller = new TransmissionUpdateRegion(), scene = new Scene();
  const camera = new OrthographicCamera(-2, 2, 2, -2, .1, 20);
  camera.position.z = 10; camera.updateMatrixWorld();
  const geometry = new BoxGeometry(1, 1, .2); geometry.computeBoundingBox();
  const object = new Mesh(geometry, new MeshPhysicalMaterial());
  object.userData.coscrollTransmissionBounds = true; scene.add(object);
  const opaque = [{object, geometry, material:object.material, group:null}];
  const transmissive = [{object:new Mesh(geometry, new MeshPhysicalMaterial({transmission:1})),
    geometry, material:new MeshPhysicalMaterial({transmission:1}), group:null}];
  const f = {controller, scene, camera, geometry, object, opaque, transmissive, width:400, height:400};
  f.update = () => {scene.updateMatrixWorld();return controller.update(opaque, transmissive, scene, f.camera, f.width, f.height);};
  return f;
}

test('legacy bounds are prepared once without changing any geometry data', () => {
  const geometry=new BoxGeometry(1,2,3),position=geometry.attributes.position;
  const before=position.array.slice(),version=position.version;
  prepareTransmissionBounds(geometry);const box=geometry.boundingBox;
  assert.deepEqual(box.min.toArray(),[-.5,-1,-1.5]);
  geometry.computeBoundingBox=()=>{throw Error('Unnecessary repeated preparation');};
  prepareTransmissionBounds(geometry);
  assert.equal(geometry.boundingBox,box);assert.deepEqual(position.array,before);assert.equal(position.version,version);
});

test('previous/current coverage clears trails and uses physical pixels without allocation', () => {
  const f = fixture();
  assert.equal(f.update(), null);
  const rect = f.update(); assert.deepEqual(rect.toArray(), [147,147,106,106]);
  f.object.position.x = 1;
  assert.equal(f.update(), rect); assert.deepEqual(rect.toArray(), [147,147,206,106]);
  f.update(); assert.deepEqual(rect.toArray(), [247,147,106,106]);
  f.object.position.x = 10; f.update();
  assert.deepEqual(rect.toArray(), [247,147,153,106]);
  f.update(); assert.equal(rect.z, 0);
  f.object.position.x = 0; f.update(); assert.deepEqual(rect.toArray(), [147,147,253,106]);
});

test('rotated cameras, object rotations and nonuniform scales enclose every transformed vertex', () => {
  const f = fixture();
  f.camera.position.set(2, 1, 10); f.camera.lookAt(0, 0, 0); f.camera.updateMatrixWorld();
  f.object.scale.set(1.7, .6, 1.1);
  const p = new Vector3(), matrix = new Matrix4();
  for (let angle = 0; angle < Math.PI * 2; angle += .11) {
    f.object.rotation.set(.2, angle, -.13); f.update(); const r = f.update();
    matrix.multiplyMatrices(f.camera.projectionMatrix, f.camera.matrixWorldInverse).multiply(f.object.matrixWorld);
    for (let i = 0; i < f.geometry.attributes.position.count; i++) {
      p.fromBufferAttribute(f.geometry.attributes.position, i).applyMatrix4(matrix);
      const x = (p.x+1)*200, y = (p.y+1)*200;
      assert.ok(x >= r.x && x <= r.x+r.z && y >= r.y && y <= r.y+r.w);
    }
  }
});

test('resize, camera, model, material and context changes require a full update first', () => {
  for (const mutate of [f=>{f.width=800;}, f=>{f.camera.zoom=2;f.camera.updateProjectionMatrix();},
    f=>{f.camera.layers.enable(1);}, f=>{f.object.material.needsUpdate=true;},
    f=>{f.controller.reset();}, f=>{const g=f.geometry.clone();f.object.geometry=g;f.opaque[0].geometry=g;}]) {
    const f=fixture(); f.update(); assert.ok(f.update()); mutate(f);
    assert.equal(f.update(), null); assert.ok(f.update());
  }
});

test('unverified scenes, deformed bounds and unsupported cameras stay on the full path', () => {
  for (const mutate of [f=>{f.camera=new PerspectiveCamera();}, f=>{f.object.userData={};},
    f=>{f.scene.background={};}, f=>{f.transmissive[0].material.side=DoubleSide;},
    f=>{f.opaque.push(f.opaque[0]);}, f=>{f.geometry.boundingBox=null;},
    f=>{f.geometry.attributes.position.needsUpdate=true;}, f=>{f.object.position.x=NaN;},
    f=>{f.object.isSkinnedMesh=true;}, f=>{f.geometry.morphAttributes.position=[f.geometry.attributes.position];}]) {
    const f=fixture(); f.update(); assert.ok(f.update()); mutate(f);
    assert.equal(f.update(), null); assert.equal(f.update(), null);
  }
});

test('adapter pins source identity and preserves shader, target, mipmaps and default full resolve', async () => {
  const source=await readFile(new URL('../../node_modules/three/build/three.module.js', import.meta.url), 'utf8');
  const patched=patchThreeTransmissionRegion(source);
  assert.throws(()=>patchThreeTransmissionRegion(source+'\n'), /reviewed/);
  // No shader changes: every source line outside the two renderer functions and
  // lifecycle/property hooks is unchanged. Mip generation is still native/full.
  const begin=source.indexOf('const REVISION'), end=source.indexOf('function WebGLTextures');
  assert.equal(patched.slice(patched.indexOf('const REVISION'), patched.indexOf('function WebGLTextures')), source.slice(begin,end));
  for (const token of ['generateMipmaps: true', "type: extensions.has( 'EXT_color_buffer_half_float' ) ? HalfFloatType : UnsignedByteType",
    'samples: ( isWebGL2 ) ? 4 : 0', '_gl.blitFramebuffer( 0, 0, width, height, 0, 0, width, height, mask, _gl.NEAREST );']) {
    assert.ok(patched.includes(token));
  }
  assert.equal(patched.split('textures.updateRenderTargetMipmap( _transmissionRenderTarget );').length, 3);
  assert.equal(patched.split('textures.updateMultisampleRenderTarget( _transmissionRenderTarget, updateRegion );').length, 2);
  const pass = patched.slice(patched.indexOf('function renderTransmissionPass('), patched.indexOf('function renderObjects('));
  assert.ok(pass.indexOf('_this.clear();') < pass.indexOf('state.setScissorTest( false );'));
  assert.ok(pass.indexOf('state.setScissorTest( false );') < pass.indexOf('renderObjects( opaqueObjects'));
  const additions=patched.split('\n').filter(line=>!source.includes(line)).join('\n');
  assert.doesNotMatch(additions, /getParameter|isEnabled|readPixels|new (?:Array|Vector|Matrix)/);
});
