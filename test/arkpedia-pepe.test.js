// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-pepe-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { immuneSet } from '../server/sim/simdata.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
const ID='char_4058_pepe';
const near=(a,z,tol=1e-5)=>assert.ok(Math.abs(a-z)<tol,`${a} != ${z}`);
function advance(b,s){const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',others=[]}={}){
  const d=structuredClone(data),o=d.operators[ID];d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const build={...defaultBuild(o),elite,potential,level:o.phases[elite].maxLevel,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(d,{operators:[build,...others.map(id=>defaultBuild(d.operators[id]))]},{seed:1});b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.addDp('arkpedia',99);
  const hits=[];b.on('damaged',c=>hits.push({...c,time:b.time}));const u=b.deployOperator(ID,5,5,dir);
  u.atkCd=1000;u.profile.canAttack=()=>false;advance(b,1.1);b.rng=()=>0;return{b,u,hits};
}
function enemy(b,{x=6,y=5,fly=false,hp=100000,def=0}={}){
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:hp,def,moveSpeed:0,massLevel:10});e.markDirty();void e.s;e.hp=hp;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u,total=u.skill.spCost){u.skill.setSpTotal(total);assert.equal(u.skill.activate('manual'),true);}
function shot(b,u){const p=effectiveProfile(u),ts=acquireTargets(b,u,p);assert.ok(ts.length);performAttack(b,u,p,ts);u.atkCd=1000;}
const out=(hits,u)=>hits.filter(h=>h.source===u);
const bbFor=(n,rank)=>Object.fromEntries(source.tables.skills[`skchr_pepe_${n}`].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
for(let rank=1;rank<=10;rank++)test(`S1 rank ${rank}: native primary multiplier, independent half-ATK splash and charge storage`,()=>{
  const{b,u,hits}=make({rank}),bb=bbFor(1,rank),primary=enemy(b),secondary=enemy(b,{x:6.6}),far=enemy(b,{x:7.1}),fly=enemy(b,{x:6.1,fly:true});
  const lv=source.tables.skills.skchr_pepe_1.levels[rank-1];assert.equal(u.skill.spCost,lv.spData.spCost);assert.equal(u.skill.maxCharges,Math.max(1,lv.spData.maxChargeTime));
  cast(b,u);shot(b,u);assert.equal(u.mem.pepeAttack,'Skill_1');advance(b,.75);assert.equal(out(hits,u).length,0);advance(b,.2);
  const hs=out(hits,u);assert.equal(hs.length,2);near(hs.find(h=>h.target===primary).amount,u.s.atk*bb.atk_scale);
  near(hs.find(h=>h.target===secondary).amount,u.s.atk*.5);near(far.hp,far.s.maxHp);near(fly.hp,fly.s.maxHp);
  assert.equal(u.skill.active,true);near(u.skill.spTotal,0);advance(b,1.1);assert.equal(u.skill.active,false);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank}: random primary, source range and three capped speed tiers`,()=>{
  const{b,u,hits}=make({skill:1,rank}),bb=bbFor(2,rank),base=u.base.atk;
  const left=enemy(b,{x:6,y:6}),right=enemy(b,{x:7,y:4});
  for(let i=0;i<4;i++){
    cast(b,u);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');assert.equal(skillHud(u.skill).text,'Skill active · 18s');advance(b,.4);
    near(u.s.aspd,100+bb.attack_speed+Math.min(i,bb.max_stack_cnt)*bb.attack_speed_extra);
    near(u.s.atk,base*(1+.16+bb.atk));assert.deepEqual(u.liveRangeGrid,u.def.skill.rangeGrid);
    b.rng=()=>0;shot(b,u);advance(b,.25);b.rng=()=>.999;shot(b,u);advance(b,.25);
    assert.ok(out(hits,u).some(h=>h.target===left));assert.ok(out(hits,u).some(h=>h.target===right));
    u.skill.end('test');advance(b,.4);near(u.s.aspd,100);near(u.s.atk,base*1.16);
  }
});
for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank}: four post-attack damage/radius stacks, differential stuns and max-stack animation`,()=>{
  const{b,u,hits}=make({skill:2,rank}),bb=bbFor(3,rank),base=u.base.atk;
  const primary=enemy(b),secondary=enemy(b,{x:6.8}),growth=enemy(b,{x:7.1}),fly=enemy(b,{x:6.1,fly:true});
  cast(b,u);assert.equal(skillHud(u.skill).text,'Skill active · 40s');advance(b,.4);near(u.s.interval,2);assert.equal(u.mem.pepeStacks,0);
  for(let i=0;i<5;i++){
    const before=out(hits,u).length;near(u.s.atk,base*(1+.16+bb.atk+Math.min(i,4)*bb['attack@atk']));
    const atk=u.s.atk;shot(b,u);assert.equal(u.mem.pepeAttack,i<4?'Skill_3_Loop_A':'Skill_3_Loop_B');
    advance(b,1.05);assert.equal(out(hits,u).length,before);advance(b,.25);
    const hs=out(hits,u).slice(before);near(hs.find(h=>h.target===primary).amount,atk);
    near(hs.find(h=>h.target===secondary).amount,atk*.5);assert.equal(!!hs.find(h=>h.target===growth),i>0);
    assert.equal(primary.findBuff('stun').duration,bb['attack@stun_main']);assert.equal(secondary.findBuff('stun').duration,bb['attack@stun']);
    assert.equal(u.mem.pepeStacks,Math.min(i+1,4));near(fly.hp,fly.s.maxHp);
  }
  u.skill.end('test');advance(b,.4);assert.equal(u.mem.pepeStacks,0);near(u.s.atk,base*1.16);near(u.s.interval,1.8);
});
test('normal hammer attack keeps one primary, snapshots nearby victims at the hit and uses half ATK before DEF',()=>{
  const{b,u,hits}=make(),primary=enemy(b,{def:100}),secondary=enemy(b,{x:6.8,def:100}),mover=enemy(b,{x:7.1});
  shot(b,u);mover.x=6.9;b._buildEnemyIndex();advance(b,.95);const hs=out(hits,u);assert.equal(hs.length,3);
  near(hs.find(h=>h.target===primary).amount,u.s.atk-100);near(hs.find(h=>h.target===secondary).amount,u.s.atk*.5-100);
  assert.equal(u.mem.pepeAttack,'Attack');
});
for(const dir of ['RIGHT','LEFT','UP','DOWN'])test(`original ${dir} facing uses the native attack hit event and ASPD playback`,()=>{
  const{b,u,hits}=make({dir});enemy(b,{x:dir==='LEFT'?4:dir==='RIGHT'?6:5,y:dir==='UP'?6:dir==='DOWN'?4:5});
  b.addBuff(u,{key:'test:speed',mods:{aspd:100}});shot(b,u);advance(b,.35);assert.equal(out(hits,u).length,0);advance(b,.15);assert.equal(out(hits,u).length,1);
});
for(const status of ['stun','cold','freeze','fear'])test(`S1 exposes manual cleanse only with ${status}, preserves automatic type and queues the next attack`,()=>{
  const{b,u,hits}=make();u.skill.setSpTotal(u.skill.spCost*2);assert.equal(u.skill.manual,false);assert.equal(skillHud(u.skill).canActivate,false);assert.equal(b.activateOperator(ID),false);
  b.applyStatus(u,status,{duration:20});assert.equal(skillHud(u.skill).canActivate,true);assert.equal(b.activateOperator(ID),true);
  assert.equal(u.findBuff(status),null);assert.equal(u.skill.pending,true);assert.equal(u.skill.charges,1);advance(b,1);near(u.skill.spTotal,u.skill.spCost);
  enemy(b);shot(b,u);advance(b,2);assert.equal(out(hits,u).length,1);assert.equal(u.skill.active,false);
});
test('S1 cleanse removes explicitly resistable custom buffs but retains stat penalties and nonresistable controls',()=>{
  const{b,u}=make();b.addBuff(u,{key:'test:weak',mods:{atkPct:-.1}});b.applyStatus(u,'stun',{duration:20,sourceStatusResistable:false});
  b.addBuff(u,{key:'test:custom',flags:{cold:true},sourceStatusResistable:true});u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);
  assert.ok(u.findBuff('test:weak'));assert.ok(u.findBuff('stun'));assert.equal(u.findBuff('test:custom'),null);assert.equal(u.canAct,false);
});
test('S1 target death returns exactly one charge without redirecting the pending attack',()=>{
  const{b,u,hits}=make(),first=enemy(b),other=enemy(b,{x:6.1});cast(b,u,u.skill.spCost*2);shot(b,u);b.dealDamage(null,first,{amount:1e6,type:'true'});advance(b,1);
  assert.equal(u.skill.active,false);assert.equal(u.skill.charges,2);assert.equal(out(hits,u).length,0);near(other.hp,other.s.maxHp);
});
test('S1 control cancels the pending hit and unlocks recovery without refunding a spent charge',()=>{
  const{b,u,hits}=make();enemy(b);cast(b,u);shot(b,u);b.applyStatus(u,'stun',{duration:.1});advance(b,1.1);
  assert.equal(out(hits,u).length,0);assert.equal(u.skill.active,false);assert.equal(u.skill.charges,0);assert.ok(u.skill.spTotal>0);
});
test('S2 interrupted startup does not grant the next-use speed stack',()=>{
  const{b,u}=make({skill:1});cast(b,u);b.applyStatus(u,'stun',{duration:.1});advance(b,.5);assert.equal(u.skill.active,false);assert.equal(u.mem.pepeUses??0,0);
  cast(b,u);advance(b,.4);near(u.s.aspd,180);assert.equal(u.mem.pepeUses,1);
});
test('S3 takes one defensive SP while inactive, excluding ignored/hp-loss damage and active windows',()=>{
  const{b,u}=make({skill:2});u.skill.setSpTotal(0);b.dealDamage(null,u,{amount:1,type:'true'});near(u.skill.spTotal,1);
  b.dealDamage(null,u,{amount:1,type:'true',noSp:true});b.dealDamage(null,u,{amount:1,type:'true',tags:['hpLoss']});near(u.skill.spTotal,1);
  cast(b,u);advance(b,.4);b.dealDamage(null,u,{amount:1,type:'true'});near(u.skill.spTotal,0);
});
for(const[elite,potential,cap]of [[0,1,0],[1,1,10],[1,5,13],[2,1,14],[2,5,17]])test(`E${elite}/P${potential} kill refund is capped at ${cap} and bypasses noSp`,()=>{
  const{b,u}=make({skill:elite?1:0,elite,potential});if(elite===0)enemy(b);cast(b,u);if(elite)advance(b,.4);
  for(let i=0;i<25;i++)b.dealDamage(u,enemy(b,{hp:1,x:8}),{amount:1,type:'true'});
  b.addBuff(u,{key:'test:no-sp',flags:{noSp:true}});u.skill.end('test');near(u.skill.spTotal,cap);
});
test('the refund counts only Pepe kills during an active skill, including splash; ally kills and inactive kills do not count',()=>{
  const{b,u}=make({skill:1});b.dealDamage(u,enemy(b,{hp:1}),{amount:1,type:'true'});cast(b,u);advance(b,.4);
  b.dealDamage(null,enemy(b,{hp:1}),{amount:1,type:'true'});b.dealDamage(u,enemy(b,{hp:1}),{amount:1,type:'true'});u.skill.end('test');near(u.skill.spTotal,1);
});
for(const[potential,aura]of [[1,.16],[3,.2]])test(`P${potential} on-field aura boosts self and other Guards, including late deployments, and clears on retreat`,()=>{
  const guard='char_208_melan',caster='char_121_lava';const{b,u}=make({potential,others:[guard,caster]});near(u.s.atk,u.base.atk*(1+aura));
  const g=b.deployOperator(guard,8,8,'RIGHT'),c=b.deployOperator(caster,9,9,'RIGHT');advance(b,1.1);
  assert.ok(g.findBuff('pepe:aura:'+u.id));assert.equal(c.findBuff('pepe:aura:'+u.id),null);
  const atk=g.s.atk;b.retreatOperator(ID);advance(b,.1);assert.equal(g.findBuff('pepe:aura:'+u.id),null);assert.ok(g.s.atk<atk);
});
test('S2 speed stacks reset on redeployment; retreat cancels source timers and removes skill bonuses',()=>{
  const{b,u,hits}=make({skill:1});cast(b,u);advance(b,.4);u.skill.end('test');advance(b,.4);cast(b,u);advance(b,.4);near(u.s.aspd,220);
  enemy(b);shot(b,u);b.retreatOperator(ID);advance(b,71);assert.equal(out(hits,u).length,0);b.addDp('arkpedia',99);
  const next=b.deployOperator(ID,5,5,'RIGHT');next.profile.canAttack=()=>false;next.atkCd=1000;advance(b,1.1);cast(b,next);advance(b,.4);near(next.s.aspd,180);
});
test('S3 stopped windups do not add stacks, splash or stun after control or a skill change',()=>{
  const{b,u,hits}=make({skill:2}),e=enemy(b);cast(b,u);advance(b,.4);shot(b,u);b.applyStatus(u,'stun',{duration:.1});advance(b,1.4);
  assert.equal(u.mem.pepeStacks,0);assert.equal(out(hits,u).length,0);assert.equal(e.findBuff('stun'),null);
  shot(b,u);u.skill.end('test');advance(b,1.4);assert.equal(out(hits,u).length,0);
});
test('all source ranks, original facing hashes and native graphs remain explicit; particles/modules/frame parity are not claimed',()=>{
  assert.equal(source.moduleSupport,false);assert.equal(source.frameParity,false);assert.equal(source.nativeParticleSupport,false);
  assert.equal(Object.keys(source.templates).length,13);assert.equal(source.source.bundles.length,5);
  for(const f of ['Front','Back'])assert.equal(source.models[ID][f].sha256,source.officialSkeletonBindings[ID][f].sha256);
  assert.equal(Object.values(source.tables.skills).reduce((n,s)=>n+s.levels.length,0),30);
});
test('S1 automatic attack trigger works through the ordinary AI and keeps manual controls hidden without a negative status',()=>{
  const{b,u,hits}=make();enemy(b);u.profile.canAttack=()=>true;u.atkCd=0;u.skill.setSpTotal(u.skill.spCost);advance(b,.1);
  assert.equal(u.skill.active,true);assert.equal(u.skill.activations,1);assert.equal(skillHud(u.skill).canActivate,false);
  u.profile.canAttack=()=>false;advance(b,2);assert.equal(out(hits,u).length,1);near(out(hits,u)[0].amount,u.s.atk*2.9);
});
test('S3 dodge suppresses damage-missable stuns while the valid attack still adds a stack',()=>{
  const{b,u,hits}=make({skill:2}),main=enemy(b),splash=enemy(b,{x:6.8});
  b.addBuff(main,{key:'test:dodge',mods:{dodgePhys:1}});b.addBuff(splash,{key:'test:dodge',mods:{dodgePhys:1}});
  cast(b,u);advance(b,.4);shot(b,u);advance(b,1.4);assert.equal(out(hits,u).length,0);
  assert.equal(main.findBuff('stun'),null);assert.equal(splash.findBuff('stun'),null);assert.equal(u.mem.pepeStacks,1);
});
test('S3 stun respects native resistance and immunity independently for each splash victim',()=>{
  const{b,u}=make({skill:2}),main=enemy(b),resistant=enemy(b,{x:6.7}),immune=enemy(b,{x:6.8});
  b.applyStatus(resistant,'resist',{duration:20});immune.def={...immune.def,immune:immuneSet({stunImmune:true})};
  cast(b,u);advance(b,.4);shot(b,u);advance(b,1.4);assert.ok(main.findBuff('stun'));near(resistant.findBuff('stun').duration,.4);assert.equal(immune.findBuff('stun'),null);
});
test('a full S2 keeps the finite source duration after startup and returns the original attack range',()=>{
  const{b,u}=make({skill:1});const original=[...u.rangeKeys];cast(b,u);advance(b,18.1);assert.equal(u.skill.active,true);
  advance(b,.4);assert.equal(u.skill.active,false);advance(b,.4);assert.deepEqual(u.rangeKeys,original);assert.equal(u.mem.regularFormVisual,null);
});
test('S3 additional splash includes a second blocked victim outside the circle; unblocked flyers remain excluded',()=>{
  const{b,u,hits}=make({skill:2}),main=enemy(b,{x:5.6}),second=enemy(b,{x:4.4}),fly=enemy(b,{x:5.8,fly:true});
  assert.equal(b._checkBlock(main),true);assert.equal(b._checkBlock(second),true);cast(b,u);advance(b,.4);shot(b,u);advance(b,1.4);
  assert.ok(out(hits,u).some(h=>h.target===second));assert.ok(second.findBuff('stun'));near(fly.hp,fly.s.maxHp);
});
test('native timeMode0 includes BAT changes in the hit clock, separate from the real attack cooldown',()=>{
  const{b,u,hits}=make();enemy(b);b.addBuff(u,{key:'test:bat',mods:{batPct:1}});shot(b,u);
  advance(b,1.5);assert.equal(out(hits,u).length,0);advance(b,.25);assert.equal(out(hits,u).length,1);near(u.s.interval,3.6);
});
