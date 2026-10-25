import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';

const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const commit='ac872e82eb04ce10632335b3f6e03c7146874116';
function harness(){
  const refs=[],effects=[],timers=new Map(),logs=[],observed=[];let timerId=0;
  const react={
    createElement:(type,props,...children)=>({type,props:{...props,children}}),
    useRef:value=>{const ref={current:value};refs.push(ref);return ref;},
    useCallback:callback=>callback,
    useState:value=>[typeof value==='function'?value():value,()=>{}],
    useEffect:effect=>{effects.push(effect);},
  };
  const timeline={pendingAudioSeek:null,audioDisplayTime:0,
    setAudioTime(){},registerAudioClock(){return ()=>{};}};
  const context=vm.createContext({window:{},Date,Math,performance,
    console:{warn:(...args)=>logs.push({level:'warn',args}),error:(...args)=>logs.push({level:'error',args}),log(){}},
    setTimeout:(callback,delay)=>{const id=++timerId;timers.set(id,{callback,delay});return id;},
    clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
  const loaded=new Map();
  function load(name){
    if(loaded.has(name))return loaded.get(name);
    const source=execFileSync('git',['show',commit+':'+name],{cwd:root,encoding:'utf8'});
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
      target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
    const module={exports:{}};
    const require=id=>{
      if(id==='react')return {__esModule:true,default:react,...react};
      if(id==='@/stores/timelineStore')return {__esModule:true,default:timeline};
      if(id==='@/utils/loopTimeline')return load('src/utils/loopTimeline.ts');
      throw Error('Unexpected import '+id);
    };
    const factory=vm.runInContext('(function(require,module,exports){'+code+'\n})',context,{filename:name});
    factory(require,module,module.exports);loaded.set(name,module.exports);return module.exports;
  }
  function engine(){
    let loadCalls=0;
    const audio={currentTime:0,duration:40,readyState:0,paused:true,error:{code:4},
      buffered:{length:1,end:()=>10},getAttribute:()=>'/test.mp3',load:()=>loadCalls++,pause(){this.paused=true;},removeAttribute(){},};
    const callback=name=>(...args)=>observed.push({name,args});
    const props={sessionRevision:0,audioSrc:'/test.mp3',isPlaying:false,isReady:false,currentTime:0,
      loopCount:0,duration:40,seekSignal:0,enableWebAudio:false,
      onReady:callback('ready'),onDurationChange:callback('duration'),onTimeUpdate:callback('time'),
      onPlayStateChange:callback('playing'),onLoopComplete:callback('loop')};
    const element=load('src/components/audio/AudioEngine.tsx').AudioEngine(props);
    element.props.ref.current=audio;
    for(const effect of effects)effect();
    return {audio,element,loadCalls:()=>loadCalls};
  }
  return {load,refs,effects,timers,logs,observed,engine};
}

const failure=harness(),failed=failure.engine();
for(let n=0;n<3;n++){
  failed.element.props.onError({currentTarget:failed.audio});
  if(n<2){assert.equal(failure.timers.size,1);const [id,timer]=failure.timers.entries().next().value;
    failure.timers.delete(id);timer.callback();}
}
assert.equal(failed.loadCalls(),2);
assert.equal(failure.logs.filter(log=>log.level==='error').length,1);
assert.equal(failure.observed.length,0);
const failedState=failure.refs.find(ref=>ref.current&&typeof ref.current==='object'&&'isBuffering' in ref.current).current;
assert.equal(failedState.isReady,false);

const buffering=harness(),buffered=buffering.engine();
buffered.audio.readyState=4;buffered.element.props.onLoadedMetadata();buffered.element.props.onCanPlay();
buffered.audio.currentTime=9;buffered.element.props.onTimeUpdate({currentTarget:buffered.audio});
const bufferState=buffering.refs.find(ref=>ref.current&&typeof ref.current==='object'&&'isBuffering' in ref.current).current;
assert.equal(bufferState.isBuffering,true);
assert.deepEqual(buffering.observed.map(event=>event.name),['duration','ready','time']);

const pointer=harness(),seeks=[];
const tree=pointer.load('src/components/audio/EnhancedAudioPlayer.tsx').default({
  isPlaying:false,isReady:true,duration:40,currentTime:10,isBuffering:false,
  onPlayPause(){},onSeek:time=>seeks.push(time)});
function find(node,predicate){
  if(!node||typeof node!=='object')return null;
  if(predicate(node))return node;
  for(const child of (node.props?.children||[]).flat(Infinity)){const match=find(child,predicate);if(match)return match;}
  return null;
}
const input=find(tree,node=>node.type==='input'&&node.props.type==='range');assert.ok(input);
input.props.onPointerDown({pointerType:'mouse',button:0,pointerId:1,currentTarget:{setPointerCapture(){}}});
input.props.onChange({target:{value:'20'}});const beforeCancel=seeks.slice();
input.props.onPointerCancel();assert.deepEqual(beforeCancel,[20]);assert.deepEqual(seeks,[20,20]);

const result={sourceCommit:'ac872e82eb04ce10632335b3f6e03c7146874116',
  method:'Execute baseline TSX handlers with a lightweight hook runner, fake audio and deterministic timers. This is not a browser or React DOM lifecycle/network test.',
  startupFailure:{retryLoads:failed.loadCalls(),terminalConsoleErrors:failure.logs.filter(log=>log.level==='error').length,
    parentCallbacks:failure.observed,ready:failedState.isReady},
  buffering:{internalBuffering:bufferState.isBuffering,parentCallbacks:buffering.observed.map(event=>event.name)},
  pointerCancel:{seeksBeforeCancel:beforeCancel,seeksAfterCancel:seeks,
    verdict:'The drag already applied the same target before cancellation; no newly different target is introduced.'}};
console.log(JSON.stringify(result));
