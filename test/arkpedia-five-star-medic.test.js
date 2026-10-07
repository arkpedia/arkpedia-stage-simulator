// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-medic-prefabs.json' with { type: 'json' };
import { FIVE_STAR_MEDIC_OPERATORS } from '../shared/arkpedia/five-star-medic-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { registerNamedSpRecovery } from '../server/sim/content/arkpedia-five-star-medic.js';
import { makeDamageInfo } from '../server/sim/damage.js';
const PTI='char_128_plosis',BRE='char_275_breeze',WAR='char_171_bldsk',FOL='char_345_folnic',WHI='char_436_whispr',FAN='char_123_fang',BEA='char_122_beagle';
const near=(a,e,tol=1e-5)=>assert.ok(Math.abs(a-e)<tol,`${a} != ${e}`);
function advance(b,s){for(let n=0;n<Math.round(s/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);}
function build(id,{skill=0,rank=10,elite=2,potential=1}={}){const o=data.operators[id];assert.ok(o,`Reviewed snapshot required: ${id}`);return{...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:rank};}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[]}={}){
 const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const b=new StandardBattle(source,{operators:[build(id,{skill,rank,elite,potential}),...others.map(v=>typeof v==='string'?defaultBuild(source.operators[v]):v)]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(who=id,r=1,c=4,dir='UP')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,r,c,dir);assert.ok(u,`${who} on ${r},${c}`);u.atkCd=1000;return u;};
 return{b,deploy};
}
function cast(b,u){u.skill.gainSp(u.skill.spCost*u.skill.maxCharges,'test');assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,{row=2,col=4,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});e.base.maxHp=e.hp=100000;e.base.def=0;e.base.res=0;if(fly)e.motion='FLY';e.markDirty();b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
function strike(b,u,targets,s=1){const hp=targets.map(a=>a.hp);b.forceAttack(u,targets);u.atkCd=1000;advance(b,s);return targets.map((a,i)=>a.hp-hp[i]);}
const bb=(id,sk,rank)=>Object.fromEntries(data.operators[id].skills[sk].levels[rank-1].blackboard.map(v=>[v.key,v.value]));
const wound=(u,n=10000)=>{u.base.maxHp=n;u.markDirty();void u.s;u.hp=100;};

test('source binds all ten exact skills, original models, native formulas, templates and circle radius',()=>{
 for(const[id,c]of Object.entries(FIVE_STAR_MEDIC_OPERATORS)){
  assert.match(evidence.sourceBundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  assert.match(evidence.models[id].Front.sha256,/^[a-f0-9]{64}$/);
  for(const sid of c.skillIds)assert.ok(evidence.skills[sid.split('[')[0]].length);
 }
 const pt=evidence.skills.skchr_plosis_2.flatMap(x=>x._buffs??[]).find(x=>x.buffKey==='plosis_s_2');assert.equal(pt.attributes.attributeModifiers[0].formulaItem,0);
 const wh=evidence.skills.skchr_whispr_2.flatMap(x=>x._buffs??[]).find(x=>x.buffKey==='whispr_s_2');assert.equal(wh.attributes.attributeModifiers[0].formulaItem,1);
 assert.equal(evidence.projectiles.projectile_chr_folnic_s2_logic.find(x=>x.m_Radius).m_Radius,1);
 assert.equal(evidence.buffTemplates.folnic_t_1.eventToActions.ON_TAKE_DAMAGE[0]._sharedFlag,'IS_ENVIRONMENT_DAMAGE');
 const plasma=evidence.skills.skchr_bldsk_2.find(c=>c._uninterruptibleOnAbilityPredelay!==undefined);
 assert.equal(plasma._canUseInAbnormalState,0);assert.equal(plasma._uninterruptibleOnAbilityPredelay,0);
 assert.equal(evidence.frameParity,false);
});
test('every selected medic source rank loads and promotes to the exact distinct reviewed skills',()=>{
 for(const[id,c]of Object.entries(FIVE_STAR_MEDIC_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,c.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
});
test('normal original OnAttack gates healing and all five normal heal selectors reject forbidden targets',()=>{
 for(const id of Object.keys(FIVE_STAR_MEDIC_OPERATORS)){
  const{b,deploy}=make(id,{others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a);wound(z);
  b.addBuff(z,{key:'test:free',flags:{healFree:true}});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);
  const before=a.hp;b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.2);near(a.hp,before);advance(b,1);assert.ok(a.hp>before);near(z.hp,100);
 }
});
test('Ptilopsis aura follows promotion, changes only time recovery and withdraws immediately',()=>{
 for(const[elite,rate]of[[0,1],[1,1.15],[2,1.3]]){
  const{b,deploy}=make(PTI,{elite,rank:[4,7,10][elite],others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,3,3),z=deploy(BEA,3,4);
  a.skill.setSpTotal(0);z.skill.spType='hurt';z.skill.setSpTotal(0);advance(b,1);near(a.skill.sp,rate,1e-4);near(z.skill.sp,0);
  b.retreat(u);near(a.s.spRecovery,1);advance(b,1);near(a.skill.sp,rate+1,1e-4);
 }
});
test('named SP aura chooses strongest effect and preserves weaker fallback without swallowing personal recovery',()=>{
 const{b,deploy}=make(PTI,{others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,3,3),z=deploy(BEA,3,4);
 const sync=registerNamedSpRecovery(b,z,.5);sync();near(a.s.spRecovery,1.5);
 b.addBuff(a,{key:'test:personal',mods:{spRecoveryFlat:.2}});near(a.s.spRecovery,1.7);b.retreat(z);near(a.s.spRecovery,1.5);
 b.retreat(u);near(a.s.spRecovery,1.2);b.addBuff(a,{key:'test:no-sp',flags:{noSp:true}});a.skill.setSpTotal(0);advance(b,1);near(a.skill.sp,0);
});
test('Ptilopsis S1 original selected ATK applies to at most three injured allies',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(PTI,{rank,others:[FAN,BEA,'char_124_kroos','char_106_franka']}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),c=deploy('char_124_kroos',2,4),d=deploy('char_106_franka',3,4);
  for(const p of[a,z,c,d])wound(p);const atk=u.s.atk;cast(b,u);near(u.s.atk,atk*(1+bb(PTI,0,rank).atk));
  const targets=acquireTargets(b,u,effectiveProfile(u));assert.equal(targets.length,3);strike(b,u,targets,1);assert.equal([a,z,c,d].filter(x=>x.hp>100).length,3);
 }
});
test('Ptilopsis S2 uses additive BAT seconds, expanded source range, eventless native predelay and form cleanup',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(PTI,{skill:1,rank,others:[FAN]}),u=deploy(),a=deploy(FAN,3,4);wound(a);const base=u.s.bat;
  cast(b,u);near(u.s.bat,base+bb(PTI,1,rank).base_attack_time);assert.ok(u.rangeKeySet.has(3*21+4));
  const prof=effectiveProfile(u);assert.equal(prof.windup,.2);assert.equal(prof.attackVisual,'none');const hp=a.hp;
  b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.1);near(a.hp,hp);advance(b,.25);assert.ok(a.hp>hp);advance(b,.4);assert.equal(u.mem.regularFormVisual.clip,'Skill_Loop');
  u.skill.end('test');advance(b,.4);near(u.s.bat,base);assert.equal(u.mem.regularFormVisual,null);
 }
});
test('Ptilopsis active timed skills reject all SP gifts even though the named aura is present',()=>{
 const{b,deploy}=make(PTI),u=deploy();cast(b,u);near(u.s.spRecovery,1.3);assert.equal(u.skill.gainSp(20,'gift'),0);advance(b,1);near(u.skill.sp,0);
});
test('Breeze S1 reduces targets to two and selected-rank ATK controls exact healing',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(BRE,{rank,others:[FAN,BEA,'char_106_franka']}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),c=deploy('char_106_franka',3,4);for(const p of[a,z,c])wound(p);
  const atk=u.s.atk;cast(b,u);near(u.s.atk,atk*(1+bb(BRE,0,rank).atk));const targets=acquireTargets(b,u,effectiveProfile(u));assert.equal(targets.length,2);
  const heals=strike(b,u,targets,1);for(const amount of heals)near(amount,u.s.atk);near(c.hp,100);
 }
});
test('Breeze S2 waits for original Skill hit and speed-ten flight, healing main once and surrounding eight at half',()=>{
 const{b,deploy}=make(BRE,{skill:1,others:[FAN,BEA,'char_106_franka']}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,3,3),far=deploy('char_106_franka',3,5);for(const p of[a,z,far])wound(p);
 cast(b,u);const p=effectiveProfile(u);near(p.windup(b,u),.733);assert.equal(p.healProjectileSpeed,10);
 b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.7);near(a.hp,100);advance(b,.2);near(a.hp-100,u.s.atk);near(z.hp-100,u.s.atk*.5);near(far.hp,100);
});
test('Breeze source medic protection includes supporters only at E2 and removes only its own resistance',()=>{
 for(const elite of[1,2]){
  const{b,deploy}=make(BRE,{elite,rank:elite===1?7:10,others:['char_101_sora',PTI,FAN]}),u=deploy(),medic=deploy(PTI,1,3),support=deploy('char_101_sora',1,5),a=deploy(FAN,3,4);
  b.applyStatus(medic,'resist',{key:'test:other',value:.2});cast(b,u);near(b.resistOf(medic),.5);near(b.resistOf(support),elite===2?.5:0);near(b.resistOf(a),0);
  u.skill.end('test');near(b.resistOf(medic),.2);near(b.resistOf(support),0);cast(b,u);b.retreat(u);near(b.resistOf(medic),.2);
 }
});
test('Breeze fired healing projectile remains valid when the source withdraws',()=>{
 const{b,deploy}=make(BRE,{skill:1,others:[FAN,BEA]}),u=deploy(BRE,1,2),a=deploy(FAN,3,3),z=deploy(BEA,3,4);wound(a);wound(z);cast(b,u);
 b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.75);assert.ok(b.projectiles.list.length);b.retreat(u);advance(b,.4);assert.ok(a.hp>100);assert.ok(z.hp>100);
});
test('Warfarin S1 exactly-half HP qualifies, adds target MaxHP after ordinary heal and spends one stored charge',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(WAR,{rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);a.hp=a.s.maxHp*.5;cast(b,u);
  const charged=u.skill.charges,p=effectiveProfile(u);assert.deepEqual(acquireTargets(b,u,p),[a]);const hp=a.hp;
  strike(b,u,[a],.6);near(a.hp-hp,u.s.atk+a.s.maxHp*bb(WAR,0,rank).hp_ratio);assert.equal(u.skill.charges,charged);assert.equal(u.skill.active,false);near(u.skill.sp,0);
 }
});
test('Warfarin S1 ordinary healing above threshold preserves charge and gains one attack SP',()=>{
 const{b,deploy}=make(WAR,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);a.hp=6000;u.skill.setSpTotal(4);u.atkCd=0;advance(b,.6);
 assert.equal(u.skill.activations,0);assert.equal(u.skill.charges,1);near(u.skill.sp,1);near(a.hp-6000,u.s.atk);
});
test('Warfarin S2 cast waits for source Attack event/full cast and chooses only self plus one nonself ally',()=>{
 const{b,deploy}=make(WAR,{skill:1,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);b.rng.pick=list=>list[0];const atk=u.s.atk,aa=a.s.atk;cast(b,u);
 advance(b,.4);near(u.s.atk,atk);near(a.s.atk,aa);advance(b,.15);near(u.s.atk,atk*1.9);near(a.s.atk,aa*1.9);near(z.s.atk,z.base.atk);assert.ok(u.s.flags.disarm&&u.s.flags.noSp);
 advance(b,.65);assert.equal(Boolean(u.s.flags.disarm),false);assert.ok(u.skill.sp>0);assert.ok(a.findBuff('warfarin:plasma'));
});
test('Warfarin plasma loses exact MaxHP per second through shields/modifiers with no hit-SP and can be fatal',()=>{
 const{b,deploy}=make(WAR,{skill:1,others:[BEA]}),u=deploy(),a=deploy(BEA,2,3);b.rng.pick=list=>list[0];a.skill.spType='hurt';a.skill.setSpTotal(0);
 b.addBuff(a,{key:'test:shield',shield:10000,mods:{dmgTakenMul:.01}});cast(b,u);advance(b,.6);const hp=a.hp;advance(b,1);near(hp-a.hp,a.s.maxHp*.03);near(a.skill.sp,0);near(a.findBuff('test:shield').shield,10000);
 a.hp=1;advance(b,1);assert.equal(a.alive,false);
});
test('Warfarin fired beneficiary buff persists independently after source withdrawal and expires at original fifteen seconds',()=>{
 const{b,deploy}=make(WAR,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);b.rng.pick=list=>list[0];cast(b,u);advance(b,.6);b.retreat(u);
 near(a.s.atk,a.base.atk*1.9);const hp=a.hp;advance(b,1);near(hp-a.hp,a.s.maxHp*.03);advance(b,14.1);assert.equal(a.findBuff('warfarin:plasma'),null);near(a.s.atk,a.base.atk);
});
test('Warfarin Blood Sample uses enemy death in range, random selector retains self and withdrawal stops it',()=>{
 const{b,deploy}=make(WAR,{others:[FAN]}),u=deploy(),a=deploy(FAN,3,3);u.skill.setSpTotal(0);a.skill.setSpTotal(0);b.rng.pick=list=>list.find(x=>x===u);
 const e=enemy(b);b.kill(e,a);near(u.skill.spTotal,4);near(a.skill.spTotal,0);const outside=enemy(b,{row:3,col:7});b.kill(outside,a);near(u.skill.spTotal,4);
 b.rng.pick=list=>list.find(x=>x===a);const next=enemy(b,{row:2,col:3});b.kill(next,a);near(a.skill.spTotal,2);b.retreat(u);b.kill(enemy(b,{row:2,col:3}),a);near(a.skill.spTotal,2);
});
test('Warfarin gifted SP still obeys noSp and active-skill restrictions on its chosen random ally',()=>{
 const{b,deploy}=make(WAR,{others:[BEA]}),u=deploy(),a=deploy(BEA,2,3);u.skill.setSpTotal(0);a.skill.setSpTotal(0);b.rng.pick=list=>list.find(x=>x===a);
 b.addBuff(a,{key:'test:no-sp',flags:{noSp:true}});b.kill(enemy(b),null);near(a.skill.spTotal,0);near(u.skill.spTotal,2);
 b.removeBuff(a,'test:no-sp');cast(b,a);b.kill(enemy(b),null);near(a.skill.spTotal,0);
});
test('Folinic S1 selected source forward extension heals farther with original normal-speed projectile',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(FOL,{rank,others:[FAN]}),u=deploy(),a=deploy(FAN,3,4);wound(a);const base=u.s.atk;cast(b,u);near(u.s.atk,base*(1+bb(FOL,0,rank).atk));
  assert.equal(effectiveProfile(u).healProjectileSpeed,5);assert.ok(u.rangeKeySet.has((3+bb(FOL,0,rank).ability_range_forward_extend)*21+4));strike(b,u,[a],1);near(a.hp-100,u.s.atk);
 }
});
test('Folinic S2 prioritizes enemies over injured allies and original shell heals/damages each impact target once',()=>{
 const{b,deploy}=make(FOL,{skill:1,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,3,3);wound(a);wound(z);
 const e=enemy(b,{row:2,col:3}),other=enemy(b,{row:2,col:3.5}),far=enemy(b,{row:2,col:5});cast(b,u);
 const prof=effectiveProfile(u);assert.equal(acquireTargets(b,u,prof)[0].side,'enemy');near(prof.windup(b,u),.433);
 b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.4);near(e.hp,100000);near(a.hp,100);advance(b,.3);
 near(100000-e.hp,u.s.atk*2);near(100000-other.hp,u.s.atk*2);near(far.hp,100000);near(a.hp-100,u.s.atk*1.5);near(z.hp-100,u.s.atk*1.5);
});
test('Folinic S2 no-enemy fallback selects an injured ally and still applies area healing',()=>{
 const{b,deploy}=make(FOL,{skill:1,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,3,3);wound(a);wound(z);cast(b,u);
 assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);strike(b,u,[a],.8);near(a.hp-100,u.s.atk*1.5);near(z.hp-100,u.s.atk*1.5);
});
test('Folinic S2 accepts flying enemies, refuses hidden/stealthed primaries and preserves fired flight after withdrawal',()=>{
 const{b,deploy}=make(FOL,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);const e=enemy(b,{row:2,col:3,fly:true}),hidden=enemy(b),stealth=enemy(b,{col:5});hidden.hidden=true;
 b.addBuff(stealth,{key:'test:stealth',flags:{stealth:true}});cast(b,u);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);
 b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.45);assert.ok(b.projectiles.list.length);assert.ok(b.projectiles.list[0].data.arkpediaTrackedVisual);b.retreat(u);advance(b,.4);assert.ok(e.hp<100000);assert.ok(a.hp>100);
});
test('Folinic explicit environment flag reduces only source-flagged HP damage across promotion and potential',()=>{
 for(const[elite,potential,scale]of[[0,1,1],[1,1,1],[2,1,.6],[2,5,.5]]){
  const{b,deploy}=make(FOL,{elite,potential,rank:[4,7,10][elite]}),u=deploy();near(b.resistOf(u),elite? .5:0);
  for(const type of['phys','arts','true']){
   const ordinary=b.dealDamage(null,u,{amount:1000,type,canDodge:false});u.hp=u.s.maxHp;
   const flagged=b.dealDamage(null,u,{amount:1000,type,isEnvironment:true,canDodge:false});near(flagged,ordinary*scale);u.hp=u.s.maxHp;
  }
 }
});
test('environment normalization never classifies ordinary, periodic, sourceless or HPLOSS as environmental',()=>{
 const{b,deploy}=make(FOL),u=deploy();assert.equal(makeDamageInfo({amount:100,type:'arts',isDot:true,sourceless:true}).isEnvironment,false);
 assert.equal(makeDamageInfo({amount:100,isEnvironment:false}).isEnvironment,false);assert.equal(makeDamageInfo({amount:100,isEnvironment:true}).isEnvironment,true);
 near(b.dealDamage(null,u,{amount:100,type:'true',isDot:true,sourceless:true}),100);const hp=u.hp;b.loseHp(u,100);near(hp-u.hp,100);
 near(b.dealDamage(null,u,{amount:100,type:'true',isEnvironment:true}),60);
});
test('Whisperain exact source inner range applies far heal penalty once, on both normal and selected S1',()=>{
 for(const skillActive of[false,true]){
  const{b,deploy}=make(WHI,{others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),far=deploy(BEA,3,5);wound(a);wound(far);if(skillActive)cast(b,u);
  const p=effectiveProfile(u),nearScale=p.heal.scaleForTarget(b,u,a),farScale=p.heal.scaleForTarget(b,u,far);near(nearScale,1);near(farScale,.8);assert.equal(p.heal.farMul,null);
  const amounts=new Map();b.on('heal',ctx=>{if(ctx.source===u&&!ctx.opts.regen)amounts.set(ctx.target,ctx.amount);});
  b.forceAttack(u,[a,far]);u.atkCd=1000;advance(b,.6);assert.equal(amounts.size,2);
  near(amounts.get(a),u.s.atk*(skillActive?1.3:1));near(amounts.get(far),u.s.atk*.8*(skillActive?1.3:1));
 }
});
test('Whisperain S1 prioritizes abnormal injured allies, heals two and grants source rank timed resistance',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(WHI,{rank,others:[FAN,BEA,'char_106_franka']}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),c=deploy('char_106_franka',3,4);
  for(const p of[a,z,c])wound(p);a.hp=500;b.applyStatus(a,'stun',{duration:10});cast(b,u);
  const targets=acquireTargets(b,u,effectiveProfile(u));assert.equal(targets[0],a);assert.equal(targets.length,2);const direct=[];b.on('heal',ctx=>{if(ctx.source===u&&!ctx.opts.regen)direct.push(ctx.amount);});strike(b,u,targets,.6);for(const amount of direct)near(amount,u.s.atk*bb(WHI,0,rank).heal_scale);assert.equal(direct.length,2);
  near(b.resistOf(a),.5);advance(b,bb(WHI,0,rank)['status_resistance[limit]']+.05);near(b.resistOf(a),0);
 }
});
test('Whisperain S2 activates automatically, uses multiplicative BAT, original Skill_2 hit and unlimited duration',()=>{
 const{b,deploy}=make(WHI,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);u.skill.gainSp(u.skill.spCost,'test');const bat=u.s.bat;advance(b,.05);
 assert.ok(u.skill.active);near(u.s.bat,bat*.8);const p=effectiveProfile(u);near(p.windup(b,u),.333);assert.equal(p.attackVisual,'Skill_2');
 strike(b,u,[a],.4);near(b.resistOf(a),.5);advance(b,80);assert.ok(u.skill.active);near(u.skill.sp,0);b.retreat(u);assert.equal(u.skill.active,false);
});
test('Whisperain Tower of Life uses live source ATK, selected promotion/potential and no far trait penalty',()=>{
 for(const[elite,potential,ratio]of[[1,1,.03],[1,5,.04],[2,1,.06],[2,5,.07]]){
  const{b,deploy}=make(WHI,{elite,potential,rank:elite===1?7:10,others:[FAN]}),u=deploy(),a=deploy(FAN,3,5);wound(a);b.applyStatus(a,'resist',{key:'test:resist',value:.5});advance(b,.15);
  const hp=a.hp;advance(b,1);near(a.hp-hp,u.s.atk*ratio);b.addBuff(u,{key:'test:atk',mods:{atkPct:.5}});const next=a.hp;advance(b,1);near(a.hp-next,u.s.atk*ratio);
 }
});
test('Whisperain resistance aura removes on leaving range, resistance loss and source withdrawal with no stray heal',()=>{
 const{b,deploy}=make(WHI,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);b.applyStatus(a,'resist',{key:'test:resist',value:.5});advance(b,.15);assert.ok(a.findBuff(`whisperain:recovery:${u.id}`));
 b.removeBuff(a,'test:resist');advance(b,.15);assert.equal(a.findBuff(`whisperain:recovery:${u.id}`),null);const hp=a.hp;advance(b,1);near(a.hp,hp);
 b.applyStatus(a,'resist',{key:'test:resist',value:.5});advance(b,.15);a.x=7;a.tileC=7;advance(b,.15);assert.equal(a.findBuff(`whisperain:recovery:${u.id}`),null);
 a.x=3;a.tileC=3;advance(b,.15);b.retreat(u);assert.equal(a.findBuff(`whisperain:recovery:${u.id}`),null);const last=a.hp;advance(b,1);near(a.hp,last);
});
test('Whisperain recovery doubles with S2 and recipient final regeneration multipliers apply exactly once',()=>{
 const{b,deploy}=make(WHI,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);b.applyStatus(a,'resist',{key:'test:resist',value:.5});
 b.addBuff(a,{key:'test:regen-a',mods:{hpRegenMul:.5}});b.addBuff(a,{key:'test:regen-b',mods:{hpRegenMul:.4}});cast(b,u);advance(b,.15);const hp=a.hp;advance(b,1);near(a.hp-hp,u.s.atk*.06*2*.2);
 b.removeBuff(a,'test:regen-b');const half=a.hp;advance(b,1);near(a.hp-half,u.s.atk*.06*2*.5);
});
test('Whisperain regeneration respects actual original Beeswax token zero-recovery despite its healing-free target aura',()=>{
 const BEE='char_344_beewax';const{b,deploy}=make(WHI,{others:[build(BEE,{skill:1})]}),u=deploy(WHI,2,4),bee=deploy(BEE,1,4);enemy(b,{row:3,col:4});b.rng.pick=list=>list[0];cast(b,bee);advance(b,.8);
 const token=bee.mem.obelisk;assert.ok(token);token.hp=100;b.applyStatus(token,'resist',{key:'test:resist',value:.5});advance(b,.15);assert.ok(token.findBuff(`whisperain:recovery:${u.id}`));advance(b,1.1);near(token.hp,100);
});

test('Warfarin buff and SP selectors retain unhealable recipients because their source purpose is not HEAL',()=>{
 const MUSH='char_185_frncat';
 for(const skill of[0,1]){
  const{b,deploy}=make(WAR,{skill,others:[MUSH]}),u=deploy(),a=deploy(MUSH,2,3);a.skill.setSpTotal(0);
  b.addBuff(a,{key:'test:unhealable',flags:{noHeal:true,healFree:true}});b.rng.pick=list=>list.find(x=>x===a);
  if(skill===0){b.kill(enemy(b),null);near(a.skill.spTotal,2);}
  else{const atk=a.s.atk;cast(b,u);advance(b,.6);near(a.s.atk,atk*1.9);assert.ok(a.findBuff('warfarin:plasma'));}
 }
});

test('Ptilopsis source flat BAT seconds precede independent percent and final multipliers',()=>{
 const{b,deploy}=make(PTI,{skill:1}),u=deploy(),base=u.base.bat;
 b.addBuff(u,{key:'test:percent',mods:{batPct:.5}});b.addBuff(u,{key:'test:final',mods:{batMul:2}});cast(b,u);
 near(u.s.bat,(base+bb(PTI,1,10).base_attack_time)*1.5*2);
 u.skill.end('test');near(u.s.bat,base*1.5*2);
});
test('medic controls cancel unfired ordinary heals and plasma casts, while fired projectiles retain their source lifecycle',()=>{
 const{b,deploy}=make(WAR,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);cast(b,u);b.applyStatus(u,'stun',{duration:2});advance(b,1.3);
 assert.equal(a.findBuff('warfarin:plasma'),null);assert.equal(u.findBuff('warfarin:plasma'),null);assert.equal(u.mem.regularFormVisual,null);
 const second=make(FOL,{others:[FAN]}),f=second.deploy(),ally=second.deploy(FAN,2,3);wound(ally);second.b.forceAttack(f,[ally]);f.atkCd=1000;second.b.applyStatus(f,'stun',{duration:2});advance(second.b,1);near(ally.hp,100);assert.equal(second.b.projectiles.list.length,0);
});
test('Warfarin brief control irreversibly cancels the unfired plasma cast before the recovered source release',()=>{
 const{b,deploy}=make(WAR,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);
 cast(b,u);advance(b,.1);b.applyStatus(u,'stun',{duration:.1});advance(b,.15);
 assert.equal(u.canAct,true);assert.equal(u.findBuff('warfarin:cast'),null);assert.equal(u.mem.regularFormVisual,null);
 advance(b,1);assert.equal(a.findBuff('warfarin:plasma'),null);assert.equal(u.findBuff('warfarin:plasma'),null);
 // A new authorized activation remains possible after the interrupted cast.
 cast(b,u);advance(b,.55);assert.ok(a.findBuff('warfarin:plasma'));assert.ok(u.findBuff('warfarin:plasma'));
});
