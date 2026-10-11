// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-elemental-caster-prefabs.json' with { type: 'json' };
import { ELEMENTAL_CASTER_OPERATORS } from '../shared/arkpedia/elemental-caster-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const DIA = 'char_499_kaitou', WAR = 'char_4081_warmy';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
const component=(group,id)=>group.flatMap(r=>r.components).find(c=>c.pathId===id);
function advance(b,s){for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,elite=2,rank=10,potential=1}={}){
 const src=structuredClone(data),op=src.operators[id];assert.ok(op,`Snapshot must enable ${id}`);
 src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillRank:elite===2?rank:Math.min(rank,7),skillId:op.skills[skill].id};
 const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const u=b.deployOperator(id,2,4,'UP');assert.ok(u);u.atkCd=1000;return{b,u};
}
function enemy(b,{row=3,col=4,hp=100000,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:100000,def:0,res});e.markDirty();void e.s;e.hp=hp;
 if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u,total=1){u.skill.setSpTotal(u.skill.spCost*total);assert.equal(b.activateOperator(u.defId),true);u.atkCd=1000;}
function shot(b,u,e,time=.8){const hp=e.hp;b.forceAttack(u,[e]);u.atkCd=1000;advance(b,time);return hp-e.hp;}
function burst(b,e,el,duration=10){b.addBuff(e,{key:`${el}Burst`,duration,flags:{burstLock:true}});}

test('elemental source record retains native damage masks, exact modes/charge/BAT fields and original model bindings',()=>{
 assert.equal(evidence.frameParity,false);
 for(const[id,c]of Object.entries(ELEMENTAL_CASTER_OPERATORS)){
  assert.match(evidence.source.bundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  for(const sid of c.skillIds)assert.ok(evidence.skills[sid].length);
  for(const f of ['Front','Back'])assert.equal(evidence.officialSkeletonBindings[id][f].sha256,evidence.models[id][f].sha256);
 }
 const ep=evidence.buffTemplates.ep_damage_based_on_damage_value.eventToActions.ON_AFTER_OUTPUT_DAMAGE;
 assert.match(ep[1].$type,/ApplyElementDamageBasedOnDamageValue/);
 const active=component(evidence.characters[DIA],'6559550449378121709');
 assert.equal(active._attachPassiveBuffsOnDummy,1);assert.equal(active._buffs[0].blackboard.find(x=>x.key==='damage_type').value,4);
 const judge=evidence.buffTemplates['warmy_s_2[enhanced_check]'].eventToActions.ON_BUFF_START[0];
 assert.equal(judge._conditionNode._count,2);assert.equal(judge._succeedNodes[1]._fromBlackboardKeys,'enhanced_duration');
 assert.match(evidence.buffTemplates['warmy_s_2[switch_mode]'].eventToActions.ON_BUFF_START[1].$type,/ClearCharacterSp/);
 const bat=component(evidence.skills.skchr_warmy_2,'-458771464050377625')._buffs[0].attributes.attributeModifiers.find(x=>x.attributeType===8);
 assert.equal(bat.formulaItem,0);
 for(const id of ['char_4146_nymph','char_4198_christ','char_4164_tecno'])assert.match(evidence.deferredOperators[id].reason,/Whole kit deferred/);
 assert.ok(evidence.limitations.some(x=>x.includes('shield, overkill or HP-floor')));
});
test('both complete elemental caster skills load every rank and selected promotion talent without generic duplication',()=>{
 for(const[id,c]of Object.entries(ELEMENTAL_CASTER_OPERATORS))for(let sk=0;sk<c.skillIds.length;sk++)for(let rank=1;rank<=10;rank++){
  const{b,u}=make(id,{skill:sk,rank});assert.equal(u.skill.id,c.skillIds[sk]);assert.equal(u.skill.noSkill,false);
  assert.equal(u.def.talents.length,1);near(u.s.atk,u.base.atk);assert.equal(u.profile.rangeAoe,false);advance(b,.1);
 }
 for(const id of [DIA,WAR])for(const elite of [0,1]){const{u}=make(id,{elite,rank:4});assert.equal(u.def.talents.length,elite?1:0);}
});
test('ordinary attacks release at original animation event and use source speed10 before impact',()=>{
 for(const[id,event]of [[DIA,.6],[WAR,.4]]){
  const{b,u}=make(id),e=enemy(b,{row:4});b.forceAttack(u,[e]);u.atkCd=1000;
  advance(b,event-b.dt);near(e.hp,100000);assert.equal(b.projectiles.list.length,0);
  advance(b,b.dt*2);near(e.hp,100000);assert.equal(b.projectiles.list.length,1);
  advance(b,.3);near(100000-e.hp,u.base.atk);near(e.elem.apoptosis,0);near(e.elem.burn,0);
 }
});
test('Diamante S1 converts actual mitigated Arts output into Necrosis injury at every rank',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,u}=make(DIA,{rank}),e=enemy(b,{res:40});cast(b,u);const dmg=shot(b,u,e);
  near(dmg,u.base.atk*(1+u.skill.bb.atk)*.6);near(e.elem.apoptosis,dmg*u.skill.bb['attack@ep_damage_ratio']);
 }
});
test('Warmy S1 converts source Arts output into Burn injury, not unconditional attack-based injury',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,u}=make(WAR,{rank}),e=enemy(b,{res:50});cast(b,u);near(u.s.aspd,u.base.aspd+u.skill.bb.attack_speed);
  const dmg=shot(b,u,e,.65);near(dmg,u.base.atk*.5);near(e.elem.burn,dmg*u.skill.bb['attack@ep_damage_ratio']);
 }
});
test('elemental riders use explicitly bounded post-shield amount, ignore dodge/cancellation and do not outlive killed victims',()=>{
 for(const id of [DIA,WAR]){
  const{b,u}=make(id),e=enemy(b,{res:30});cast(b,u);b.addBuff(e,{key:'test:barrier',shield:100});
  const dmg=shot(b,u,e);near(e.elem[id===DIA?'apoptosis':'burn'],dmg*.15);
  const dodge=enemy(b,{col:5});b.addBuff(dodge,{key:'test:dodge',mods:{dodgeArts:1}});shot(b,u,dodge);
  near(dodge.hp,100000);near(dodge.elem[id===DIA?'apoptosis':'burn'],0);
  const immune=enemy(b,{col:5});b.addBuff(immune,{key:'test:invulnerable',flags:{invulnerable:true}});shot(b,u,immune);
  near(immune.hp,100000);near(immune.elem[id===DIA?'apoptosis':'burn'],0);
  const dead=enemy(b,{col:5,hp:1});shot(b,u,dead);assert.equal(dead.alive,false);near(dead.elem[id===DIA?'apoptosis':'burn'],0);
 }
});
test('temporary elemental damage observer cannot leak to unrelated nested or later attacks',()=>{
 const{b,u}=make(DIA),e=enemy(b),other=enemy(b,{col:5});cast(b,u);shot(b,u,e);near(other.elem.apoptosis,0);
 const before=e.elem.apoptosis;b.dealDamage(u,e,{amount:100,type:'arts',isAttack:true,attackId:999});near(e.elem.apoptosis,before);
 const count=b._hooks.damaged?.length??0;shot(b,u,e);assert.equal(b._hooks.damaged?.length??0,count);
});
test('Diamante same-key talent stays nonstacking across Necrosis burst targets and cleans up range/death/expiry',()=>{
 const{b,u}=make(DIA),a=enemy(b),z=enemy(b,{col:5});burst(b,a,'apoptosis');burst(b,z,'apoptosis');advance(b,.1);
 near(u.s.atk,u.base.atk*(1+u.def.talents[0].bb.atk));assert.equal(u.buffs.filter(x=>x.key==='diamante:necrosis-atk').length,1);
 b.removeBuff(a,'apoptosisBurst');advance(b,.1);assert.ok(u.findBuff('diamante:necrosis-atk'));
 z.x=10;z.y=5;b._buildEnemyIndex();advance(b,.1);near(u.s.atk,u.base.atk);
 z.x=5;z.y=3;b._buildEnemyIndex();advance(b,.1);assert.ok(u.findBuff('diamante:necrosis-atk'));
 b.kill(z);advance(b,.1);near(u.s.atk,u.base.atk);
 burst(b,a,'apoptosis',.1);advance(b,.2);near(u.s.atk,u.base.atk);
});
test('Diamante talent uses original free-target aura eligibility independently from normal attack selection',()=>{
 const{b,u}=make(DIA),e=enemy(b);burst(b,e,'apoptosis');e.hidden=true;b.addBuff(e,{key:'test:free',flags:{untargetable:true}});advance(b,.1);
 assert.ok(u.findBuff('diamante:necrosis-atk'));assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);
 b.removeBuff(e,'apoptosisBurst');advance(b,.1);near(u.s.atk,u.base.atk);
});
test('Diamante selected promotion and potential control only the conditional talent ATK',()=>{
 for(const[elite,potential]of [[1,1],[1,5],[2,1],[2,5]]){
  const{b,u}=make(DIA,{elite,potential,rank:7}),e=enemy(b);near(u.s.atk,u.base.atk);burst(b,e,'apoptosis');advance(b,.1);
  near(u.s.atk,u.base.atk*(1+u.def.talents[0].bb.atk));
 }
});
test('Diamante S1/S2 Elemental bonus uses pre-existing burst, selected scaling and ignores Arts RES',()=>{
 for(const skill of [0,1]){
  const{b,u}=make(DIA,{skill}),e=enemy(b,{res:80});burst(b,e,'apoptosis');advance(b,.1);cast(b,u);
  const atk=u.s.atk,dmg=shot(b,u,e,.8);near(dmg,atk*(.2+u.skill.bb['attack@extra_ep_damage_scale']));near(e.elem.apoptosis,0);
 }
});
test('Diamante rider-created Necrosis burst does not retroactively give that strike the pre-output Elemental bonus',()=>{
 const{b,u}=make(DIA),e=enemy(b);e.elem.apoptosis=e.gaugeMax-1;cast(b,u);let bonuses=0;
 b.on('damaged',c=>{if(c.source===u&&c.dmg?.tags?.includes('elemental-caster:bonus'))bonuses++;});
 shot(b,u,e);assert.ok(e.findBuff('apoptosisBurst'));assert.equal(bonuses,0);
 shot(b,u,e);assert.equal(bonuses,1);assert.ok(u.findBuff('diamante:necrosis-atk'));
});
test('natural Diamante S2 releases one projectile per selected target, never duplicate area damage',()=>{
 const{b,u}=make(DIA,{skill:1}),a=enemy(b),z=enemy(b,{col:5}),third=enemy(b,{row:4});cast(b,u);u.atkCd=0;advance(b,.8);
 const hits=[a,z,third].map(e=>100000-e.hp);assert.equal(hits.filter(x=>x>0).length,2);
 for(const hit of hits)if(hit>0)near(hit,u.s.atk);assert.equal(u.stats.attacks,1);
});
test('Warmy S2 consumes partial/full stored charges with source duration and two-versus-three-target selector',()=>{
 for(const[total,enhanced]of [[1,false],[1.9,false],[2,true]]){
  const{b,u}=make(WAR,{skill:1}),a=enemy(b),z=enemy(b,{col:5}),third=enemy(b,{row:4});cast(b,u,total);
  assert.equal(u.mem.warmyCharged,enhanced);assert.equal(u.skill.charges,0);near(u.skill.sp,0);
  near(u.skill.timeLeft,enhanced?u.skill.bb.enhanced_duration:u.skill.duration);
  near(u.s.interval,u.base.bat+u.skill.bb.base_attack_time);
  assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,enhanced?3:2);
  u.atkCd=0;advance(b,.65);const hits=[a,z,third].map(e=>100000-e.hp);
  assert.equal(hits.filter(x=>x>0).length,enhanced?3:2);for(const hit of hits)if(hit>0)near(hit,u.s.atk);
  assert.equal(u.stats.attacks,1);
 }
});
test('Warmy S2 source flat BAT composes independently with percentage and final BAT scalers',()=>{
 const{b,u}=make(WAR,{skill:1});b.addBuff(u,{key:'test:bat',mods:{batFlat:.3,batPct:.2,batMul:.5}});cast(b,u,2);
 near(u.s.interval,(u.base.bat+.3+u.skill.bb.base_attack_time)*1.2*.5);
 u.skill.end('test');near(u.s.interval,(u.base.bat+.3)*1.2*.5);assert.equal(u.mem.warmyCharged,false);
});
test('Warmy source two/full-charge durations, BAT and flying-capable targeting use every selected skill rank',()=>{
 for(let rank=1;rank<=10;rank++)for(const total of [1,2]){
  const{b,u}=make(WAR,{skill:1,rank});const a=enemy(b),z=enemy(b,{col:5,fly:true}),third=enemy(b,{row:4});cast(b,u,total);
  near(u.skill.timeLeft,total===2?u.skill.bb.enhanced_duration:u.skill.duration);
  near(u.s.bat,u.base.bat+u.skill.bb.base_attack_time);const targets=acquireTargets(b,u,effectiveProfile(u));
  assert.equal(targets.length,total===2?3:2);b.forceAttack(u,targets);u.atkCd=1000;advance(b,.7);
  for(const e of [a,z,third])near(e.hp,targets.includes(e)?100000-u.s.atk:100000);
 }
});
test('Warmy S2 enhanced-only Elemental rider applies against Burn burst and clears with skill end',()=>{
 for(const total of [1,2]){
  const{b,u}=make(WAR,{skill:1}),e=enemy(b,{res:80});burst(b,e,'burn');cast(b,u,total);const atk=u.s.atk;
  near(shot(b,u,e,.7),atk*(.2+(total===2?u.skill.bb['attack@ep_damage_scale']:0)));
  u.skill.end('test');const hp=e.hp;shot(b,u,e);near(hp-e.hp,u.base.atk*.2);near(e.elem.burn,0);
 }
});
test('Warmy talent reacts to foreign Burn burst using selected promotion/potential and range',()=>{
 for(const[elite,potential]of [[1,1],[1,5],[2,1],[2,5]]){
  const{b,u}=make(WAR,{elite,potential,rank:7}),e=enemy(b);let bonus=0;
  b.on('damaged',c=>{if(c.source===u&&c.dmg?.tags?.includes('elemental-caster:bonus'))bonus+=c.amount;});
  b.dealDamage(null,e,{amount:e.gaugeMax,type:'element',element:'burn',canDodge:false});
  near(bonus,u.s.atk*u.def.talents[0].bb.ep_damage_scale);
  const outside=enemy(b,{row:5,col:8});b.dealDamage(null,outside,{amount:outside.gaugeMax,type:'element',element:'burn',canDodge:false});near(bonus,u.s.atk*u.def.talents[0].bb.ep_damage_scale);
 }
});
test('Warmy passive has source NORMAL metadata and never triggers on unrelated Necrosis burst or owner retreat',()=>{
 const{b,u}=make(WAR),e=enemy(b);let count=0;
 b.on('damaged',c=>{if(c.source===u&&c.dmg?.tags?.includes('elemental-caster:bonus')){count++;assert.equal(c.dmg.isAttack,true);assert.equal(c.dmg.isSkill,false);}});
 b.dealDamage(null,e,{amount:e.gaugeMax,type:'element',element:'apoptosis',canDodge:false});assert.equal(count,0);
 const z=enemy(b,{col:5});b.dealDamage(null,z,{amount:z.gaugeMax,type:'element',element:'burn',canDodge:false});assert.equal(count,1);
 const later=enemy(b,{row:4});b.retreatOperator(WAR);b.dealDamage(null,later,{amount:later.gaugeMax,type:'element',element:'burn',canDodge:false});assert.equal(count,1);
});
test('born selected injury preserves exact primary context after withdrawal without preserving active bonus',()=>{
 for(const[id,event,el]of [[DIA,.6,'apoptosis'],[WAR,.4,'burn']]){
  const{b,u}=make(id),e=enemy(b,{row:4,res:30});cast(b,u);b.forceAttack(u,[e]);u.atkCd=1000;advance(b,event+b.dt);
  assert.equal(b.projectiles.list.length,1);b.retreatOperator(id);advance(b,.3);const dmg=100000-e.hp;
  assert.ok(dmg>0);near(e.elem[el],dmg*.15);assert.equal(u.deployed,false);
 }
});
test('skill expiry restores original attacks and removes all selected elemental skill output',()=>{
 for(const id of [DIA,WAR]){
  const{b,u}=make(id),e=enemy(b);cast(b,u);u.skill.timeLeft=.1;advance(b,.2);assert.equal(u.skill.active,false);
  const before=e.elem[id===DIA?'apoptosis':'burn'];shot(b,u,e);near(e.elem[id===DIA?'apoptosis':'burn'],before);near(u.s.atk,u.base.atk);
 }
});
