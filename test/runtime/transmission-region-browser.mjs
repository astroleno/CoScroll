/** Test-page diagnostics only: production does not expose a debug API. */
export async function installRegionRegression(page, decoderSource, boundsSource) {
  return page.evaluate(({decoderSource,boundsSource}) => {
    const states=window.__renderProbe.stores.map(store=>store.getState());
    const main=states.find(state=>!state.gl.domElement.closest('[data-coscroll-background]'));
    const meshes=[];main.scene.traverse(o=>{if(o.material?.isMeshPhysicalMaterial)meshes.push(o);});
    const inner=meshes.find(o=>o.material.transmission===0),outer=meshes.find(o=>o.material.transmission>0);
    if(states.length!==2||!inner||!outer||typeof main.gl.transmissionUpdateRegion!=='function')throw Error('Region renderer fixture missing');
    const geometry=inner.geometry;
    const three={BufferGeometry:geometry.constructor,BufferAttribute:geometry.attributes.position.constructor,
      Box3:geometry.boundingBox.constructor,Vector3:geometry.boundingBox.min.constructor,Sphere:geometry.boundingSphere.constructor};
    const exports={};new Function('require','exports',decoderSource)(name=>{if(name!=='three')throw Error(name);return three;},exports);
    const boundsModule={};new Function('require','exports',boundsSource)(name=>{if(name!=='three')throw Error(name);return three;},boundsModule);
    const q=window.__regionRegression={main,states,inner,outer,decoder:exports,provider:main.gl.transmissionUpdateRegion,
      originalGeometries:[inner.geometry,outer.geometry],loops:states.map(s=>s.frameloop),
      rotator:inner.parent.parent,originalRotation:inner.parent.parent.rotation.toArray(),
      originalPosition:inner.parent.parent.position.toArray(),full:0,partial:0,areas:[],targets:[],owned:[],
      originalTarget:main.gl.setRenderTarget,prepareBounds:boundsModule.prepareTransmissionBounds};
    q.countedProvider=(...args)=>{const r=q.provider(...args);if(r){q.partial++;q.areas.push(r.z*r.w/(args[4]*args[5]));}else q.full++;return r;};
    main.gl.setRenderTarget=function(target,...args){if(target?.texture.generateMipmaps&&target.samples===4){
      q.targets.push({width:target.width,height:target.height,samples:target.samples,type:target.texture.type,
        generateMipmaps:target.texture.generateMipmaps,minFilter:target.texture.minFilter});}
      return q.originalTarget.call(this,target,...args);};
    for(const state of states)state.setFrameloop('never');
    q.dispose=()=>{inner.geometry=q.originalGeometries[0];outer.geometry=q.originalGeometries[1];
      for(const geometry of q.owned)geometry.dispose();q.owned=[];
      q.rotator.rotation.fromArray(q.originalRotation);q.rotator.position.fromArray(q.originalPosition);
      main.gl.transmissionUpdateRegion=q.provider;main.gl.setRenderTarget=q.originalTarget;
      main.gl.render(main.scene,main.camera);states.forEach((s,i)=>s.setFrameloop(q.loops[i]));delete window.__regionRegression;};
    return {canvases:states.length,pixels:[main.gl.domElement.width,main.gl.domElement.height],
      zoom:main.camera.zoom,ua:navigator.userAgent,viewport:[innerWidth,innerHeight],
      contexts:states.map(s=>s.gl.getContext().getContextAttributes())};
  },{decoderSource,boundsSource});
}

export async function compareRegionModel(page, {url,sourcePath}) {
  return page.evaluate(async ({url,sourcePath})=>{
    const q=window.__regionRegression,{main,inner,outer,rotator}=q,renderer=main.gl,gl=renderer.getContext();
    const response=await fetch(url);if(!response.ok)throw Error('Prepared model fetch failed '+url);
    const prepared=await response.json();
    const pair=[await q.decoder.decodeGeometry(prepared.base),await q.decoder.decodeGeometry(prepared.outer)];
    const prepareStart=performance.now();q.prepareBounds(pair[0]);const prepareBoundsMs=performance.now()-prepareStart;
    inner.geometry=pair[0];outer.geometry=pair[1];for(const g of q.owned)g.dispose();q.owned=pair;
    const w=renderer.domElement.width,h=renderer.domElement.height;
    // Rotations, fast reversals and two partially clipped positions in one
    // continuous sequence exercise both current and previous coverage.
    rotator.parent.updateWorldMatrix(true,false);
    const pe=rotator.parent.matrixWorld.elements;
    const edge=main.camera.right/main.camera.zoom/Math.hypot(pe[0],pe[1],pe[2]);
    const poses=[[0,0],[.37,0],[Math.PI/2,0],[2.2,0],[Math.PI,0],[4.71,0],[5.6,0],[1.1,0],[0,-edge],[.7,edge],[0,0]];
    const render=pose=>{rotator.rotation.set(0,pose[0],0);rotator.position.x=q.originalPosition[0]+pose[1];renderer.render(main.scene,main.camera);};
    const read=()=>{const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
    const references=[];renderer.transmissionUpdateRegion=null;
    for(const pose of poses){render(pose);references.push(read());}
    q.full=0;q.partial=0;q.areas=[];q.targets=[];
    renderer.transmissionUpdateRegion=q.countedProvider;render([.12,0]);
    const frames=[];
    for(let i=0;i<poses.length;i++){
      render(poses[i]);const actual=read(),reference=references[i];let changed=0,max=0,total=0;
      for(let p=0;p<actual.length;p+=4){let pixel=0;for(let c=0;c<4;c++){const d=Math.abs(actual[p+c]-reference[p+c]);pixel=Math.max(pixel,d);total+=d;}if(pixel)changed++;max=Math.max(max,pixel);}
      frames.push({pose:poses[i],changedPixels:changed,maxChannelDifference:max,meanChannelDifference:total/actual.length});
    }
    const result={sourcePath,vertices:pair.map(g=>g.attributes.position.count),bounds:!!pair[0].boundingBox,
      frames,prepareBoundsMs,full:q.full,partial:q.partial,meanArea:q.areas.reduce((a,b)=>a+b,0)/q.areas.length,
      target:q.targets.at(-1),glError:gl.getError(),canvases:document.querySelectorAll('canvas').length};
    if(q.partial<poses.length)throw Error('Region path not exercised '+JSON.stringify(result));
    return result;
  },{url,sourcePath});
}

export async function disposeRegionRegression(page) {
  return page.evaluate(()=>{window.__regionRegression?.dispose();return {canvases:document.querySelectorAll('canvas').length,errors:window.__coscrollPerf.errors};});
}
