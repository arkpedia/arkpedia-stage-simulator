// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3185';
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname))throw Error('Use a loopback preview');
const args=['--no-sandbox','--enable-unsafe-swiftshader'];
if(process.env.ARKPEDIA_REVIEW_CA_PINS)args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const out=new URL('../../.cache/arkpedia/dorothy-enemy-stage-review/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.ARKPEDIA_REVIEW_CHROME??'/usr/bin/chromium',headless:true,args});
const results=[];
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage(),errors=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/models/')&&r.status()>=400)failures.push({url:r.url(),status:r.status()})});
  await page.setViewport({width:mobile?1000:1440,height:mobile?600:900,isMobile:mobile,hasTouch:mobile});
  await page.goto(`${origin}/arkpedia/?stage=dv-5`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#start:not(:disabled)',{timeout:60000});
  await page.click('.roster-item[data-id="char_123_fang"]');await page.waitForSelector('#toggle');
  if(await page.$eval('#toggle',e=>e.textContent.includes('Add')))await page.click('#toggle');
  await page.waitForSelector('#start:not(:disabled)',{timeout:60000});
  await page.evaluate(async()=>{
   const {StandardBattle}=await import('/sim/arkpedia.js'),original=StandardBattle.prototype.setViewport;
   StandardBattle.prototype.setViewport=function(...args){window.reviewBattle=this;return original.apply(this,args)};
   const {StageRenderer}=await import('/arkpedia/renderer.js'),preload=StageRenderer.prototype.preload;
   StageRenderer.prototype.preload=function(...args){window.reviewRenderer=this;return preload.apply(this,args)};
   Element.prototype.requestFullscreen=async()=>{};
  });
  await page.click('#start');await page.waitForFunction(()=>window.reviewBattle?.stage.id==='DV-5');
  await page.waitForFunction(()=>window.reviewRenderer?.preloaded.has('enemy/enemy_1257_lydrty/default/default'),{timeout:60000,polling:100});
  const placed=await page.evaluate(async()=>{
   const b=reviewBattle;b.life=1e6;let trap;
   for(let i=0;i<Math.ceil(90/b.dt);i++){b.step();trap=b.projectiles.list.find(p=>p.data?.enemyTileTrigger?.armed);if(trap)break;}
   if(!trap)throw Error('No original-wave trap');window.reviewTrap=trap;
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const view=reviewRenderer.views.get(trap.source.id);
   return{time:b.time,tile:trap.data.enemyTileTrigger,source:trap.source.defId,model:view?.key,actor:view?.actor.constructor.name,errors:b.errors};
  });
  assert.ok(placed.time>=55);assert.equal(placed.source,'enemy_1257_lydrty');assert.equal(placed.model,'enemy/enemy_1257_lydrty/default/default');assert.equal(placed.actor,'BattleActor');assert.deepEqual(placed.errors,[]);
  await page.screenshot({path:new URL(`${mobile?'touch':'desktop'}-trap.png`,out).pathname});
  const triggered=await page.evaluate(async()=>{
   const b=reviewBattle,trap=reviewTrap,{row,col}=trap.data.enemyTileTrigger;
   const unit=b.deployOperator('char_123_fang',row,col,'RIGHT'),hits=[];
   b.on('damaged',c=>{if(c.target===unit&&c.dmg.tags.includes('enemyTileTrap'))hits.push(c.hpLoss)});
   for(let i=0;i<Math.ceil(.3/b.dt);i++)b.step();
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   return{hits,stunned:unit.s.flags.stun,stacks:trap.source.mem.dorothyTrapStacks,trapAlive:b.projectiles.list.includes(trap),errors:b.errors};
  });
  assert.deepEqual(triggered.hits,[975]);assert.equal(triggered.stunned,true);assert.equal(triggered.stacks,1);assert.equal(triggered.trapAlive,false);assert.deepEqual(triggered.errors,[]);
  await page.screenshot({path:new URL(`${mobile?'touch':'desktop'}-triggered.png`,out).pathname});
  await page.evaluate(()=>reviewBattle._finish('timeout'));await page.waitForSelector('#again');await page.click('#again');
  await page.waitForFunction(()=>reviewBattle.time===0&&!reviewBattle.projectiles.list.some(p=>p.data?.enemyTileTrigger));
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);results.push({mobile,placed,triggered,errors,failures});await page.close();
 }
 await writeFile(new URL('results.json',out),JSON.stringify({scope:'DV-5 original-wave Dorothy trap and ordinary Fang deployment, diagnostic stage life only; original body and temporary trap markers, not a stage clear or native frame parity',results},null,2)+'\n');
 console.log('Verified original-wave Dorothy body, tile trap, damage, stun and restart on desktop/touch');
}finally{await browser.close()}
