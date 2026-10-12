// SPDX-License-Identifier: GPL-3.0-or-later
// Public roster and real mouse/touch drop-and-swipe controls. Controlled enemy fixtures; no stage-victory claim.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const executablePath=process.env.ARKPEDIA_REVIEW_CHROME;
if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME and start port 3182 preview.');
const dir='.cache/arkpedia/stainless-source/public-browser/',origin='http://127.0.0.1:3182',ID='char_4072_ironmn',card='summon:'+ID;
await mkdir(dir,{recursive:true});
const data=await(await fetch(origin+'/data/arkpedia-mvp.json')).json();assert.ok(data.operators[ID]);
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;
const app=await readFile('public/arkpedia/app.js','utf8');
const hook=`
globalThis.publicStainlessReview={
 get battle(){return battle;},get renderer(){return renderer;},hits:[],
 get selection(){return{selected,pending,dragging:dragging&&{over:dragging.over,moved:dragging.moved}};},
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;paused=true;this.hits=[];
  battle.on('damaged',h=>this.hits.push({source:h.source?.id,target:h.target.id,amount:h.amount,tags:h.dmg.tags??[]}));this.render();
 },
 until(kind){paused=true;const u=battle.bench['${ID}'].unit,c=u.mem.stainlessController,end=battle.time+80;
  const reached=()=>kind==='ready'?u.skill.ready:kind==='owner'?this.hits.some(h=>h.source===u.id&&h.tags.includes('ironmn:s'+(c.record.index+1))):this.hits.some(h=>h.tags.includes('ironmn:turret-main'));
  while(battle.time<end&&!reached())battle.step();this.render();if(!reached())throw Error('Missing '+kind);
 },
 targets(){const u=battle.bench['${ID}'].unit,c=u.mem.stainlessController;
  const spawn=(r,col)=>{const e=battle.spawnEnemy('enemy_1007_slime',{pos:[r,col]});
   Object.assign(e.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
   battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true}});return e;};
  this.ownerTarget=spawn(u.tileR,u.tileC);
  if(c.record.index===2){const t=[...c.devices.devices.keys()][0],d=t.dir;
   this.turretTarget=spawn(t.tileR+(d==='UP'?1:d==='DOWN'?-1:0),t.tileC+(d==='RIGHT'?2:d==='LEFT'?-2:0));}
  battle._buildEnemyIndex();this.advance(battle.dt);
 }
};`;
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const reports=[],errors=[],failures=[];let currentPage;
try{
 for(const mobile of [false,true])for(const [skill,deviceDir] of [[1,'LEFT'],[2,'LEFT'],[3,mobile?'UP':'RIGHT'],[3,'DOWN']]){
  const label=(mobile?'mobile':'desktop')+'-s'+skill+'-'+deviceDir.toLowerCase(),page=await browser.newPage();currentPage=page;
  page.on('pageerror',e=>errors.push({label,message:e.message}));
  page.on('console',m=>{if(m.type()==='error')errors.push({label,message:m.text()});});
  page.on('response',r=>{if(r.status()>=400)failures.push({label,url:r.url(),status:r.status()});});
  await page.setViewport(mobile?{width:844,height:390,isMobile:true,hasTouch:true}:{width:1280,height:800});
  await page.setRequestInterception(true);
  page.on('request',r=>{const path=new URL(r.url()).pathname;
   if(r.url().startsWith(origin)&&path==='/favicon.ico')return r.respond({status:204});
   if(r.url().startsWith(origin)&&path==='/arkpedia/app.js')return r.respond({status:200,contentType:'text/javascript',body:app+hook});
   if(r.url().startsWith(origin)&&path==='/data/arkpedia-mvp.json')return r.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});
   r.continue();
  });
  await page.goto(origin+'/arkpedia/',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForSelector('.roster-item.chosen');
  for(const id of await page.$$eval('.roster-item.chosen',es=>es.map(e=>e.dataset.id))){await page.click('.roster-item[data-id="'+id+'"]');await page.click('#toggle');}
  for(const id of ['char_289_gyuki',ID]){
   await page.$eval('#roster-search',(e,name)=>{e.value=name;e.dispatchEvent(new Event('input',{bubbles:true}));},data.operators[id].name);
   await page.click('.roster-item[data-id="'+id+'"]');await page.click('#toggle');
  }
  assert.equal(await page.$eval('#skillId',e=>e.options.length),3);await page.select('#skillId','skchr_ironmn_'+skill);await page.click('#start');
  await page.waitForFunction(()=>window.publicStainlessReview?.battle&&document.querySelector('#deployment button'),{timeout:60000});
  await page.evaluate(()=>{publicStainlessReview.setup();const e=document.createElement('div');e.textContent='CONTROLLED QA · natural SP / pinned enemies / actual allied attacks / 99 DP';
   e.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:12px sans-serif;pointer-events:none';document.querySelector('.workspace').append(e);});
  async function down(x,y){if(mobile)await page.touchscreen.touchStart(x,y);else{await page.mouse.move(x,y);await page.mouse.down();}}
  async function move(x,y){if(mobile)await page.touchscreen.touchMove(x,y);else await page.mouse.move(x,y,{steps:12});}
  async function up(){if(mobile)await page.touchscreen.touchEnd();else await page.mouse.up();}
  async function press(selector){
   if(!mobile)return page.click(selector);
   const e=await page.$(selector);assert.ok(e);await e.evaluate(e=>e.scrollIntoView({block:'nearest',inline:'nearest'}));
   const box=await e.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  }
  async function deploy(id,row,col,facing=mobile?'UP':'RIGHT'){
   const e=await page.$(`#deployment [data-id="${id}"]`);await e.evaluate(e=>e.scrollIntoView({block:'nearest',inline:'nearest'}));
   const box=await e.boundingBox(),p=await page.evaluate((row,col)=>{
    const r=publicStainlessReview.renderer,p=r.projection.project(col,row,r.heightAt(row,col)),box=document.querySelector('#battle-board').getBoundingClientRect();
    return{x:p.x+box.x,y:p.y+box.y};
   },row,col);
   await down(box.x+box.width/2,box.y+box.height/2);await move(p.x,p.y);
   const selection=await page.evaluate(()=>publicStainlessReview.selection);
   assert.deepEqual(selection.dragging&&{row:selection.dragging.over?.row,col:selection.dragging.over?.col},{row,col});
   assert.equal(await page.evaluate(id=>id.startsWith('summon:')?publicStainlessReview.battle.regularSummons.get(id).deck.own().length>0:!!publicStainlessReview.battle.bench[id].unit?.alive,id),false);await up();
   await page.waitForSelector('.facing-picker:not([hidden])');
   assert.equal(await page.evaluate(id=>id.startsWith('summon:')?publicStainlessReview.battle.regularSummons.get(id).deck.own().length>0:!!publicStainlessReview.battle.bench[id].unit?.alive,id),false);
   if(id===ID)await page.screenshot({path:dir+label+'-facing.png'});
   const h=await(await page.$('.facing-handle')).boundingBox(),x=h.x+h.width/2,y=h.y+h.height/2;
   await down(x,y);await move(x+(facing==='RIGHT'?65:facing==='LEFT'?-65:0),y+(facing==='UP'?-65:facing==='DOWN'?65:0));
   assert.equal(await page.evaluate(id=>id.startsWith('summon:')?publicStainlessReview.battle.regularSummons.get(id).deck.own().length>0:!!publicStainlessReview.battle.bench[id].unit?.alive,id),false);await up();
   await page.waitForFunction(id=>id.startsWith('summon:')?publicStainlessReview.battle.regularSummons.get(id).deck.own().length>0:publicStainlessReview.battle.bench[id].unit?.alive,{},id);
  }

  await deploy(ID,3,4);await page.evaluate(()=>publicStainlessReview.advance(1.1));
  const before=await page.evaluate(()=>publicStainlessReview.battle.deployedSlots());
  await deploy(card,3,5,deviceDir);
  assert.equal(await page.evaluate(()=>publicStainlessReview.battle.deployedSlots()),before);
  if(skill===3)await deploy('char_289_gyuki',3,6,'LEFT');
  await page.evaluate(()=>publicStainlessReview.targets());
  await press('#deployment [data-id="'+ID+'"]');await page.evaluate(()=>publicStainlessReview.until('ready'));
  assert.equal(await page.$eval('#skill',e=>e.disabled),false);await page.screenshot({path:dir+label+'-ready.png'});await press('#skill');
  await page.evaluate(()=>publicStainlessReview.until('owner'));
  if(skill===3)await page.evaluate(()=>publicStainlessReview.until('turret'));
  const state=await page.evaluate(()=>{
   const q=publicStainlessReview,u=q.battle.bench['char_4072_ironmn'].unit,c=u.mem.stainlessController,t=[...c.devices.devices.keys()][0],v=q.renderer.views.get(t.id);
   return{active:u.skill.active,hits:q.hits,ownerClip:u.mem.regularFormVisual.clip,actorClip:q.renderer.views.get(u.id)?.actor.current,
    token:{id:t.id,defId:t.defId,dir:t.dir,side:t.side,key:v?.key,actorClip:v?.actor.current,sp:t.skill.sp,hp:t.hp,mode:c.devices.mode,facing:v?.facing},errors:q.battle.errors};
  });
  assert.deepEqual(state.errors,[]);assert.ok(state.active);assert.equal(state.ownerClip,'Skill_'+skill);assert.equal(state.actorClip,'Skill_'+skill);
  const face=skill!==3?'front':deviceDir==='UP'?'back':deviceDir==='DOWN'?'down':'front';
  assert.equal(state.token.key,'operator/'+state.token.defId+'/default/'+face);assert.equal(state.token.side,skill===3?'enemy':'ally');
  assert.equal(state.token.facing,deviceDir==='LEFT'?-1:1);
  if(skill===3)assert.ok(state.hits.some(h=>h.tags.includes('ironmn:turret-main')));else assert.ok(state.token.mode);
  await page.screenshot({path:dir+label+'-attacking.png'});
  // Select the device by actual field tap and retire it through its public control.
  const p=await page.evaluate(()=>{const q=publicStainlessReview,u=q.battle.bench['char_4072_ironmn'].unit,t=[...u.mem.stainlessController.devices.devices.keys()][0],r=q.renderer;
   const p=r.projection.project(t.x,t.y,r.heightAt(t.tileR,t.tileC)),box=document.querySelector('#battle-board').getBoundingClientRect();return{x:p.x+box.x,y:p.y+box.y,id:t.id};});
  if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
  await page.waitForSelector('#retreat');
  assert.equal(await page.evaluate(()=>publicStainlessReview.selection.selected),'token:'+p.id);
  await press('#retreat');assert.equal(await page.evaluate(id=>publicStainlessReview.battle.units.find(u=>u.id===id)?.alive,p.id),false);
  await press('#deployment [data-id="'+ID+'"]');await press('#retreat');
  const cleanup=await page.evaluate(()=>{const q=publicStainlessReview,c=q.battle.bench['char_4072_ironmn'].unit.mem.stainlessController;return{
   stopped:c.stopped,devices:c.devices.devices.size,stock:c.devices.stock,registered:q.battle.regularSummons.has('summon:char_4072_ironmn'),handles:c.handles.length+c.devices.handles.length,errors:q.battle.errors};});
  assert.deepEqual(cleanup,{stopped:true,devices:0,stock:0,registered:false,handles:0,errors:[]});
  assert.equal(await page.$$eval('#deployment [data-id="summon:char_4072_ironmn"]',es=>es.length),0);
  reports.push({label,state,cleanup});await page.close();currentPage=null;
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 await writeFile(dir+'report.json',JSON.stringify({scope:'Controlled enemy fixtures; actual public mouse/touch deployment, allied attacks and natural SP; not unmodified stage victory',reports,errors,failures},null,2)+'\n');
 console.log(JSON.stringify({checks:reports.length,errors,failures}));
}catch(error){if(currentPage){await currentPage.screenshot({path:dir+'failure.png'}).catch(()=>{});await writeFile(dir+'failure.json',JSON.stringify({error:error.stack,reports,errors,failures},null,2)+'\n');}throw error;}
finally{await browser.close();}
