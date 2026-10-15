// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4225_tanya',out=`.cache/arkpedia/cn-operators/${ID}/public-browser/`,candidate=process.argv.includes('--candidate');
const data=candidate?JSON.parse(await readFile('.cache/arkpedia/arkpedia-tanya-candidate.json')):await(await fetch(origin+'/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name,'Crackborne');data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.tanya;},enemies:[],hits:[],attacks:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',c=>{if(c.source?.defId==='${ID}')this.hits.push({time:battle.time,amount:c.amount,type:c.type,tags:c.dmg.tags,skill:c.dmg.isSkill,attackId:c.dmg.attackId});});
  battle.on('attack',c=>{if(c.attacker?.defId==='${ID}')this.attacks.push({time:battle.time,skill:c.isSkill,targets:c.targets.length});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / 99 DP / empty waves / two pinned targets / injected HP loss';label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(){const u=this.owner;for(const dc of[0,-.35]){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[u.tileR+(u.dir==='UP'?.35:-.35),u.tileC+dc]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true}});this.enemies.push(e);}battle._buildEnemyIndex();},
 until(kind){const end=battle.time+100;const pred=()=>kind==='ready'?this.owner.skill.ready:kind==='first'?this.attacks.some(a=>a.skill):kind==='release'?this.controller.resources.stacks()===5:!this.owner.skill.active;
  while(!pred()&&battle.time<end)battle.step();if(!pred())throw Error('Missing natural '+kind);this.render();},
 hurt(){battle.dealDamage(null,this.owner,{amount:10,type:'true',canDodge:false});this.render();},
 snapshot(){const u=this.owner,c=this.controller,r=c.resources,v=renderer.views.get(u.id);return{time:battle.time,sp:u.skill.spTotal,active:u.skill.active,hud:skillHud(u.skill),activations:u.skill.activations,
  mode:c.mode,ticks:r.s1Ticks,recovered:r.s1Recovered,stacks:r.stacks(),responses:r.responses,erosion:this.enemies.map(e=>e.elem.erosion),stopped:c.stopped,handles:c.handles.length,resourceHandles:r.handles.length,slots:battle.deployedSlots(),hits:this.hits,attacks:this.attacks,
  owner:{hp:u.hp,maxHp:u.s.maxHp,baseHp:u.base.maxHp,atk:u.s.atk,def:u.s.def,burn:u.elem.burn,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor.spine.state.tracks[0]?.animation.name},errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{
 for(const mobile of[false,true])for(const skill of[1,2])for(const dir of['DOWN','UP']){
  const label=`${mobile?'phone':'desktop'}-s${skill}-${dir.toLowerCase()}`;
  const{page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_tanya_${skill}`});
  await page.evaluate(()=>cnReview.setup());await deploy(ID,3,6,dir);await page.evaluate(()=>{cnReview.advance(1.1);cnReview.target();});await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
  await page.evaluate(()=>{cnReview.until('ready');cnReview.owner.elem.burn=500;cnReview.render();});const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');assert.equal(ready.hud.canActivate,true);assert.ok(ready.attacks.length>0);assert.equal(ready.owner.model.endsWith(dir==='UP'?'/back':'/front'),true);
  await page.click('#skill');await page.evaluate(()=>cnReview.render());const begin=await page.evaluate(()=>cnReview.snapshot());await capture('begin');assert.equal(begin.owner.track,skill===1?'Skill_1_Begin':'Skill_2');assert.equal(begin.active,true);
  let release,response;
  if(skill===1){
   assert.equal(begin.mode,1);assert.equal(begin.owner.maxHp,begin.owner.baseHp*2);
   await page.evaluate(()=>cnReview.until('first'));release=await page.evaluate(()=>cnReview.snapshot());await capture('first');assert.equal(release.owner.track,'Skill_1_Loop');assert.equal(release.attacks.filter(a=>a.skill).length,1);assert.equal(release.attacks.at(-1).targets,1);
   await page.evaluate(()=>cnReview.advance(1));response=await page.evaluate(()=>cnReview.snapshot());await capture('recovery');assert.ok(response.ticks>=1);assert.ok(response.owner.burn<500);assert.equal(response.stacks,0);
  }else{
   await page.evaluate(()=>cnReview.until('release'));release=await page.evaluate(()=>cnReview.snapshot());await capture('release');assert.equal(release.stacks,5);assert.ok(Math.abs(release.owner.def-ready.owner.def*2)<1e-7);assert.equal(release.attacks.length,ready.attacks.length);
   await page.evaluate(()=>cnReview.hurt());response=await page.evaluate(()=>cnReview.snapshot());await capture('hp-response');assert.equal(response.stacks,4);assert.equal(response.responses,1);assert.equal(response.attacks.length,ready.attacks.length);assert.equal(response.hits.filter(h=>h.tags.includes('tanya:s2-response')).length,2);for(const value of response.erosion)assert.ok(Math.abs(value-response.owner.atk*.35)<1e-7);
  }
  await page.evaluate(()=>cnReview.until('finish'));const ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');assert.equal(ended.active,false);assert.equal(ended.mode,0);assert.equal(ended.owner.maxHp,ended.owner.baseHp);assert.equal(ended.stacks,skill===1?0:4);
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');const retired=await page.evaluate(()=>{cnReview.render();return cnReview.snapshot();});await capture('retired');assert.equal(retired.stopped,true);assert.equal(retired.handles,0);assert.equal(retired.resourceHandles,0);assert.equal(retired.slots,0);assert.equal(retired.stacks,0);
  await page.evaluate(()=>cnReview.advance(3));const after=await page.evaluate(()=>cnReview.snapshot());assert.equal(after.attacks.length,retired.attacks.length);assert.equal(after.hits.length,retired.hits.length);
  for(const s of[ready,begin,release,response,ended,retired,after]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
  reports.push({label,ready,begin,release,response,ended,retired,after});await page.close();console.log(label+': natural SP, source HP/recovery/DEF/erosion, original tracks, single targets, public controls and cleanup passed');
 }
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}finally{await driver.close();}
