// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-guard-six-star-second-prefabs.json' with { type: 'json' };
import { GUARD_SIX_STAR_SECOND_OPERATORS as configs } from '../shared/arkpedia/guard-six-star-second-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const MOUNTAIN='char_264_f12yin',PALLAS='char_485_pallas',ERATO='char_4043_erato';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const nodes=rows=>rows.flatMap(r=>r.components);
function buildFor(id,{skill=0,rank=10,elite=null,potential=1}={}){
 const op=data.operators[id];elite??=op.phases.length-1;rank=Math.min(rank,elite===2?10:elite===1?7:4);return{...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:rank};
}
function make(id,opts={},more=[],support=null){
 const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const builds=[buildFor(id,opts),...more.map(v=>typeof v==='string'?buildFor(v):v)];
 const b=new StandardBattle(source,{operators:builds,...(support?{support}: {})});b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(v=>({...v,height:'LOW',build:'ALL',pass:'ALL'}));
 const rng=()=>.999;rng.int=()=>0;b.rng=rng;
 return{b,deploy:(r=3,c=4,dir='RIGHT',which=id)=>{b.addDp('arkpedia',99);const u=b.deployOperator(which,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;}};
}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function cast(u){u.skill.setSpTotal(u.skill.spCost*u.skill.maxCharges);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,{r=3,c=5,fly=false,def=0}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});e.base.maxHp=100000;e.base.atk=1000;e.base.def=def;e.base.res=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=100000;
 b.addBuff(e,{key:'test:pin',persist:true,flags:{disarm:true,noMove:true}});b._buildEnemyIndex();return e;
}
function move(b,e,r,c){e.x=c;e.y=r;e.tileR=r;e.tileC=c;b._enemiesDirty=true;b._buildEnemyIndex();}
function block(b,u,e){move(b,e,u.tileR,u.tileC+.1);e.blockedBy=u;u.blocking=[e];b._buildEnemyIndex();advance(b,b.dt);}
function shot(b,u,targets){b.forceAttack(u,Array.isArray(targets)?targets:[targets]);u.atkCd=1000;}
const bb=(id,skill,rank=10)=>Object.fromEntries(data.operators[id].skills[skill].levels[rank-1].blackboard.map(v=>[v.key,v.value]));
const talent=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null)?.bb;
function wounded(u,ratio=.5){void u.s;u.hp=u.s.maxHp*ratio;}

test('two complete source kits retain all six skills, exact multi-hit/push selectors and deferred Blaze source',()=>{
 assert.equal(Object.keys(configs).length,2);assert.equal(evidence.sourceVersion,'26-09-23-17-49-43_b9cc4a');
 for(const[id,c]of Object.entries(configs)){
  assert.match(evidence.sourceBundles.find(v=>v.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  for(const face of ['Front','Back'])assert.match(evidence.originalModels[id][face].sha256,/^[a-f0-9]{64}$/);
  for(const sid of c.skillIds)assert.ok(evidence.skills[sid].length);
 }
 const m=nodes(evidence.characters[MOUNTAIN]).find(c=>c.pathId==='-8554580669528947534');
 assert.equal(m._additionalTimes,1);assert.equal(m._splitDamage,0);assert.equal(m._onlyFeedActiveBuffToLastOne,1);
 assert.match(evidence.vigorTerm.description,/only the highest/);
 assert.ok(evidence.originalBuffTemplates.pallas_t_2);assert.ok(evidence.deferredOperators.char_017_huang);
});
test('all six source skills and ten ranks load; E0, E1, E2 and maxed support use actual builds',()=>{
 for(const[id,c]of Object.entries(configs))for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,c.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
 for(const id of Object.keys(configs)){const{deploy}=make(id,{elite:0,rank:4}),u=deploy();assert.equal(u.def.talents.length,0);}
 const{deploy}=make(MOUNTAIN,{elite:0,rank:4},[],{id:PALLAS,skillId:'skchr_pallas_3'}),u=deploy(3,4,'RIGHT',PALLAS);
 assert.equal(u.def.raw.arkpedia.elite,2);assert.equal(u.skill.bb.atk,1);assert.equal(talent(u,'value').value,45);
});
test('Mountain normal attack chooses one ground target and emits original A/B release frames',()=>{
 const{b,deploy}=make(MOUNTAIN),u=deploy(),e=enemy(b),z=enemy(b,{c:5.2}),air=enemy(b,{c:4.5,fly:true});
 assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);u.atkCd=0;advance(b,.22);near(100000-e.hp,u.s.atk);near(z.hp,100000);near(air.hp,100000);
 const first=b._evq.find(v=>v[0]==='atk'&&v[1]===u.id);assert.equal(first[4].animation,'Attack_A');near(first[4].windup,.167);
 shot(b,u,z);advance(b,.22);const last=b._evq.filter(v=>v[0]==='atk'&&v[1]===u.id).at(-1);assert.equal(last[4].animation,'Attack_B');near(last[4].windup,.167);
});
test('Mountain selected promotion and potential crit applies pre-DEF scaling with nonstacking target ATK reduction',()=>{
 for(const elite of [1,2])for(const potential of [1,5]){
  const{b,deploy}=make(MOUNTAIN,{elite,potential,rank:elite===1?7:10}),u=deploy(),e=enemy(b,{def:100});
  b.rng=()=>0;shot(b,u,e);advance(b,.22);const t=talent(u,'atk_scale');near(100000-e.hp,u.s.atk*t.atk_scale-100);near(e.s.atk,e.base.atk*(1+t.atk));
  shot(b,u,e);advance(b,.22);assert.equal(e.buffs.filter(v=>v.key==='mountain:weaken').length,1);near(e.s.atk,e.base.atk*(1+t.atk));advance(b,t.duration+.1);near(e.s.atk,e.base.atk);
 }
});
test('Mountain crit does not occur at or above selected probability and E0 has none',()=>{
 for(const elite of [0,1,2]){const{b,deploy}=make(MOUNTAIN,{elite,rank:elite<2?4:10}),u=deploy(),e=enemy(b);b.rng=()=>.2;shot(b,u,e);advance(b,.22);near(100000-e.hp,u.s.atk);assert.ok(!e.findBuff('mountain:weaken'));}
});
test('Mountain E2 constitution adds DEF once and physical dodge leaves Arts untouched',()=>{
 for(const elite of [0,1,2]){const{b,deploy}=make(MOUNTAIN,{elite,rank:elite<2?4:10}),u=deploy(),e=enemy(b);near(u.s.def,u.base.def*(elite===2?1.1:1));near(u.s.dodgePhys,elite===2?.15:0);
  if(elite===2){b.rng=()=>0;const hp=u.hp;b.dealDamage(e,u,{amount:u.s.def+100,type:'phys',isAttack:true});near(u.hp,hp);b.dealDamage(e,u,{amount:100,type:'arts',isAttack:true});near(u.hp,hp-100*(1-u.s.res/100));}
 }
});
test('Mountain S1 deals one selected full ATK skill hit to at most two enemies with one attack identity',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(MOUNTAIN,{rank}),u=deploy(),es=[enemy(b,{def:100}),enemy(b,{c:5.1,def:100}),enemy(b,{c:5.2,def:100})];cast(u);const p=effectiveProfile(u);assert.equal(acquireTargets(b,u,p).length,2);u.atkCd=0;advance(b,.2);
  near(100000-es[0].hp,u.s.atk*bb(MOUNTAIN,0,rank).atk_scale-100);near(100000-es[1].hp,u.s.atk*bb(MOUNTAIN,0,rank).atk_scale-100);near(es[2].hp,100000);assert.equal(u.skill.active,false);near(u.skill.spTotal,0);
 }
});
test('Mountain S1 crit is one selected ability proc shared by its two victims',()=>{
 const{b,deploy}=make(MOUNTAIN),u=deploy(),e=enemy(b),z=enemy(b,{c:5.2});let calls=0;b.rng=()=>{calls++;return 0;};cast(u);shot(b,u,[e,z]);advance(b,.2);
 assert.equal(calls,1);near(100000-e.hp,u.s.atk*bb(MOUNTAIN,0).atk_scale*talent(u,'atk_scale').atk_scale);near(e.hp,z.hp);assert.ok(e.findBuff('mountain:weaken'));assert.ok(z.findBuff('mountain:weaken'));
});
test('Mountain S1 refunds a dead input before emission but control preserves pending charge without output',()=>{
 const{b,deploy}=make(MOUNTAIN),u=deploy(),e=enemy(b);cast(u);shot(b,u,e);b.kill(e);advance(b,.2);assert.equal(u.skill.active,false);near(u.skill.spTotal,u.skill.spCost);
 const f=make(MOUNTAIN),a=f.deploy(),z=enemy(f.b);cast(a);shot(f.b,a,z);f.b.applyStatus(a,'stun',{duration:.03});advance(f.b,.2);near(z.hp,100000);assert.equal(a.skill.pending,true);near(a.skill.spTotal,0);
});
test('Mountain S1 control recovered before the event still cancels the unfired attack',()=>{
 const{b,deploy}=make(MOUNTAIN),u=deploy(),e=enemy(b);cast(u);shot(b,u,e);b.applyStatus(u,'stun',{duration:.07});advance(b,.2);assert.equal(Boolean(u.s.flags.stun),false);near(e.hp,100000);assert.equal(u.skill.pending,true);near(u.skill.spTotal,0);
});
test('Mountain S2 exact final DEF factor composes with outside percent and source ATK/block/regen',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(MOUNTAIN,{skill:1,rank}),u=deploy();b.addBuff(u,{key:'outside',mods:{defPct:1}});const defense=u.s.def,block=u.s.blockCnt;cast(u);const x=bb(MOUNTAIN,1,rank);near(u.s.atk,u.base.atk*(1+x.atk));near(u.s.def,defense*(1+x.def));near(u.s.blockCnt,block+x.block_cnt);near(u.s.hpRegen/u.s.maxHp,x.hp_recovery_per_sec_by_max_hp_ratio);u.skill.end('test');near(u.s.def,defense);near(u.s.blockCnt,block);}
});
test('Mountain S2 block-capacity selector includes nearby unblocked targets but excludes normal front range',()=>{
 const{b,deploy}=make(MOUNTAIN,{skill:1}),u=deploy(),e=enemy(b,{c:4.1}),z=enemy(b,{c:4.2}),extra=enemy(b,{c:4.3}),far=enemy(b,{c:5}),air=enemy(b,{c:4.2,fly:true});cast(u);
 assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e,z]);u.atkCd=0;advance(b,.4);near(100000-e.hp,u.s.atk);near(100000-z.hp,u.s.atk);near(extra.hp,100000);near(far.hp,100000);near(air.hp,100000);
 b.addBuff(u,{key:'block-extra',mods:{blockCnt:1}});assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,3);
 b.addBuff(u,{key:'zero-block',mods:{blockCnt:-9}});assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);
});
test('Mountain S2 regeneration remains an attribute under HealFree and manual cancellation restores normal range',()=>{
 const{b,deploy}=make(MOUNTAIN,{skill:1}),u=deploy(),far=enemy(b);cast(u);b.addBuff(u,{key:'healFree',flags:{healFree:true}});wounded(u);const hp=u.hp;advance(b,1);near(u.hp-hp,u.s.maxHp*bb(MOUNTAIN,1).hp_recovery_per_sec_by_max_hp_ratio,2);assert.equal(b.activateOperator(u.defId),true);assert.equal(u.skill.active,false);near(u.s.hpRegen,0);assert.ok(acquireTargets(b,u,effectiveProfile(u)).includes(far));advance(b,6);assert.equal(b.activateOperator(u.defId),true);
});
test('Mountain S2 uses original loop without unused Begin, and retreat clears its form',()=>{
 const{b,deploy}=make(MOUNTAIN,{skill:1}),u=deploy(),e=enemy(b,{c:4.1});cast(u);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');shot(b,u,e);near(b._evq.filter(v=>v[0]==='atk').at(-1)[4].windup,.333);advance(b,.4);b.retreat(u);assert.equal(u.mem.regularFormVisual,null);assert.ok(!u.findBuff('guard-six-second:begin'));
});
test('Mountain S3 selected BAT percentage/range/three-or-four cap produces two independent armored waves',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(MOUNTAIN,{skill:2,rank}),u=deploy(),es=Array.from({length:5},(_,i)=>enemy(b,{c:4.8+i*.1,def:100})),air=enemy(b,{c:4.5,fly:true});cast(u);advance(b,.25);const x=bb(MOUNTAIN,2,rank),n=x['attack@max_target'];near(u.s.bat,u.base.bat*(1+x.base_attack_time));assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,n);u.atkCd=0;advance(b,.35);
  for(let i=0;i<n;i++)near(100000-es[i].hp,u.s.atk-100);near(es[n].hp,100000);near(air.hp,100000);advance(b,.2);for(let i=0;i<n;i++)near(100000-es[i].hp,2*(u.s.atk-100));
 }
});
test('Mountain S3 only second punch pushes each victim using relative source force',()=>{
 const{b,deploy}=make(MOUNTAIN,{skill:2}),u=deploy(),e=enemy(b);cast(u);advance(b,.25);const calls=[];const native=b.push.bind(b);b.push=(target,force,opts)=>{calls.push([target,force,opts]);return native(target,force,opts);};shot(b,u,e);advance(b,.35);assert.equal(calls.length,0);advance(b,.2);assert.equal(calls.length,1);assert.equal(calls[0][0],e);assert.equal(calls[0][1],1);assert.equal(calls[0][2].from,u);assert.equal(calls[0][2].dir,undefined);
});
test('Mountain S3 brief control between events cancels second punch and push, while retreat cancels both',()=>{
 for(const mode of ['stun','retreat']){const{b,deploy}=make(MOUNTAIN,{skill:2}),u=deploy(),e=enemy(b);cast(u);advance(b,.25);let pushes=0;b.push=()=>{pushes++;return 0;};shot(b,u,e);advance(b,.35);const hp=e.hp;if(mode==='stun')b.applyStatus(u,'stun',{duration:.03});else b.retreat(u);advance(b,.25);near(e.hp,hp);assert.equal(pushes,0);}
});
test('Mountain S3 selected mastery chance overrides talent and preserves one proc across two independently mitigated punches',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(MOUNTAIN,{skill:2,rank}),u=deploy(),e=enemy(b,{def:100});cast(u);advance(b,.25);b.push=()=>0;b.rng=()=>bb(MOUNTAIN,2,rank)['talent@prob']-.01;shot(b,u,e);advance(b,.55);near(100000-e.hp,2*(u.s.atk*talent(u,'atk_scale').atk_scale-100));assert.ok(e.findBuff('mountain:weaken'));}
});
test('Mountain S3 begin/end visual locks and duration cleanup cannot leak into redeployment',()=>{
 const{b,deploy}=make(MOUNTAIN,{skill:2}),u=deploy();cast(u);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_Begin');assert.equal(Boolean(u.s.flags.disarm),true);advance(b,.25);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_Idle');assert.equal(Boolean(u.s.flags.disarm),false);u.skill.end('duration');assert.equal(u.mem.regularFormVisual.clip,'Skill_3_End');advance(b,.25);assert.equal(u.mem.regularFormVisual,null);b.retreat(u);advance(b,75);const v=deploy();assert.equal(v.mem.regularFormVisual,undefined);near(v.s.bat,v.base.bat);
});
test('Pallas source trait is ATK scale before armor and only excludes enemies actually blocked by herself',()=>{
 const{b,deploy}=make(PALLAS,{elite:0,rank:4},['char_122_beagle']),u=deploy(),a=deploy(3,5,'RIGHT','char_122_beagle'),e=enemy(b,{c:5.2,def:100});e.blockedBy=a;a.blocking=[e];shot(b,u,e);advance(b,.55);near(100000-e.hp,u.s.atk*1.2-100);e.hp=100000;e.blockedBy=u;u.blocking=[e];shot(b,u,e);advance(b,.55);near(100000-e.hp,u.s.atk-100);
});
test('Pallas Minoan aura selects actual deployed faction allies, strict HP threshold and promotion',()=>{
 for(const elite of [1,2]){const{b,deploy}=make(PALLAS,{elite,rank:elite===1?7:10},[ERATO,'char_122_beagle']),u=deploy(),a=deploy(2,4,'RIGHT',ERATO),other=deploy(4,4,'RIGHT','char_122_beagle');advance(b,.05);assert.ok(a.tags.has('minos'));const x=talent(u,'peak_performance.atk')['peak_performance.atk'];near(u.s.atk,u.base.atk*(1+x));near(a.s.atk,a.base.atk*(1+x));near(other.s.atk,other.base.atk);wounded(a,.8);advance(b,.05);near(a.s.atk,a.base.atk);wounded(a,.8001);advance(b,.05);near(a.s.atk,a.base.atk*(1+x));}
});
test('Pallas aura rejects isolated/untargetable/hidden faction allies but keeps allied stealth and HealFree',()=>{
 const{b,deploy}=make(PALLAS,{},[ERATO]),u=deploy(),a=deploy(2,4,'RIGHT',ERATO);advance(b,.05);const boosted=a.s.atk;
 for(const flag of ['isolated','untargetable','hidden']){if(flag==='hidden')a.hidden=true;else b.addBuff(a,{key:'eligibility',flags:{[flag]:true}});advance(b,.05);near(a.s.atk,a.base.atk);if(flag==='hidden')a.hidden=false;else b.removeBuff(a,'eligibility');advance(b,.05);near(a.s.atk,boosted);}
 b.addBuff(a,{key:'friendly',flags:{stealth:true,healFree:true,noHeal:true}});advance(b,.05);near(a.s.atk,boosted);assert.ok(u.findBuff(`pallas:talent:${u.id}`));
});
test('Pallas bench grants no aura, and source withdrawal/death removes only her own buffs',()=>{
 for(const mode of ['retreat','death']){const{b,deploy}=make(PALLAS,{},[ERATO]);const a=deploy(2,4,'RIGHT',ERATO);advance(b,.05);near(a.s.atk,a.base.atk);const u=deploy();advance(b,.05);b.addBuff(a,{key:'outside',mods:{atkPct:.1}});assert.ok(a.findBuff(`pallas:talent:${u.id}`));if(mode==='retreat')b.retreat(u);else b.kill(u);advance(b,.05);assert.ok(!a.findBuff(`pallas:talent:${u.id}`));assert.ok(a.findBuff('outside'));near(a.s.atk,a.base.atk*1.1);}
});
test('Pallas E2 output healing uses selected potential, self and the tile directly ahead',()=>{
 for(const potential of [1,5]){const{b,deploy}=make(PALLAS,{potential},['char_122_beagle','char_123_fang']),u=deploy(),front=deploy(3,5,'RIGHT','char_122_beagle'),side=deploy(2,4,'RIGHT','char_123_fang'),e=enemy(b,{c:6});wounded(u);wounded(front);wounded(side);const hp=[u.hp,front.hp,side.hp];shot(b,u,e);advance(b,.55);const value=talent(u,'value').value;near(u.hp-hp[0],value);near(front.hp-hp[1],value);near(side.hp,hp[2]);}
});
test('Pallas output heal ignores target-free but honors isolation, HealFree and ally noHeal',()=>{
 for(const flags of [{untargetable:true},{stealth:true},{isolated:true},{healFree:true},{noHeal:true}]){const{b,deploy}=make(PALLAS,{},['char_122_beagle']),u=deploy(),a=deploy(3,5,'RIGHT','char_122_beagle'),e=enemy(b,{c:6});wounded(a);const hp=a.hp;b.addBuff(a,{key:'test:flag',flags});shot(b,u,e);advance(b,.55);near(a.hp-hp,flags.isolated||flags.healFree||flags.noHeal?0:40);}
});
test('Pallas cancelled or dodged output cannot generate healing receipts',()=>{
 const{b,deploy}=make(PALLAS),u=deploy(),e=enemy(b);wounded(u);const hp=u.hp;b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});shot(b,u,e);advance(b,.55);near(u.hp,hp);b.removeBuff(e,'dodge');const hook=b.on('hit',c=>{if(c.source===u)c.dmg.cancel=true;});shot(b,u,e);advance(b,.55);b.off(hook);near(u.hp,hp);
});
test('Pallas S1 retains two full armored hits and two heal receipts after instant skill ends',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(PALLAS,{rank}),u=deploy(),e=enemy(b,{def:100});wounded(u);const hp=u.hp;cast(u);shot(b,u,e);advance(b,.55);assert.equal(u.skill.active,false);const damage=u.s.atk*bb(PALLAS,0,rank).atk_scale*1.2-100;near(100000-e.hp,damage);near(u.hp-hp,40);advance(b,.15);near(100000-e.hp,2*damage);near(u.hp-hp,80);near(u.skill.spTotal,0);}
});
test('Pallas S1 CAST targeting reselects at release but second strike remains on the emitted victim',()=>{
 const{b,deploy}=make(PALLAS),u=deploy(),e=enemy(b),z=enemy(b,{r:0,c:0});cast(u);shot(b,u,e);move(b,e,0,1);move(b,z,3,5);advance(b,.55);assert.ok(z.hp<100000);near(e.hp,100000);move(b,z,0,2);advance(b,.15);assert.ok(z.hp<100000-u.s.atk*bb(PALLAS,0).atk_scale*1.2);near(e.hp,100000);
});
test('Pallas S1 dead startup input refunds only when CAST selection emits no replacement',()=>{
 for(const replacement of [false,true]){const{b,deploy}=make(PALLAS),u=deploy(),e=enemy(b);cast(u);shot(b,u,e);b.kill(e);const z=replacement?enemy(b):null;advance(b,.75);assert.equal(u.skill.active,false);near(u.skill.spTotal,replacement?0:u.skill.spCost);if(z)near(100000-z.hp,2*u.s.atk*bb(PALLAS,0).atk_scale*1.2);}
});
test('Pallas S1 second event cancels on control or withdrawal and fast source events preserve separate deadlines',()=>{
 for(const mode of ['control','withdraw']){const{b,deploy}=make(PALLAS),u=deploy(),e=enemy(b);cast(u);shot(b,u,e);advance(b,.55);const hp=e.hp;if(mode==='control')b.applyStatus(u,'stun',{duration:.03});else b.retreat(u);advance(b,.15);near(e.hp,hp);}
 const{b,deploy}=make(PALLAS),u=deploy(),e=enemy(b);b.addBuff(u,{key:'aspd',mods:{aspd:100}});cast(u);shot(b,u,e);advance(b,.3);near(100000-e.hp,u.s.atk*bb(PALLAS,0).atk_scale*1.2);advance(b,.08);near(100000-e.hp,2*u.s.atk*bb(PALLAS,0).atk_scale*1.2);
});
test('Pallas S2 actual extended front-three range and selected ATK/stun restore at duration end',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(PALLAS,{skill:1,rank}),u=deploy(),far=enemy(b,{c:7}),side=enemy(b,{r:4,c:5}),air=enemy(b,{c:6,fly:true});assert.ok(!acquireTargets(b,u,effectiveProfile(u)).includes(far));cast(u);b.rng=()=>0;assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[far]);shot(b,u,far);advance(b,.55);assert.ok(far.s.flags.stun);near(100000-far.hp,u.s.atk*1.2);near(side.hp,100000);near(air.hp,100000);u.skill.end('test');advance(b,.05);near(u.s.atk,u.base.atk*(1+talent(u,'peak_performance.atk')['peak_performance.atk']));assert.ok(!acquireTargets(b,u,effectiveProfile(u)).includes(far));}
});
test('Pallas S2 undamageable active stun can land on a dodged primary, with probability strictness',()=>{
 const{b,deploy}=make(PALLAS,{skill:1}),u=deploy(),e=enemy(b);cast(u);b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});b.rng=()=>0;shot(b,u,e);advance(b,.55);near(e.hp,100000);assert.ok(e.s.flags.stun);advance(b,.3);b.rng=()=>bb(PALLAS,1)['attack@buff_prob'];shot(b,u,e);advance(b,.55);assert.equal(Boolean(e.s.flags.stun),false);
});
test('Pallas S3 forward melee LOWLAND ally receives DEF/block/Vigor, while owner retains only her own ATK buff',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(PALLAS,{skill:2,rank},['char_122_beagle']),u=deploy(),a=deploy(3,5,'RIGHT','char_122_beagle'),baseDef=a.s.def,baseBlock=a.s.blockCnt;cast(u);const x=bb(PALLAS,2,rank);near(a.s.def,baseDef+a.base.def*x['attack@def']);near(a.s.blockCnt,baseBlock+1);near(a.s.atk,a.base.atk*(1+x['attack@peak_performance.atk']));near(u.s.atk,u.base.atk*(1+x.atk+.25));near(u.s.def,u.base.def);wounded(a,.8);advance(b,.05);near(a.s.atk,a.base.atk);near(a.s.def,baseDef+a.base.def*x['attack@def']);u.skill.end('test');near(a.s.def,baseDef);near(a.s.blockCnt,baseBlock);near(a.s.atk,a.base.atk);}
});
test('Pallas S3 self fallback chooses strongest Vigor rather than adding her talent and skill values',()=>{
 const{b,deploy}=make(PALLAS,{skill:2}),u=deploy();cast(u);near(u.s.atk,u.base.atk*(1+bb(PALLAS,2).atk+.5));near(u.s.def,u.base.def*1.35);near(u.s.blockCnt,u.base.blockCnt+1);wounded(u,.8);advance(b,.05);near(u.s.atk,u.base.atk*(1+bb(PALLAS,2).atk));wounded(u,.9);advance(b,.05);near(u.s.atk,u.base.atk*2.5);u.skill.end('test');near(u.s.atk,u.base.atk*1.25);
});
test('Pallas S3 transfer rejects high tile/ranged/isolation and ignores the source target-free exception',()=>{
 for(const mode of ['high','ranged','isolated','untargetable']){const id=mode==='ranged'?ERATO:'char_122_beagle';const{b,deploy}=make(PALLAS,{skill:2},[id]),u=deploy(),a=deploy(3,5,'RIGHT',id);if(mode==='high')b.grid.tiles[b.grid.key(3,5)]={...b.grid.tile(3,5),height:'HIGH'};else if(mode==='isolated'||mode==='untargetable')b.addBuff(a,{key:'flag',flags:{[mode]:true}});cast(u);assert.equal(Boolean(a.findBuff(`pallas:aid:${u.id}`)),mode==='untargetable');assert.equal(Boolean(u.findBuff(`pallas:aid:${u.id}`)),mode!=='untargetable');}
});
test('Pallas S3 recipient lifetime changes transfer owned buffs without erasing stronger independent Vigor',()=>{
 const{b,deploy}=make(PALLAS,{skill:2},['char_122_beagle']),u=deploy(),a=deploy(3,5,'RIGHT','char_122_beagle');cast(u);b.applyStatus(a,'vigor',{key:'outside:vigor',value:.7});near(a.s.atk,a.base.atk*1.7);b.retreat(a);advance(b,.05);assert.ok(u.findBuff(`pallas:aid:${u.id}`));near(u.s.atk,u.base.atk*2.5);u.skill.end('test');assert.ok(!u.findBuff(`pallas:aid:${u.id}`));
});
test('Pallas S3 natural three-target strike emits three independent heals and original begin/loop/down clips',()=>{
 const{b,deploy}=make(PALLAS,{skill:2}),u=deploy(3,4,'DOWN'),es=[enemy(b,{r:2,c:4}),enemy(b,{r:1,c:4}),enemy(b,{r:2,c:4.1}),enemy(b,{r:1,c:4.1})];wounded(u);const hp=u.hp;cast(u);assert.equal(u.mem.regularFormVisual.clip,'Skill_03_Begin');advance(b,.55);u.atkCd=0;advance(b,.55);assert.equal(es.filter(e=>e.hp<100000).length,3);near(u.hp-hp,120);const at=b._evq.filter(v=>v[0]==='atk'&&v[1]===u.id).at(-1);assert.equal(at[4].animation,'Skill_03_Loop_Down');near(at[4].windup,.5);u.skill.end('test');advance(b,.55);assert.equal(u.mem.regularFormVisual,null);
});
