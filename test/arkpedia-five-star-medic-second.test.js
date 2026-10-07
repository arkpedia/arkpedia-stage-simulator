// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-medic-second-prefabs.json' with { type: 'json' };
import { FIVE_STAR_MEDIC_SECOND_OPERATORS } from '../shared/arkpedia/five-star-medic-second-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { registerBerryProtection } from '../server/sim/content/arkpedia-five-star-medic-second.js';
const TUY='char_402_tuye',CEY='char_348_ceylon',PAP='char_4071_peper',HON='char_449_glider',MUL='char_473_mberry',FAN='char_123_fang',BEA='char_122_beagle',KRO='char_124_kroos',WHI='char_436_whispr';
const near=(a,e,tol=1e-5)=>assert.ok(Math.abs(a-e)<tol,`${a} != ${e}`);
const advance=(b,s)=>{for(let n=0;n<Math.round(s/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);};
function build(id,{skill=0,rank=10,elite=2,potential=1}={}){const o=data.operators[id];assert.ok(o,`Reviewed snapshot required: ${id}`);return{...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:rank};}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[],tags=[]}={}){
 const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;source.stage.mapTags=tags;
 const b=new StandardBattle(source,{operators:[build(id,{skill,rank,elite,potential}),...others.map(a=>typeof a==='string'?defaultBuild(source.operators[a]):a)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(who=id,r=1,c=4,dir='UP')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,r,c,dir);assert.ok(u,`${who} on ${r},${c}`);u.atkCd=1000;return u;};return{b,deploy};
}
function cast(b,u){u.skill.gainSp(u.skill.spCost*u.skill.maxCharges,'test');assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
const wound=(u,n=10000,hp=100)=>{u.base.maxHp=n;u.markDirty();void u.s;u.hp=hp;};
const bb=(id,s,r=10)=>Object.fromEntries(data.operators[id].skills[s].levels[r-1].blackboard.map(x=>[x.key,x.value]));
const shot=(b,u,a,s=1)=>{b.forceAttack(u,a);u.atkCd=1000;advance(b,s);};

test('second medic original bundles, all ten selected skills, timing and native selector boundaries are retained',()=>{
 for(const[id,c]of Object.entries(FIVE_STAR_MEDIC_SECOND_OPERATORS)){
  assert.match(evidence.sourceBundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  assert.match(evidence.models[id].Front.sha256,/^[a-f0-9]{64}$/);
  for(const sid of c.skillIds)assert.ok(evidence.skills[sid.split('[')[0]].length);
 }
 const normal=evidence.characters[TUY].find(x=>x.pathId==='7134400750646614811');assert.equal(normal._maxHpRatio,.5);assert.equal(normal._maxHpExcludeEqual,0);
 const emergency=evidence.skills.skchr_tuye_2.find(x=>x.pathId==='617794658286534343');assert.equal(emergency._maxHpExcludeEqual,0);
 const jump=evidence.projectiles.projectile_chr_peper_logic.find(x=>x._filterType===39);assert.equal(jump._maxTarget,3);assert.equal(jump._targetMotion,3);
 assert.equal(evidence.buffTemplates.peper_t_1.eventToActions.ON_BUFF_START[0]._condType,'LT');
 assert.equal(evidence.buffTemplates.mberry_s_2.eventToActions.ON_APPLYING_MODIFIER[1]._isStackable,false);
 assert.equal(evidence.frameParity,false);
});

test('every reviewed second-medic rank loads the exact selected skill and promotion unlock',()=>{
 for(const[id,c]of Object.entries(FIVE_STAR_MEDIC_SECOND_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,c.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
});

test('all five ordinary source heals wait for original OnAttack and flight and reject isolated/heal-free recipients',()=>{
 for(const id of Object.keys(FIVE_STAR_MEDIC_SECOND_OPERATORS)){
  const{b,deploy}=make(id,{others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a);wound(z);
  b.addBuff(z,{key:'test:isolated',flags:{isolated:true}});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);
  b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.2);near(a.hp,100);advance(b,1);assert.ok(a.hp>100);near(z.hp,100);
  b.removeBuff(z,'test:isolated');b.addBuff(z,{key:'test:free',flags:{healFree:true}});assert.equal(acquireTargets(b,u,effectiveProfile(u)).includes(z),false);
 }
});

test('Tuye four-second no-heal talent changes healing only and source output restarts its delay',()=>{
 for(const[elite,potential,scale]of[[0,1,1],[1,1,1.3],[1,5,1.35],[2,1,1.5],[2,5,1.55]]){
  const{b,deploy}=make(TUY,{elite,potential,rank:[4,7,10][elite],others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,100000);
  const atk=u.s.atk;shot(b,u,[a],.7);near(a.hp-100,atk);advance(b,4);const hp=a.hp;shot(b,u,[a],.7);near(a.hp-hp,atk*scale);
  const next=a.hp;shot(b,u,[a],.7);near(a.hp-next,atk);near(u.s.atk,atk);
 }
});

test('Tuye S1 original delayed heal grants selected-rank ATK barrier without amplifying it by talent',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(TUY,{rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,100000);advance(b,4);const atk=u.s.atk;cast(b,u);
  advance(b,.4);near(a.hp,100);assert.equal(a.findBuff('tuye:barrier'),null);advance(b,.25);near(a.hp-100,atk*1.5);
  const shield=a.findBuff('tuye:barrier');near(shield.shield,atk*bb(TUY,0,rank).atk_scale);const hp=a.hp;
  b.dealDamage(null,a,{amount:100,type:'true',canDodge:false});near(a.hp,hp);near(shield.shield,atk*bb(TUY,0,rank).atk_scale-100);
  advance(b,bb(TUY,0,rank).duration+.05);assert.equal(a.findBuff('tuye:barrier'),null);
 }
});

test('Tuye S1 brief control cancels the unfired manual cast permanently, fired barrier survives withdrawal',()=>{
 const{b,deploy}=make(TUY,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);
 advance(b,.1);b.applyStatus(u,'stun',{duration:.1});advance(b,.6);near(a.hp,100);assert.equal(a.findBuff('tuye:barrier'),null);assert.equal(u.mem.tuyeCasting,false);
 u.skill.opReadyAt=-Infinity;cast(b,u);advance(b,.45);assert.ok(b.projectiles.list.length);b.retreat(u);advance(b,.3);assert.ok(a.hp>100);assert.ok(a.findBuff('tuye:barrier'));
});

test('Tuye S2 includes exact native half-HP threshold and excludes allies just above it',()=>{
 const{b,deploy}=make(TUY,{skill:1,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a,10000,5000);wound(z,10000,5000.01);cast(b,u);
 assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);near(u.s.atk,u.base.atk*1.6);assert.equal(u.skill.gainSp(20,'gift'),0);
});

test('Tuye S2 three source emergency heals consume only successful casts, wait predelay and preserve third fired ATK',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(TUY,{skill:1,rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,100000,100);cast(b,u);
  const atk=u.s.atk,amount=atk*bb(TUY,1,rank).heal_scale;advance(b,.5);near(a.hp,100);assert.equal(u.mem.tuyeEmergencyLeft,3);
  advance(b,.4);near(a.hp-100,amount);assert.equal(u.mem.tuyeEmergencyLeft,2);
  advance(b,2.2);near(a.hp-100,amount*3);assert.equal(u.mem.tuyeEmergencyLeft,0);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);
 }
});

test('Tuye emergency exact selected HP threshold is eligible, brief stun cancels unfired bullet without spending it',()=>{
 const{b,deploy}=make(TUY,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,100000,20000);cast(b,u);advance(b,.15);assert.equal(u.mem.tuyeCasting,true);
 b.applyStatus(u,'stun',{duration:.1});advance(b,.6);near(a.hp,20000);assert.equal(u.mem.tuyeEmergencyLeft,3);
 advance(b,1);assert.ok(a.hp>20000);assert.equal(u.mem.tuyeEmergencyLeft,2);
});

test('Ceylon normal far penalty uses exact inner range, selected S1 disables it and consumes one stored charge',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(CEY,{rank,others:[FAN]}),u=deploy(),a=deploy(FAN,3,5);wound(a,100000);shot(b,u,[a],.8);near(a.hp-100,u.s.atk*.8);
  cast(b,u);const charges=u.skill.charges,hp=a.hp;shot(b,u,[a],.8);near(a.hp-hp,u.s.atk*bb(CEY,0,rank).heal_scale);assert.equal(u.skill.charges,charges);assert.equal(u.skill.active,false);
 }
});

test('Ceylon water talent follows source stage tag and promotion/potential, never terrain guesses',()=>{
 for(const[elite,potential,common,water]of[[0,1,0,0],[1,1,.03,.06],[1,5,.04,.11],[2,1,.05,.13],[2,5,.06,.18]])for(const wet of[false,true]){
  const{deploy}=make(CEY,{elite,potential,rank:[4,7,10][elite],tags:wet?['water']:[]}),u=deploy();near(u.s.atk,u.base.atk*(1+common+(wet?water:0)));
 }
});

test('Ceylon S2 heals two with selected ATK, grants owned in-range Resist and cleans up without removing another source',()=>{
 const{b,deploy}=make(CEY,{skill:1,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),far=deploy(KRO,1,7);wound(a);wound(z);wound(far);
 b.applyStatus(a,'resist',{key:'test:other',value:.2});cast(b,u);near(b.resistOf(a),.5);near(b.resistOf(z),.5);near(b.resistOf(far),0);
 const selected=acquireTargets(b,u,effectiveProfile(u));assert.equal(selected.length,2);shot(b,u,selected,.8);assert.ok(a.hp>100&&z.hp>100);
 z.tileC=7;z.x=7;advance(b,.05);near(b.resistOf(z),0);u.skill.end('test');near(b.resistOf(a),.2);u.skill.opReadyAt=-Infinity;cast(b,u);b.retreat(u);near(b.resistOf(a),.2);
});

test('Paprika source chain flies through at most three distinct adjacent allies with per-bounce falloff and flat talent heal',()=>{
 const{b,deploy}=make(PAP,{others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,3,3),c=deploy(KRO,2,4);for(const x of[a,z,c])wound(x,100000);
 const amounts=new Map();b.on('heal',ctx=>{if(ctx.source===u)amounts.set(ctx.target,(amounts.get(ctx.target)??0)+ctx.amount);});
 b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.5);near(a.hp,100);advance(b,.15);assert.ok(a.hp>100);near(z.hp,100);near(c.hp,100);
 advance(b,.4);assert.equal(amounts.size,3);const values=[...amounts.values()];near(values[0],u.s.atk+140);near(values[1],u.s.atk*.75+140);near(values[2],u.s.atk*.75**2+140);
});

test('Paprika bounce uses source adjacent tiles rather than generic radius and can leave original healer range',()=>{
 const{b,deploy}=make(PAP,{others:[FAN,BEA,'char_106_franka']}),u=deploy(),a=deploy(FAN,3,5),z=deploy(BEA,3,6),far=deploy('char_106_franka',3,3);for(const x of[a,z,far])wound(x,100000);
 assert.equal(u.rangeKeySet.has(3*21+6),false);shot(b,u,[a],1.2);assert.ok(a.hp>100&&z.hp>100);near(far.hp,100);
});

test('Paprika primary WALK restriction does not forbid flying secondary chain targets',()=>{
 const{b,deploy}=make(PAP,{others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),air=deploy(BEA,3,3);wound(a,100000);wound(air,100000);air.motion='FLY';
 assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);shot(b,u,[a],1);assert.ok(air.hp>100);
});

test('Paprika talent exact strict threshold, promotion/potential and S2 raised threshold are source based',()=>{
 for(const[elite,potential,extra]of[[0,1,0],[1,1,80],[1,5,90],[2,1,140],[2,5,150]]){
  const{b,deploy}=make(PAP,{elite,potential,rank:[4,7,10][elite],others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,100000,39999);shot(b,u,[a],.8);near(a.hp-39999,u.s.atk+extra);
  a.hp=40000;shot(b,u,[a],.8);near(a.hp-40000,u.s.atk);
 }
 const{b,deploy}=make(PAP,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,100000,79999);cast(b,u);shot(b,u,[a],.8);near(a.hp-79999,u.s.atk+140);
});

test('Paprika selected S1 ASPD and S2 fourth bounce preserve actual original skill clips',()=>{
 for(const rank of[1,7,10]){
  const x=make(PAP,{rank}),u=x.deploy();cast(x.b,u);near(u.s.aspd,100+bb(PAP,0,rank).attack_speed);near(effectiveProfile(u).windup(x.b,u),.433);
  const{b,deploy}=make(PAP,{skill:1,rank,others:[FAN,BEA,KRO,'char_106_franka']}),p=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,3,3),c=deploy(KRO,2,4),d=deploy('char_106_franka',3,4);
  for(const q of[a,z,c,d])wound(q,100000);const atk=p.s.atk;cast(b,p);near(p.s.atk,atk*(1+bb(PAP,1,rank).atk));const prof=effectiveProfile(p);assert.equal(prof.attackVisual,'Skill_2_Loop');near(prof.windup(b,p),.267);shot(b,p,[a],1);assert.ok([a,z,c,d].every(q=>q.hp>100));
  p.skill.end('test');advance(b,.35);assert.equal(p.mem.regularFormVisual,null);
 }
});

test('Honeyberry S1 picks two highest elemental injuries, recovers HP/trait EP and performs exactly three later ticks',()=>{
 const{b,deploy}=make(HON,{others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),c=deploy(KRO,2,4);for(const q of[a,z,c])wound(q,100000);a.elem.burn=10000;z.elem.neural=20000;c.elem.erosion=30000;
 cast(b,u);const selected=acquireTargets(b,u,effectiveProfile(u));assert.deepEqual(selected,[c,z]);const atk=u.s.atk;shot(b,u,selected,1);near(c.elem.erosion,30000-atk*.5);near(z.elem.neural,20000-atk*.5);near(a.elem.burn,10000);near(c.hp-100,atk);
 advance(b,3.2);near(c.elem.erosion,30000-atk*3.5);near(z.elem.neural,20000-atk*3.5);assert.equal(c.findBuff('honeyberry:recovery'),null);
});

test('Honeyberry and Mulberry charged heals activate naturally for full HP elemental injury without an HP wound',()=>{
 for(const id of[HON,MUL]){
  const{b,deploy}=make(id,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);a.elem.burn=10000;const hp=a.hp;u.skill.setSpTotal(u.skill.spCost);u.atkCd=0;advance(b,1);
  assert.equal(u.skill.activations,1);assert.ok(a.elem.burn<10000);near(a.hp,hp);
 }
});

test('Honeyberry S1 recipient recovery survives withdrawal, uses selected rank and does not touch burst-locked gauges',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(HON,{rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);a.elem.burn=10000;cast(b,u);shot(b,u,[a],1);assert.ok(a.findBuff('honeyberry:recovery'));b.retreat(u);
  const start=a.elem.burn;advance(b,1);near(start-a.elem.burn,u.s.atk*bb(HON,0,rank)['glider_s_1.ep_heal_ratio']);
  b.addBuff(a,{key:'test:burst',flags:{burstLock:true}});const locked=a.elem.burn;advance(b,1);near(a.elem.burn,locked);
 }
});

test('Honeyberry S2 selected-rank ATK, highest EP three-target priority, eventless predelay and original form cleanup',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(HON,{skill:1,rank,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),c=deploy(KRO,2,4);for(const q of[a,z,c])wound(q,100000);a.elem.burn=30000;z.elem.neural=10000;c.elem.burn=20000;
  const atk=u.s.atk;cast(b,u);near(u.s.atk,atk*(1+bb(HON,1,rank).atk));const p=effectiveProfile(u);assert.equal(p.windup,.2);assert.equal(p.attackVisual,'none');const selected=acquireTargets(b,u,p);assert.equal(selected.length,bb(HON,1,rank)['attack@max_target']);assert.equal(selected[0],a);
  b.forceAttack(u,selected);u.atkCd=1000;advance(b,.15);near(a.hp,100);advance(b,.4);assert.ok(a.hp>100);advance(b,.2);assert.equal(u.mem.regularFormVisual.clip,'skill_2_Loop');u.skill.end('test');advance(b,.4);assert.equal(u.mem.regularFormVisual,null);
 }
});

test('Honeyberry talent uses original RANGED deployment position and owns only its MaxHP aura',()=>{
 for(const[elite,potential,pct]of[[0,1,0],[1,1,.05],[1,5,.07],[2,1,.1],[2,5,.12]]){
  const{b,deploy}=make(HON,{elite,potential,rank:[4,7,10][elite],others:[FAN,KRO]}),u=deploy(),ground=deploy(FAN,2,3),ranged=deploy(KRO,2,4);near(ground.s.maxHp,ground.base.maxHp);near(ranged.s.maxHp,ranged.base.maxHp*(1+pct));
  b.addBuff(ranged,{key:'test:other-hp',mods:{hpPct:.2}});b.retreat(u);near(ranged.s.maxHp,ranged.base.maxHp*1.2);
 }
});

test('Mulberry S1 uses source literal Skill alias, selected healing and EP ratio without adding trait again',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(MUL,{rank,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a,100000);wound(z,100000);a.elem.burn=10000;z.elem.neural=20000;cast(b,u);
  const p=effectiveProfile(u);assert.equal(p.attackVisual,'Skill');near(p.windup(b,u),.567);assert.deepEqual(acquireTargets(b,u,p),[z]);shot(b,u,[z],1);
  near(z.hp-100,u.s.atk*bb(MUL,0,rank).heal_scale);near(z.elem.neural,20000-u.s.atk*bb(MUL,0,rank).ep_heal_ratio);near(a.elem.burn,10000);
 }
});

test('Mulberry S2 uses source final BAT scaler after other modifiers and direct eventless healing',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(MUL,{skill:1,rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);a.elem.burn=10000;const base=u.base.bat;
  b.addBuff(u,{key:'test:bat',mods:{batFlat:.5,batPct:.2,batMul:.5}});cast(b,u);near(u.s.bat,(base+.5)*1.2*.5*bb(MUL,1,rank).base_attack_time);
  const p=effectiveProfile(u);assert.equal(p.windup,0);assert.equal(p.attackVisual,'none');b.forceAttack(u,[a]);near(a.hp-100,u.s.atk);near(a.elem.burn,10000-u.s.atk*.5);assert.equal(b.projectiles.list.length,0);
  advance(b,.4);assert.equal(u.mem.regularFormVisual.clip,'Skill1_Loop');u.skill.end('test');advance(b,.5);assert.equal(u.mem.regularFormVisual,null);
 }
});

test('Mulberry elemental protection is source one-minus, range/skill owned and strongest channel with weaker fallback',()=>{
 const{b,deploy}=make(MUL,{skill:1,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);cast(b,u);near(a.s.elemTakenMul,.65);b.addBuff(a,{key:'test:unrelated',mods:{elemTakenMul:.5}});near(a.s.elemTakenMul,.325);
 const hp=a.hp;for(const element of['burn','neural','necrosis','apoptosis','erosion']){
  b.dealDamage(null,a,{amount:100,type:'element',element,canDodge:false});near(a.elem[element],32.5);
 }near(a.hp,hp);
 z.skill.active=true;const sync=registerBerryProtection(b,z,.5,()=>true);sync();near(a.s.elemTakenMul,.25);z.skill.active=false;sync();near(a.s.elemTakenMul,.325);
 a.tileC=7;a.x=7;advance(b,.05);near(a.s.elemTakenMul,.5);a.tileC=3;a.x=3;advance(b,.05);near(a.s.elemTakenMul,.325);u.skill.end('test');near(a.s.elemTakenMul,.5);
 u.skill.opReadyAt=-Infinity;cast(b,u);b.retreat(u);near(a.s.elemTakenMul,.5);
});

test('Mulberry global Medic aura requires two deployed medics, accepts unhealable recipients and ignores out-of-range distance',()=>{
 for(const[elite,potential,pct]of[[0,1,0],[1,1,.06],[1,5,.07],[2,1,.1],[2,5,.11]]){
  const{b,deploy}=make(MUL,{elite,potential,rank:[4,7,10][elite],others:[WHI,FAN]}),u=deploy(),medic=deploy(WHI,1,2),a=deploy(FAN,3,4);near(u.s.atk,u.base.atk*(1+pct));near(medic.s.atk,medic.base.atk*(1+pct));near(a.s.atk,a.base.atk);
  b.addBuff(medic,{key:'test:unhealable',flags:{noHeal:true,healFree:true,untargetable:true}});advance(b,.05);near(medic.s.atk,medic.base.atk*(1+pct));
  b.addBuff(medic,{key:'test:isolated',flags:{isolated:true}});advance(b,.05);near(medic.s.atk,medic.base.atk);b.removeBuff(medic,'test:isolated');advance(b,.05);near(medic.s.atk,medic.base.atk*(1+pct));
  b.retreat(medic);near(u.s.atk,u.base.atk);
 }
});

test('fired source elemental projectiles preserve live source ATK and refuse recipients who become isolated midflight',()=>{
 const{b,deploy}=make(MUL,{others:[FAN]}),u=deploy(MUL,1,2),a=deploy(FAN,3,3);wound(a,100000);a.elem.burn=10000;
 b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.65);assert.ok(b.projectiles.list.length);b.addBuff(u,{key:'test:live-atk',mods:{atkPct:.5}});advance(b,.5);near(a.hp-100,u.s.atk);near(a.elem.burn,10000-u.s.atk*.5);
 const hp=a.hp,ep=a.elem.burn;b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.65);b.addBuff(a,{key:'test:isolate',flags:{isolated:true}});advance(b,.5);near(a.hp,hp);near(a.elem.burn,ep);
});

test('non-HEAL source aura validators retain healing-immune allies but still reject target-free and isolated recipients',()=>{
 for(const id of[CEY,HON,MUL]){
  const{b,deploy}=make(id,{skill:id===HON?0:1,others:[KRO]}),u=deploy(),a=deploy(KRO,2,4);
  b.addBuff(a,{key:'test:immune',flags:{healFree:true,noHeal:true}});if(id!==HON)cast(b,u);advance(b,.05);
  const read=()=>id===CEY?b.resistOf(a):id===HON?a.s.maxHp/a.base.maxHp:a.s.elemTakenMul;
  const baseline=id===CEY?0:1;
  near(read(),id===CEY?.5:id===HON?1.1:.65);
  b.addBuff(a,{key:'test:free',flags:{untargetable:true}});advance(b,.05);near(read(),baseline);
  b.removeBuff(a,'test:free');b.addBuff(a,{key:'test:isolated',flags:{isolated:true}});advance(b,.05);near(read(),baseline);
 }
});
