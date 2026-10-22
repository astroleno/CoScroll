import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../../src/components/hooks/useScrollVelocity.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText
  .replace(/import \{[^}]+\} from 'react';/, 'const {useState,useEffect,useCallback,useRef}=globalThis.__touchHookHarness;')
  .replace(/import timelineStore from [^;]+;/, 'const timelineStore=globalThis.__touchHookTimeline;');
const effects=[],updates=[],queue=new Map();let nextId=0,clock=1000;
globalThis.__touchHookHarness={useState:value=>[value,v=>updates.push(v)],useRef:value=>({current:value}),
  useCallback:fn=>fn,useEffect:fn=>effects.push(fn)};
globalThis.__touchHookTimeline={velocity:0,setScrollVelocity(v){this.velocity=v;}};
const {useScrollVelocity}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));

function run(publish, verify) {
  const oldRaf=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
  const oldPerformance=Object.getOwnPropertyDescriptor(globalThis,'performance');
  effects.length=updates.length=0;queue.clear();clock=1000;
  globalThis.requestAnimationFrame=fn=>{const id=++nextId;queue.set(id,fn);return id;};
  globalThis.cancelAnimationFrame=id=>queue.delete(id);
  Object.defineProperty(globalThis,'performance',{value:{now:()=>clock},configurable:true});
  const hook=useScrollVelocity(publish),cleanups=effects.map(fn=>fn());
  const frame=(ms=33)=>{clock+=ms;const jobs=[...queue.values()];queue.clear();jobs.forEach(fn=>fn(clock));};
  try {verify(hook,frame);} finally {
    cleanups.forEach(fn=>fn?.());globalThis.requestAnimationFrame=oldRaf;globalThis.cancelAnimationFrame=oldCancel;
    Object.defineProperty(globalThis,'performance',oldPerformance);
  }
}

test('a move and release in one frame retain wheel momentum while the lyric clock stops',()=>run(false,(hook,frame)=>{
  assert.equal(queue.size,0);
  hook.handleScrollVelocityChange(2.4);
  hook.handleScrollVelocityChange(0,2.4);
  assert.equal(hook.scrollVelocityRef.current,0);
  assert.equal(globalThis.__touchHookTimeline.velocity,0);
  frame();assert.ok(hook.rotationVelocityRef.current>2);
  assert.equal(hook.scrollVelocityRef.current,0);
  for(let i=0;i<500&&queue.size;i++)frame();
  assert.equal(hook.rotationVelocityRef.current,0);
  assert.equal(queue.size,0);assert.deepEqual(updates,[]);
}));

test('a newer explicit seek or canceled gesture clears an older wheel impulse',()=>run(false,(hook,frame)=>{
  hook.handleScrollVelocityChange(0,2);
  hook.handleScrollVelocityChange(0);
  frame();assert.equal(hook.rotationVelocityRef.current,0);assert.equal(queue.size,0);
}));

test('the final zero publishes even within the state throttle interval, then sleeps',()=>run(true,(hook,frame)=>{
  hook.handleScrollVelocityChange(4);frame();assert.ok(updates.some(v=>v>1));
  hook.handleScrollVelocityChange(.0006);frame(8);frame(8);frame(8);
  assert.equal(updates.at(-1),0);assert.equal(hook.scrollVelocityRef.current,0);assert.equal(queue.size,0);
}));
