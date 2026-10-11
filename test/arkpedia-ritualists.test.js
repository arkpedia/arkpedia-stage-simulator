// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-ritualist-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';

const ID = 'char_4102_threye';
const near = (x,y,eps=1e-5) => assert.ok(Math.abs(x-y)<eps, `${x} != ${y}`);
function advance(b,t) { for(let i=0;i<Math.round(t/b.dt);i++) b.step(); assert.deepEqual(b.errors,[]); }
function make({skill=0,rank=10,elite=2,potential=1,dir='UP'}={}) {
  const src=structuredClone(data),op=src.operators[ID];assert.ok(op);
  src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
  const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,
    skillRank:elite===2?rank:Math.min(rank,elite===0?4:7),skillId:op.skills[skill].id};
  const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;
  b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  const u=b.deployOperator(ID,2,4,dir);assert.ok(u);u.atkCd=1000;return{b,u};
}
function enemy(b,{row=3,col=4,res=0,hp=100000,fly=false}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(e.base,{maxHp:100000,def:0,res});e.markDirty();void e.s;e.hp=hp;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});
  b._buildEnemyIndex();return e;
}
function cast(b,u,charges=1){u.skill.setSpTotal(u.skill.spCost*charges);assert.equal(u.skill.activate(u.skill.id.endsWith('_1')?'DEFAULT':'manual'),true);u.atkCd=1000;}
function shot(b,u,e,t=1){const hp=e.hp;b.forceAttack(u,[e]);u.atkCd=1000;advance(b,t);return hp-e.hp;}

test('ritualist evidence preserves original modes, both exact facings and ATK-based injury independently from damage output',()=>{
  assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);
  for(const f of ['Front','Back'])assert.equal(evidence.models[ID][f].sha256,evidence.officialSkeletonBindings[ID][f].sha256);
  for(const x of evidence.source.bundles)assert.match(x.sha256,/^[a-f0-9]{64}$/);
  const t=evidence.buffTemplates.threye_t_2.eventToActions.ON_OUTPUT_DAMAGE[0];
  assert.match(t.$type,/ApplyElementDamage,/);assert.equal(t._epDamageScale,'ep_damage_ratio');
  assert.equal(t._baseOnHostAtk,false);assert.equal(t._baseOnEnemyHostAtk,false);
  const a=evidence.skills.skchr_threye_1.flatMap(x=>x.components).find(c=>c._atkScale!=null);
  assert.equal(a._animKey,'Skill_2');assert.equal(a._elementDamageType,4);assert.equal(a._waitForAttackEvent,1);
  assert.ok(evidence.limitations.some(x=>x.includes('cancellation/dodge/shield')));
});
test('both skills retain all ranks, exact SP and storage without generic talents or attacks',()=>{
  for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
    const{b,u}=make({skill,rank}),row=evidence.skillTable[u.skill.id].levels[rank-1];
    assert.equal(u.skill.noSkill,false);near(u.skill.spCost,row.spData.spCost);
    assert.equal(u.skill.maxCharges,row.spData.maxChargeTime);near(u.skill.spTotal,row.spData.initSp);
    assert.equal(u.profile.dmgType,'arts');assert.equal(u.profile.maxTargets,1);advance(b,.1);
  }
});
test('selected promotion and potential apply only the ordinary ATK/ASPD talent',()=>{
  for(const[elite,potential]of [[0,1],[1,1],[2,1],[2,5]]){
    const{u}=make({elite,potential,rank:7});
    near(u.s.atk,u.base.atk*(elite===2?potential===5?1.07:1.06:1));
    near(u.s.aspd,u.base.aspd+(elite===2?potential===5?7:6:0));
  }
});
test('ordinary ranged attacks use source .633 event and speed8 before landing, with no regular-stage injury',()=>{
  for(const dir of ['UP','DOWN']){
    const{b,u}=make({dir}),e=enemy(b,{row:4});b.forceAttack(u,[e]);u.atkCd=1000;
    advance(b,.6);assert.equal(b.projectiles.list.length,0);near(e.hp,100000);
    advance(b,.1);assert.equal(b.projectiles.list.length,1);near(e.hp,100000);
    advance(b,.35);near(100000-e.hp,u.s.atk);near(e.elem.apoptosis,0);
  }
});
test('S1 injury uses ATK ratio independently from Arts scale and RES for every rank',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,u}=make({rank}),e=enemy(b,{res:60});cast(b,u);
    near(shot(b,u,e),u.s.atk*u.skill.bb.atk_scale*.4);
    near(e.elem.apoptosis,u.s.atk*u.skill.bb.ep_damage_ratio);
  }
});
test('S2 injury uses selected ATK ratio and ASPD while target count becomes exactly two at every rank',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,u}=make({skill:1,rank}),e=enemy(b,{res:80});enemy(b,{col:5});enemy(b,{row:4});
    cast(b,u);near(u.s.aspd,u.base.aspd+6+u.skill.bb.attack_speed);
    assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,2);
    near(shot(b,u,e),u.s.atk*.2);near(e.elem.apoptosis,u.s.atk*u.skill.bb['attack@ep_damage_ratio']);
  }
});
test('S1 automatic charge consumption uses one charge per attack, then returns to ordinary Arts',()=>{
  const{b,u}=make(),e=enemy(b);u.skill.setSpTotal(u.skill.spCost*2);u.atkCd=0;advance(b,1);
  assert.equal(u.stats.attacks,1);assert.equal(u.skill.charges,1);
  near(e.elem.apoptosis,u.s.atk*.8);near(100000-e.hp,u.s.atk*1.3);
  u.atkCd=0;advance(b,1);assert.equal(u.stats.attacks,2);assert.equal(u.skill.charges,0);
  // Avoid a burst when checking the third ordinary strike.
  e.elem.apoptosis=0;u.skill.setSpTotal(0);u.atkCd=0;advance(b,1);
  assert.equal(u.stats.attacks,3);near(e.elem.apoptosis,0);
});
test('S2 natural AI damages two distinct ground/flying targets once each, without area duplication',()=>{
  const{b,u}=make({skill:1}),a=enemy(b),z=enemy(b,{col:5,fly:true}),third=enemy(b,{row:4});
  cast(b,u);u.atkCd=0;advance(b,1);assert.equal(u.stats.attacks,1);
  assert.equal([a,z,third].filter(e=>e.hp<100000).length,2);
  for(const e of [a,z,third])if(e.hp<100000){near(100000-e.hp,u.s.atk);near(e.elem.apoptosis,u.s.atk*.35);}
});
test('ATK-based injury survives a fully absorbing HP shield but accepted-output policy skips dodge and invulnerability',()=>{
  const{b,u}=make(),shield=enemy(b,{res:50});b.addBuff(shield,{key:'test:shield',shield:100000});cast(b,u);
  near(shot(b,u,shield),0);near(shield.elem.apoptosis,u.s.atk*.8);
  for(const type of ['dodge','immune']){
    const e=enemy(b,{col:5});b.addBuff(e,{key:type,...(type==='dodge'?{mods:{dodgeArts:1}}:{flags:{invulnerable:true}})});
    cast(b,u);near(shot(b,u,e),0);near(e.elem.apoptosis,0);
  }
});
test('scoped injury observer cannot borrow unrelated, nested or later damage',()=>{
  const{b,u}=make(),e=enemy(b),other=enemy(b,{col:5});cast(b,u);shot(b,u,e);
  const before=e.elem.apoptosis,count=b._hooks.damaged?.length??0;
  b.dealDamage(u,e,{amount:30,type:'arts',isAttack:true,attackId:999});near(e.elem.apoptosis,before);
  near(other.elem.apoptosis,0);assert.equal(b._hooks.damaged?.length??0,count);
});
test('born S2 projectile retains its injury when the skill expires before impact',()=>{
  const{b,u}=make({skill:1}),e=enemy(b,{row:5});cast(b,u);
  b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);assert.equal(b.projectiles.list.length,1);
  u.skill.end('test');advance(b,.5);near(e.elem.apoptosis,u.s.atk*.35);
  const before=e.elem.apoptosis;shot(b,u,e,1.2);near(e.elem.apoptosis,before);
});
test('unfired ritualist attacks are cancelled by controls without emitting injury',()=>{
  const{b,u}=make(),e=enemy(b);cast(b,u);b.forceAttack(u,[e]);u.atkCd=1000;
  advance(b,.1);b.applyStatus(u,'stun',{duration:.02});advance(b,1);
  near(e.hp,100000);near(e.elem.apoptosis,0);assert.equal(b.projectiles.list.length,0);
});
test('Necrosis burst locks further injury and killed victims receive no gauge',()=>{
  const{b,u}=make({skill:1}),e=enemy(b);cast(b,u);e.elem.apoptosis=e.gaugeMax-1;shot(b,u,e);
  assert.ok(e.findBuff('apoptosisBurst'));near(e.elem.apoptosis,e.gaugeMax);shot(b,u,e);near(e.elem.apoptosis,e.gaugeMax);
  const dead=enemy(b,{col:5,hp:1});shot(b,u,dead);assert.equal(dead.alive,false);near(dead.elem.apoptosis,0);
});
test('S2 restores ordinary targeting and attack playback after ending',()=>{
  const{b,u}=make({skill:1});enemy(b);enemy(b,{col:5});cast(b,u);
  assert.equal(effectiveProfile(u).attackVisual,'Skill_2');u.skill.end('test');
  assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);
  assert.equal(effectiveProfile(u).attackVisual,'Attack');near(u.s.aspd,u.base.aspd+6);
});
