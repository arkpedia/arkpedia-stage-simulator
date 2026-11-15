// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3185';
const args=['--no-sandbox','--enable-unsafe-swiftshader'];
if(process.env.ARKPEDIA_REVIEW_CA_PINS)args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const dir=new URL('../../.cache/arkpedia/firelight-ranged-battle-review/',import.meta.url);await mkdir(dir,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.ARKPEDIA_REVIEW_CHROME??'/usr/bin/chromium',headless:true,args}),results=[];
try{
 for(const mobile of [false,true])for(const [stage,id]of [['fc-3','enemy_1289_dubmb'],['fc-5','enemy_1290_duflm']]){
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
   b.addBuff(u,{key:'review:hold',flags:{disarm:true,noBlock:true,invulnerable:true}});
   const e=b.spawnEnemy(id,{pos:[tile.row,tile.col],countInTotal:true});window.reviewEnemy=e;
   b.addBuff(e,{key:'review:hold',flags:{disarm:true,noMove:true}});
   const phases=[];
   for(let i=0;i<(id.includes('dubmb')?3:1);i++){
    b.forceAttack(e,[u]);phases.push({charge:e.mem.ab.list.find(a=>'charge'in a)?.charge??null,projectiles:b.projectiles.list.length});
    for(let tick=0;tick<35;tick++)b.step();
   }
   return{stage:b.stage.id,id,phases,mode:tile.mode,errors:b.errors};
  },id);
  assert.deepEqual(state.errors,[]);assert.ok(state.phases.every(p=>p.projectiles>0));
  if(id.includes('dubmb'))assert.deepEqual(state.phases.map(p=>p.charge),[1,2,0]);else assert.equal(state.mode,1);
  await page.waitForFunction(()=>window.reviewRenderer?.views.get(reviewEnemy.id)?.actor&&reviewRenderer.views.get(reviewEnemy.id).actor.constructor.name!=='FallbackActor',{timeout:60000});
  await page.screenshot({path:new URL(`${stage}-${mobile?'touch':'desktop'}.png`,dir).pathname});
  if(id.includes('duflm')){
   const death=await page.evaluate(()=>{const b=reviewBattle;b.kill(reviewEnemy);for(let i=0;i<16;i++)b.step();return{alive:reviewEnemy.alive,burning:[...b.stageReeds.tiles.values()].filter(t=>t.mode===1).length,errors:b.errors}});
   assert.equal(death.alive,false);assert.ok(death.burning>=1);assert.deepEqual(death.errors,[]);state.death=death;
  }
  assert.deepEqual(errors,[]);results.push({mobile,scope:'Original stage and lazy models; diagnostic deployment/forced attacks, not a playable clear',...state});await page.close();
 }
 await writeFile(new URL('results.json',dir),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
}finally{await browser.close()}
