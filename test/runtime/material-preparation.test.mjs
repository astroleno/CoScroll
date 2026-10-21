import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {Scene,Mesh,MeshBasicMaterial,PlaneGeometry,PerspectiveCamera} from 'three';

await mkdir(resolve('.cache'),{recursive:true});
const folder=await mkdtemp(join(resolve('.cache'),'material-preparation-test-'));
after(()=>rm(folder,{recursive:true,force:true}));
const source=await readFile(resolve('src/utils/prepareMaterialPrograms.ts'),'utf8');
const file=join(folder,'prepare.mjs');await writeFile(file,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText);
const {prepareMaterialPrograms}=await import(pathToFileURL(file));
function fixture(){const material=new MeshBasicMaterial(),scene=new Scene(),camera=new PerspectiveCamera();scene.add(new Mesh(new PlaneGeometry(),material));let disposed=0;material.addEventListener('dispose',()=>disposed++);return{scene,camera,material,count:()=>disposed};}

test('unmounted materials remain valid until asynchronous compilation finishes',async()=>{
 const f=fixture(),original=f.material.dispose;let finish;
 const job=prepareMaterialPrograms({compileAsync:()=>new Promise(resolve=>finish=resolve)},f.scene,f.camera);
 f.material.dispose();f.scene.clear();assert.equal(f.count(),0);
 finish(f.scene);await job;assert.equal(f.count(),1);assert.equal(f.material.dispose,original);assert.equal(Object.hasOwn(f.material,'dispose'),false);
});
test('concurrent compilations share ownership and dispose once after the final job',async()=>{
 const f=fixture(),pending=[];const renderer={compileAsync:()=>new Promise(resolve=>pending.push(resolve))};
 const a=prepareMaterialPrograms(renderer,f.scene,f.camera),b=prepareMaterialPrograms(renderer,f.scene,f.camera);
 f.material.dispose();f.material.dispose();pending[0](f.scene);await a;assert.equal(f.count(),0);pending[1](f.scene);await b;assert.equal(f.count(),1);
});
test('a rejected or synchronous failed compile releases every lease and propagates failure',async()=>{
 for(const sync of [false,true]){const f=fixture(),original=f.material.dispose;
  await assert.rejects(prepareMaterialPrograms({compileAsync:()=>{if(sync)throw Error('compile failure');return Promise.reject(Error('compile failure'));}},f.scene,f.camera),/compile failure/);
  assert.equal(f.material.dispose,original);f.material.dispose();assert.equal(f.count(),1);
 }
});
test('successful preparation does not dispose a live material or change its callbacks',async()=>{
 const f=fixture(),original=f.material.dispose,hook=f.material.onBeforeCompile;
 await prepareMaterialPrograms({compileAsync:()=>Promise.resolve(f.scene)},f.scene,f.camera);
 assert.equal(f.count(),0);assert.equal(f.material.dispose,original);assert.equal(f.material.onBeforeCompile,hook);
});
