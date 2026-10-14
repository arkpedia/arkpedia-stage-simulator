// SPDX-License-Identifier: GPL-3.0-or-later
// Original Lappland angular motion through the actual shared browser renderer.
// Isolated diagnostic; does not certify native game pixels or enable operators.
import puppeteer from 'puppeteer-core';import assert from 'node:assert/strict';import http from 'node:http';import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
import {createStaticHandler} from '../../server/index.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),directory=path.join(root,'.cache/arkpedia/lappland-alter-source/effects');
const meta=JSON.parse(await readFile(path.join(root,'data/arkpedia-lappland-effects.json')));
const check=(b,e)=>{assert.equal(b.length,e.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);};
const artifact=async file=>{const m=JSON.parse(await readFile(path.join(root,'data/'+file))),b=await readFile(path.join(directory,m.artifact.path));check(b,m.artifact);return JSON.parse(b);};
const bytes=await readFile(path.join(directory,meta.pack.path));check(bytes,meta.pack);
const pack=JSON.parse(gunzipSync(bytes)),animations=await artifact('arkpedia-lappland-effect-animations.json'),shaders=await artifact('arkpedia-lappland-effect-shaders.json');
const builtinMeshes=JSON.parse(await readFile(path.join(root,'data/arkpedia-unity-builtin-meshes.json')));
const textureFiles=new Map(Object.values(meta.textures).map(e=>[e.path,e]));
const serve=createStaticHandler({publicDir:path.join(root,'public'),dataDir:path.join(root,'data'),sharedDir:path.join(root,'shared')});
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1');try{
 if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
 if(url.pathname==='/angular-review.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Original angular motion diagnostic</title>');return;}
 if(url.pathname.startsWith('/review-textures/')){const e=textureFiles.get(url.pathname.slice('/review-textures/'.length));if(!e){res.writeHead(404);res.end('Unknown texture');return;}
  const b=await readFile(path.join(directory,e.path));check(b,e);res.writeHead(200,{'Content-Type':'image/webp'});res.end(b);return;}
 await serve(req,res,url.pathname,url.search.slice(1));
 }catch(error){if(!res.headersSent)res.writeHead(500);res.end('Original diagnostic input unavailable');}});
const executablePath=process.env.ARKPEDIA_REVIEW_CHROME;if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME to a local Chromium executable');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setViewport({width:512,height:512});await page.goto(`http://127.0.0.1:${server.address().port}/angular-review.html`,{waitUntil:'networkidle0'});
 const result=await page.evaluate(async({pack,animations,shaders,builtinMeshes})=>{
  const T=await import('/vendor/three.module.js'),{createNativeEffectLibrary,compileNativeEffectPrograms}=await import('/arkpedia/native-effect-player.js');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(512,512);renderer.setPixelRatio(1);document.body.style.margin='0';document.body.append(renderer.domElement);
  const loader=new T.TextureLoader(),library=createNativeEffectLibrary({three:T,pack,animations,shaders,builtinMeshes,loadTexture:async e=>{
   const b=await(await fetch('/review-textures/'+e.path)).arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
   if(b.byteLength!==e.bytes||digest!==e.sha256)throw Error('Changed original angular diagnostic texture');
   const url=URL.createObjectURL(new Blob([b],{type:'image/webp'}));try{return await loader.loadAsync(url);}finally{URL.revokeObjectURL(url);}
  }});
  try{
   const programs=compileNativeEffectPrograms(renderer,shaders);
   const parentRoots=[];
   const sourceFrame=(instance,transform,time)=>{
    const state=instance.pose.sample(time),nodes=[];let id=transform;while(id){nodes.unshift(state.nodes.get(id));id=state.nodes.get(id).parent;}
    const matrix=new T.Matrix4(),rotation=new T.Quaternion(),hierarchyScale=new T.Vector3(1,1,1);
    for(const n of nodes){const q=n.euler?new T.Quaternion().setFromEuler(new T.Euler(...n.euler.map(v=>v*Math.PI/180),'ZXY')):new T.Quaternion(...n.rotation);
     matrix.multiply(new T.Matrix4().compose(new T.Vector3(...n.position),q,new T.Vector3(...n.scale)));rotation.multiply(q);hierarchyScale.multiply(new T.Vector3(...n.scale));}
    return{position:new T.Vector3().setFromMatrixPosition(matrix),rotation,scale:new T.Vector3(...state.nodes.get(transform).scale),hierarchyScale};
   };
   const factor=(id,salt)=>{let h=Math.imul((id+1)^1,0x45d9f3b)^Math.imul(salt+1,0x27d4eb2d);h=Math.imul(h^(h>>>16),0x45d9f3b);return((h^(h>>>16))>>>0)/0x100000000;};
   let stretchMatrices=0,stretchGpuMatrices=0;
   const verifyStretch=(d,p,part,frame,camera)=>{
    const s=d.particleSource,shape=s.ShapeModule;
    if(s.NoiseModule.enabled||s.VelocityModule.enabled||s.InheritVelocityModule.enabled||p.rotation!==0&&shape.type!==8||shape.alignToDirection||s.moveWithTransform!==0)
     throw Error('Changed original stretched source diagnostic controls');
    const z=2*factor(p.id,10)-1,phi=factor(p.id,11)*Math.PI*2;let direction;
    if(shape.type===0)direction=new T.Vector3(Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z);
    else if(shape.type===4){
     const radius=shape.radius.value,inner=radius*(1-shape.radiusThickness),r=Math.sqrt(inner*inner+factor(p.id,10)*(radius*radius-inner*inner)),angle=shape.angle*Math.PI/180;
     const outward=r/radius*Math.sin(angle);direction=new T.Vector3(outward*Math.cos(phi),outward*Math.sin(phi),Math.cos(angle)).normalize();
    }else if(shape.type===8){
     const inner=1-shape.radiusThickness,rho=Math.sqrt(inner*inner+factor(p.id,10)*(1-inner*inner)),angle=shape.angle*Math.PI/180;
     direction=new T.Vector3(rho*Math.sin(angle)*Math.cos(phi),rho*Math.sin(angle)*Math.sin(phi),Math.cos(angle)).normalize();
    }else throw Error('Unsupported original stretch diagnostic shape');
    direction.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...['x','y','z'].map(k=>shape.m_Rotation[k]*Math.PI/180),'YXZ')));
    const speed=s.InitialModule.startSpeed;if(![0,3].includes(speed.minMaxState))throw Error('Changed source stretch speed curve');
    direction.multiplyScalar(speed.minMaxState===0?speed.scalar:speed.minScalar+(speed.scalar-speed.minScalar)*factor(p.id,18));
    const scale=s.scalingMode===0?frame.hierarchyScale:s.scalingMode===1?frame.scale:new T.Vector3(1,1,1);
    const y=direction.multiply(scale).applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(frame.rotation)).normalize();
    const anchor=new T.Vector3(...d.pivot.pivot).applyMatrix4(part.matrixWorld),view=camera.position.clone().sub(anchor).normalize();
    const x=new T.Vector3().crossVectors(y,view),normal=new T.Vector3().crossVectors(x.clone().normalize(),y);
    const source=pack.records[d.component].data,size=new T.Vector3(...p.size).multiply(scale),c=Math.cos(p.rotation),sine=Math.sin(p.rotation);
    const columns=[x.clone().multiplyScalar(c).addScaledVector(y,sine).multiplyScalar(size.x),y.clone().multiplyScalar(c).addScaledVector(x,-sine).multiplyScalar(size.y*source.m_LengthScale),normal.multiplyScalar(size.z)];
    for(let axis=0;axis<3;axis++){const e=part.matrixWorld.elements,actual=new T.Vector3(e[axis*4],e[axis*4+1],e[axis*4+2]);if(actual.distanceTo(columns[axis])>1e-7)throw Error('Rendered stretch missed original direction, signed size or head-on width');}
    stretchMatrices++;
   };
   const hookStretch=(instance)=>{for(const d of instance.draws.filter(d=>d.stretch))for(const part of d.pool)part.onAfterRender=function(){
    const gl=renderer.getContext(),program=gl.getParameter(gl.CURRENT_PROGRAM),value=Array.from({length:4},(_,i)=>gl.getUniform(program,gl.getUniformLocation(program,'hlslcc_mtx4x4unity_ObjectToWorld['+i+']'))).flatMap(v=>v?Array.from(v):[]);
    if(value.length!==16||value.some((v,i)=>Math.abs(v-part.matrixWorld.elements[i])>1e-6))throw Error('Stretched matrix missed actual native shader GPU upload '+d.component);stretchGpuMatrices++;
   };};
   for(let root=1;root<=6;root++){
    const instance=await library.create('whitw2_token_hit_0'+root,{allowBlocked:true}),scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.001,100);
    scene.background=new T.Color('#142027');scene.add(instance.group);camera.position.set(.2,.4,3);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    const time=.1;instance.update(time,{camera});instance.group.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(instance.group),centre=bounds.getCenter(new T.Vector3()),span=Math.max(.1,bounds.getSize(new T.Vector3()).length());
    camera.position.copy(centre).add(new T.Vector3(.2,.4,1).normalize().multiplyScalar(span*1.8));camera.lookAt(centre);camera.updateMatrixWorld(true);
    instance.update(time,{camera});instance.group.updateMatrixWorld(true);
    const selected=instance.draws.filter(d=>d.lastParticles?.some(p=>p.parent)),rendered=new Set();let samples=0,passes=0,sourceHiddenSamples=0;
    for(const d of selected)for(const part of d.pool){const before=part.onBeforeRender;part.onBeforeRender=function(...args){passes++;rendered.add(this);return before.apply(this,args);};}
    hookStretch(instance);
    renderer.render(scene,camera);
    for(const d of selected)for(const[index,part]of d.pool.entries())if(part.visible){
     const p=d.lastParticles[index],parent=pack.records[p.parent],s=parent.data;
     if(s.scalingMode!==1||s.moveWithTransform!==0||s.InitialModule.startSpeed.scalar!==0||s.ShapeModule.radiusThickness!==1
      ||Object.values(s.ShapeModule.m_Position).some(v=>v!==0)||Object.values(s.ShapeModule.m_Rotation).some(v=>v!==0)
      ||d.particleSource.scalingMode!==1||d.particleSource.moveWithTransform!==0)throw Error('Changed original parent/child frame diagnostic controls');
     const parentGo=parent.references.find(r=>r.field==='m_GameObject').target,parentTransform=[...instance.pose.nodes].find(([,n])=>n.gameObject===parentGo)?.[0];
     const pf=sourceFrame(instance,parentTransform,p.birthTime),birth=sourceFrame(instance,d.transform,p.birthTime),current=sourceFrame(instance,d.transform,time);
     const radius=s.ShapeModule.radius.value*Math.sqrt(factor(p.parentParticle,10)),phi=factor(p.parentParticle,11)*Math.PI*2;
     const basis=frame=>new T.Matrix4().compose(new T.Vector3(),frame.rotation,frame.scale);
     const delta=new T.Vector3(radius*Math.cos(phi)*s.ShapeModule.m_Scale.x,radius*Math.sin(phi)*s.ShapeModule.m_Scale.y,0).applyMatrix4(basis(pf));
     // Preserve the serialized quaternion basis rather than assuming a perfectly
     // unit quaternion and replacing the inverse matrix with its conjugate.
     const offset=delta.applyMatrix4(basis(birth).invert());
     const expected=new T.Vector3(...(p.origin??[0,0,0])).add(offset).add(new T.Vector3(...(p.displacement??[0,0,0]))).applyMatrix4(basis(current)).add(current.position);
     const actual=new T.Vector3(...d.pivot.pivot).applyMatrix4(part.matrixWorld);
     if(expected.distanceTo(actual)>1e-8)throw Error('Source parent motion did not reach rendered child position '+JSON.stringify({root,child:d.particleId,expected:expected.toArray(),actual:actual.toArray()}));
     const sourceVisible=instance.pose.sample(time).nodes.get(d.transform).visible;
     if(sourceVisible){if(!rendered.has(part))throw Error('Visible source child missed its render pass');samples++;if(d.stretch)verifyStretch(d,p,part,current,camera);}
     else{if(rendered.has(part))throw Error('Inactive original child was rendered');sourceHiddenSamples++;}
    }
    if(selected.length<6||passes!==samples||samples!==19)throw Error('Source child dispatch missed original render passes '+JSON.stringify({root,selected:selected.length,passes,samples}));
    const verifiedPasses=passes;
    const snapshot=()=>JSON.stringify(selected.map(d=>({particles:d.lastParticles,matrices:d.pool.filter(p=>p.visible).map(p=>Array.from(p.matrixWorld.elements))})));
    const before=snapshot();instance.update(.8,{camera});instance.update(time,{camera});instance.group.updateMatrixWorld(true);
    if(snapshot()!==before)throw Error('Source parent/child dispatch did not reverse exactly');
    let strictRejected=false;try{await library.create(instance.name);}catch(e){if(!/unplayed/.test(e.message))throw e;strictRejected=true;}
    if(!strictRejected||instance.inspection!==null)throw Error('Partial source dispatch bypassed its full-root fidelity boundary');
    if(root===5){const box=new T.Box3().setFromObject(instance.group),centre=box.getCenter(new T.Vector3()),span=Math.max(.1,box.getSize(new T.Vector3()).length());
     camera.position.copy(centre).add(new T.Vector3(.2,.4,1).normalize().multiplyScalar(span*1.8));camera.lookAt(centre);camera.updateMatrixWorld(true);
     instance.update(time,{camera});renderer.render(scene,camera);window.sourceParentImage=renderer.domElement.toDataURL('image/png');}
    parentRoots.push({root:instance.name,children:selected.length,samples,passes:verifiedPasses,sourceHiddenSamples,blocked:instance.blocked.length,reverseStable:true,strictRejected,syntheticParentMotion:false});instance.dispose();
   }
   const instance=await library.create('whitw2_skill_03_buff_01',{allowBlocked:true}),scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.001,100);
   scene.background=new T.Color('#142027');scene.add(instance.group);
   const captureTime=1.8;camera.position.set(.2,.4,3);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
   instance.update(captureTime,{camera});instance.group.updateMatrixWorld(true);
   const strictInstance=await library.create('whitw2_skill_03_buff_01'),strictPrepared=strictInstance.blocked.length===0;strictInstance.dispose();
   const strictRejected=false;
   if(!strictPrepared||library.instanceCount!==1)throw Error('Volume/sheet-supported root missed strict preparation');
   const pivotDraws=instance.draws.filter(d=>!d.stretch&&d.pivot?.pivot.some(v=>v!==0));let pivotMatrices=0,pivotRenderPasses=0;
   const rotationDraws=instance.draws.filter(d=>d.mesh.material.userData.textureRotations);let rotationRenderPasses=0;
   if(rotationDraws.length!==1||instance.draws.length!==32||instance.blocked.length!==0)throw Error('Missing original texture rotation component');
   const rotationMaterial=rotationDraws[0].mesh.material;
   const particleTrailDraws=instance.draws.filter(d=>d.particleTrails);let particleTrailPasses=0,particleTrailPhysicsPoints=0,particleTrailGpuBuffers=0;
   if(particleTrailDraws.length!==4)throw Error('Missing original particle/trail material pairs');
   const glTrail=renderer.getContext(),trailBuffers=new WeakMap(),trailUpload=glTrail.bufferData.bind(glTrail),trailUpdate=glTrail.bufferSubData.bind(glTrail);
   glTrail.bufferData=function(target,array,...args){const result=trailUpload(target,array,...args);if(ArrayBuffer.isView(array))trailBuffers.set(array,glTrail.getParameter(target===glTrail.ARRAY_BUFFER?glTrail.ARRAY_BUFFER_BINDING:glTrail.ELEMENT_ARRAY_BUFFER_BINDING));return result;};
   glTrail.bufferSubData=function(target,offset,array,...args){const result=trailUpdate(target,offset,array,...args);if(ArrayBuffer.isView(array))trailBuffers.set(array,glTrail.getParameter(target===glTrail.ARRAY_BUFFER?glTrail.ARRAY_BUFFER_BINDING:glTrail.ELEMENT_ARRAY_BUFFER_BINDING));return result;};
   for(const d of particleTrailDraws)d.mesh.onAfterRender=()=>{particleTrailPasses++;};
   for(const d of rotationDraws)for(const part of d.pool)part.onAfterRender=function(){
    const gl=renderer.getContext(),program=gl.getParameter(gl.CURRENT_PROGRAM);
    for(let i=0;i<4;i++){
     const name='_Rotation'+i,actual=gl.getUniform(program,gl.getUniformLocation(program,name)),expected=rotationMaterial.uniforms[name].value.toArray();
     if(!actual||actual.some((v,j)=>Math.abs(v-expected[j])>1e-6))throw Error('Source texture rotation missed actual GPU uniform '+name);
    }
    rotationRenderPasses++;
   };
   const pivotRendered=new Set();
   hookStretch(instance);
   const volumeDraw=instance.draws.find(d=>d.particleSource?.ShapeModule?.type===8);let volumeRunePasses=0,volumeSamples=0,volumeGpuBuffers=0;
   if(!volumeDraw||volumeDraw.particleSource.UVModule.uvChannelMask!==-1)throw Error('Missing original rune volume/sheet profile');
   for(const part of volumeDraw.pool){const before=part.onAfterRender;part.onAfterRender=function(...args){before?.apply(this,args);volumeRunePasses++;};}
   for(const d of pivotDraws)for(const part of d.pool){const before=part.onBeforeRender;part.onBeforeRender=function(...args){pivotRenderPasses++;pivotRendered.add(this);return before.apply(this,args);};}
   const pivotBounds=new T.Box3().setFromObject(instance.group),pivotCentre=pivotBounds.getCenter(new T.Vector3()),pivotSpan=Math.max(.1,pivotBounds.getSize(new T.Vector3()).length());
   camera.position.copy(pivotCentre).add(new T.Vector3(.2,.4,1).normalize().multiplyScalar(pivotSpan*1.8));camera.lookAt(pivotCentre);camera.updateMatrixWorld(true);
   instance.update(captureTime,{camera});renderer.render(scene,camera);
   const volumeShape=volumeDraw.particleSource.ShapeModule,shapeBasis=new T.Matrix4().makeRotationFromEuler(new T.Euler(...['x','y','z'].map(k=>volumeShape.m_Rotation[k]*Math.PI/180),'YXZ'));
   for(const[index,part]of volumeDraw.pool.entries())if(part.visible){
    const p=volumeDraw.lastParticles[index],local=new T.Vector3(...p.origin).sub(new T.Vector3(...['x','y','z'].map(k=>volumeShape.m_Position[k]))).applyMatrix4(shapeBasis.clone().invert());
    local.divide(new T.Vector3(...['x','y','z'].map(k=>volumeShape.m_Scale[k])));
    const radius=volumeShape.radius.value,tangent=Math.tan(volumeShape.angle*Math.PI/180),length=volumeShape.length;
    const integral=z=>radius*radius*z+radius*tangent*z*z+tangent*tangent*z*z*z/3;
    if(Math.abs(integral(local.z)/integral(length)-factor(p.id,12))>1e-9)throw Error('Rune depth did not follow original cone volume');
    const outer=radius+local.z*tangent;if(Math.abs((local.x*local.x+local.y*local.y)/(outer*outer)-factor(p.id,10))>1e-9)throw Error('Rune radius did not retain volume radial sampling');
    const uv=part.geometry.getAttribute('in_TEXCOORD0'),wanted=new Float32Array(volumeDraw.customUVs.length),tiles=4,frame=Math.floor(factor(p.id,17)*volumeDraw.particleSource.UVModule.frameOverTime.scalar*tiles);
    for(let i=0;i<wanted.length;i++)wanted[i]=volumeDraw.customUVs[i]*.5+(i%2?1-(Math.floor(frame/2)+1)/2:(frame%2)/2);
    const buffer=trailBuffers.get(uv.array);if(!buffer)throw Error('Rune atlas UVs missed their GPU upload');
    const previous=glTrail.getParameter(glTrail.ARRAY_BUFFER_BINDING),actual=new Float32Array(uv.array.length);glTrail.bindBuffer(glTrail.ARRAY_BUFFER,buffer);glTrail.getBufferSubData(glTrail.ARRAY_BUFFER,0,actual);glTrail.bindBuffer(glTrail.ARRAY_BUFFER,previous);
    if(actual.some((v,i)=>v!==wanted[i]))throw Error('All-channel sheet mask missed original rune atlas UVs');volumeGpuBuffers++;volumeSamples++;
   }
   if(volumeRunePasses!==volumeSamples||volumeSamples!==8)throw Error('Original rune volume missed its visible render passes');
   const verifiedVolumeRunePasses=volumeRunePasses;
   const sourcePolynomial=(curve,lo,hi,integral=false)=>{
    if(curve.minMaxState!==1)throw Error('Changed original force/clamp curve mode');
    const keys=curve.maxCurve.m_Curve;if(keys.length!==2||keys[0].time!==0||keys[1].time!==1||keys.some(k=>k.weightedMode!==0))throw Error('Changed original force/clamp Hermite knots');
    const[a,b]=keys,A=2*a.value-2*b.value+a.outSlope+b.inSlope,B=-3*a.value+3*b.value-2*a.outSlope-b.inSlope,C=a.outSlope,D=a.value;
    return curve.scalar*(integral?A*(hi**4-lo**4)/4+B*(hi**3-lo**3)/3+C*(hi**2-lo**2)/2+D*(hi-lo):((A*hi+B)*hi+C)*hi+D);
   };
   for(const d of particleTrailDraws){
    if(d.mesh.material===d.sourceEntry.mesh.material||d.materialSlot!==1||!d.trailData.indices.length)throw Error('Original trail was replaced by its particle material');
    const s=d.sourceEntry.particleSource,shape=s.ShapeModule,frame=sourceFrame(instance,d.transform,captureTime),births=new Map(d.sourceEntry.emitter.births(captureTime).map(b=>[b.id,b]));
    if(shape.type!==4||shape.angle!==0||s.NoiseModule.enabled||s.VelocityModule.enabled||s.ForceModule.inWorldSpace||s.ForceModule.randomizePerFrame||s.scalingMode!==1)throw Error('Changed original spark physics diagnostic controls');
    const shapeRotation=new T.Matrix4().makeRotationFromEuler(new T.Euler(...['x','y','z'].map(k=>shape.m_Rotation[k]*Math.PI/180),'YXZ'));
    for(const trail of d.trailData.trails)for(const[index,point]of trail.points.entries()){
     const b=births.get(trail.id),radius=shape.radius.value,inner=radius*(1-shape.radiusThickness),r=Math.sqrt(inner*inner+factor(b.id,10)*(radius*radius-inner*inner)),phi=factor(b.id,11)*Math.PI*2;
     const origin=new T.Vector3(r*Math.cos(phi)*shape.m_Scale.x,r*Math.sin(phi)*shape.m_Scale.y,0).applyMatrix4(shapeRotation).add(new T.Vector3(...['x','y','z'].map(k=>shape.m_Position[k])));
     const initial=s.InitialModule.startSpeed;if(initial.minMaxState!==3)throw Error('Changed original spark speed distribution');
     const velocity=new T.Vector3(0,0,initial.minScalar+(initial.scalar-initial.minScalar)*factor(b.id,18)).applyMatrix4(shapeRotation),position=origin.clone();
     const age=(point.time-b.birthTime)*s.simulationSpeed;let elapsed=0;
     while(elapsed<age-1e-12){const dt=Math.min(1/60,age-elapsed),t=(elapsed+dt)/b.lifetime;
      for(const[axis,k]of['x','y','z'].entries())velocity.setComponent(axis,velocity.getComponent(axis)+b.lifetime*sourcePolynomial(s.ForceModule[k],elapsed/b.lifetime,t,true));
      const limit=sourcePolynomial(s.ClampVelocityModule.magnitude,0,t),length=velocity.length(),blend=1-(1-s.ClampVelocityModule.dampen)**(dt*60);
      if(length>limit)velocity.multiplyScalar((length-(length-limit)*blend)/length);
      position.addScaledVector(velocity,dt);elapsed+=dt;
     }
     if(position.distanceTo(new T.Vector3(...point.position))>1e-8)throw Error('Trail vertex dropped original force/clamp motion');
     const world=position.multiply(frame.scale).applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(frame.rotation)).add(frame.position);
     if(world.distanceTo(new T.Vector3(...trail.world[index]))>1e-8)throw Error('Trail vertex used the wrong emitter frame');particleTrailPhysicsPoints++;
    }
    const expected=[['in_POSITION0',d.trailData.positions],['in_COLOR0',d.trailData.colors],['in_TEXCOORD0',d.trailData.uvs],['index',d.trailData.indices]];
    for(const[name,values]of expected){const attribute=name==='index'?d.mesh.geometry.index:d.mesh.geometry.getAttribute(name),buffer=trailBuffers.get(attribute.array);
     if(!buffer)throw Error('Particle ribbon buffer missed its native shader upload');const target=name==='index'?glTrail.ELEMENT_ARRAY_BUFFER:glTrail.ARRAY_BUFFER;
     const previous=glTrail.getParameter(name==='index'?glTrail.ELEMENT_ARRAY_BUFFER_BINDING:glTrail.ARRAY_BUFFER_BINDING),readback=new attribute.array.constructor(attribute.array.length);
     glTrail.bindBuffer(target,buffer);glTrail.getBufferSubData(target,0,readback);glTrail.bindBuffer(target,previous);
     const wanted=new attribute.array.constructor(values);if(readback.some((v,i)=>v!==wanted[i]))throw Error('GPU particle trail positions/colors/UVs/indices differ from source mapping');particleTrailGpuBuffers++;
    }
   }
   glTrail.bufferData=trailUpload;glTrail.bufferSubData=trailUpdate;
   if(particleTrailPasses!==4)throw Error('Particle trail material missed an actual render pass');
   const verifiedParticleTrailPasses=particleTrailPasses;
   const particleTrailSnapshot=()=>JSON.stringify(particleTrailDraws.map(d=>d.trailData)),trailBefore=particleTrailSnapshot();instance.update(.3,{camera});instance.update(captureTime,{camera});instance.group.updateMatrixWorld(true);
   if(particleTrailSnapshot()!==trailBefore)throw Error('Source particle trails did not reverse exactly');
   for(const d of instance.draws.filter(d=>d.stretch))for(const[index,part]of d.pool.entries())if(part.visible)verifyStretch(d,d.lastParticles[index],part,sourceFrame(instance,d.transform,captureTime),camera);
   const verifiedStretchMatrices=stretchMatrices,verifiedStretchGpuMatrices=stretchGpuMatrices;
   if(rotationRenderPasses<1)throw Error('Source rotated texture missed its render pass');
   const verifiedRotationRenderPasses=rotationRenderPasses;
   // Run the original vertex/fragment pair with transform feedback. Texture UVs
   // are captured before fragment sampling; no native shader expression changes.
   const glRotation=renderer.getContext(),programRotation=glRotation.createProgram(),rotationShaders=[],rotationBuffers=[];
   const vaoRotation=glRotation.createVertexArray(),feedbackRotation=glRotation.createTransformFeedback();let rotationUvValues=0,rotationReadbacks=0;
   try{
    for(const[kind,source]of[[glRotation.VERTEX_SHADER,rotationMaterial.vertexShader],[glRotation.FRAGMENT_SHADER,rotationMaterial.fragmentShader]]){
     const shader=glRotation.createShader(kind);rotationShaders.push(shader);glRotation.shaderSource(shader,'#version 300 es\n'+source);glRotation.compileShader(shader);
     if(!glRotation.getShaderParameter(shader,glRotation.COMPILE_STATUS))throw Error(glRotation.getShaderInfoLog(shader));glRotation.attachShader(programRotation,shader);
    }
    glRotation.transformFeedbackVaryings(programRotation,['vs_TEXCOORD0','vs_TEXCOORD1'],glRotation.INTERLEAVED_ATTRIBS);glRotation.linkProgram(programRotation);
    if(!glRotation.getProgramParameter(programRotation,glRotation.LINK_STATUS))throw Error(glRotation.getProgramInfoLog(programRotation));
    glRotation.useProgram(programRotation);glRotation.bindVertexArray(vaoRotation);
    const originalUv=rotationDraws[0].baseUVs[0],uvs=[[originalUv[0],originalUv[1]],[.25,.75],[.75,.25]];
    for(const[name,width,values]of[['in_POSITION0',3,Array(9).fill(0)],['in_TEXCOORD0',2,uvs.flat()],['in_COLOR0',4,Array(12).fill(1)]]){
     const buffer=glRotation.createBuffer();rotationBuffers.push(buffer);glRotation.bindBuffer(glRotation.ARRAY_BUFFER,buffer);glRotation.bufferData(glRotation.ARRAY_BUFFER,new Float32Array(values),glRotation.STATIC_DRAW);
     const location=glRotation.getAttribLocation(programRotation,name);if(location<0)throw Error('Missing original UV probe vertex attribute');
     glRotation.enableVertexAttribArray(location);glRotation.vertexAttribPointer(location,width,glRotation.FLOAT,false,0,0);
    }
    for(const[name,{value}]of Object.entries(rotationMaterial.uniforms)){
     const location=glRotation.getUniformLocation(programRotation,name);if(location===null||value.isTexture)continue;
     if(typeof value==='number')glRotation.uniform1f(location,value);
     else{const values=value.toArray?.()??value;glRotation['uniform'+(values.length===16?4:values.length)+'fv'](location,values);}
    }
    const output=glRotation.createBuffer();rotationBuffers.push(output);glRotation.bindBuffer(glRotation.TRANSFORM_FEEDBACK_BUFFER,output);glRotation.bufferData(glRotation.TRANSFORM_FEEDBACK_BUFFER,3*8*4,glRotation.DYNAMIC_READ);
    glRotation.bindTransformFeedback(glRotation.TRANSFORM_FEEDBACK,feedbackRotation);glRotation.bindBufferBase(glRotation.TRANSFORM_FEEDBACK_BUFFER,0,output);glRotation.enable(glRotation.RASTERIZER_DISCARD);
    for(const rotated of[true,false]){
     if(!rotated)glRotation.uniform4fv(glRotation.getUniformLocation(programRotation,'_Rotation0'),[1,0,0,1]);
     glRotation.beginTransformFeedback(glRotation.POINTS);glRotation.drawArrays(glRotation.POINTS,0,3);glRotation.endTransformFeedback();
     const actual=new Float32Array(24);glRotation.getBufferSubData(glRotation.TRANSFORM_FEEDBACK_BUFFER,0,actual);rotationReadbacks++;
     const time=rotationMaterial.uniforms._Time.value.y,fract=v=>v-Math.floor(v);
     for(const[index,uv]of uvs.entries()){
      const wanted=[];
      for(const texture of['Main','Dissolve','Ram','Disturb']){
       const st=rotationMaterial.uniforms['_'+texture+'Tex_ST'].value.toArray(),x=uv[0]*st[0]+st[2]-.5,y=uv[1]*st[1]+st[3]-.5;
       const turned=texture==='Main'&&rotated?[-y,x]:[x,y];
       wanted.push(...turned.map((v,axis)=>v+.5+(texture==='Ram'?0:fract(time*rotationMaterial.uniforms['_'+texture+(axis?'V':'U')+'Speed'].value))));
      }
      wanted.forEach((value,j)=>{if(Math.abs(actual[index*8+j]-value)>1e-5)throw Error('Native UV output missed source rotation/scroll mapping');rotationUvValues++;});
     }
    }
    if(glRotation.getError()!==glRotation.NO_ERROR)throw Error('GPU texture rotation probe failed');
   }finally{
    glRotation.disable(glRotation.RASTERIZER_DISCARD);glRotation.bindTransformFeedback(glRotation.TRANSFORM_FEEDBACK,null);glRotation.bindBufferBase(glRotation.TRANSFORM_FEEDBACK_BUFFER,0,null);glRotation.bindVertexArray(null);
    glRotation.deleteTransformFeedback(feedbackRotation);glRotation.deleteVertexArray(vaoRotation);rotationBuffers.forEach(b=>glRotation.deleteBuffer(b));rotationShaders.forEach(s=>glRotation.deleteShader(s));glRotation.deleteProgram(programRotation);renderer.resetState();
   }
   for(const d of pivotDraws)for(const[index,part]of d.pool.entries())if(part.visible){
    const p=d.lastParticles[index],s=d.particleSource,frame=sourceFrame(instance,d.transform,captureTime);
    if(p.parent||s.moveWithTransform!==0)throw Error('Pivot diagnostic requires an independent source-parent/world path');
    const spawnScale=s.scalingMode===0?frame.hierarchyScale:s.scalingMode===1?frame.scale:frame.hierarchyScale,
     movementScale=s.scalingMode===2?new T.Vector3(1,1,1):spawnScale;
    const basis=new T.Matrix4().makeRotationFromQuaternion(frame.rotation);
    const local=new T.Vector3(...(p.origin??[0,0,0])).multiply(spawnScale).add(new T.Vector3(...(p.displacement??[0,0,0])).multiply(movementScale));
    const expected=local.applyMatrix4(basis).add(frame.position),actualAnchor=new T.Vector3(...d.pivot.pivot).applyMatrix4(part.matrixWorld);
    if(expected.distanceTo(actualAnchor)>1e-8)throw Error('Rendered pivot displaced its original physics anchor');
    if(!pivotRendered.has(part))throw Error('Original pivot particle missed its render pass');
    if(!new T.Vector3().setFromMatrixPosition(part.matrixWorld).distanceTo(expected))throw Error('Nonzero pivot was discarded');
    pivotMatrices++;
   }
   const collapsedPivotDraws=pivotDraws.filter(d=>d.mesh.parent.matrixWorld.determinant()===0);
   if(pivotDraws.length!==8||pivotMatrices!==5||pivotRenderPasses!==5||collapsedPivotDraws.length!==3)throw Error('Original pivot diagnostic missed visible/collapsed source components');
   const verifiedPivotRenderPasses=pivotRenderPasses;
   const pivotSnapshot=()=>JSON.stringify(pivotDraws.map(d=>({particles:d.lastParticles,matrices:d.pool.filter(p=>p.visible).map(p=>Array.from(p.matrixWorld.elements))})));
   const pivotBefore=pivotSnapshot();instance.update(.3,{camera});instance.update(captureTime,{camera});instance.group.updateMatrixWorld(true);
   if(pivotSnapshot()!==pivotBefore)throw Error('Source pivot matrices did not reverse exactly');
   const selected=instance.draws.filter(d=>d.particleSource?.RotationModule?.enabled);
   const pose=instance.pose.sample(captureTime),worldRotation=transform=>{
    const nodes=[];let key=transform;while(key){nodes.unshift(pose.nodes.get(key));key=pose.nodes.get(key).parent;}
    const q=new T.Quaternion();for(const n of nodes)q.multiply(n.euler?new T.Quaternion().setFromEuler(new T.Euler(...n.euler.map(v=>v*Math.PI/180),'ZXY')):new T.Quaternion(...n.rotation));return q;
   };
   let matrices=0;const sourceIds=[];
   for(const d of selected){
    const s=d.particleSource,m=s.RotationModule;
    if(m.separateAxes||m.curve.minMaxState!==0||![0,3].includes(s.InitialModule.startRotation.minMaxState)||s.InitialModule.rotation3D||d.alignment!==2)
      throw Error('Angular diagnostic needs a source-specific curve/alignment check');
    const sourceId=Object.entries(pack.records).find(([,r])=>r.data===s)?.[0];sourceIds.push(sourceId);
    const parent=worldRotation(d.transform);
    for(const [index,part]of d.pool.entries())if(part.visible){
     const p=d.lastParticles[index],birth=s.InitialModule.startRotation;
     // Independently replay the existing local birth-factor hash. This checks
     // that adding angular lifetime integration preserves that mapping; native
     // random ordering remains unverified.
     let hash=Math.imul((p.id+1)^1,0x45d9f3b)^Math.imul(5,0x27d4eb2d);
     hash=Math.imul(hash^(hash>>>16),0x45d9f3b);const factor=((hash^(hash>>>16))>>>0)/0x100000000;
     const start=birth.minMaxState===0?birth.scalar:birth.minScalar+(birth.scalar-birth.minScalar)*factor;
     const wanted=start+m.curve.scalar*p.age;
     if(Math.abs(p.rotation-wanted)>1e-12)throw Error('Authored angular velocity did not integrate simulated age');
     const expected=[new T.Vector3(Math.cos(wanted),Math.sin(wanted),0),new T.Vector3(-Math.sin(wanted),Math.cos(wanted),0),new T.Vector3(0,0,1)].map(v=>v.applyQuaternion(parent));
     for(let axis=0;axis<3;axis++){const e=part.matrixWorld.elements,v=new T.Vector3(e[axis*4],e[axis*4+1],e[axis*4+2]);
      if(v.length()===0)throw Error('Angular diagnostic sampled a collapsed particle');v.normalize();if(v.distanceTo(expected[axis])>1e-8)throw Error('Rendered original angular basis mismatch');}
     matrices++;
    }
   }
   if(selected.length!==5||matrices<5)throw Error('Missing original rotating components '+JSON.stringify({selected:selected.length,matrices,blocked:instance.blocked}));
   const snapshot=()=>JSON.stringify(selected.map(d=>({particles:d.lastParticles,matrices:d.pool.filter(p=>p.visible).map(p=>Array.from(p.matrixWorld.elements))})));
   const before=snapshot();instance.update(.3,{camera});instance.update(captureTime,{camera});instance.group.updateMatrixWorld(true);
   if(snapshot()!==before)throw Error('Angular lifetime replay did not reverse exactly');
   const box=new T.Box3().setFromObject(instance.group),centre=box.getCenter(new T.Vector3()),span=Math.max(1,box.getSize(new T.Vector3()).length());
   camera.position.copy(centre).add(new T.Vector3(.2,.4,1).normalize().multiplyScalar(span*1.8));camera.lookAt(centre);camera.updateMatrixWorld(true);
   instance.update(captureTime,{camera});renderer.render(scene,camera);
   const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),glError=gl.getError(),driver=gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER);
   window.angularReview={library,renderer,scene,camera};
   return {root:instance.name,draws:instance.draws.length,blocked:instance.blocked,programs:programs.length,sourceIds,matrices,pivotMatrices,pivotRenderPasses:verifiedPivotRenderPasses,collapsedPivotDraws:collapsedPivotDraws.length,pivotReverseStable:true,nativePivotSignOrderVerified:false,stretchMatrices:verifiedStretchMatrices,stretchGpuMatrices:verifiedStretchGpuMatrices,nativeStretchBasisOrderVerified:false,rotationRenderPasses:verifiedRotationRenderPasses,rotationUvValues,rotationReadbacks,nativeTextureRotationSignOrderVerified:false,particleTrailPhysicsPoints,particleTrailGpuBuffers,particleTrailPasses:verifiedParticleTrailPasses,particleTrailReverseStable:true,volumeSamples,volumeGpuBuffers,volumeRunePasses:verifiedVolumeRunePasses,captureTime,parentRoots,reverseStable:true,strictRejected,strictPrepared,glError,driver,compiledFrameParity:false,diagnosticOnly:true};
  }catch(error){library.dispose();renderer.dispose();throw error;}
 },{pack,animations,shaders,builtinMeshes});
 assert.equal(result.programs,23);assert.ok(result.matrices>=5);assert.equal(result.sourceIds.length,5);assert.equal(result.strictPrepared,true);assert.equal(result.glError,0);assert.match(result.driver,/SwiftShader/i);assert.deepEqual(errors,[]);
 assert.equal(result.pivotMatrices,5);assert.equal(result.pivotRenderPasses,5);assert.equal(result.collapsedPivotDraws,3);assert.equal(result.pivotReverseStable,true);assert.equal(result.nativePivotSignOrderVerified,false);
 assert.ok(result.rotationRenderPasses>=1);assert.equal(result.rotationUvValues,48);assert.equal(result.rotationReadbacks,2);assert.equal(result.nativeTextureRotationSignOrderVerified,false);
 assert.ok(result.stretchMatrices>40);assert.ok(result.stretchGpuMatrices>=result.stretchMatrices);assert.equal(result.nativeStretchBasisOrderVerified,false);
 assert.ok(result.particleTrailPhysicsPoints>20);assert.equal(result.particleTrailGpuBuffers,16);assert.equal(result.particleTrailPasses,4);assert.equal(result.particleTrailReverseStable,true);
 assert.equal(result.volumeSamples,8);assert.equal(result.volumeGpuBuffers,8);assert.equal(result.volumeRunePasses,8);
 await page.screenshot({path:path.join(directory,'angular-motion-diagnostic.png')});
 const parentImage=await page.evaluate(()=>window.sourceParentImage);await writeFile(path.join(directory,'source-parent-motion-diagnostic.png'),Buffer.from(parentImage.split(',')[1],'base64'));
 const cleanup=await page.evaluate(async()=>{const{library,renderer,scene,camera}=angularReview;library.dispose();await Promise.resolve();renderer.render(scene,camera);const memory={...renderer.info.memory};renderer.dispose();return memory;});
 assert.equal(cleanup.geometries,0);assert.equal(cleanup.textures,0);
 const report={...result,cleanup,errors};await writeFile(path.join(directory,'angular-motion-browser-review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
