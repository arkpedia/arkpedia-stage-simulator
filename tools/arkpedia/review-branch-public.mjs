// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { publicReviewDriver } from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',out='.cache/arkpedia/cn-operators/char_4207_branch/public-browser/';
const candidate=process.argv.includes('--candidate'),ID='char_4207_branch';
const data=candidate?JSON.parse(await readFile('.cache/arkpedia/arkpedia-branch-candidate.json')):await(await fetch(origin+'/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name,'Vetochki');data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.branch;},enemy:null,hits:[],heals:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',c=>{if(c.source?.defId==='${ID}')this.hits.push({time:battle.time,amount:c.amount});});
  battle.on('calculatedHeal',c=>{if(c.source?.defId==='${ID}')this.heals.push({time:battle.time,amount:c.amount});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / 99 DP / empty waves / pinned attacker';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(){const u=this.owner,e=battle.spawnEnemy('enemy_1007_slime',{pos:[u.tileR,u.tileC]});
  Object.assign(e.base,{maxHp:1e9,atk:u.s.def+50,def:0,res:0,moveSpeed:0,bat:.5});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true}});battle._buildEnemyIndex();this.enemy=e;},
 until(kind){const end=battle.time+90;const pred=()=>kind==='ready'?this.owner.skill.ready:kind==='strike'?this.owner.mem.regularFormVisual?.clip==='Skill_2_Loop'&&this.hits.length>this.beforeCast:!this.owner.skill.active;
  while(!pred()&&battle.time<end)battle.step();if(!pred())throw Error('Missing natural '+kind);this.render();},
 playback(){const samples=[];let previous=this.owner.mem.regularFormVisual;const end=battle.time+14;
  while(samples.length<2&&battle.time<end){battle.step();renderer.render(battle,battle.dt,battle.drainEvents());const v=this.owner.mem.regularFormVisual;
   if(v!==previous&&v?.clip==='Attack'){const t=renderer.views.get(this.owner.id)?.actor.spine.state.tracks[0];samples.push({played:t?.animation.name,trackTime:t?.trackTime,playId:v.playId});}previous=v;}this.render();return samples;},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id),c=this.controller;return{time:battle.time,sp:u.skill.spTotal,active:u.skill.active,activations:u.skill.activations,
  hud:skillHud(u.skill),stopped:c.stopped,handles:c.handles.length,slots:battle.deployedSlots(),hits:this.hits,heals:this.heals,resist:battle.resistOf(u),
  owner:{alive:u.alive,hp:u.hp,maxHp:u.s.maxHp,atk:u.s.atk,def:u.s.def,model:v?.key,track:v?.actor.spine.state.tracks[0]?.animation.name,requested:u.mem.regularFormVisual?.clip},
  enemy:{attacks:this.enemy.stats.attacks,tremble:!!this.enemy.s.flags.tremble},source:{atk:c.record.stats.atk,def:c.record.stats.def,bb:c.record.bb},
  errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{
 for(const mobile of[false,true])for(const skill of[1,2])for(const dir of['DOWN','UP']){
  const label=`${mobile?'phone':'desktop'}-s${skill}-${dir.toLowerCase()}`;
  const{page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_branch_${skill}`});
  await page.evaluate(()=>cnReview.setup());await deploy(ID,dir==='UP'?2:3,6,dir);
  await page.evaluate(()=>{cnReview.target();cnReview.advance(1.1);});await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
  const samples=await page.evaluate(()=>cnReview.playback());assert.equal(samples.length,2);
  for(const p of samples){assert.equal(p.played,'Attack');assert.ok(p.trackTime>=0&&p.trackTime<.1);}assert.notEqual(samples[0].playId,samples[1].playId);
  await page.evaluate(()=>cnReview.until('ready'));const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');
  assert.equal(ready.owner.model.endsWith(dir==='UP'?'/back':'/front'),true);assert.equal(ready.hud.canActivate,true);assert.equal(ready.slots,1);assert.ok(ready.enemy.attacks>0);
  await page.evaluate(()=>{cnReview.beforeCast=cnReview.hits.length;});await page.click('#skill');await page.evaluate(()=>cnReview.render());
  const begin=await page.evaluate(()=>cnReview.snapshot());await capture('begin');assert.equal(begin.active,true);
  if(skill===1){assert.equal(begin.resist,.5);assert.equal(begin.owner.def,begin.source.def*(1+begin.source.bb.def));}
  else{assert.equal(begin.owner.track,'Skill_2_Begin');await page.evaluate(()=>cnReview.advance(.55));assert.equal((await page.evaluate(()=>cnReview.snapshot())).enemy.tremble,false);}
  if(skill===1)await page.evaluate(()=>cnReview.advance(1.2));else await page.evaluate(()=>cnReview.until('strike'));
  const active=await page.evaluate(()=>cnReview.snapshot());await capture('active');assert.equal(active.active,true);
  if(skill===2){assert.equal(active.owner.track,'Skill_2_Loop');assert.equal(active.enemy.tremble,true);assert.equal(active.owner.atk,active.source.atk*(1+active.source.bb.atk));}
  let ended;
  const early=skill===2&&dir==='DOWN';
  if(!early){await page.evaluate(()=>cnReview.until('finish'));ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');
   assert.equal(ended.active,false);assert.equal(ended.resist,0);assert.ok(ended.heals.length>0);if(skill===2)assert.equal(ended.owner.track,'Skill_2_End');}
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');const retired=await page.evaluate(()=>{cnReview.render();return cnReview.snapshot();});
  assert.equal(retired.stopped,true);assert.equal(retired.handles,0);assert.equal(retired.slots,0);assert.equal(retired.owner.alive,false);await capture('retired');
  if(early){assert.equal(retired.enemy.tremble,true);assert.equal(retired.heals.length,0);await page.evaluate(()=>cnReview.advance(6));ended=await page.evaluate(()=>cnReview.snapshot());assert.equal(ended.enemy.tremble,false);assert.equal(ended.heals.length,0);await capture('expired');}
  for(const state of[active,retired,ended]){assert.deepEqual(state.errors,[]);assert.equal(state.glError,0);}
  reports.push({label,ready,begin,active,ended,retired,samples,earlyRetreat:early});await page.close();console.log(label+': public deployment, source attacks/SP, reused skill effects and cleanup passed');
 }
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}finally{await driver.close();}
