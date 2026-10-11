// SPDX-License-Identifier: GPL-3.0-or-later
// Original multi-instance playback review; requires the isolated source server.
import puppeteer from 'puppeteer-core';import assert from 'node:assert/strict';import {writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const dir='.cache/arkpedia/lappland-alter-source/',replay=JSON.parse(await readFile(dir+'battle-motion-replay.json','utf8'));
const executablePath=process.env.ARKPEDIA_REVIEW_CHROME;if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME to a local Chromium executable. Start the isolated original-effect server on port 3183 first.');
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.setViewport({width:1280,height:800});await page.goto('http://127.0.0.1:3183/',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.effectReview?.library);
 const result=await page.evaluate(async recording=>{
  const T=await import('/vendor/three.module.js'),{createEffectTrajectory}=await import('/shared/arkpedia/native-effect-trail.js');
  await effectReview.selectRoot(recording.tracks[0].effect);
  const lib=effectReview.library;effectReview.player.dispose();const host=document.querySelector('#scene');host.firstChild.style.display='none';
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(host.clientWidth,host.clientHeight);host.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#142027');const camera=new T.PerspectiveCamera(35,host.clientWidth/host.clientHeight,.001,100);camera.up.set(0,1,0);
  const instances=await Promise.all(recording.tracks.slice(0,3).map(t=>lib.create(t.effect))),paths=recording.tracks.slice(0,3).map(t=>createEffectTrajectory(t.samples));
  for(const i of instances)scene.add(i.group);
  const snapshot=()=>instances.filter(i=>!i.disposed).map(i=>i.draws.map(d=>({id:d.component,particles:d.lastParticles??null,trails:d.trailData??null,visible:d.mesh.visible,
   rendered:(d.pool??[]).filter(p=>p.visible).map(p=>p.matrixWorld.elements.slice()),uniformTime:d.mesh.material.uniforms._Time?.value.toArray()??null})));
  function render(times){
   const bounds=new T.Box3();instances.forEach((i,n)=>{if(!i.disposed){const p=paths[n].sample(times[n]);bounds.expandByPoint(new T.Vector3(...p));}});
   const centre=bounds.getCenter(new T.Vector3()),size=Math.max(1.2,bounds.getSize(new T.Vector3()).length()+.6);
   camera.position.copy(centre).add(new T.Vector3(.2,.35,1).normalize().multiplyScalar(size*1.8/Math.min(1,camera.aspect)));camera.lookAt(centre);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
   instances.forEach((i,n)=>{if(!i.disposed)i.update(times[n],{camera,trajectory:paths[n]});});renderer.render(scene,camera);
  }
  render([.5,.7,.9]);const before=snapshot(),gpuInitial={...renderer.info.memory};render([1.4,1.7,2]);render([.5,.7,.9]);
  if(JSON.stringify(before)!==JSON.stringify(snapshot()))throw Error('Multiple-source playback did not reverse exactly');
  if(lib.instanceCount!==3||instances.some(i=>i.draws.length!==19||i.blocked.length))throw Error('Missing independent source instances');
  for(const i of instances)for(const d of i.draws.filter(d=>d.emitter?.worldMotion))d.lastParticles.forEach((p,n)=>p.worldPosition.forEach((v,k)=>{if(Math.abs(v-d.pool[n].matrixWorld.elements[k+12])>1e-8)throw Error('Source-to-render world mismatch');}));
  const gpuBefore={...renderer.info.memory};instances[0].dispose();render([.5,.7,.9]);const gpuAfterOne={...renderer.info.memory};
  // Removing one root reframes the camera; its survivors' particle data remain
  // identical while their view-facing quads/trails correctly use that new camera.
  const beforeParticles=before.slice(1).map(ds=>ds.map(d=>d.particles)),afterParticles=snapshot().map(ds=>ds.map(d=>d.particles));
  if(JSON.stringify(beforeParticles)!==JSON.stringify(afterParticles))throw Error('Retirement changed another drone particle path');
  if(gpuAfterOne.geometries>=gpuBefore.geometries||gpuAfterOne.textures!==gpuBefore.textures||lib.instanceCount!==2)throw Error('Incorrect per-instance GPU resource ownership '+JSON.stringify({gpuInitial,gpuBefore,gpuAfterOne,count:lib.instanceCount}));
  // Restore three source instances for the desktop/mobile review capture.
  instances[0]=await lib.create(recording.tracks[0].effect);scene.add(instances[0].group);render([.5,.7,.9]);
  document.querySelector('#status').textContent='Three original S3 cruise roots playing concurrently from recorded simulator paths. Independent clocks: 0.5 / 0.7 / 0.9 seconds. Source coordinate space; native game-frame parity remains unverified.';
  const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;render([.5,.7,.9]);};const observer=new ResizeObserver(resize);observer.observe(host);
  window.multiEffectReview={renderer,lib,instances,scene,camera,resize,dispose:async()=>{observer.disconnect();lib.dispose();await Promise.resolve();renderer.render(scene,camera);return {...renderer.info.memory};}};
  return {instances:instances.length,draws:instances.map(i=>i.draws.length),reverseStable:true,gpuInitial,gpuBefore,gpuAfterOne};
 },replay);
 assert.deepEqual(result.draws,[19,19,19]);await page.screenshot({path:dir+'player-multi-desktop.png'});
 await page.setViewport({width:390,height:844});await page.waitForFunction(()=>window.multiEffectReview.renderer.domElement.clientWidth===390);
 await page.screenshot({path:dir+'player-multi-mobile.png'});const mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,canvasWidth:multiEffectReview.renderer.domElement.clientWidth,canvasHeight:multiEffectReview.renderer.domElement.clientHeight}));assert.equal(mobile.overflow,false);assert.ok(mobile.canvasHeight>200);
 const cleanup=await page.evaluate(()=>multiEffectReview.dispose());assert.equal(cleanup.geometries,0);assert.equal(cleanup.textures,0);assert.deepEqual(errors,[]);
 const report={driver:'Chromium software WebGL2',compiledFrameParity:false,...result,mobile,cleanup,errors};await writeFile(dir+'player-browser-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
