// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-guard-six-star-fourth-prefabs.json' with { type: 'json' };
import { GUARD_SIX_STAR_FOURTH_OPERATORS as configs } from '../shared/arkpedia/guard-six-star-fourth-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
import { COLS } from '../server/sim/constants.js';
const ID='char_4082_qiubai';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const nodes=rs=>rs.flatMap(r=>r.components.map(c=>c.data??c));
const sourceBB=(skill,rank=10)=>Object.fromEntries(data.operators[ID].skills[skill].levels[rank-1].blackboard.map(v=>[v.key,v.value]));
function buildFor(id,{skill=0,rank=10,elite=null,potential=1}={}){const op=data.operators[id];elite??=op.phases.length-1;rank=Math.min(rank,elite===2?10:elite===1?7:4);return{...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:rank};}
function make(opts={},support=false){const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;const b=new StandardBattle(source,support?{operators:[buildFor('char_264_f12yin',{elite:0,rank:4})],support:{id:ID,skillId:'skchr_qiubai_3'}}:{operators:[buildFor(ID,opts)]});b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(v=>({...v,height:'LOW',build:'ALL',pass:'ALL'}));const rng=b.rng;const fixed=()=>.99;for(const k of ['pick','int','shuffle'])fixed[k]=rng[k]?.bind(rng);b.rng=fixed;return{b,deploy:(r=3,c=4,dir='RIGHT')=>{b.addDp('arkpedia',99);const u=b.deployOperator(ID,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;}};}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function cast(u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,{r=3,c=6,fly=false,def=0,res=0,hp=100000}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});e.base.maxHp=hp;e.base.def=def;e.base.res=res;e.def={...e.def,immune:new Set(e.def.immune)};if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;b.addBuff(e,{key:'test:pin',persist:true,flags:{disarm:true,noMove:true}});b._buildEnemyIndex();return e;}
function move(b,e,r,c){e.x=c;e.y=r;e.tileR=r;e.tileC=c;b._enemiesDirty=true;b._buildEnemyIndex();}
function shot(b,u,e){b.forceAttack(u,[e]);u.atkCd=1000;}
const talent=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null)?.bb;
const openingEvents=b=>b._evq.filter(v=>v[0]==='dmg'&&v[3]==='arts');
function zeroRng(b){const old=b.rng;const zero=()=>0;zero.pick=old.pick;zero.int=old.int;b.rng=zero;}

test('original contracts retain complete Qiubai and historical Ch’en deferral, official facing identity and exact timers',()=>{
 assert.deepEqual(Object.keys(configs),[ID]);assert.ok(evidence.deferredOperators.char_010_chen);assert.equal(evidence.frameParity,false);
 for(const id of [ID,'char_010_chen'])for(const face of ['Front','Back'])assert.equal(evidence.originalModels[id][face].sha256,evidence.officialSkeletonBindings[id][face].sha256);
 const s1=nodes(evidence.skills.skchr_qiubai_1).find(v=>v.pathId==='-4577295031601808680');assert.equal(s1._selectTargetTiming,0);assert.equal(s1._useCachedAtkOnly,0);assert.equal(s1._atkScale,1);assert.equal(s1._projectileKey,'projectile_chr_qiubai_s1');
 const sword=nodes(evidence.skills.skchr_qiubai_2).find(v=>v.pathId==='1230869157349496351');assert.equal(sword._waitForAttackEvent,1);assert.equal(sword._metadata.blackboardPrefix,'sword_begin_');assert.equal(sword._damageType,2);
 assert.ok(evidence.verificationLimits.some(s=>s.includes('CombinedAbility')));assert.equal(evidence.originalModels.char_010_chen.Front.hits.Skill_3.length,11);
});
test('all three skills and all ten ranks instantiate with source promotion/potential and maxed support',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill,rank}),u=deploy();assert.equal(u.skill.id,configs[ID].skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);}
 const low=make({elite:0,rank:4}),u=low.deploy();assert.equal(u.def.talents.length,0);
 const sup=make({},true),s=sup.deploy();assert.equal(s.skill.id,'skchr_qiubai_3');assert.equal(s.def.raw.arkpedia.elite,2);
});
test('normal source Combat full Physical and ranged80% damage retain separate actual mitigation/origin',()=>{
 for(const c of [5,6]){const{b,deploy}=make(),u=deploy(),e=enemy(b,{c,def:100});const ways=[];b.on('hit',x=>{if(x.source===u)ways.push(x.dmg.applyWay);});shot(b,u,e);advance(b,.85);near(100000-e.hp,u.s.atk*(c===5?1:.8)-100);assert.deepEqual(ways,[c===5?'melee':'ranged']);}
});
test('normal direct Combat has no flight while source ranged speed10 waits until actual impact',()=>{
 for(const c of [5,7]){const{b,deploy}=make(),u=deploy(),e=enemy(b,{c});shot(b,u,e);advance(b,.55);if(c===5){near(100000-e.hp,u.s.atk);assert.equal(b.projectiles.list.length,0);}else{near(e.hp,100000);assert.ok(b.projectiles.list.length);advance(b,.4);near(100000-e.hp,u.s.atk*.8);}}
});
test('native CAST replaces a dead startup target and preserves anti-air release eligibility',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b),z=enemy(b,{c:6.1,fly:true});shot(b,u,e);b.kill(e);advance(b,.85);near(100000-z.hp,u.s.atk*.8);near(u.stats.attacks,1);
});
test('Find an Opening triggers on exact Sluggish or Bind, not arbitrary slow/noMove, after source .1 marker',()=>{
 for(const state of ['none','slow','sluggish','bind']){const{b,deploy}=make(),u=deploy(),e=enemy(b,{c:5,res:50});if(state!=='none')b.applyStatus(e,state,{duration:10});shot(b,u,e);advance(b,.55);const hp=e.hp;near(openingEvents(b).length,0);advance(b,.15);const expected=['sluggish','bind'].includes(state)?u.s.atk*talent(u,'atk_scale').atk_scale*.5:0;near(hp-e.hp,expected);}
});
test('delayed opening tests current status at finish and uses selected E1/E2/potential current ATK',()=>{
 for(const elite of [1,2])for(const potential of [1,5]){const{b,deploy}=make({elite,rank:7,potential}),u=deploy(),e=enemy(b,{c:5});shot(b,u,e);advance(b,.55);const hp=e.hp;b.applyStatus(e,'sluggish',{duration:10});b.addBuff(u,{key:'late-atk',mods:{atkPct:.3}});advance(b,.15);near(hp-e.hp,u.s.atk*talent(u,'atk_scale').atk_scale);}
 const{b,deploy}=make(),u=deploy(),e=enemy(b,{c:5});b.applyStatus(e,'sluggish',{duration:10});shot(b,u,e);advance(b,.55);const hp=e.hp;b.removeBuff(e,'sluggish');advance(b,.15);near(e.hp,hp);
});
test('Falling Petals rolls per calculated victim before dodge/absorption and delayed opening sees new Bind',()=>{
 for(const block of ['shield','dodge']){const{b,deploy}=make(),u=deploy(),e=enemy(b,{c:5});zeroRng(b);if(block==='shield')b.addBuff(e,{key:'shield',shieldHits:1});else b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});shot(b,u,e);advance(b,.55);near(e.hp,100000);assert.ok(e.s.flags.bind);advance(b,.15);near(100000-e.hp,u.s.atk*talent(u,'atk_scale').atk_scale);}
});
test('born normal flight retains source talent after owner withdrawal and delayed rider stays source credited',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b,{res:20});b.applyStatus(e,'sluggish',{duration:10});shot(b,u,e);advance(b,.55);assert.ok(b.projectiles.list.length);b.retreatOperator(ID);advance(b,.45);near(100000-e.hp,u.s.atk*.8+u.s.atk*talent(u,'atk_scale').atk_scale*.8);assert.ok(u.stats.dmg>u.s.atk*.8);assert.equal(u.deployed,false);
});
test('S1 all ten ranks preserves full skill default ATK and selected Bind then radius1.7 Arts finish',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({rank}),u=deploy(),e=enemy(b,{res:50}),nearby=enemy(b,{r:4,c:6,fly:true}),outside=enemy(b,{r:3,c:8});cast(u);shot(b,u,e);advance(b,.85);near(100000-e.hp,u.s.atk+u.s.atk*talent(u,'atk_scale').atk_scale*.5);assert.ok(e.s.flags.bind);near(nearby.hp,100000);advance(b,sourceBB(0,rank).duration+.1);near(100000-nearby.hp,u.s.atk*sourceBB(0,rank).aoe_scale);near(outside.hp,100000);assert.ok(!e.findBuff(`qiubai:s1-marker:${u.id}`));}
});
test('S1 direct blocked victim still uses original ranged projectile and has one primary hit',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b,{c:5});cast(u);shot(b,u,e);advance(b,.52);assert.ok(b.projectiles.list.length);advance(b,.2);const hits=b._evq.filter(v=>v[0]==='dmg'&&v[1]===e.id&&v[3]==='phys');assert.equal(hits.length,1);near(100000-e.hp,u.s.atk);advance(b,.1);near(100000-e.hp,u.s.atk+u.s.atk*talent(u,'atk_scale').atk_scale);
});
test('S1 timer survives owner retreat, reads current ATK and owner-death finish hits neighbors once',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b),z=enemy(b,{r:4,c:6});cast(u);shot(b,u,e);advance(b,.85);b.retreatOperator(ID);b.addBuff(u,{key:'test-atk',allowDead:true,mods:{atkPct:.5}});b.kill(e);near(100000-z.hp,u.s.atk*sourceBB(0).aoe_scale);advance(b,4);near(100000-z.hp,u.s.atk*sourceBB(0).aoe_scale);
});
test('S1 dispel removes only the AoE marker and cannot duplicate natural finish',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b),z=enemy(b,{r:4,c:6});cast(u);shot(b,u,e);advance(b,.85);b.removeBuff(e,`qiubai:s1-marker:${u.id}`);near(100000-z.hp,u.s.atk*3);assert.ok(e.s.flags.bind);advance(b,4);near(100000-z.hp,u.s.atk*3);
});
test('S1 native UNMOVABLE immunity excludes Bind and explosion rather than inventing ordinary SP effects',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b),z=enemy(b,{r:4,c:6});e.def.immune.add('bind');zeroRng(b);cast(u);shot(b,u,e);advance(b,4.2);assert.ok(!e.s.flags.bind);near(z.hp,100000);near(100000-e.hp,u.s.atk);
});
test('S1 pre-emission dead input refunds only without replacement; own kill/emitted flight cannot refund',()=>{
 for(const replacement of [false,true]){const{b,deploy}=make(),u=deploy(),e=enemy(b);const z=replacement?enemy(b,{c:6.1}):null;cast(u);shot(b,u,e);b.kill(e);advance(b,.85);if(z){near(100000-z.hp,u.s.atk+u.s.atk*talent(u,'atk_scale').atk_scale);assert.equal(u.skill.charges,0);}else assert.equal(u.skill.charges,1);}
 const{b,deploy}=make(),u=deploy(),e=enemy(b,{hp:1});cast(u);shot(b,u,e);advance(b,.85);assert.equal(e.alive,false);assert.equal(u.skill.charges,0);
});
test('S1 sub-tick control cancels unborn emission and preserves charge pending without output',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);cast(u);shot(b,u,e);b.applyStatus(u,'stun',{duration:.001});advance(b,.9);near(e.hp,100000);assert.equal(u.skill.pending,true);assert.equal(u.skill.charges,0);
});
test('S2 all ranks wait first event, apply selected ATK only after burst, and preserve both native timers',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill:1,rank}),u=deploy(),e=enemy(b),base=u.s.atk,x=sourceBB(1,rank);cast(u);near(u.s.atk,base);advance(b,.45);near(e.hp,100000);advance(b,.1);near(100000-e.hp,base*x.sword_begin_atk_scale);near(u.s.atk,base*(1+x.atk));assert.ok(e.findBuff(`qiubai:s2-slow:${u.id}`));near(u.skill.timeLeft,5.5-b.time,.04);}
});
test('S2 actual release acquires uncapped ground4-1 strip, rejects flying/hidden/free and respects direction',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),es=Array.from({length:6},(_,i)=>enemy(b,{c:5+i*.3})),fly=enemy(b,{c:6,fly:true}),side=enemy(b,{r:4,c:6}),free=enemy(b,{c:6});b.addBuff(free,{key:'free',flags:{untargetable:true}});const hidden=enemy(b,{c:6});hidden.hidden=true;cast(u);advance(b,.55);for(const e of es)assert.ok(e.hp<100000);near(fly.hp,100000);near(side.hp,100000);near(free.hp,100000);near(hidden.hp,100000);
 const back=make({skill:1}),v=back.deploy(3,4,'LEFT'),e=enemy(back.b,{c:2});cast(v);advance(back.b,.55);assert.ok(e.hp<100000);assert.equal(v.mem.regularFormVisual.clip,'Skill_2');
});
test('S2 release-time reselection handles entering/leaving targets and owned aura removes on leave',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b),z=enemy(b,{r:1,c:8});cast(u);move(b,e,1,8);move(b,z,3,6);advance(b,.55);near(e.hp,100000);assert.ok(z.hp<100000);assert.ok(z.findBuff(`qiubai:s2-slow:${u.id}`));move(b,z,1,8);advance(b,.1);assert.ok(!z.findBuff(`qiubai:s2-slow:${u.id}`));
});
test('S2 finisher happens on source4.88 field clock while selected ATK is present, before five-second mode ends',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b,{def:100,res:100});const base=u.s.atk;cast(u);advance(b,1);const hp=e.hp;advance(b,4.2);near(e.hp,hp);advance(b,.23);near(hp-e.hp,base*2.4*3-100);near(u.s.atk,base);assert.equal(u.skill.active,true);advance(b,.15);assert.equal(u.skill.active,false);assert.ok(!e.findBuff(`qiubai:s2-slow:${u.id}`));
});
test('S2 finisher acquires current legal WALK targets and preserves source direct ranged origin',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b,{r:1,c:8}),z=enemy(b,{c:6,fly:true});cast(u);advance(b,4.9);move(b,e,3,6);let way=null;b.on('hit',x=>{if(x.source===u&&x.target===e&&x.dmg.type==='phys')way=x.dmg.applyWay;});advance(b,.55);near(100000-e.hp,u.base.atk*2.4*3);near(z.hp,100000);assert.equal(way,'ranged');
});
test('S2 accepted sub-tick control before initial event cancels everything, control after birth retains field finisher',()=>{
 for(const born of [false,true]){const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);if(born)advance(b,1.2);b.applyStatus(u,'stun',{duration:.001});advance(b,6);if(born)assert.ok(e.hp<100000-u.base.atk*3);else{near(e.hp,100000);near(u.s.atk,u.base.atk);assert.equal(u.skill.active,false);}assert.equal(u.mem.qiubaiCasting,null);assert.ok(!e.findBuff(`qiubai:s2-slow:${u.id}`));}
});
test('S2 owner withdrawal cancels future finisher and preserves foreign Sluggish during owned cleanup',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);advance(b,1.3);b.applyStatus(e,'sluggish',{key:'foreign-slow',duration:20});const hp=e.hp;b.retreatOperator(ID);advance(b,6);near(e.hp,hp);assert.ok(e.findBuff('foreign-slow'));assert.ok(!e.findBuff(`qiubai:s2-slow:${u.id}`));assert.equal(u.mem.regularFormVisual,null);
});
test('S3 all ten ranks applies selected ATK/expanded range, native max3 Arts and one capped stack per family',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill:2,rank}),u=deploy(),es=Array.from({length:4},(_,i)=>enemy(b,{c:6+i*.1,fly:i===0})),x=sourceBB(2,rank);cast(u);advance(b,.1);near(u.s.atk,u.base.atk*(1+x.atk));near(effectiveProfile(u).maxTargets,3);b.forceAttack(u);u.atkCd=1000;advance(b,.85);assert.equal(es.filter(e=>e.hp<100000).length,3);near(u.mem.qiubaiStacks,1);near(u.s.aspd,100+x.attack_speed);for(let j=1;j<x.max_stack_cnt+2;j++){shot(b,u,es[0]);advance(b,.85);}near(u.mem.qiubaiStacks,x.max_stack_cnt);near(u.s.aspd,100+x.max_stack_cnt*x.attack_speed);}
});
test('S3 full Arts removes ranged penalty even blocked, talent multiplier only applies after mastery source key exists',()=>{
 for(const rank of [7,8,10])for(const c of [5,6]){const{b,deploy}=make({skill:2,rank}),u=deploy(),e=enemy(b,{c,res:50});b.applyStatus(e,'sluggish',{duration:20});cast(u);advance(b,.1);shot(b,u,e);advance(b,.85);near(100000-e.hp,u.s.atk*.5+u.s.atk*talent(u,'atk_scale').atk_scale*(sourceBB(2,rank).talent_scale??1)*.5);}
});
test('S3 capped animation rate retains literal Skill_3_Loop event despite ASPD stacks',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);cast(u);advance(b,.1);b.addBuff(u,{key:'foreign-aspd',mods:{aspd:200}});shot(b,u,e);const a=b._evq.find(v=>v[0]==='atk'&&v[1]===u.id);near(a[4].windup,.433);assert.equal(a[4].animation,'Skill_3_Loop');
});
test('S3 empty release and canceled unborn attack cannot create ASPD stacks; successful replacement can',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);cast(u);advance(b,.1);shot(b,u,e);move(b,e,1,8);advance(b,.85);near(u.mem.qiubaiStacks,0);move(b,e,3,6);shot(b,u,e);b.applyStatus(u,'stun',{duration:.001});advance(b,.85);near(u.mem.qiubaiStacks,0);shot(b,u,e);advance(b,.85);near(u.mem.qiubaiStacks,1);
});
test('S3 exact forms, stat/range stack cleanup and fresh entity reset preserve unrelated buffs',()=>{
 const{b,deploy}=make({skill:2}),u=deploy();cast(u);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_Start');advance(b,.15);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_Idle');const e=enemy(b);shot(b,u,e);advance(b,.85);b.addBuff(u,{key:'foreign',mods:{aspd:10}});u.skill.end('test');assert.equal(u.mem.regularFormVisual.clip,'Skill_3_End');near(u.s.aspd,110);near(u.mem.qiubaiStacks,0);advance(b,.15);assert.equal(u.mem.regularFormVisual,null);b.retreatOperator(ID);b.bench[ID].readyAt=b.time;const v=deploy();near(v.mem.qiubaiStacks,0);near(v.s.aspd,100);
});
test('natural S3 AI attacks exactly three victims once per original wave without inherited Lord duplicate behavior',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),es=Array.from({length:5},(_,i)=>enemy(b,{c:6+i*.04}));cast(u);u.atkCd=0;advance(b,.9);assert.equal(es.filter(e=>e.hp<100000).length,3);near(u.stats.attacks,1);near(u.mem.qiubaiStacks,1);for(const e of es.filter(e=>e.hp<100000))near(100000-e.hp,u.s.atk);
});
test('scoped born-hit and finite S1 marker lifecycle leaves no persistent per-impact/death hooks',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);const initial=(b._hooks.hit?.length??0)+(b._hooks.death?.length??0);cast(u);shot(b,u,e);advance(b,4.2);near((b._hooks.hit?.length??0)+(b._hooks.death?.length??0),initial);assert.ok(!e.findBuff('qiubai:opening-marker'));
});
