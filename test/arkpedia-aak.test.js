// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-aak-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const ID = 'char_225_haak', ALLY = 'char_122_beagle', OTHER = 'char_208_melan';
const near = (a,z,eps=1e-5) => assert.ok(Math.abs(a-z)<eps, `${a} != ${z}`);
function advance(b,s) { for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]); }
function make({skill=0,rank=10,elite=2,potential=1}={}) {
  const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];
  const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
    potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,elite===0?4:elite===1?7:10)};
  const b=new StandardBattle(src,{operators:[build,defaultBuild(src.operators[ALLY]),defaultBuild(src.operators[OTHER])]});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const hits=[];b.on('damaged',c=>hits.push(c));
  const deploy=(id=ID,r=3,c=4,dir='RIGHT')=>{b.getPlayer('arkpedia').dp=80;
    const u=b.deployOperator(id,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;};
  return {b,deploy,hits};
}
function tank(b,u,{hp=100000,def=500}={}) {Object.assign(u.base,{maxHp:hp,def});u.markDirty();void u.s;u.hp=hp;return u;}
function enemy(b,{r=3,c=5,fly=false}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});tank(b,e,{def:100});e.base.moveSpeed=0;e.markDirty();
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u) {u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);}
const stim = (hits,u) => hits.filter(h=>h.source===u&&h.dmg?.tags.includes('aak:stimpack'));

test('Aak retains all30 ranks, seven original templates and native-bound Front/Back identities',()=>{
  assert.equal(evidence.frameParity,false);assert.equal(evidence.source.bundles.length,5);
  for(const s of data.operators[ID].skills)assert.deepEqual(s.levels,evidence.tables.skills[s.id].levels);
  for(const face of ['Front','Back']) {
    const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
    const raw=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
  }
  assert.equal(evidence.templates.haak_t_1.eventToActions.ON_BUFF_START[1]._datas.length,4);
});
test('decay waits one second, uses max HP, ignores mitigation/SP and stops at1HP',()=>{
  const {b,deploy,hits}=make(),u=deploy();const hp=u.hp;
  advance(b,.9);near(u.hp,hp);advance(b,.2);near(hp-u.hp,u.s.maxHp*.01);
  assert.ok(hits.at(-1).dmg.tags.includes('hpLoss'));const sp=u.skill.spTotal;
  b.addBuff(u,{key:'test:invulnerable',flags:{invulnerable:true},mods:{trueTakenMul:0}});
  u.hp=2;advance(b,1);near(u.hp,1);advance(b,2);near(u.hp,1);assert.ok(u.skill.spTotal>sp);
});
test('Pharmaceutical Diffusion follows promotion/potential and affects own and external healing',()=>{
  for(const [elite,potential,mul] of [[0,1,1],[1,1,1],[2,1,1.2],[2,5,1.25]]) {
    const {b,deploy}=make({elite,potential}),u=deploy(),a=deploy(ALLY,3,5);u.hp=1;
    near(b.heal(a,u,100),100*mul);near(b.heal(u,u,100,{self:true}),100*mul);
    b.addBuff(u,{key:'test:heal-free',flags:{healFree:true}});near(b.heal(u,u,100,{self:true}),0);
  }
});
test('normal first Begin plus Loop is literal and uncapped; later attacks use Loop alone',()=>{
  for(const dir of ['UP','DOWN','LEFT','RIGHT'])for(const aspd of [-50,0,100]) {
    const {b,deploy}=make(),u=deploy(ID,3,4,dir);b.addBuff(u,{key:'test:aspd',mods:{aspd}});
    const p=effectiveProfile(u),rate=u.s.aspd/100;
    near(p.windup(b,u),(.333+.033)/rate);near(p.windup(b,u),.033/rate);
  }
});
test('normal attacks select one ground/air target and have no splash',()=>{
  const {b,deploy,hits}=make(),u=deploy(),e=enemy(b),z=enemy(b,{c:5.1,fly:true});
  assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);
  assert.equal(b.forceAttack(u,[e]),true);advance(b,.6);
  assert.equal(hits.filter(h=>h.dmg?.tags.includes('aak:normal')).length,1);near(z.hp,100000);
});
test('each random cocktail branch is independent:ATKscale,sluggish,stun,self heal',()=>{
  for(const branch of [0,1,2,3]) {
    const {b,deploy,hits}=make(),u=deploy(),e=enemy(b);u.hp=100;
    b.rng.int=()=>branch;assert.equal(b.forceAttack(u,[e]),true);advance(b,.6);
    const normal=hits.find(h=>h.dmg?.tags.includes('aak:normal'));
    near(normal.amount,u.s.atk*(branch===0?1.5:1)-100);
    near(e.findBuff('sluggish')?.mods.moveMul ?? 1,branch===1?.2:1);assert.equal(e.s.flags.stun,branch===2);
    near(u.hp,branch===3?100+u.s.maxHp*.15*1.2:100);
  }
});
test('S1 all selected ranks grants exact ASPD and duration',()=>{
  for(let rank=1;rank<=10;rank++) {
    const {b,deploy}=make({rank}),u=deploy();cast(b,u);near(u.s.aspd,100+u.def.skill.bb.attack_speed);
    near(u.skill.timeLeft,u.def.skill.duration);advance(b,u.def.skill.duration+.1);near(u.s.aspd,100);
  }
});
test('stimpacks need an eligible ally and leave full SP untouched when none is present',()=>{
  for(const skill of [1,2]) {
    const {b,deploy}=make({skill}),u=deploy();u.skill.setSpTotal(u.skill.spCost);
    assert.equal(b.activateOperator(ID),false);near(u.skill.spTotal,u.skill.spCost);
    const a=deploy(ALLY,3,5);b.addBuff(a,{key:'test:isolated',flags:{isolated:true}});
    assert.equal(b.activateOperator(ID),false);b.removeBuff(a,'test:isolated');cast(b,u);
    assert.equal(u.mem.aakBurst.target,a);
  }
});
test('forward centre line wins over nearer off-axis ally for every facing',()=>{
  for(const [dir,r,c,orr,orc]of [['RIGHT',3,6,4,5],['LEFT',3,2,4,3],['UP',5,4,4,5],['DOWN',1,4,2,5]]) {
    const {b,deploy}=make({skill:2}),u=deploy(ID,3,4,dir),a=deploy(ALLY,r,c);deploy(OTHER,orr,orc);
    cast(b,u);assert.equal(u.mem.aakBurst.target,a);
  }
});
test('S2/S3 all ranks deal15 separately mitigated fixed hits, then exact self/target buffs',()=>{
  for(const skill of [1,2])for(let rank=1;rank<=10;rank++) {
    const {b,deploy,hits}=make({skill,rank}),u=deploy(),a=tank(b,deploy(ALLY,3,5));
    const priorDef = a.s.def;
    cast(b,u);assert.equal(u.findBuff('aak:self'),null);assert.equal(a.findBuff(`aak:stimpack:${u.id}`),null);
    advance(b,1.6);assert.equal(stim(hits,u).length,15);
    for(const h of stim(hits,u))near(h.amount,25);
    const bb=u.def.skill.bb;
    if(skill===1) {near(a.s.maxHp,a.base.maxHp*(1+bb.max_hp));near(a.s.def,priorDef+a.base.def*bb.def);near(u.s.maxHp,u.base.maxHp*(1+bb.max_hp));}
    else {near(a.s.atk,a.base.atk*(1+bb.atk));near(a.s.aspd,100+bb.attack_speed);near(u.s.atk,u.base.atk*(1+bb.atk));}
    assert.equal(u.mem.aakBurst,null);advance(b,u.def.skill.duration);assert.equal(a.findBuff(`aak:stimpack:${u.id}`),null);
    assert.equal(u.findBuff('aak:self'),null);
  }
});
test('allied hit receipts preserve defensive SP and dodge, while talent never rolls on stimpacks',()=>{
  const {b,deploy,hits}=make({skill:2}),u=deploy(),a=tank(b,deploy(ALLY,3,5));
  a.skill.spType='hurt';a.skill.setSpTotal(0);
  b.rng.int=()=>{throw Error('cocktail rolled on ally');};cast(b,u);advance(b,1.6);
  assert.equal(stim(hits,u).length,15);near(a.skill.spTotal,15);
  const second=make({skill:1}),v=second.deploy(),z=tank(second.b,second.deploy(ALLY,3,5));
  second.b.addBuff(z,{key:'test:dodge',mods:{dodgePhys:1}});cast(second.b,v);advance(second.b,1.6);
  assert.equal(stim(second.hits,v).length,0);assert.ok(z.findBuff(`aak:stimpack:${v.id}`));
});
test('born stimpack projectiles persist after withdrawal and never hit a redeployed ally life',()=>{
  const {b,deploy,hits}=make({skill:2}),u=deploy(),a=tank(b,deploy(ALLY,3,6));cast(b,u);
  advance(b,.7);assert.ok(b.projectiles.list.some(p=>p.source===u));
  b.retreatOperator(ID);const count=stim(hits,u).length;advance(b,.3);
  assert.ok(stim(hits,u).length>count);assert.ok(stim(hits,u).length<15);
  const next=make({skill:2}),v=next.deploy(),z=tank(next.b,next.deploy(ALLY,3,6));cast(next.b,v);
  advance(next.b,.7);next.b.retreatOperator(ALLY);z.deploySeq++;advance(next.b,.5);
  assert.equal(z.findBuff(`aak:stimpack:${v.id}`),null);
});
test('dead selected ally never receives a buff and the burst never moves to another ally',()=>{
  const {b,deploy,hits}=make({skill:2}),u=deploy(),a=tank(b,deploy(ALLY,3,5),{hp:100,def:0}),z=deploy(OTHER,4,5);
  cast(b,u);advance(b,1.6);assert.equal(a.alive,false);assert.equal(stim(hits,u).length,1);
  assert.equal(z.findBuff(`aak:stimpack:${u.id}`),null);assert.ok(u.findBuff('aak:self'));
});
test('control before release cancels every unborn shot and cleans the casting lock',()=>{
  for(const status of ['stun','freeze','sleep','disarm']) {
    const {b,deploy,hits}=make({skill:2}),u=deploy();tank(b,deploy(ALLY,3,5));cast(b,u);
    b.applyStatus(u,status,{duration:.1});advance(b,1.7);assert.equal(stim(hits,u).length,0);
    assert.equal(u.findBuff('aak:casting'),null);assert.equal(u.findBuff('aak:self'),null);
  }
});
test('retreat before release cancels burst; already born buff persists until its original deadline',()=>{
  const first=make({skill:2}),v=first.deploy();tank(first.b,first.deploy(ALLY,3,5));cast(first.b,v);
  first.b.retreatOperator(ID);advance(first.b,2);assert.equal(stim(first.hits,v).length,0);
  const {b,deploy}=make({skill:2}),u=deploy(),a=tank(b,deploy(ALLY,3,5));cast(b,u);advance(b,1.6);
  b.retreatOperator(ID);assert.ok(a.findBuff(`aak:stimpack:${u.id}`));advance(b,20);
  assert.equal(a.findBuff(`aak:stimpack:${u.id}`),null);
});
