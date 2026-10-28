// Use after rendererProbeScript(). A development refresh may replace the hook;
// reattach after mounting and exercise a control in that environment.
export async function readerState(page) {
  return page.evaluate(() => {
    const box = selector => {
      const el = document.querySelector(selector), r = el?.getBoundingClientRect();
      return r && {x: r.x, y: r.y, width: r.width, height: r.height};
    };
    const audio = document.querySelector('audio');
    const states = (window.__renderProbe?.stores || []).map(store => store.getState());
    const main = states.find(s => !s.gl.domElement.closest('[data-coscroll-background]'));
    const background = states.find(s => s.gl.domElement.closest('[data-coscroll-background]'));
    let silkTime;
    background?.scene.traverse(o => {if (o.material?.uniforms?.uTime) silkTime = o.material.uniforms.uTime.value;});
    const meshes = [];
    main?.scene.traverse(o => {
      if (!o.isMesh || !o.visible || o.material.opacity === 0) return;
      const jade = !!o.material.isMeshPhysicalMaterial;
      if (!jade && !o.material.isMeshBasicMaterial) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      let top = Infinity, bottom = -Infinity;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
        const v = main.camera.position.clone().set(x, y, z).applyMatrix4(o.matrixWorld).project(main.camera);
        const pixelY = (1 - v.y) * main.size.height / 2;
        top = Math.min(top, pixelY); bottom = Math.max(bottom, pixelY);
      }
      meshes.push({jade, top, bottom, matrix: [...o.matrixWorld.elements], order: o.renderOrder});
    });
    return {project: document.querySelector('[data-active-project]')?.dataset.activeProject,
      reduced: document.querySelector('[data-reduced-motion]')?.dataset.reducedMotion,
      viewport: {width: innerWidth, height: innerHeight},
      audio: audio && {time: audio.currentTime, paused: audio.paused, duration: audio.duration},
      model: document.querySelector('[data-model-status]')?.textContent,
      modelCharacter: document.querySelector('[data-model-status]')?.dataset.renderedCharacter,
      play: box('button[aria-label="Play"],button[aria-label="Pause"]'), range: box('input[aria-label="播放进度"]'),
      title: box('.classic-title'), main: box('main'), footer: box('footer'),
      transcript: {heading: document.querySelector('[data-coscroll-transcript] h1')?.textContent,
        lines: [...document.querySelectorAll('[data-coscroll-transcript] li')].map(li => li.textContent),
        live: document.querySelector('[data-coscroll-transcript]')?.hasAttribute('aria-live')},
      canvases: document.querySelectorAll('canvas').length, renderers: states.length,
      framing: main && {zoom: main.camera.zoom, centerY: main.camera.position.y}, silkTime, meshes};
  });
}

export function assertReaderLayout(state) {
  if (state.canvases !== 2 || !state.framing || state.model || !state.modelCharacter) throw new Error('Reader scene not ready');
  if ([state.play, state.range, state.title].some(r => !r || r.height < 44)) throw new Error('Reader hit areas are too small');
  if (!state.transcript.heading || !state.transcript.lines.length || state.transcript.live) throw new Error('Missing non-live recording transcript');
  for (const mesh of state.meshes) {
    if (mesh.top < -1 || mesh.bottom > state.main.height + 1) throw new Error(`Reader content clipped: ${JSON.stringify(mesh)}`);
  }
  if (state.viewport.height < 600 && state.footer.height > 90) throw new Error('Short viewport footer still consumes the scene');
  return {project: state.project, viewport: state.viewport, main: state.main, footer: state.footer,
    framing: state.framing, play: state.play, range: state.range, transcriptLines: state.transcript.lines.length,
    meshesChecked: state.meshes.length, model: state.modelCharacter};
}

export async function assertReducedStill(page) {
  const before = await readerState(page);
  await page.evaluate(() => new Promise(resolve => {
    let frames = 0;
    const frame = () => ++frames >= 30 ? resolve(null) : requestAnimationFrame(frame);
    requestAnimationFrame(frame);
  }));
  const after = await readerState(page);
  if (before.reduced !== 'true' || after.reduced !== 'true' || !after.audio.paused || typeof before.silkTime !== 'number') throw new Error('Reduced pause precondition missing');
  if (before.silkTime !== after.silkTime || JSON.stringify(before.meshes) !== JSON.stringify(after.meshes)) {
    throw new Error('Reduced scene continued moving while paused');
  }
  return {time: after.audio.time, silkTime: after.silkTime, stillFrames: 30, reduced: true};
}
