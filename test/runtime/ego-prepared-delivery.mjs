/** Test-only bridge: compare both representations using the live application's unchanged jade materials. */
export async function installDeliveryComparison(page, bridge = 'http://127.0.0.1:4318') {
  return page.evaluate(async bridge => {
    const oldDecoder = await import(bridge + '/baseline-decoder.mjs');
    const binaryDecoder = await import(bridge + '/preparedModelDelivery.mjs');
    const registry = await (await fetch(bridge + '/registry-new.json')).json();
    const oldRegistry = await (await fetch(bridge + '/registry-old.json')).json();
    window.__deliveryComparison = {bridge, registry, oldRegistry, oldDecoder, binaryDecoder};
    return {models: registry.models.length, browser: navigator.userAgent, dpr: devicePixelRatio};
  }, bridge);
}

export async function compareDeliveryGlyph(page, sourcePath, {rotation = false, capture = false} = {}) {
  return page.evaluate(async ({sourcePath, rotation, capture}) => {
    const q = window.__deliveryComparison;
    const oldEntry = q.oldRegistry.models.find(e => e.sourcePath === sourcePath);
    const entry = q.registry.models.find(e => e.sourcePath === sourcePath);
    if (!oldEntry || !entry) throw Error('Model descriptor missing');
    const oldPayload = await (await fetch(q.bridge + '/baseline/' + oldEntry.preparedPath.split('/').at(-1))).json();
    const oldPair = await q.oldDecoder.decodePreparedModel(oldPayload,
      {generation: q.oldRegistry.generation, sourceSha256: oldEntry.sourceSha256});
    let newPair;
    const states = window.__renderProbe.stores.map(s => s.getState());
    const main = states.find(s => !s.gl.domElement.closest('[data-coscroll-background]'));
    const meshes = [];
    main.scene.traverse(o => {if (o.material?.isMeshPhysicalMaterial) meshes.push(o);});
    const inner = meshes.find(o => o.material.transmission === 0);
    const outer = meshes.find(o => o.material.transmission > 0);
    if (!inner || !outer || meshes.length !== 2) throw Error('Actual dual jade scene required');
    const originals = [inner.geometry, outer.geometry], loops = states.map(s => s.frameloop);
    const rotator = inner.parent.parent, originalYaw = rotator.rotation.y;
    try {
      const bytes = await (await fetch(q.bridge + entry.preparedPath)).arrayBuffer();
      const expected = {generation: entry.generation ?? q.registry.generation,
        geometryGeneration: entry.geometryGeneration, sourceSha256: entry.sourceSha256};
      newPair = entry.format === 'binary-v2'
        ? await q.binaryDecoder.decodePreparedModelDelivery(bytes, expected)
        : await q.oldDecoder.decodePreparedModel(JSON.parse(new TextDecoder().decode(bytes)), expected);
      for (const s of states) s.setFrameloop('never');
      const gl = main.gl.getContext(), width = main.gl.domElement.width, height = main.gl.domElement.height;
      const reference = new Uint8Array(width * height * 4), repeat = new Uint8Array(reference.length);
      const candidate = new Uint8Array(reference.length), views = [], images = [];
      const render = (pair, pixels) => {
        inner.geometry = pair.base; outer.geometry = pair.outer;
        if (!pair.base.boundingBox) pair.base.computeBoundingBox();
        main.gl.render(main.scene, main.camera);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        if (gl.getError() !== gl.NO_ERROR) throw Error('WebGL readback failed');
      };
      const difference = (a, b) => {
        let sum = 0, max = 0, changed = 0;
        for (let i = 0; i < a.length; i++) {
          const d = Math.abs(a[i] - b[i]); sum += d; if (d) changed++; if (d > max) max = d;
        }
        return {sum, max, changedChannels: changed};
      };
      for (let view = 0; view < 16; view++) {
        rotator.rotation.y = view * Math.PI / 8;
        render(oldPair, reference); render(oldPair, repeat);
        const noise = difference(reference, repeat);
        render(newPair, candidate);
        const diff = difference(reference, candidate);
        if (diff.sum > noise.sum || diff.max > noise.max || diff.changedChannels > noise.changedChannels) {
          throw Error('Jade pixel regression: ' + JSON.stringify({sourcePath, view, noise, diff}));
        }
        views.push({view, noise, diff});
        if (capture && view === 4) images.push({name: sourcePath.split('/').at(-1), data: main.gl.domElement.toDataURL('image/png')});
      }
      let turn = null;
      if (rotation) {
        const props = window.__infiniteRegression.readProps();
        const velocity = props.rotationVelocityRef || props.scrollVelocityRef;
        const previousVelocity = velocity.current;
        let previous = rotator.rotation.y, radians = 0, frames = 0, stable = true;
        try {
          velocity.current = 8; main.setFrameloop('always');
          const started = performance.now();
          await new Promise(resolve => {
            const tick = now => {
              radians += Math.abs(rotator.rotation.y - previous); previous = rotator.rotation.y; frames++;
              stable &&= inner.geometry === newPair.base && outer.geometry === newPair.outer &&
                meshes.every(o => o.visible && o.material.normalMap?.image && o.material.envMap &&
                  main.gl.properties.get(o.material).currentProgram);
              if (now - started >= 2200) resolve(); else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
          turn = {radians, frames, stable: Boolean(stable)};
          if (radians < Math.PI * 2 || !stable) throw Error('Actual jade rotation regression: ' + JSON.stringify(turn));
        } finally {velocity.current = previousVelocity; main.setFrameloop('never');}
      }
      return {sourcePath, views, turn, width, height, images};
    } finally {
      inner.geometry = originals[0]; outer.geometry = originals[1]; rotator.rotation.y = originalYaw;
      main.gl.render(main.scene, main.camera);
      states.forEach((s, i) => s.setFrameloop(loops[i]));
      oldPair.base.dispose(); oldPair.outer.dispose(); newPair?.base.dispose(); newPair?.outer.dispose();
    }
  }, {sourcePath, rotation, capture});
}
