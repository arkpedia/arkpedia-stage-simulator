// SPDX-License-Identifier: GPL-3.0-or-later
// Actual WebGL2 original shaders/textures; explicit endpoint/global fixture.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const directory='.cache/arkpedia/aphrissa-source/effects/line-browser/';
const executablePath=process.env.ARKPEDIA_REVIEW_CHROME;
if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME; start preview-aphrissa-effects.mjs on port3185.');
await mkdir(directory,{recursive:true});
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],failed=[],page=await browser.newPage();
const client=await page.createCDPSession();
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failed.push(r.url()));
try{
 await page.setCacheEnabled(false);await page.setViewport({width:1280,height:800});await page.goto('http://127.0.0.1:3185/',{waitUntil:'networkidle0'});
 const setup=await page.evaluate(async()=>{
  const T=await import('/vendor/three.module.js'),{createNativeEffectLibrary,compileNativeEffectPrograms}=await import('/arkpedia/native-effect-player.js');
  const meta=await(await fetch('/review-assets/manifest.json')).json();
  const verified=async entry=>{const r=await fetch('/review-assets/'+entry.path);if(!r.ok)throw Error('Original source unavailable');const b=await r.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(b.byteLength!==entry.bytes||hash!==entry.sha256)throw Error('Original source hash differs');return b;};
  const pack=await new Response(new Blob([await verified(meta.effects.pack)]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  const animations=JSON.parse(new TextDecoder().decode(await verified(meta.animations.artifact))),shaders=JSON.parse(new TextDecoder().decode(await verified(meta.shaders.artifact)));
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setClearColor('#0b1116');document.querySelector('#scene').append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.001,100);camera.position.set(4.7,3.2,10);camera.lookAt(4.7,3.2,0);
  const programs=compileNativeEffectPrograms(renderer,shaders);
  const lib=createNativeEffectLibrary({three:T,pack,animations,shaders,shaderGlobals:{_HG_UV_ROTATION:0},loadTexture:async entry=>{
    const blob=new Blob([await verified(entry)],{type:'image/webp'}),url=URL.createObjectURL(blob),image=new Image();image.src=url;
    try{await image.decode();const t=new T.Texture(image);t.needsUpdate=true;return t;}finally{URL.revokeObjectURL(url);}
  }});
  const instances=[];let clip=null,owner=true;
  const snapshot=i=>JSON.stringify(i.draws.map(d=>({id:d.component,data:d.lineData,width:d.mesh.material.uniforms._MainColor?.value.toArray(),matrix:d.mesh.matrixWorld.elements})));
  const render=(a=.05,b=.07)=>{
    renderer.setSize(innerWidth,document.querySelector('#scene').clientHeight);camera.aspect=renderer.domElement.width/renderer.domElement.height;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    instances.forEach((i,n)=>{if(!i.disposed)i.update(n?b:a,{camera,clip});});renderer.render(scene,camera);
    const gl=renderer.getContext(),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let visible=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>23||pixels[i+1]>29||pixels[i+2]>34)visible++;
    if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL error in original beams');return visible;
  };
  const select=async root=>{
    for(const i of instances.splice(0))i.dispose();owner=true;
    for(const offset of [-.65,.65]){
      const index=instances.length;
      const instance=await lib.inspectLines(root,{linePositions:(id,time)=>{
        if(index===0&&!owner)return null;
        return pack.records[id].data.m_Positions.map(p=>[p.x,p.y+offset,p.z+Math.sin(time)*.03]);
      }});
      if(instance.blocked.length||instance.draws.length!==8||instance.inspection.fullEffect!==false)throw Error('Incomplete original line inspection');
      instances.push(instance);scene.add(instance.group);
    }
    clip=instances[0].pose.instances.find(i=>animations.clips[i.clip].name===root).clip;
    const visible=render(),before=instances.map(snapshot);render(.08,.09);render();
    if(JSON.stringify(instances.map(snapshot))!==JSON.stringify(before))throw Error('Original line reverse scrub mismatch');
    document.querySelector('#status').textContent=root+' · 2 independent instances, 8 original layers each · explicit UV switch=0 and endpoint fixture; full gameplay remains held.';
    return {root,draws:instances.map(i=>i.draws.length),visiblePixels:visible,reverseStable:true};
  };
  window.lineReview={renderer,lib,instances,select,render,snapshot,setOwner:v=>{owner=v;},dispose:async()=>{lib.dispose();await Promise.resolve();renderer.render(scene,camera);return {...renderer.info.memory};}};
  return {compiledPrograms:programs.length,roots:Object.keys(meta.lines.roots),sourcePackSha256:meta.effects.pack.sha256};
 });
 assert.equal(setup.compiledPrograms,12);
 const results=[];
 for(const root of setup.roots){
   await client.send('Emulation.setTouchEmulationEnabled',{enabled:false});
   await page.setViewport({width:1280,height:800});const desktop=await page.evaluate(root=>lineReview.select(root),root);assert.ok(desktop.visiblePixels>150);
   const path=directory+'desktop-'+root+'.png';await page.screenshot({path});
   await page.setViewport({width:844,height:390});
   await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
   const mobile=await page.evaluate(()=>({visiblePixels:lineReview.render(),overflow:document.documentElement.scrollWidth>innerWidth,touchPoints:navigator.maxTouchPoints}));
   assert.ok(mobile.visiblePixels>100);assert.equal(mobile.overflow,false);assert.ok(mobile.touchPoints>0);
   await page.screenshot({path:directory+'touch-'+root+'.png'});results.push({...desktop,mobile});
 }
 const ownership=await page.evaluate(()=>{
  const r=lineReview,before=r.snapshot(r.instances[1]),gpuBefore={...r.renderer.info.memory};r.setOwner(false);r.render();
  if(r.instances[0].draws.some(d=>d.mesh.visible||d.lineData.indices.length))throw Error('Unowned line remained visible');
  if(before!==r.snapshot(r.instances[1]))throw Error('Owner release changed other original beam');
  r.instances[0].dispose();r.render();const gpuAfter={...r.renderer.info.memory};
  return {gpuBefore,gpuAfter,survivorStable:true};
 });
 assert.ok(ownership.gpuAfter.geometries<ownership.gpuBefore.geometries);assert.equal(ownership.gpuAfter.textures,ownership.gpuBefore.textures);
 const cleanup=await page.evaluate(()=>lineReview.dispose());assert.equal(cleanup.geometries,0);assert.equal(cleanup.textures,0);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const report={driver:'Chromium software WebGL2',compiledFrameParity:false,nativeEndpointDispatchVerified:false,nativeShaderGlobalsVerified:false,
   explicitShaderGlobals:{_HG_UV_ROTATION:0},...setup,results,ownership,cleanup,errors,failed};
 report.playerSha256=createHash('sha256').update(await readFile('public/arkpedia/native-effect-player.js')).digest('hex');
 await writeFile(directory+'report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
