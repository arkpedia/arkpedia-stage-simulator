// SPDX-License-Identifier: GPL-3.0-or-later
// Private original-stage fixture; does not establish public roster support.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const executablePath=process.env.ARKPEDIA_REVIEW_CHROME;
if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME and start the isolated source server on port 3183.');
const dir='.cache/arkpedia/lappland-alter-source/';
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.setViewport({width:1280,height:800});
 await page.goto('http://127.0.0.1:3183/arkpedia/lappland-battle-preview.html',{waitUntil:'networkidle0'});
 await page.waitForFunction(()=>window.lapplandStageReview,{timeout:60000});
 const initial=await page.evaluate(()=>({pos:[lapplandStageReview.owner.x,lapplandStageReview.owner.y],models:lapplandStageReview.stage.preloaded.size,
  art:!!lapplandStageReview.stage.art,errors:lapplandStageReview.battle.errors}));
 assert.deepEqual(initial.pos,[4,2]);assert.equal(initial.art,true);assert.deepEqual(initial.errors,[]);
 await page.click('#cast');await page.waitForFunction(()=>lapplandStageReview.pass.instanceCount===3);
 await page.evaluate(()=>lapplandStageReview.advance(.8));
 const live=await page.evaluate(()=>({roots:lapplandStageReview.pass.instanceCount,draws:lapplandStageReview.pass.inspect().map(e=>e.instance.draws.length),
  cameraDet:lapplandStageReview.pass.camera.matrixWorld.determinant(),views:lapplandStageReview.stage.views.size,
  enemyPositions:lapplandStageReview.battle.enemies.filter(e=>e.alive).map(e=>[e.x,e.y]),castDisabled:document.querySelector('#cast').disabled}));
 assert.equal(live.roots,3);assert.deepEqual(live.draws,[19,19,19]);assert.equal(live.cameraDet,-1);assert.equal(live.castDisabled,true);
 assert.deepEqual(live.enemyPositions,[[7,2]]);
 await page.screenshot({path:dir+'stage-preview-desktop.png'});
 const depth=await page.evaluate(async()=>{
  const T=await import('/vendor/three.module.js'),r=lapplandStageReview;
  const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(320,200);renderer.setClearColor(0,1);
  const boardCamera=r.stage.camera,sourceCamera=r.pass.camera,scene=r.pass.scene;
  const pixels=new Uint8Array(320*200*4),gl=renderer.getContext();
  const read=()=>{gl.readPixels(0,0,320,200,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return Array.from(pixels);};
  const colored=p=>{let n=0;for(let i=0;i<p.length;i+=4)if(p[i]||p[i+1]||p[i+2])n++;return n;};
  renderer.render(scene,sourceCamera);const baseline=read();
  const board=new T.Scene(),geometry=new T.PlaneGeometry(10000,10000),material=new T.MeshBasicMaterial({color:0,side:T.DoubleSide});
  const plane=new T.Mesh(geometry,material);board.add(plane);plane.quaternion.copy(boardCamera.quaternion);
  const forward=boardCamera.getWorldDirection(new T.Vector3());
  function occlude(distance){plane.position.copy(boardCamera.position).addScaledVector(forward,distance);renderer.autoClear=true;renderer.render(board,boardCamera);
   renderer.autoClear=false;renderer.render(scene,sourceCamera);return read();}
  const hidden=occlude(boardCamera.near*2),behind=occlude(boardCamera.far*.9);
  // Some original materials deliberately use Always/disabled depth testing.
  // Test board occlusion only on original draws that request depth testing.
  const visible=[];scene.traverse(o=>{if(o.isMesh&&!o.material.depthTest){visible.push([o,o.visible]);o.visible=false;}});
  renderer.autoClear=true;renderer.render(scene,sourceCamera);const tested=read(),testedHidden=occlude(boardCamera.near*2);
  visible.forEach(([o,v])=>o.visible=v);
  const result={baselinePixels:colored(baseline),nearOccluderPixels:colored(hidden),farOccluderPixels:colored(behind),farMatchesBaseline:baseline.every((v,i)=>v===behind[i]),
   depthTestedPixels:colored(tested),depthTestedOccludedPixels:colored(testedHidden),alwaysDepthMeshes:visible.length};
  geometry.dispose();material.dispose();renderer.dispose();return result;
 });
 console.log(JSON.stringify({depth}));assert.ok(depth.baselinePixels>0);assert.ok(depth.depthTestedPixels>0);assert.equal(depth.depthTestedOccludedPixels,0);assert.equal(depth.farMatchesBaseline,true);
 const paused=await page.evaluate(()=>JSON.stringify({time:lapplandStageReview.battle.time,motion:lapplandStageReview.pass.inspect().map(e=>[e.time,e.track.samples])}));
 await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,150)));
 assert.equal(await page.evaluate(()=>JSON.stringify({time:lapplandStageReview.battle.time,motion:lapplandStageReview.pass.inspect().map(e=>[e.time,e.track.samples])})),paused);
 await page.click('#play');await page.waitForFunction(()=>lapplandStageReview.battle.time>1);await page.click('#play');
 const pauseTime=await page.evaluate(()=>lapplandStageReview.battle.time);await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,150)));
 assert.equal(await page.evaluate(()=>lapplandStageReview.battle.time),pauseTime);
 await page.evaluate(()=>lapplandStageReview.advance(6));assert.equal(await page.evaluate(()=>lapplandStageReview.pass.instanceCount),0);
 await page.click('#move');await page.evaluate(()=>lapplandStageReview.advance(.1));
 await page.waitForFunction(()=>lapplandStageReview.pass.instanceCount===3);
 const reappearance=await page.evaluate(()=>lapplandStageReview.pass.inspect().map(e=>({samples:e.track.samples.length,time:e.time})));
 assert.ok(reappearance.every(e=>e.time<.1));
 await page.evaluate(()=>lapplandStageReview.advance(.4));
 await page.setViewport({width:844,height:390});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot({path:dir+'stage-preview-landscape.png'});
 const landscape=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,portrait:getComputedStyle(document.querySelector('#portrait')).display,
  actors:lapplandStageReview.stage.views.size,ownerVisible:!!lapplandStageReview.stage.views.get(lapplandStageReview.owner.id),
  canvas:lapplandStageReview.stage.three.domElement.getBoundingClientRect().toJSON()}));
 assert.equal(landscape.overflow,false);assert.equal(landscape.portrait,'none');assert.ok(landscape.canvas.height>150);
 assert.equal(landscape.ownerVisible,true);
 await page.setViewport({width:390,height:844});await page.click('#play');
 const portraitTime=await page.evaluate(()=>lapplandStageReview.battle.time);await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,150)));
 const portrait=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,display:getComputedStyle(document.querySelector('#portrait')).display,time:lapplandStageReview.battle.time}));
 assert.equal(portrait.overflow,false);assert.equal(portrait.display,'flex');assert.equal(portrait.time,portraitTime);
 await page.screenshot({path:dir+'stage-preview-portrait.png'});await page.click('#play');
 await page.setViewport({width:1280,height:800});await page.click('#retreat');
 const retired=await page.evaluate(()=>({roots:lapplandStageReview.pass.instanceCount,library:lapplandStageReview.library.instanceCount,alive:lapplandStageReview.owner.alive}));
 assert.equal(retired.roots,0);assert.equal(retired.library,0);assert.equal(retired.alive,false);
 await page.click('#reset');await page.waitForFunction(()=>lapplandStageReview.owner.alive&&lapplandStageReview.battle.time===0);
 assert.equal(await page.evaluate(()=>lapplandStageReview.stage.preloaded.size),initial.models);
 await page.click('#cast');await page.waitForFunction(()=>lapplandStageReview.pass.instanceCount===3);
 await page.evaluate(()=>lapplandStageReview.advance(36));assert.equal(await page.evaluate(()=>lapplandStageReview.pass.instanceCount),0);
 const cleanup=await page.evaluate(()=>{const r=lapplandStageReview;r.dispose();r.dispose();return {roots:r.pass.instanceCount,library:r.library.instanceCount};});
 assert.deepEqual(cleanup,{roots:0,library:0});assert.deepEqual(errors,[]);
 const report={driver:'Chromium software WebGL2',publicFactory:false,compiledFrameParity:false,initial,live,depth,pauseStable:true,reappearance,landscape,portrait,retired,resetStable:true,skillEndRetires:true,cleanup,errors};
 await writeFile(dir+'stage-browser-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
