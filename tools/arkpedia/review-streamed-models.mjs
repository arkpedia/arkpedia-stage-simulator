// SPDX-License-Identifier: GPL-3.0-or-later
// Deterministic browser regression: hold model transport until after deployment.
// Uses a controlled tile on LE-5; this is not a stage-clear or artwork-fidelity test.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182';
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname))throw Error('Use a loopback simulator preview');
const out=resolve(process.env.ARKPEDIA_REVIEW_OUT??'.cache/arkpedia/streamed-model-review');await mkdir(out,{recursive:true});
const pins=process.env.ARKPEDIA_REVIEW_SPKI_FILE?String(await readFile(process.env.ARKPEDIA_REVIEW_SPKI_FILE)).trim():null;
const browser=await puppeteer.launch({executablePath:process.env.ARKPEDIA_REVIEW_CHROME??'/usr/bin/chromium',headless:true,
 args:['--no-sandbox','--enable-unsafe-swiftshader',...(pins?[`--ignore-certificate-errors-spki-list=${pins}`]:[])]});
const report=[];
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage(),errors=[],failedModels=[];let release,held=0;
  const gate=new Promise(resolve=>{release=resolve;});
  await page.setViewport({width:1440,height:900,isMobile:mobile,hasTouch:mobile});await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  page.on('request',async request=>{try{if(request.url().includes('/models/')){held++;await gate;}await request.continue();}catch{}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/models/')&&r.status()>=400)failedModels.push({url:r.url(),status:r.status()});});
  page.on('requestfailed',r=>{if(r.url().includes('/models/'))failedModels.push({url:r.url(),error:r.failure()?.errorText});});
  try{
   await page.goto(`${origin}/arkpedia/?experimental=1&stage=le-5`,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForSelector('#start:not(:disabled)',{timeout:60000});
   await page.evaluate(async()=>{
    const {StandardBattle}=await import('/sim/arkpedia.js'),old=StandardBattle.prototype.setViewport;
    StandardBattle.prototype.setViewport=function(...args){window.streamBattle=this;return old.apply(this,args)};
    const {StageRenderer}=await import('/arkpedia/renderer.js'),render=StageRenderer.prototype.render;
    StageRenderer.prototype.render=function(...args){window.streamRenderer=this;return render.apply(this,args)};
   });
   await page.click('#start');await page.waitForFunction(()=>window.streamBattle&&window.streamRenderer?.projection);
   const before=await page.evaluate(()=>{
    const b=window.streamBattle;b.autoFinish=false;b._pending=[];for(const e of [...b.enemies])b.kill(e);
    const id=Object.keys(b.bench)[0];b.getPlayer('arkpedia').dp=99;b.grid.setTile(4,8,{...b.grid.tile(4,8),build:'ALL',pass:'ALL'});
    const u=b.deployOperator(id,4,8,'RIGHT');window.streamUnit=u;
    return {id:u.id,defId:u.defId,life:u.deploySeq,hp:u.hp,time:b.time};
   });
   await page.waitForFunction(()=>streamRenderer.views.get(streamUnit.id)?.actor.constructor.name==='FallbackActor');
   assert.ok(held>0,'model requests must still be held');
   const label=mobile?'mobile':'desktop';await page.screenshot({path:resolve(out,`${label}-before.png`)});
   release();
   await page.waitForFunction(()=>streamRenderer.views.get(streamUnit.id)?.actor.constructor.name==='BattleActor',{timeout:60000});
   const after=await page.evaluate(()=>{const u=streamUnit,b=streamBattle,v=streamRenderer.views.get(u.id);return {
    unit:{id:u.id,defId:u.defId,life:u.deploySeq,hp:u.hp,time:b.time},actor:v.actor.constructor.name,key:v.key,
    loaded:streamRenderer.preloaded.has(v.key),errors:b.errors};});
   assert.deepEqual(after.unit,before,'art replacement must preserve the deployed unit');assert.equal(after.loaded,true);
   assert.deepEqual(after.errors,[]);assert.deepEqual(errors,[]);assert.deepEqual(failedModels,[]);
   await page.screenshot({path:resolve(out,`${label}-after.png`)});
   report.push({label,held,before,after,errors,failedModels});
  }catch(error){
   const state=await page.evaluate(()=>({key:window.streamRenderer?.views.get(window.streamUnit?.id)?.key,
    loaded:[...(window.streamRenderer?.preloaded.keys()??[])],actor:window.streamRenderer?.views.get(window.streamUnit?.id)?.actor.constructor.name})).catch(()=>null);
   console.error(JSON.stringify({mobile,held,state,errors,failedModels},null,2));throw error;
  }finally{release();await page.close();}
 }
 await writeFile(resolve(out,'review.json'),JSON.stringify({scope:'Controlled delayed-model transport and actor replacement; no combat/art fidelity claim',browser:await browser.version(),results:report},null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
