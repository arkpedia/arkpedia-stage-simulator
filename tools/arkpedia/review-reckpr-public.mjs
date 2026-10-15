// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { publicReviewDriver } from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',out='.cache/arkpedia/cn-operators/char_4196_reckpr/public-browser/';
const candidate=process.argv.includes('--candidate'),ID='char_4196_reckpr',ALLY='char_122_beagle',OTHER='char_208_melan';
const data=candidate?JSON.parse(await readFile('.cache/arkpedia/arkpedia-reckpr-candidate.json')):await(await fetch(origin+'/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name,'Record Keeper');
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},
 get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.reckpr;},
 get targets(){return ['${ALLY}','${OTHER}'].map(id=>battle.bench[id].unit);},shots:[],heals:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++){battle.step();}this.render();},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  const add=battle.addProjectile.bind(battle);battle.addProjectile=p=>{if(p.source?.defId==='${ID}')this.shots.push({key:p.data?.nativeKey,target:p.target.id,time:battle.time});return add(p);};
  battle.on('calculatedHeal',c=>{if(c.source?.defId==='${ID}')this.heals.push({target:c.target.id,time:battle.time});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / 99 DP / empty waves / wounded allies';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 wound(){for(const a of this.targets){a.base.maxHp=100000;a.markDirty();void a.s;a.hp=10000;battle.addBuff(a,{key:'qa:still',flags:{disarm:true}});}},
 until(kind){const end=battle.time+90;const pred=()=>kind==='ready'?this.owner.skill.ready:kind==='s1'?this.shots.filter(p=>p.key==='projectile_chr_reckpr_s1').length>=2:
  kind==='s2'?this.targets.some(a=>a.findBuff('reckpr:s2:'+this.owner.id)):!this.owner.skill.active;
  while(!pred()&&battle.time<end){battle.step();}if(!pred())throw Error('Missing natural '+kind);this.render();},
 playback(){const samples=[];let previous=this.owner.mem.regularFormVisual;const end=battle.time+14;
  while(samples.length<2&&battle.time<end){battle.step();renderer.render(battle,battle.dt,battle.drainEvents());const v=this.owner.mem.regularFormVisual;
   if(v!==previous&&v?.clip==='Attack'){const t=renderer.views.get(this.owner.id)?.actor.spine.state.tracks[0];samples.push({played:t?.animation.name,trackTime:t?.trackTime,playId:v.playId});}previous=v;}this.render();return samples;},
 hit(){const a=this.targets.find(a=>a.findBuff('reckpr:s2:'+this.owner.id))??this.targets[0],e=battle.spawnEnemy('enemy_1007_slime',{pos:[a.tileR,7]});battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,unblockable:true}});
  const before=a.hp;battle.dealDamage(e,a,{amount:100,type:'true',isAttack:true});this.render();return{before,after:a.hp,expected:this.controller.record.bb['attack@fixed_heal_value']};},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id);return{time:battle.time,sp:u.skill.spTotal,active:u.skill.active,activations:u.skill.activations,hud:skillHud(u.skill),
  stopped:this.controller.stopped,slots:battle.deployedSlots(),shots:this.shots,heals:this.heals,owner:{alive:u.alive,model:v?.key,track:v?.actor.spine.state.tracks[0]?.animation.name,requested:u.mem.regularFormVisual?.clip},
  targets:this.targets.map(a=>({hp:a.hp,reactive:!!a.findBuff('reckpr:s2:'+u.id)})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{
 for(const mobile of [false,true])for(const skill of [1,2])for(const dir of ['DOWN','UP']){
  const label=`${mobile?'phone':'desktop'}-s${skill}-${dir.toLowerCase()}`,ownerRow=dir==='UP'?1:4,targetRow=dir==='UP'?2:3;
  const{page,deploy,capture}=await driver.open({label,mobile,operators:[ID,ALLY,OTHER],skillId:`skchr_reckpr_${skill}`});
  await page.evaluate(()=>cnReview.setup());await deploy(ID,ownerRow,6,dir);await deploy(ALLY,targetRow,6,'LEFT');await deploy(OTHER,dir==='UP'?3:2,6,'LEFT');
  await page.evaluate(()=>{cnReview.wound();cnReview.advance(1.1);});await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
  const diagnostic=await page.evaluate(()=>({dir:cnReview.owner.dir,targets:cnReview.controller.targets().length}));assert.equal(diagnostic.dir,dir);assert.ok(diagnostic.targets>0,JSON.stringify(diagnostic));
  const samples=await page.evaluate(()=>cnReview.playback());assert.equal(samples.length,2);
  for(const p of samples){assert.equal(p.played,'Attack');assert.ok(p.trackTime>=0&&p.trackTime<.1);}assert.notEqual(samples[0].playId,samples[1].playId);
  await page.evaluate(()=>cnReview.until('ready'));const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');
  assert.equal(ready.owner.model.endsWith(dir==='UP'?'/back':'/front'),true);assert.equal(ready.slots,3);
  if(skill===2){await page.click('#skill');await page.evaluate(()=>cnReview.render());const begin=await page.evaluate(()=>cnReview.snapshot());assert.equal(begin.owner.track,'Skill_Begin');await capture('begin');}
  await page.evaluate(s=>cnReview.until(s===1?'s1':'s2'),skill);const active=await page.evaluate(()=>cnReview.snapshot());await capture('active');
  if(skill===1){const shots=active.shots.filter(p=>p.key==='projectile_chr_reckpr_s1');assert.ok(shots.length>=2);assert.notEqual(shots[0].target,shots[1].target);assert.equal(active.hud.canActivate,false);}
  else{assert.equal(active.active,true);assert.ok(active.targets.some(a=>a.reactive));const hit=await page.evaluate(()=>cnReview.hit());assert.ok(Math.abs(hit.after-hit.before+100-hit.expected)<1e-6,JSON.stringify(hit));}
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');const retired=await page.evaluate(()=>{cnReview.render();return cnReview.snapshot();});
  assert.equal(retired.stopped,true);assert.equal(retired.owner.alive,false);assert.equal(retired.slots,2);
  if(skill===2){const hit=await page.evaluate(()=>cnReview.hit());assert.ok(Math.abs(hit.after-hit.before+100-hit.expected)<1e-6,JSON.stringify(hit));await page.evaluate(()=>cnReview.advance(10));assert.equal((await page.evaluate(()=>cnReview.snapshot())).targets.some(a=>a.reactive),false);}
  assert.deepEqual(active.errors,[]);assert.equal(active.glError,0);assert.deepEqual(retired.errors,[]);await capture('retired');
  reports.push({label,ready,active,retired,samples});await page.close();console.log(label+': public deployment, original clips, natural SP/healing and cleanup passed');
 }
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}finally{await driver.close();}
