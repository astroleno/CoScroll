import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

// A deliberately narrow adapter for the reviewed renderer. Fail at build time
// when Three changes; never silently apply this to an unreviewed renderer.
export const THREE_VERSION = '0.160.1';
export const THREE_SOURCE_SHA256 = '76dea8151bc9352aef3528b4262e249b2604f62543828328db978d060d61a495';

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Three transmission adapter source anchor changed');
  return source.replace(before, after);
}

export function patchThreeTransmissionRegion(source) {
  if (createHash('sha256').update(source).digest('hex') !== THREE_SOURCE_SHA256) {
    throw new Error('Three transmission adapter requires the reviewed 0.160.1 module');
  }
  source = replaceOnce(source, 'this.isWebGLRenderer = true;', `this.isWebGLRenderer = true;

		// Optional application-owned conservative bounds, in drawing-buffer pixels.
		this.transmissionUpdateRegion = null;`);
  source = replaceOnce(source, 'let _transmissionRenderTarget = null;', `let _transmissionRenderTarget = null;
		let _transmissionRegionNeedsFullUpdate = true;
		let _transmissionRegionProvider = null;`);
  source = replaceOnce(source, 'function onContextRestore( /* event */ ) {', `function onContextRestore( /* event */ ) {

			_transmissionRegionNeedsFullUpdate = true;`);

  const start = source.indexOf('\t\tfunction renderTransmissionPass(');
  const end = source.indexOf('\n\t\tfunction renderObjects(', start);
  const original = source.slice(start, end);
  let pass = replaceOnce(original,
    '_transmissionRenderTarget.setSize( _vector2.x, _vector2.y );',
    `if ( _transmissionRenderTarget.width !== _vector2.x || _transmissionRenderTarget.height !== _vector2.y ) {

					_transmissionRegionNeedsFullUpdate = true;

				}
				_transmissionRenderTarget.setSize( _vector2.x, _vector2.y );`);
  pass = replaceOnce(pass,
    'const currentRenderTarget = _this.getRenderTarget();\n\t\t\t_this.setRenderTarget( _transmissionRenderTarget );',
    `const currentRenderTarget = _this.getRenderTarget();
			const provider = _this.transmissionUpdateRegion;
			let updateRegion = null;
			// The stock clear is constant white/0.5 in the transparent main scene.
			// Unknown targets, backgrounds and automatic MSAA resolves use stock code.
			if ( provider !== _transmissionRegionProvider ) _transmissionRegionNeedsFullUpdate = true;
			_transmissionRegionProvider = provider;
			if ( typeof provider === 'function' && isWebGL2 && currentRenderTarget === null &&
				! _this.xr.isPresenting && _this.getClearAlpha() < 1 &&
				! extensions.has( 'WEBGL_multisampled_render_to_texture' ) ) {

				updateRegion = provider( opaqueObjects, transmissiveObjects, scene, camera, _vector2.x, _vector2.y );
				if ( _transmissionRegionNeedsFullUpdate ) updateRegion = null;
				_transmissionRegionNeedsFullUpdate = false;

			} else {

				_transmissionRegionNeedsFullUpdate = true;

			}
			_this.setRenderTarget( _transmissionRenderTarget );
			if ( updateRegion !== null ) {

				// Internal state uses physical pixels and restores with setRenderTarget.
				// No driver state readback, public DPR conversion or transient arrays.
				state.scissor( updateRegion );
				state.setScissorTest( true );

			}`);
  // Only the opaque prepass resolve is bounded. The controller rejects the
  // DoubleSide case, so Three's optional back-face resolve remains untouched.
  pass = replaceOnce(pass,
    '\n\t\t\ttextures.updateMultisampleRenderTarget( _transmissionRenderTarget );',
    '\n\t\t\ttextures.updateMultisampleRenderTarget( _transmissionRenderTarget, updateRegion );');
  pass = replaceOnce(pass, '_this.clear();', `_this.clear();
\t\t\tif ( updateRegion !== null ) {

\t\t\t\t// The validated opaque geometry already lies inside the rectangle.
\t\t\t\t// Keep ordinary draw state; only clear and explicit resolve need bounds.
\t\t\t\tstate.setScissorTest( false );

\t\t\t}`);
  source = source.slice(0, start) + pass + source.slice(end);
  source = replaceOnce(source, 'function updateMultisampleRenderTarget( renderTarget ) {',
    'function updateMultisampleRenderTarget( renderTarget, updateRegion = null ) {');
  source = replaceOnce(source,
    '_gl.blitFramebuffer( 0, 0, width, height, 0, 0, width, height, mask, _gl.NEAREST );',
    `if ( updateRegion === null ) {

					_gl.blitFramebuffer( 0, 0, width, height, 0, 0, width, height, mask, _gl.NEAREST );

				} else {

					const x = updateRegion.x, y = updateRegion.y;
					const right = x + updateRegion.z, top = y + updateRegion.w;
					_gl.blitFramebuffer( x, y, right, top, x, y, right, top, mask, _gl.NEAREST );

				}`);
  return source;
}

export async function prepareThreeTransmissionRegion(root = fileURLToPath(new URL('../', import.meta.url))) {
  const version = JSON.parse(await readFile(join(root, 'node_modules/three/package.json'), 'utf8')).version;
  if (version !== THREE_VERSION) throw new Error(`Unsupported Three version: ${version}`);
  const source = await readFile(join(root, 'node_modules/three/build/three.module.js'), 'utf8');
  const patched = patchThreeTransmissionRegion(source);
  const digest = createHash('sha256').update(patched).digest('hex').slice(0, 16);
  const output = join(root, '.cache/three-transmission-region', `three-${digest}.mjs`);
  await mkdir(dirname(output), {recursive:true});
  await writeFile(output, patched);
  return output;
}
