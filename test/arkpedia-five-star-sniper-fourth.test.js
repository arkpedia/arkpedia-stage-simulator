// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-sniper-fourth-prefabs.json' with { type: 'json' };
import heyakEvidence from '../data/arkpedia-hoolheyak-prefabs.json' with { type: 'json' };
import { FIVE_STAR_SNIPER_FOURTH_OPERATORS } from '../shared/arkpedia/five-star-sniper-fourth-operators.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const EX='char_279_excu',AO='char_346_aosta',ER='char_4043_erato';
const near=(a,z,t=1e-5)=>assert.ok(Math.abs(a-z)<t,`${a} != ${z}`);
const nodes=rows=>rows.flatMap(r=>r.components);
function make(id,{skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
 const d=structuredClone(data);assert.ok(d.operators[id],`Reviewed snapshot required: ${id}`);
 d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const o=d.operators[id],build={...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build]});b.autoFinish=false;b.timeLimit=Infinity;b.setViewport('fullscreen-workspace');
 b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(id,1,5,dir);assert.ok(u);u.atkCd=1000;return{b,u};
}
function advance(b,seconds){for(let i=0;i<Math.round(seconds/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function enemy(b,x=6,y=1,{hp=100000,def=0,flying=false,weight=1}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=x;e.y=y;e.base.maxHp=e.hp=hp;e.base.def=def;e.base.res=0;
 e.base.moveSpeed=0;e.base.massLevel=weight;if(flying)e.motion='FLY';e.markDirty();b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.gainSp(u.skill.spCost*u.skill.maxCharges,'test');assert.equal(b.activateOperator(u.defId),true);u.atkCd=1000;}
function shoot(b,u,e,t){assert.equal(b.forceAttack(u,[e]),true);advance(b,t);}
function readyAuto(u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.onAboutToAttack(),true);}

test('fourth sniper durable source retains original wave count/formula kinds/projectiles and whole-kit deferrals',()=>{
 assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);assert.equal(Object.keys(FIVE_STAR_SNIPER_FOURTH_OPERATORS).length,3);
 // These are historical whole-kit deferrals. Ho'olheyak and Ebenholz now have separate bounded full-kit reviews.
 for(const id of['char_4027_heyak','char_4046_ebnhlz'])assert.ok(evidence.deferredOperators[id].reason.length>180);
 assert.deepEqual(REGULAR_OPERATORS.char_4046_ebnhlz.skillIds,['skchr_ebnhlz_1','skchr_ebnhlz_2','skchr_ebnhlz_3']);
 assert.deepEqual(REGULAR_OPERATORS.char_4027_heyak.skillIds,Object.keys(heyakEvidence.tables.skills));
 assert.deepEqual(heyakEvidence.enabledOperators,['char_4027_heyak']);
 for(const id of[EX,AO,ER])for(const face of['Front','Back']){assert.match(evidence.models[id][face].sha256,/^[a-f0-9]{64}$/);assert.equal(evidence.officialSkeletonBindings[id][face].sha256,evidence.models[id][face].sha256);}
 const multi=nodes(evidence.characters[EX]).find(c=>c._additionalTimes===1);assert.equal(multi._waitAttackEventForAllAttacks,1);assert.equal(multi._splitDamage,0);
 assert.deepEqual(evidence.models[EX].Front.hits.Skill_Right_Loop,[.1,.267]);near(evidence.models[EX].Front.durations.Skill_Right_Begin,.667);
 assert.equal(nodes(evidence.skills.skchr_excu_2).find(c=>c._buffs)._buffs[0].attributes.attributeModifiers[0].formulaItem,0);
 assert.equal(nodes(evidence.skills.skchr_aosta_2).find(c=>c._buffs)._buffs[0].attributes.attributeModifiers[1].formulaItem,1);
 const dot=nodes(evidence.characters[AO]).find(c=>c._additiveActiveBuffs?.[0]?.buffKey==='aosta_t_1')._additiveActiveBuffs[0];
 assert.equal(dot.overrideType,3);assert.equal(dot.takeSnapshotWhenExtend,1);assert.equal(dot.waitFirstTriggerInterval,1);near(dot.triggerInterval,1);
 assert.equal(evidence.templates.aosta_t_1.eventToActions.ON_BUFF_TRIGGER[2]._attackType,'BUFF');
 for(const key of['projectile_chr_erato','projectile_chr_erato_s1','projectile_chr_erato_s2'])near(nodes(evidence.projectiles[key]).find(c=>c._speed)._speed,30);
 assert.equal(nodes(evidence.skills.skchr_erato_1).find(c=>c._recoverSpIfTargetDead!=null)._recoverSpIfTargetDead,1);
 assert.ok(evidence.runtimeMapping[ER].sleepOrdering.includes('unverified'));
});

test('both complete fourth sniper skills load every source rank and selected ATK/BAT/ASPD composition',()=>{
 for(const[id,cfg]of Object.entries(FIVE_STAR_SNIPER_FOURTH_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,u}=make(id,{skill,rank});assert.equal(u.skill.id,cfg.skillIds[skill]);assert.equal(u.skill.noSkill,false);
  b.addBuff(u,{key:'external:bat',mods:{batFlat:.2,batPct:.1,batMul:.8}});
  if(id===ER&&skill===0){enemy(b,7);readyAuto(u);near(effectiveProfile(u).atkScale,u.skill.bb.atk_scale);}
  else{cast(b,u);const bb=u.skill.bb;near(u.s.atk,u.base.atk*(1+(bb.atk??0)));
   near(u.s.aspd,100+(bb.attack_speed??0));near(u.s.bat,(u.base.bat+.2+(id===EX&&skill===1?bb.base_attack_time:0))*(1.1+(id===AO&&skill===1?bb.base_attack_time:0))*.8);}
  assert.deepEqual(b.errors,[]);
 }
});

test('Executor promotion/potential flat DEF ignore mitigates after the native front-row ATK scale',()=>{
 for(const[elite,potential,ignore]of[[0,1,0],[1,1,80],[1,5,95],[2,1,160],[2,5,175]]){
  const{b,u}=make(EX,{elite,potential,rank:[4,7,10][elite]}),front=enemy(b,6,1,{def:300}),far=enemy(b,7,1,{def:300});
  const atk=u.s.atk;shoot(b,u,front,.7);near(100000-front.hp,atk*1.5-(300-ignore));near(100000-far.hp,atk-(300-ignore));
 }
});

test('Executor S1 applies exactly one1.5 trait scale to every legal range victim including air',()=>{
 const{b,u}=make(EX),front=enemy(b),far=enemy(b,7,1),air=enemy(b,7,2,{flying:true}),outside=enemy(b,8,1);
 cast(b,u);const atk=u.s.atk;shoot(b,u,front,.7);for(const e of[front,far,air])near(100000-e.hp,atk*1.5);near(outside.hp,100000);
});

test('natural spread attacks resolve each target once and select victims at the release',()=>{
 for(const id of[EX,AO]){
  const{b,u}=make(id),a=enemy(b),c=enemy(b,6,2),outside=enemy(b,8,1);u.atkCd=0;advance(b,.3);
  c.x=8;outside.x=7;b._buildEnemyIndex();advance(b,.5);near(100000-a.hp,u.s.atk*1.5);near(c.hp,100000);near(100000-outside.hp,u.s.atk);
  assert.equal(u.stats.attacks,1);
 }
});

test('Executor native directional normal/S1 clips remain literal while source S2 controller uses its Right aliases',()=>{
 for(const[dir,normal]of[['DOWN','Attack_Down'],['UP','Attack_Up'],['RIGHT','Attack'],['LEFT','Attack']]){
  for(const skill of[0,1]){
   const{b,u}=make(EX,{dir,skill});assert.equal(effectiveProfile(u).attackVisual(b,u),normal);
   near(effectiveProfile(u).windup(b,u),.533);cast(b,u);
   if(!skill)assert.equal(effectiveProfile(u).attackVisual(b,u),normal);
   else assert.equal(effectiveProfile(u).attackVisual(b,u).loop,'Skill_Right_Loop');
  }
 }
});

test('Executor S2 waits first-only native Begin, then sends two separated full-strength waves',()=>{
 const{b,u}=make(EX,{skill:1}),a=enemy(b),c=enemy(b,7,1);cast(b,u);const atk=u.s.atk,rate=u.base.bat/u.s.interval;
 near(effectiveProfile(u).windup(b,u),(.667+.1)/rate);b.forceAttack(u,[a]);advance(b,.4);near(a.hp,100000);
 const visual=b._evq.filter(e=>e[0]==='atk').at(-1)[4].animation;
 assert.deepEqual(visual,{begin:'Skill_Right_Begin',loop:'Skill_Right_Loop',beginDuration:.667/rate});
 advance(b,.1333);near(100000-a.hp,atk*1.5);near(100000-c.hp,atk);advance(b,.1333);near(100000-a.hp,atk*3);near(100000-c.hp,atk*2);
 near(effectiveProfile(u).windup(b,u),.1/rate);const hp=a.hp;b.forceAttack(u,[a]);advance(b,.1);near(hp-a.hp,atk*1.5);
});

test('Executor second wave refreshes legal range membership without duplicating the first wave',()=>{
 const{b,u}=make(EX,{skill:1}),a=enemy(b),c=enemy(b,8,1);cast(b,u);u.mem.executorBegun=true;const atk=u.s.atk;
 b.forceAttack(u,[a]);advance(b,.1);near(100000-a.hp,atk*1.5);near(c.hp,100000);a.x=8;c.x=7;b._buildEnemyIndex();
 advance(b,.13);near(100000-a.hp,atk*1.5);near(100000-c.hp,atk);
});

test('Executor brief control and skill end permanently cancel the pending second wave',()=>{
 for(const reason of['stun','end','retreat']){
  const{b,u}=make(EX,{skill:1}),a=enemy(b);cast(b,u);u.mem.executorBegun=true;const atk=u.s.atk;
  b.forceAttack(u,[a]);advance(b,.1);near(100000-a.hp,atk*1.5);
  if(reason==='stun')b.applyStatus(u,'stun',{duration:.04});else if(reason==='end')u.skill.end('test');else b.retreatOperator(EX);
  advance(b,.25);near(100000-a.hp,atk*1.5);
 }
});

test('Executor natural S2 keeps double waves at its selected interval with multiple victims',()=>{
 const{b,u}=make(EX,{skill:1}),a=enemy(b),c=enemy(b,7,1);cast(b,u);const atk=u.s.atk;u.atkCd=0;advance(b,3.4);
 assert.equal(u.stats.attacks,3);near(100000-a.hp,atk*1.5*6);near(100000-c.hp,atk*6);
});

test('Aosta promotion and potential bleed use cached ATK, Arts resistance and no spread trait',()=>{
 for(const[elite,potential,scale]of[[0,1,0],[1,1,.12],[1,5,.14],[2,1,.18],[2,5,.2]]){
  const{b,u}=make(AO,{elite,potential,rank:[4,7,10][elite]}),a=enemy(b);a.base.res=50;a.markDirty();const atk=u.s.atk;
  shoot(b,u,a,.73);const hp=a.hp;b.addBuff(u,{key:'later-atk',mods:{atkPct:1}});advance(b,1.05);near(hp-a.hp,atk*scale*.5);
 }
});

test('Aosta bleed is attached while blocked but checks current blocking on each one-second tick',()=>{
 const{b,u}=make(AO),a=enemy(b);a.blockedBy=u;u.blocking.push(a);const atk=u.s.atk;shoot(b,u,a,.73);const hp=a.hp;assert.ok(a.findBuff('aosta:bleed'));
 advance(b,1.05);near(a.hp,hp);a.blockedBy=null;advance(b,1);near(hp-a.hp,atk*.18);
 a.blockedBy=u;advance(b,1);near(hp-a.hp,atk*.18);assert.equal(a.findBuff('aosta:bleed'),null);
});

test('Aosta EXTEND preserves cadence, replaces the ATK snapshot and emits three native delayed pulses',()=>{
 const{b,u}=make(AO),a=enemy(b);shoot(b,u,a,.73);advance(b,.2);const original=a.findBuff('aosta:bleed'),phase=original._acc;
 b.addBuff(u,{key:'refresh-atk',mods:{atkPct:1}});b.forceAttack(u,[a]);advance(b,.73);assert.equal(a.findBuff('aosta:bleed'),original);
 assert.ok(original._acc>phase);const hp=a.hp,atk=u.s.atk;advance(b,.2);near(hp-a.hp,atk*.18);
 advance(b,2);near(hp-a.hp,atk*.18*3);advance(b,.8);near(hp-a.hp,atk*.18*3);assert.equal(a.findBuff('aosta:bleed'),null);
});

test('Aosta S1 preserves both spread and bleed while source quickattack ATK/ASPD apply once',()=>{
 const{b,u}=make(AO),a=enemy(b),c=enemy(b,7,1);cast(b,u);near(u.s.atk,u.base.atk*1.45);near(u.s.aspd,145);
 const atk=u.s.atk;shoot(b,u,a,.73);near(100000-a.hp,atk*1.5);near(100000-c.hp,atk);advance(b,1);near(100000-a.hp,atk*(1.5+.18));
});

test('Aosta S2 binds every victim and doubles only cached bleed while BAT uses percentage bucket',()=>{
 const{b,u}=make(AO,{skill:1}),a=enemy(b),c=enemy(b,7,1),air=enemy(b,6,2,{flying:true});cast(b,u);near(u.s.bat,u.base.bat*1.5);
 const atk=u.s.atk;shoot(b,u,a,1.07);for(const e of[a,c,air]){assert.ok(e.s.flags.bind);near(e.findBuff('aosta:bleed').data.amount,atk*.36);}
 near(100000-a.hp,atk*1.5);near(100000-c.hp,atk);advance(b,1);near(100000-a.hp,atk*(1.5+.36));
 u.skill.end('test');near(u.s.bat,u.base.bat);advance(b,.5);assert.ok(!a.s.flags.bind);
});

test('Aosta born cached bleed survives owner withdrawal and expires without new attacks',()=>{
 const{b,u}=make(AO),a=enemy(b);const atk=u.s.atk;shoot(b,u,a,.73);const hp=a.hp;b.retreatOperator(AO);advance(b,3.1);
 near(hp-a.hp,atk*.18*3);assert.equal(a.findBuff('aosta:bleed'),null);
});

test('Erato sleeping-only DEF ignore follows each promotion and ordinary awake targets retain full DEF',()=>{
 for(const[elite,pct]of[[0,0],[1,.4],[2,.5]]){
  const{b,u}=make(ER,{elite,rank:[4,7,10][elite]}),awake=enemy(b,6,1,{def:300}),asleep=enemy(b,7,1,{def:300});
  b.applyStatus(asleep,'sleep',{duration:10});const atk=u.s.atk;shoot(b,u,awake,.7);near(100000-awake.hp,atk-300);
  shoot(b,u,asleep,.7);near(100000-asleep.hp,atk-300*(1-pct));assert.ok(asleep.s.flags.sleep);
 }
});

test('Erato normal chooses heaviest and S2 overrides with sleeping priority while respecting legality',()=>{
 const{b,u}=make(ER,{skill:1}),heavy=enemy(b,7,1,{weight:5}),sleep=enemy(b,8,1,{weight:1}),hidden=enemy(b,7,2,{weight:8});
 hidden.hidden=true;b.applyStatus(sleep,'sleep',{duration:10});assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],heavy);
 cast(b,u);advance(b,.4);assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],sleep);sleep.hidden=true;assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],heavy);
 b.addBuff(heavy,{key:'stealth',flags:{stealth:true}});assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,0);
});

test('Erato S1 AUTO charge damages and newly sleeps one target with explicitly retained active-buff ordering',()=>{
 const{b,u}=make(ER),a=enemy(b,7,1,{def:300}),c=enemy(b,7.2,1);readyAuto(u);const atk=u.s.atk;
 b.forceAttack(u,[a]);advance(b,.5);near(a.hp,100000);advance(b,.2);near(100000-a.hp,atk*2.4-150);assert.ok(a.s.flags.sleep);
 near(c.hp,100000);assert.equal(u.skill.active,false);near(a.findBuff('sleep').duration,5);
});

test('Erato S1 Sleep immunity prevents conditional DEF ignore while an already sleeping target retains it',()=>{
 const{b,u}=make(ER),a=enemy(b,7,1,{def:300});a.def={...a.def,immune:new Set([...a.def.immune,'sleep'])};readyAuto(u);const atk=u.s.atk;shoot(b,u,a,.7);
 assert.ok(!a.s.flags.sleep);near(100000-a.hp,atk*2.4-300);
});

test('Erato S1 refunds a dead pre-emission input but does not refund an emitted flight or spend on interrupted startup',()=>{
 const{b,u}=make(ER),a=enemy(b,8);readyAuto(u);b.forceAttack(u,[a]);advance(b,.2);b.kill(a);advance(b,.5);
 assert.equal(u.skill.active,false);assert.equal(u.skill.charges,1);assert.equal(u.mem.eratoProjectiles.size,0);
 const secondBattle=make(ER),v=secondBattle.u,z=enemy(secondBattle.b,8);readyAuto(v);secondBattle.b.forceAttack(v,[z]);
 advance(secondBattle.b,.57);assert.equal(v.mem.eratoProjectiles.size,1);secondBattle.b.kill(z);advance(secondBattle.b,.2);assert.equal(v.skill.charges,0);
 const third=make(ER),w=third.u,target=enemy(third.b,7);readyAuto(w);third.b.forceAttack(w,[target]);
 third.b.applyStatus(w,'stun',{duration:.1,source:target});advance(third.b,.7);near(target.hp,100000);assert.equal(w.skill.pending,true);
});

test('Erato source projectile30 launches at cap1 event and waits until legal impact before another natural attack',()=>{
 const{b,u}=make(ER,{skill:1}),a=enemy(b,8,1);b.addBuff(u,{key:'fast',mods:{aspd:300}});near(effectiveProfile(u).windup(b,u),.533);
 const atk=u.s.atk;b.forceAttack(u,[a]);advance(b,.53);near(a.hp,100000);advance(b,.04);assert.equal(u.mem.eratoProjectiles.size,1);
 advance(b,.13);near(100000-a.hp,atk);assert.equal(u.mem.eratoProjectiles.size,0);
 cast(b,u);assert.ok(u.s.flags.disarm);advance(b,.4);near(effectiveProfile(u).windup(b,u),.5);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');
});

test('Erato born projectile survives withdrawal but target hiding or redeploy invalidates impact',()=>{
 for(const scenario of['retreat','hidden','redeploy']){
  const{b,u}=make(ER,{skill:1}),a=enemy(b,8,1);const atk=u.s.atk;b.forceAttack(u,[a]);advance(b,.57);
  if(scenario==='retreat')b.retreatOperator(ER);else if(scenario==='hidden')a.hidden=true;else a.deploySeq++;
  advance(b,.2);near(100000-a.hp,scenario==='retreat'?atk:0);
 }
});

test('Erato emitted sleeping-target penetration and S1 Sleep persist independently of withdrawn owner hooks',()=>{
 for(const skill of[0,1]){
  const{b,u}=make(ER,{skill}),a=enemy(b,8,1,{def:300});
  if(skill)b.applyStatus(a,'sleep',{duration:10});else readyAuto(u);
  const atk=u.s.atk;b.forceAttack(u,[a]);advance(b,.57);assert.equal(u.mem.eratoProjectiles.size,1);
  b.retreatOperator(ER);advance(b,.2);near(100000-a.hp,atk*(skill?1:2.4)-150);
  assert.ok(a.s.flags.sleep);assert.equal(u.mem.eratoProjectiles.size,0);
  const awake=enemy(b,7,1,{def:300});const hp=awake.hp;
  b.dealDamage(u,awake,{amount:atk,type:'phys',isAttack:true});near(hp-awake.hp,atk-300);
 }
});

test('Erato S2 startup holds attacks, consumes full duration, then restores normal selector/profile/SP',()=>{
 const{b,u}=make(ER,{skill:1}),a=enemy(b,7);cast(b,u);u.atkCd=0;advance(b,.3);assert.equal(u.stats.attacks,0);advance(b,.5);assert.equal(u.stats.attacks,1);
 u.atkCd=1000;assert.ok(u.skill.active);assert.equal(skillHud(u.skill).ready,false);advance(b,19.3);assert.equal(u.skill.active,false);
 near(u.s.aspd,100);near(u.s.atk,u.base.atk);assert.equal(effectiveProfile(u).attackVisual(b,u),'Attack');advance(b,1);assert.ok(u.skill.sp>0);
});
