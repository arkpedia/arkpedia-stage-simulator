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
 const result=await page.evaluate(async({pack,animations,shaders})=>{
  const T=await import('/vendor/three.module.js'),{createNativeEffectLibrary,compileNativeEffectPrograms}=await import('/arkpedia/native-effect-player.js');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(512,512);renderer.setPixelRatio(1);document.body.style.margin='0';document.body.append(renderer.domElement);
  const loader=new T.TextureLoader(),library=createNativeEffectLibrary({three:T,pack,animations,shaders,loadTexture:async e=>{
   const b=await(await fetch('/review-textures/'+e.path)).arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
   if(b.byteLength!==e.bytes||digest!==e.sha256)throw Error('Changed original angular diagnostic texture');
   const url=URL.createObjectURL(new Blob([b],{type:'image/webp'}));try{return await loader.loadAsync(url);}finally{URL.revokeObjectURL(url);}
  }});
  try{
   const programs=compileNativeEffectPrograms(renderer,shaders);
   const instance=await library.create('whitw2_skill_03_buff_01',{allowBlocked:true}),scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.001,100);
   scene.background=new T.Color('#142027');scene.add(instance.group);
   const captureTime=1.8;camera.position.set(.2,.4,3);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
   instance.update(captureTime,{camera});instance.group.updateMatrixWorld(true);
   let strictRejected=false;try{await library.create('whitw2_skill_03_buff_01');}catch(error){if(!/unplayed components/.test(error.message))throw error;strictRejected=true;}
   if(!strictRejected||library.instanceCount!==1)throw Error('Partial angular root bypassed strict playback');
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
   return {root:instance.name,draws:instance.draws.length,blocked:instance.blocked,programs:programs.length,sourceIds,matrices,captureTime,reverseStable:true,strictRejected,glError,driver,compiledFrameParity:false,diagnosticOnly:true};
  }catch(error){library.dispose();renderer.dispose();throw error;}
 },{pack,animations,shaders});
 assert.equal(result.programs,23);assert.ok(result.matrices>=5);assert.equal(result.sourceIds.length,5);assert.equal(result.strictRejected,true);assert.equal(result.glError,0);assert.match(result.driver,/SwiftShader/i);assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(directory,'angular-motion-diagnostic.png')});
 const cleanup=await page.evaluate(async()=>{const{library,renderer,scene,camera}=angularReview;library.dispose();await Promise.resolve();renderer.render(scene,camera);const memory={...renderer.info.memory};renderer.dispose();return memory;});
 assert.equal(cleanup.geometries,0);assert.equal(cleanup.textures,0);
 const report={...result,cleanup,errors};await writeFile(path.join(directory,'angular-motion-browser-review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
