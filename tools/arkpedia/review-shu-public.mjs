// SPDX-License-Identifier: GPL-3.0-or-later
// Actual public roster, drag/drop/swipe, natural SP, cast and retreat controls.
// Injured allies and pinned enemies are explicitly controlled QA fixtures.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and run the port-3182 preview.');
const dir = '.cache/arkpedia/shu-source/public-browser/', origin = 'http://127.0.0.1:3182';
const ID = 'char_2025_shu', buddies = ['char_500_noirc', 'char_196_sunbr'];
await mkdir(dir, { recursive: true });
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.ok(data.operators[ID]); data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
globalThis.publicShuReview={
 get battle(){return battle;},get renderer(){return renderer;},heals:[],hits:[],teleports:[],
 get selection(){return {selected,pending,dragging:dragging&&{over:dragging.over,moved:dragging.moved}};},
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 until(kind){paused=true;const end=battle.time+80;
  while(battle.time<end && !(kind==='ready'?battle.bench['${ID}'].unit.skill.ready:this[kind].length))battle.step();
  this.render();
 },
 setup(){battle.autoFinish=false;paused=true;
  battle.on('calculatedHeal',c=>{if(c.source.defId==='${ID}')this.heals.push({target:c.target.defId,amount:c.amount});});
  battle.on('damaged',c=>{if(c.source.defId==='${ID}')this.hits.push({target:c.target.id,amount:c.amount,tags:c.dmg.tags});});
  battle.on('shuTeleport',c=>this.teleports.push({id:c.enemy.id,from:c.from,to:c.to}));this.render();
 },
 injure(){for(const id of ${JSON.stringify(buddies)}){
  const a=battle.bench[id].unit; a.base.maxHp=1e7;a.markDirty();void a.s;a.hp=1e6;
  battle.addBuff(a,{key:'qa:regen',flags:{noHpRecovery:true}});
 }this.render();},
 target(){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[3,5]});
  Object.assign(e.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e7;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();this.targetUnit=e;this.advance(battle.dt);
 },
 teleport(){battle.displace(this.targetUnit,{x:1,y:0},2.2);this.render();}
};`;
const browser = await puppeteer.launch({ executablePath, headless: true,
 args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const reports = [], errors = [], failures = [];
let currentPage;
try {
 for (const mobile of [false,true]) for(const skill of [1,2,3]) {
  const label=`${mobile?'mobile':'desktop'}-s${skill}`, page=await browser.newPage();currentPage=page;
  page.on('pageerror',e=>errors.push({label,message:e.message}));
  page.on('console',m=>{if(m.type()==='error')errors.push({label,message:m.text()});});
  page.on('response',r=>{if(r.status()>=400)failures.push({label,url:r.url(),status:r.status()});});
  await page.setViewport(mobile?{width:844,height:390,isMobile:true,hasTouch:true}:{width:1280,height:800});
  await page.setRequestInterception(true);
  page.on('request',r=>{
   const path=new URL(r.url()).pathname;
   if(r.url().startsWith(origin)&&path==='/favicon.ico')return r.respond({status:204});
   if(r.url().startsWith(origin)&&path==='/arkpedia/app.js')return r.respond({status:200,contentType:'text/javascript',body:app+hook});
   if(r.url().startsWith(origin)&&path==='/data/arkpedia-mvp.json')return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
   r.continue();
  });
  await page.goto(origin+'/arkpedia/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('.roster-item.chosen');
  for(const id of await page.$$eval('.roster-item.chosen',es=>es.map(e=>e.dataset.id))){
   await page.click(`.roster-item[data-id="${id}"]`);await page.click('#toggle');
  }
  for(const id of [...buddies,ID]){
   await page.$eval('#roster-search',(e,name)=>{e.value=name;e.dispatchEvent(new Event('input',{bubbles:true}));},data.operators[id].name);
   await page.click(`.roster-item[data-id="${id}"]`);await page.click('#toggle');
  }
  assert.equal(await page.$eval('#skillId',e=>e.options.length),3);
  await page.select('#skillId',`skchr_shu_${skill}`);await page.click('#start');
  await page.waitForFunction(()=>window.publicShuReview?.battle&&document.querySelector('#deployment button'),{timeout:60000});
  await page.evaluate(()=>{
   publicShuReview.setup();const e=document.createElement('div');e.textContent='CONTROLLED QA · natural SP / injured allies / pinned enemy / 99 DP';
   e.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:12px sans-serif;pointer-events:none';
   document.querySelector('.workspace').append(e);
  });
  async function down(x,y){if(mobile)await page.touchscreen.touchStart(x,y);else{await page.mouse.move(x,y);await page.mouse.down();}}
  async function move(x,y){if(mobile)await page.touchscreen.touchMove(x,y);else await page.mouse.move(x,y,{steps:12});}
  async function up(){if(mobile)await page.touchscreen.touchEnd();else await page.mouse.up();}
  async function press(selector){
   if(!mobile)return page.click(selector);
   const e=await page.$(selector);assert.ok(e);await e.evaluate(e=>e.scrollIntoView({block:'nearest',inline:'nearest'}));
   const box=await e.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  }
  async function deploy(id,row,col){
   const e=await page.$(`#deployment [data-id="${id}"]`);await e.evaluate(e=>e.scrollIntoView({block:'nearest',inline:'nearest'}));
   const box=await e.boundingBox(),p=await page.evaluate((row,col)=>{
    const r=publicShuReview.renderer,p=r.projection.project(col,row,r.heightAt(row,col)),box=document.querySelector('#battle-board').getBoundingClientRect();
    return{x:p.x+box.x,y:p.y+box.y};
   },row,col);
   await down(box.x+box.width/2,box.y+box.height/2);await move(p.x,p.y);
   const selection=await page.evaluate(()=>publicShuReview.selection);
   assert.deepEqual(selection.dragging&&{row:selection.dragging.over?.row,col:selection.dragging.over?.col},{row,col});
   assert.equal(await page.evaluate(id=>!!publicShuReview.battle.bench[id].unit?.alive,id),false);await up();
   await page.waitForSelector('.facing-picker:not([hidden])');
   assert.equal(await page.evaluate(id=>!!publicShuReview.battle.bench[id].unit?.alive,id),false);
   if(id===ID)await page.screenshot({path:dir+label+'-facing.png'});
   const h=await(await page.$('.facing-handle')).boundingBox(),x=h.x+h.width/2,y=h.y+h.height/2;
   await down(x,y);await move(x+65,y);
   assert.equal(await page.evaluate(id=>!!publicShuReview.battle.bench[id].unit?.alive,id),false);await up();
   await page.waitForFunction(id=>publicShuReview.battle.bench[id].unit?.alive,{},id);
  }
  await deploy(ID,3,4);await page.evaluate(()=>publicShuReview.advance(1.1));
  await deploy(buddies[0],3,5);await deploy(buddies[1],3,3);
  await page.evaluate(()=>publicShuReview.injure());
  await press(`#deployment [data-id="${ID}"]`);
  if(skill===1)await page.evaluate(()=>publicShuReview.until('heals'));
  else{
   await page.evaluate(()=>publicShuReview.until('ready'));
   assert.equal(await page.$eval('#skill',e=>e.disabled),false);
   await page.screenshot({path:dir+label+'-ready.png'});await press('#skill');
   await page.evaluate(()=>publicShuReview.until('heals'));
  }
  const state=await page.evaluate(id=>{
   const q=publicShuReview,u=q.battle.bench[id].unit,c=u.mem.shuController;
   return{active:u.skill.active,heals:q.heals,tiles:c.tiles.size,clip:u.mem.regularFormVisual.clip,
    actorClip:q.renderer.views.get(u.id)?.actor.current,errors:q.battle.errors};
  },ID);
  assert.deepEqual(state.errors,[]);assert.ok(state.heals.length);assert.ok(state.tiles>0);
  assert.equal(state.clip,skill===1?'Attack_2':skill===2?'Skill_2_Attack':'Skill_3_Attack_2');
  assert.equal(state.actorClip,state.clip);assert.equal(state.active,skill>1);
  await page.screenshot({path:dir+label+'-healing.png'});
  if(skill===3){
   await page.evaluate(()=>{publicShuReview.target();publicShuReview.until('hits');});
   const attack=await page.evaluate(()=>({hits:publicShuReview.hits,clip:publicShuReview.renderer.views.get(publicShuReview.battle.bench['char_2025_shu'].unit.id)?.actor.current}));
   assert.ok(attack.hits.some(h=>h.tags.includes('shu:s3')));assert.equal(attack.clip,'Skill_3_Attack_1');
   await page.screenshot({path:dir+label+'-attacking.png'});await page.evaluate(()=>publicShuReview.teleport());
   assert.equal(await page.evaluate(()=>publicShuReview.teleports.length),1);
   await page.screenshot({path:dir+label+'-teleport.png'});
  }
  if(skill>1){await page.evaluate(()=>publicShuReview.advance(35));assert.equal(await page.evaluate(()=>publicShuReview.battle.bench['char_2025_shu'].unit.skill.active),false);}
  await press('#retreat');
  const cleanup=await page.evaluate(()=>{
   const q=publicShuReview,c=q.battle.bench['char_2025_shu'].unit.mem.shuController;
   return{stopped:c.stopped,tiles:c.tiles.size,marks:c.skills.marks.size,aura:c.skills.aura.size,handles:c.handles.length+c.skills.handles.length,errors:q.battle.errors};
  });
  assert.deepEqual(cleanup,{stopped:true,tiles:0,marks:0,aura:0,handles:0,errors:[]});
  reports.push({label,state,cleanup});await page.close();currentPage=null;
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 await writeFile(dir+'report.json',JSON.stringify({scope:'Controlled fixtures; real public mouse/touch deployment and natural SP, not an unmodified stage victory',reports,errors,failures},null,2)+'\n');
 console.log(JSON.stringify({checks:reports.length,errors,failures}));
} catch(error){
 if(currentPage){await currentPage.screenshot({path:dir+'failure.png'}).catch(()=>{});await writeFile(dir+'failure.json',JSON.stringify({error:error.stack,reports,errors,failures},null,2)+'\n');}
 throw error;
}finally{await browser.close();}
