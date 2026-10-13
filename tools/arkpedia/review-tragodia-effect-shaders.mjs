// SPDX-License-Identifier: GPL-3.0-or-later
// Compile all checksum-pinned original programs using the shared WebGL port.
// This ephemeral loopback check does not enable battle effects or certify pixels.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {createStaticHandler} from '../../server/index.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=path.join(root,'.cache/arkpedia/tragodia-source/effects');
const metadata=JSON.parse(await readFile(path.join(root,'data/arkpedia-tragodia-effect-shaders.json')));
const effects=JSON.parse(await readFile(path.join(root,'data/arkpedia-tragodia-effects.json')));
const check=(bytes,entry)=>{
 assert.equal(bytes.length,entry.bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
};
const shaderBytes=await readFile(path.join(directory,'native-shaders.json'));check(shaderBytes,metadata.artifact);
const effectBytes=await readFile(path.join(directory,'native-effects.bin'));check(effectBytes,effects.pack);
const shaders=JSON.parse(shaderBytes),pack=JSON.parse(gunzipSync(effectBytes));
const animationMeta=JSON.parse(await readFile(path.join(root,'data/arkpedia-tragodia-effect-animations.json')));
const animationBytes=await readFile(path.join(directory,'native-animations.json'));check(animationBytes,animationMeta.artifact);
const animations=JSON.parse(animationBytes);
assert.equal(animations.sourcePackSha256,effects.pack.sha256);
const textureFiles=new Map(Object.values(effects.textures).map(entry=>[entry.path,entry]));
const materials=Object.entries(pack.records).filter(([,r])=>r.type==='Material').map(([key,r])=>({key,
 shader:r.references.find(r=>r.field==='m_Shader')?.target,keywords:r.data.m_ValidKeywords}));
const executablePath=process.env.ARKPEDIA_REVIEW_CHROME;
if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME to a local Chromium executable');
const serve=createStaticHandler({publicDir:path.join(root,'public'),dataDir:path.join(root,'data'),sharedDir:path.join(root,'shared')});
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 try{
  if(url.pathname==='/shader-review.html'){
   res.writeHead(200,{'Content-Type':'text/html'});
   res.end('<!doctype html><title>Original shader compilation check</title>');return;
  }
  if(url.pathname.startsWith('/review-textures/')){
   const entry=textureFiles.get(url.pathname.slice('/review-textures/'.length));
   if(!entry){res.writeHead(404);res.end('Unknown original texture');return;}
   const bytes=await readFile(path.join(directory,entry.path));check(bytes,entry);
   res.writeHead(200,{'Content-Type':'image/webp'});res.end(bytes);return;
  }
  await serve(req,res,url.pathname,url.search.slice(1));
 }catch(error){if(!res.headersSent)res.writeHead(500);res.end('Review input unavailable');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await puppeteer.launch({executablePath,headless:true,
  args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/shader-review.html`);
 const result=await page.evaluate(async({shaders,materials,pack,animations})=>{
  const T=await import('/vendor/three.module.js');
  const {compileNativeEffectPrograms,createNativeEffectLibrary}=await import('/arkpedia/native-effect-player.js');
  const {webglEffectProgram,selectEffectProgram,effectUniformDeclarations}=await import('/shared/arkpedia/native-effect-shader.js');
  const renderer=new T.WebGLRenderer(),gl=renderer.getContext();
  try{
   if(!(gl instanceof WebGL2RenderingContext))throw Error('Original programs require WebGL2');
   const compiled=compileNativeEffectPrograms(renderer,shaders);
   const selected=materials.map(m=>{
    const shader=shaders.shaders[m.shader];
    if(!shader)throw Error('Missing original material shader '+m.key);
    const program=selectEffectProgram(shader,m.keywords);
    const declarations=effectUniformDeclarations(webglEffectProgram(program.source));
    return {material:m.key,shader:m.shader,blobIndex:program.blobIndex,uniforms:declarations.length};
   });
   const library=createNativeEffectLibrary({three:T,pack,animations,shaders,loadTexture:async entry=>{
    const response=await fetch('/review-textures/'+entry.path);
    if(!response.ok)throw Error('Original texture unavailable');
    const bytes=await response.arrayBuffer();
    const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(bytes.byteLength!==entry.bytes||sha!==entry.sha256)throw Error('Changed original texture');
    const url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
    try{return await new T.TextureLoader().loadAsync(url);}finally{URL.revokeObjectURL(url);}
   }});
   let cage;
   try{
    const instance=await library.create('phatm2_skill_03_prison_01',{allowBlocked:true});
    const camera=new T.PerspectiveCamera(35,1,.001,100);camera.position.set(0,2,3);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    const times=[0,.25,16/30,1],clip='battle/prefabs/effects/phatm2.ab:7379801640911501129';
    for(const time of times)instance.update(time,{camera,clip});
    cage={root:instance.name,draws:instance.draws.map(d=>d.component),blocked:instance.blocked,times,
     nodes:instance.pose.nodes.size,renderers:instance.pose.renderers.size,rendered:false};
   }finally{library.dispose();}
   const debug=gl.getExtension('WEBGL_debug_renderer_info');
   const driver=gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER);
   return {compiled,materials:selected,glError:gl.getError(),driver,
    cage,compiledFrameParity:false,rendererVerified:false};
  }finally{renderer.dispose();renderer.forceContextLoss();}
 },{shaders,materials,pack,animations});
 assert.equal(result.compiled.length,22);assert.equal(new Set(result.compiled.map(p=>p.shader)).size,8);
 assert.equal(result.materials.length,91);assert.equal(result.glError,0);assert.deepEqual(errors,[]);
 assert.match(result.driver,/SwiftShader/i);
 assert.equal(result.cage.nodes,22);assert.equal(result.cage.renderers,20);
 assert.equal(result.cage.draws.length,5);assert.equal(result.cage.blocked.length,13);
 const report={sourceArtifact:metadata.artifact.sha256,...result,errors};
 await writeFile(path.join(directory,'shader-browser-review.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({shaders:8,programs:result.compiled.length,materials:result.materials.length,
  cageDraws:result.cage.draws.length,cageBlocked:result.cage.blocked.length,
  glError:result.glError,driver:result.driver,compiledFrameParity:false,rendererVerified:false,errors}));
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
