// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-caster-second-prefabs.json' with { type: 'json' };
import { CASTER_SECOND_OPERATORS } from '../shared/arkpedia/caster-second-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile } from '../server/sim/ai.js';
const CAR='char_426_billro', PAS='char_472_pasngr';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
const rows=sec=>sec.flatMap(x=>x.components);
const source=(sec,id)=>rows(sec).find(x=>x.pathId===id);
function advance(b,seconds){for(let n=0;n<Math.round(seconds/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,elite=2,rank=10,potential=1,others=[]}={}){
 const src=structuredClone(data),op=src.operators[id];assert.ok(op,`Snapshot must enable ${id}`);
 src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 const build=(who,opts={})=>{const phase=Math.min(elite,src.operators[who].phases.length-1);return {...defaultBuild(src.operators[who]),elite:phase,level:src.operators[who].phases[phase].maxLevel,potential,skillRank:phase===2?rank:Math.min(rank,7),...opts};};
 const b=new StandardBattle(src,{operators:[build(id,{skillId:op.skills[skill].id}),...others.map(w=>build(w))]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(who=id,row=2,col=4,dir='UP')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,row,col,dir);assert.ok(u,`${who} at${row},${col}`);u.atkCd=1000;return u;};
 return {b,deploy};
}
function enemy(b,{row=3,col=4,hp=100000,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:100000,res,def:0});e.markDirty();void e.s;e.hp=hp;
 if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u,{charged=false}={}){u.skill.setSpTotal(u.skill.spCost*(charged?2:1));assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
function strike(b,u,e,t=.7){const hp=e.hp;b.forceAttack(u,[e]);u.atkCd=1000;advance(b,t);return hp-e.hp;}

test('source record retains actual charge judge, native formula buckets, exact aliases, controller cadence and whole-kit deferrals',()=>{
 assert.equal(evidence.frameParity,false);
 for(const[id,c]of Object.entries(CASTER_SECOND_OPERATORS)){
  assert.match(evidence.source.bundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  for(const sid of c.skillIds)assert.ok(evidence.skills[sid].length);
  for(const f of ['Front','Back'])assert.match(evidence.models[id][f].sha256,/^[a-f0-9]{64}$/);
 }
 const judge=evidence.buffTemplates.billro_talent_enhance_judge.eventToActions.ON_BUFF_START;
 assert.equal(judge[0]._conditionNode._count,2);assert.match(judge[1].$type,/ClearCharacterSp/);
 assert.equal(evidence.buffTemplates['billro_s_3[atk]'].eventToActions.ON_BUFF_TRIGGER[0]._endTime,1);
 assert.equal(source(evidence.skills.skchr_billro_3,'-4192384490796110645')._buffs[0].triggerInterval,1);
 assert.equal(source(evidence.projectiles.projectile_chr_pasngr_s3,'865416144272431549')._waitFirstPeriod,1);
 assert.equal(source(evidence.projectiles.projectile_chr_pasngr_s3,'1635711118962334141')._delayTime,4);
 const aliases=evidence.animatorAliases[PAS].animations;assert.equal(aliases.find(x=>x.animKey==='Skill_3').animName,'Skill3');
 for(const binding of evidence.officialSkeletonBindings){
  const face=binding.facing==='front'?'Front':'Back';
  assert.equal(binding.exactModelSource,true);assert.equal(binding.sha256,evidence.models[binding.id][face].sha256);
 }
 for(const id of ['char_377_gdglow','char_4080_lin','char_180_amgoat'])assert.ok(evidence.deferredOperators[id].reason.includes('Whole kit deferred'));
});
test('complete selected source kits load every skill rank and promotion talent set',()=>{
 for(const[id,c]of Object.entries(CASTER_SECOND_OPERATORS))for(let sk=0;sk<c.skillIds.length;sk++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill:sk,rank}),u=deploy();assert.equal(u.skill.id,c.skillIds[sk]);assert.equal(u.skill.noSkill,false);
  assert.equal(u.def.talents.length,data.operators[id].talents.length);assert.equal(u.profile.rangeAoe,false);advance(b,.1);
 }
 for(const id of [CAR,PAS])for(const elite of [0,1]){const{deploy}=make(id,{elite,rank:4});const u=deploy();assert.equal(u.def.talents.length,elite===0?0:1);}
});
test('Carnelian idle is disarmed with original Phalanx defenses, and begins one ordinary area release across all victims',()=>{
 const{b,deploy}=make(CAR),u=deploy(),a=enemy(b),z=enemy(b,{row:3,col:5}),out=enemy(b,{row:5,col:8});
 near(u.s.def,u.base.def*3);near(u.s.res,u.base.res+20);u.atkCd=0;advance(b,1);near(a.hp,100000);assert.equal(u.stats.attacks,0);
 cast(b,u);near(u.s.def,u.base.def*(1+u.skill.bb.def));near(u.s.res,u.base.res);u.atkCd=0;advance(b,.5);
 near(100000-a.hp,u.s.atk);near(100000-z.hp,u.s.atk);near(out.hp,100000);assert.equal(u.stats.attacks,1);assert.equal(b.projectiles.list.length,0);
 u.skill.end('test');near(u.s.def,u.base.def*3);near(u.s.res,u.base.res+20);
});
test('Carnelian consumes all SP including a partial second charge and only a full second charge enhances the cast',()=>{
 for(const [total,charged]of [[1,false],[1.9,false],[2,true]]){
  const{b,deploy}=make(CAR),u=deploy();u.hp=1;u.skill.setSpTotal(u.skill.spCost*total);assert.equal(b.activateOperator(CAR),true);
  assert.equal(u.mem.carnelianCharged,charged);assert.equal(u.skill.charges,0);near(u.skill.sp,0);
  near(u.hp,Math.min(u.s.maxHp,1+u.s.maxHp*(charged?.8:.4)));near(u.s.res,u.base.res+(charged?20:0));
 }
});
test('Carnelian normal and enhanced source max-HP recovery use promotion and potential instead of applying both talents',()=>{
 for(const [elite,potential,ratio]of [[1,1,.3],[1,5,.35],[2,1,.4],[2,5,.45]])for(const charged of [false,true]){
  const{b,deploy}=make(CAR,{elite,potential,rank:7}),u=deploy();u.hp=1;cast(b,u,{charged});near(u.hp,1+u.s.maxHp*ratio*(charged?2:1));
 }
});
test('Carnelian SP talent starts beyond one charge, pauses during skill, and resumes after skill end without giving a deploy-time bonus',()=>{
 const{b,deploy}=make(CAR),u=deploy();advance(b,1.2);near(u.skill.spTotal,u.skill.initSp+1.2);
 u.skill.setSpTotal(u.skill.spCost);advance(b,1.2);near(u.s.spRecovery,1.6);assert.ok(u.skill.spTotal>u.skill.spCost+1.65);
 assert.equal(b.activateOperator(CAR),true);const sp=u.skill.spTotal;advance(b,1.2);near(u.skill.spTotal,sp);near(u.s.spRecovery,1);
 u.skill.end('test');advance(b,.3);near(u.s.spRecovery,1);
});
test('Carnelian S2 native flat BAT combines with percentage/final BAT and charged Bind replaces Slow',()=>{
 for(const charged of [false,true])for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(CAR,{skill:1,rank}),u=deploy(),e=enemy(b);b.addBuff(u,{key:'test:bat',mods:{batPct:.25,batMul:.8}});cast(b,u,{charged});
  near(u.s.interval,(u.base.bat+u.skill.bb.base_attack_time)*1.25*.8*100/u.s.aspd);
  near(u.s.atk,u.base.atk*(charged?1+u.skill.bb.atk:1));strike(b,u,e,.4);
  assert.equal(!!e.s.flags.bind,charged);assert.equal(!!e.findBuff('sluggish'),!charged);
 }
});
test('Carnelian S3 source one-second inversed ramp reaches its maximum one second before expiry and resets',()=>{
 const{b,deploy}=make(CAR,{skill:2}),u=deploy();cast(b,u,{charged:true});near(u.s.atk,u.base.atk);
 advance(b,10.1);near(u.s.atk,u.base.atk*(1+u.skill.bb.atk*.5));advance(b,10);near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));
 advance(b,1.1);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);
});
test('Carnelian enhanced S3 owner-only stacks cap at five, multiply post mitigation, clear on range exit and skill finish',()=>{
 const{b,deploy}=make(CAR,{skill:2}),u=deploy(),a=enemy(b,{res:50});cast(b,u,{charged:true});
 for(let i=1;i<=6;i++){const atk=u.s.atk,hp=a.hp;b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.4);const actualAtk=u.s.atk;near(hp-a.hp,actualAtk*.5*(1+.2*Math.min(5,i)));assert.ok(actualAtk>=atk);}
 const mark=`carnelian:stack:${u.id}`;assert.equal(a.findBuff(mark).data.count,5);
 const hp=a.hp;b.dealDamage(null,a,{amount:100,type:'true'});near(hp-a.hp,100);
 a.x=8;a.y=5;b._buildEnemyIndex();advance(b,.3);assert.equal(a.findBuff(mark),null);
 a.x=4;a.y=3;b._buildEnemyIndex();advance(b,.3);strike(b,u,a,.4);assert.equal(a.findBuff(mark).data.count,1);
 u.skill.end('test');assert.equal(a.findBuff(mark),null);
});
test('Carnelian regular source attack can be interrupted during windup and does not recreate range marks after retreat',()=>{
 const{b,deploy}=make(CAR,{skill:2}),u=deploy(),e=enemy(b);cast(b,u,{charged:true});b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.1);
 b.applyStatus(u,'stun',{duration:.1,source:e});advance(b,.5);near(e.hp,100000);assert.equal(e.findBuff(`carnelian:stack:${u.id}`),null);
 b.retreatOperator(CAR);advance(b,.3);assert.equal(e.findBuff(`carnelian:mark:${u.id}`),null);
});
test('Passenger ordinary speed15 chain waits for impact, caps by promotion, excludes repeats and respects jump radius',()=>{
 for(const elite of [0,1,2]){
  const{b,deploy}=make(PAS,{elite,rank:4}),u=deploy();u.skill.rule='NEVER';const es=[enemy(b),enemy(b,{row:3,col:5}),enemy(b,{row:3,col:6}),enemy(b,{row:3,col:7}),enemy(b,{row:3,col:8})];
  b.forceAttack(u,[es[0]]);u.atkCd=1000;advance(b,.467);near(es[0].hp,100000);assert.equal(u.mem.passengerProjectiles.size,1);
  advance(b,.2);const cap=elite===2?4:3,t=elite===0?1:elite===1?1.1:1.2;
  for(let i=0;i<es.length;i++)near(100000-es[i].hp,i<cap?u.s.atk*.85**i*t:0);
  assert.equal(u.mem.passengerProjectiles.size,0);assert.equal(es[0].findBuff('sluggish').duration,.5);
 }
});
test('Passenger nearest-distinct chains skip untargetable/flying restrictions and do not bridge beyond1.7',()=>{
 const{b,deploy}=make(PAS,{elite:0,rank:4}),u=deploy(),a=enemy(b),hidden=enemy(b,{row:3,col:5}),f=enemy(b,{row:4,col:4,fly:true}),far=enemy(b,{row:5,col:8});
 b.addBuff(hidden,{key:'test:free',flags:{untargetable:true}});u.skill.rule='NEVER';strike(b,u,a,.7);
 near(100000-a.hp,u.s.atk);near(100000-f.hp,u.s.atk*.85);near(hidden.hp,100000);near(far.hp,100000);
});
test('Passenger S1 at all ranks substitutes original scale, four targets and1.5s Slow without duplicated chain damage',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(PAS,{skill:0,rank}),u=deploy(),a=enemy(b),z=enemy(b,{row:3,col:5});cast(b,u);strike(b,u,a,.7);
  near(100000-a.hp,u.s.atk*u.skill.bb['pasngr_s_1.atk_scale']*1.2);near(100000-z.hp,u.s.atk*u.skill.bb['pasngr_s_1.atk_scale']*.85*1.2);
  near(a.findBuff('sluggish').duration,1.5);near(z.findBuff('sluggish').duration,1.5);
 }
});
test('Passenger T1 uses inclusive pre-hit HP threshold and retains only his source multiplier for its three-second lifetime',()=>{
 const{b,deploy}=make(PAS),u=deploy(),e=enemy(b,{hp:80000});advance(b,.3);const atk=u.s.atk;
 b.dealDamage(u,e,{amount:1000,type:'true',isAttack:true});near(e.hp,78800);
 const hp=e.hp;b.dealDamage(null,e,{amount:1000,type:'true'});near(hp-e.hp,1000);
 const mark=`passenger:analysis:${u.id}`;assert.ok(e.findBuff(mark));advance(b,2.8);const hp2=e.hp;b.dealDamage(u,e,{amount:1000,type:'true',isAttack:true});near(hp2-e.hp,1200);
 advance(b,.4);const hp3=e.hp;b.dealDamage(u,e,{amount:1000,type:'true',isAttack:true});near(hp3-e.hp,1000);
});
test('Passenger T2 periodically detects only four adjacent tiles and promotion/potential talent values',()=>{
 for(const [potential,pct]of [[1,.08],[3,.1]]){
  const{b,deploy}=make(PAS,{potential}),u=deploy();advance(b,.3);near(u.s.atk,u.base.atk*(1+pct));
  const e=enemy(b);advance(b,.3);near(u.s.atk,u.base.atk);e.x=5;e.y=3;b._buildEnemyIndex();advance(b,.3);near(u.s.atk,u.base.atk*(1+pct));
 }
});
test('Passenger S2 uses native percentage BAT, forward extension, exact alias event and source five-target chain at every rank',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(PAS,{skill:1,rank}),u=deploy(PAS,1,4,'UP');const n=u.rangeKeys.length;b.addBuff(u,{key:'test:bat',mods:{batFlat:.2,batPct:.2,batMul:.8}});cast(b,u);
  near(u.s.interval,(u.base.bat+.2)*(1+.2+u.skill.bb.base_attack_time)*.8*100/u.s.aspd);assert.ok(u.rangeKeys.length>n);assert.equal(effectiveProfile(u).attackVisual,'Skill2');
  const es=[enemy(b),enemy(b,{row:3,col:5}),enemy(b,{row:3,col:6}),enemy(b,{row:3,col:7}),enemy(b,{row:3,col:8})];strike(b,u,es[0],.3);
  for(let i=0;i<5;i++)near(100000-es[i].hp,u.s.atk*.85**i*1.2);
 }
});
test('Passenger S3 requires a legal wide-range target without spending SP, then holds the exact cast animation and rejects a second cast',()=>{
 const{b,deploy}=make(PAS,{skill:2}),u=deploy(PAS,2,4,'RIGHT');u.skill.setSpTotal(u.skill.spCost*2);assert.equal(b.activateOperator(PAS),false);assert.equal(u.skill.charges,2);
 const e=enemy(b);assert.equal(b.activateOperator(PAS),true);assert.equal(b.activateOperator(PAS),false);assert.ok(u.findBuff('passenger:cast'));near(u.skill.spTotal,u.skill.spCost);
 advance(b,1);near(u.skill.spTotal,u.skill.spCost);assert.ok(u.findBuff('passenger:cast'));advance(b,.2);assert.equal(u.findBuff('passenger:cast'),null);assert.ok(u.skill.spTotal>=u.skill.spCost);
});
test('Passenger S3 locks highest current HP storm target, applies delayed eight pulses, caches ATK and excludes out-of-zone first targets',()=>{
 const{b,deploy}=make(PAS,{skill:2}),u=deploy();const a=enemy(b,{row:3,col:4,hp:70000}),z=enemy(b,{row:3,col:6,hp:100000}),out=enemy(b,{row:5,col:0});
 // Force the original random first selector to retain the storm center.
 b.rng.pick=xs=>xs.find(x=>x===z)||xs[0];cast(b,u);advance(b,.633);near(z.hp,100000);near(a.hp,70000);
 const cached=u.s.atk;b.addBuff(u,{key:'test:future-atk',mods:{atkFlat:10000}});advance(b,.2);near(100000-z.hp,cached*1.5*1.2);
 advance(b,3.8);near(100000-z.hp,cached*1.5*1.2*8);near(a.hp,70000);near(out.hp,100000);advance(b,2);near(100000-z.hp,cached*1.5*1.2*8);
});
test('Passenger S3 original area stays after selected enemy disappears or dies, but source retreat cancels all pending pulses',()=>{
 const{b,deploy}=make(PAS,{skill:2}),u=deploy(),chosen=enemy(b,{hp:100000}),z=enemy(b,{row:3,col:5,hp:90000});b.rng.pick=xs=>xs.find(x=>x===z)||xs[0];cast(b,u);advance(b,.1);
 b._setHidden(chosen,true);advance(b,.8);assert.ok(z.hp<90000);const hp=z.hp;b.retreatOperator(PAS);advance(b,2);near(z.hp,hp);
});
test('Passenger S3 brief control before original release permanently cancels the cast even after recovery',()=>{
 const{b,deploy}=make(PAS,{skill:2}),u=deploy(),e=enemy(b);cast(b,u);advance(b,.1);b.applyStatus(u,'stun',{source:e,duration:.1});advance(b,2);near(e.hp,100000);assert.equal(u.mem.passengerStorms.size,0);
});
test('Passenger natural chain AI performs one launch and one damage per victim despite inherited caster profiles',()=>{
 const{b,deploy}=make(PAS,{elite:0,rank:4}),u=deploy(),a=enemy(b),z=enemy(b,{row:3,col:5});u.skill.rule='NEVER';u.atkCd=0;advance(b,.8);
 near(100000-a.hp,u.s.atk);near(100000-z.hp,u.s.atk*.85);assert.equal(u.stats.attacks,1);
});
