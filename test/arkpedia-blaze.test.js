// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-blaze-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack } from '../server/sim/ai.js';
const ID = 'char_017_huang';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advanceTo(b, time) { while (b.time < time - 1e-9) b.step(); assert.deepEqual(b.errors, []); }
function advance(b, seconds) { advanceTo(b, b.time + seconds); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT' } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia', 99);
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  const u = b.deployOperator(ID, 5, 5, dir); assert.ok(u);
  u.atkCd = 1000; u.profile.canAttack = () => false;
  return { b, u, receipts };
}
function enemy(b, { x = 6, y = 5, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: 100000, def: 0, res: 0, moveSpeed: 0 }); e.markDirty(); void e.s; e.hp = 100000;
  if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function cast(b, u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(u.skill.activate('test'), true); }
function shot(b, u, e) { performAttack(b, u, effectiveProfile(u), [e]); u.atkCd = 1000; }
const outgoing = (rs, u) => rs.filter(r => r.source === u && r.target.side === 'enemy');
const incoming = (b, u, e, amount) => b.dealDamage(e, u, { amount, type: 'true', isAttack: true });
const bbFor = (skill, rank) => Object.fromEntries(source.tables.skills[`skchr_huang_${skill + 1}`].levels[rank - 1].blackboard.map(v => [v.key, v.value]));

test('source preserves all ranks, native continuous clock, direct self cost, floor and actual facings', () => {
  assert.equal(source.source.bundles.length, 5); assert.equal(source.frameParity, false); assert.equal(source.moduleSupport, false);
  assert.equal(Object.values(source.tables.skills).flatMap(s => s.levels).length, 30);
  const all = source.skills.skchr_huang_3.flatMap(g => g.components).map(c => c.data);
  const clock = all.find(d => d._triggerDelta != null);
  near(clock._triggerDelta, 1); near(clock._preDelay, 1.399999976158142); assert.equal(clock._waitForAttackEvent, 0);
  const finish = source.templates.huang_s_3.eventToActions.ON_SKILL_FINISH;
  assert.ok(finish[0].$type.includes('DamageViaMaxHpRatio,')); assert.equal(finish[0]._skipModifierEvent, true);
  assert.equal(finish[0]._isUndeadable, true); assert.ok(finish[2].$type.includes('AOEDamage,'));
  for (const face of ['Front', 'Back']) assert.equal(source.models[ID][face].sha256, source.officialSkeletonBindings[ID][face].sha256);
  assert.equal(source.models[ID].Back.durations.Skill_2_Loop_End, undefined);
  assert.equal(source.models[ID].Back.durations.Skill_2_End, 3);
  assert.equal(source.mechanicsReference.url, 'https://prts.wiki/w/%E7%85%8C');
  assert.ok(source.verificationLimits.some(v => v.includes('Sub-second')));
});
for (let skill = 0; skill < 3; skill++) for (let rank = 1; rank <= 10; rank++)
  test(`S${skill + 1} rank ${rank}: selected source cost, stats and output`, () => {
    const { b, u, receipts } = make({ skill, rank }), s = source.tables.skills[`skchr_huang_${skill + 1}`].levels[rank - 1], bb = bbFor(skill, rank);
    near(u.skill.spCost, s.spData.spCost); const atk = u.s.atk, def = u.s.def, hp = u.hp;
    if (skill === 0) {
      const e = enemy(b); cast(b, u); shot(b, u, e); advance(b, .4);
      near(outgoing(receipts, u)[0].amount, atk * bb.atk_scale); near(u.skill.spTotal, 0);
    } else if (skill === 1) {
      cast(b, u); near(u.s.atk, atk * (1 + bb.atk)); near(u.s.def, def * (1 + bb.def));
      advance(b, 1.5); const e = enemy(b, { x: 7 }); shot(b, u, e); advance(b, .7);
      near(outgoing(receipts, u)[0].amount, atk * (1 + bb.atk)); advance(b, 100); assert.equal(u.skill.active, true);
    } else {
      const e = enemy(b), air = enemy(b, { fly: true }); cast(b, u); advanceTo(b, 8.05);
      const hits = outgoing(receipts, u); assert.equal(hits.length, 8);
      for (let n = 1; n <= 8; n++) near(hits[n - 1].amount, atk * (1 + bb.atk * n / (10 - 1.0499999523162842)));
      near(air.hp, air.s.maxHp); advanceTo(b, 9.05);
      assert.equal(outgoing(receipts, u).length, 10);
      near(outgoing(receipts, u).at(-1).amount, atk * (1 + bb.atk) * bb.damage_by_atk_scale);
      near(hp - u.hp, u.s.maxHp * bb.hp_ratio); near(u.s.def, def * (1 + bb.def));
      assert.ok(e.hp < air.hp); advanceTo(b, 10.05); near(u.s.atk, atk); near(u.s.def, def);
      assert.equal(u.skill.active, false); assert.equal(u.mem.regularFormVisual, null);
    }
  });

for (const elite of [0, 1, 2]) for (const potential of [1, 3, 5, 6])
  test(`E${elite} P${potential}: selected lethal guard, heal, floor duration and resistance delay`, () => {
    const { b, u } = make({ elite, potential }), e = enemy(b), hp = u.s.maxHp;
    incoming(b, u, e, hp * 2);
    if (elite === 0) { assert.equal(u.alive, false); return; }
    near(u.hp, 1 + hp * .5); assert.equal(u.mem.blazeUsed, true); assert.equal(u.findBuff('blaze:undead'), null);
    const duration = (elite === 1 ? 3 : 6) + (potential >= 3 ? 1 : 0);
    near(u.findBuff('blaze:floor').duration, duration); incoming(b, u, e, hp * 2); near(u.hp, hp * .5);
    advance(b, duration + .1); assert.equal(u.findBuff('blaze:floor'), null);
    if (elite === 1) { advance(b, 16); assert.equal(u.findBuff('blaze:resist'), null); }
    else {
      const delay = potential >= 5 ? 12 : 15; advanceTo(b, delay - .1); assert.equal(u.findBuff('blaze:resist'), null);
      advanceTo(b, delay + .1); near(u.findBuff('blaze:resist').data.value, .5);
    }
  });
test('quarter HP is inclusive, while a higher ratio does not trigger recovery', () => {
  const { b, u } = make(); u.hp = u.s.maxHp * .26; advance(b, b.dt); assert.equal(u.mem.blazeUsed, false);
  u.hp = u.s.maxHp * .25; advance(b, b.dt); near(u.hp, u.s.maxHp * .75); assert.equal(u.mem.blazeUsed, true);
});
test('talent heal respects HealFree and does not raise an already low damage floor', () => {
  const flag = 'healFree';
  const { b, u } = make(), e = enemy(b); b.addBuff(u, { key: 'test:refusal', flags: { [flag]: true } });
  u.hp = u.s.maxHp * .25; advance(b, b.dt); near(u.hp, u.s.maxHp * .25);
  incoming(b, u, e, 10000); near(u.hp, u.s.maxHp * .25); assert.ok(u.findBuff('blaze:floor'));
});
test('talent healing reads current MAX HP and normal healing multipliers', () => {
  const { b, u } = make(); b.addBuff(u, { key: 'test:stats', mods: { hpPct: .5, healingTakenMul: .5 } });
  u.hp = u.s.maxHp * .25; advance(b, b.dt); near(u.hp, u.s.maxHp * .5);
});
test('ally noHeal rejects external healing while allowing the native self heal', () => {
  const { b, u } = make(), e = enemy(b); b.addBuff(u, { key: 'test:no-heal', flags: { noHeal: true } });
  u.hp = u.s.maxHp * .25; near(b.heal(e, u, 100), 0); advance(b, b.dt); near(u.hp, u.s.maxHp * .75);
});
test('damage floor follows current MAX HP but HPLOSS bypasses it and one-time heal cannot repeat', () => {
  const { b, u } = make(), e = enemy(b); u.hp = u.s.maxHp * .25; advance(b, b.dt);
  b.addBuff(u, { key: 'test:hp', mods: { hpPct: .2 } }); incoming(b, u, e, 10000); near(u.hp, u.s.maxHp * .5);
  b.loseHp(u, 100); const hp = u.hp; incoming(b, u, e, 10000); near(u.hp, hp);
  b.loseHp(u, u.hp - 1); advance(b, b.dt); near(u.hp, 1); assert.equal(u.mem.blazeUsed, true);
});
test('scripted death cannot be reversed by the unused talent', () => {
  const { b, u } = make(); b.kill(u); advance(b, 20); assert.equal(u.alive, false); assert.equal(u.findBuff('blaze:floor'), null);
});
for (const potential of [1, 5]) test(`P${potential}: delayed resistance runs under control and halves future control durations`, () => {
  const { b, u } = make({ potential }), delay = potential === 1 ? 15 : 12;
  b.applyStatus(u, 'stun', { duration: 25 }); advanceTo(b, delay + .1);
  assert.ok(u.findBuff('blaze:resist')); assert.ok(u.findBuff('stun').timeLeft > 9);
  b.removeBuff(u, 'stun'); b.applyStatus(u, 'stun', { duration: 4 }); near(u.findBuff('stun').timeLeft, 2);
  b.addBuff(u, { key: 'test:stronger', status: 'resist', data: { value: .75 } }); b.removeBuff(u, 'stun');
  b.applyStatus(u, 'stun', { duration: 4 }); near(u.findBuff('stun').timeLeft, 1);
});
test('retreat replaces talent and resistance timers with a fresh deployment', () => {
  const { b, u } = make(); u.hp = u.s.maxHp * .25; advance(b, 8); b.retreat(u); advance(b, 71);
  b.addDp('arkpedia', 99); const next = b.deployOperator(ID, 5, 5, 'RIGHT'); assert.ok(next);
  assert.equal(next.mem.blazeUsed, false); assert.equal(next.findBuff('blaze:resist'), null);
  advance(b, 14.9); assert.equal(next.findBuff('blaze:resist'), null); advance(b, .2); assert.ok(next.findBuff('blaze:resist'));
});
for (const elite of [0, 1, 2]) test(`E${elite}: ordinary attacks follow current block count, retain input and reject air`, () => {
  const { b, u, receipts } = make({ elite }), es = Array.from({ length: 4 }, () => enemy(b)), air = enemy(b, { fly: true });
  const input = es[3]; shot(b, u, input); advance(b, .4); const hits = outgoing(receipts, u);
  assert.equal(hits.length, elite === 2 ? 3 : 2); assert.equal(hits[0].target, input); near(air.hp, air.s.maxHp);
  near(u.skill.spTotal, 1); b.addBuff(u, { key: 'test:no-block', mods: { blockCnt: -9 } });
  shot(b, u, es[0]); advance(b, .4); assert.equal(outgoing(receipts, u).length, hits.length);
});
for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) test(`${dir}: original ordinary/S1/S2 hit frames and facing clips`, () => {
  const { b, u, receipts } = make({ dir }), e = enemy(b, { x: 5, y: 5 });
  b.addBuff(u, { key: 'test:aspd', mods: { aspd: 300 } }); shot(b, u, e);
  advance(b, .13); assert.equal(outgoing(receipts, u).length, 0); advance(b, .04); assert.equal(outgoing(receipts, u).length, 1);
  cast(b, u); shot(b, u, e); advance(b, .2); assert.equal(outgoing(receipts, u).length, 1); advance(b, .14); assert.equal(outgoing(receipts, u).length, 2);
  const z = make({ skill: 1, dir }), q = enemy(z.b, { x: 5, y: 5 }); cast(z.b, z.u);
  advance(z.b, 1.5); shot(z.b, z.u, q); advance(z.b, .56); assert.equal(outgoing(z.receipts, z.u).length, 0);
  advance(z.b, .04); assert.equal(outgoing(z.receipts, z.u).length, 1);
});
test('S1 refunds only a dead input with no emitted replacement, including lethal output', () => {
  for (const mode of ['dead', 'replace', 'kill']) {
    const { b, u, receipts } = make(), e = enemy(b); cast(b, u); shot(b, u, e);
    if (mode === 'kill') e.hp = 1; else b.kill(e);
    if (mode === 'replace') enemy(b); advance(b, .4);
    near(u.skill.spTotal, mode === 'dead' ? u.skill.spCost : 0);
    assert.equal(outgoing(receipts, u).length, mode === 'dead' ? 0 : 1);
  }
});
test('S2 auto-activates without enemies, holds attacks during original Begin and remains permanent', () => {
  const { b, u, receipts } = make({ skill: 1 }); u.skill.setSpTotal(u.skill.spCost); advance(b, b.dt);
  assert.equal(u.skill.active, true); assert.equal(u.s.flags.disarm, true); assert.equal(u.mem.regularFormVisual.clip, 'Skill_1_Begin');
  const e = enemy(b, { x: 7 }); shot(b, u, e); advance(b, .7); assert.equal(outgoing(receipts, u).length, 0);
  advanceTo(b, 1.5); assert.equal(Boolean(u.s.flags.disarm), false); assert.equal(u.mem.regularFormVisual.clip, 'Skill_1_Idle');
  shot(b, u, e); advance(b, .7); assert.equal(outgoing(receipts, u).length, 1);
  assert.equal(b.activateOperator(ID), false); advance(b, 100); assert.equal(u.skill.active, true);
});
test('S2 refreshes extended range at release and never reaches a third tile', () => {
  const { b, u, receipts } = make({ skill: 1 }), input = enemy(b), far = enemy(b, { x: 8 });
  cast(b, u); advance(b, 1.5); shot(b, u, input); input.x = 10; b._buildEnemyIndex(); const entry = enemy(b, { x: 7 });
  advance(b, .7); assert.deepEqual(outgoing(receipts, u).map(r => r.target), [entry]); near(far.hp, far.s.maxHp);
});
test('S3 pulses use current ground membership, ignore block count and ASPD, and reserve air for the burst', () => {
  const { b, u, receipts } = make({ skill: 2 }), old = enemy(b), air = enemy(b, { fly: true });
  b.addBuff(u, { key: 'test:mods', mods: { aspd: 300, blockCnt: -9 } }); cast(b, u); advanceTo(b, 1.05);
  old.x = 10; b._buildEnemyIndex(); const es = Array.from({ length: 5 }, () => enemy(b)); advanceTo(b, 2.05);
  assert.equal(outgoing(receipts, u).filter(r => r.target === old).length, 1); assert.equal(outgoing(receipts, u).length, 6);
  advanceTo(b, 9.05); assert.equal(outgoing(receipts, u).filter(r => r.target === air).length, 1);
  for (const e of es) assert.equal(outgoing(receipts, u).filter(r => r.target === e).length, 8);
});
for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) test(`${dir}: S3 burst uses forward 3x3 grid and original end clip without extra hits`, () => {
  const { b, u, receipts } = make({ skill: 2, dir });
  const [dx, dy] = { RIGHT: [1, 0], LEFT: [-1, 0], UP: [0, 1], DOWN: [0, -1] }[dir];
  const e = enemy(b, { x: 5 + 2 * dx, y: 5 + 2 * dy, fly: true }), behind = enemy(b, { x: 5 - dx, y: 5 - dy, fly: true });
  const hidden = enemy(b, { x: e.x, y: e.y, fly: true }); b.addBuff(hidden, { key: 'test:hidden', flags: { untargetable: true } });
  cast(b, u); advanceTo(b, 7.05); assert.ok(u.mem.regularFormVisual.clip.includes(dir === 'UP' ? 'Skill_2_End' : 'End'));
  advanceTo(b, 9.05); assert.deepEqual(outgoing(receipts, u).map(r => r.target), [e]); near(behind.hp, behind.s.maxHp); near(hidden.hp, hidden.s.maxHp);
  advanceTo(b, 10.05); assert.equal(outgoing(receipts, u).length, 1); assert.equal(u.mem.regularFormVisual, null);
});
test('S3 never emits ordinary attacks alongside its independent maintained clock', () => {
  const { b, u, receipts } = make({ skill: 2 }); enemy(b); delete u.profile.canAttack; u.atkCd = 0;
  cast(b, u); advanceTo(b, 9.1); assert.equal(outgoing(receipts, u).length, 9); near(u.skill.spTotal, 0);
});
test('S3 reads current outside stats, applies native self loss first and then samples maximum ATK', () => {
  const { b, u, receipts } = make({ skill: 2 }); enemy(b, { x: 7, fly: true }); const base = u.s.atk;
  cast(b, u); advanceTo(b, 8.1); b.addBuff(u, { key: 'test:outside', mods: { atkPct: .5, hpPct: .2 } });
  const max = u.s.maxHp, before = u.hp; advanceTo(b, 9.05); near(before - u.hp, max * .25);
  near(outgoing(receipts, u)[0].amount, base * 2.3 * 4);
  const cost = receipts.find(r => r.source === u && r.target === u); assert.ok(cost);
  assert.ok(receipts.indexOf(cost) < receipts.findIndex(r => r.target.side === 'enemy')); assert.equal(Boolean(cost.dmg.hpLoss), false);
});
for (const refusal of ['shield', 'dodge', 'invulnerable', 'reduction']) test(`S3 native self loss bypasses ${refusal}`, () => {
  const { b, u } = make({ skill: 2 }); cast(b, u);
  if (refusal === 'shield') b.addBuff(u, { key: 'test:refusal', shieldHits: 3 });
  else if (refusal === 'dodge') b.addBuff(u, { key: 'test:refusal', mods: { dodgePhys: 1 } });
  else if (refusal === 'invulnerable') b.addBuff(u, { key: 'test:refusal', flags: { invulnerable: true } });
  else b.addBuff(u, { key: 'test:refusal', mods: { trueTakenMul: 0 } });
  const hp = u.hp; advanceTo(b, 9.05); near(hp - u.hp, u.s.maxHp * .25);
  if (refusal === 'shield') assert.equal(u.findBuff('test:refusal').shieldHits, 3);
});
test('S3 self loss can trigger unused healing, but remains nonlethal when the heal is refused', () => {
  for (const refuse of [false, true]) {
    const { b, u } = make({ skill: 2 }); cast(b, u); advanceTo(b, 8.9);
    if (refuse) b.addBuff(u, { key: 'test:no-heal', flags: { healFree: true } });
    u.hp = u.s.maxHp * .3; advanceTo(b, 9.05); near(u.hp, u.s.maxHp * (refuse ? .05 : .55));
    assert.equal(u.mem.blazeUsed, true);
  }
  const { b, u } = make({ skill: 2 }); cast(b, u); advanceTo(b, 8.9); u.mem.blazeUsed = true;
  b.removeBuff(u, 'blaze:undead'); u.hp = .5; advanceTo(b, 9.05); near(u.hp, .5); assert.equal(u.alive, true);
});
for (const status of ['stun', 'freeze', 'sleep']) test(`S3 brief accepted ${status} invalidates later slices and finisher without refund`, () => {
  const { b, u, receipts } = make({ skill: 2 }); enemy(b); cast(b, u); advanceTo(b, 1.1);
  const hp = u.hp; b.applyStatus(u, status, { duration: .01 }); advanceTo(b, 10.1);
  assert.equal(outgoing(receipts, u).length, 1); near(u.hp, hp); assert.equal(u.skill.active, false);
  assert.equal(u.mem.regularFormVisual, null); assert.equal(u.findBuff('blaze:ramp'), null);
});
for (const moment of [1.1, 7.1, 8.9]) for (const action of ['end', 'retreat', 'death'])
  test(`S3 ${action} at ${moment}s removes future damage, self cost and stale visual callbacks`, () => {
    const { b, u, receipts } = make({ skill: 2 }); enemy(b); cast(b, u); advanceTo(b, moment);
    if (action === 'end') u.skill.end('test'); else if (action === 'retreat') b.retreat(u); else b.kill(u);
    const hp = u.hp, hits = outgoing(receipts, u).length; advanceTo(b, 12);
    near(u.hp, hp); assert.equal(outgoing(receipts, u).length, hits); assert.equal(u.mem.regularFormVisual, null);
    assert.equal(u.findBuff('blaze:ramp'), null);
  });
