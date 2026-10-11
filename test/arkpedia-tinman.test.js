// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test'; import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-tinman-prefabs.json' with { type: 'json' };
import { TINMAN_OPERATORS } from '../shared/arkpedia/tinman-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const ID='char_4151_tinman',ALLY='char_208_melan';
const near=(a,z,e=1e-5)=>assert.ok(Math.abs(a-z)<=e,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
 const d=structuredClone(data),o=d.operators[ID];d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const build={...defaultBuild(o),elite,level:o.phases[elite].maxLevel,trust:0,potential,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[ALLY])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.recordEvents=true;b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const deploy=(id=ID,r=5,c=5,f=dir)=>{b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,f);assert.ok(a);a.atkCd=1000;if(a.skill)a.skill.rule='NEVER';return a;};
 return{b,u:deploy(),deploy};
}
function enemy(b,{x=6,y=5,fly=false,def=0,res=0}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,atk:100,def,res,moveSpeed:0});if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=100000;b.addBuff(e,{key:'test:pin',flags:{disarm:true,noMove:true}});b._buildEnemyIndex();return e;}
function cast(b,u,e=null){u.skill.setSpTotal(u.skill.spCost*u.skill.maxCharges);assert.equal(u.skill.activate('test'),true);if(u.skill.id.endsWith('_1'))assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;}
function land(b,u,count=1){for(let i=0;i<200&&!(u.mem.tinmanFields?.length>=count);i++)advance(b,b.dt);assert.equal(u.mem.tinmanFields.length,count);return u.mem.tinmanFields.at(-1);}
const sourceBB=(s,r=10)=>Object.fromEntries(data.operators[ID].skills[s].levels[r-1].blackboard.map(x=>[x.key,x.value]));

test('original five bundles, all20 ranks, templates and both literal facing clocks',()=>{
 assert.deepEqual(Object.keys(TINMAN_OPERATORS),[ID]);assert.equal(evidence.source.bundles.length,5);assert.equal(Object.keys(evidence.templates).length,4);assert.equal(Object.values(evidence.tables.skills).flatMap(s=>s.levels).length,20);assert.equal(evidence.frameParity,false);
 for(const face of['Front','Back']){const m=evidence.models[ID][face];assert.equal(m.sha256,evidence.officialSkeletonBindings[ID][face].sha256);near(m.hits.Attack[0],.533);near(m.hits.Skill[0],.6);near(m.hits.Skill_2[0],.567);near(m.durations.Skill_2,1.5);}
});
test('all20 ranks retain source cost, charge capacity, field lifetime/radius and damage',()=>{
 for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){const{b,u}=make({skill,rank}),e=enemy(b),bb=sourceBB(skill,rank);assert.equal(u.skill.spCost,data.operators[ID].skills[skill].levels[rank-1].spData.spCost);assert.equal(u.skill.maxCharges,data.operators[ID].skills[skill].levels[rank-1].spData.maxChargeTime);cast(b,u,e);const field=land(b,u);near(field.duration,bb.projectile_delay_time);near(field.radius,bb.projectile_range);const before=e.hp;advance(b,1);near(before-e.hp,u.base.atk*bb.atk_scale*1.2);}
});
test('normal attack is single-target Physical, hits air and respects speed5 projectile travel',()=>{
 const{b,u}=make(),e=enemy(b,{fly:true,def:100}),z=enemy(b,{x:6.1});assert.equal(u.profile.canHitFly,true);assert.equal(u.profile.dmgType,'phys');b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.53);near(e.hp,100000);advance(b,.15);near(e.hp,100000);advance(b,.1);near(e.hp,100000-(u.s.atk-100));near(z.hp,100000);assert.ok(!u.mem.tinmanFields?.length);
});
test('normal maxAnimScale1 does not speed windup under ASPD and does stretch slowdown',()=>{
 for(const aspd of[50,200]){const{b,u}=make(),e=enemy(b,{x:5});b.addBuff(u,{key:'aspd',mods:{aspd:aspd-100}});b.forceAttack(u,[e]);u.atkCd=1000;const windup=.533/Math.min(1,aspd/100);advance(b,windup-.06);near(e.hp,100000);advance(b,.1);near(e.hp,100000-u.s.atk);}
});
test('S1 uses offensive SP and only casts with a ground target, retaining ready charge against air',()=>{
 const{b,u}=make(),e=enemy(b,{fly:true});assert.equal(u.skill.spType,'attack');u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),false);assert.equal(u.skill.charges,1);b.forceAttack(u,[e]);u.atkCd=1000;advance(b,1);assert.equal(u.skill.charges,1);assert.ok(!u.mem.tinmanFields?.length);
});
test('S1 automatic next attack consumes charge without gaining attack SP for that throw',()=>{
 const{b,u}=make(),e=enemy(b);u.skill.rule='DEFAULT';u.skill.setSpTotal(u.skill.spCost);u.atkCd=0;advance(b,1.1);assert.equal(u.skill.activations,1);assert.equal(u.skill.spTotal,0);assert.equal(u.mem.tinmanFields.length,1);assert.equal(u.stats.attacks,1);
});
test('S1 retargets at release and refunds charge if all ground targets leave',()=>{
 const{b,u}=make(),e=enemy(b);cast(b,u,e);e.x=15;b._buildEnemyIndex();advance(b,.7);assert.equal(u.skill.charges,1);assert.equal(b.projectiles.list.length,0);assert.ok(!u.mem.tinmanFields?.length);
});
test('skill throws are fixed point speed3, do not follow moving/dead targets or damage before landing',()=>{
 const{b,u}=make(),e=enemy(b);cast(b,u,e);advance(b,.65);assert.equal(b.projectiles.list.length,1);e.x=12;b._buildEnemyIndex();advance(b,.5);const f=u.mem.tinmanFields[0];near(f.point.x,6);near(f.point.y,5);near(e.hp,100000);const a=enemy(b);advance(b,.8);near(a.hp,100000);advance(b,.2);assert.ok(a.hp<100000);
});
test('field first .9 per-recipient then1s ticks, no direct skill impact damage',()=>{
 const{b,u}=make(),e=enemy(b);cast(b,u,e);land(b,u);near(e.hp,100000);advance(b,.8);near(e.hp,100000);advance(b,.2);near(e.hp,100000-u.s.atk*.75*1.2);advance(b,.75);near(e.hp,100000-u.s.atk*.75*1.2);advance(b,.25);near(e.hp,100000-2*u.s.atk*.75*1.2);
});
test('S1 Enfeeble is strongest, nonstacking across fields and disappears on leaving',()=>{
 const{b,u}=make(),e=enemy(b);cast(b,u,e);land(b,u);near(e.s.atk,70);cast(b,u,e);land(b,u,2);near(e.s.atk,70);b.applyStatus(e,'weaken',{duration:1,value:.5});near(e.s.atk,50);e.x=15;b._buildEnemyIndex();advance(b,1.1);near(e.s.atk,100);assert.equal(e.buffs.some(v=>v.data?.tinmanScale),false);
});
test('field damage snapshots release ATK and bypasses source outgoing multipliers/penetration',()=>{
 const{b,u}=make(),e=enemy(b,{res:50});b.addBuff(u,{key:'out',mods:{dmgDealtMul:3,resIgnorePct:1,atkPct:1}});const atk=u.s.atk;cast(b,u,e);land(b,u);b.removeBuff(u,'out');advance(b,1);near(e.hp,100000-atk*.75*1.2*.5);
});
test('talent unlocks E2 and correct potential without applying IS-only Hope/Toil to battle',()=>{
 for(const[elite,potential,scale]of[[0,1,1],[1,1,1],[2,1,1.2],[2,5,1.22]]){const{b,u}=make({elite,potential}),e=enemy(b);cast(b,u,e);land(b,u);const before=e.hp;advance(b,1);near(before-e.hp,u.s.atk*sourceBB(0,Math.min(10,[4,7,10][elite])).atk_scale*scale);near(u.s.spRecovery,1);assert.equal(u.s.blockCnt,1);}
});
test('talent amplifies other-source continuous damage once, but not ordinary attacks or bursts',()=>{
 const{b,u}=make(),e=enemy(b);cast(b,u,e);land(b,u);cast(b,u,e);land(b,u,2);let before=e.hp;b.dealDamage(null,e,{amount:100,type:'phys',canDodge:false,tags:['dot']});near(before-e.hp,120);before=e.hp;b.dealDamage(u,e,{amount:100,type:'arts',isAttack:true,canDodge:false});near(before-e.hp,100);before=e.hp;b.dealDamage(null,e,{amount:100,type:'true',tags:['burst']});near(before-e.hp,100);
});
test('S2 two charges can create independently stacked fields and refill during field lifetime',()=>{
 const{b,u}=make({skill:1}),e=enemy(b);cast(b,u,e);land(b,u);advance(b,.8);assert.equal(u.skill.charges,1);assert.equal(u.skill.active,false);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;land(b,u,2);advance(b,1.6);assert.equal(u.skill.active,false);assert.ok(u.skill.spTotal>0);assert.equal(u.mem.tinmanFields.length,2);assert.equal(e.buffs.filter(v=>v.data?.tinmanScale).length,2);
});
test('S2 can throw at a random in-range stage tile without an enemy and heal without a heal cast',()=>{
 const{b,u,deploy}=make({skill:1}),a=deploy(ALLY,5,6);a.base.maxHp=100000;a.markDirty();void a.s;a.hp=1;b.rng.pick=xs=>xs.find(k=>k===5*21+6)??xs[0];cast(b,u);const f=land(b,u);assert.deepEqual(f.point,{x:6,y:5});near(a.s.hpRegen,u.s.atk*.25);const before=a.hp;advance(b,1);near(a.hp-before,u.s.atk*.25,2);assert.equal(u.stats.heal,0);
});
test('S2 regeneration includes noHeal/healFree allies, does not use outgoing healing multiplier and stops outside',()=>{
 const{b,u,deploy}=make({skill:1}),a=deploy(ALLY,5,6),e=enemy(b);a.hp=1;b.addBuff(a,{key:'blockedheal',flags:{noHeal:true,healFree:true}});b.addBuff(u,{key:'outgoingheal',mods:{healingDealtMul:3}});cast(b,u,e);land(b,u);const before=a.hp;advance(b,1);near(a.hp-before,u.s.atk*.25,2);a.x=15;advance(b,.1);near(a.s.hpRegen,0);
});
test('ground fields exclude flyers, unselectable and unblocked invisible enemies, but can affect sleeping ground',()=>{
 const{b,u}=make(),e=enemy(b),fly=enemy(b,{x:6.1,fly:true}),free=enemy(b,{x:6.2}),stealth=enemy(b,{x:6.3}),sleep=enemy(b,{x:6.4});b.addBuff(free,{key:'free',flags:{untargetable:true}});b.addBuff(stealth,{key:'stealth',flags:{stealth:true}});b.applyStatus(sleep,'sleep',{duration:10});cast(b,u,e);land(b,u);advance(b,1);assert.ok(e.hp<100000);near(fly.hp,100000);near(free.hp,100000);near(stealth.hp,100000);assert.equal(sleep.buffs.some(v=>v.data?.tinmanScale),true);
});
test('S2 fixed cast clock follows slowdown and brief control cancels unreleased projectile permanently',()=>{
 for(const aspd of[50,200]){const{b,u}=make({skill:1}),e=enemy(b);b.addBuff(u,{key:'aspd',mods:{aspd:aspd-100}});cast(b,u,e);near(u.skill.timeLeft,1.5/Math.min(1,aspd/100));advance(b,.1);b.applyStatus(u,'stun',{duration:b.dt/4});advance(b,3);assert.equal(b.projectiles.list.length,0);assert.ok(!u.mem.tinmanFields?.length);assert.equal(u.skill.active,false);}
});
test('retreat before release cancels, while fired projectile and field survive source retreat until expiry',()=>{
 {const{b,u}=make({skill:1}),e=enemy(b);cast(b,u,e);b.retreatOperator(ID);advance(b,2);assert.equal(b.projectiles.list.length,0);assert.ok(!u.mem.tinmanFields?.length);}
 {const{b,u}=make({skill:1}),e=enemy(b);cast(b,u,e);advance(b,.65);assert.equal(b.projectiles.list.length,1);b.retreatOperator(ID);const f=land(b,u);advance(b,1);assert.ok(e.hp<100000);advance(b,f.duration);assert.equal(e.buffs.some(v=>v.data?.tinmanScale),false);assert.equal(u.mem.tinmanFields.length,0);}
});
test('field expiry removes regeneration, damage amplification and weaken without delayed ghost damage',()=>{
 const{b,u,deploy}=make({skill:1}),e=enemy(b),a=deploy(ALLY,5,6);cast(b,u,e);const f=land(b,u);a.hp=1;advance(b,f.duration+.1);near(a.s.hpRegen,0);assert.equal(e.buffs.some(v=>v.data?.tinmanScale),false);const hp=e.hp;advance(b,3);near(e.hp,hp);
});
