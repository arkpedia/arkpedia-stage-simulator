// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI checks on the original stage: 99 DP, empty waves and pinned targets.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start port 3182.');
const origin = 'http://127.0.0.1:3182', out = '.cache/arkpedia/necrass-source/public-browser/';
const ID = 'char_450_necras', TOKEN = 'token_10043_necras_skeltn';
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.ok(data.operators[ID]); assert.equal(data.sd.commit, '8e7385b643bfaa4b50e85c26c4b6bb31158d8004');
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99; data.stage.battle.dp_per_second = 0;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
globalThis.necrassReview={get battle(){return battle;},get renderer(){return renderer;},hits:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',x=>{if(x.source?.defId==='${ID}'||x.source?.defId==='${TOKEN}')this.hits.push({tags:x.dmg.tags,loss:x.hpLoss});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / 99 DP / empty waves / pinned targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 enemy(hp=1e7,pos=[3,7]){const t=battle.spawnEnemy('enemy_1007_slime',{pos});Object.assign(t.base,{maxHp:hp,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=hp;
  battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true,unblockable:true}});battle._buildEnemyIndex();return t;},
 seed(){for(let n=0;n<4;n++)this.enemy(1);this.advance(10);if(this.deck.all().length<1)throw Error('Factory did not create a servant');this.enemy();this.render();},
 get owner(){return battle.bench['${ID}'].unit;},get deck(){return this.owner.mem.necrassController.servants;},
 ready(){const end=battle.time+80;while(!skillHud(this.owner.skill).canActivate&&battle.time<end)this.advance(battle.dt);if(!skillHud(this.owner.skill).canActivate)throw Error('Skill did not become ready');this.render();},
 snapshot(){const u=this.owner,c=u.mem.necrassController;return{time:battle.time,dp:battle.dp,slots:battle.deployedSlots(),active:u.skill.active,activations:u.skill.activations,
  ownerModel:renderer.views.get(u.id)?.key,servants:this.deck.all().map(t=>({id:t.id,model:renderer.views.get(t.id)?.key,clip:t.mem.regularFormVisual?.clip,special:!!this.deck.units.get(t).special,upgrades:this.deck.units.get(t).upgrades??0,sp:t.skill.spTotal,active:t.skill.active,slots:t.deploymentSlotCost})),
  stopped:c.stopped,errors:battle.errors,hits:this.hits};}
};`;
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const reports = [], errors = [], failedResources = [];
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
    await page.select('#skillId',`skchr_necras_${skill}`);await page.click('#start');
    await page.waitForFunction(()=>window.necrassReview?.battle&&document.querySelector('#deployment button'),{timeout:60000});
    await page.evaluate(()=>necrassReview.setup());
    const card=await(await page.$(`#deployment [data-id="${ID}"]`)).boundingBox();
    const tile=await page.evaluate(()=>{const r=necrassReview.renderer,p=r.projection.project(6,4,r.heightAt(4,6)),box=document.querySelector('#battle-board').getBoundingClientRect();return{x:p.x+box.x,y:p.y+box.y};});
    const x=card.x+card.width/2,y=card.y+card.height/2;
    if(mobile){await page.touchscreen.touchStart(x,y);await page.touchscreen.touchMove(tile.x,tile.y);await page.touchscreen.touchEnd();}
    else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(tile.x,tile.y,{steps:12});await page.mouse.up();}
    await page.waitForSelector('.facing-picker:not([hidden])');
    assert.equal(await page.evaluate(()=>!!necrassReview.owner?.alive),false);
    const h=await(await page.$('.facing-handle')).boundingBox(),cx=h.x+h.width/2,cy=h.y+h.height/2;
    if(mobile){await page.touchscreen.touchStart(cx,cy);await page.touchscreen.touchMove(cx,cy+65);}
    else{await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx,cy+65,{steps:8});}
    assert.equal(await page.evaluate(()=>!!necrassReview.owner?.alive),false);
    if(mobile)await page.touchscreen.touchEnd();else await page.mouse.up();
    await page.waitForFunction(()=>necrassReview.owner?.alive);
    await page.evaluate(()=>{necrassReview.advance(1.1);necrassReview.seed();necrassReview.ready();});
    await page.click(`#deployment [data-id="${ID}"]`);
    assert.equal(await page.$eval('#skill',e=>e.disabled),false);
    const before=await page.evaluate(()=>necrassReview.snapshot());
    assert.equal(before.slots,1);assert.ok(before.servants.every(t=>t.slots===0&&t.model?.includes(TOKEN)));
    await page.screenshot({path:out+label+'-ready.png'});
    await page.click('#skill');
    assert.equal(await page.evaluate(()=>necrassReview.owner.skill.active),true);
    await page.evaluate(()=>necrassReview.advance(.85));
    await page.screenshot({path:out+label+'-active.png'});
    await page.evaluate(()=>necrassReview.advance(4));
    if(skill===3)await page.evaluate(()=>{
      const q=necrassReview,d=q.deck.dragon;q.enemy(1e7,[d.tileR,d.tileC]);
      const end=q.battle.time+25;
      while(!q.hits.some(h=>h.tags.includes('necrass:dragon-flame'))&&q.battle.time<end)q.advance(q.battle.dt);
    });
    const after=await page.evaluate(()=>necrassReview.snapshot());
    assert.ok(after.hits.some(h=>h.tags.includes(skill===1?'necrass:s1-passive':skill===2?'necrass:s2-link':'necrass:s3-volley')));
    assert.equal(after.activations,1);assert.equal(after.dp,before.dp);assert.equal(after.slots,1);
    if(skill===3){const dragon=after.servants.find(t=>t.special);assert.ok(dragon&&dragon.upgrades>0);assert.ok(after.hits.some(h=>h.tags.includes('necrass:dragon-flame')));}
    await page.screenshot({path:out+label+'-servants.png'});
    await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');
    const retired=await page.evaluate(()=>{necrassReview.advance(2);return necrassReview.snapshot();});
    assert.equal(retired.stopped,true);assert.deepEqual(retired.servants,[]);assert.deepEqual(retired.errors,[]);
    reports.push({label,before,after,retired});console.log(label+': public drag/swipe, natural charge, skill/factory and retirement passed');
    await page.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failedResources,[]);
  await writeFile(out+'report.json',JSON.stringify({controlled:true,originalWaves:false,reports,errors,failedResources},null,2)+'\n');
  console.log(JSON.stringify({cases:reports.length,captures:reports.length*3,errors,failedResources}));
} finally {await browser.close();}
