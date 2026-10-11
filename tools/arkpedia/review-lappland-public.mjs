// SPDX-License-Identifier: GPL-3.0-or-later
// Public UI/commands with diagnostic starting DP and a pinned high-HP target.
import puppeteer from 'puppeteer-core';import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const executablePath=process.env.ARKPEDIA_REVIEW_CHROME;if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME and start the main preview on port 3182.');
const dir='.cache/arkpedia/lappland-alter-source/',ID='char_1038_whitw2',origin='http://127.0.0.1:3182';
const data=await (await fetch(origin+'/data/arkpedia-mvp.json')).json();
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;
const app=await readFile('public/arkpedia/app.js','utf8');
const hook=`\nglobalThis.publicLapplandReview={get battle(){return battle;},get renderer(){return renderer;},get data(){return data;},
 advance(seconds){paused=true;for(let n=0;n<Math.ceil(seconds/battle.dt-1e-9);n++)battle.step();renderer.render(battle,seconds,battle.drainEvents());drawHud();},
 target(){battle.autoFinish=false;battle.rng=()=>.99;const t=battle.spawnEnemy('enemy_1007_slime',{pos:[2,6]});Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();t.hp=1e7;battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();drawHud();return t.id;}};`;
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const reports=[],errors=[];
try{
 for(const skill of [1,2,3]){
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewport({width:1280,height:800});await page.setRequestInterception(true);
  page.on('request',r=>{const path=new URL(r.url()).pathname;
   if(r.url().startsWith(origin)&&path==='/arkpedia/app.js')return r.respond({status:200,contentType:'text/javascript',body:app+hook});
   if(r.url().startsWith(origin)&&path==='/data/arkpedia-mvp.json')return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
   return r.continue();});
  await page.goto(origin+'/arkpedia/',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForSelector('.roster-item.chosen');
  const selected=await page.$$eval('.roster-item.chosen',es=>es.map(e=>e.dataset.id));
  for(const id of selected){await page.click(`.roster-item[data-id="${id}"]`);await page.click('#toggle');}
  await page.type('#roster-search','Lappland');await page.click(`.roster-item[data-id="${ID}"]`);await page.click('#toggle');
  assert.equal(await page.$eval('#skillId',e=>e.options.length),3);await page.select('#skillId',`skchr_whitw2_${skill}`);
  await page.$eval('#potential',e=>{e.value='6';e.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.click('#start');await page.waitForFunction(()=>window.publicLapplandReview?.battle&&document.querySelector('#deployment button'),{timeout:60000});
  const target=await page.evaluate(()=>publicLapplandReview.target());
  await page.click(`#deployment [data-id="${ID}"]`);
  const pos=await page.evaluate(()=>{const r=publicLapplandReview.renderer,p=r.projection.project(4,2,r.heightAt(2,4)),box=document.querySelector('#battle-board').getBoundingClientRect();return {x:p.x+box.x,y:p.y+box.y};});
  await page.mouse.click(pos.x,pos.y);await page.waitForSelector('.facing-picker:not([hidden])');
  assert.equal(await page.evaluate(id=>publicLapplandReview.battle.bench[id].unit,ID),null);
  await page.click('[data-facing="RIGHT"]');await page.waitForFunction(id=>publicLapplandReview.battle.bench[id].unit?.alive,{},ID);
  const initial=await page.evaluate(id=>{const b=publicLapplandReview.battle,u=b.bench[id].unit;return {dp:b.dp,cost:b.bench[id].lastCost,sp:u.skill.sp,init:u.skill.initSp,model:publicLapplandReview.renderer.views.get(u.id)?.key};},ID);
  assert.equal(initial.dp,99-initial.cost);assert.equal(initial.sp,Math.min(initial.init+6,skill===1?6:skill===2?28:54));
  await page.evaluate(id=>{const u=publicLapplandReview.battle.bench[id].unit;publicLapplandReview.advance(Math.max(0,u.skill.spCost-u.skill.sp)+1.2);},ID);
  await page.waitForFunction(()=>document.querySelector('#skill')&&!document.querySelector('#skill').disabled);
  await page.click('#skill');assert.equal(await page.evaluate(id=>publicLapplandReview.battle.bench[id].unit.skill.active,ID),true);
  await page.evaluate(()=>publicLapplandReview.advance(2));
  const active=await page.evaluate((id,t)=>{const b=publicLapplandReview.battle,u=b.bench[id].unit;return {skill:u.skill.id,active:u.skill.active,targetDamaged:b.units.find(u=>u.id===t).hp<1e7,
   clip:u.mem.regularFormVisual.clip,model:publicLapplandReview.renderer.views.get(u.id).key,errors:b.errors};},ID,target);
  assert.equal(active.targetDamaged,true);assert.deepEqual(active.errors,[]);assert.ok(active.model.endsWith('/front'));
  await page.evaluate(()=>{const e=document.createElement('div');e.textContent='CONTROLLED QA · 99 starting DP / pinned high-HP target';e.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:12px sans-serif;pointer-events:none';document.body.append(e);});
  if(skill===3){await page.screenshot({path:dir+'public-s3-desktop.png'});await page.setViewport({width:844,height:390});await page.screenshot({path:dir+'public-s3-landscape.png'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewport({width:390,height:844});await page.waitForFunction(()=>!document.querySelector('#orientation-gate').hidden);
   const before=await page.evaluate(()=>publicLapplandReview.battle.time);await page.evaluate(()=>new Promise(r=>setTimeout(r,150)));assert.equal(await page.evaluate(()=>publicLapplandReview.battle.time),before);
   await page.screenshot({path:dir+'public-s3-portrait.png'});await page.setViewport({width:1280,height:800});await page.waitForFunction(()=>document.querySelector('#orientation-gate').hidden);
   await page.click(`#deployment [data-id="${ID}"]`);}
  if(skill===1){assert.equal(await page.$eval('#skill',e=>e.getAttribute('aria-label')),'Stop skill');await page.click('#skill');}
  else await page.evaluate(()=>publicLapplandReview.advance(45));
  assert.equal(await page.evaluate(id=>publicLapplandReview.battle.bench[id].unit.skill.active,ID),false);
  await page.click('#retreat');assert.equal(await page.evaluate(id=>publicLapplandReview.battle.bench[id].unit.mem.lapplandController.stopped,ID),true);
  reports.push({skill,initial,active,cleanup:true});await page.close();
 }
 assert.deepEqual(errors,[]);const report={driver:'Chromium software WebGL2',publicCommands:true,controlledTarget:true,forcedSp:false,operators:Object.keys(data.operators).length,compiledFrameParity:false,reports,errors};
 await writeFile(dir+'public-browser-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
