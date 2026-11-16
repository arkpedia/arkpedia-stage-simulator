// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled browser fixture on the default compiled stage: compiled Hui-Ming
// records blocked by a deployed operator whose attribute is set explicitly
// through the shared account. No Hui-Ming tiles, devices or original stage.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createPublicReviewServer} from './public-review-server.mjs';
import {withCompiledEnemyRuntime} from '../../shared/arkpedia/enemy-runtime-compiler.js';
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3185',executablePath=process.env.ARKPEDIA_REVIEW_CHROME;
if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME and start the requested local preview');
const out=resolve(process.env.ARKPEDIA_REVIEW_OUT??'.cache/arkpedia/hui-ming-review');await mkdir(out,{recursive:true});
const root=new URL('../../',import.meta.url),all=JSON.parse(await readFile(new URL('data/arkpedia-enemy-records.json',root))).enemies;
const ids=['enemy_1122_sphond','enemy_1122_sphond_2','enemy_1123_spsbr','enemy_1123_spsbr_2','enemy_1125_spshld','enemy_1125_spshld_2'];
const app=await readFile(new URL('public/arkpedia/app.js',root),'utf8'),data=await(await fetch(origin+'/data/arkpedia-mvp.json')).json();
const fixture=await createPublicReviewServer({origin,app,data,hook:'\n;window.huiMingReviewData=data;\n'});
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const results=[],version=await browser.version();
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage(),pageErrors=[],requests=[];page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('request',r=>{const u=new URL(r.url());if(u.origin===fixture.origin)requests.push(u.pathname);});
  await page.setViewport(mobile?{width:844,height:390,isMobile:true,hasTouch:true}:{width:1440,height:900});
  await page.goto(fixture.origin+'/arkpedia/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#start:not(:disabled)',{timeout:60000});
  await page.evaluate(async records=>{
   const {StandardBattle}=await import('/sim/arkpedia.js'),original=StandardBattle.prototype.setViewport;
   StandardBattle.prototype.setViewport=function(...args){window.reviewBattle=this;return original.apply(this,args)};
   const {StageRenderer}=await import('/arkpedia/renderer.js'),preload=StageRenderer.prototype.preload;
   StageRenderer.prototype.preload=function(...args){window.reviewRenderer=this;return preload.apply(this,args)};
   Element.prototype.requestFullscreen=async()=>{};
   huiMingReviewData.enemies={...huiMingReviewData.enemies,...records};
  },Object.fromEntries(ids.map(id=>[id,withCompiledEnemyRuntime(all[id].levels[0])])));
  await page.click('#start');await page.waitForFunction(()=>window.reviewBattle&&window.reviewRenderer,{timeout:60000});
  await page.waitForFunction(keys=>keys.every(key=>window.reviewRenderer.preloaded.has(key)),{timeout:60000,polling:100},ids.map(id=>`enemy/${id}/default/default`));
  const result=await page.evaluate(async ids=>{
   const b=reviewBattle,{huiMingOf,setHuiMing}=await import('/sim/content/arkpedia-hui-ming.js');b.life=1e6;b.addDp('arkpedia',99);
   const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const until=(done,limit)=>{for(let i=0,n=Math.round(limit/b.dt);i<n&&!done();i++)b.step();return done();};
   const benched=Object.keys(b.bench).find(k=>{try{return !b._placementError(k,3,4,{});}catch{return false;}});
   const guard=b.deployOperator(benched,3,4,'RIGHT');guard.base.maxHp=1e7;guard.markDirty();guard.hp=guard.s.maxHp;
   const variants=[];
   for(const id of ids){
    const e=b.spawnEnemy(id,{pos:[3,4]}),scales=[];b.on('sourceAtkScale',c=>{if(c.source===e&&c.target===guard)scales.push(c.scale);},{owner:e});
    const row={id,initial:huiMingOf(e),marker:!!e.findBuff('buff_yang[effect]'),parents:!!e.findBuff('buff_yinyang[same]')&&!!e.findBuff('buff_yinyang[diff]')};
    const hit=()=>{const count=scales.length;return until(()=>scales.length>count,12)?scales.at(-1):null;};
    for(const buff of ['buff_yin','buff_yang'])b.removeBuff(guard,buff);
    row.blocked=until(()=>e.blockedBy===guard,6);row.plain=hit();await frame();
    row.model=reviewRenderer.views.get(e.id)?.key;row.actor=reviewRenderer.views.get(e.id)?.actor.constructor.name;
    setHuiMing(b,guard,'yang');row.same=hit();setHuiMing(b,guard,'yin');row.opposite=hit();row.guardMarker=!!guard.findBuff('buff_yang_to_yin[effect]');
    b.kill(e);row.errors=[...b.errors];variants.push(row);
   }
   return{target:benched,variants};
  },ids);
  const after=await page.evaluate(()=>reviewBattle.enemyRuntime.stats());
  await page.screenshot({path:resolve(out,`${mobile?'touch':'desktop'}.png`)});
  try{
   for(const row of result.variants){
    assert.deepEqual({...row,id:undefined},{id:undefined,initial:'yang',marker:true,parents:true,blocked:true,plain:1,model:`enemy/${row.id}/default/default`,actor:'BattleActor',same:.6,opposite:1.4,guardMarker:true,errors:[]});
   }
   assert.deepEqual(pageErrors,[]);assert.ok(after.loaded.includes('arkpedia-hui-ming'));assert.equal(after.pending,0);
   assert.ok(!requests.some(p=>/enemy-runtime-compiler|behavior-native-compiler|native-buff-programs|enemy-features|enemy-native-abilities/.test(p)));
  }catch(error){console.error(JSON.stringify(result));throw error;}
  results.push({viewport:mobile?'844x390 touch':'1440x900 desktop',loaded:after.loaded,pending:after.pending,sourceCatalogueRequests:0,pageErrors,result});await page.close();
 }
}finally{await browser.close();await fixture.close();}
await writeFile(resolve(out,'review.json'),JSON.stringify({scope:'Controlled Hui-Ming fixture on the default compiled stage geometry: compiled records blocked by a deployed operator whose attribute is set through the shared account. No Hui-Ming tiles or devices, original-stage clear, effects/audio or frame/pixel parity.',browser:version,results},null,1)+'\n');
console.log(`Hui-Ming browser fixture: ${results.length} runs passed`);
