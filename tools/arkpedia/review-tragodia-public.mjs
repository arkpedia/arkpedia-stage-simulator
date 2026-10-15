// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI checks on the original stage: 99 DP, empty waves and pinned targets.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start port 3182.');
const origin = 'http://127.0.0.1:3182', out = '.cache/arkpedia/tragodia-source/public-browser/';
const ID = 'char_1042_phatm2', TOKEN = 'token_10054_phatm2_encdool';
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.ok(data.operators[ID]); assert.equal(data.sd.commit, 'b419b4546a6a59fdf01e7089499f986a454c1a89');
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99; data.stage.battle.dp_per_second = 0;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
globalThis.tragodiaReview={get battle(){return battle;},get renderer(){return renderer;},hits:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 async settle(){await renderer.nativeEffects.ready();this.render();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',x=>{if(x.source?.defId==='${ID}')this.hits.push({tags:x.dmg.tags,loss:x.hpLoss});});
  const label=document.createElement('div');label.textContent='CONTROLLED PUBLIC UI CHECK · original terrain / 99 DP / empty waves / pinned target';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 enemy(){const t=battle.spawnEnemy('enemy_1007_slime',{pos:[3,5]});Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:1});t.markDirty();void t.s;t.hp=1e9;
  battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();this.target=t;return t;},
 releaseTarget(){battle.removeBuff(this.target,'qa:pin');battle.addBuff(this.target,{key:'qa:disarm',flags:{disarm:true}});},
 get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.tragodiaController;},
 ready(){const end=battle.time+100,skill=this.owner.skill.id;
  const done=()=>skill==='skchr_phatm2_1'?this.hits.some(h=>h.tags.includes('tragodia:s1')):skill==='skchr_phatm2_2'?this.owner.skill.active:skillHud(this.owner.skill).canActivate;
  while(!done()&&battle.time<end)battle.step();if(!done())throw Error('Selected skill did not charge naturally');this.render();},
 snapshot(){const c=this.controller;return{time:battle.time,dp:battle.dp,slots:battle.deployedSlots(),active:this.owner.skill.active,activations:this.owner.skill.activations,
  ownerModel:renderer.views.get(this.owner.id)?.key,stopped:c.stopped,hits:this.hits,errors:battle.errors,
  lures:battle.allyUnits.filter(t=>t.defId==='${TOKEN}'&&t.alive).map(t=>({id:t.id,model:renderer.views.get(t.id)?.key,clip:t.mem.regularFormVisual?.clip,death:t.mem.regularDeathVisual,slots:t.deploymentSlotCost})),
  cages:[...(c.cages?.tokens.keys()??[])].map(t=>({id:t.id,hp:t.hp,actor:renderer.views.get(t.id)?.actor.constructor.name,slots:t.deploymentSlotCost})),
  effectCount:renderer.nativeEffects.instanceCount,glError:renderer.three.getContext().getError()};}
};`;
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const reports = [], errors = [], failedResources = [];let captures=0;
try {
  for (const skill of [1,2,3]) for (const mobile of [false,true]) {
    const label = `s${skill}-${mobile?'landscape-phone':'desktop'}`, page = await browser.newPage();
    page.on('pageerror',e=>errors.push({label,message:e.message}));
    page.on('console',m=>{if(m.type()==='error')errors.push({label,message:m.text()});});
    page.on('response',r=>{if(r.status()>=400)failedResources.push({label,url:r.url(),status:r.status()});});
    await page.setViewport(mobile?{width:844,height:390,isMobile:true,hasTouch:true}:{width:1280,height:800});
    await page.setRequestInterception(true);
    page.on('request',r=>{
      const path=new URL(r.url()).pathname;
      if(path==='/favicon.ico')return r.respond({status:204});
      if(r.url().startsWith(origin)&&path==='/arkpedia/app.js')return r.respond({status:200,contentType:'text/javascript',body:app+hook});
      if(r.url().startsWith(origin)&&path==='/data/arkpedia-mvp.json')return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
      return r.continue();
    });
    await page.goto(origin+'/arkpedia/',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.roster-item.chosen');
    for(const id of await page.$$eval('.roster-item.chosen',es=>es.map(e=>e.dataset.id))){await page.click(`.roster-item[data-id="${id}"]`);await page.click('#toggle');}
    await page.$eval('#roster-search',(e,name)=>{e.value=name;e.dispatchEvent(new Event('input',{bubbles:true}));},data.operators[ID].name);
    await page.click(`.roster-item[data-id="${ID}"]`);await page.click('#toggle');
    assert.equal(await page.$eval('#skillId',e=>e.options.length),3);
    await page.select('#skillId',`skchr_phatm2_${skill}`);await page.click('#start');
    await page.waitForFunction(()=>window.tragodiaReview?.battle&&document.querySelector('#deployment button'),{timeout:60000});
    await page.evaluate(()=>tragodiaReview.setup());
    const card=await(await page.$(`#deployment [data-id="${ID}"]`)).boundingBox();
    const tile=await page.evaluate(()=>{const r=tragodiaReview.renderer,p=r.projection.project(6,4,r.heightAt(4,6)),box=document.querySelector('#battle-board').getBoundingClientRect();return{x:p.x+box.x,y:p.y+box.y};});
    const x=card.x+card.width/2,y=card.y+card.height/2;
    if(mobile){await page.touchscreen.touchStart(x,y);await page.touchscreen.touchMove(tile.x,tile.y);await page.touchscreen.touchEnd();}
    else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(tile.x,tile.y,{steps:12});await page.mouse.up();}
    await page.waitForSelector('.facing-picker:not([hidden])');
    assert.equal(await page.evaluate(()=>!!tragodiaReview.owner?.alive),false);
    const h=await(await page.$('.facing-handle')).boundingBox(),cx=h.x+h.width/2,cy=h.y+h.height/2;
    if(mobile){await page.touchscreen.touchStart(cx,cy);await page.touchscreen.touchMove(cx,cy-65);}
    else{await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx,cy-65,{steps:8});}
    assert.equal(await page.evaluate(()=>!!tragodiaReview.owner?.alive),false);
    if(mobile)await page.touchscreen.touchEnd();else await page.mouse.up();
    await page.waitForFunction(()=>tragodiaReview.owner?.alive);
    await page.evaluate(()=>{tragodiaReview.advance(1.1);tragodiaReview.enemy();tragodiaReview.ready();});
    await page.click(`#deployment [data-id="${ID}"]`);
    const before=await page.evaluate(()=>tragodiaReview.snapshot());
    assert.equal(before.slots,1);assert.equal(before.glError,0);
    await page.screenshot({path:out+label+'-ready.png'});captures++;
    if(skill===3){
      assert.equal(await page.$eval('#skill',e=>e.disabled),false);await page.click('#skill');
      await page.evaluate(async()=>{tragodiaReview.advance(1);await tragodiaReview.settle();});
      const end=await page.evaluate(()=>tragodiaReview.battle.time+40);
      while(await page.evaluate(()=>tragodiaReview.snapshot().cages.length)===0&&await page.evaluate(()=>tragodiaReview.battle.time)<end)
        await page.evaluate(async()=>{tragodiaReview.advance(.5);await tragodiaReview.settle();});
      const active=await page.evaluate(()=>tragodiaReview.snapshot());assert.ok(active.cages.length);assert.equal(active.effectCount,active.cages.length);
      assert.ok(active.cages.every(t=>t.actor==='EffectOnlyActor'&&t.hp===3&&t.slots===0));
    }else if(skill===2){
      const summon=await(await page.$(`#deployment [data-id="summon:${ID}"]`)).boundingBox();
      const tile=await page.evaluate(()=>{const r=tragodiaReview.renderer,p=r.projection.project(7,3,r.heightAt(3,7)),b=document.querySelector('#battle-board').getBoundingClientRect();return{x:p.x+b.x,y:p.y+b.y};});
      const sx=summon.x+summon.width/2,sy=summon.y+summon.height/2;
      if(mobile){await page.touchscreen.touchStart(sx,sy);await page.touchscreen.touchMove(tile.x,tile.y);await page.touchscreen.touchEnd();}
      else{await page.mouse.move(sx,sy);await page.mouse.down();await page.mouse.move(tile.x,tile.y,{steps:12});await page.mouse.up();}
      await page.waitForFunction(()=>tragodiaReview.snapshot().lures.length===1);
      const placed=await page.evaluate(()=>tragodiaReview.snapshot());assert.equal(placed.dp,before.dp-5);assert.equal(placed.slots,1);assert.equal(placed.lures[0].clip,'Start');
      await page.screenshot({path:out+label+'-lure-start.png'});captures++;
      await page.evaluate(()=>tragodiaReview.advance(1.1));
      const resting=await page.evaluate(()=>tragodiaReview.snapshot());assert.equal(resting.lures[0].clip,'Loop');assert.ok(resting.lures[0].model.includes(TOKEN));
      assert.equal(resting.lures[0].death,undefined);
      await page.screenshot({path:out+label+'-lure-loop.png'});captures++;
      await page.evaluate(()=>{tragodiaReview.releaseTarget();const end=tragodiaReview.battle.time+15;
        while(!tragodiaReview.hits.some(h=>h.tags.includes('tragodia:s2-lure-dot'))&&tragodiaReview.battle.time<end)tragodiaReview.advance(tragodiaReview.battle.dt);});
      assert.equal(await page.evaluate(()=>tragodiaReview.hits.some(h=>h.tags.includes('tragodia:s2-lure-dot'))),true);
    }
    await page.screenshot({path:out+label+'-active.png'});captures++;
    const after=await page.evaluate(()=>tragodiaReview.snapshot());assert.equal(after.glError,0);assert.deepEqual(after.errors,[]);
    assert.ok(after.hits.some(h=>h.tags.includes(skill===1?'tragodia:s1':skill===2?'tragodia:s2-lure-dot':'tragodia:s3')));
    assert.equal(after.slots,1);
    await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');
    const retired=await page.evaluate(async()=>{tragodiaReview.advance(2);await tragodiaReview.settle();return tragodiaReview.snapshot();});
    assert.equal(retired.stopped,true);assert.deepEqual(retired.lures,[]);assert.deepEqual(retired.cages,[]);assert.equal(retired.effectCount,0);assert.deepEqual(retired.errors,[]);
    reports.push({label,before,after,retired});await page.screenshot({path:out+label+'-retired.png'});captures++;
    console.log(label+': public drag/swipe, natural SP, source skill/summon and retirement passed');
    await page.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failedResources,[]);
  await writeFile(out+'report.json',JSON.stringify({controlled:true,originalWaves:false,reports,errors,failedResources},null,2)+'\n');
  console.log(JSON.stringify({cases:reports.length,captures,errors,failedResources}));
} finally {await browser.close();}
