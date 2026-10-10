// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-ines-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { absoluteRangeKeys, enemyStealthed, canTargetAlly } from '../server/sim/targeting.js';
const ID = 'char_4087_ines';
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a-z) < eps, `${a} != ${z}`);
function advance(b, s) {
  for (let i = 0; i < Math.ceil(s/b.dt-1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make({ skill = 1, rank = 10, elite = 2, potential = 1 } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4,7,10][elite]) };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  const deploy = (row = 5, col = 5, dir = 'RIGHT') => {
    b.getPlayer('arkpedia').dp = 90;
    const cost = b.cost(ID), u = b.deployOperator(ID, row, col, dir);
    u.atkCd = 1000; u.skill.rule = 'NEVER'; return { u, cost };
  };
  return { b, deploy, receipts };
}
function enemy(b, { r = 5, c = 6, fly = false, stealth = false, free = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [r,c] });
  Object.assign(e.base, { maxHp: 100000, atk: 400, def: 0, res: 0, moveSpeed: 1 });
  e.markDirty(); void e.s; e.hp = 100000;
  if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true, stealth, untargetable: free } });
  b._buildEnemyIndex(); return e;
}
function cast(b, u) {
  u.skill.setSpTotal(u.skill.spCost);
  assert.equal(u.skill.activate('test'), true); advance(b, .2);
}
function shot(b, u, e) { assert.equal(b.forceAttack(u, [e]), true); u.atkCd = 1000; }
function block(u, e) { u.blocking = [e]; e.blockedBy = u; }
const key = (u, n) => `ines:${n}:${u.id}`;

test('Ines uses all source stats/ranks and both native skeletons without fabricated models', () => {
  const o = data.operators[ID];
  for (const [i,p] of o.phases.entries()) assert.deepEqual(p.attributesKeyFrames, evidence.tables.character.phases[i].attributesKeyFrames);
  for (const s of o.skills) assert.deepEqual(s.levels.map(({rangeGrid, ...level})=>level), evidence.tables.skills[s.id].levels);
  for (const face of ['Front', 'Back']) {
    const asset = data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
    const raw = readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), evidence.officialSkeletonBindings[ID][face].sha256);
  }
});
test('all S1 ranks grant selected DP and three fixed Arts ticks without DOT SP or splash', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy, receipts } = make({ skill: 0, rank }), { u } = deploy();
    const e = enemy(b), z = enemy(b, { c: 6.1 }); block(u, e); b.getPlayer('arkpedia').dp = 0;
    cast(b, u); shot(b, u, e); advance(b, .4);
    const dot = e.findBuff('ines_s_1[damage]'); assert.ok(dot); near(b.dp, 2);
    const snapshot = dot.data.value, sp = u.skill.spTotal;
    b.addBuff(u, { key: 'test:later-atk', mods: { atkFlat: 1000 } });
    advance(b, 3.1);
    const ticks = receipts.filter(x => x.dmg.tags.includes('ines:bleed'));
    assert.equal(ticks.length, 3); for (const tick of ticks) near(tick.dmg.amount, snapshot);
    near(ticks[1].time-ticks[0].time, 1); near(ticks[2].time-ticks[1].time, 1);
    near(u.skill.spTotal, sp); near(z.hp, 100000); near(b.dp, 2);
  }
});
test('S1 first DOT clock is .9 seconds after attachment and survives its source retreat', () => {
  const { b, deploy, receipts } = make({ skill: 0 }), { u } = deploy(), e = enemy(b); block(u, e);
  cast(b, u); shot(b, u, e); advance(b, .4);
  const t = receipts.find(x => x.dmg.isAttack).time;
  b.retreatOperator(ID); advance(b, .8);
  assert.equal(receipts.filter(x => x.dmg.tags.includes('ines:bleed')).length, 0);
  advance(b, .1); const dot = receipts.find(x => x.dmg.tags.includes('ines:bleed'));
  assert.ok(dot); near(dot.time-t, .9, b.dt+.001);
  advance(b, 2); assert.equal(receipts.filter(x => x.dmg.tags.includes('ines:bleed')).length, 3);
  near(e.s.atk, 400);
});
test('ordinary and S2 attacks use only one ground/air target and original Combat/Attack events', () => {
  for (const dir of ['RIGHT','LEFT','UP','DOWN']) for (const active of [false,true]) for (const melee of [false,true]) {
    const { b, deploy, receipts } = make(), { u } = deploy(5,5,dir);
    const k = absoluteRangeKeys([[0,1]],5,5,dir)[0], r = Math.floor(k/21), c = k%21;
    const e = enemy(b, { r,c,fly: !melee }), z = enemy(b, { r,c });
    if (melee) block(u,e); if (active) cast(b,u);
    assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);
    b.addBuff(u, { key: 'test:ASPD', mods: { aspd: 200 } }); shot(b,u,e);
    const ev = b._evq.find(x => x[0] === 'atk' && x[1] === u.id);
    assert.equal(ev[4].animation, `${active?'Skill_2_':''}${melee?'Combat':'Attack'}`);
    near(ev[4].windup, (active || !melee ? .467 : .333)/(u.s.aspd/100));
    advance(b,.5); assert.equal(receipts.filter(x => x.dmg.isAttack).length,1);
    near(z.hp,100000);
  }
});
test('promotion/potential first-hit Bind and ATK theft apply once per victim, return on death/retreat', () => {
  for (const [elite,potential,amount,duration] of [[0,1,0,0],[1,1,50,3],[1,5,60,3],[2,1,90,5],[2,5,100,5]]) {
    const { b, deploy } = make({ skill: 0, elite,potential }), { u } = deploy(), e = enemy(b); block(u,e);
    const base = u.s.atk; shot(b,u,e); advance(b,.4);
    near(u.s.atk,base+amount); near(e.s.atk,400-amount);
    if (duration) near(e.findBuff(key(u,'bind')).duration,duration);
    shot(b,u,e); advance(b,.4); near(u.s.atk,base+amount);
    const z = enemy(b); block(u,z); shot(b,u,z); advance(b,.4); near(u.s.atk,base+amount*2);
    b.kill(e,u); near(u.s.atk,base+amount); b.retreatOperator(ID); near(z.s.atk,400);
    assert.equal(z.findBuff(key(u,'mark')),null);
    if (duration) assert.ok(z.findBuff(key(u,'bind')), 'Bind is independent of the removed owner mark');
  }
});
test('Bind immunity refuses root without disabling the independent first-hit ATK theft', () => {
  const { b, deploy } = make(), { u } = deploy(), e = enemy(b); block(u,e);
  e.def.immune.add('bind'); shot(b,u,e); advance(b,.4);
  assert.equal(e.findBuff(key(u,'bind')),null); near(e.s.atk,310); near(u.mem.inesAtk.get(e),90);
});
test('all S2 ranks retain manual SP/ATK, invisibility, selected range and ASPD cap', () => {
  for (let rank=1;rank<=10;rank++) {
    const { b, deploy } = make({ rank }), { u } = deploy(), e = enemy(b); block(u,e);
    const base = u.s.atk, bb = u.skill.bb;
    near(u.skill.spCost,evidence.tables.skills.skchr_ines_2.levels[rank-1].spData.spCost);
    assert.equal(u.skill.manual,true); cast(b,u);
    near(u.s.atk,base*(1+bb.atk)); assert.equal(u.s.flags.stealth,true);
    assert.equal(u.rangeKeys.length,8); shot(b,u,e); advance(b,.6);
    near(u.mem.inesSpeedTotal,bb['attack@steal_atk_speed']);
    near(u.s.aspd,100+bb['attack@steal_atk_speed']);
    b.kill(e,u); near(u.mem.inesSpeedTotal,bb['attack@steal_atk_speed']);
    near(u.s.atk,base*(1+bb.atk));
    u.skill.end('duration'); near(u.s.aspd,100); assert.equal(!!u.s.flags.stealth,false);
    assert.equal(u.rangeKeys.length,3); near(u.s.atk,base);
  }
});
test('S2 theft reaches its shared cap, retains owner speed after victim invalidation and cleans skill end', () => {
  const { b, deploy } = make(), { u } = deploy(), e = enemy(b); block(u,e); cast(b,u);
  b.getPlayer('arkpedia').dp=0;
  for(let i=0;i<12;i++){shot(b,u,e);advance(b,.35);}
  near(u.mem.inesSpeedTotal,70); near(u.s.aspd,170); near(e.s.aspd,30); near(b.dp,12);
  b.addBuff(e,{key:'test:free',flags:{untargetable:true}});advance(b,.1);
  assert.equal(e.findBuff(key(u,'speed')),null);near(u.s.aspd,170);
  near(u.mem.inesAtk.size,0); const z=enemy(b); block(u,z);shot(b,u,z);advance(b,.4);
  near(u.s.aspd,170);assert.equal(z.findBuff(key(u,'speed')),null);
  u.skill.end('manual');near(u.s.aspd,100);assert.equal(u.mem.inesSpeed.size,0);
});
test('S2 invisibility hides from ranged enemies but permits the enemy she blocks to attack', () => {
  const { b, deploy } = make(), { u } = deploy(), e = enemy(b);cast(b,u);
  assert.equal(canTargetAlly(e,u,true),false); block(u,e);
  assert.equal(canTargetAlly(e,u,false),true);
});
test('Sentry persists without a unit/card/slot, fixed oriented range and single overlap slow', () => {
  for(const dir of ['RIGHT','UP','LEFT','DOWN']) {
    const { b, deploy }=make(),{u}=deploy(5,5,dir); b.retreatOperator(ID);
    const state=b.inesState, original=state.sentry;
    assert.deepEqual([...original.range],absoluteRangeKeys([[0,0],[0,1],[0,2]],5,5,dir));
    assert.equal(b.deployedSlots(),0); assert.equal(b.units.filter(x=>x.kind==='token').length,0);
    const k=[...original.range][1],e=enemy(b,{r:Math.floor(k/21),c:k%21,fly:true,stealth:true,free:true});
    advance(b,.1);near(e.s.moveSpeed,.7);assert.equal(enemyStealthed(e),false);
    e.x=15;e.y=15;advance(b,.1);near(e.s.moveSpeed,1);assert.equal(enemyStealthed(e),true);
    e.x=k%21;e.y=Math.floor(k/21);advance(b,30);assert.equal(state.sentry,original);
    near(e.s.moveSpeed,.7);
    b.bench[ID].readyAt=b.time;const{u:z}=deploy(5,5,dir);cast(b,z);near(e.s.moveSpeed,.7);
    b.retreatOperator(ID);assert.notEqual(state.sentry,original);near(e.s.moveSpeed,.7);
    b.forceEnd();assert.equal(state.sentry,null);assert.equal(e.findBuff('ines:sentry-aura'),null);
  }
});
test('owner S2 reveal area expands but retreat leaves a fixed three-tile Sentry, never eight tiles',()=>{
  const {b,deploy}=make(),{u}=deploy(),e=enemy(b,{r:6,c:6,stealth:true});advance(b,.1);
  assert.equal(enemyStealthed(e),true);cast(b,u);advance(b,.1);assert.equal(enemyStealthed(e),false);
  b.retreatOperator(ID);near(e.s.moveSpeed,1);assert.equal(enemyStealthed(e),true);
  assert.equal(b.inesState.sentry.range.size,3);
});
test('S3 first branch costs zero, uses Start_Skill .167, returns without count/cooldown/refund',()=>{
  const{b,deploy}=make({skill:2});b.unitLimit=0;
  const{u,cost}=deploy();near(cost,0);near(b.dp,90);assert.equal(b.deployedSlots(),0);
  assert.equal(u.mem.regularFormVisual.clip,'Start_Skill');assert.equal(b.inesState.sentry,null);
  advance(b,.15);assert.equal(u.alive,true);advance(b,.04);assert.equal(u.alive,false);
  assert.equal(b.bench[ID].deployments,0);near(b.bench[ID].readyAt,b.time-b.dt);
  near(b.dp,90);near(b.cost(ID),u.base.cost);assert.ok(b.inesState.sentry);
  b.unitLimit=8;const{u:z,cost:paid}=deploy(5,10,'LEFT');near(paid,z.base.cost);
  assert.equal(z.mem.inesFirst,false);assert.equal(b.deployedSlots(),1);assert.equal(b.bench[ID].deployments,1);
  advance(b,.19);near(z.s.atk,z.base.atk);assert.ok(b.inesState.sentry);
  advance(b,.06);near(z.s.atk,z.base.atk*2.6);assert.equal(b.inesState.sentry,null);
  assert.equal(b.activateOperator(ID),false);
});
test('all S3 ranks use selected duration/ATK/retrieval scale/radius/target cap',()=>{
  for(let rank=1;rank<=10;rank++) {
    const{b,deploy,receipts}=make({skill:2,rank});deploy();advance(b,.24);
    const es=Array.from({length:8},(_,i)=>enemy(b,{c:5+i*.6}));
    const{u}=deploy(5,11,'LEFT');advance(b,1);
    const hits=receipts.filter(x=>x.dmg.tags.includes('ines:retrieval'));
    assert.equal(hits.length,u.skill.bb.max_target);
    assert.equal(new Set(hits.map(x=>x.target)).size,hits.length);
    for(const hit of hits)near(hit.dmg.amount,u.base.atk*(1+u.skill.bb.atk)*u.skill.bb.atk_scale
      +90*(1+u.skill.bb.atk)*u.skill.bb.atk_scale*hits.indexOf(hit));
    assert.ok(es.at(-1).hp===100000);near(u.skill.duration,evidence.tables.skills.skchr_ines_3.levels[rank-1].duration);
    advance(b,u.skill.duration);assert.equal(u.skill.active,false);assert.equal(u.skill.exhausted,true);
    near(u.s.atk,u.base.atk+90*hits.length);
  }
});
test('retrieval sweeps ground/air along its path, excludes invisible outsiders and never hits twice',()=>{
  const{b,deploy,receipts}=make({skill:2});deploy(5,3);advance(b,.24);
  const a=enemy(b,{c:3.2}),z=enemy(b,{c:8,fly:true}),out=enemy(b,{r:8,c:8}),hidden=enemy(b,{c:7,stealth:true});
  const{u}=deploy(5,11,'LEFT');advance(b,.25);
  assert.equal(b.inesState.sentry,null);assert.equal(z.hp,100000);assert.ok(a.hp<100000);
  advance(b,1);assert.ok(z.hp<100000);near(out.hp,100000);near(hidden.hp,100000);
  assert.equal(receipts.filter(x=>x.dmg.tags.includes('ines:retrieval')).length,2);
  const before=z.hp;advance(b,1);near(z.hp,before);
  b.retreatOperator(ID);near(a.s.atk,400);near(z.s.atk,400);assert.ok(b.inesState.sentry);
});
test('unfired attacks are canceled by retreat/abnormal control; emitted projectiles can still impact',()=>{
  for(const end of ['retreat','stun','emitted']) {
    const{b,deploy,receipts}=make(),{u}=deploy(),e=enemy(b);shot(b,u,e);
    if(end==='emitted'){advance(b,.51);assert.equal(b.projectiles.list.length,1);}
    if(end==='stun')b.applyStatus(u,'stun',{duration:1});else b.retreatOperator(ID);
    advance(b,.8);assert.equal(receipts.filter(x=>x.dmg.isAttack).length,end==='emitted'?1:0);
  }
});
