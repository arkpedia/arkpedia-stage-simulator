// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-defender-prefabs.json' with { type: 'json' };
import { FIVE_STAR_DEFENDER_OPERATORS } from '../shared/arkpedia/five-star-defender-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const CRO='char_201_moeshd',BIS='char_325_bison',HEA='char_304_zebra',ASB='char_378_asbest',SHA='char_4025_aprot2',FAN='char_123_fang',BEA='char_122_beagle',MEL='char_208_melan',KRO='char_124_kroos';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
function advance(b,s){for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[],tags=[]}={}){
 const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;source.stage.mapTags=tags;
 const op=source.operators[id],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(source,{operators:[build,...others.map(v=>defaultBuild(source.operators[v]))]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 const deploy=(who=id,r=3,c=4,dir='RIGHT')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,r,c,dir);assert.ok(u);u.atkCd=1000;return u;};return{b,deploy};
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost*u.skill.maxCharges);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,{r=3,c=5,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});e.base.maxHp=e.hp=100000;e.base.atk=200;e.base.def=0;e.base.res=0;if(fly)e.motion='FLY';e.markDirty();b.addBuff(e,{key:'test:pin',persist:true,flags:{disarm:true,noMove:true}});b._buildEnemyIndex();return e;}
const bb=(id,skill,rank=10)=>Object.fromEntries(data.operators[id].skills[skill].levels[rank-1].blackboard.map(v=>[v.key,v.value]));
const components=list=>list.flatMap(o=>o.components.map(c=>c.data));

test('five defender kits bind original bundles, selectors, formula modes and exact ten skills',()=>{
 for(const[id,c]of Object.entries(FIVE_STAR_DEFENDER_OPERATORS)){
  assert.match(evidence.sourceBundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  assert.match(evidence.models[id].Back.sha256,/^[a-f0-9]{64}$/);
  for(const s of c.skillIds)assert.ok(evidence.skills[s.split('[')[0]].length);
 }
 const healing=components(evidence.skills.skchr_zebra_1).find(c=>c._maxHpRatio!==undefined);
 assert.equal(healing._maxHpRatio,.5);assert.equal(healing._maxHpExcludeEqual,0);assert.equal(healing._buffKey,'zebra_s_1');
 const native=components(evidence.characters[SHA]).find(c=>c._triggerDelta!==undefined);
 near(native._triggerDelta,.1);near(native._preDelay,.833,1e-4);
 assert.equal(evidence.frameParity,false);assert.equal(evidence.models[CRO].Back.hits.Skill,undefined);
 for(const e of Object.values(data.enemies))assert.ok(['NORMAL','ELITE','BOSS'].includes(e.rank));
});
test('every source skill rank and promotion loads its exact defender kit without generic talent duplication',()=>{
 for(const[id,c]of Object.entries(FIVE_STAR_DEFENDER_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,c.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
 for(const id of Object.keys(FIVE_STAR_DEFENDER_OPERATORS)){const{deploy}=make(id,{elite:0,rank:4});const u=deploy();assert.equal(u.def.talents.length,id===SHA?1:0);}
});
test('normal defender damage waits for original facing OnAttack and respects native animation caps',()=>{
 for(const id of Object.keys(FIVE_STAR_DEFENDER_OPERATORS))for(const dir of['RIGHT','UP']){
  const{b,deploy}=make(id),u=deploy(id,3,4,dir),e=enemy(b);const p=effectiveProfile(u),time=evidence.models[id][dir==='UP'?'Back':'Front'].hits.Attack[0];
  near(p.windup(b,u),time);b.forceAttack(u,[e]);u.atkCd=1000;advance(b,time-.1);near(e.hp,100000);advance(b,.2);assert.ok(e.hp<100000);
  b.addBuff(u,{key:'test:fast',mods:{aspd:100}});near(p.windup(b,u),time/([CRO,BIS].includes(id)?1.1:1));
 }
});
test('Croissant dodge uses promoted/potential self and half-strength adjacent Physical/Arts values',()=>{
 for(const[elite,potential,self,adj]of[[0,1,0,0],[1,1,.1,.05],[2,1,.2,.1],[2,5,.23,.115]]){
  const{b,deploy}=make(CRO,{elite,potential,rank:elite===0?4:7,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,3,5),far=deploy(BEA,3,6);
  near(u.s.dodgePhys,self);near(u.s.dodgeArts,self);near(a.s.dodgePhys,adj);near(a.s.dodgeArts,adj);near(far.s.dodgePhys,0);
  b.retreat(u);near(a.s.dodgePhys,0);near(a.s.dodgeArts,0);
 }
});
test('Croissant S1 multiplies both source dodge values and applies selected DEF before removing only owned aura',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(CRO,{rank,others:[FAN]}),u=deploy(),a=deploy(FAN,3,5),def=u.s.def;
  b.addBuff(a,{key:'test:independent',mods:{dodgePhys:.1}});cast(b,u);near(u.s.def,def*(1+bb(CRO,0,rank).def));
  near(u.s.dodgeArts,.2*bb(CRO,0,rank).talent_scale);near(a.s.dodgeArts,.1*bb(CRO,0,rank).talent_scale);
  u.skill.end('test');near(u.s.dodgeArts,.2);b.retreat(u);near(a.s.dodgePhys,.1);
 }
});
test('Croissant S2 ground-only radial hit uses Front event and explicit missing-Back fallback',()=>{
 for(const dir of['RIGHT','UP']){
  const{b,deploy}=make(CRO,{skill:1}),u=deploy(CRO,3,4,dir),e=enemy(b),air=enemy(b,{fly:true}),far=enemy(b,{c:7});b.rng.chance=()=>false;
  let push=0;const native=b.push.bind(b);b.push=(t,force,opt)=>{assert.equal(t,e);near(force,3);assert.equal(opt.from,u);push++;return native(t,force,opt);};
  cast(b,u);advance(b,dir==='UP'?.8:.6);near(e.hp,100000);advance(b,.3);near(100000-e.hp,u.s.atk*4.8);near(air.hp,100000);near(far.hp,100000);assert.equal(push,1);assert.equal(e.s.flags.stun,true);
 }
});
test('Croissant S2 unfired cast cancels on brief control and does not resume after it ends',()=>{
 const{b,deploy}=make(CRO,{skill:1}),u=deploy(),e=enemy(b);cast(b,u);advance(b,.1);b.applyStatus(u,'stun',{duration:.1});advance(b,1.2);near(e.hp,100000);assert.equal(u.mem.regularFormVisual,null);
});
test('Bison flat defense buffs self plus correct profession directly behind facing and removes on retreat',()=>{
 for(const allyId of[FAN,MEL,BEA]){
  const{b,deploy}=make(BIS,{others:[allyId]}),u=deploy(),a=deploy(allyId,3,3);near(u.s.def-u.base.def,50);
  near(a.findBuff(`bison:interlocked:${u.id}`)?.mods.defFlat??0,[FAN,MEL].includes(allyId)?50:0);const before=a.s.def;b.retreat(u);near(before-a.s.def,[FAN,MEL].includes(allyId)?50:0);
 }
 const{b,deploy}=make(BIS,{potential:5,others:[FAN]}),u=deploy(),a=deploy(FAN,3,5);near(u.s.def-u.base.def,70);near(a.s.def,a.base.def);advance(b,.1);
});
test('Bison S1 and S2 selected source DEF use separate flat and percentage buckets',()=>{
 for(const skill of[0,1])for(const rank of[1,7,10]){
  const{b,deploy}=make(BIS,{skill,rank}),u=deploy(),base=u.s.def;cast(b,u);near(u.s.def,base*(1+(skill?bb(BIS,1,rank)['bison_s_2[self].def']:bb(BIS,0,rank).def)));
  assert.equal(Boolean(u.s.flags.disarm),!!skill);u.skill.end('test');advance(b,.2);near(u.s.def,base);
 }
});
test('Bison S2 adjacent aura and taunt stay separate from rear talent and stop normal attacks',()=>{
 const{b,deploy}=make(BIS,{skill:1,others:[FAN,BEA]}),u=deploy(),rear=deploy(FAN,3,3),front=deploy(BEA,3,5);const rearDef=rear.s.def;
 const frontDef=front.s.def;cast(b,u);near(rear.s.def,rearDef*1.3);near(front.s.def,frontDef+front.base.def*.3);near(u.s.taunt,1);const attacks=u.stats.attacks;enemy(b);u.atkCd=0;advance(b,.6);assert.equal(u.stats.attacks,attacks);
 u.skill.end('test');near(rear.s.def,rearDef);near(front.s.def,frontDef);near(u.s.taunt,0);b.retreat(u);near(rear.s.def,rear.base.def);
});
test('Heavyrain talent checks actual adjacent raised buildable tiles and affects Physical dodge only',()=>{
 const{b,deploy}=make(HEA,{others:[KRO,FAN]}),u=deploy(),high=deploy(KRO,2,4),low=deploy(FAN,3,5);advance(b,.2);
 near(u.s.dodgePhys,.2);near(high.s.dodgePhys,.2);near(low.s.dodgePhys,0);near(high.s.dodgeArts,0);
 b.retreat(u);near(high.s.dodgePhys,0);
});
test('Heavyrain S1 uses inclusive 50 percent target and spends one charge at source Skill hit',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(HEA,{rank,others:[FAN]}),u=deploy(),a=deploy(FAN,3,5);a.hp=a.s.maxHp*.5;u.skill.setSpTotal(u.skill.spCost*2);
  assert.equal(u.skill.activate('test'),true);assert.equal(u.skill.charges,u.skill.maxCharges-1);advance(b,.2);assert.equal(a.findBuff('zebra_s_1'),null);advance(b,.1);assert.ok(a.findBuff('zebra_s_1'));u.skill.rule='NEVER';
  const hp=a.hp;advance(b,1);near(a.hp-hp,bb(HEA,0,rank).hp_recovery_per_sec,1.1);assert.ok(a.s.flags.camou);
  advance(b,4);assert.equal(a.findBuff('zebra_s_1'),null);assert.equal(Boolean(a.s.flags.camou),false);
 }
});
test('Heavyrain S1 never spends charges above threshold, on a forbidden ally or an existing recovery buff',()=>{
 const{b,deploy}=make(HEA,{others:[FAN]}),u=deploy(),a=deploy(FAN,3,5);u.skill.setSpTotal(8);a.hp=a.s.maxHp*.6;assert.equal(u.skill.activate('test'),false);
 a.hp=a.s.maxHp*.4;b.addBuff(a,{key:'zebra_s_1'});assert.equal(u.skill.activate('test'),false);b.removeBuff(a,'zebra_s_1');
 b.addBuff(a,{key:'test:free',flags:{healFree:true}});assert.equal(u.skill.activate('test'),false);assert.equal(u.skill.charges,2);advance(b,.5);assert.equal(u.skill.activations,0);
});
test('Heavyrain S1 fixed cast ignores ASPD, refunds dead selected recipient and remembers brief interruption',()=>{
 for(const reason of['dead','stun','retreat']){
  const{b,deploy}=make(HEA,{others:[FAN]}),u=deploy(),a=deploy(FAN,3,5);a.hp=100;cast(b,u);u.skill.rule='NEVER';advance(b,.05);
  if(reason==='dead')b.kill(a,null);else if(reason==='retreat')b.retreat(u);else b.applyStatus(u,'stun',{duration:.1});
  advance(b,.4);assert.equal(a.findBuff('zebra_s_1'),null);if(reason==='dead')assert.equal(u.skill.charges,2);
 }
});
test('Heavyrain recovery lasts independently after firing and removes only its own camouflage',()=>{
 const{b,deploy}=make(HEA,{others:[FAN]}),u=deploy(),a=deploy(FAN,3,5);a.hp=100;cast(b,u);advance(b,.3);b.retreat(u);
 b.applyStatus(a,'camou',{key:'test:other'});const hp=a.hp;advance(b,1);assert.ok(a.hp>hp);advance(b,4);assert.ok(a.findBuff('test:other'));assert.equal(a.findBuff('zebra_s_1'),null);
});
test('Heavyrain S2 gives selected HP/DEF and camouflage to self and four neighbors but not diagonal',()=>{
 const{b,deploy}=make(HEA,{skill:1,others:[FAN,KRO]}),u=deploy(),a=deploy(FAN,3,5),diagonal=deploy(KRO,4,5);const hp=u.s.maxHp,def=u.s.def;
 cast(b,u);near(u.s.maxHp,hp*1.55);near(u.s.def,def*1.55);assert.ok(u.s.flags.camou);assert.ok(a.s.flags.camou);assert.equal(Boolean(diagonal.s.flags.camou),false);assert.ok(u.s.flags.disarm);
 const e=enemy(b,{c:5});advance(b,.3);assert.ok(a.blocking.includes(e));assert.equal(Boolean(a.s.flags.camou),false);b.kill(e,null);advance(b,.3);assert.ok(a.s.flags.camou);
 u.skill.end('test');assert.equal(Boolean(a.s.flags.camou),false);assert.equal(Boolean(u.s.flags.camou),false);advance(b,.3);near(u.s.maxHp,hp);near(u.s.def,def);
});
test('Asbestos talent follows promotion RES and normal-Arts hit classification, including shields',()=>{
 for(const[elite,res,sp]of[[0,0,0],[1,5,1],[2,10,3]]){
  const{b,deploy}=make(ASB,{elite,rank:[4,7,10][elite]}),u=deploy(),e=enemy(b);near(u.s.res,u.base.res+res);u.skill.setSpTotal(0);b.addBuff(u,{key:'test:shield',shield:100000});
  b.dealDamage(e,u,{amount:100,type:'phys',isAttack:true});near(u.skill.sp,0);
  b.dealDamage(e,u,{amount:100,type:'arts',isAttack:true,isSkill:false});near(u.skill.sp,sp);
  b.dealDamage(e,u,{amount:100,type:'arts',isAttack:true,isSkill:true});near(u.skill.sp,sp);
  b.loseHp(u,1,{source:e});near(u.skill.sp,sp);
 }
});
test('Asbestos S1 consumes first Arts block only, reduces following Arts at every rank and preserves physical damage',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(ASB,{rank}),u=deploy(),e=enemy(b);b.rng.chance=()=>false;cast(b,u);let hp=u.hp;
  b.dealDamage(e,u,{amount:2000,type:'phys'});assert.ok(u.hp<hp);assert.equal(u.mem.asbestosBlock,true);u.hp=u.s.maxHp;hp=u.hp;
  b.dealDamage(e,u,{amount:100,type:'arts'});near(u.hp,hp);assert.equal(u.mem.asbestosBlock,false);
  b.dealDamage(e,u,{amount:100,type:'arts'});near(hp-u.hp,100*(1-u.s.res/100)*bb(ASB,0,rank).damage_scale);
  assert.equal(effectiveProfile(u).dmgType,'arts');u.skill.end('test');assert.equal(effectiveProfile(u).dmgType,'phys');
 }
});
test('Asbestos S2 uses percentage BAT, exact extended range, source event, speed20 and radius1 splash',()=>{
 const{b,deploy}=make(ASB,{skill:1}),u=deploy(),a=enemy(b),nearby=enemy(b,{c:5.5}),far=enemy(b,{c:7}),air=enemy(b,{r:3.5,c:5,fly:true});const atk=u.s.atk,bat=u.s.bat;cast(b,u);advance(b,.9);
 near(u.s.bat,bat*1.4);near(u.s.atk,atk*1.9);near(effectiveProfile(u).windup(b,u),.367);assert.ok(u.rangeKeySet.has(3*21+6));
 b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.3);near(a.hp,100000);advance(b,.2);
 for(const e of[a,nearby,air])near(100000-e.hp,u.s.atk);near(far.hp,100000);
 u.skill.end('test');advance(b,.4);near(u.s.bat,bat);near(u.s.atk,atk);
});
test('Asbestos fired original ranged splash survives withdrawal while unfired skill attack cancels',()=>{
 for(const fired of[false,true]){
  const{b,deploy}=make(ASB,{skill:1}),u=deploy(),e=enemy(b,{c:7});cast(b,u);advance(b,.9);b.forceAttack(u,[e]);u.atkCd=1000;advance(b,fired?.45:.2);if(fired)assert.ok(b.projectiles.list.length);b.retreat(u);advance(b,.5);
  assert.equal(e.hp<100000,fired);
 }
});
test('Shalem first talent requires exact original rogue_phantom map tag across promotion',()=>{
 for(const[elite,atk,aspd]of[[0,0,10],[1,.05,20],[2,.15,30]])for(const tags of[[],['rogue_phantom'],['Phantom & Crimson Solitaire']]){
  const{deploy}=make(SHA,{elite,rank:[4,7,10][elite],tags}),u=deploy();near(u.s.atk,u.base.atk*(1+(tags[0]==='rogue_phantom'?atk:0)));near(u.s.aspd,100+(tags[0]==='rogue_phantom'?aspd:0));
 }
});
test('Shalem promoted curse rolls on individual physical/Arts attack before mitigation, never true damage or unrelated skill',()=>{
 const{b,deploy}=make(SHA),u=deploy(),e=enemy(b);e.base.res=40;e.markDirty();b.rng.chance=()=>true;
 b.dealDamage(u,e,{amount:100,type:'true',isAttack:true});near(e.s.res,40);
 b.dealDamage(u,e,{amount:100,type:'arts',isAttack:false,isSkill:true});near(e.s.res,40);const hp=e.hp;
 b.dealDamage(u,e,{amount:100,type:'arts',isAttack:true});near(e.s.res,30);near(hp-e.hp,70);
 b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});near(e.s.res,30);advance(b,3.1);near(e.s.res,40);
});
test('Shalem S1 uses exact reduced BAT/MaxHP and attacks up to current block count once each as Arts',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(SHA,{rank}),u=deploy(),list=[enemy(b,{c:4.5}),enemy(b,{c:4.5}),enemy(b,{c:4.5}),enemy(b,{c:4.5,fly:true})],bat=u.s.bat,hp=u.s.maxHp;cast(b,u);advance(b,.9);
  near(u.s.bat,bat*(1+bb(SHA,0,rank).base_attack_time));near(u.s.maxHp,hp*(1+bb(SHA,0,rank).max_hp));const p=effectiveProfile(u);assert.equal(p.dmgType,'arts');
  assert.equal(acquireTargets(b,u,p).length,u.s.blockCnt);b.rng.chance=()=>false;b.forceAttack(u,acquireTargets(b,u,p));u.atkCd=1000;advance(b,.1);
  assert.equal(list.filter(e=>e.hp<100000).length,u.s.blockCnt);near(list[3].hp,100000);u.skill.end('test');advance(b,.4);near(u.s.bat,bat);
 }
});
test('Shalem S2 selects each of six original shots afresh and respects native predelay/fixed .15 flight',()=>{
 const{b,deploy}=make(SHA,{skill:1}),u=deploy(),a=enemy(b),z=enemy(b,{c:5.5});b.rng.chance=()=>false;let n=0;b.rng.pick=list=>list[n++%list.length];cast(b,u);advance(b,.9);
 b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.8);near(a.hp,100000);near(z.hp,100000);advance(b,.8);near(100000-a.hp,u.s.atk*.8*3);near(100000-z.hp,u.s.atk*.8*3);assert.equal(n,6);
});
test('Shalem S2 follow-up shots stop on brief control but fired projectiles still land',()=>{
 const{b,deploy}=make(SHA,{skill:1}),u=deploy(),e=enemy(b);b.rng.chance=()=>false;cast(b,u);advance(b,.9);b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.9);
 b.applyStatus(u,'stun',{duration:.1});advance(b,1);near(100000-e.hp,u.s.atk*.8);
});
test('Shalem S2 native first HP loss is .95 then each second, bypassing shields and granting no hurt SP',()=>{
 const{b,deploy}=make(SHA,{skill:1}),u=deploy();b.addBuff(u,{key:'test:shield',shield:10000,mods:{dmgTakenMul:.01}});cast(b,u);const hp=u.hp;advance(b,.9);near(u.hp,hp);advance(b,.1);near(hp-u.hp,u.s.maxHp*.05);near(u.skill.sp,0);near(u.findBuff('test:shield').shield,10000);
 advance(b,1);near(hp-u.hp,u.s.maxHp*.1);u.skill.end('test');const stopped=u.hp;advance(b,1);near(u.hp,stopped);
});
test('Shalem S2 HP loss may kill its owner and cancels unreleased subsequent shots',()=>{
 const{b,deploy}=make(SHA,{skill:1}),u=deploy(),e=enemy(b);cast(b,u);u.hp=1;advance(b,1);assert.equal(u.alive,false);assert.equal(u.skill.active,false);near(e.hp,100000);advance(b,1);assert.deepEqual(b.errors,[]);
});

test('Heavyrain original free-target aura exception reaches isolated raised and adjacent allies',()=>{
 const{b,deploy}=make(HEA,{skill:1,others:[KRO,FAN]}),u=deploy(),high=deploy(KRO,2,4),low=deploy(FAN,3,5);
 for(const a of[high,low])b.addBuff(a,{key:'test:isolation',flags:{isolated:true,noHeal:true}});
 assert.equal(b.allySelectable(high,u),false);advance(b,.3);near(high.s.dodgePhys,.2);near(low.s.dodgePhys,0);
 cast(b,u);advance(b,.3);assert.equal(high.s.flags.camou,true);assert.equal(low.s.flags.camou,true);
 b.retreat(u);near(high.s.dodgePhys,0);assert.equal(Boolean(high.s.flags.camou),false);assert.equal(Boolean(low.s.flags.camou),false);
});
