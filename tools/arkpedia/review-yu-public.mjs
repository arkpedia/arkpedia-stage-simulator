// SPDX-License-Identifier: GPL-3.0-or-later
// Actual public roster, drag/drop/swipe, natural SP, cast and retreat controls.
// Pinned enemies and controlled crossing/interception events are explicitly controlled QA fixtures.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and run the port-3182 preview.');
const dir = '.cache/arkpedia/yu-source/public-browser/', origin = 'http://127.0.0.1:3182';
const ID = 'char_2026_yu', buddies = ['char_500_noirc', 'char_196_sunbr', 'char_502_nblade'];
await mkdir(dir, { recursive: true });
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.ok(data.operators[ID]); data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
globalThis.publicYuReview={
 get battle(){return battle;},get renderer(){return renderer;},hits:[],teleports:[],intercepts:[],
 get selection(){return {selected,pending,dragging:dragging&&{over:dragging.over,moved:dragging.moved}};},
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 until(kind){paused=true;const end=battle.time+80,u=battle.bench['${ID}'].unit;
  while(battle.time<end && !(kind==='ready'?u.skill.ready:kind==='attack'?this.hits.some(h=>h.tags.includes('yu:s'+(u.mem.yuController.record.index+1)+':attack')):this[kind].length))battle.step();
  this.render();
 },
 setup(){battle.autoFinish=false;paused=true;
  battle.on('damaged',c=>{if(c.source?.defId==='${ID}')this.hits.push({target:c.target.id,amount:c.amount,tags:c.dmg.tags});});
  battle.on('yuTeleport',c=>this.teleports.push({id:c.enemy.id,from:c.from,to:c.to}));
  battle.on('yuIntercept',c=>this.intercepts.push(c.point));this.render();
 },
 target(){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[3,4]}),u=battle.bench['${ID}'].unit;
  Object.assign(e.base,{maxHp:1e7,atk:350,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e7;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:u.mem.yuController.record.index!==0}});
  battle._buildEnemyIndex();this.targetUnit=e;this.advance(battle.dt);
 },
 wall(){const u=battle.bench['${ID}'].unit,up=u.dir==='UP',e=battle.spawnEnemy('enemy_1007_slime',{pos:up?[4,5]:[3,6]});
  Object.assign(e.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e7;
  if(up)e.motion='FLY';battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true}});
  battle.dealDamage(battle.bench['char_196_sunbr'].unit,e,{amount:1,type:'arts'});
  battle.rng=Object.assign(()=>0,battle.rng);
  battle.addProjectile({source:e,from:up?{x:6,y:2}:{x:3,y:2},to:up?{x:6,y:5}:{x:6,y:2},speed:1000});this.advance(battle.dt);
 }
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
  await page.select('#skillId',`skchr_yu_${skill}`);await page.click('#start');
  await page.waitForFunction(()=>window.publicYuReview?.battle&&document.querySelector('#deployment button'),{timeout:60000});
  await page.evaluate(()=>{
   publicYuReview.setup();const e=document.createElement('div');e.textContent='CONTROLLED QA · natural SP / pinned enemies / crossing & interception / 99 DP';
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
    const r=publicYuReview.renderer,p=r.projection.project(col,row,r.heightAt(row,col)),box=document.querySelector('#battle-board').getBoundingClientRect();
    return{x:p.x+box.x,y:p.y+box.y};
   },row,col);
   await down(box.x+box.width/2,box.y+box.height/2);await move(p.x,p.y);
   const selection=await page.evaluate(()=>publicYuReview.selection);
   assert.deepEqual(selection.dragging&&{row:selection.dragging.over?.row,col:selection.dragging.over?.col},{row,col});
   assert.equal(await page.evaluate(id=>!!publicYuReview.battle.bench[id].unit?.alive,id),false);await up();
   await page.waitForSelector('.facing-picker:not([hidden])');
   assert.equal(await page.evaluate(id=>!!publicYuReview.battle.bench[id].unit?.alive,id),false);
   if(id===ID)await page.screenshot({path:dir+label+'-facing.png'});
   const h=await(await page.$('.facing-handle')).boundingBox(),x=h.x+h.width/2,y=h.y+h.height/2;
   await down(x,y);await move(mobile?x:x+65,mobile?y-65:y);
   assert.equal(await page.evaluate(id=>!!publicYuReview.battle.bench[id].unit?.alive,id),false);await up();
   await page.waitForFunction(id=>publicYuReview.battle.bench[id].unit?.alive,{},id);
  }
  await deploy(ID,3,4);await page.evaluate(()=>publicYuReview.advance(1.1));
  await deploy(buddies[0],3,5);await deploy(buddies[1],3,3);await deploy(buddies[2],2,3);
  await page.evaluate(()=>publicYuReview.target());await press(`#deployment [data-id="${ID}"]`);
  await page.evaluate(()=>publicYuReview.until('ready'));
  assert.equal(await page.$eval('#skill',e=>e.disabled),false);
  await page.screenshot({path:dir+label+'-ready.png'});await press('#skill');
  await page.evaluate(()=>publicYuReview.until('attack'));
  const state=await page.evaluate(id=>{
   const q=publicYuReview,u=q.battle.bench[id].unit,c=u.mem.yuController;
   return{active:u.skill.active,hits:q.hits,teleports:q.teleports,wall:c.skills.wallReady,
    clip:u.mem.regularFormVisual.clip,actorClip:q.renderer.views.get(u.id)?.actor.current,
    facing:u.dir,errors:q.battle.errors};
  },ID);
  assert.deepEqual(state.errors,[]);assert.ok(state.active);
  const clip=['Skill_1','Skill_2','Skill_3_Loop'][skill-1];assert.equal(state.clip,clip);assert.equal(state.actorClip,clip);
  assert.equal(state.facing,mobile?'UP':'RIGHT');
  if(skill===2){assert.equal(state.teleports.length,1);const p=state.teleports[0].to;
   for(const offset of [p.x-4,p.y-3])assert.ok(Math.abs(offset)>=.3&&Math.abs(offset)<=.450001);
  }
  if(skill===3){
   assert.ok(state.wall);await page.evaluate(()=>publicYuReview.wall());
   const extra=await page.evaluate(()=>({hits:publicYuReview.hits,intercepts:publicYuReview.intercepts}));
   assert.ok(extra.hits.some(h=>h.tags.includes('yu:s3:wall')));assert.equal(extra.intercepts.length,1);
  }
  await page.screenshot({path:dir+label+'-attacking.png'});
  await page.evaluate(()=>publicYuReview.advance(46));
  assert.equal(await page.evaluate(()=>publicYuReview.battle.bench['char_2026_yu'].unit.skill.active),false);
  await press('#retreat');
  const cleanup=await page.evaluate(()=>{
   const q=publicYuReview,c=q.battle.bench['char_2026_yu'].unit.mem.yuController;
   return{stopped:c.stopped,blocked:c.blocked.size,recovery:c.recovery.size,pending:c.skills.pending.size,
    wall:c.skills.wall.size,interceptors:q.battle.projectiles.interceptors.size,
    handles:c.handles.length+c.skills.handles.length,errors:q.battle.errors};
  });
  assert.deepEqual(cleanup,{stopped:true,blocked:0,recovery:0,pending:0,wall:0,interceptors:0,handles:0,errors:[]});
  reports.push({label,state,cleanup});await page.close();currentPage=null;
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 await writeFile(dir+'report.json',JSON.stringify({scope:'Controlled fixtures; real public mouse/touch deployment and natural SP, not an unmodified stage victory',reports,errors,failures},null,2)+'\n');
 console.log(JSON.stringify({checks:reports.length,errors,failures}));
} catch(error){
 if(currentPage){await currentPage.screenshot({path:dir+'failure.png'}).catch(()=>{});await writeFile(dir+'failure.json',JSON.stringify({error:error.stack,reports,errors,failures},null,2)+'\n');}
 throw error;
}finally{await browser.close();}
