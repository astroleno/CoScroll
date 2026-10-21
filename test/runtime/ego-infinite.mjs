/** Ego-only diagnostics: inspect this app's React props without shipping debug globals. */
export async function installInfiniteProbe(page) {
  return page.evaluate(() => {
    const readProps = () => {
      const main = document.querySelector('main');
      const key = Object.keys(main).find(key => key.startsWith('__reactFiber$'));
      let fiber = main[key];
      while (fiber.return) fiber = fiber.return;
      const stack = [fiber.stateNode?.current || fiber];
      while (stack.length) {
        const node = stack.pop(), props = node.memoizedProps;
        if (props?.scrollTimeRef && props?.currentAnchor !== undefined && props?.duration) return props;
        if (node.child) stack.push(node.child);
        if (node.sibling) stack.push(node.sibling);
      }
      throw Error('Unified timeline props not found');
    };
    const q = window.__infiniteRegression = {
      readProps,
      read() {
        const p = readProps(), a = document.querySelector('audio');
        return {absolute: p.scrollTimeRef.current, propAbsolute: p.scrollTime, phase: p.currentTime,
          cycle: Math.floor(p.scrollTimeRef.current / a.duration), duration: a.duration,
          mediaTime: a.currentTime, paused: a.paused, rate: a.playbackRate,
          velocity: p.scrollVelocity,
          memory: window.__renderProbe.stores.map(s => {const r=s.getState();return {background:!!r.gl.domElement.closest('[data-coscroll-background]'),...r.gl.info.memory};})};
      },
      seek(absolute) { readProps().onSeek(absolute); },
    };
    return q.read();
  });
}

export async function verifyInfiniteCommands(page) {
  const states = [];
  const initial = await installInfiniteProbe(page);
  if (!initial.paused) throw Error('Pause before command tests');
  const base = initial.duration;
  for (const cycle of [0,-1,-4,4,10000,-10000,1000000,-1000000,0]) {
    await page.evaluate(({cycle,base})=>window.__infiniteRegression.seek(cycle*base+7),{cycle,base});
    await page.waitForFunction(cycle=>{const s=window.__infiniteRegression.read();return s.cycle===cycle&&Math.abs(s.mediaTime-7)<.01&&Math.abs(s.absolute-(cycle*s.duration+7))<.01;},cycle,{timeout:15000});
    states.push(await page.evaluate(()=>window.__infiniteRegression.read()));
  }
  // Native wheel events exercise accumulated multi-cycle movement in both directions.
  await page.mouse.move(195,350,{label:'position over lyric gestures'});
  for (const delta of [base*12*4+120,-base*12*7-240,base*12*3+120]) {
    const before=await page.evaluate(()=>window.__infiniteRegression.read());
    await page.evaluate(()=>{window.__infiniteWheelEvents=[];document.addEventListener('wheel',e=>window.__infiniteWheelEvents.push({x:e.deltaX,y:e.deltaY,mode:e.deltaMode}),{capture:true,once:true});});
    await page.cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:195,y:350,deltaX:delta,deltaY:0});
    await page.waitForFunction(()=>window.__infiniteWheelEvents.length===1,undefined,{timeout:10000});
    const native=await page.evaluate(()=>window.__infiniteWheelEvents[0]);
    const expected=before.absolute+(native.x*(native.mode===1?16:1)||native.y)/12;
    await page.waitForFunction(expected=>Math.abs(window.__infiniteRegression.read().absolute-expected)<.05,expected,{timeout:15000});
    await page.waitForFunction(expected=>{const s=window.__infiniteRegression.read();const phase=((expected%s.duration)+s.duration)%s.duration;return Math.abs(s.mediaTime-phase)<.05;},expected,{timeout:15000});
    states.push({wheel:delta,native,...await page.evaluate(()=>window.__infiniteRegression.read())});
  }
  // A phase scrub after reverse scrolling must stay in that negative cycle.
  await page.evaluate(base=>window.__infiniteRegression.seek(-3*base+7),base);
  await page.waitForFunction(()=>window.__infiniteRegression.read().cycle===-3,undefined,{timeout:10000});
  await page.evaluate(()=>{const e=document.querySelector('input[type="range"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'25');e.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>{const s=window.__infiniteRegression.read();return s.cycle===-3&&Math.abs(s.mediaTime-25)<.01&&Math.abs(s.absolute-(-3*s.duration+25))<.01;},undefined,{timeout:15000});
  states.push({negativeScrub:true,...await page.evaluate(()=>window.__infiniteRegression.read())});
  await page.waitForFunction(()=>window.__infiniteRegression.read().velocity===0,undefined,{timeout:10000});
  return states;
}

export async function verifyPausedLyricClock(page) {
  const result = await page.evaluate(() => {
    const p=window.__infiniteRegression.readProps(),duration=p.duration;
    const phase=((p.scrollTimeRef.current%duration)+duration)%duration;
    let index=0;for(let i=0;i<p.lyrics.length;i++)if(p.lyrics[i].time<=phase)index=i;
    const next=index+1<p.lyrics.length?p.lyrics[index+1].time:duration+p.lyrics[0].time;
    const progress=(phase-p.lyrics[index].time)/(next-p.lyrics[index].time);
    const expected=-progress*.85,current=[];
    const currentColor=parseInt((p.palette?.currentText||'#f8fafc').slice(1),16);
    for(const store of window.__renderProbe.stores)store.getState().scene.traverse(m=>{
      if(m.material?.isMeshBasicMaterial&&m.material.color.getHex()===currentColor)current.push({x:m.position.x,order:m.renderOrder});
    });
    return {phase,velocity:p.scrollVelocity,expected,current,audio:document.querySelector('audio').currentTime};
  });
  if(result.velocity!==0||result.current.length!==1||Math.abs(result.current[0].x-result.expected)>.00001)throw Error('Paused lyric clock drift: '+JSON.stringify(result));
  return result;
}

/** Controlled overlapping React inputs complement the native gesture regressions. */
export async function verifyLatestGestureCommand(page) {
  const result = await page.evaluate(async () => {
    const overlay=document.querySelector('main').lastElementChild,input=document.querySelector('input[type="range"]');
    overlay.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:180}));
    await new Promise(resolve=>setTimeout(resolve,50));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'25');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,400));
    return {...window.__infiniteRegression.read(),range:input.value,preview:window.__infiniteRegression.readProps().isPreviewMode};
  });
  if(Math.abs(result.mediaTime-25)>.01||result.preview||result.velocity!==0)throw Error('An older gesture overrode the latest seek: '+JSON.stringify(result));
  return result;
}

/**
 * Controlled visibility events exercise the app's foreground synchronizer.
 * Ego keeps its managed documents visible even when another tab has focus;
 * this deliberately does not claim to test OS background media policies.
 */
export async function verifyControlledVisibility(page) {
  await page.evaluate(() => window.__infiniteRegression.seek(100));
  await page.waitForFunction(() => Math.abs(document.querySelector('audio').currentTime - 100) < .01,
    undefined, {timeout: 10000});
  await page.press('button[aria-label="Play"]', 'Enter');
  await page.waitForFunction(() => !document.querySelector('audio').paused, undefined, {timeout: 10000});
  const before = await page.evaluate(() => window.__infiniteRegression.read());
  await page.evaluate(() => {
    const q = window.__controlledVisibility = {
      hidden: false,
      hiddenDescriptor: Object.getOwnPropertyDescriptor(document, 'hidden'),
      stateDescriptor: Object.getOwnPropertyDescriptor(document, 'visibilityState'),
    };
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => q.hidden});
    Object.defineProperty(document, 'visibilityState', {
      configurable: true, get: () => q.hidden ? 'hidden' : 'visible',
    });
    q.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  let hidden, resumed;
  try {
    await page.waitForFunction(before => document.querySelector('audio').currentTime > before + 2,
      before.mediaTime, {timeout: 10000});
    hidden = await page.evaluate(() => ({hidden: document.hidden, ...window.__infiniteRegression.read()}));
    await page.evaluate(() => {
      window.__controlledVisibility.hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    resumed = await page.evaluate(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
      return {hidden: document.hidden, ...window.__infiniteRegression.read()};
    });
    if (!hidden.hidden || resumed.hidden || resumed.paused || resumed.mediaTime < before.mediaTime + 1.5 ||
        Math.abs(resumed.absolute - resumed.mediaTime) > .5) {
      throw Error('Controlled foreground return rewound or lost the native clock: ' + JSON.stringify({before, hidden, resumed}));
    }
  } finally {
    await page.evaluate(() => {
      const q = window.__controlledVisibility;
      if (q.hiddenDescriptor) Object.defineProperty(document, 'hidden', q.hiddenDescriptor);
      else delete document.hidden;
      if (q.stateDescriptor) Object.defineProperty(document, 'visibilityState', q.stateDescriptor);
      else delete document.visibilityState;
      delete window.__controlledVisibility;
      document.dispatchEvent(new Event('visibilitychange'));
      document.querySelector('audio').pause();
    });
    await page.waitForFunction(() => document.querySelector('audio').paused &&
      !!document.querySelector('button[aria-label="Play"]'), undefined, {timeout: 10000});
  }
  return {mode: 'controlled-document-visibility', before, hidden, resumed};
}

export async function verifyLatePlayPause(page) {
  await page.evaluate(() => {
    const original = HTMLMediaElement.prototype.play;
    window.__latePlay = {original, settled: 0};
    HTMLMediaElement.prototype.play = function (...args) {
      return original.apply(this, args).then(() => new Promise(resolve => setTimeout(() => {
        window.__latePlay.settled++;
        resolve();
      }, 1500)));
    };
  });
  try {
    await page.press('button[aria-label="Play"]', 'Enter');
    await page.waitForFunction(() => !document.querySelector('audio').paused, undefined, {timeout: 10000});
    await page.press('button[aria-label="Pause"]', 'Enter');
    await page.waitForFunction(() => window.__latePlay.settled > 0, undefined, {timeout: 10000});
    const result = await page.evaluate(() => ({paused: document.querySelector('audio').paused,
      playButton: !!document.querySelector('button[aria-label="Play"]'),
      playingProp: window.__infiniteRegression.readProps().isPlaying}));
    if (!result.paused || !result.playButton || result.playingProp) throw Error('Late play promise overrode pause');
    return result;
  } finally {
    await page.evaluate(() => {HTMLMediaElement.prototype.play = window.__latePlay.original;});
  }
}
