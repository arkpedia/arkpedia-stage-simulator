// SPDX-License-Identifier: GPL-3.0-or-later
// Real public UI commands, with diagnostic DP and a stationary high-HP enemy.
// Deterministic clock stepping is not proof of original Unity callback timing.
import puppeteer from 'puppeteer-core';import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const executablePath=process.env.ARKPEDIA_REVIEW_CHROME;if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME; preview must be running on port 3182.');
const dir='.cache/arkpedia/thorns-lodestar-source/',ID='char_1039_thorn2',ALLY='char_289_gyuki',origin='http://127.0.0.1:3182';await mkdir(dir,{recursive:true});
const data=await (await fetch(origin+'/data/arkpedia-mvp.json')).json();assert.ok(data.operators[ID]);
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;
const app=await readFile('public/arkpedia/app.js','utf8');
const hook=`\nglobalThis.publicThornsReview={get battle(){return battle;},get renderer(){return renderer;},dots:[],
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();renderer.render(battle,s,battle.drainEvents());drawHud();},
 target(){battle.autoFinish=false;battle.rng=()=>.99;const t=battle.spawnEnemy('enemy_1007_slime',{pos:[2,5]});Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=1e7;battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();battle.on('damaged',c=>{if(c.target===t&&c.dmg?.tags?.some(t=>t==='thorns:s2'||t==='thorns:s3'))this.dots.push({tags:c.dmg.tags,sourceless:c.dmg.sourceless});});drawHud();return t.id;}};`;
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const reports=[],errors=[],failedResources=[];
try{
 for(const skill of [1,2,3]){
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)failedResources.push({url:r.url(),status:r.status()});});
  await page.setViewport({width:1280,height:800});await page.setRequestInterception(true);
  page.on('request',r=>{const path=new URL(r.url()).pathname;
   // The preview has no favicon; do not mix the browser's implicit request with battle assets.
   if(r.url().startsWith(origin)&&path==='/favicon.ico')return r.respond({status:204});
   if(r.url().startsWith(origin)&&path==='/arkpedia/app.js')return r.respond({status:200,contentType:'text/javascript',body:app+hook});
   if(r.url().startsWith(origin)&&path==='/data/arkpedia-mvp.json')return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
   return r.continue();});
  await page.goto(origin+'/arkpedia/',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForSelector('.roster-item.chosen');
  const selected=await page.$$eval('.roster-item.chosen',es=>es.map(e=>e.dataset.id));
  for(const id of selected){await page.click(`.roster-item[data-id="${id}"]`);await page.click('#toggle');}
  for(const [id,name] of [[ID,'Thorns'],[ALLY,data.operators[ALLY].name]]){await page.$eval('#roster-search',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.type('#roster-search',name);await page.click(`.roster-item[data-id="${id}"]`);await page.click('#toggle');}
  await page.$eval('#roster-search',e=>{e.value='Thorns';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.click(`.roster-item[data-id="${ID}"]`);
  assert.equal(await page.$eval('#skillId',e=>e.options.length),3);await page.select('#skillId',`skchr_thorn2_${skill}`);await page.click('#start');
  await page.waitForFunction(()=>window.publicThornsReview?.battle&&document.querySelector('#deployment button'),{timeout:60000});
  const target=await page.evaluate(()=>publicThornsReview.target());
  async function deploy(id,row,col){
   await page.click(`#deployment [data-id="${id}"]`);
   const p=await page.evaluate((row,col)=>{const r=publicThornsReview.renderer,p=r.projection.project(col,row,r.heightAt(row,col)),box=document.querySelector('#battle-board').getBoundingClientRect();return{x:p.x+box.x,y:p.y+box.y};},row,col);
   await page.mouse.click(p.x,p.y);await page.waitForSelector('.facing-picker:not([hidden])');
   assert.equal(await page.evaluate(id=>publicThornsReview.battle.bench[id].unit,id),null);
   await page.click('[data-facing="RIGHT"]');await page.waitForFunction(id=>publicThornsReview.battle.bench[id].unit?.alive,{},id);
  }
  await deploy(ALLY,2,5);await page.evaluate(id=>{const u=publicThornsReview.battle.bench[id].unit;u.hp=u.s.maxHp/2;publicThornsReview.advance(2);},ALLY);
  await deploy(ID,2,4);
  const initial=await page.evaluate(id=>{const b=publicThornsReview.battle,u=b.bench[id].unit;return{dp:b.dp,sp:u.skill.sp,model:publicThornsReview.renderer.views.get(u.id)?.key,index:u.mem.thornsController.record.index};},ID);assert.equal(initial.index,skill-1);
  await page.evaluate((id,skill)=>{const b=publicThornsReview.battle,u=b.bench[id].unit;publicThornsReview.advance(Math.max(0,u.skill.spCost-u.skill.sp)+2);},ID,skill);
  if(skill!==1){await page.waitForFunction(()=>document.querySelector('#skill')&&!document.querySelector('#skill').disabled);await page.click('#skill');}
  await page.evaluate(()=>publicThornsReview.advance(3));
  const active=await page.evaluate((id,ally,t,skill)=>{const b=publicThornsReview.battle,u=b.bench[id].unit,c=u.mem.thornsController;return{fields:c['s'+skill].fields.length,allyRegen:b.bench[ally].unit.s.hpRegen,targetDamaged:b.units.find(u=>u.id===t).hp<1e7,fieldDamage:publicThornsReview.dots,model:publicThornsReview.renderer.views.get(u.id).key,clip:u.mem.regularFormVisual.clip,errors:b.errors};},ID,ALLY,target,skill);
  assert.ok(active.fields>0);assert.ok(active.model.endsWith('/front'));assert.deepEqual(active.errors,[]);if(skill===1)assert.ok(active.allyRegen>0);else assert.ok(active.targetDamaged);
  if(skill!==1)assert.ok(active.fieldDamage.some(d=>d.sourceless&&d.tags.includes(`thorns:s${skill}`)));
  await page.waitForFunction(()=>[...document.querySelectorAll('.operator-skill .skill-icon, #field-actions #skill img')].every(e=>e.complete&&e.naturalWidth>0),{timeout:30000});
  await page.evaluate(()=>{const e=document.createElement('div');e.textContent='CONTROLLED QA · natural SP / pinned target / 99 starting DP';e.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:12px sans-serif;pointer-events:none';document.body.append(e);});
  await page.screenshot({path:dir+`public-s${skill}-desktop.png`});
  if(skill===3){await page.setViewport({width:844,height:390});await page.screenshot({path:dir+'public-s3-landscape.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.setViewport({width:390,height:844});await page.waitForFunction(()=>!document.querySelector('#orientation-gate').hidden);const before=await page.evaluate(()=>publicThornsReview.battle.time);await page.evaluate(()=>new Promise(r=>setTimeout(r,150)));assert.equal(await page.evaluate(()=>publicThornsReview.battle.time),before);
   await page.screenshot({path:dir+'public-s3-portrait.png'});await page.setViewport({width:1280,height:800});await page.waitForFunction(()=>document.querySelector('#orientation-gate').hidden);}
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');assert.equal(await page.evaluate(id=>publicThornsReview.battle.bench[id].unit.mem.thornsController.stopped,ID),true);
  await page.evaluate(()=>publicThornsReview.advance(50));assert.equal(await page.evaluate((id,skill)=>publicThornsReview.battle.bench[id].unit.mem.thornsController['s'+skill].fields.length,ID,skill),0);
  reports.push({skill,initial,active,cleanup:true});await page.close();
 }
 console.log(JSON.stringify({failedResources}));assert.deepEqual(errors,[]);const report={driver:'Chromium software WebGL2',publicCommands:true,controlledTarget:true,forcedSp:false,operators:Object.keys(data.operators).length,compiledFrameParity:false,reports,errors,failedResources};
 await writeFile(dir+'public-browser-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
