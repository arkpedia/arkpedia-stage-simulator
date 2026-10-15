// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',out='.cache/arkpedia/cn-operators/char_4166_varkis/public-browser/';
const candidate=process.argv.includes('--candidate'),ID='char_4166_varkis';
const data=candidate?JSON.parse(await readFile('.cache/arkpedia/arkpedia-varkis-candidate.json')):await(await fetch(origin+'/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name,'Varkáris');data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.varkis;},enemy:null,hits:[],heals:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',c=>{if(c.source?.defId==='${ID}')this.hits.push({time:battle.time,amount:c.amount,skill:c.dmg.isSkill,attackId:c.dmg.attackId});});
  battle.on('calculatedHeal',c=>{if(c.source?.defId==='${ID}')this.heals.push({time:battle.time,amount:c.amount});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / 99 DP / empty waves / pinned attacker';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(){const u=this.owner,e=battle.spawnEnemy('enemy_1007_slime',{pos:[u.tileR,u.tileC]});
  Object.assign(e.base,{maxHp:1e9,atk:u.s.def+1,def:0,res:0,moveSpeed:0,bat:.5});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true}});battle._buildEnemyIndex();this.enemy=e;},
 until(kind){const end=battle.time+90;const pred=()=>kind==='ready'?this.owner.skill.ready:kind==='burst'?this.controller.phase?.s1&&this.controller.phase.index===0:kind==='first'?this.controller.phase?.s1&&this.controller.phase.index===1:kind==='third'?this.hits.filter(x=>x.skill).length>=3:kind==='strike'?this.controller.resources.mode===1&&this.hits.some(x=>x.skill):!this.owner.skill.active;
  while(!pred()&&battle.time<end){battle.step();if(!this.owner.alive)throw Error('Fixture owner died waiting for '+kind);}if(!pred())throw Error('Missing natural '+kind);this.render();},
 playback(){const samples=[];let previous=this.owner.mem.regularFormVisual;const end=battle.time+14;
  while(samples.length<2&&battle.time<end){battle.step();renderer.render(battle,battle.dt,battle.drainEvents());const v=this.owner.mem.regularFormVisual;
   if(v!==previous&&['Attack','Attack_Down'].includes(v?.clip)){const t=renderer.views.get(this.owner.id)?.actor.spine.state.tracks[0];samples.push({played:t?.animation.name,trackTime:t?.trackTime,playId:v.playId});}previous=v;}this.render();return samples;},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id),c=this.controller;return{time:battle.time,sp:u.skill.spTotal,active:u.skill.active,activations:u.skill.activations,attacks:u.stats.attacks,
  hud:skillHud(u.skill),stopped:c.stopped,handles:c.handles.length,resourceHandles:c.resources.handles.length,mode:c.resources.mode,barrier:u.findBuff(c.resources.key)?.shield??0,slots:battle.deployedSlots(),hits:this.hits,heals:this.heals,
  owner:{alive:u.alive,hp:u.hp,maxHp:u.s.maxHp,atk:u.s.atk,def:u.s.def,model:v?.key,track:v?.actor.spine.state.tracks[0]?.animation.name,requested:u.mem.regularFormVisual?.clip},
  enemy:{attacks:this.enemy.stats.attacks},source:{atk:c.record.stats.atk,def:c.record.stats.def,bb:c.record.bb},
  errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{
 for(const mobile of[false,true])for(const skill of[1,2])for(const dir of['DOWN','UP']){
  const label=`${mobile?'phone':'desktop'}-s${skill}-${dir.toLowerCase()}`;
  const{page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_varkis_${skill}`});
  await page.evaluate(()=>cnReview.setup());await deploy(ID,dir==='UP'?2:3,6,dir);
  await page.evaluate(()=>{cnReview.target();cnReview.advance(1.1);});await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
  const samples=await page.evaluate(()=>cnReview.playback());assert.equal(samples.length,2);
  for(const p of samples){assert.ok(['Attack','Attack_Down'].includes(p.played));assert.ok(p.trackTime>=0&&p.trackTime<.1);}assert.notEqual(samples[0].playId,samples[1].playId);
  let ready,begin,active,ended;
  if(skill===1){
   await page.evaluate(()=>cnReview.until('burst'));ready=await page.evaluate(()=>cnReview.snapshot());await capture('burst');
   assert.equal(ready.owner.track,'Skill');assert.equal(ready.hud.canActivate,false);assert.equal(ready.hud.text,'Skill active · Three-strike burst');const count=ready.hits.filter(h=>h.skill).length;
   await page.evaluate(()=>cnReview.until('first'));begin=await page.evaluate(()=>cnReview.snapshot());await capture('first');assert.equal(begin.active,true);
   await page.evaluate(()=>cnReview.until('third'));active=await page.evaluate(()=>cnReview.snapshot());await capture('third');
   const hits=active.hits.filter(h=>h.skill).slice(count);assert.equal(hits.length,3);assert.equal(new Set(hits.map(h=>h.attackId)).size,1);assert.equal(active.active,false);
   assert.ok(hits[2].time>hits[0].time);assert.equal(active.attacks-ready.attacks,1);ended=active;
  }else{
   await page.evaluate(()=>cnReview.until('ready'));ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');assert.equal(ready.hud.canActivate,true);
   await page.click('#skill');await page.evaluate(()=>cnReview.render());begin=await page.evaluate(()=>cnReview.snapshot());await capture('begin');
   assert.equal(begin.owner.track,'Skill_2_Begin');assert.equal(begin.mode,0);
   await page.evaluate(()=>cnReview.until('strike'));active=await page.evaluate(()=>cnReview.snapshot());await capture('active');assert.equal(active.owner.track,'Skill_2_Loop');assert.equal(active.mode,1);assert.ok(active.heals.length>0);
   await page.evaluate(()=>cnReview.until('finish'));ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');
   assert.equal(ended.active,false);assert.equal(ended.mode,0);assert.equal(ended.owner.track,'Skill_2_End');assert.ok(ended.barrier>0);
   await page.evaluate(()=>cnReview.advance(1.1));const decayed=await page.evaluate(()=>cnReview.snapshot());assert.ok(decayed.barrier<ended.barrier);
  }
  assert.equal(ready.owner.model.endsWith(dir==='UP'?'/back':'/front'),true);assert.equal(ready.slots,1);assert.ok(ready.enemy.attacks>0);
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');const retired=await page.evaluate(()=>{cnReview.render();return cnReview.snapshot();});await capture('retired');
  assert.equal(retired.stopped,true);assert.equal(retired.handles,0);assert.equal(retired.resourceHandles,0);assert.equal(retired.slots,0);assert.equal(retired.barrier,0);
  const old=retired.hits.length,heals=retired.heals.length;await page.evaluate(()=>cnReview.advance(2));const after=await page.evaluate(()=>cnReview.snapshot());
  assert.equal(after.hits.length,old);assert.equal(after.heals.length,heals);
  for(const state of[ready,begin,active,ended,retired,after]){assert.deepEqual(state.errors,[]);assert.equal(state.glError,0);}
  reports.push({label,ready,begin,active,ended,retired,samples});await page.close();console.log(label+': natural source attacks/SP, three-event S1 or S2 heal/barrier, public controls and cleanup passed');
 }
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}finally{await driver.close();}
