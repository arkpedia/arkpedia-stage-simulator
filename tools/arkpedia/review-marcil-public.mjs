// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI QA: pinned targets/99 DP/empty waves, natural bench mana.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and run the port-3182 preview.');
const dir = '.cache/arkpedia/marcil-source/public-browser/', ID = 'char_4141_marcil', origin = 'http://127.0.0.1:3182';
await mkdir(dir, { recursive: true });
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json(); assert.ok(data.operators[ID]);
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
globalThis.publicMarcilReview={get battle(){return battle;},get renderer(){return renderer;},hits:[],bursts:[],
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();renderer.render(battle,s,battle.drainEvents());drawHud();},
 pin(){battle.autoFinish=false;const t=battle.spawnEnemy('enemy_1007_slime',{pos:[3,7]});Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=1e7;battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true,unblockable:true}});battle._buildEnemyIndex();battle.on('damaged',c=>{if(c.source?.defId==='char_4141_marcil')this.hits.push({tags:c.dmg.tags,amount:c.amount});});battle.on('marcilExplosion',c=>this.bursts.push({index:c.index,cost:c.cost,mana:c.mana}));paused=true;drawHud();return t.id;}};`;
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const reports = [], errors = [], failedResources = [];
try {
 for(const skill of [1,2,3]) {
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)failedResources.push({url:r.url(),status:r.status()});});
  await page.setViewport({width:1280,height:800});await page.setRequestInterception(true);
  page.on('request',r=>{
   const path=new URL(r.url()).pathname;
   if(r.url().startsWith(origin)&&path==='/favicon.ico')return r.respond({status:204});
   if(r.url().startsWith(origin)&&path==='/arkpedia/app.js')return r.respond({status:200,contentType:'text/javascript',body:app+hook});
   if(r.url().startsWith(origin)&&path==='/data/arkpedia-mvp.json')return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
   return r.continue();
  });
  await page.goto(origin+'/arkpedia/',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForSelector('.roster-item.chosen');
  for(const id of await page.$$eval('.roster-item.chosen',es=>es.map(e=>e.dataset.id))){await page.click(`.roster-item[data-id="${id}"]`);await page.click('#toggle');}
  async function choose(id){await page.$eval('#roster-search',(e,name)=>{e.value=name;e.dispatchEvent(new Event('input',{bubbles:true}));},data.operators[id].name);await page.click(`.roster-item[data-id="${id}"]`);}
  await choose(ID);await page.click('#toggle');assert.equal(await page.$eval('#skillId',e=>e.options.length),3);
  await page.select('#skillId',`skchr_marcil_${skill}`);
  for(const id of ['char_4142_laios','char_4143_sensi','char_4144_chilc']){await choose(id);await page.click('#toggle');}
  await page.click('#start');await page.waitForFunction(()=>window.publicMarcilReview?.battle&&document.querySelector('#deployment button'),{timeout:60000});
  const target=await page.evaluate(()=>publicMarcilReview.pin());
  await page.evaluate(s=>publicMarcilReview.advance(s),skill===2?40:4);
  const bench=await page.evaluate(id=>{
   const b=publicMarcilReview.battle,w=b._marcilManaWallets.get('arkpedia:'+id),card=document.querySelector(`#deployment [data-id="${id}"]`);
   return {mana:w.value,maximum:w.record.mana.maximum,owner:!!w.owner,party:b._marcilParty.enabled,label:card.getAttribute('aria-label'),frame:!!card.querySelector('.mana-charge'),frameStyle:(()=>{const p=card.querySelector('.mana-charge path'),s=getComputedStyle(p),r=p.getBoundingClientRect();return{stroke:s.stroke,width:s.strokeWidth,dash:s.strokeDasharray,offset:s.strokeDashoffset,length:p.getTotalLength(),rect:{x:r.x,y:r.y,width:r.width,height:r.height}};})()};
  },ID);assert.equal(bench.owner,false);assert.equal(bench.party,true);assert.equal(bench.frame,true);assert.ok(bench.label.includes(`${bench.mana} / 80 Mana`));
  await page.click(`#deployment [data-id="${ID}"]`);assert.ok(await page.$eval('.operator-skill .sp-readout',e=>e.textContent.includes('Mana')));
  await page.evaluate(()=>{const e=document.createElement('div');e.textContent='CONTROLLED QA · pinned target / 99 DP / empty waves / natural bench mana';e.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:12px sans-serif;pointer-events:none';document.querySelector('.workspace').append(e);});
  await page.waitForFunction(()=>[...document.querySelectorAll('.operator-portrait img, .operator-skill .skill-icon, .command-class img, #deployment img')].every(e=>e.complete&&e.naturalWidth>0),{timeout:30000});
  await page.screenshot({path:dir+`public-s${skill}-bench.png`});
  if(skill===1){const c=await(await page.$(`#deployment [data-id="${ID}"]`)).boundingBox();await page.screenshot({path:dir+'public-mana-card.png',clip:c});}
  async function deploy(direction='RIGHT') {
   const box=await (await page.$(`#deployment [data-id="${ID}"]`)).boundingBox();
   const p=await page.evaluate(direction=>{const row=direction==='UP'?1:4,r=publicMarcilReview.renderer,p=r.projection.project(6,row,r.heightAt(row,6)),box=document.querySelector('#battle-board').getBoundingClientRect();return{x:p.x+box.x,y:p.y+box.y};},direction);
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:12});await page.mouse.up();
   await page.waitForSelector('.facing-picker:not([hidden])');assert.equal(await page.evaluate(id=>!!publicMarcilReview.battle.bench[id].unit?.alive,ID),false);
   const h=await(await page.$('.facing-handle')).boundingBox(),x=h.x+h.width/2,y=h.y+h.height/2;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+(direction==='RIGHT'?65:0),y+(direction==='UP'?-65:0),{steps:8});
   assert.equal(await page.evaluate(id=>!!publicMarcilReview.battle.bench[id].unit?.alive,ID),false);
   await page.mouse.up();await page.waitForFunction(id=>publicMarcilReview.battle.bench[id].unit?.alive,{},ID);
   await page.evaluate(()=>publicMarcilReview.advance(1.1));
  }
  await deploy();
  if(skill!==2){await page.waitForFunction(()=>!document.querySelector('#skill').disabled);await page.click('#skill');}
  const chant=await page.evaluate(id=>{const u=publicMarcilReview.battle.bench[id].unit;return{active:u.skill.active,activations:u.skill.activations,mana:u.skill.spTotal,mode:u.mem.marcilAttacks.mode,clip:u.mem.regularFormVisual.clip};},ID);
  assert.equal(chant.active,false);assert.equal(chant.activations,0);assert.equal(chant.mana,bench.mana);
  assert.equal(await page.$eval('#skill',e=>e.disabled),true);assert.match(await page.$eval('.operator-skill .sp-readout',e=>e.textContent),/Chanting/);assert.equal(await page.$eval('#skill .field-sp',e=>e.textContent),'CHANTING');
  await page.evaluate(()=>publicMarcilReview.advance(.4));await page.screenshot({path:dir+`public-s${skill}-chant.png`});
  await page.evaluate(s=>publicMarcilReview.advance(s),skill===1?3:skill===2?12:5);
  if(skill===3){assert.equal(await page.$eval('#skill',e=>e.disabled),false);assert.equal(await page.$eval('#skill',e=>e.title),'Release explosion');assert.equal(await page.$eval('#skill .field-sp',e=>e.textContent),'RELEASE');await page.screenshot({path:dir+'public-s3-extra.png'});await page.click('#skill');await page.evaluate(()=>publicMarcilReview.advance(.2));}
  await page.waitForFunction(id=>publicMarcilReview.renderer.views.get(publicMarcilReview.battle.bench[id].unit.id)?.key,{},ID);
  const active=await page.evaluate(id=>{const u=publicMarcilReview.battle.bench[id].unit;return{active:u.skill.active,activations:u.skill.activations,mana:u.skill.spTotal,mode:u.mem.marcilAttacks.mode,tier:u.mem.marcilAttacks.tier,model:publicMarcilReview.renderer.views.get(u.id).key,errors:publicMarcilReview.battle.errors};},ID);
  assert.equal(active.active,true);assert.equal(active.activations,1);assert.ok(active.model.endsWith('/front'));assert.deepEqual(active.errors,[]);
  await page.waitForFunction(()=>[...document.querySelectorAll('.operator-skill .skill-icon, #field-actions #skill img')].every(e=>e.complete&&e.naturalWidth>0),{timeout:30000});
  await page.screenshot({path:dir+`public-s${skill}-desktop.png`});await page.evaluate(()=>publicMarcilReview.advance(3));
  assert.ok(await page.evaluate(s=>publicMarcilReview.hits.some(h=>h.tags.includes(`marcil:s${s}`)),skill));
  if(skill===2){assert.equal(active.tier,1);await page.click('#skill');await page.evaluate(()=>publicMarcilReview.advance(13));assert.equal(await page.evaluate(id=>publicMarcilReview.battle.bench[id].unit.mem.marcilAttacks.tier,ID),2);assert.equal(await page.$eval('#skill',e=>e.disabled),true);await page.screenshot({path:dir+'public-s2-upgraded.png'});}
  if(skill===3){assert.equal(await page.evaluate(()=>publicMarcilReview.bursts.length),1);await page.setViewport({width:844,height:390});await page.screenshot({path:dir+'public-s3-landscape.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewport({width:390,height:844});await page.waitForFunction(()=>!document.querySelector('#orientation-gate').hidden);await page.screenshot({path:dir+'public-s3-portrait.png'});await page.setViewport({width:1280,height:800});await page.waitForFunction(()=>document.querySelector('#orientation-gate').hidden);}
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');
  const cleanup=await page.evaluate(id=>{const b=publicMarcilReview.battle,u=b.bench[id].unit,c=u.mem.marcilAttacks,w=u.mem.marcilMana.wallet;return{stopped:c.stopped,handles:c.handles.length,active:u.skill.active,owner:!!w.owner,mana:w.value,errors:b.errors};},ID);
  assert.equal(cleanup.stopped,true);assert.equal(cleanup.handles,0);assert.equal(cleanup.active,false);assert.equal(cleanup.owner,false);assert.deepEqual(cleanup.errors,[]);
  let redeployment=null;
  if(skill===3){await page.evaluate(t=>{publicMarcilReview.advance(85);const u=publicMarcilReview.battle.enemies.find(u=>u.id===t);u.x=6;u.y=2;u.tileR=2;u.tileC=6;publicMarcilReview.battle._buildEnemyIndex();},target);await deploy('UP');await page.click('#skill');await page.evaluate(()=>publicMarcilReview.advance(16.5));redeployment=await page.evaluate(id=>{const u=publicMarcilReview.battle.bench[id].unit;return{dir:u.dir,model:publicMarcilReview.renderer.views.get(u.id).key,active:u.skill.active,clip:u.mem.regularFormVisual.clip,completed:u.mem.marcilMana.wallet.completedExtraChant};},ID);assert.equal(redeployment.dir,'UP');assert.ok(redeployment.model.endsWith('/back'));assert.equal(redeployment.completed,true);await page.screenshot({path:dir+'public-s3-back.png'});await page.click('#retreat');assert.equal(await page.evaluate(id=>publicMarcilReview.battle._marcilManaWallets.get('arkpedia:'+id).value,ID),0);}
  reports.push({skill,bench,chant,active,cleanup,redeployment});await page.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failedResources,[]);
 await writeFile(dir+'report.json',JSON.stringify({scope:'Controlled public drag/drop and skill UI; pinned target/99 DP/empty waves; mana is never forced',operators:Object.keys(data.operators).length,reports,errors,failedResources},null,2));
 console.log(JSON.stringify({reports:reports.length,operators:Object.keys(data.operators).length,errors:errors.length,failedResources:failedResources.length}));
} finally {await browser.close();}
