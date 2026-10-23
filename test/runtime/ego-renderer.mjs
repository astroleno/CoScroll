export function rendererProbeScript(){return `(${installRendererProbe.toString()})()`;}
function installRendererProbe(){
  const q=window.__renderProbe={stores:[]},hook=window.__REACT_DEVTOOLS_GLOBAL_HOOK__,original=hook.onCommitFiberRoot;
  hook.onCommitFiberRoot=function(id,root,...args){
    q.stores=q.stores.filter(store=>store.getState().gl?.domElement.isConnected);
    if(q.stores.length<document.querySelectorAll('canvas').length){
      const stack=[root.current];
      while(stack.length){
        const f=stack.pop();if(!f)continue;
        const store=f.stateNode?.__r3f?.root;
        if(store?.getState&&!q.stores.includes(store)&&store.getState().gl?.domElement.isConnected)q.stores.push(store);
        if(f.child)stack.push(f.child);if(f.sibling)stack.push(f.sibling);
      }
    }
    return original?.call(this,id,root,...args);
  };
}

export async function measureGpu(page,duration=6000){return await page.evaluate(async duration=>{
  const probes=window.__renderProbe.stores.map(store=>{
    const state=store.getState(),renderer=state.gl,gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const p={renderer,gl,ext,original:renderer.render,pending:[],cpu:[],gpu:[],background:!!renderer.domElement.closest('[data-coscroll-background]')};
    renderer.render=function(...args){
      if(ext)while(p.pending.length&&gl.getQueryParameter(p.pending[0],gl.QUERY_RESULT_AVAILABLE)){
        const query=p.pending.shift(),ms=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);if(!gl.getParameter(ext.GPU_DISJOINT_EXT))p.gpu.push(ms);
      }
      let query;if(ext&&p.pending.length<8){query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}
      const start=performance.now();
      try{return p.original.apply(this,args);}finally{p.cpu.push(performance.now()-start);if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);p.pending.push(query);}}
    };
    return p;
  });
  const start=performance.now();let frames=0;
  try{await new Promise(resolve=>{const tick=now=>{frames++;if(now-start>=duration)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});}
  finally{for(const p of probes){p.renderer.render=p.original;for(const query of p.pending)p.gl.deleteQuery(query);}}
  const stats=a=>{const sorted=a.slice().sort((a,b)=>a-b);return{count:a.length,mean:a.reduce((s,v)=>s+v,0)/Math.max(1,a.length),p95:sorted[Math.floor(a.length*.95)],max:sorted.at(-1)};};
  return{elapsedMs:performance.now()-start,frames,renderers:probes.map(p=>({background:p.background,cpuMs:stats(p.cpu),gpuMs:stats(p.gpu),timerAvailable:!!p.ext,pixels:[p.renderer.domElement.width,p.renderer.domElement.height],attributes:p.gl.getContextAttributes(),programs:p.renderer.info.programs.length,memory:{...p.renderer.info.memory}}))};
},duration);}

export async function captureFixedFrames(page,fixture){
  // Model publication and the lyric-window React commit can finish on adjacent
  // frames after seek. Observe the expected window before freezing either loop.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(null)))));
  if(fixture)await page.waitForFunction(fixture=>{
    const main=window.__renderProbe.stores.map(s=>s.getState()).find(s=>!s.gl.domElement.closest('[data-coscroll-background]'));
    if(!main)return false;const keys=[];
    main.scene.traverse(o=>{if(o.isMesh)keys.push(o.material.isMeshPhysicalMaterial?(o.material.transmission>0?'outer':'inner'):'lyric:'+o.renderOrder);});
    return keys.length===fixture.meshes.length&&fixture.meshes.every(item=>keys.includes(item.key));
  },fixture,{timeout:15000});
  return await page.evaluate(fixture=>{
    const states=window.__renderProbe.stores.map(s=>s.getState()),saved=states.map(s=>s.frameloop);
    const main=states.find(s=>!s.gl.domElement.closest('[data-coscroll-background]'));
    const background=states.find(s=>s.gl.domElement.closest('[data-coscroll-background]'));
    const meshes=[];main.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
    const key=o=>o.material.isMeshPhysicalMaterial?(o.material.transmission>0?'outer':'inner'):'lyric:'+o.renderOrder;
    const rotator=meshes.find(o=>o.material.isMeshPhysicalMaterial).parent.parent;
    const originalRotation=rotator.rotation.y;
    let backgroundMesh;background.scene.traverse(o=>{if(o.isMesh)backgroundMesh=o;});
    const originalTime=backgroundMesh.material.uniforms.uTime.value;
    const images=[];
    try{
      for(const s of states)s.setFrameloop('never');
      // First-use uniforms must exist before recording a reference. Assigning
      // an uninitialized feather value would change the test's own glyphs.
      main.gl.render(main.scene,main.camera);
      const current=meshes.map(o=>({key:key(o),visible:o.visible,position:o.position.toArray(),scale:o.scale.toArray(),rotation:o.rotation.toArray(),color:o.material.color?.getHex(),opacity:o.material.opacity,feather:main.gl.properties.get(o.material).uniforms?.uLyricFeather?.value,raster:o.material.map?.image?[o.material.map.image.width,o.material.map.image.height]:null}));
      if(fixture){for(const item of fixture.meshes){const o=meshes.find(o=>key(o)===item.key);if(!o)throw Error('Fixture mesh missing '+item.key);const raster=o.material.map?.image;if(item.raster&&(!raster||raster.width!==item.raster[0]||raster.height!==item.raster[1]))throw Error('Fixture glyph raster resolution differs '+item.key);o.visible=item.visible;o.position.fromArray(item.position);o.scale.fromArray(item.scale);o.rotation.fromArray(item.rotation);if(!o.material.isMeshPhysicalMaterial){o.material.color.setHex(item.color);o.material.opacity=item.opacity;const u=main.gl.properties.get(o.material).uniforms?.uLyricFeather;if(u&&Number.isFinite(item.feather))u.value=item.feather;}}}
      backgroundMesh.material.uniforms.uTime.value=1.25;
      background.gl.render(background.scene,background.camera);
      images.push({name:'background',data:background.gl.domElement.toDataURL('image/png')});
      for(const angle of [0,Math.PI/2,Math.PI]){rotator.rotation.y=angle;main.gl.render(main.scene,main.camera);images.push({name:'main-'+angle.toFixed(3),data:main.gl.domElement.toDataURL('image/png')});}
      return{fixture:{meshes:current},images,metadata:states.map(s=>({background:s===background,pixels:[s.gl.domElement.width,s.gl.domElement.height],attributes:s.gl.getContext().getContextAttributes()})),materials:meshes.filter(o=>o.material.isMeshPhysicalMaterial).map(o=>({key:key(o),color:o.material.color.getHex(),roughness:o.material.roughness,metalness:o.material.metalness,transmission:o.material.transmission,thickness:o.material.thickness,ior:o.material.ior,emissive:o.material.emissive.getHex(),emissiveIntensity:o.material.emissiveIntensity,normalScale:o.material.normalScale.toArray(),vertices:o.geometry.attributes.position.count}))};
    }finally{rotator.rotation.y=originalRotation;backgroundMesh.material.uniforms.uTime.value=originalTime;states.forEach((s,i)=>s.setFrameloop(saved[i]));}
  },fixture||null);
}

export async function compareImages(page,images){return await page.evaluate(async images=>{
  const results=[];
  for(const item of images){
    const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
    const [a,b]=await Promise.all([load(item.before),load(item.after)]);
    if(a.width!==b.width||a.height!==b.height)throw Error('Image dimensions changed');
    const canvas=document.createElement('canvas');canvas.width=a.width;canvas.height=a.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(a,0,0);const first=ctx.getImageData(0,0,a.width,a.height).data;ctx.clearRect(0,0,a.width,a.height);ctx.drawImage(b,0,0);const second=ctx.getImageData(0,0,a.width,a.height).data;
    let total=0,max=0,changed=0,overTwo=0;const hist=new Uint32Array(256);
    for(let i=0;i<first.length;i+=4){let pixel=0;for(let c=0;c<4;c++){const d=Math.abs(first[i+c]-second[i+c]);total+=d;max=Math.max(max,d);pixel=Math.max(pixel,d);}hist[pixel]++;if(pixel)changed++;if(pixel>2)overTwo++;}
    const pixels=a.width*a.height;let cumulative=0,p99=0;for(;p99<255;p99++){cumulative+=hist[p99];if(cumulative>=pixels*.99)break;}
    results.push({name:item.name,width:a.width,height:a.height,meanChannelDifference:total/first.length,maxChannelDifference:max,p99PixelDifference:p99,changedPixelPercent:changed*100/pixels,overTwoPixelPercent:overTwo*100/pixels});
  }
  return results;
},images);}
