// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-chongyue-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
import { immuneSet } from '../server/sim/simdata.js';
const ID='char_2024_chyue';
const near=(a,z,tol=1e-5)=>assert.ok(Math.abs(a-z)<tol,`${a} != ${z}`);
function advance(b,s){const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
  const d=structuredClone(data),o=d.operators[ID];d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const build={...defaultBuild(o),elite,potential,level:o.phases[elite].maxLevel,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(d,{operators:[build]},{seed:1});b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.addDp('arkpedia',99);
  const hits=[];b.on('damaged',c=>hits.push({...c,time:b.time}));const u=b.deployOperator(ID,5,5,dir);
  u.atkCd=1000;u.profile.canAttack=()=>false;advance(b,1.1);b.rng=()=>.99;return{b,u,hits};
}
function enemy(b,{x=6,y=5,fly=false,hp=100000,def=0,weight=10,blocked=false}={}){
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:hp,def,moveSpeed:0,massLevel:weight});e.markDirty();void e.s;e.hp=hp;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();
  if(blocked){const u=b.allyUnits.find(a=>a.def.charId===ID);e.x=5.6;e.y=5;b._buildEnemyIndex();assert.equal(b._checkBlock(e),true);}return e;
}
function cast(b,u,total=u.skill.spCost){u.skill.setSpTotal(total);assert.equal(u.skill.activate('manual'),true);}
function shot(b,u){const p=effectiveProfile(u),ts=acquireTargets(b,u,p);assert.ok(ts.length);performAttack(b,u,p,ts);u.atkCd=1000;}
const out=(hits,u)=>hits.filter(h=>h.source===u);
const bbFor=(n,rank)=>Object.fromEntries(Object.values(source.tables.skills)[n-1].levels[rank-1].blackboard.map(v=>[v.key,v.value]));
const mark=(b,u,e)=>b.addBuff(e,{key:'chyue_t_1_passive:'+u.id,duration:2.5,source:u});
test('Chongyue retains all30 ranks, native components/templates and exact original facings',()=>{
  assert.equal(Object.values(source.tables.skills).flatMap(s=>s.levels).length,30);
  assert.equal(source.source.bundles.length,5);assert.equal(Object.keys(source.templates).length,13);
  for(const face of ['Front','Back'])assert.equal(source.models[ID][face].sha256,source.officialSkeletonBindings[ID][face].sha256);
  assert.equal(source.frameParity,false);assert.equal(source.nativeParticleSupport,false);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank${rank}: one charge gives one hit; full three charges are consumed for three hits`,()=>{
  const{b,u,hits}=make({rank}),bb=bbFor(1,rank);enemy(b);
  cast(b,u,u.skill.spCost+1);advance(b,.1);assert.equal(out(hits,u).length,0);advance(b,.15);
  assert.equal(out(hits,u).length,1);near(out(hits,u)[0].amount,u.s.atk*bb.atk_scale);near(u.skill.spTotal,1);
  u.skill.gainSp(3,'talent');near(u.skill.spTotal,1);advance(b,1);
  cast(b,u,u.skill.spCost*3);assert.equal(u.mem.regularFormVisual.clip,'Skill_1_Charged');near(u.skill.spTotal,0);
  advance(b,.25);assert.equal(out(hits,u).length,4);for(const h of out(hits,u))near(h.amount,u.s.atk*bb.atk_scale);
  advance(b,1);assert.equal(u.skill.active,false);near(u.skill.spTotal,0);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank${rank}: capped initial ground/air hit; only marked ground enemies are lifted and slammed`,()=>{
  const{b,u,hits}=make({skill:1,rank}),bb=bbFor(2,rank),lift=enemy(b,{x:6,weight:1}),fly=enemy(b,{x:6.05,fly:true});
  mark(b,u,lift);mark(b,u,fly);Array.from({length:6},(_,i)=>enemy(b,{x:6.1+i*.01}));
  cast(b,u,u.skill.spCost*2);assert.equal(u.skill.charges,1);advance(b,.3);assert.equal(out(hits,u).length,0);advance(b,.15);
  const hs=out(hits,u);assert.equal(hs.length,bb.max_target);assert.equal(lift.s.flags.levitate,true);assert.equal(fly.s.flags.levitate||false,false);
  near(hs.find(h=>h.target===lift).amount,u.s.atk*bb.atk_scale*1.65);
  advance(b,.35);assert.equal(out(hits,u).length,bb.max_target);advance(b,.15);
  assert.equal(u.skill.active,false);assert.equal(out(hits,u).length,bb.max_target+1);
  near(out(hits,u).at(-1).amount,u.s.atk*bb.atk_scale_down*1.65);assert.equal(lift.s.flags.levitate||false,false);
  assert.ok(lift.findBuff('chyue_t_1_passive:'+u.id));assert.ok(u.mem.chongCast);advance(b,1.2);assert.equal(u.mem.chongCast,null);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank${rank}: fifth activation transforms; later casts give two ground-only blasts`,()=>{
  const{b,u,hits}=make({skill:2,rank}),bb=bbFor(3,rank),e=enemy(b),nearby=enemy(b,{x:6.6}),far=enemy(b,{x:6.9}),fly=enemy(b,{x:6.1,fly:true});
  const base=structuredClone(u.rangeGrid);
  for(let i=1;i<=5;i++){
    cast(b,u);assert.equal(u.mem.regularFormVisual.clip,i===5?'Skill_3_Change':'Skill_3');advance(b,.2);
    assert.equal(out(hits,u).length,(i-1)*2);advance(b,.2);assert.equal(out(hits,u).length,i*2);
    advance(b,.9);assert.equal(!!u.mem.chongChanged,i===5);
  }
  assert.notDeepEqual(u.rangeGrid,base);assert.deepEqual(u.rangeGrid,source.tables.ranges['x-6'].grids.map(p=>[p.row,p.col]));
  cast(b,u);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_Charged');advance(b,.4);
  assert.equal(out(hits,u).length,14);assert.equal(out(hits,u).filter(h=>h.target===e).length,7);
  assert.equal(out(hits,u).filter(h=>h.target===nearby).length,7);near(far.hp,far.s.maxHp);near(fly.hp,fly.s.maxHp);
  for(const h of out(hits,u))near(h.amount,u.s.atk*bb.atk_scale);
});
test('basic attacks alternate literal A/B clips, strike one target and recover one offensive SP',()=>{
  const{b,u,hits}=make(),first=enemy(b),spare=enemy(b,{x:6.1});shot(b,u);assert.equal(u.mem.chongAttack.clip,'Attack_A');
  advance(b,.1);assert.equal(out(hits,u).length,0);advance(b,.15);assert.equal(out(hits,u).length,1);near(u.skill.spTotal,1);
  shot(b,u);assert.equal(u.mem.chongAttack.clip,'Attack_B');advance(b,.25);assert.equal(out(hits,u).length,2);
  assert.ok(out(hits,u).every(h=>h.target===first));near(spare.hp,spare.s.maxHp);near(u.skill.spTotal,2);
});
test('S1 at two charges retains one charge and partial progress; empty cast preserves readiness',()=>{
  const{b,u,hits}=make();u.skill.setSpTotal(u.skill.spCost*2+1);assert.equal(u.skill.activate('manual'),false);
  near(u.skill.spTotal,u.skill.spCost*2+1);enemy(b);assert.equal(u.skill.activate('manual'),true);advance(b,1.1);
  assert.equal(out(hits,u).length,1);near(u.skill.spTotal,u.skill.spCost+1);
});
test('S1 ASPD scales its hit and tail; S2/S3 animation timings remain fixed',()=>{
  for(const skill of [0,1,2]){
    const{b,u,hits}=make({skill});enemy(b);b.addBuff(u,{key:'test:haste',mods:{aspd:100}});cast(b,u);
    assert.equal(u.mem.regularFormVisual.speed,skill===0?2:1);advance(b,.15);
    assert.equal(out(hits,u).length,skill===0?1:0);advance(b,.3);assert.equal(out(hits,u).length,1);
  }
});
test('S2 can cast empty, consumes one charge and resumes time SP during its separate end phase',()=>{
  const{b,u}=make({skill:1});cast(b,u,u.skill.spCost*2);advance(b,.8);near(u.skill.spTotal,u.skill.spCost);
  advance(b,.3);assert.equal(u.skill.active,false);assert.ok(u.mem.chongCast);assert.ok(u.skill.spTotal>u.skill.spCost);
  advance(b,1);assert.equal(u.mem.chongCast,null);
});
test('S2 marked targets have priority over unmarked targets; another source mark permits lift',()=>{
  const{b,u,hits}=make({skill:1}),others=Array.from({length:5},(_,i)=>enemy(b,{x:6+i*.01})),e=enemy(b,{x:6.2,weight:1});
  b.addBuff(e,{key:'chyue_t_1_passive:other',duration:5});cast(b,u);advance(b,.45);
  assert.ok(out(hits,u).some(h=>h.target===e));assert.equal(e.s.flags.levitate,true);
  near(out(hits,u).find(h=>h.target===e).amount,u.s.atk*4.5);assert.equal(others.filter(e=>e.hp<e.s.maxHp).length,3);
  advance(b,.5);near(out(hits,u).at(-1).amount,u.s.atk*6.5*1.65);
});
test('S2 slam acquires all currently levitated enemies, including victims outside the initial cap',()=>{
  const{b,u,hits}=make({skill:1});Array.from({length:4},(_,i)=>enemy(b,{x:6+.01*i}));cast(b,u);advance(b,.4);
  const added=Array.from({length:6},(_,i)=>enemy(b,{x:6.1+i*.01}));for(const e of added)b.applyStatus(e,'levitate',{source:u,duration:2});
  advance(b,.5);assert.equal(out(hits,u).length,10);for(const e of added)assert.equal(e.s.flags.levitate||false,false);
});
test('S2 levitation honors weight, resistance and levitation immunity',()=>{
  const{b,u}=make({skill:1}),light=enemy(b,{weight:1}),heavy=enemy(b,{x:6.1,weight:4}),resist=enemy(b,{x:6.2,weight:1}),immune=enemy(b,{x:6.3,weight:1});
  for(const e of [light,heavy,resist,immune])mark(b,u,e);
  b.applyStatus(resist,'resist',{duration:10,value:.5});immune.def={...immune.def,immune:immuneSet({levitateImmune:true})};
  cast(b,u);advance(b,.45);assert.ok(light.findBuff('levitate').timeLeft>1.8);assert.ok(heavy.findBuff('levitate').timeLeft<1.01);
  assert.ok(resist.findBuff('levitate').timeLeft<1.01);assert.equal(immune.s.flags.levitate||false,false);
});
test('S2 skill-kill refunds happen once per phase, bypass SP lock, and can occur in both phases',()=>{
  const{b,u}=make({skill:1}),kill=enemy(b,{hp:1}),kill2=enemy(b,{hp:1,x:6.02}),slam=enemy(b,{hp:5000,x:6.05,weight:1});mark(b,u,slam);
  cast(b,u);advance(b,.45);assert.equal(kill.alive,false);assert.equal(kill2.alive,false);assert.equal(slam.alive,true);
  near(u.skill.spTotal,0);advance(b,.45);assert.ok(u.skill.spTotal>=3&&u.skill.spTotal<3.15);advance(b,.05);assert.equal(slam.alive,false);
  const at=b.time,sp=u.skill.spTotal;advance(b,1.2);near(u.skill.spTotal,sp+(b.time-at)+3,.051);
});
test('S1 skill kills refund3 SP once; ordinary and scripted kills do not',()=>{
  const a=make();enemy(a.b,{hp:1});cast(a.b,a.u,a.u.skill.spCost*3);advance(a.b,1.1);near(a.u.skill.spTotal,3);
  const z=make();const e=enemy(z.b,{hp:1});shot(z.b,z.u);advance(z.b,.3);assert.equal(e.alive,false);near(z.u.skill.spTotal,1);
  const q=make();const scripted=enemy(q.b);cast(q.b,q.u);q.b.kill(scripted,q.u);advance(q.b,1.1);near(q.u.skill.spTotal,0);
});
test('E1 cannot receive the E2 skill-kill SP refund',()=>{
  const{b,u}=make({elite:1});enemy(b,{hp:1});cast(b,u);advance(b,1.1);near(u.skill.spTotal,0);
});
test('T1 is source-owned damage amplification after DEF, refreshes2.5s and expires',()=>{
  const{b,u,hits}=make(),e=enemy(b,{def:100});b.rng=()=>0;shot(b,u);advance(b,.25);
  near(out(hits,u)[0].amount,(u.s.atk-100)*1.65);assert.ok(e.findBuff('chyue_t_1_passive:'+u.id));
  advance(b,1);shot(b,u);advance(b,.25);assert.ok(e.findBuff('chyue_t_1_passive:'+u.id).timeLeft>2.4);
  advance(b,2.6);b.rng=()=>.99;shot(b,u);advance(b,.25);near(out(hits,u).at(-1).amount,u.s.atk-100);
});
test('E0/E1 and potential5 select the source T1 tiers; other-source marks never amplify damage',()=>{
  for(const [elite,potential,scale] of [[0,1,1],[1,1,1.55],[1,5,1.6],[2,5,1.7]]){
    const{b,u,hits}=make({elite,potential});enemy(b,{def:100});b.rng=()=>0;shot(b,u);advance(b,.25);
    near(out(hits,u)[0].amount,(u.s.atk-100)*scale);
  }
  const{b,u,hits}=make(),e=enemy(b);b.addBuff(e,{key:'chyue_t_1_passive:other',duration:5});shot(b,u);advance(b,.25);
  near(out(hits,u)[0].amount,u.s.atk);
});
test('S1/S3 cannot randomly apply T1; S2 slam applies it without a random roll',()=>{
  for(const skill of [0,2]){const{b,u,hits}=make({skill}),e=enemy(b);b.rng=()=>0;cast(b,u);advance(b,.4);
    assert.equal(e.findBuff('chyue_t_1_passive:'+u.id),null);near(out(hits,u)[0].amount,u.s.atk*u.skill.bb.atk_scale);}
  const{b,u,hits}=make({skill:1}),e=enemy(b);b.applyStatus(e,'levitate',{duration:2});cast(b,u);advance(b,.9);
  assert.ok(e.findBuff('chyue_t_1_passive:'+u.id));near(out(hits,u).at(-1).amount,u.s.atk*6.5*1.65);
});
test('S3 empty pre-transformation cast emits at own tile and does not invent a target',()=>{
  const{b,u,hits}=make({skill:2});cast(b,u);const e=enemy(b,{x:5.1});advance(b,.4);
  assert.equal(out(hits,u).length,1);assert.equal(out(hits,u)[0].target,e);
});
function changed(){const a=make({skill:2});enemy(a.b);for(let i=0;i<5;i++){cast(a.b,a.u);advance(a.b,1.3);}a.hits.length=0;return a;}
test('transformed normal attack has two retained hits but only2 SP; skill stays source MANUAL and auto-triggers',()=>{
  const{b,u,hits}=changed();assert.equal(u.skill.manual,true);shot(b,u);advance(b,.3);assert.equal(out(hits,u).length,2);near(u.skill.spTotal,2);
  u.skill.setSpTotal(u.skill.spCost);advance(b,.05);assert.equal(u.skill.active,true);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_Charged');
});
test('transformed automatic S3 can interrupt a derived second normal hit when the first charges it',()=>{
  const{b,u,hits}=changed();u.skill.setSpTotal(u.skill.spCost-2);shot(b,u);advance(b,.3);
  assert.equal(out(hits,u).length,1);assert.equal(u.skill.active,true);advance(b,.4);assert.equal(out(hits,u).length,3);
});
test('transformed normal second hit does not move to a new victim after its first victim dies',()=>{
  const{b,u,hits}=changed();for(const e of b.enemies)b.kill(e);const first=enemy(b,{hp:1}),spare=enemy(b,{x:6.1});
  shot(b,u);advance(b,.3);assert.equal(first.alive,false);assert.equal(out(hits,u).length,1);near(spare.hp,spare.s.maxHp);
});
test('transformed S3 retains its first blast center after killing its original primary',()=>{
  const{b,u,hits}=changed();for(const e of b.enemies)b.kill(e);const primary=enemy(b,{hp:1}),nearby=enemy(b,{x:6.7}),remote=enemy(b,{x:4});
  b.addBuff(primary,{key:'test:priority',mods:{taunt:100}});
  cast(b,u);advance(b,.4);assert.equal(primary.alive,false);assert.equal(out(hits,u).filter(h=>h.target===nearby).length,2);near(remote.hp,remote.s.maxHp);
});
test('transformed S3 requires a target and holds readiness rather than casting in an empty map',()=>{
  const{b,u}=changed();for(const e of b.enemies)b.kill(e);u.skill.setSpTotal(u.skill.spCost);advance(b,.1);
  assert.equal(u.skill.active,false);assert.equal(u.skill.activate('manual'),false);near(u.skill.spTotal,u.skill.spCost);
});
for(const dir of ['UP','RIGHT','DOWN','LEFT'])test(`${dir} uses original basic and skill event timing`,()=>{
  const{b,u,hits}=make({dir}),pos={UP:[5,6],RIGHT:[6,5],DOWN:[5,4],LEFT:[4,5]},[x,y]=pos[dir];enemy(b,{x,y});
  shot(b,u);advance(b,.1);assert.equal(out(hits,u).length,0);advance(b,.15);assert.equal(out(hits,u).length,1);
  cast(b,u);advance(b,.25);assert.equal(out(hits,u).length,2);
});
for(const skill of [0,1,2])test(`S${skill+1}: transient control before release cancels its sequence and clears SP lock`,()=>{
  const{b,u,hits}=make({skill});enemy(b);cast(b,u);b.applyStatus(u,'stun',{duration:.01});advance(b,2.5);
  assert.equal(out(hits,u).length,0);assert.equal(u.mem.chongCast,null);assert.equal(u.findBuff('chong:sp-lock'),null);
});
test('retreat cancels an in-flight S2 and clears its deployment state',()=>{
  const{b,u,hits}=make({skill:1});enemy(b);cast(b,u);b.retreatOperator(ID);advance(b,2.5);
  assert.equal(out(hits,u).length,0);assert.equal(u.mem.chongCast,null);assert.equal(u.findBuff('chong:cast'),null);
});
test('death resets S3 transformation, cast count, range and idle state for redeployment',()=>{
  const{b,u}=changed();b.kill(u);assert.equal(u.mem.chongChanged,false);assert.equal(u.mem.chongCasts,0);
  assert.notDeepEqual(u.rangeGrid,source.tables.ranges['x-6'].grids.map(p=>[p.row,p.col]));assert.equal(u.mem.regularFormVisual,null);
});
test('S1 retains its input and does not redirect to a second enemy after input death',()=>{
  const{b,u,hits}=make(),first=enemy(b),spare=enemy(b,{x:6.1});cast(b,u,u.skill.spCost*3);b.kill(first);advance(b,1.1);
  assert.equal(out(hits,u).length,0);near(spare.hp,spare.s.maxHp);near(u.skill.spTotal,0);
});
test('S2 control between lift and slam cancels the end phase without prematurely landing victims',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b,{weight:1});mark(b,u,e);cast(b,u);advance(b,.5);
  assert.equal(out(hits,u).length,1);assert.equal(e.s.flags.levitate,true);b.applyStatus(u,'stun',{duration:.01});advance(b,.5);
  assert.equal(out(hits,u).length,1);assert.equal(u.mem.chongCast,null);assert.equal(e.s.flags.levitate,true);advance(b,2);
  assert.equal(e.s.flags.levitate||false,false);
});
test('S2 does not lift a marked input that becomes untargetable before its first event',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b,{weight:1});mark(b,u,e);cast(b,u);b.addBuff(e,{key:'test:hide',flags:{untargetable:true}});advance(b,1);
  assert.equal(out(hits,u).length,0);assert.equal(e.s.flags.levitate||false,false);
});
