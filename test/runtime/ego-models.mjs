import {installInfiniteProbe} from './ego-infinite.mjs';

/** Browser-only rendering diagnostic. Native gestures are tested separately. */
export async function verifyModelRotations(page, models) {
  await installInfiniteProbe(page);
  const results = [];
  for (const model of models) {
    await page.evaluate(time => window.__infiniteRegression.seek(time), model.time);
    await page.waitForFunction(character =>
      document.querySelector('[data-model-status]')?.dataset.renderedCharacter === character,
    model.character, {timeout: 45000});
    const result = await page.evaluate(async model => {
      const props = window.__infiniteRegression.readProps();
      const velocity = props.rotationVelocityRef || props.scrollVelocityRef;
      if (!velocity) throw Error('Rotation input missing');
      const main = window.__renderProbe.stores.map(s => s.getState())
        .find(s => !s.gl.domElement.closest('[data-coscroll-background]'));
      const meshes = [];
      main.scene.traverse(o => {if (o.material?.isMeshPhysicalMaterial) meshes.push(o);});
      if (meshes.length !== 2 || meshes[0].geometry === meshes[1].geometry) throw Error('Missing distinct model pair');
      const rotation = meshes[0].parent.parent, original = velocity.current;
      let previous = rotation.rotation.y, radians = 0, frames = 0, stable = true;
      const start = performance.now();
      try {
        velocity.current = 8;
        await new Promise(resolve => {
          function tick(now) {
            radians += Math.abs(rotation.rotation.y - previous); previous = rotation.rotation.y; frames++;
            stable &&= meshes.every(o => o.visible && o.geometry.index.count / 3 === model.triangles &&
              o.material.normalMap?.image && o.material.envMap && main.gl.properties.get(o.material).currentProgram);
            if (now - start >= 1800) resolve(); else requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
      } finally {velocity.current = original;}
      return {character:model.character, radians, frames, stable:Boolean(stable),
        elapsed:performance.now() - start, errors:window.__coscrollPerf.errors.slice(),
        geometries:main.gl.info.memory.geometries, textures:main.gl.info.memory.textures};
    }, model);
    if (result.radians < Math.PI * 2 || !result.stable || result.errors.length) {
      throw Error('Model rotation regression ' + JSON.stringify(result));
    }
    results.push(result);
  }
  return results;
}
