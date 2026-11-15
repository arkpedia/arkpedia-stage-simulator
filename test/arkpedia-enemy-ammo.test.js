// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import { enemyAmmo } from '../server/sim/content/arkpedia-enemy-ammo.js';
import { applyStageEnemyTalentMultipliers } from '../shared/arkpedia/stage-enemy-talents.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { CapturableStageDevices } from '../server/sim/content/arkpedia-stage-capturable-devices.js';
const IDS = ['enemy_1213_mtrsnp', 'enemy_1213_mtrsnp_2', 'enemy_1214_mtrmgc', 'enemy_1214_mtrmgc_2'];
function fixture(id, override = null) {
  const target = chessRec({ id: 'ammo_target', stats: { atk: 0, maxHp: 1e6, def: 100, res: 20 } });
  const record = structuredClone(override ?? ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, captureNoisy: true,
    defs: { chess: { [target.chessId]: target }, enemies: { [id]: record } },
    units: [{ chessId: target.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  const b = h.b; b.start(); const u = b.allyUnits[0];
  b.addBuff(u, { key: 'target', flags: { disarm: true, noBlock: true, noMove: true } });
  const e = b.spawnEnemy(id, { pos: [9, 7] });
  return { h, b, u, e };
}
function hits(h, e, type) { return h.hooksOf('damaged').filter(c => c.source === e && (!type || c.dmg.type === type)); }

test('Nuncio spends one Arts shot, applies the source compound status and attacks only in melee until reloaded', () => {
  for (const id of ['enemy_1219_mtrbty', 'enemy_1219_mtrbty_2']) {
    const { h, b, u, e } = fixture(id);
    b.applyStatus(e, 'silence', { duration: 30 });
    assert.ok(h.runUntil(() => e.stats.attacks === 1, 3)); h.run(.4);
    assert.equal(u.stats.taken, e.s.atk * 1.5 * .8);
    assert.equal(e.mem.enemyAmmo.current, 0);
    assert.equal(u.s.flags.silence, true); assert.equal(u.findBuff('disarmed').status, 'disarm');
    assert.ok(u.findBuff('disarmed').timeLeft > (id.endsWith('_2') ? 9 : 14));
    h.run(4); assert.equal(e.stats.attacks, 1, 'empty Nuncio has no ranged attack');
    b.removeBuff(u, 'disarmed'); assert.equal(u.findBuff('disarmed:silence'), null);
    b.removeBuff(u, 'target'); b.addBuff(u, { key: 'test:block', flags: { disarm: true } });
    e.x = u.x + .3; e.y = u.y;
    assert.ok(h.runUntil(() => e.stats.attacks === 2, 5));
    assert.equal(hits(h, e, 'arts').at(-1).dmg.applyWay, 'melee');
    assert.equal(u.findBuff('disarmed'), null);
    e.mem.enemyAmmo.modify(1);
    assert.ok(h.runUntil(() => e.stats.attacks === 3, 5)); h.run(.4);
    assert.equal(e.mem.enemyAmmo.current, 0); assert.ok(u.findBuff('disarmed'));
    assert.deepEqual(b.errors, []);
  }
});

test('Nuncio status is missable, survives shields and source death, and its compound lifetime respects resistance', () => {
  for (const condition of ['dodge', 'shield', 'sourceDeath', 'resist']) {
    const { h, b, u, e } = fixture('enemy_1219_mtrbty');
    if (condition === 'dodge') b.addBuff(u, { key: 'test:dodge', mods: { dodgeArts: 1 } });
    if (condition === 'shield') b.addBuff(u, { key: 'test:shield', shield: 1e6 });
    if (condition === 'resist') b.applyStatus(u, 'resist', { value: .5, duration: 30 });
    assert.ok(h.runUntil(() => e.stats.attacks === 1, 3));
    if (condition === 'sourceDeath') b.kill(e);
    h.run(.4);
    assert.equal(!!u.findBuff('disarmed'), condition !== 'dodge', condition);
    assert.equal(!!u.s.flags.silence, condition !== 'dodge', condition);
    if (condition === 'shield') assert.equal(u.stats.taken, 0);
    if (condition === 'resist') assert.ok(u.findBuff('disarmed').timeLeft < 7.5 && u.findBuff('disarmed').timeLeft > 7);
    if (condition !== 'dodge') { b.removeBuff(u, 'disarmed:silence'); assert.equal(u.findBuff('disarmed'), null); }
    assert.deepEqual(b.errors, []);
  }
});

test('reloaded Nuncio prioritizes a recipient without its debuff and hits a real Gelato Stop through shared tagged damage', () => {
  const { h, b, u, e } = fixture('enemy_1219_mtrbty');
  const devices = new CapturableStageDevices(b, [{ key: 'trap_057_wpnsts', name: "'Gelato Stop'", hidden: false,
    row: 10, col: 6, instance: { level: 1, skillIndex: 0, skillLevel: 1 } }]);
  const station = [...devices.entries.values()][0].unit;
  assert.ok(h.runUntil(() => e.stats.attacks === 1, 3)); h.run(.4);
  assert.ok(u.findBuff('disarmed')); assert.equal(station.stats.taken, 0);
  e.mem.enemyAmmo.modify(1);
  assert.ok(h.runUntil(() => e.stats.attacks === 2, 4)); h.run(.4);
  assert.equal(station.stats.taken, e.s.atk * 1.5 + 5000);
  assert.equal(station.findBuff('disarmed'), null); assert.equal(station.s.flags.silence, undefined);
  assert.deepEqual(b.errors, []);
});

test('Nuncio native admission rejects a changed database status or missability', () => {
  for (const mutate of [
    n => { n.buffDatabase.disarmed_and_cant_use_skill.attributes.abnormalFlags = ['DISARMED']; },
    n => { n.buffDatabase.disarmed_and_cant_use_skill.isDamageMissable = false; },
  ]) {
    const n = structuredClone(native); mutate(n);
    assert.equal(enemySupport(ENEMY_RECORDS.enemies.enemy_1219_mtrbty, clock.prefabs, n).policy, null);
  }
});

test('Pathfinder ammo is spent once under Silence; subsequent shots and capped reload use independent payloads', () => {
  for (const id of IDS) {
    const { h, b, u, e } = fixture(id), phys = id.startsWith('enemy_1213');
    b.applyStatus(e, 'silence', { duration: 20 });
    assert.equal(e.mem.enemyAmmo.current, 1);
    assert.ok(h.runUntil(() => e.stats.attacks === 1, 3)); assert.equal(e.mem.enemyAmmo.current, 0);
    assert.equal(u.stats.taken, 0, 'projectile travels before hitting'); h.run(.4);
    const first = phys ? e.s.atk * 2 - 100 : e.s.atk * .8;
    assert.equal(u.stats.taken, first);
    assert.equal(hits(h, e, 'element').length, phys ? 0 : 1);
    if (!phys) assert.equal(hits(h, e, 'element')[0].dmg.amount, e.s.atk * 1.5);
    assert.ok(h.runUntil(() => e.stats.attacks === 2, 4)); h.run(.4);
    assert.equal(u.stats.taken, first + (phys ? e.s.atk - 100 : e.s.atk * .8));
    assert.equal(hits(h, e, 'element').length, phys ? 0 : 1);
    assert.equal(e.mem.enemyAmmo.modify(99), 1);
    assert.ok(h.runUntil(() => e.stats.attacks === 3, 4)); h.run(.4);
    assert.equal(e.mem.enemyAmmo.current, 0); assert.equal(hits(h, e, 'element').length, phys ? 0 : 2);
    assert.deepEqual(b.errors, []);
  }
});

test('Artifex elemental payload honors dodge, survives shield absorption and remains attached after source death', () => {
  for (const condition of ['dodge', 'shield', 'sourceDeath']) {
    const { h, b, u, e } = fixture('enemy_1214_mtrmgc');
    if (condition === 'dodge') b.addBuff(u, { key: 'dodge', mods: { dodgeArts: 1 } });
    if (condition === 'shield') b.addBuff(u, { key: 'shield', shield: 100000 });
    assert.ok(h.runUntil(() => e.stats.attacks === 1, 3));
    if (condition === 'sourceDeath') b.kill(e);
    h.run(.4);
    assert.equal(hits(h, e, 'element').length, condition === 'dodge' ? 0 : 1, condition);
    if (condition !== 'sourceDeath') assert.equal(u.stats.taken, 0, condition);
    assert.equal(e.mem.enemyAmmo.current, 0); assert.deepEqual(b.errors, []);
    assert.equal(b._hooks.calculatedDamage?.length ?? 0, 0, 'temporary receipt hook is removed');
  }
});

test('ammo requires a valid ground attack; empty Sagittarius switches to direct melee when blocked', () => {
  const { h, b, u, e } = fixture('enemy_1213_mtrsnp');
  b.addBuff(u, { key: 'air', flags: { liftoff: true } }); h.run(2);
  assert.equal(e.stats.attacks, 0); assert.equal(e.mem.enemyAmmo.current, 1);
  b.removeBuff(u, 'air'); b.applyStatus(e, 'stun', { duration: 2 }); h.run(1);
  assert.equal(e.mem.enemyAmmo.current, 1);
  assert.ok(h.runUntil(() => e.stats.attacks === 1, 4)); h.run(.4);
  b.removeBuff(u, 'target');
  b.addBuff(u, { key: 'blockingTarget', flags: { disarm: true, noMove: true } });
  e.x = u.x + .3; e.y = u.y; e.tileR = u.tileR; e.tileC = u.tileC;
  assert.ok(h.runUntil(() => e.stats.attacks === 2, 4));
  assert.equal(b.projectiles.list.length, 0);
  assert.equal(hits(h, e, 'phys').at(-1).dmg.applyWay, 'melee');
  assert.deepEqual(b.errors, []);
});

test('ammo accounts clamp adjustments and reject non-finite reload values', () => {
  const a = enemyAmmo(3, 1); assert.equal(a.modify(10), 2); assert.equal(a.current, 3);
  assert.equal(a.modify(-10), -3); assert.equal(a.current, 0);
  assert.throws(() => a.modify(NaN), /Invalid/); assert.equal(a.current, 0);
});

test('stage ammunition damage scaling is local and cannot alter expenditure or capacity', () => {
  const id = IDS[1], original = ENEMY_RECORDS.enemies[id].levels[0];
  const scaled = applyStageEnemyTalentMultipliers(original, { 'shotbuff.attack@headshot_atk_scale': 1.5 });
  assert.equal(original.talents.bb['shotbuff.attack@headshot_atk_scale'], 2);
  const { h, b, u, e } = fixture(id, scaled);
  h.runUntil(() => e.stats.attacks === 1, 3); h.run(.4);
  assert.equal(u.stats.taken, e.s.atk * 3 - 100); assert.equal(e.mem.enemyAmmo.current, 0);
  assert.throws(() => applyStageEnemyTalentMultipliers(original, { 'shotbuff.attack@headshot_sp': 2 }), /Unsupported/);
  assert.deepEqual(b.errors, []);
});

test('Pathfinder admission checks native mode, ground selector, expenditure and projectile lifetime', () => {
  for (const id of IDS) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, native).policy, id);
  for (const change of ['template', 'motion', 'spent', 'lifetime']) {
    const n = structuredClone(native), id = IDS[0];
    if (change === 'template') n.templates.enemy_spmode_check.eventToActions.ON_BEFORE_ATTACK[0]._conditionNode._checkHasSp = 2;
    if (change === 'lifetime') {
      const row = n.projectiles.projectile_enemy_mtrsnp_headshot.find(c => '_lifeTime' in JSON.parse(c.originalJson));
      const d = JSON.parse(row.originalJson); d._lifeTime = 10; row.originalJson = JSON.stringify(d);
    }
    for (const row of n.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) {
      const d = JSON.parse(row.originalJson);
      if (change === 'motion' && '_targetMotion' in d) d._targetMotion = 3;
      if (change === 'spent' && '_runActionOnEvent' in d) d._runActionOnEvent = 3;
      row.originalJson = JSON.stringify(d);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, n).policy, null, change);
  }
});

test('Ballistarius spends two shells, splashes nearby allies and resumes melee-only behavior until reloaded', () => {
  for (const id of ['enemy_1216_cansld', 'enemy_1216_cansld_2']) {
    const { h, b, u, e } = fixture(id);
    const nearby = b.spawnDevice('nearby-building', 10, 6, { hp: 100000, def: 100, res: 20, blockCnt: 0 });
    nearby.profile.enemyTargetableDevice = true; nearby.tags.add('TAG_TRAP_WPNSTS');
    const outside = b.spawnDevice('outside-building', 12, 6, { hp: 100000, blockCnt: 0 });
    outside.profile.enemyTargetableDevice = true; outside.tags.add('TAG_TRAP_WPNSTS');
    // Ensure the normal operator remains the locked primary target.
    u.aggroSeq = outside.aggroSeq + 1;
    b.applyStatus(e, 'silence', { duration: 30 });
    assert.ok(h.runUntil(() => e.stats.attacks === 1, 3)); assert.equal(e.mem.enemyAmmo.current, 1); h.run(.7);
    const scale = ENEMY_RECORDS.enemies[id].levels[0].talents.bb['shotbuff.attack@headshot_atk_scale'];
    assert.equal(u.stats.taken, e.s.atk * scale - 100);
    const fixed = ENEMY_RECORDS.enemies[id].levels[0].talents.bb['shotbuff.attack@headshot_trapdamage'];
    assert.equal(nearby.stats.taken, e.s.atk * scale - 100 + fixed * .8); assert.equal(outside.stats.taken, 0);
    const bonus = hits(h, e, 'arts'); assert.equal(bonus.length, 1); assert.equal(bonus[0].dmg.noSp, true);
    assert.ok(h.runUntil(() => e.stats.attacks === 2, 6)); h.run(5);
    assert.equal(e.mem.enemyAmmo.current, 0); assert.equal(e.stats.attacks, 2); assert.equal(e.profile.melee, true);
    assert.equal(e.mem.enemyAmmo.modify(99), 2); h.run(.2); assert.equal(e.profile.melee, false);
    assert.ok(h.runUntil(() => e.stats.attacks === 3, 3)); assert.equal(e.mem.enemyAmmo.gained, 2);
    assert.deepEqual(b.errors, []);
  }
});

test('Ballistarius unmissable trap bonus is source-owned Arts and independent of physical evasion', () => {
  const { h, b, u, e } = fixture('enemy_1216_cansld');
  u.tags.add('TAG_TRAP_WPNSTS'); b.addBuff(u, { key: 'evade', mods: { dodgePhys: 1 } });
  h.runUntil(() => e.stats.attacks === 1, 3); b.kill(e); h.run(.7);
  assert.equal(u.stats.taken, 3000 * .8);
  assert.equal(hits(h, e, 'phys').length, 0); assert.equal(hits(h, e, 'arts').length, 1);
  assert.deepEqual(b.errors, []);
});

test('Ballistarius native admission refuses changed blast geometry or extra device damage actions', () => {
  const id = 'enemy_1216_cansld'; assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, native).policy);
  for (const change of ['blast', 'bonus', 'mode']) {
    const n = structuredClone(native);
    if (change === 'bonus') n.templates.enemy_fixed_value_damage_to_trap.eventToActions.ON_BUFF_START[1]._damageType = 'PURE';
    if (change === 'mode') n.templates.enemy_melee_and_ranged_spmode_check.eventToActions.ON_BUFF_TRIGGER[0]._failNodes[0]._conditionNode._checkHasSp = 2;
    if (change === 'blast') {
      const row = n.projectiles.projectile_enemy_cansld.find(c => 'm_Size' in JSON.parse(c.originalJson));
      const d = JSON.parse(row.originalJson); d.m_Size.x = 4; row.originalJson = JSON.stringify(d);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, n).policy, null, change);
  }
});

test('Veles prioritizes native Gelato tags and shares the independently unmissable Arts payload', () => {
  for (const id of ['enemy_1215_ptrarc', 'enemy_1215_ptrarc_2']) {
    assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, native).policy, id);
    const { h, b, u, e } = fixture(id);
    const stop = b.spawnDevice('station', 10, 6, { hp: 10000, blockCnt: 0, res: 20 });
    stop.profile.enemyTargetableDevice = true; stop.tags.add('TAG_TRAP_WPNSTS');
    b.addBuff(stop, { key: 'evade', mods: { dodgePhys: 1, taunt: -1 } });
    u.aggroSeq = stop.aggroSeq + 1; b.applyStatus(e, 'silence', { duration: 10 });
    assert.ok(h.runUntil(() => e.stats.attacks === 1, 3)); b.kill(e); h.run(.5);
    assert.equal(u.stats.taken, 0);
    assert.equal(stop.stats.taken, ENEMY_RECORDS.enemies[id].levels[0].talents.bb['shottrap.attack@trapdamage'] * .8);
    assert.equal(hits(h, e, 'arts').length, 1); assert.deepEqual(b.errors, []);
  }
});
