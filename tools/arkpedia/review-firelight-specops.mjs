// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3185';
const args=['--no-sandbox','--enable-unsafe-swiftshader'];
if(process.env.ARKPEDIA_REVIEW_CA_PINS)args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const dir=new URL('../../.cache/arkpedia/firelight-specops-battle-review/',import.meta.url);await mkdir(dir,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.ARKPEDIA_REVIEW_CHROME??'/usr/bin/chromium',headless:true,args}),results=[];
try{
 for(const mobile of [false,true])for(const [stage,id]of [['fc-7','enemy_1293_duswrd'],['fc-ex-3','enemy_1293_duswrd_2'],['fc-ex-7','enemy_1293_duswrd_3']]){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:mobile?1000:1440,height:mobile?420:900,isMobile:mobile,hasTouch:mobile});
  await page.goto(`${origin}/arkpedia/?stage=${stage}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#start:not(:disabled)',{timeout:60000});
  await page.evaluate(async()=>{
   const {StandardBattle}=await import('/sim/arkpedia.js'),old=StandardBattle.prototype.setViewport;
   StandardBattle.prototype.setViewport=function(...args){window.reviewBattle=this;return old.apply(this,args)};
   const{StageRenderer}=await import('/arkpedia/renderer.js'),draw=StageRenderer.prototype.drawSurface;
   StageRenderer.prototype.drawSurface=function(...args){window.reviewRenderer=this;return draw.apply(this,args)};
   Element.prototype.requestFullscreen=async()=>{};
  });
  await page.click('#start');await page.waitForFunction(()=>window.reviewBattle&&document.querySelector('#damage'));
  const state=await page.evaluate(id=>{
   const b=reviewBattle;b.addDp('arkpedia',99);let chosen;
   for(const op of Object.keys(b.bench))for(const tile of b.stageReeds.tiles.values())
    if(!chosen&&tile.mode===0&&!b.placementError(op,tile.row,tile.col))chosen={op,tile};
   if(!chosen)throw Error('No deployable Reeds tile');
   const{op,tile}=chosen,u=b.deployOperator(op,tile.row,tile.col,'RIGHT');
   b.addBuff(u,{key:'review:hold',flags:{disarm:true,noBlock:true}});u.base.maxHp=1000000;u.markDirty();u.hp=u.s.maxHp;
   const e=b.spawnEnemy(id,{pos:[tile.row,tile.col],countInTotal:true});window.reviewEnemy=e;
   b.addBuff(e,{key:'review:hold',flags:{disarm:true,noMove:true}});
   const ability=e.mem.ab.list.find(a=>'charge'in a);ability.charge=3;
   window.reviewHits=[];b.on('damaged',c=>{if(c.source===e&&c.dmg.tags.includes('chargedMelee'))reviewHits.push({time:b.time,loss:c.hpLoss,id:c.dmg.attackId})});
   b.forceAttack(e,[u]);for(let tick=0;tick<25;tick++)b.step();
   return{stage:b.stage.id,id,hits:reviewHits.length,mode:tile.mode,clip:e.mem.regularFormVisual?.clip,errors:b.errors};
  },id);
  assert.deepEqual(state.errors,[]);assert.equal(state.hits,2);assert.equal(state.mode,1);assert.equal(state.clip,'Skill');
  await page.waitForFunction(()=>window.reviewRenderer?.views.get(reviewEnemy.id)?.actor&&reviewRenderer.views.get(reviewEnemy.id).actor.constructor.name!=='FallbackActor',{timeout:60000});
  await page.screenshot({path:new URL(`${stage}-${mobile?'touch':'desktop'}.png`,dir).pathname});
  const finish=await page.evaluate(()=>{const b=reviewBattle;for(let i=0;i<65;i++)b.step();return{hits:reviewHits,clip:reviewEnemy.mem.regularFormVisual,errors:b.errors}});
  assert.equal(finish.hits.length,5);assert.equal(new Set(finish.hits.map(h=>h.id)).size,1);assert.equal(finish.clip,null);assert.deepEqual(finish.errors,[]);state.finish=finish;
  assert.deepEqual(errors,[]);results.push({mobile,scope:'Original stage and lazy models; diagnostic deployment/five-slash skill, not a playable clear',...state});await page.close();
 }
 await writeFile(new URL('results.json',dir),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
}finally{await browser.close()}
