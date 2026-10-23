import {touchTap} from './ego-performance.mjs';
import {installInfiniteProbe} from './ego-infinite.mjs';

export async function selectClassic(page, id) {
  if (await page.evaluate(id => document.querySelector('[data-active-project]')?.getAttribute('data-active-project') === id, id)) {
    if (await page.evaluate(() => Boolean(document.querySelector('dialog')?.open))) await page.click('button[aria-label="关闭面板"]');
    return;
  }
  if (!await page.evaluate(() => document.querySelector('dialog')?.open)) {
    await page.click('button[aria-label^="切换经典，当前"]');
  }
  await page.click(`[data-project-option="${id}"]`);
  await page.waitForFunction(id => {
    const audio = document.querySelector('audio');
    const file = id === 'heart-sutra' ? '心经_2.mp3' : 'lotus-sutra-zanshi.mp3';
    return document.querySelector('[data-active-project]')?.getAttribute('data-active-project') === id &&
      audio?.readyState >= 3 && decodeURIComponent(audio.currentSrc).endsWith('/' + file) && !document.querySelector('dialog')?.open;
  }, id, {timeout: 30000});
}

export async function classicState(page) {
  return page.evaluate(() => {
    const audio = document.querySelector('audio');
    return {project: document.querySelector('[data-active-project]').getAttribute('data-active-project'),
      title: document.title, url: location.href, duration: audio.duration, time: audio.currentTime, paused: audio.paused,
      status: document.querySelector('[data-model-status]')?.textContent,
      stableAudio: !window.__classicNodes || audio === window.__classicNodes.audio,
      stableCanvases: !window.__classicNodes || Array.from(document.querySelectorAll('canvas')).every((c,i) => c === window.__classicNodes.canvases[i]),
      contexts: document.querySelectorAll('canvas').length,
      memory: window.__renderProbe.stores.map(store => {const r=store.getState();return {...r.gl.info.memory, programs:r.gl.info.programs.length};})};
  });
}

export async function verifyClassicSessions(page) {
  await installInfiniteProbe(page);
  if (!await page.evaluate(() => document.querySelector('audio').paused)) await touchTap(page, 'button[aria-label="Pause"]');
  await page.evaluate(() => {window.__classicNodes={audio:document.querySelector('audio'),canvases:Array.from(document.querySelectorAll('canvas'))};});
  const states=[];
  for (let i=0;i<8;i++) {
    await selectClassic(page, i%2 ? 'heart-sutra' : 'lotus-sutra-zanshi');
    const state=await classicState(page);states.push(state);
    if (!state.paused || state.time>1 || !state.stableAudio || !state.stableCanvases || state.contexts!==2) throw Error('Switch reset/ownership failure '+JSON.stringify(state));
  }
  await touchTap(page,'button[aria-label="Play"]');
  await page.waitForFunction(()=>!document.querySelector('audio').paused,undefined,{timeout:10000});
  await selectClassic(page,'lotus-sutra-zanshi');
  await page.waitForFunction(()=>!document.querySelector('audio').paused,undefined,{timeout:10000});
  states.push({playingSwitch:true,...await classicState(page)});

  // Delay only the incoming lyric. The previous recording remains interactive.
  // Remove this page's optional build-time hint to exercise the HTTP fallback.
  await page.evaluate(()=>{
    const node=document.getElementById('coscroll-entry-data');
    if(node){window.__savedEntryNode=node;node.remove();}
  });
  await page.evaluate(()=>{
    const original=window.fetch;window.__classicFetch=original;
    window.__classicLoadStarted=false;
    window.fetch=async function(input,...rest){
      if(decodeURIComponent(String(input)).includes('/lyrics/心经.lrc')){
        window.__classicLoadStarted=true;
        await new Promise(resolve=>{window.__releaseClassicLoad=resolve;});
      }
      return original.call(this,input,...rest);
    };
  });
  try {
    await page.click('button[aria-label^="切换经典，当前"]');
    await page.click('[data-project-option="heart-sutra"]');
    await page.waitForFunction(()=>window.__classicLoadStarted,undefined,{timeout:10000});
    await page.click('button[aria-label="关闭面板"]');
    await touchTap(page,'button[aria-label="Pause"]');
    await page.evaluate(()=>window.__releaseClassicLoad());
    await page.waitForFunction(()=>document.querySelector('[data-active-project]').getAttribute('data-active-project')==='heart-sutra'&&document.querySelector('audio').readyState>=3,undefined,{timeout:15000});
    const state=await classicState(page);states.push({pauseDuringLoad:true,...state});
    if(!state.paused||state.time>1)throw Error('Loading ignored a newer pause');
  } finally {await page.evaluate(()=>{
    window.__releaseClassicLoad?.();delete window.__releaseClassicLoad;delete window.__classicLoadStarted;
    window.fetch=window.__classicFetch;delete window.__classicFetch;
  });}

  await page.evaluate(()=>{
    const original=window.fetch;window.__classicFetch=original;window.__raceStarted=false;window.__raceFinished=false;
    window.fetch=async function(input,...rest){
      if(String(input).includes('/lyrics/lotus-sutra-zanshi.lrc')){
        window.__raceStarted=true;
        await new Promise(resolve=>{window.__releaseClassicRace=resolve;});window.__raceFinished=true;
      }
      return original.call(this,input,...rest);
    };
  });
  try {
    await page.click('button[aria-label^="切换经典，当前"]');
    await page.click('[data-project-option="lotus-sutra-zanshi"]');
    await page.waitForFunction(()=>window.__raceStarted,undefined,{timeout:10000});
    await page.click('[data-project-option="heart-sutra"]');
    await page.evaluate(()=>window.__releaseClassicRace());
    await page.waitForFunction(()=>window.__raceFinished,undefined,{timeout:10000});
    const state=await classicState(page);states.push({canceledSwitch:true,...state});
    if(state.project!=='heart-sutra'||!state.paused)throw Error('Canceled recording overwrote the old session');
  } finally {await page.evaluate(()=>{
    window.__releaseClassicRace?.();delete window.__releaseClassicRace;
    window.fetch=window.__classicFetch;delete window.__classicFetch;
  });}

  await page.evaluate(()=>{
    const original=window.fetch;window.__classicFetch=original;
    window.__expectedErrorStart=window.__coscrollPerf.errors.length;
    window.fetch=function(input,...rest){
      if(String(input).includes('/lyrics/lotus-sutra-zanshi.lrc'))return Promise.resolve(new Response('',{status:503}));
      return original.call(this,input,...rest);
    };
  });
  let expectedErrors;
  try {
    await page.click('[data-project-option="lotus-sutra-zanshi"]');
    await page.waitForSelector('dialog [role="alert"]',{state:'visible',timeout:10000});
    const state=await classicState(page);states.push({failedSwitch:true,...state});
    if(state.project!=='heart-sutra'||!state.stableAudio||!state.paused)throw Error('Failed recording replaced usable content');
    expectedErrors=await page.evaluate(()=>window.__coscrollPerf.errors.slice(window.__expectedErrorStart));
  } finally {await page.evaluate(()=>{window.fetch=window.__classicFetch;delete window.__classicFetch;});}
  await page.evaluate(()=>{if(window.__savedEntryNode){document.head.appendChild(window.__savedEntryNode);delete window.__savedEntryNode;}});
  await selectClassic(page,'lotus-sutra-zanshi');
  return {states,expectedErrors};
}

export async function verifyLotusAnchors(page) {
  await installInfiniteProbe(page);
  const states=[];
  for(const [time,target,actual] of [[0,'妙','妙'],[46,'竹','竹'],[58,'生','生'],[99,'海','海'],[103,'化','化'],
    [136,'法','法'],[148,'心','心'],[166,'土','土'],[170,'雨','雨'],[174,'妙','妙'],[178,'天','天'],
    [182,'无','无'],[190,'妙','妙'],[193,'生','生'],[199,'无','无']]){
    await page.evaluate(time=>window.__infiniteRegression.seek(time),time);
    await page.waitForFunction(({time,target,actual})=>{
      const status=document.querySelector('[data-model-status]');return Math.abs(document.querySelector('audio').currentTime-time)<.01&&
        status?.getAttribute('data-anchor')===target&&status?.getAttribute('data-rendered-character')===actual;
    },{time,target,actual},{timeout:15000});
    states.push({time,target,actual,...await classicState(page)});
  }
  const fonts=await page.evaluate(()=>({check:document.fonts.check('16px RunZhiJiaKangXiZidian','栴'),
    faces:Array.from(document.fonts).filter(f=>f.family.includes('RunZhiJia')).map(f=>({family:f.family,range:f.unicodeRange,status:f.status}))}));
  if(!fonts.check||!fonts.faces.some(f=>f.range==='U+6834'&&f.status==='loaded'))throw Error('Supplement glyph not loaded');
  return {states,fonts};
}

export async function verifyNativeGestures(page) {
  await installInfiniteProbe(page);const results=[];
  await page.evaluate(()=>window.__infiniteRegression.seek(60));
  await page.waitForFunction(()=>Math.abs(document.querySelector('audio').currentTime-60)<.01,undefined,{timeout:10000});
  const point=x=>({x,y:350,id:1,radiusX:2,radiusY:2,force:1});
  for(const [from,to,expected] of [[280,100,75],[100,280,60]]){
    await page.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(from)]});
    for(let step=1;step<=5;step++)await page.cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(from+(to-from)*step/5)]});
    await page.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(expected=>Math.abs(document.querySelector('audio').currentTime-expected)<.1,expected,{timeout:15000});
    results.push({touchDrag:true,...await page.evaluate(()=>window.__infiniteRegression.read())});
  }
  for(const cycle of [0,-3]){
    await page.evaluate(cycle=>window.__infiniteRegression.seek(cycle*document.querySelector('audio').duration+7),cycle);
    await page.waitForFunction(cycle=>window.__infiniteRegression.read().cycle===cycle&&Math.abs(document.querySelector('audio').currentTime-7)<.01,cycle,{timeout:10000});
    const rect=await page.evaluate(()=>{const r=document.querySelector('input[aria-label="播放进度"]').getBoundingClientRect();return{x:r.x,y:r.y+r.height/2,w:r.width};});
    await page.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point(0),x:rect.x+rect.w*.2,y:rect.y}]});
    // The midpoint is independent of the browser's native thumb width and
    // integer range step; an arbitrary 55% CSS coordinate is not 55% value.
    await page.cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point(0),x:rect.x+rect.w*.5,y:rect.y}]});
    await page.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(cycle=>{const s=window.__infiniteRegression.read();return s.cycle===cycle&&Math.abs(s.mediaTime-s.duration*.5)<2;},cycle,{timeout:15000});
    results.push({touchScrub:true,...await page.evaluate(()=>window.__infiniteRegression.read())});
  }
  await page.evaluate(()=>window.__infiniteRegression.seek(0));
  await page.waitForFunction(()=>Math.abs(window.__infiniteRegression.read().absolute)<.01&&document.querySelector('audio').currentTime<.01,undefined,{timeout:10000});
  await page.press('input[aria-label="播放进度"]','ArrowLeft');
  await page.waitForFunction(()=>window.__infiniteRegression.read().cycle===-1,undefined,{timeout:10000});
  await page.press('input[aria-label="播放进度"]','ArrowRight');
  await page.waitForFunction(()=>window.__infiniteRegression.read().cycle===0,undefined,{timeout:10000});
  results.push({keyboardAcrossBoundary:true,...await page.evaluate(()=>window.__infiniteRegression.read())});
  return results;
}

export async function verifyNaturalLoops(page, checkpoint=()=>{}) {
  await installInfiniteProbe(page);
  await page.evaluate(()=>window.__infiniteRegression.seek(0));
  await page.waitForFunction(()=>{const s=window.__infiniteRegression.read();return s.paused&&s.cycle===0&&s.mediaTime<.01;},undefined,{timeout:15000});
  await page.evaluate(()=>{
    const q=window.__nativeLoop={assignments:[],wraps:[],lastPhase:0,audio:document.querySelector('audio')};
    q.descriptor=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime');
    Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{...q.descriptor,set(value){if(this===q.audio)q.assignments.push({at:performance.now(),value});return q.descriptor.set.call(this,value);}});
    q.listener=()=>{if(q.lastPhase-q.audio.currentTime>q.audio.duration*.5)q.wraps.push({at:performance.now(),phase:q.audio.currentTime});q.lastPhase=q.audio.currentTime;};
    q.audio.addEventListener('timeupdate',q.listener);q.audio.playbackRate=16;q.oldMuted=q.audio.muted;q.audio.muted=true;
  });
  const samples=[];let natural;
  try{
    await touchTap(page,'button[aria-label="Play"]');
    await page.waitForFunction(()=>!document.querySelector('audio').paused&&document.querySelector('audio').currentTime>.1,undefined,{timeout:10000});
    await page.evaluate(()=>{const q=window.__nativeLoop;q.initialAssignments=q.assignments;q.assignments=[];});
    for(let i=0;i<10;i++){
      await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,10000)));
      const state=await page.evaluate(()=>({...window.__infiniteRegression.read(),nativeWraps:window.__nativeLoop.wraps.length,assignments:window.__nativeLoop.assignments.slice(),errors:window.__coscrollPerf.errors}));
      samples.push(state);await checkpoint({rate:16,samples});
      const main=state.memory.find(r=>!r.background);
      if(state.errors.length||state.assignments.length||state.velocity!==0||main.geometries>25||main.textures>30)throw Error('Natural loop resource/seek regression '+JSON.stringify(state));
      if(state.cycle>=3&&state.nativeWraps>=3)break;
    }
    if(samples.at(-1).cycle<3||samples.at(-1).nativeWraps<3)throw Error('Three complete loops did not finish');
    natural=await page.evaluate(()=>({initialAssignments:window.__nativeLoop.initialAssignments,assignments:window.__nativeLoop.assignments,wraps:window.__nativeLoop.wraps}));
  }finally{
    await page.evaluate(()=>{const q=window.__nativeLoop;q.audio.playbackRate=1;q.audio.muted=q.oldMuted;q.audio.removeEventListener('timeupdate',q.listener);Object.defineProperty(HTMLMediaElement.prototype,'currentTime',q.descriptor);});
    if(await page.evaluate(()=>!document.querySelector('audio').paused))await touchTap(page,'button[aria-label="Pause"]');
  }
  const boundaries=[];
  for(const cycle of [-1,0]){
    await page.evaluate(cycle=>window.__infiniteRegression.seek((cycle+1)*document.querySelector('audio').duration-.5),cycle);
    await page.waitForFunction(cycle=>window.__infiniteRegression.read().cycle===cycle&&document.querySelector('audio').currentTime>document.querySelector('audio').duration-1,cycle,{timeout:10000});
    await touchTap(page,'button[aria-label="Play"]');
    await page.waitForFunction(cycle=>window.__infiniteRegression.read().cycle===cycle+1&&document.querySelector('audio').currentTime>.25,cycle,{timeout:10000});
    await touchTap(page,'button[aria-label="Pause"]');boundaries.push(await page.evaluate(()=>window.__infiniteRegression.read()));
  }
  return {rate:16,samples,natural,oneTimesBoundaries:boundaries};
}
