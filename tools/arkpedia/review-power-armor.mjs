// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3185';
const args=['--no-sandbox','--enable-unsafe-swiftshader'];
if(process.env.ARKPEDIA_REVIEW_CA_PINS)args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const out=new URL('../../.cache/arkpedia/power-armor-device-stage-review/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.ARKPEDIA_REVIEW_CHROME??'/usr/bin/chromium',headless:true,args});
const results=[];
try{
  for(const [stageId,code,trap,active,count] of [
    ['dv-4','DV-4','trap_075_bgarmn','enemy_1255_lybgpa',3],
    ['dv-6','DV-6','trap_077_rmtarmn','enemy_1256_lyacpa',4],
    ['dv-ex-2','DV-EX-2','trap_076_bgarms','enemy_1255_lybgpa_2',6],
    ['dv-ex-3','DV-EX-3','trap_078_rmtarms','enemy_1256_lyacpa_2',4],
  ])for(const mobile of [false,true]){
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')console.error('Browser:',m.text())});
    page.on('response',r=>{if(r.status()>=400)console.error('HTTP',r.status(),r.url())});
    await page.setViewport({width:mobile?1000:1440,height:mobile?600:900,isMobile:mobile,hasTouch:mobile});
    await page.goto(`${origin}/arkpedia/?stage=${stageId}`,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('#start:not(:disabled)',{timeout:60000});
    await page.evaluate(async()=>{
      const {StandardBattle}=await import('/sim/arkpedia.js'),original=StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport=function(...args){window.reviewBattle=this;return original.apply(this,args)};
      const {StageRenderer}=await import('/arkpedia/renderer.js'),preload=StageRenderer.prototype.preload;
      StageRenderer.prototype.preload=function(...args){window.reviewRenderer=this;return preload.apply(this,args)};
      Element.prototype.requestFullscreen=async()=>{};
    });
    await page.click('#start');await page.waitForFunction(count=>window.reviewBattle?.stagePowerArmor?.entries.length===count,{},count);
    const initial=await page.evaluate(()=>({stage:reviewBattle.stage.id,time:reviewBattle.time,devices:reviewBattle.stagePowerArmor.entries.length}));
    assert.deepEqual(initial,{stage:code,time:0,devices:count});
    try{await page.waitForFunction(({trap,active})=>window.reviewRenderer?.preloaded.has(`enemy/${active}/default/default`)&&window.reviewRenderer?.preloaded.has(`device/${trap}/default/default`),{timeout:60000,polling:100},{trap,active});}
    catch(error){console.error(await page.evaluate(()=>({renderer:!!window.reviewRenderer,models:Object.keys(window.reviewRenderer?.data.sd.models??{}).filter(k=>k.startsWith('enemy/')),loaded:[...window.reviewRenderer?.preloaded.keys()??[]]})));throw error;}
    const charging=await page.evaluate(()=>{
      const b=reviewBattle,d=b.stagePowerArmor.entries[0];b.life=1e6;d.unit.hp=d.unit.s.maxHp*.4;
      b.spawnEnemy(Object.keys(reviewRenderer.data.enemies).find(k=>/^enemy_1251_lysyta(?:_2)?$/.test(k)),{pos:[d.unit.y,d.unit.x]});b.step();
      return{sp:d.unit.skill.sp,hpRatio:d.unit.hpRatio,alive:d.unit.alive,errors:b.errors};
    });
    assert.equal(charging.sp,50);assert.equal(charging.hpRatio,.4);assert.deepEqual(charging.errors,[]);
    const rendered=await page.evaluate(async()=>{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const d=reviewBattle.stagePowerArmor.entries[0],view=reviewRenderer.views.get(d.unit.id);
      return{key:view?.key,actor:view?.actor.constructor.name,clip:view?.actor.spine.state?.getCurrent(0)?.animation.name};
    });
    assert.equal(rendered.key,`device/${trap}/default/default`);assert.equal(rendered.actor,'BattleActor');assert.equal(rendered.clip,'Default');
    await page.screenshot({path:new URL(`${stageId}-${mobile?'touch':'desktop'}-charging.png`,out).pathname});
    const casting=await page.evaluate(async()=>{
      const b=reviewBattle,d=b.stagePowerArmor.entries[0];
      b.spawnEnemy(Object.keys(reviewRenderer.data.enemies).find(k=>/^enemy_1251_lysyta(?:_2)?$/.test(k)),{pos:[d.unit.y,d.unit.x]});b.step();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return {active:d.unit.skill.active,clip:reviewRenderer.views.get(d.unit.id)?.actor.spine.state?.getCurrent(0)?.animation.name};
    });
    assert.equal(casting.active,true);assert.equal(casting.clip,'Start');
    await page.screenshot({path:new URL(`${stageId}-${mobile?'touch':'desktop'}-activating.png`,out).pathname});
    const activated=await page.evaluate(async active=>{
      const b=reviewBattle,d=b.stagePowerArmor.entries[0];
      for(let i=0;i<61;i++)b.step();
      const child=b.enemies.find(e=>e.defId===active);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const view=reviewRenderer.views.get(child?.id);
      return{deviceAlive:d.unit.alive,child:child?.defId,hpRatio:child?.hpRatio,counted:child?.counted,holdsBattle:child?.profile.holdsBattle,
        model:view?.key,actor:view?.actor.constructor.name,activated:b.stageOutcomes?.counters.actived_bell,errors:b.errors};
    },active);
    assert.equal(activated.deviceAlive,false);assert.equal(activated.child,active);assert.equal(activated.hpRatio,.4);
    assert.equal(activated.counted,false);assert.equal(activated.holdsBattle,true);assert.equal(activated.activated,1);assert.deepEqual(activated.errors,[]);
    assert.equal(activated.model,`enemy/${active}/default/default`);assert.equal(activated.actor,'BattleActor');
    await page.screenshot({path:new URL(`${stageId}-${mobile?'touch':'desktop'}-activated.png`,out).pathname});
    await page.evaluate(()=>reviewBattle._finish('timeout'));await page.waitForSelector('#again');await page.click('#again');
    await page.waitForFunction(()=>reviewBattle.time===0&&reviewBattle.stagePowerArmor.entries.every(d=>!d.activated&&d.unit.skill.sp===0));
    assert.deepEqual(errors,[]);results.push({stageId,mobile,scope:'Original stage loading with two injected source drivers and diagnostic device HP; not a stage clear',initial,charging,rendered,casting,activated});
    await page.close();
  }
  await writeFile(new URL('results.json',out),JSON.stringify(results,null,2)+'\n');console.log('Verified all four Power Armor device models, lifecycle and restart on desktop and touch');
}finally{await browser.close()}
