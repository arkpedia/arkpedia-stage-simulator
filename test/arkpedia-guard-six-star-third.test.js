// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-guard-six-star-third-prefabs.json' with { type: 'json' };
import { GUARD_SIX_STAR_THIRD_OPERATORS as configs } from '../shared/arkpedia/guard-six-star-third-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { COLS } from '../server/sim/constants.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const VIVIANA='char_4098_vvana';
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

test('Viviana complete source kit retains all skills, exact original fields and whole-kit deferrals',()=>{
 assert.deepEqual(Object.keys(configs),[VIVIANA]);assert.equal(evidence.sourceVersion,'26-09-23-17-49-43_b9cc4a');
 for(const face of ['Front','Back'])assert.equal(evidence.originalModels[VIVIANA][face].sha256,evidence.officialSkeletonBindings[VIVIANA][face].sha256);
 for(const sid of configs[VIVIANA].skillIds)assert.ok(evidence.skills[sid].length);
 const shield=JSON.parse(evidence.originalBuffTemplates['vvana_t_2[block_melee]'].eventToActions._items[0].value.SerializedState);
 assert.equal(shield[0]._sideMask,'ENEMY');assert.equal(shield[1]._applyWayFilter,'MELEE');assert.equal(shield[1]._filterDamageType,false);
 assert.ok(evidence.deferredOperators.char_4011_lessng);assert.ok(evidence.deferredOperators.char_350_surtr);assert.ok(evidence.deferredOperators.char_1014_nearl2);
});
test('all three source skills and ten ranks build with actual promotion and support',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,deploy}=make(VIVIANA,{skill,rank}),u=deploy();assert.equal(u.skill.id,configs[VIVIANA].skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);}
 const{deploy}=make(VIVIANA,{elite:0,rank:4}),u=deploy();assert.equal(u.def.talents.length,0);
 const f=make('char_264_f12yin',{elite:0,rank:4},[],{id:VIVIANA,skillId:'skchr_vvana_3'}),v=f.deploy(3,4,'RIGHT',VIVIANA);assert.equal(v.def.raw.arkpedia.elite,2);near(talent(v,'prob').prob,.2);
});
function ranked(b,rank,opts={}){const e=enemy(b,opts);e.def={...e.def,rank};return e;}
test('normal attack selects one ground victim and emits original .367/down clips',()=>{
 for(const dir of ['RIGHT','DOWN','UP']){const{b,deploy}=make(VIVIANA),u=deploy(3,4,dir);const e=enemy(b,dir==='DOWN'?{r:2,c:4}:dir==='UP'?{r:4,c:4}:{}),z=enemy(b,dir==='DOWN'?{r:2,c:4.1}:dir==='UP'?{r:4,c:4.1}:{c:5.1});assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);shot(b,u,e);advance(b,.45);near(100000-e.hp,u.s.atk*1.08);near(z.hp,100000);const a=b._evq.find(v=>v[0]==='atk'&&v[1]===u.id);near(a[4].windup,.367);assert.equal(a[4].animation,dir==='DOWN'?'Attack_Down':'Attack');}
});
test('Candlelight actual E1/E2/potential Arts and named resistance double with any eligible native elite in range',()=>{
 for(const elite of [1,2])for(const potential of [1,5]){const{b,deploy}=make(VIVIANA,{elite,potential}),u=deploy(),e=ranked(b,'ELITE');advance(b,b.dt);const t=talent(u,'damage_scale_m');near(u.s.artsDealtMul,1+2*t.damage_scale_m);near(u.s.physTakenMul,1-2*t.damage_resistance_pm);near(u.s.artsTakenMul,1-2*t.damage_resistance_pm);
  move(b,e,1,8);advance(b,b.dt);near(u.s.artsDealtMul,1+t.damage_scale_m);near(u.s.physTakenMul,1-t.damage_resistance_pm);
 }
});
test('Candlelight rank NORMAL does not double; flying/sleep/stealth eligible, target-free and hidden excluded',()=>{
 const{b,deploy}=make(VIVIANA),u=deploy(),e=ranked(b,'NORMAL');advance(b,b.dt);near(u.s.artsDealtMul,1.08);e.def={...e.def,rank:'BOSS'};e.motion='FLY';b.applyStatus(e,'sleep',{duration:10});b.applyStatus(e,'stealth',{duration:10});advance(b,b.dt);near(u.s.artsDealtMul,1.16);
 b.addBuff(e,{key:'test:free',flags:{untargetable:true}});advance(b,b.dt);near(u.s.artsDealtMul,1.08);b.removeBuff(e,'test:free');e.hidden=true;advance(b,b.dt);near(u.s.artsDealtMul,1.08);
});
test('Candlelight named Sanctuary selects strongest and leaves true damage and HP loss unchanged',()=>{
 const{b,deploy}=make(VIVIANA),u=deploy(),e=enemy(b);b.applyStatus(u,'sanctuary',{source:e,duration:1,value:.4,key:'external-sanctuary'});near(u.s.physTakenMul,.6);const hp=u.hp;b.dealDamage(e,u,{amount:100,type:'true'});b.loseHp(u,100);near(u.hp,hp-200);advance(b,1.1);near(u.s.physTakenMul,.92);
});
test('Nova rolls accepted elite damage, retains one stack and uses selected potential threshold',()=>{
 for(const potential of [1,3]){const{b,deploy}=make(VIVIANA,{potential}),u=deploy(),e=ranked(b,'ELITE');let calls=0;b.rng=()=>{calls++;return 0;};shot(b,u,e);advance(b,.45);assert.equal(u.findBuff('viviana:nova').shieldHits,1);const before=calls;shot(b,u,e);advance(b,.45);assert.equal(calls,before);assert.equal(u.buffs.filter(v=>v.key==='viviana:nova').length,1);b.removeBuff(u,'viviana:nova');b.rng=()=>talent(u,'prob').prob;shot(b,u,e);advance(b,.45);assert.ok(!u.findBuff('viviana:nova'));}
});
test('Nova enemy MELEE shield excludes ranged/none/friendly/sourceless origins and absorbs physical/Arts/true',()=>{
 for(const type of ['phys','arts','true']){const{b,deploy}=make(VIVIANA),u=deploy(),e=ranked(b,'ELITE');b.rng=()=>0;shot(b,u,e);advance(b,.45);const hp=u.hp;
  b.dealDamage(e,u,{amount:300,type,applyWay:'ranged'});assert.ok(u.hp<hp);assert.equal(u.findBuff('viviana:nova').shieldHits,1);const h=u.hp;
  b.dealDamage(e,u,{amount:300,type,applyWay:'none'});assert.ok(u.hp<h);assert.equal(u.findBuff('viviana:nova').shieldHits,1);
  b.dealDamage(u,u,{amount:100,type,applyWay:'melee'});assert.equal(u.findBuff('viviana:nova').shieldHits,1);
  b.dealDamage(e,u,{amount:100,type,applyWay:'melee',sourceless:true});assert.equal(u.findBuff('viviana:nova').shieldHits,1);const before=u.hp;
  b.dealDamage(e,u,{amount:300,type,applyWay:'melee'});near(u.hp,before);assert.ok(!u.findBuff('viviana:nova'));
 }
});
test('Nova E0/E1/NORMAL/gauge/cancelled/dodged attacks cannot grant shield; shielded accepted receipt can',()=>{
 for(const elite of [0,1]){const{b,deploy}=make(VIVIANA,{elite,rank:4}),u=deploy(),e=ranked(b,'ELITE');b.rng=()=>0;shot(b,u,e);advance(b,.45);assert.ok(!u.findBuff('viviana:nova'));}
 const{b,deploy}=make(VIVIANA),u=deploy(),e=ranked(b,'NORMAL');b.rng=()=>0;shot(b,u,e);advance(b,.45);assert.ok(!u.findBuff('viviana:nova'));e.def={...e.def,rank:'ELITE'};
 b.dealDamage(u,e,{amount:10,type:'element',element:'fire'});assert.ok(!u.findBuff('viviana:nova'));b.addBuff(e,{key:'test:dodge',mods:{dodgeArts:1}});shot(b,u,e);advance(b,.45);assert.ok(!u.findBuff('viviana:nova'));b.removeBuff(e,'test:dodge');b.addBuff(e,{key:'test:shield',shieldHits:1});shot(b,u,e);advance(b,.45);assert.ok(u.findBuff('viviana:nova'));
});
test('S1 ordinary charge uses two full Arts hits, retains partial SP and independently applies RES',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(VIVIANA,{rank}),u=deploy(),e=enemy(b);e.base.res=50;e.markDirty();u.skill.setSpTotal(u.skill.spCost+1);assert.equal(u.skill.activate('test'),true);near(u.skill.spTotal,1);shot(b,u,e);advance(b,.45);near(100000-e.hp,2*u.s.atk*bb(VIVIANA,0,rank).atk_scale*1.08*.5);assert.equal(u.skill.active,false);}
});
test('S1 full charge exposes literal three-tile range, clears both SP, and emits three full hits',()=>{
 const{b,deploy}=make(VIVIANA),u=deploy(),e=enemy(b,{c:7});u.skill.setSpTotal(2*u.skill.spCost);advance(b,b.dt);assert.ok(u.rangeKeys.includes(3*COLS+7));assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);cast(u);near(u.skill.spTotal,0);shot(b,u,e);advance(b,.45);near(100000-e.hp,3*u.s.atk*bb(VIVIANA,0).atk_scale*1.08);assert.equal(u.skill.active,false);assert.equal(u.mem.regularFormVisual,null);assert.ok(!u.rangeKeys.includes(3*COLS+7));
});
test('S1 full charge naturally triggers a far target and never adds a fourth range tile from external range modifier',()=>{
 const{b,deploy}=make(VIVIANA),u=deploy(),e=enemy(b,{c:7}),z=enemy(b,{c:8});u.skill.setSpTotal(2*u.skill.spCost);b.addBuff(u,{key:'outside-range',mods:{rangeExtend:1}});advance(b,b.dt);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);u.skill.rule='DEFAULT';u.atkCd=0;advance(b,.45);near(100000-e.hp,3*u.s.atk*bb(VIVIANA,0).atk_scale*1.08);near(z.hp,100000);
});
test('S1 dead input refunds stored charges; killed emitted input does not, and CAST selects a live replacement',()=>{
 for(const charges of [1,2]){const{b,deploy}=make(VIVIANA),u=deploy(),e=enemy(b);u.skill.setSpTotal(charges*u.skill.spCost);advance(b,b.dt);u.skill.activate('test');shot(b,u,e);b.kill(e);advance(b,.45);near(u.skill.charges,charges);assert.ok(u.skill.spTotal>=charges*u.skill.spCost);}
 const f=make(VIVIANA),a=f.deploy(),e=enemy(f.b);e.hp=1;cast(a);shot(f.b,a,e);advance(f.b,.45);assert.equal(a.skill.charges,0);assert.equal(e.alive,false);
 const g=make(VIVIANA),v=g.deploy(),first=enemy(g.b),next=enemy(g.b,{c:5.2});cast(v);shot(g.b,v,first);g.b.kill(first);advance(g.b,.45);assert.ok(next.hp<100000);assert.equal(v.skill.charges,0);
});
test('S1 accepted sub-frame control cancels unborn hits while retaining pending charge',()=>{
 const{b,deploy}=make(VIVIANA),u=deploy(),e=enemy(b);cast(u);shot(b,u,e);b.applyStatus(u,'stun',{duration:.001});advance(b,.45);near(e.hp,100000);assert.equal(u.skill.pending,true);assert.equal(u.skill.charges,0);assert.ok(u.skill.spTotal < u.skill.spCost);
});
test('S2 all ten ranks apply source ATK/DEF/block, and block-capacity selector includes unblocked range victims',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(VIVIANA,{skill:1,rank}),u=deploy(),es=[enemy(b),enemy(b,{c:5.1}),enemy(b,{c:5.2})];cast(u);const x=bb(VIVIANA,1,rank);near(u.s.atk,u.base.atk*(1+x.atk));near(u.s.def,u.base.def*(1+x.def));near(u.s.blockCnt,u.base.blockCnt+x.block_cnt);advance(b,.2);assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,2);u.atkCd=0;advance(b,.35);near(100000-es[0].hp,u.s.atk*1.08);near(100000-es[1].hp,u.s.atk*1.08);near(es[2].hp,100000);}
});
test('S2 one parent branch roll is shared by all victims; double-hit steal has aggregate owner cap',()=>{
 const{b,deploy}=make(VIVIANA,{skill:1}),u=deploy(),e=enemy(b),z=enemy(b,{c:5.1});cast(u);advance(b,.2);let calls=0;b.rng=()=>{calls++;return 0;};shot(b,u,[e,z]);advance(b,.45);const x=bb(VIVIANA,1);assert.equal(calls,1);near(100000-e.hp,2*u.s.atk*x['attack@atk_scale_twice']*1.08);near(e.hp,z.hp);near(u.s.aspd,140);near(e.s.aspd,e.base.aspd-40);near(z.s.aspd,z.base.aspd);shot(b,u,e);advance(b,.3);near(u.s.aspd,140);near(e.s.aspd,e.base.aspd-40);
});
test('S2 no-proc boundary neither doubles nor steals and lower-rank source steal cap is selected',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(VIVIANA,{skill:1,rank}),u=deploy(),e=enemy(b);cast(u);advance(b,.2);b.rng=()=>bb(VIVIANA,1,rank)['attack@prob_twice'];shot(b,u,e);advance(b,.35);near(100000-e.hp,u.s.atk*1.08);near(u.s.aspd,100);b.rng=()=>0;shot(b,u,e);advance(b,.45);near(u.s.aspd,100+bb(VIVIANA,1,rank)['attack@steal_atk_speed_max']);}
});
test('S2 target invalidation removes only target debuff, owner keeps stolen ASPD until end/retreat',()=>{
 const{b,deploy}=make(VIVIANA,{skill:1}),u=deploy(),e=enemy(b);b.addBuff(e,{key:'outside',mods:{aspd:-5}});cast(u);advance(b,.2);b.rng=()=>0;shot(b,u,e);advance(b,.35);near(e.s.aspd,55);b.addBuff(e,{key:'test:invalid',flags:{untargetable:true}});advance(b,b.dt);near(e.s.aspd,95);near(u.s.aspd,140);u.skill.end('test');near(u.s.aspd,100);near(e.s.aspd,95);advance(b,.45);assert.equal(u.mem.regularFormVisual,null);
});
test('S3 source flat BAT and all ten ranks first/subsequent duration and exact expanded range',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(VIVIANA,{skill:2,rank}),u=deploy();b.addBuff(u,{key:'outside-bat',mods:{batPct:.5}});const normal=u.s.bat;cast(u);const x=bb(VIVIANA,2,rank);near(u.s.bat,normal+x.base_attack_time*1.5);near(u.skill.timeLeft,x.duration_plus);near(u.s.atk,u.base.atk*(1+x.atk));near(u.s.def,u.base.def*(1+x.def));near(u.s.res,u.base.res+x.magic_resistance);assert.ok(!u.rangeKeys.includes(3*COLS+7));u.skill.end('test');advance(b,.45);cast(u);near(u.skill.timeLeft,x.enhance_duration);assert.ok(u.rangeKeys.includes(3*COLS+7));}
});
test('S3 first two/second three hits, exact original A/B/Down clips and capped animation speed',()=>{
 for(const dir of ['RIGHT','DOWN','UP']){const{b,deploy}=make(VIVIANA,{skill:2}),u=deploy(3,4,dir),e=enemy(b,dir==='DOWN'?{r:2,c:4}:dir==='UP'?{r:4,c:4}:{});cast(u);advance(b,.2);shot(b,u,e);advance(b,.6);near(100000-e.hp,2*u.s.atk*1.08);const a=b._evq.filter(v=>v[0]==='atk'&&v[1]===u.id).at(-1);assert.equal(a[4].animation,dir==='DOWN'?'Skill_Down_3_Attack_A':'Skill_3_Attack_A');u.skill.end('test');advance(b,.45);cast(u);advance(b,.2);const hp=e.hp;shot(b,u,e);advance(b,.6);near(hp-e.hp,3*u.s.atk*1.08);assert.equal(b._evq.filter(v=>v[0]==='atk'&&v[1]===u.id).at(-1)[4].animation,'Skill_3_Attack_B');}
});
test('S3 targets actual source elite/BOSS rank before ordinary and scales selected Nova probability',()=>{
 const{b,deploy}=make(VIVIANA,{skill:2}),u=deploy(),normal=ranked(b,'NORMAL'),elite=ranked(b,'ELITE',{c:5.2});cast(u);advance(b,.2);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[elite]);b.rng=()=>.4;shot(b,u,elite);advance(b,.6);assert.ok(u.findBuff('viviana:nova'));near(normal.hp,100000);b.removeBuff(u,'viviana:nova');b.rng=()=>talent(u,'prob').prob*bb(VIVIANA,2).talent_scale;shot(b,u,elite);advance(b,.6);assert.ok(!u.findBuff('viviana:nova'));
});
test('S3 enhancement, range/visual locks and owned talent/shield clean up through withdrawal and redeploy',()=>{
 const{b,deploy}=make(VIVIANA,{skill:2}),u=deploy();cast(u);advance(b,.2);u.skill.end('test');advance(b,.45);cast(u);advance(b,.2);assert.equal(u.mem.vivianaEnhanced,true);b.retreatOperator(VIVIANA);assert.equal(u.deployed,false);assert.equal(u.mem.regularFormVisual,null);assert.equal(u.skill.active,false);b.bench[VIVIANA].readyAt=b.time;const v=deploy();assert.notEqual(v,u);assert.equal(v.skill.active,false);assert.ok(!v.findBuff('viviana:nova'));cast(v);near(v.skill.timeLeft,bb(VIVIANA,2).duration_plus);assert.equal(v.mem.vivianaEnhanced,false);assert.deepEqual(b.errors,[]);
});


test('S3 first-use original count is per deployed entity, not a battle-global inherited mark',()=>{
 const skill=nodes(evidence.skills.skchr_vvana_3).find(c=>c._maxTriggerTime!=null);assert.equal(skill._limitGlobalTriggerTime,0);
 const check=JSON.parse(evidence.originalBuffTemplates['vvana_s_3[check]'].eventToActions._items[0].value.SerializedState);
 assert.equal(check[0]._conditionNode._useCurTriggerCnt,true);assert.equal(check[0]._succeedNodes[0]._buff.isDurableBuff,false);
 const{b,deploy}=make(VIVIANA,{skill:2}),u=deploy();cast(u);advance(b,.2);u.skill.end('test');advance(b,.45);cast(u);near(u.skill.timeLeft,bb(VIVIANA,2).enhance_duration);b.retreatOperator(VIVIANA);b.bench[VIVIANA].readyAt=b.time;const v=deploy();cast(v);near(v.skill.timeLeft,bb(VIVIANA,2).duration_plus);assert.equal(v.mem.vivianaEnhanced,false);
});
