// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-lucilla-prefabs.json' with { type: 'json' };
import { LUCILLA_OPERATORS as configs } from '../shared/arkpedia/lucilla-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { COLS } from '../server/sim/constants.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const LUCILLA='char_4079_haini';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const nodes=rows=>rows.flatMap(r=>r.components ?? [r.data]);
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


function ranked(b,rank,opts={}){const e=enemy(b,opts);e.def={...e.def,rank};return e;}
const own=(e,u,n)=>e.findBuff(`lucilla:${n}:${u.id}`);
function ready(b,u){advance(b,.25);}

test('Lucilla retains exact native NORMAL aura, source ramp calculations and both facing byte bindings',()=>{
 assert.deepEqual(Object.keys(configs),[LUCILLA]);assert.equal(evidence.sourceVersion,'26-09-23-17-49-43_b9cc4a');
 for(const face of ['Front','Back'])assert.equal(evidence.models[LUCILLA][face].sha256,evidence.officialSkeletonBindings[LUCILLA][face].sha256);
 const all=nodes(evidence.characters[LUCILLA]);const validators=all.filter(c=>c._enemyLevelMask!=null);assert.ok(validators.length>=2);for(const v of validators){assert.equal(v._enemyLevelMask,1);assert.equal(v._motionMask,3);assert.equal(v._targetOptions.ignoreTargetFree,0);}
 const slow=all.flatMap(c=>c._buffs??[]).find(c=>c.buffKey==='haini_s_2[move_speed]');assert.equal(slow.attributes.attributeModifiers[0].attributeType,6);assert.equal(slow.attributes.attributeModifiers[0].formulaItem,1);
 const kill=evidence.buffTemplates['haini_s_2[enemy_killed]'].eventToActions.ON_OWNER_KILLED[0];assert.equal(kill._targetType,'BUFF_SOURCE');assert.deepEqual(kill._buffKeys,['haini_s_2[modify_talent]']);
 assert.equal(evidence.frameParity,false);
});
test('all twenty selected skill/rank builds, actual elite unlocks and maxed support initialize cleanly',()=>{
 for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){const{b,deploy}=make(LUCILLA,{skill,rank}),u=deploy();assert.equal(u.skill.id,configs[LUCILLA].skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);}
 const{deploy}=make(LUCILLA,{elite:0,rank:4}),u=deploy();assert.equal(u.def.talents.length,0);
 const f=make('char_264_f12yin',{elite:0,rank:4},[],{id:LUCILLA,skillId:'skchr_haini_2'}),v=f.deploy(3,4,'RIGHT',LUCILLA);assert.equal(v.def.raw.arkpedia.elite,2);near(talent(v,'damage_scale').damage_scale,1.18);
});
test('normal RANGED single-target Arts uses .533 release plus real speed10 flight and no Sluggish',()=>{
 const{b,deploy}=make(LUCILLA),u=deploy(),e=ranked(b,'NORMAL'),z=ranked(b,'NORMAL',{c:5.1,fly:true});advance(b,b.dt);shot(b,u,e);advance(b,.53);near(e.hp,100000);advance(b,.15);near(100000-e.hp,u.s.atk*1.16);near(z.hp,100000);assert.ok(!e.findBuff('sluggish'));
 const event=b._evq.find(v=>v[0]==='atk'&&v[1]===u.id);near(event[4].windup,.533);assert.equal(event[4].animation,'Attack');assert.equal(event[4].projectile,'tracked');
});
test('talent selected E1/E2/potential Fragile buffs actual normal only and any allied damage',()=>{
 for(const elite of [1,2])for(const potential of [1,5]){const{b,deploy}=make(LUCILLA,{elite,potential}),u=deploy(),e=ranked(b,'NORMAL'),z=ranked(b,'ELITE',{c:5.1}),q=ranked(b,'BOSS',{c:5.2});advance(b,b.dt);const t=talent(u,'damage_scale');near(e.s.dmgTakenMul,t.damage_scale);near(z.s.dmgTakenMul,1);near(q.s.dmgTakenMul,1);b.dealDamage(null,e,{amount:100,type:'true'});near(100000-e.hp,100*t.damage_scale);}
});
test('aura NONE-purpose affects sleeping/stealth/flying normals but excludes target-free, hidden and departed enemies',()=>{
 const{b,deploy}=make(LUCILLA),u=deploy(),e=ranked(b,'NORMAL',{fly:true});b.applyStatus(e,'sleep',{duration:10});b.applyStatus(e,'stealth',{duration:10});advance(b,b.dt);near(e.s.dmgTakenMul,1.16);cast(u); // S1 pending does not change aura.
 b.addBuff(e,{key:'outside-free',flags:{untargetable:true}});advance(b,b.dt);assert.ok(!own(e,u,'fragile'));b.removeBuff(e,'outside-free');advance(b,b.dt);assert.ok(own(e,u,'fragile'));e.hidden=true;advance(b,b.dt);assert.ok(!own(e,u,'fragile'));e.hidden=false;move(b,e,1,8);advance(b,b.dt);assert.ok(!own(e,u,'fragile'));
});
test('named Fragile retains stronger foreign source and resumes owned weaker aura after expiry',()=>{
 const{b,deploy}=make(LUCILLA),u=deploy(),e=ranked(b,'NORMAL');advance(b,b.dt);b.applyStatus(e,'fragile',{key:'other',value:.7,duration:.2});near(e.s.dmgTakenMul,1.7);advance(b,.25);near(e.s.dmgTakenMul,1.16);b.applyStatus(e,'fragile',{key:'other',value:.7});b.retreat(u);advance(b,b.dt);near(e.s.dmgTakenMul,1.7);assert.ok(!own(e,u,'fragile'));assert.ok(e.findBuff('other'));
});
test('S1 all ranks emits selected simultaneous max targets and full selected damage in one attack identity',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(LUCILLA,{rank}),u=deploy(),es=Array.from({length:5},(_,i)=>ranked(b,'NORMAL',{c:5+i*.05,fly:i===1}));advance(b,b.dt);cast(u);const ids=[];b.on('damaged',c=>{if(c.source===u)ids.push(c.dmg.attackId);});shot(b,u,es[0]);advance(b,.7);const x=bb(LUCILLA,0,rank);for(let i=0;i<es.length;i++)near(100000-es[i].hp,i<x.max_target?u.s.atk*x.atk_scale*1.16:0);assert.equal(ids.length,x.max_target);assert.equal(new Set(ids).size,1);assert.equal(u.skill.active,false);}
});
test('S1 natural AI creates only one source wave and capped original animation speed at external200ASPD',()=>{
 const{b,deploy}=make(LUCILLA),u=deploy(),es=Array.from({length:5},(_,i)=>ranked(b,'NORMAL',{c:5+i*.05}));b.addBuff(u,{key:'outside-aspd',mods:{aspd:100}});u.skill.setSpTotal(u.skill.spCost);u.skill.rule='DEFAULT';u.atkCd=0;advance(b,.72);for(let i=0;i<es.length;i++)near(100000-es[i].hp,i<4?u.s.atk*2*1.16:0);assert.equal(b._evq.filter(v=>v[0]==='atk'&&v[1]===u.id).length,4);near(b._evq.find(v=>v[0]==='atk'&&v[1]===u.id)[4].windup,.5);
});
test('S1 CAST replaces dead input, refunds only no-emission dead inputs, and does not refund own emitted kill',()=>{
 const{b,deploy}=make(LUCILLA),u=deploy(),e=ranked(b,'NORMAL');cast(u);shot(b,u,e);b.kill(e);advance(b,.7);assert.equal(u.skill.charges,1);
 const f=make(LUCILLA),a=f.deploy(),first=ranked(f.b,'NORMAL'),next=ranked(f.b,'NORMAL',{c:5.1});cast(a);shot(f.b,a,first);f.b.kill(first);advance(f.b,.7);assert.ok(next.hp<100000);assert.equal(a.skill.charges,0);
 const g=make(LUCILLA),v=g.deploy(),victim=ranked(g.b,'NORMAL');victim.hp=1;cast(v);shot(g.b,v,victim);advance(g.b,.7);assert.equal(victim.alive,false);assert.equal(v.skill.charges,0);
});
test('S1 accepted .001 control cancels unborn emission and preserves pending charge',()=>{
 const{b,deploy}=make(LUCILLA),u=deploy(),e=ranked(b,'NORMAL');cast(u);shot(b,u,e);b.applyStatus(u,'stun',{duration:.001});advance(b,.7);near(e.hp,100000);assert.equal(u.skill.pending,true);assert.equal(b.projectiles.list.length,0);
});
test('born S1 speed10 projectile survives withdrawal with actual RANGED damage origin',()=>{
 const{b,deploy}=make(LUCILLA),u=deploy(),e=ranked(b,'NORMAL',{c:6});let way; b.on('damaged',c=>{if(c.source===u)way=c.dmg.applyWay;});cast(u);shot(b,u,e);advance(b,.56);near(e.hp,100000);assert.ok(b.projectiles.list.length>0);b.retreat(u);advance(b,.4);near(100000-e.hp,u.s.atk*2);assert.equal(way,'ranged');
});
test('S2 all ten ranks selected ATK/movement plus two target release; native source strip remains ordinary range',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(LUCILLA,{skill:1,rank}),u=deploy(),es=Array.from({length:3},(_,i)=>ranked(b,'NORMAL',{c:5+i*.05}));cast(u);const x=bb(LUCILLA,1,rank);near(u.s.atk,u.base.atk*(1+x.atk));for(const e of es)near(e.s.moveSpeed,e.base.moveSpeed*(1+x['attack@move_speed']));ready(b,u);shot(b,u,es[0]);advance(b,.65);for(let i=0;i<3;i++)near(100000-es[i].hp,i<2?u.s.atk*1.16:0);}
});
test('S2 MOVE_SPEED percent combines additively before flat/multiplier/Sluggish and removes only its source',()=>{
 const{b,deploy}=make(LUCILLA,{skill:1}),u=deploy(),e=ranked(b,'NORMAL');b.addBuff(e,{key:'outside-speed',mods:{movePct:.2,moveFlat:.1}});b.applyStatus(e,'sluggish',{key:'outside-sluggish'});cast(u);near(e.s.moveSpeed,(e.base.moveSpeed+.1)*.6*.2);u.skill.end('test');near(e.s.moveSpeed,(e.base.moveSpeed+.1)*1.2*.2);assert.ok(e.findBuff('outside-speed'));assert.ok(e.findBuff('outside-sluggish'));
});
test('S2 each affected NORMAL death from any killer raises base Fragile additively to source cap',()=>{
 for(const potential of [1,5]){const{b,deploy}=make(LUCILLA,{skill:1,potential}),u=deploy(),survivor=ranked(b,'NORMAL');cast(u);const base=talent(u,'damage_scale').damage_scale-1;for(let i=1;i<=6;i++){const victim=ranked(b,'NORMAL',{c:5.1});advance(b,b.dt);b.kill(victim,null);near(survivor.s.dmgTakenMul,1+base*Math.min(3,1+.5*i));}near(u.mem.lucillaKills,6);}
});
test('S2 source NORMAL level and existing owned mark exclude elite, boss, departed and target-free deaths',()=>{
 const{b,deploy}=make(LUCILLA,{skill:1}),u=deploy(),e=ranked(b,'NORMAL'),elite=ranked(b,'ELITE',{c:5.1}),boss=ranked(b,'BOSS',{c:5.2}),gone=ranked(b,'NORMAL',{c:5.3}),free=ranked(b,'NORMAL',{c:5.4});cast(u);b.kill(elite);b.kill(boss);move(b,gone,1,8);b.addBuff(free,{key:'free',flags:{untargetable:true}});advance(b,b.dt);b.kill(gone);b.kill(free);near(u.mem.lucillaKills,0);near(e.s.dmgTakenMul,1.16);
});
test('S2 owned kill ramp resets to talent base/end, restarts zero and preserves foreign Fragile/slow',()=>{
 const{b,deploy}=make(LUCILLA,{skill:1}),u=deploy(),e=ranked(b,'NORMAL'),victim=ranked(b,'NORMAL',{c:5.1});b.applyStatus(e,'fragile',{key:'other-fragile',value:.6});b.applyStatus(e,'sluggish',{key:'other-sluggish'});cast(u);b.kill(victim);near(own(e,u,'fragile').data.value,.24);u.skill.end('test');near(own(e,u,'fragile').data.value,.16);assert.ok(!own(e,u,'move'));assert.ok(!own(e,u,'death'));near(e.s.dmgTakenMul,1.6);advance(b,.25);cast(u);near(own(e,u,'fragile').data.value,.16);assert.equal(u.mem.lucillaKills,0);
});
test('S2 non-attacking aura remains during short control, then actual withdrawal/death clears owned effects',()=>{
 for(const mode of ['retreat','death']){const{b,deploy}=make(LUCILLA,{skill:1}),u=deploy(),e=ranked(b,'NORMAL');cast(u);ready(b,u);b.applyStatus(u,'stun',{duration:.03});advance(b,b.dt);assert.ok(own(e,u,'move'));assert.ok(own(e,u,'fragile'));if(mode==='retreat')b.retreat(u);else b.kill(u);advance(b,b.dt);assert.ok(!own(e,u,'move'));assert.ok(!own(e,u,'death'));assert.ok(!own(e,u,'fragile'));assert.equal(u.mem.regularFormVisual,null);}
});
test('S2 aura follows live expanded range and literal Begin/Idle/End never leaks into redeployment',()=>{
 const{b,deploy}=make(LUCILLA,{skill:1}),u=deploy(),e=ranked(b,'NORMAL',{c:7});cast(u);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');assert.ok(!own(e,u,'move'));b.addBuff(u,{key:'outside-range',mods:{rangeExtend:1}});b.refreshRange(u);advance(b,b.dt);assert.ok(own(e,u,'move'));ready(b,u);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');u.skill.end('test');assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');advance(b,.25);assert.equal(u.mem.regularFormVisual,null);b.retreat(u);b.bench[LUCILLA].readyAt=b.time;const v=deploy();near(v.s.atk,v.base.atk);assert.equal(v.mem.lucillaKills,0);
});
