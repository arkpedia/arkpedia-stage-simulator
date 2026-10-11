// SPDX-License-Identifier: GPL-3.0-or-later
// Real public commands; diagnostic starting DP/target/fatal hit, never forced SP.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const executablePath=process.env.ARKPEDIA_REVIEW_CHROME;
if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME and run the port-3182 preview.');
const dir='.cache/arkpedia/blaze-igniting-source/public-browser/',ID='char_1040_blaze2',ALLY='char_289_gyuki',origin='http://127.0.0.1:3182';
await mkdir(dir,{recursive:true});
const data=await(await fetch(origin+'/data/arkpedia-mvp.json')).json();assert.ok(data.operators[ID]);
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;
const app=await readFile('public/arkpedia/app.js','utf8');
const hook=`\nglobalThis.publicBlazeReview={get battle(){return battle;},get renderer(){return renderer;},hits:[],
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();renderer.render(battle,s,battle.drainEvents());drawHud();},
 target(){battle.autoFinish=false;battle.rng=()=>.99;const t=battle.spawnEnemy('enemy_1007_slime',{pos:[2,5]});Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=1e7;battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();battle.on('damaged',c=>{if(c.dmg?.tags?.some(t=>t.startsWith('blaze2:')))this.hits.push({tags:c.dmg.tags,amount:c.amount,sourceless:!!c.dmg.sourceless});});paused=true;drawHud();return t.id;},
 burn(id){const t=battle.units.find(u=>u.id===id);battle.dealDamage(null,t,{amount:t.gaugeMax,type:'element',element:'burn',canDodge:false});renderer.render(battle,.001,battle.drainEvents());drawHud();},
 down(id){const u=battle.bench[id].unit;battle.dealDamage(null,u,{amount:u.hp+1,type:'true',canDodge:false});renderer.render(battle,.001,battle.drainEvents());drawHud();}};`;
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const reports=[],errors=[],failedResources=[];
try{
 for(const skill of [1,2,3]){
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)failedResources.push({url:r.url(),status:r.status()});});
  await page.setViewport({width:1280,height:800});await page.setRequestInterception(true);
  page.on('request',r=>{const path=new URL(r.url()).pathname;
   if(r.url().startsWith(origin)&&path==='/favicon.ico')return r.respond({status:204});
   if(r.url().startsWith(origin)&&path==='/arkpedia/app.js')return r.respond({status:200,contentType:'text/javascript',body:app+hook});
   if(r.url().startsWith(origin)&&path==='/data/arkpedia-mvp.json')return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
   return r.continue();});
  await page.goto(origin+'/arkpedia/',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForSelector('.roster-item.chosen');
  for(const id of await page.$$eval('.roster-item.chosen',es=>es.map(e=>e.dataset.id))){await page.click(`.roster-item[data-id="${id}"]`);await page.click('#toggle');}
  for(const [id,name]of [[ID,data.operators[ID].name],[ALLY,data.operators[ALLY].name]]){
   await page.$eval('#roster-search',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.type('#roster-search',name);
   await page.click(`.roster-item[data-id="${id}"]`);await page.click('#toggle');
  }
  await page.$eval('#roster-search',(e,name)=>{e.value=name;e.dispatchEvent(new Event('input',{bubbles:true}));},data.operators[ID].name);
  await page.click(`.roster-item[data-id="${ID}"]`);assert.equal(await page.$eval('#skillId',e=>e.options.length),3);
  await page.select('#skillId',`skchr_blaze2_${skill}`);await page.click('#start');
  await page.waitForFunction(()=>window.publicBlazeReview?.battle&&document.querySelector('#deployment button'),{timeout:60000});
  const target=await page.evaluate(()=>publicBlazeReview.target());
  async function deploy(id,row,col,dir='RIGHT'){
   const card=await page.$(`#deployment [data-id="${id}"]`),box=await card.boundingBox();
   const p=await page.evaluate((row,col)=>{const r=publicBlazeReview.renderer,p=r.projection.project(col,row,r.heightAt(row,col)),box=document.querySelector('#battle-board').getBoundingClientRect();return{x:p.x+box.x,y:p.y+box.y};},row,col);
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:12});await page.mouse.up();
   await page.waitForSelector('.facing-picker:not([hidden])');assert.equal(await page.evaluate(id=>!!publicBlazeReview.battle.bench[id].unit?.alive,id),false);
   const handle=await page.$('.facing-handle'),h=await handle.boundingBox(),x=h.x+h.width/2,y=h.y+h.height/2;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+(dir==='RIGHT'?65:0),y+(dir==='UP'?-65:0),{steps:8});
   assert.equal(await page.evaluate(id=>!!publicBlazeReview.battle.bench[id].unit?.alive,id),false);await page.mouse.up();
   await page.waitForFunction(id=>publicBlazeReview.battle.bench[id].unit?.alive,{},id);
  }
  await deploy(ALLY,2,5);await page.evaluate(()=>publicBlazeReview.advance(2));await deploy(ID,2,4);
  const initial=await page.evaluate(id=>{const b=publicBlazeReview.battle,u=b.bench[id].unit;return{dp:b.dp,sp:u.skill.sp,index:u.mem.blazeIgnitingController.record.index,dir:u.dir};},ID);
  assert.equal(initial.index,skill-1);assert.equal(initial.dir,'RIGHT');
  await page.evaluate(id=>{const u=publicBlazeReview.battle.bench[id].unit;publicBlazeReview.advance(Math.max(0,u.skill.spCost-u.skill.sp)+1);},ID);
  if(skill!==1){await page.waitForFunction(()=>document.querySelector('#skill')&&!document.querySelector('#skill').disabled);await page.click('#skill');}
  await page.evaluate(()=>publicBlazeReview.advance(3));
  const active=await page.evaluate((id,skill)=>{const b=publicBlazeReview.battle,u=b.bench[id].unit,c=u.mem.blazeIgnitingController;return{fields:c.s1?.fields.size??0,tiles:c.s2?.tiles.size??0,ammo:u.skill.ammoLeft,active:u.skill.active,clip:u.mem.regularFormVisual.clip,model:publicBlazeReview.renderer.views.get(u.id).key,hits:publicBlazeReview.hits,errors:b.errors};},ID,skill);
  assert.ok(active.model.endsWith('/front'));assert.deepEqual(active.errors,[]);
  assert.ok(active.hits.some(h=>h.tags.includes(skill===1?'blaze2:s1-field':skill===2?'blaze2:s2-tile':'blaze2:s3-shot')));
  if(skill===1)assert.ok(active.fields>0);if(skill===2)assert.ok(active.tiles>0);
  if(skill===3){const before=active.ammo;await page.evaluate(t=>publicBlazeReview.burn(t),target);
   assert.equal(await page.evaluate(id=>publicBlazeReview.battle.bench[id].unit.skill.ammoLeft,ID),before+2);}
  await page.waitForFunction(()=>[...document.querySelectorAll('.operator-skill .skill-icon, #field-actions #skill img')].every(e=>e.complete&&e.naturalWidth>0),{timeout:30000});
  await page.evaluate(()=>{const e=document.createElement('div');e.textContent='CONTROLLED QA · natural SP / pinned target / 99 DP';e.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:12px sans-serif;pointer-events:none';document.querySelector('.workspace').append(e);});
  await page.screenshot({path:dir+`public-s${skill}-desktop.png`});
  if(skill===3){
   await page.evaluate(id=>publicBlazeReview.down(id),ID);assert.equal(await page.evaluate(id=>publicBlazeReview.battle.bench[id].unit.mem.blazeIgnitingController.reborn.kind,ID),'downed');
   assert.equal(await page.evaluate(id=>publicBlazeReview.battle.bench[id].unit.skill.active,ID),false);
   await page.evaluate(()=>publicBlazeReview.advance(1.2));
   assert.equal(await page.evaluate(id=>publicBlazeReview.battle.bench[id].unit.mem.regularFormVisual.clip,ID),'Revive_Idle');
   await page.screenshot({path:dir+'public-s3-downed.png'});await page.evaluate(()=>publicBlazeReview.advance(35));
   assert.equal(await page.evaluate(id=>publicBlazeReview.battle.bench[id].unit.mem.blazeIgnitingController.reborn,ID),null);
   await page.setViewport({width:844,height:390});await page.screenshot({path:dir+'public-s3-landscape.png'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.setViewport({width:390,height:844});await page.waitForFunction(()=>!document.querySelector('#orientation-gate').hidden);
   const before=await page.evaluate(()=>publicBlazeReview.battle.time);await page.evaluate(()=>new Promise(r=>setTimeout(r,150)));
   assert.equal(await page.evaluate(()=>publicBlazeReview.battle.time),before);await page.screenshot({path:dir+'public-s3-portrait.png'});
   await page.setViewport({width:1280,height:800});await page.waitForFunction(()=>document.querySelector('#orientation-gate').hidden);
  }
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');
  assert.equal(await page.evaluate(id=>publicBlazeReview.battle.bench[id].unit.mem.blazeIgnitingController.stopped,ID),true);
  await page.evaluate(()=>publicBlazeReview.advance(25));
  const cleanup=await page.evaluate(id=>{const c=publicBlazeReview.battle.bench[id].unit.mem.blazeIgnitingController;return{fields:c.s1?.fields.size??0,tiles:c.s2?.tiles.size??0,drain:!!c.s3?.drain,handles:c.handles.length,errors:c.b.errors};},ID);
  assert.deepEqual(cleanup,{fields:0,tiles:0,drain:false,handles:0,errors:[]});
  let redeployment=null;
  if(skill===3){
   await page.evaluate(t=>{publicBlazeReview.advance(50);const u=publicBlazeReview.battle.units.find(u=>u.id===t);u.x=4;u.y=4;u.tileR=4;u.tileC=4;publicBlazeReview.battle._buildEnemyIndex();},target);
   await deploy(ID,2,4,'UP');await page.evaluate(id=>{const u=publicBlazeReview.battle.bench[id].unit;publicBlazeReview.advance(u.skill.spCost-u.skill.sp+1);},ID);
   await page.click('#skill');await page.evaluate(()=>publicBlazeReview.advance(1));
   redeployment=await page.evaluate(id=>{const u=publicBlazeReview.battle.bench[id].unit;return{dir:u.dir,model:publicBlazeReview.renderer.views.get(u.id).key,clip:u.mem.regularFormVisual.clip,active:u.skill.active};},ID);
   assert.equal(redeployment.dir,'UP');assert.ok(redeployment.model.endsWith('/back'));assert.equal(redeployment.clip,'Skill_3_Loop');assert.equal(redeployment.active,true);
   await page.screenshot({path:dir+'public-s3-back.png'});await page.click('#skill');
   assert.equal(await page.evaluate(id=>publicBlazeReview.battle.bench[id].unit.skill.active,ID),false);
   await page.click('#retreat');await page.evaluate(()=>publicBlazeReview.advance(2));
   assert.equal(await page.evaluate(id=>publicBlazeReview.battle.bench[id].unit.mem.blazeIgnitingController.handles.length,ID),0);
  }
  reports.push({skill,initial,active,cleanup,redeployment});await page.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failedResources,[]);
 const report={driver:'Chromium software WebGL2',publicCommands:true,dragDropAndSwipe:true,controlledTarget:true,forcedSp:false,operators:Object.keys(data.operators).length,frameParity:false,reports,errors,failedResources};
 await writeFile(dir+'public-browser-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
