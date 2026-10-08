// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-chilchuck-prefabs.json' with { type: 'json' };
import { CHILCHUCK_OPERATORS } from '../shared/arkpedia/chilchuck-operators.js';
import { chilchuckCost } from '../server/sim/content/arkpedia-chilchuck.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { makeDamageInfo } from '../server/sim/damage.js';
const ID='char_4144_chilc',ALLY='char_208_melan';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const nodes=rs=>rs.flatMap(r=>r.components.map(c=>({pathId:c.pathId,...c.data})));
const bb=(skill,rank=10)=>Object.fromEntries(evidence.tables.skills[CHILCHUCK_OPERATORS[ID].skillIds[skill]].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
function build(id=ID,{skill=0,rank=10,elite=2,potential=1}={}){
 const op=data.operators[id];assert.ok(op,'Reviewed Chilchuck source snapshot required');
 elite=Math.min(elite,op.phases.length-1);
 rank=Math.min(rank,elite===2?10:elite===1?7:4);
 return{...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:rank};
}
function make(opts={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const b=new StandardBattle(d,{operators:[build(ID,opts),build(ALLY)]});b.setViewport('fullscreen-workspace');b.autoFinish=false;b.recordEvents=true;
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));rng(b,[.99]);
 const receipts=[];b.on('damaged',c=>receipts.push({...c,time:b.time}));
 const deploy=(id=ID,r=3,c=4,dir='RIGHT')=>{b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(id,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';b.getPlayer('arkpedia').dp=0;return u;};
 return{b,deploy,receipts};
}
function rng(b,values){let n=0;const previous=b.rng;const next=()=>values[Math.min(n++,values.length-1)];next.pick=previous.pick;next.int=previous.int;next.chance=p=>next()<p;b.rng=next;return()=>n;}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function enemy(b,{r=3,c=5,hp=100000,def=0,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:100000,def,res,moveSpeed:0});
 e.def={...e.def,immune:new Set(e.def.immune)};e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
 b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function move(b,u,r,c){Object.assign(u,{x:c,y:r,tileR:r,tileC:c});b._enemiesDirty=true;b._buildEnemyIndex();}
function cast(u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function shot(b,u,e){assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;return b._evq.filter(x=>x[0]==='atk'&&x[1]===u.id).at(-1)?.[4];}
function block(u,e){u.blocking=[e];e.blockedBy=u;}
const owned=u=>`chilchuck:environment:${u.id}`;
const output=(rs,u)=>rs.filter(x=>x.source===u&&x.type!=='element');

test('whole source retains five exact bundles, actual both-facing bytes, literal environment flags and conditional Dice tree',()=>{
 assert.deepEqual(Object.keys(CHILCHUCK_OPERATORS),[ID]);assert.equal(evidence.sourceBundles.length,5);assert.equal(evidence.frameParity,false);
 for(const x of evidence.sourceBundles)assert.match(x.sha256,/^[0-9a-f]{64}$/);
 for(const face of['Front','Back'])assert.equal(evidence.models[ID][face].sha256,evidence.officialSkeletonBindings[ID][face].sha256);
 const env=evidence.buffTemplates['char_chilc[immune_env_dmg][include_element]'].eventToActions.ON_APPLYING_MODIFIER[0];
 assert.equal(env._conditionNode._sharedFlags,'IS_ENVIRONMENT_ELEMENT_DAMAGE');assert.equal(env._failNodes[0]._sharedFlags,'IS_ENVIRONMENT_DAMAGE');
 const trigger=evidence.buffTemplates.char_chilc_s1_compute_cost.eventToActions.ON_BUFF_TRIGGER;
 assert.equal(trigger[2]._isMinus,true);assert.equal(trigger[3]._conditionNode._probKey,'prob_add');assert.equal(trigger[3]._failNodes[0]._conditionNode._probKey,'prob_minus');
 assert.ok(evidence.verificationLimits.some(x=>x.includes('prob_stay')));assert.ok(evidence.verificationLimits.some(x=>x.includes('runActionOnEvent4')));
});
test('all twenty selected ranks and promotion/potential candidates instantiate both full native skills',()=>{
 for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill,rank}),u=deploy();assert.equal(u.skill.noSkill,false);assert.equal(u.skill.id,CHILCHUCK_OPERATORS[ID].skillIds[skill]);near(u.skill.spCost,evidence.tables.skills[u.skill.id].levels[rank-1].spData.spCost);assert.deepEqual(b.errors,[]);}
 for(const[elite,potential,duration]of[[0,1,null],[1,1,35],[1,5,40],[2,1,45],[2,5,50]]){const{b,deploy}=make({elite,potential}),u=deploy();assert.equal(u.mem.chilcExpiresAt,duration==null?null:b.time+duration);}
});
test('literal three-trial S1 walk conditionally consumes second draws and ignores unused prob_stay',()=>{
 const s={...bb(0),prob_stay:999};
 for(const[draws,value,count]of[[[0,0,0],10,3],[[.99,0,.99,0,.99,0],4,6],[[.99,.99,.99,.99,.99,.99],7,6],[[0,.99,0,.99,.99],7,5]]){
 let i=0;near(chilchuckCost(s,()=>draws[i++]),value);assert.equal(i,count);
 }
});
test('all27 conditional-step combinations preserve nonuniform range and exact rank-specific midpoint',()=>{
 for(let rank=1;rank<=10;rank++)for(const a of[-1,0,1])for(const c of[-1,0,1])for(const d of[-1,0,1]){
  const deltas=[a,c,d],draws=deltas.flatMap(x=>x===1?[0]:x===-1?[.99,0]:[.99,.99]);let i=0;const s=bb(0,rank),cost=chilchuckCost(s,()=>draws[i++]);near(cost,s.mid_cost+a+c+d);assert.ok(cost>=s.ground&&cost<=s.floor);
 }
});
test('talent clock starts at actual delayed fractional deployment and never runs on bench',()=>{
 const{b,deploy}=make();advance(b,1.5);const u=deploy();near(u.mem.chilcExpiresAt,46.5);assert.ok(u.findBuff(owned(u)));advance(b,44.9);assert.ok(u.findBuff(owned(u)));advance(b,.2);assert.equal(u.findBuff(owned(u)),null);
});
test('native2-2 forward aura affects self and in-range ally but never side or rear tiles across facings',()=>{
 for(const[dir,inside,outside]of[['RIGHT',[3,6],[2,4]],['LEFT',[3,2],[3,5]],['UP',[5,4],[3,5]],['DOWN',[1,4],[3,5]]]){
  const{b,deploy}=make(),u=deploy(ID,3,4,dir),a=deploy(ALLY,...inside);advance(b,.04);assert.ok(a.findBuff(owned(u)));move(b,a,...outside);advance(b,.04);assert.equal(a.findBuff(owned(u)),null);assert.ok(u.findBuff(owned(u)));
 }
});
test('nonheal aura permits allied isolation, target-free, friendly stealth and HealFree',()=>{
 const{b,deploy}=make(),u=deploy(),a=deploy(ALLY,3,5);b.addBuff(a,{key:'foreign',flags:{isolated:true,untargetable:true,stealth:true,healFree:true,noHeal:true}});advance(b,.04);
 assert.ok(a.findBuff(owned(u)));const hp=a.hp;near(b.dealDamage(null,a,{amount:100,type:'true',isEnvironment:true}),0);near(a.hp,hp);assert.ok(a.findBuff('foreign'));
});
test('environment flags are explicit optional booleans and do not infer source/type/periodicity',()=>{
 for(const props of[{}, {sourceless:true,tags:['dot','periodic']},{type:'element',element:'burn'},{type:'elemental',element:'burn'}]){const d=makeDamageInfo(props);assert.equal(d.isEnvironment,false);assert.equal(d.isEnvironmentElement,false);}
 assert.equal(makeDamageInfo({isEnvironmentElement:true}).isEnvironmentElement,true);assert.equal(makeDamageInfo({isEnvironment:true}).isEnvironment,true);
});
test('only exact environmental flags cancel Physical/Arts/True/elemental HP damage',()=>{
 const{b,deploy}=make(),u=deploy();
 for(const type of['phys','arts','true','elemental'])for(const flag of['isEnvironment','isEnvironmentElement']){const hp=u.hp;near(b.dealDamage(null,u,{amount:100,type,[flag]:true,canDodge:false}),0);near(u.hp,hp);}
 for(const type of['phys','arts','true','elemental']){const hp=u.hp;assert.ok(b.dealDamage(null,u,{amount:100,type,sourceless:true,canDodge:false,tags:['dot','periodic']})>0);assert.ok(u.hp<hp);}
});
test('environmental element injury is cancelled but ordinary enemy element gauge and existing burst remain eligible',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);near(b.dealDamage(e,u,{amount:100,type:'element',element:'burn',isEnvironmentElement:true}),0);near(u.elem.burn,0);
 near(b.dealDamage(e,u,{amount:100,type:'element',element:'burn'}),100);near(u.elem.burn,100);
 const hp=u.hp;near(b.loseHp(u,10),10);near(u.hp,hp-10);b.dealDamage(e,u,{amount:900,type:'element',element:'burn'});assert.ok(u.hp<hp-10,'ordinary burst is not environmental immunity');
});
test('E0 has no environment aura and talent expiry immediately restores flagged damage',()=>{
 const base=make({elite:0}),a=base.deploy();assert.equal(a.findBuff(owned(a)),null);near(base.b.dealDamage(null,a,{amount:100,type:'true',isEnvironment:true}),100);
 const{b,deploy}=make(),u=deploy();advance(b,45.05);near(b.dealDamage(null,u,{amount:100,type:'true',isEnvironmentElement:true}),100);
});
test('owner death/withdrawal/hidden and recipient leave remove only owned immunity',()=>{
 for(const state of['death','retreat','hidden','leave']){const{b,deploy}=make(),u=deploy(),a=deploy(ALLY,3,5);b.addBuff(a,{key:'foreign:aura',mods:{atkPct:.1}});advance(b,.04);assert.ok(a.findBuff(owned(u)));
  if(state==='death')b.kill(u);else if(state==='retreat')b.retreatOperator(ID);else if(state==='hidden')u.hidden=true;else move(b,a,2,5);advance(b,.04);assert.equal(a.findBuff(owned(u)),null);assert.ok(a.findBuff('foreign:aura'));near(b.dealDamage(null,a,{amount:100,type:'true',isEnvironment:true}),100);
 }
});
test('source normal Attack and separate Combat select correct origin and actual.433 event',()=>{
 for(const blocked of[false,true]){const{b,deploy,receipts}=make(),u=deploy(),e=enemy(b,{c:blocked?4.2:6,def:100});if(blocked)block(u,e);const v=shot(b,u,e);near(v.windup,.433);assert.equal(v.animation,blocked?'Combat':'Attack');advance(b,.4);near(e.hp,100000);advance(b,blocked?.1:.3);near(100000-e.hp,u.s.atk-100);const r=output(receipts,u)[0];assert.equal(r.dmg.applyWay,blocked?'melee':'ranged');assert.equal(r.dmg.isAttack,true);assert.equal(r.dmg.isSkill,false);}
});
test('normal INPUT retains startup target, permits flying and never substitutes a living hidden victim',()=>{
 const{b,deploy}=make(),u=deploy(),air=enemy(b,{fly:true});shot(b,u,air);advance(b,.7);assert.ok(air.hp<100000);const e=enemy(b,{c:6}),z=enemy(b);shot(b,u,e);e.hidden=true;advance(b,.8);near(e.hp,100000);near(z.hp,100000);
});
test('accepted sub-frame control cancels an unborn normal shot but cannot retract an emitted unmanaged arrow',()=>{
 for(const born of[false,true]){const{b,deploy}=make(),u=deploy(),e=enemy(b,{c:6});shot(b,u,e);if(born)advance(b,.47);b.applyStatus(u,'stun',{duration:.001});advance(b,.8);if(born)assert.ok(e.hp<100000);else near(e.hp,100000);}
});
test('S1 pays selected three-second completion, never actual source2.0 animation event or startup',()=>{
 const{b,deploy}=make(),u=deploy();rng(b,[0]);cast(u);near(u.mem.chilcCost,10);assert.equal(u.s.flags.disarm,true);assert.equal(u.mem.regularFormVisual.clip,'Skill_1');advance(b,2.1);near(b.dp,0);advance(b,.95);near(b.dp,10);assert.equal(u.skill.active,false);assert.equal(u.mem.chilcCost,null);assert.equal(u.mem.regularFormVisual,null);
});
test('S1 every rank pays its selected maximum and next cast recomputes fresh minimum',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({rank}),u=deploy();rng(b,[0]);cast(u);advance(b,3.05);near(b.dp,bb(0,rank).floor);b.getPlayer('arkpedia').dp=0;rng(b,[.99,0,.99,0,.99,0]);cast(u);advance(b,3.05);near(b.dp,bb(0,rank).ground);}
});
test('S1 full-SP AUTO begins without targets, stops normal attacks and respects its own SP lock',()=>{
 const{b,deploy,receipts}=make(),u=deploy();rng(b,[0]);u.skill.rule='SP_FULL';u.skill.setSpTotal(u.skill.spCost);advance(b,.04);assert.equal(u.skill.active,true);assert.equal(u.skill.gainSp(1,'test'),0);const e=enemy(b);u.atkCd=0;advance(b,2.5);near(e.hp,100000);assert.equal(output(receipts,u).length,0);advance(b,.6);near(b.dp,10);assert.equal(u.skill.active,false);
});
test('S1 bounded timer retains computed outcome through separate pre-event and post-event short controls',()=>{
 for(const when of[.5,2.2]){const{b,deploy}=make(),u=deploy();rng(b,[0]);cast(u);advance(b,when);b.applyStatus(u,'stun',{duration:.001});advance(b,3.1-when);near(b.dp,10);assert.equal(u.skill.active,false);}
});
test('S1 true death, withdrawal and explicit premature finish never grant an uncompleted reward',()=>{
 for(const state of['death','retreat','early']){const{b,deploy}=make(),u=deploy();rng(b,[0]);cast(u);advance(b,2.2);if(state==='death')b.kill(u);else if(state==='retreat')b.retreatOperator(ID);else u.skill.end('interrupted');const baseline=b.dp;advance(b,1);near(b.dp,baseline);assert.equal(u.mem.chilcCost,null);assert.equal(u.mem.regularFormVisual,null);}
});
test('S2 all selected ranks retain additive ASPD, Physical-only dodge and native cap1 event',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill:1,rank}),u=deploy(),e=enemy(b);cast(u);near(u.s.aspd,u.base.aspd+bb(1,rank).attack_speed);near(u.s.dodgePhys,bb(1,rank).prob);near(u.s.dodgeArts,0);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');advance(b,.37);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');const v=shot(b,u,e);near(v.windup,.1);assert.equal(v.animation,'Skill_2_Loop');}
});
test('S2 selected Physical dodge actually rejects Physical output while Arts/True still damage',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);advance(b,.37);rng(b,[0]);const hp=u.hp;
 near(b.dealDamage(e,u,{amount:100,type:'phys'}),0);near(u.hp,hp);assert.ok(b.dealDamage(e,u,{amount:100,type:'arts'})>0);near(b.dealDamage(e,u,{amount:100,type:'true'}),100);
});
test('S2 remains ranged even against blocked enemy, unlike normal Combat',()=>{
 const{b,deploy,receipts}=make({skill:1}),u=deploy(),e=enemy(b,{c:4.65});block(u,e);cast(u);advance(b,.37);const born=[];const add=b.addProjectile.bind(b);b.addProjectile=p=>{born.push({source:p.source,speed:p.speed,dp:b.dp});return add(p);};shot(b,u,e);advance(b,.4);assert.equal(born.length,1);assert.equal(born[0].source,u);near(born[0].speed,10);near(born[0].dp,0);near(b.dp,1);assert.equal(output(receipts,u)[0].dmg.applyWay,'ranged');
});
test('S2 accepted shieldedzero grants DP while dodge/cancellation/fizzled born target do not',()=>{
 for(const state of['shield','dodge','cancel','hidden']){const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b,{c:6});cast(u);advance(b,.37);if(state==='shield')b.addBuff(e,{key:'shield',shield:100000});if(state==='dodge')b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});if(state==='cancel')b.on('hit',x=>{if(x.source===u)x.dmg.cancel=true;});shot(b,u,e);advance(b,.14);near(b.dp,0);if(state==='hidden')e.hidden=true;advance(b,.4);near(b.dp,state==='shield'?1:0);near(e.hp,100000);}
});
test('S2 native unfiltered output includes non-attack HP damage but never element gauge or direct HPLOSS',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);advance(b,.37);for(const type of['phys','arts','true','elemental'])b.dealDamage(u,e,{amount:1,type,isAttack:false,canDodge:false});near(b.dp,4);b.dealDamage(u,e,{amount:1,type:'element',element:'burn'});b.loseHp(e,1,{source:u});near(b.dp,4);
});
test('S2 DP belongs to active impact, not launch; skill end or source withdrawal before arrival stops payment',()=>{
 for(const state of['end','retreat']){const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b,{c:6});cast(u);advance(b,.37);shot(b,u,e);advance(b,.14);assert.ok(b.projectiles.list.length);if(state==='end')u.skill.end('duration');else b.retreatOperator(ID);const baseline=b.dp;advance(b,.4);assert.ok(e.hp<100000);near(b.dp,baseline);}
});
test('S2 natural AI grants exactly one DP per accepted victim without duplicate inherited Agent behavior',()=>{
 const{b,deploy,receipts}=make({skill:1}),u=deploy(),e=enemy(b,{c:6});cast(u);advance(b,.37);u.atkCd=0;advance(b,3.3);const r=output(receipts,u);assert.ok(r.length>=4);near(b.dp,r.length);assert.ok(r.every(x=>x.dmg.applyWay==='ranged'));u.atkCd=1000;
});
test('S2 expiry plays exact End and restores own modifiers without deleting foreign buffs',()=>{
 const{b,deploy}=make({skill:1}),u=deploy();b.addBuff(u,{key:'foreign',mods:{aspd:7,dodgePhys:.1}});cast(u);advance(b,10.05);assert.equal(u.skill.active,false);near(u.s.aspd,u.base.aspd+7);near(u.s.dodgePhys,.1);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');advance(b,.2);assert.equal(u.mem.regularFormVisual,null);assert.ok(u.findBuff('foreign'));
});
test('S2 death/withdrawal clears born/loop/end presentation and never grants DP after owner retirement',()=>{
 for(const state of['death','retreat']){const{b,deploy}=make({skill:1}),u=deploy();cast(u);advance(b,.1);if(state==='death')b.kill(u);else b.retreatOperator(ID);const baseline=b.dp;advance(b,.6);assert.equal(u.mem.regularFormVisual,null);assert.equal(u.findBuff('chilchuck:begin'),null);near(b.dp,baseline);}
});
