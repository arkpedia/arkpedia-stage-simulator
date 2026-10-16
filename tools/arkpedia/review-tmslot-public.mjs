// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4236_tmslot',SKILLS=['skcom_atk_up[3]','skchr_tmslot_2'],out=`.cache/arkpedia/cn-operators/${ID}/public-browser/`,candidate=process.argv.includes('--candidate');
const data=candidate?JSON.parse(await readFile('.cache/arkpedia/arkpedia-tmslot-candidate.json')):await(await fetch(origin+'/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name,'Timeslot');data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.tmslot;},enemies:[],hits:[],attacks:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',c=>{if(c.source?.defId==='${ID}')this.hits.push({time:battle.time,amount:c.amount,type:c.type,tags:c.dmg.tags,skill:c.dmg.isSkill,attackId:c.dmg.attackId});});
  battle.on('attack',c=>{if(c.attacker?.defId==='${ID}')this.attacks.push({time:battle.time,skill:c.isSkill,targets:c.targets.length});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal ranged tile / 99 DP / empty waves / pinned targets / optional range relocation';label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(){const u=this.owner;for(const dc of[0,.35]){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[3,5+dc]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);}battle._buildEnemyIndex();},
 until(kind){const end=battle.time+100;const pred=()=>kind==='ready'?this.owner.skill.ready:kind==='first'?this.attacks.some(a=>a.skill):kind==='locked'?this.controller.slots.every(s=>s.pulses>0):kind==='overload'?this.controller.mode===3:kind==='loop'?this.owner.mem.regularFormVisual?.clip==='Skill_2_Overload_Loop':!this.owner.skill.active;
  while(!pred()&&battle.time<end)battle.step();if(!pred())throw Error('Missing natural '+kind);this.render();},
 forceRangeExit(){this.enemies[0].x=7;this.enemies[0].y=3;battle._buildEnemyIndex();this.advance(.2);},
 snapshot(){const u=this.owner,c=this.controller,v=renderer.views.get(u.id);return{time:battle.time,sp:u.skill.spTotal,active:u.skill.active,left:u.skill.timeLeft,hud:skillHud(u.skill),activations:u.skill.activations,
  mode:c.mode,overload:c.hasOverload(),started:c.startedAt,overloadedAt:c.overloadedAt,marks:c.marks.size,slots:c.slots.map(s=>({target:s.target?.id??null,scale:s.scale,pulses:s.pulses})),stopped:c.stopped,handles:c.handles.length,deployed:battle.deployedSlots(),hits:this.hits,attacks:this.attacks,
  owner:{hp:u.hp,maxHp:u.s.maxHp,atk:u.s.atk,baseAtk:c.record.stats.atk,talentAtk:c.talent?.atk??0,aspd:u.s.aspd,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor.spine.state.tracks[0]?.animation.name},errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{
 for(const mobile of[false,true])for(const skill of[1,2])for(const dir of['DOWN','UP'])for(const forcing of(skill===1?['normal']:['natural','forced'])){
  const label=`${mobile?'phone':'desktop'}-s${skill}-${dir.toLowerCase()}-${forcing}`;
  const{page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:SKILLS[skill-1]});
  await page.evaluate(()=>cnReview.setup());await deploy(ID,dir==='UP'?1:4,5,dir);await page.evaluate(()=>{cnReview.advance(1.1);cnReview.target();});await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
  await page.evaluate(()=>cnReview.until('ready'));const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');assert.equal(ready.hud.canActivate,true);assert.ok(ready.attacks.length>0);assert.equal(ready.owner.model.endsWith(dir==='UP'?'/back':'/front'),true);
  await page.click('#skill');await page.evaluate(()=>cnReview.render());const begin=await page.evaluate(()=>cnReview.snapshot());await capture('activated');assert.equal(begin.active,true);assert.equal(begin.owner.track,'Idle');assert.equal(begin.mode,skill===1?1:2);
  const bb=Object.fromEntries(data.operators[ID].skills[skill-1].levels.at(-1).blackboard.map(({key,value})=>[key,value]));
  if(skill===1)assert.ok(Math.abs(begin.owner.atk-begin.owner.baseAtk*(1+begin.owner.talentAtk+bb.atk))<1e-7);else assert.equal(begin.owner.atk,ready.owner.atk);
  await page.evaluate(()=>cnReview.until('first'));const first=await page.evaluate(()=>cnReview.snapshot());await capture('first');assert.equal(first.owner.track,skill===1?'Attack':'Skill_2');assert.equal(first.attacks.filter(a=>a.skill).length,1);assert.equal(first.attacks.at(-1).targets,1);
  let locked=first,overload=first,loop=first;
  if(skill===2){await page.evaluate(()=>cnReview.until('locked'));locked=await page.evaluate(()=>cnReview.snapshot());await capture('locked');assert.equal(locked.slots[0].target,locked.slots[1].target);assert.equal(locked.marks,1);
   if(forcing==='forced')await page.evaluate(()=>cnReview.forceRangeExit());else await page.evaluate(()=>cnReview.until('overload'));
   overload=await page.evaluate(()=>cnReview.snapshot());await capture('overload-begin');assert.equal(overload.mode,3);assert.equal(overload.hud.state,'overloaded');assert.equal(overload.owner.track,'Skill_2_Overload_Begin');assert.ok(overload.left<=20);assert.ok(Math.abs(overload.owner.atk-overload.owner.baseAtk*(1+overload.owner.talentAtk+bb.atk))<1e-7);assert.equal(overload.owner.aspd,100+bb.attack_speed);
   if(forcing==='forced')assert.ok(overload.overloadedAt-overload.started<5);else assert.ok(Math.abs(overload.overloadedAt-overload.started-20)<.04);
   await page.evaluate(()=>cnReview.until('loop'));await page.evaluate(()=>cnReview.advance(1));loop=await page.evaluate(()=>cnReview.snapshot());await capture('overload-loop');assert.equal(loop.owner.track,'Skill_2_Overload_Loop');assert.equal(loop.attacks.length,overload.attacks.length);assert.ok(loop.slots[0].pulses>overload.slots[0].pulses);
  }else{await page.evaluate(()=>cnReview.advance(2));loop=await page.evaluate(()=>cnReview.snapshot());await capture('drone');assert.ok(loop.hits.some(h=>h.skill&&h.tags.includes('tmslot:Funnel')));}
  await page.evaluate(()=>cnReview.until('finish'));const ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');assert.equal(ended.active,false);assert.equal(ended.mode,0);assert.equal(ended.marks,0);assert.ok(ended.slots.every(s=>s.target===null));assert.equal(ended.owner.atk,ready.owner.atk);
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');const retired=await page.evaluate(()=>{cnReview.render();return cnReview.snapshot();});await capture('retired');assert.equal(retired.stopped,true);assert.equal(retired.handles,0);assert.equal(retired.deployed,0);assert.equal(retired.marks,0);
  await page.evaluate(()=>cnReview.advance(3));const after=await page.evaluate(()=>cnReview.snapshot());assert.equal(after.attacks.length,retired.attacks.length);assert.equal(after.hits.filter(h=>h.tags.some(t=>t.startsWith('tmslot:S2Funnel'))).length,retired.hits.filter(h=>h.tags.some(t=>t.startsWith('tmslot:S2Funnel'))).length);
  for(const s of[ready,begin,first,locked,overload,loop,ended,retired,after]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
  assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,forcing,ready,begin,first,locked,overload,loop,ended,retired,after});await page.close();console.log(label+': legal ranged deployment, natural SP, original tracks, owner/drone receipts, source overload and cleanup passed');
 }
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',sourceOrigin:driver.sourceOrigin,fixtureOrigin:driver.fixtureOrigin,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}finally{await driver.close();}
