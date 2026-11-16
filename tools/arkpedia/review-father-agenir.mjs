// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled browser fixture on the default compiled stage: the compiled Father
// Agenir record, an explicit tagged SP receiver and an explicit aura marker.
// It does not exercise the native Blood Debt controller or an original stage.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createPublicReviewServer} from './public-review-server.mjs';
import {withCompiledEnemyRuntime} from '../../shared/arkpedia/enemy-runtime-compiler.js';
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3185',executablePath=process.env.ARKPEDIA_REVIEW_CHROME;
if(!executablePath)throw Error('Set ARKPEDIA_REVIEW_CHROME and start the requested local preview');
const out=resolve(process.env.ARKPEDIA_REVIEW_OUT??'.cache/arkpedia/father-agenir-review');await mkdir(out,{recursive:true});
const root=new URL('../../',import.meta.url),json=async p=>JSON.parse(await readFile(new URL(p,root)));
const id='enemy_1284_sgprst',records=(await json('data/arkpedia-enemy-records.json')).enemies[id].levels;
const app=await readFile(new URL('public/arkpedia/app.js',root),'utf8'),data=await(await fetch(origin+'/data/arkpedia-mvp.json')).json();
const fixture=await createPublicReviewServer({origin,app,data,hook:'\n;window.agenirReviewData=data;\n'});
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const results=[],version=await browser.version();
try{
 for(const mobile of [false,true])for(const level of [0,1]){
  const page=await browser.newPage(),pageErrors=[],requests=[];page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('request',r=>{const u=new URL(r.url());if(u.origin===fixture.origin)requests.push(u.pathname);});
  await page.setViewport(mobile?{width:844,height:390,isMobile:true,hasTouch:true}:{width:1440,height:900});
  await page.goto(fixture.origin+'/arkpedia/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#start:not(:disabled)',{timeout:60000});
  await page.evaluate(async(id,record)=>{
   const {StandardBattle}=await import('/sim/arkpedia.js'),original=StandardBattle.prototype.setViewport;
   StandardBattle.prototype.setViewport=function(...args){window.reviewBattle=this;return original.apply(this,args)};
   const {StageRenderer}=await import('/arkpedia/renderer.js'),preload=StageRenderer.prototype.preload;
   StageRenderer.prototype.preload=function(...args){window.reviewRenderer=this;return preload.apply(this,args)};
   Element.prototype.requestFullscreen=async()=>{};
   agenirReviewData.enemies={...agenirReviewData.enemies,[id]:record};
  },id,withCompiledEnemyRuntime(records[level]));
  await page.click('#start');await page.waitForFunction(()=>window.reviewBattle&&window.reviewRenderer,{timeout:60000});
  await page.waitForFunction(key=>window.reviewRenderer.preloaded.has(key),{timeout:60000,polling:100},`enemy/${id}/default/default`);
  const before=await page.evaluate(()=>reviewBattle.enemyRuntime.stats());
  const result=await page.evaluate(async id=>{
   const b=reviewBattle,{registerDeviceSp}=await import('/sim/content/arkpedia-device-sp.js');b.life=1e6;
   const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const clip=e=>reviewRenderer.views.get(e.id)?.actor.spine.state?.getCurrent(0)?.animation.name??null;
   const run=seconds=>{for(let i=0,n=Math.round(seconds/b.dt);i<n;i++)b.step();};
   const until=(done,limit)=>{for(let i=0,n=Math.round(limit/b.dt);i<n&&!done();i++)b.step();return done();};
   // Explicit receiver and target bodies; the stage's own waves are not part of this fixture.
   const state={sp:0,pulses:[]},receiver=b.spawnDevice('review:SP-receiver',4,6,{side:'enemy'});receiver.tags.add('vgctrl');
   registerDeviceSp(b,receiver,{get:()=>state.sp,add:n=>{const prior=state.sp;state.sp=Math.min(500,state.sp+n);state.pulses.push(b.time);return state.sp-prior;}});
   // A real benched operator on a high tile is the target: it does not block the stage's own waves.
   b.addDp('arkpedia',99);const benched=Object.keys(b.bench).find(k=>{try{return !b._placementError(k,1,2,{});}catch{return false;}});
   const target=b.deployOperator(benched,1,2,'RIGHT'),packets=[];target.base.maxHp=1e7;target.markDirty();target.hp=target.s.maxHp;const baseDef=target.s.def;
   const e=b.spawnEnemy(id,{pos:[3,6]});b.addBuff(e,{key:'hold',flags:{noMove:true}});
   b.on('damaged',c=>{if(c.target===target&&c.source?.defId===id)packets.push({source:c.source.id,type:c.dmg.type,time:b.time});});
   const out={target:{id:benched,kind:target.kind},record:{hp:e.s.maxHp,atk:e.s.atk},ammo:[e.mem.enemyAmmo.current],linked:!!receiver.findBuff('enemy_sgprsr_modify_vg')};
   run(1.1);out.firstPulse=state.sp;run(5);out.outOfRange={hits:packets.length,sp:state.sp,mode:e.mem.projectileModeIndex,marker:!!e.findBuff('enemy_sgprst_eff1')};
   await frame();out.model=reviewRenderer.views.get(e.id)?.key;out.actor=reviewRenderer.views.get(e.id)?.actor.constructor.name;
   const aura=b.addBuff(e,{key:'vgctrl_s[aura]'});run(.55);out.global={mode:e.mem.projectileModeIndex,range:e.profile.globalRange,marker:!!e.findBuff('enemy_sgprst_eff2'),closed:!!e.findBuff('enemy_sgprst_eff1')};
   out.cast=until(()=>e.atkStandUntil>b.time||b.projectiles.list.length>0,6);await frame();out.skillClip=clip(e);
   out.globalHit=until(()=>packets.length>0,8);out.afterGlobal={stacks:target.findBuff('enemy_sgprst_reduce_def')?.stacks??0,defFlat:target.findBuff('enemy_sgprst_reduce_def')?.mods?.defFlat??null,def:target.s.def,expectedDef:Math.max(0,baseDef-300),ammo:e.mem.enemyAmmo.current,type:packets[0]?.type};
   b.removeBuff(e,aura);run(.55);out.returned={mode:e.mem.projectileModeIndex,range:e.profile.globalRange,marker:!!e.findBuff('enemy_sgprst_eff1')};
   // A second body next to the target exercises the ordinary 1.9 radius and Attack clip.
   const near=b.spawnEnemy(id,{pos:[2,3]});b.addBuff(near,{key:'hold',flags:{noMove:true}});const count=packets.length;
   out.nearCast=until(()=>near.atkStandUntil>b.time||b.projectiles.list.some(p=>p.source===near),8);await frame();out.attackClip=clip(near);
   out.nearHit=until(()=>packets.some((p,i)=>i>=count&&p.source===near.id),8);out.afterNear={stacks:target.findBuff('enemy_sgprst_reduce_def')?.stacks??0,ammo:near.mem.enemyAmmo.current};
   const sp=state.sp;b.kill(e);b.kill(near);out.killed=b.stageOutcomes?.counters.killed??0;out.unlinked=!receiver.findBuff('enemy_sgprsr_modify_vg');run(3);out.spAfterDeath=state.sp-sp;
   out.pulseClock=state.pulses.slice(0,5).map(t=>Math.round(t*1000)/1000);out.errors=[...b.errors];return out;
  },id);
  const after=await page.evaluate(()=>reviewBattle.enemyRuntime.stats());
  await page.screenshot({path:resolve(out,`${mobile?'touch':'desktop'}-level-${level}.png`)});
  const stats=records[level].stats;
  try{
  assert.deepEqual(result.record,{hp:stats.maxHp,atk:stats.atk});assert.deepEqual(result.ammo,[10]);assert.equal(result.linked,true);assert.equal(result.firstPulse,2);
  assert.deepEqual(result.outOfRange,{hits:0,sp:12,mode:0,marker:true});assert.equal(result.model,`enemy/${id}/default/default`);assert.equal(result.actor,'BattleActor');
  assert.deepEqual(result.global,{mode:1,range:true,marker:true,closed:false});assert.equal(result.cast,true);assert.equal(result.skillClip,'Skill');assert.equal(result.globalHit,true);
  assert.deepEqual({...result.afterGlobal,def:undefined,expectedDef:undefined},{stacks:1,defFlat:-300,def:undefined,expectedDef:undefined,ammo:9,type:'phys'});assert.equal(result.afterGlobal.def,result.afterGlobal.expectedDef);assert.deepEqual(result.returned,{mode:0,range:false,marker:true});
  assert.equal(result.nearCast,true);assert.equal(result.attackClip,'Attack');assert.equal(result.nearHit,true);assert.deepEqual(result.afterNear,{stacks:2,ammo:9});
  assert.equal(result.killed,2);assert.equal(result.unlinked,true);assert.equal(result.spAfterDeath,0);assert.deepEqual(result.errors,[]);assert.deepEqual(pageErrors,[]);
  for(const key of ['arkpedia-enemy-sp-link','arkpedia-enemy-programmed-projectiles','arkpedia-stage-outcomes'])assert.ok(after.loaded.includes(key),key);
  assert.equal(after.pending,0);assert.ok(!requests.some(p=>/enemy-runtime-compiler|behavior-native-compiler|native-buff-programs|enemy-features|enemy-native-abilities/.test(p)));
  }catch(error){console.error(JSON.stringify(result));throw error;}
  results.push({viewport:mobile?'844x390 touch':'1440x900 desktop',level,before,after,result,pageErrors,sourceCatalogueRequests:0});await page.close();
 }
}finally{await browser.close();await fixture.close();}
await writeFile(resolve(out,'review.json'),JSON.stringify({scope:'Controlled Father Agenir fixture on the default compiled stage geometry with an explicit tagged SP receiver, explicit aura marker and explicit target body; no native Blood Debt controller, original-stage clear, effects/audio or frame/pixel parity.',browser:version,results},null,1)+'\n');
console.log(`Father Agenir browser fixture: ${results.length} runs passed`);
