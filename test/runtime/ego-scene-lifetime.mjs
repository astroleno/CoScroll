import {selectClassic} from './ego-classics.mjs';

/** Exercise the actual renderer lifetime; do not infer GPU reuse from DOM reuse. */
export async function verifySceneLifetime(page) {
  await selectClassic(page, 'lotus-sutra-zanshi');
  await page.evaluate(() => {
    const main = window.__renderProbe.stores.map(s => s.getState())
      .find(s => !s.gl.domElement.closest('[data-coscroll-background]'));
    const layers = [];
    main.scene.traverse(o => {if (o.material?.isMeshPhysicalMaterial) layers.push(o);});
    if (layers.length !== 2 || layers.some(o => !o.material.envMap || !o.material.normalMap)) throw Error('Scene is not fully prepared');
    window.__sceneLifetime = {main, env: layers[0].material.envMap, normal: layers[0].material.normalMap,
      materials: layers.map(o => o.material), rotation: layers[0].parent.parent,
      rotationContainer: layers[0].parent.parent.parent, resourceStart: performance.now(), resets: []};
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__, original = hook.onCommitFiberRoot;
    window.__sceneLifetime.originalCommit = original;
    hook.onCommitFiberRoot = function(...args) {
      const result = original.apply(this, args), q = window.__sceneLifetime;
      const rotation = q.rotationContainer.children.find(o => o.isGroup);
      if (rotation && rotation !== q.rotation) {
        q.rotation = rotation;
        q.resets.push({angle: q.rotation.rotation.y});
      }
      return result;
    };
  });
  const states = [];
  try {
    for (const id of ['heart-sutra', 'lotus-sutra-zanshi', 'heart-sutra', 'lotus-sutra-zanshi']) {
      const resetCount = await page.evaluate(() => window.__sceneLifetime.resets.length);
      await selectClassic(page, id);
      await page.waitForFunction(count => window.__sceneLifetime.resets.length > count, resetCount, {timeout: 15000});
      await page.waitForFunction(() => {
        let count = 0;
        window.__sceneLifetime.main.scene.traverse(o => {if (o.material?.isMeshPhysicalMaterial) count++;});
        return count === 2;
      }, undefined, {timeout: 15000});
      const state = await page.evaluate(() => {
        const q = window.__sceneLifetime, layers = [];
        q.main.scene.traverse(o => {if (o.material?.isMeshPhysicalMaterial) layers.push(o);});
        q.rotation = layers[0].parent.parent;
        return {project: document.querySelector('[data-active-project]').dataset.activeProject,
          envReused: layers.every(o => o.material.envMap === q.env),
          normalReused: layers.every(o => o.material.normalMap === q.normal),
          materialsReused: layers.every(o => q.materials.includes(o.material)),
          resetAngle: q.resets.at(-1).angle,
          textures: q.main.gl.info.memory.textures,
          textureRequests: performance.getEntriesByType('resource')
            .filter(e => e.startTime >= q.resourceStart && /\/textures\//.test(e.name)).map(e => e.name)};
      });
      states.push(state);
      if (!state.envReused || !state.normalReused || !state.materialsReused || state.resetAngle !== 0 || state.textureRequests.length) {
        throw Error('Scene reuse/reset regression '+JSON.stringify(state));
      }
    }
  } finally {
    await page.evaluate(() => {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = window.__sceneLifetime.originalCommit;
      delete window.__sceneLifetime;
    });
  }
  return states;
}
