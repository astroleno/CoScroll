import {touchTap, samplePerformance} from './ego-performance.mjs';
import {installInfiniteProbe} from './ego-infinite.mjs';

/** Real Chromium touch input; optional PointerEvent suppression proves the
 * native TouchEvent path is independent. This does not emulate WebKit. */
export async function verifyTouchWheel(page) {
  await installInfiniteProbe(page);
  if (!await page.evaluate(()=>document.querySelector('audio').paused)) await touchTap(page,'button[aria-label="Pause"]');
  await page.evaluate(()=>window.__infiniteRegression.seek(60));
  await page.waitForFunction(()=>Math.abs(document.querySelector('audio').currentTime-60)<.01,undefined,{timeout:15000});
  await page.evaluate(()=>{
    const main=window.__renderProbe.stores.map(s=>s.getState()).find(s=>!s.gl.domElement.closest('[data-coscroll-background]'));
    let mesh;main.scene.traverse(o=>{if(o.isMesh&&o.material.isMeshPhysicalMaterial)mesh=o;});
    const q=window.__touchWheel={events:[],angles:[],rotation:mesh.parent.parent,active:true};
    q.suppress=e=>{if(e.pointerType==='touch')e.stopImmediatePropagation();};
    q.observe=e=>q.events.push({type:e.type,at:performance.now(),x:e.changedTouches[0]?.clientX,prevented:e.defaultPrevented});
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])window.addEventListener(type,q.suppress,true);
    for(const type of ['touchstart','touchmove','touchend','touchcancel'])document.querySelector('main').addEventListener(type,q.observe);
    const tick=()=>{if(!q.active)return;q.angles.push({at:performance.now(),angle:q.rotation.rotation.y});requestAnimationFrame(tick);};requestAnimationFrame(tick);
  });
  const gestures=[];
  try {
    for(const direction of [-1,1,-1,1]) {
      const start=await page.evaluate(()=>({at:performance.now(),absolute:window.__infiniteRegression.read().absolute}));
      await page.cdp('Input.synthesizeScrollGesture',{x:direction<0?310:70,y:410,xDistance:direction*240,yDistance:0,speed:2400,gestureSourceType:'touch',preventFling:true});
      await samplePerformance(page,1800);
      const result=await page.evaluate(start=>{
        const q=window.__touchWheel,events=q.events.filter(e=>e.at>=start.at),angles=q.angles.filter(e=>e.at>=start.at);
        const begin=events.find(e=>e.type==='touchstart'),end=events.findLast(e=>e.type==='touchend');
        const peak=angles.slice(1).reduce((max,p,i)=>Math.max(max,Math.abs((p.angle-angles[i].angle)*1000/(p.at-angles[i].at))),0);
        return {start,end:window.__infiniteRegression.read(),expected:begin&&end?start.absolute-(end.x-begin.x)/12:null,events,
          peakRadiansPerSecond:peak,rotation:angles.at(-1).angle-angles[0].angle};
      },start);
      if(result.expected===null||Math.abs(result.end.absolute-result.expected)>.1||!result.end.paused||
        result.events.some(e=>e.type==='touchcancel')||result.peakRadiansPerSecond<2||
        Math.sign(result.rotation)!==direction)throw Error('Fast native touch failed '+JSON.stringify(result));
      gestures.push(result);
    }
    // A final coordinate can arrive without a delivered move on a busy frame.
    const finalOnly=await page.evaluate(()=>{
      const surface=document.querySelector('main'),before=window.__infiniteRegression.read().absolute;
      const make=x=>new Touch({identifier:998,target:surface,clientX:x,clientY:410});
      surface.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[make(250)],changedTouches:[make(250)]}));
      surface.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[make(130)]}));
      return {before,expected:before+10};
    });
    await page.waitForFunction(expected=>Math.abs(window.__infiniteRegression.read().absolute-expected)<.1,finalOnly.expected,{timeout:10000});
    const cancellation=await page.evaluate(()=>{
      const surface=document.querySelector('main'),before=window.__infiniteRegression.read().absolute;
      const make=x=>new Touch({identifier:999,target:surface,clientX:x,clientY:410});
      for(const [type,x]of [['touchstart',250],['touchmove',130],['touchcancel',0]])surface.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchcancel'?[]:[make(x)],changedTouches:[make(x)]}));
      return {before,expected:before+10};
    });
    await page.waitForFunction(expected=>Math.abs(window.__infiniteRegression.read().absolute-expected)<.1,cancellation.expected,{timeout:10000});
    await touchTap(page,'button[aria-label="Play"]');
    await page.waitForFunction(()=>!document.querySelector('audio').paused,undefined,{timeout:10000});
    await page.cdp('Input.synthesizeScrollGesture',{x:310,y:410,xDistance:-180,yDistance:0,speed:1500,gestureSourceType:'touch',preventFling:true});
    await samplePerformance(page,1000);
    const playing=await page.evaluate(()=>window.__infiniteRegression.read());
    if(playing.paused)throw Error('Touch changed playback intent');
    await touchTap(page,'button[aria-label="Pause"]');
    return {gestures,finalOnly,cancellation,playing,pointerIndependent:true};
  } finally {
    await page.evaluate(()=>{
      const q=window.__touchWheel;q.active=false;
      for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])window.removeEventListener(type,q.suppress,true);
      for(const type of ['touchstart','touchmove','touchend','touchcancel'])document.querySelector('main').removeEventListener(type,q.observe);
    });
  }
}
