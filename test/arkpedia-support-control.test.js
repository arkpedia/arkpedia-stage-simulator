// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-support-control-prefabs.json' with { type: 'json' };
import deferredBards from '../data/arkpedia-bard-deferred-prefabs.json' with { type: 'json' };
import { SUPPORT_CONTROL_OPERATORS } from '../shared/arkpedia/support-control-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const MIZ='char_437_mizuki';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const advance=(b,s)=>{for(let n=0;n<Math.round(s/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);};
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
 const source=structuredClone(data),op=source.operators[MIZ];assert.ok(op,'Reviewed Mizuki snapshot is required');
 source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(source,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const u=b.deployOperator(MIZ,3,3,dir);assert.ok(u);u.atkCd=1000;return{b,u};
}
function enemy(b,{hp=100000,maxHp=100000,x=4,y=3,def=0,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[0,0]});e.x=x;e.y=y;e.base.maxHp=maxHp;e.base.def=def;e.base.res=res;e.base.moveSpeed=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
const bb=(skill,rank=10)=>Object.fromEntries(data.operators[MIZ].skills[skill].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
function cast(b,u,total=u.skill.spCost){u.skill.setSpTotal(total);assert.equal(!u.skill.manual?u.skill.activate('test'):b.activateOperator(MIZ),true);u.atkCd=1000;}
function shot(b,u,targets=null,seconds=.6){b.forceAttack(u,targets);u.atkCd=1000;advance(b,seconds);}
const row=(rows,id)=>rows.find(x=>x.pathId===id).data;

test('original source binds all three Mizuki skills and six verified bundles, while native bard and Gnosis blockers stay disabled',()=>{
 assert.equal(evidence.frameParity,false);assert.deepEqual(evidence.enabledOperators,[MIZ]);assert.equal(evidence.sourceBundles.length,6);
 for(const r of evidence.sourceBundles)assert.match(r.sha256,/^[a-f0-9]{64}$/);
 for(const face of['Front','Back']){assert.match(evidence.models[MIZ][face].sha256,/^[a-f0-9]{64}$/);near(evidence.models[MIZ][face].hits.Attack[0],.533);}
 for(const id of SUPPORT_CONTROL_OPERATORS[MIZ].skillIds)assert.equal(evidence.tableContracts[MIZ].skills[id].length,10);
 const m=row(evidence.skills.skchr_mizuki_2,'-8475926510819013639')._buffs[0].attributes.attributeModifiers[0];assert.equal(m.attributeType,8);assert.equal(m.formulaItem,0);
 assert.equal(row(evidence.characters[MIZ],'-8051240421850167220')._postFilter,16);
 assert.equal(evidence.buffTemplates.mizuki_t_2.eventToActions.ON_BUFF_TRIGGER[0]._conditionNode._condType,'LE');
 assert.equal(evidence.deferredOperators.char_206_gnosis.wholeKitDeferred,true);assert.equal(SUPPORT_CONTROL_OPERATORS.char_206_gnosis,undefined);
 assert.deepEqual(deferredBards.enabledOperators,[]);for(const x of Object.values(deferredBards.deferredOperators))assert.equal(x.wholeKitDeferred,true);
});

test('all three skills load every original rank and keep source SP charge counts',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){
  const{b,u}=make({skill,rank}),l=data.operators[MIZ].skills[skill].levels[rank-1];assert.equal(u.skill.id,SUPPORT_CONTROL_OPERATORS[MIZ].skillIds[skill]);assert.equal(u.skill.noSkill,false);
  assert.equal(u.skill.spCost,l.spData.spCost);assert.equal(u.skill.maxCharges,l.spData.maxChargeTime);assert.deepEqual(b.errors,[]);
 }
});

test('source Stalker trait retains zero block, low taunt and independent Physical and Arts dodge',()=>{
 const{b,u}=make();near(u.s.blockCnt,0);near(u.s.taunt,-1);near(u.s.dodgePhys,.5);near(u.s.dodgeArts,.5);u.hp=1000;b.rng=()=>0;
 b.dealDamage(null,u,{amount:100,type:'phys'});b.dealDamage(null,u,{amount:100,type:'arts'});near(u.hp,1000);
 b.dealDamage(null,u,{amount:100,type:'true'});near(u.hp,900);
});

test('ordinary attacks hit every legal ground victim and only one lowest-current-HP victim receives the separate Arts rider',()=>{
 const{b,u}=make({elite:1,rank:7}),a=enemy(b,{hp:20000,maxHp:100000,def:100,res:20}),z=enemy(b,{hp:30000,maxHp:1000000,x:4.1,def:200,res:50});
 const air=enemy(b,{x:3.9,fly:true}),sleep=enemy(b,{x:4.2}),hidden=enemy(b,{x:4.3});b.applyStatus(sleep,'sleep',{duration:10});b.addBuff(hidden,{key:'test:stealth',flags:{stealth:true}});b._buildEnemyIndex();
 assert.deepEqual(new Set(acquireTargets(b,u,effectiveProfile(u))),new Set([a,z]));const atk=u.s.atk;shot(b,u);near(20000-a.hp,Math.max(atk-100,atk*.05)+atk*.3*.8);near(30000-z.hp,Math.max(atk-200,atk*.05));near(air.hp,100000);near(sleep.hp,100000);near(hidden.hp,100000);assert.equal(b.projectiles.list.length,0);
});

test('ordinary direct hits use the original .533 event and source animation cap1 in both facings',()=>{
 for(const dir of['RIGHT','UP']){
  const{b,u}=make({elite:1,rank:7,dir}),e=enemy(b);b.addBuff(u,{key:'test:ASPD',mods:{aspd:100}});near(effectiveProfile(u).windup(b,u),.533);
  b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.5);near(e.hp,100000);advance(b,.1);near(100000-e.hp,u.s.atk*1.3);
 }
});

test('S1 all ranks scale physical and talent Arts independently and spend one stored charge per attack',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,u}=make({rank}),e=enemy(b),v=bb(0,rank);cast(b,u,u.skill.maxCharges*u.skill.spCost);const left=u.skill.charges,atk=u.s.atk;
  shot(b,u,[e]);near(100000-e.hp,atk*v.atk_scale+atk*.5*v.talent_scale);assert.equal(u.skill.pending,false);assert.equal(u.skill.charges,left);
  assert.ok(u.skill.sp>=0);assert.equal(effectiveProfile(u).attackVisual,'Attack');
 }
});

test('S1 keeps all three M3 charges available to sequential enhanced attacks with no rider on ordinary physical survivors',()=>{
 const{b,u}=make(),a=enemy(b),z=enemy(b,{x:4.1});const atk=u.s.atk;cast(b,u,u.skill.spCost*3);shot(b,u,[a,z]);assert.equal(u.skill.charges,2);near(100000-a.hp,atk*4.5);near(100000-z.hp,atk*3);
 assert.equal(u.skill.activate('test'),true);shot(b,u,[a,z]);assert.equal(u.skill.charges,1);assert.equal(u.skill.activate('test'),true);shot(b,u,[a,z]);assert.equal(u.skill.charges,0);
});

test('S2 additive BAT seconds compose with existing BAT percent and scale only the two lowest-current-HP riders and Bind',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,u}=make({skill:1,rank}),v=bb(1,rank),a=enemy(b,{hp:90000}),z=enemy(b,{hp:80000,x:4.1}),q=enemy(b,{hp:70000,x:4.2});
  const base=u.base.atk;b.addBuff(u,{key:'test:BAT',mods:{batPct:.5}});cast(b,u);near(u.s.bat,(u.base.bat+v.base_attack_time)*1.5);near(u.s.atk,base*(1+v.atk));
  const p=effectiveProfile(u);assert.equal(p.attackVisual,'Skill_1');near(p.windup(b,u),.533);shot(b,u,[a,z,q]);const atk=u.s.atk;
  near(90000-a.hp,atk);near(80000-z.hp,atk*1.5);near(70000-q.hp,atk*1.5);assert.equal(!!a.s.flags.bind,false);assert.equal(z.s.flags.bind,true);assert.equal(q.s.flags.bind,true);
  u.skill.end('duration');near(u.s.bat,u.base.bat*1.5);near(u.s.atk,base);assert.equal(effectiveProfile(u).attackVisual,'Attack');
 }
});

test('S2 selected Bind respects source resistance and persists when Arts damage is fully shielded',()=>{
 const{b,u}=make({skill:1}),a=enemy(b),z=enemy(b,{x:4.1});b.applyStatus(z,'resist',{value:.5});b.addBuff(z,{key:'test:shield',shield:100000});cast(b,u);shot(b,u,[a,z]);
 assert.equal(a.s.flags.bind,true);assert.equal(z.s.flags.bind,true);near(z.findBuff('bind').duration,.65);near(z.hp,100000);
});

test('S3 all ranks expand range and stun only three Arts victims with a single HP cost for fewer than three selected targets',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,u}=make({skill:2,rank}),v=bb(2,rank),e=enemy(b),base=u.base.atk,initial=new Set(u.rangeKeys);cast(b,u);near(u.s.atk,base*(1+v.atk));assert.ok(u.rangeKeys.some(k=>!initial.has(k)));
  assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');assert.equal(effectiveProfile(u).attackVisual,'Skill_2_Loop');const hp=u.hp;shot(b,u,[e]);near(hp-u.hp,u.s.maxHp*v['attack@hp_ratio']);assert.equal(e.s.flags.stun,true);
  u.skill.end('duration');assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');assert.deepEqual(new Set(u.rangeKeys),initial);advance(b,1.1);assert.equal(u.mem.regularFormVisual,null);
 }
});

test('S3 four physical victims get three lowest-HP Arts riders and Stun, with no HP cost even behind shields or dodge',()=>{
 const{b,u}=make({skill:2}),a=enemy(b,{hp:100000}),z=enemy(b,{hp:90000,x:4.1}),q=enemy(b,{hp:80000,x:4.2}),w=enemy(b,{hp:70000,x:4.3});cast(b,u);const hp=u.hp,atk=u.s.atk;
 b.addBuff(z,{key:'test:shield',shield:100000});b.addBuff(q,{key:'test:evade',mods:{dodgePhys:1,dodgeArts:1}});shot(b,u,[a,z,q,w]);near(u.hp,hp);near(100000-a.hp,atk);assert.equal(!!a.s.flags.stun,false);near(z.hp,90000);near(q.hp,80000);near(70000-w.hp,atk*1.5);assert.equal(z.s.flags.stun,true);assert.equal(q.s.flags.stun,true);assert.equal(w.s.flags.stun,true);
});

test('S3 own PURE HP loss bypasses shield/Invulnerability/DEF and can kill; no target or interrupted strike pays no HP',()=>{
 const{b,u}=make({skill:2}),e=enemy(b);cast(b,u);b.addBuff(u,{key:'test:shield',shield:10000});b.addBuff(u,{key:'test:invuln',flags:{invulnerable:true}});const hp=u.hp;shot(b,u,[e]);near(hp-u.hp,u.s.maxHp*.12);near(u.findBuff('test:shield').shield,10000);
 u.hp=u.s.maxHp*.1;shot(b,u,[e]);assert.equal(u.alive,false);assert.equal(u.mem.regularFormVisual,null);
 const x=make({skill:2});cast(x.b,x.u);const h=x.u.hp;assert.equal(x.b.forceAttack(x.u),false);near(x.u.hp,h);
 const y=make({skill:2}),victim=enemy(y.b);cast(y.b,y.u);const yh=y.u.hp;y.b.forceAttack(y.u,[victim]);y.u.atkCd=1000;y.b.applyStatus(y.u,'stun',{duration:.001});advance(y.b,.7);near(y.u.hp,yh);near(victim.hp,100000);
});

test('talent2 source immediate .2 check uses inclusive half HP and its .02 finish tail; distinct recipients never stack ATK',()=>{
 const{b,u}=make({potential:5}),a=enemy(b,{hp:50000}),z=enemy(b,{hp:20000,x:4.1});const base=u.base.atk;advance(b,.05);near(u.s.atk,base*1.12);
 a.hp=50000.01;z.hp=100000;advance(b,.1);near(u.s.atk,base*1.12);advance(b,.1);near(u.s.atk,base);a.hp=50000;advance(b,.2);near(u.s.atk,base*1.12);
 a.x=9;advance(b,b.dt);near(u.s.atk,base*1.12);advance(b,b.dt);near(u.s.atk,base);
});

test('talent2 observes source ignoreTargetFree1 on stealth/sleep/untargetable and air but rejects actual disappearance',()=>{
 for(const kind of['stealth','sleep','untargetable','fly','hidden']){
  const{b,u}=make(),e=enemy(b,{hp:100});if(kind==='fly')e.motion='FLY';else if(kind==='hidden')e.hidden=true;else b.addBuff(e,{key:'test:state',flags:{[kind]:true}});advance(b,.1);
  near(u.s.atk,u.base.atk*(kind==='hidden'?1:1.1));b.retreat(u);assert.equal(e.findBuff(`mizuki:checker:${u.id}`),null);
 }
});

test('talent1 values follow all promotion levels while talent2 has no effect before Elite2',()=>{
 for(const[elite,scale]of[[0,.2],[1,.3],[2,.5]]){
  const{b,u}=make({elite,rank:[4,7,10][elite]}),e=enemy(b,{hp:10000});advance(b,.1);near(u.s.atk,u.base.atk*(elite===2?1.1:1));const atk=u.s.atk;shot(b,u,[e]);near(10000-e.hp,atk*(1+scale));
 }
});

test('natural AI uses all-ground attack loops for all three modes without Air damage, invented projectiles or leaked form state',()=>{
 for(const skill of[0,1,2]){
  const{b,u}=make({skill}),e=enemy(b),a=enemy(b,{x:4.1}),air=enemy(b,{x:4.2,fly:true});cast(b,u);u.atkCd=0;advance(b,1.1);assert.ok(e.hp<100000);assert.ok(a.hp<100000);near(air.hp,100000);assert.equal(b.projectiles.list.length,0);
  b.retreat(u);assert.equal(u.mem.regularFormVisual,null);const hp=e.hp;advance(b,1);near(e.hp,hp);
 }
});


test('native CAST selects entering victims and rejects leaving, hidden or target-free victims during windup',()=>{
 for(const state of ['outside','hidden','untargetable']){
  const{b,u}=make({elite:1,rank:7}),old=enemy(b),enter=enemy(b,{x:9}),hp=old.hp;
  b.forceAttack(u,[old]);u.atkCd=1000;advance(b,.2);
  if(state==='outside')old.x=9;else if(state==='hidden')old.hidden=true;else b.addBuff(old,{key:'test:free',flags:{untargetable:true}});
  enter.x=4;b._buildEnemyIndex();advance(b,.4);near(old.hp,hp);near(100000-enter.hp,u.s.atk*1.3);
 }
});

test('native CAST lowest-HP rider is chosen at release after victim HP and membership changes',()=>{
 const{b,u}=make({elite:1,rank:7}),a=enemy(b,{hp:10000}),z=enemy(b,{hp:20000,x:4.1});
 b.forceAttack(u,[a,z]);u.atkCd=1000;advance(b,.2);a.hp=30000;const atk=u.s.atk;advance(b,.4);
 near(30000-a.hp,atk);near(20000-z.hp,atk*1.3);
});


test('S1 source dead-input recovery refunds only an un-emitted lost input, preserving replacements and interrupted pending charges',()=>{
 for(const stored of [1,3]){
  const{b,u}=make(),e=enemy(b);cast(b,u,stored*u.skill.spCost);b.forceAttack(u,[e]);u.atkCd=1000;b.kill(e);advance(b,.6);
  assert.equal(u.skill.charges,stored);assert.equal(u.skill.pending,false);
 }
 const own=make(),victim=enemy(own.b,{hp:1});cast(own.b,own.u);shot(own.b,own.u,[victim]);assert.equal(victim.alive,false);assert.equal(own.u.skill.charges,0);
 const replacement=make(),old=enemy(replacement.b),next=enemy(replacement.b,{x:4.1});cast(replacement.b,replacement.u);replacement.b.forceAttack(replacement.u,[old]);replacement.u.atkCd=1000;replacement.b.kill(old);advance(replacement.b,.6);
 assert.ok(next.hp<100000);assert.equal(replacement.u.skill.charges,0);
 const controlled=make(),target=enemy(controlled.b);cast(controlled.b,controlled.u);controlled.b.forceAttack(controlled.u,[target]);controlled.u.atkCd=1000;controlled.b.applyStatus(controlled.u,'stun',{duration:.001});controlled.b.kill(target);advance(controlled.b,.6);
 assert.equal(controlled.u.skill.pending,true);assert.equal(controlled.u.skill.charges,0);
});


test('S3 source allowNoTarget0 does not charge HP when CAST loses every victim before emission',()=>{
 for(const reason of ['dead','left','hidden','target-free']){
  const{b,u}=make({skill:2}),e=enemy(b);cast(b,u);const hp=u.hp;assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;advance(b,.2);
  if(reason==='dead')b.kill(e);else if(reason==='left')e.x=9;else if(reason==='hidden')e.hidden=true;else b.addBuff(e,{key:'test:free',flags:{untargetable:true}});
  b._buildEnemyIndex();advance(b,.4);near(u.hp,hp);assert.equal(u.mem.mizukiEmittedAttackId,undefined);
 }
 const{b,u}=make({skill:2}),e=enemy(b);cast(b,u);const hp=u.hp;b.addBuff(e,{key:'test:shield',shield:100000});shot(b,u,[e]);near(u.hp,hp-u.s.maxHp*.12);near(e.hp,100000);
});
