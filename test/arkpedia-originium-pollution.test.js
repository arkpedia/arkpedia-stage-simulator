// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { registerOriginiumPollution, syncOriginiumPollution, pollutionDamageAllowed } from '../server/sim/content/arkpedia-originium-pollution.js';
import { applyStageEnemyBlackboard } from '../shared/arkpedia/stage-enemy-talents.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ID = 'enemy_1425_lrcmra';
function fixture() {
  const guard = chessRec({ id: 'pollution_target', stats: { maxHp: 1e6, atk: 0 } });
  const record = applyStageEnemyBlackboard(ENEMY_RECORDS.enemies[ID].levels[0], { level: 0,
    blackboard: [{ key: 'OrigAura.damage', value: 100 }, { key: 'AtkBoost.atk', value: 400 }] });
  record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120, defs: { enemies: { [ID]: record }, chess: { [guard.chessId]: guard } },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  const b = h.b; b.start(); const u = b.allyUnits[0];
  b.addBuff(u, { key: 'stationary', flags: { noMove: true, noBlock: true, disarm: true } });
  const e = b.spawnEnemy(ID, { pos: [9, 7] }); e.profile.noAttack = true;
  const hits = []; b.on('damaged', c => hits.push(c));
  return { h, b, e, u, hits };
}
test('Chimera transformation latches, locks movement and attacks, then adds flat ATK and an aura', () => {
  const { h, b, e, u, hits } = fixture();
  const remove = registerOriginiumPollution(b, { id: 'trigger', kind: 'tile', damage: 0, spRatio: -.8, interval: 1, contains: x => x === e });
  h.run(.51); assert.equal(e.s.flags.disarm, true); assert.equal(e.s.flags.noMove, true);
  assert.equal(e.s.atk, 800); assert.equal(u.findBuff('ab:originium'), null);
  remove(); h.run(1.7); assert.equal(e.s.atk, 800);
  h.run(.2); assert.equal(e.s.atk, 1200); assert.equal(e.mem.ab.atkType, 'arts');
  assert.equal(!!e.s.flags.disarm, false); assert.ok(u.findBuff('ab:originium'));
  assert.ok(Math.abs(u.s.spRecovery - .2) < 1e-9);
  h.run(.55); assert.ok(hits.some(c => c.target === u && c.hpLoss === 100 && c.source === null && c.dmg.noSp && c.dmg.isEnvironment));
  e.x = 10; h.step(); assert.equal(u.findBuff('ab:originium'), null); assert.equal(u.s.spRecovery, 1);
  assert.equal(e.s.atk, 1200); assert.equal(e.mem.ab.atkType, 'arts'); assert.deepEqual(b.errors, []);
});
test('Chimera cast interruption finishes the mode switch and its aura vanishes when the source dies', () => {
  const { h, b, e, u } = fixture();
  registerOriginiumPollution(b, { id: 'trigger', kind: 'tile', damage: 0, spRatio: -.8, interval: 1, contains: x => x === e });
  h.run(.51); b.applyStatus(e, 'stun', { duration: 2 });
  assert.equal(e.s.atk, 1200); assert.ok(u.findBuff('ab:originium'));
  b.kill(e); assert.equal(u.findBuff('ab:originium'), null); assert.equal(u.s.spRecovery, 1);
  assert.deepEqual(b.errors, []);
});
test('multiple sources use one clock per family and one additive SP penalty, with live fallback', () => {
  const { h, b, u, hits } = fixture();
  b.addBuff(u, { key: 'spTalent', mods: { spRecoveryFlat: .5 } });
  const weak = registerOriginiumPollution(b, { id: 'weak', kind: 'chimera', damage: 50, spRatio: -.8, interval: .5, contains: x => x === u });
  const strong = registerOriginiumPollution(b, { id: 'strong', kind: 'chimera', damage: 100, spRatio: -.8, interval: .5, contains: x => x === u });
  registerOriginiumPollution(b, { id: 'tile', kind: 'tile', damage: 50, spRatio: -.8, interval: 1, contains: x => x === u });
  assert.ok(Math.abs(u.s.spRecovery - .7) < 1e-9);
  h.run(1.01); assert.deepEqual(hits.filter(c => c.target === u).map(c => c.hpLoss), [100, 100]);
  const buff = u.findBuff('ab:originium'); strong(); assert.equal(u.findBuff('ab:originium'), buff);
  h.run(.5); assert.equal(hits.filter(c => c.target === u).at(-1).hpLoss, 50);
  weak(); assert.equal(u.findBuff('ab:originium'), null); assert.ok(u.findBuff('device:pollution'));
  assert.ok(Math.abs(u.s.spRecovery - .7) < 1e-9); assert.deepEqual(b.errors, []);
});
test('pollution comparisons retain native branch order and tie rules', () => {
  assert.equal(pollutionDamageAllowed('chimera', 50, { tile: 50 }), true);
  assert.equal(pollutionDamageAllowed('tile', 50, { chimera: 50 }), false);
  assert.equal(pollutionDamageAllowed('storm', 50, { chimera: 50 }), false);
  assert.equal(pollutionDamageAllowed('storm', 50, { tile: 50 }), true);
  assert.equal(pollutionDamageAllowed('tile', 50, { storm: 50 }), false);
  assert.equal(pollutionDamageAllowed('chimera', 50, { storm: 60, tile: 25 }), false);
});
test('aura reaches nearby enemies to trigger another Chimera, but excludes flying and hidden opponents', () => {
  const { h, b, e, u } = fixture();
  registerOriginiumPollution(b, { id: 'trigger', kind: 'tile', damage: 0, spRatio: -.8, interval: 1, contains: x => x === e });
  h.run(2.5); const other = b.spawnEnemy(ID, { pos: [9, 7.5] }); other.profile.noAttack = true;
  h.run(2.6); assert.equal(other.mem.ab.atkType, 'arts');
  u.motion = 'FLY'; syncOriginiumPollution(b); assert.equal(u.findBuff('ab:originium'), null);
  u.motion = 'WALK'; b.addBuff(u, { key: 'stealth', flags: { stealth: true } }); syncOriginiumPollution(b);
  assert.equal(u.findBuff('ab:originium'), null); b.removeBuff(u, 'stealth'); syncOriginiumPollution(b); assert.ok(u.findBuff('ab:originium'));
  assert.deepEqual(b.errors, []);
});
test('native Chimera admission rejects changed shape, mode damage, bonus type and environment damage flags', () => {
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[ID], index.prefabs, evidence).policy);
  for (const change of ['shape', 'attack', 'bonus', 'environment']) {
    const d = structuredClone(evidence);
    if (change === 'environment') {
      const text = JSON.stringify(d.templates['enemy_lrcmra[originum][dmg]']).replaceAll('"_isEnvDamage":true', '"_isEnvDamage":false');
      d.templates['enemy_lrcmra[originum][dmg]'] = JSON.parse(text);
    } else for (const row of d.prefabs[`dyn/battle/prefabs/enemies/${ID}.prefab`]) {
      const c = JSON.parse(row.originalJson);
      if (change === 'shape' && 'm_Radius' in c) c.m_Radius = 2;
      if (change === 'attack' && row.objectName === 'Combat') c._damageType = 1;
      if (change === 'bonus' && row.objectName === 'AtkBoost' && c._buffs) c._buffs[0].attributes.attributeModifiers[0].formulaItem = 1;
      row.originalJson = JSON.stringify(c);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ID], index.prefabs, d).policy, null, change);
  }
});

test('storm grows only after consuming pollution tiles and approaches the new radius gradually', () => {
  const id = 'enemy_1420_lrmm', record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, units: [], defs: { enemies: { [id]: record } }, setup: installEnemyFeatures });
  const b = h.b; b.start(); const e = b.spawnEnemy(id, { pos: [9, 8] }), a = e.mem.ab.list.find(a => a.storm);
  const bb = record.talents.bb, initial = bb['StormAura.range_radius'];
  h.run(2); assert.equal(a.r, initial); assert.equal(a.d, bb['StormAura.damage']);
  b.mvpStagePollution = new Set(['9,8', '9,12']); h.run(1.01);
  assert.equal(b.mvpStagePollution.has('9,8'), false); assert.equal(b.mvpStagePollution.has('9,12'), true);
  assert.equal(a.d, bb['StormAura.damage'] + bb['StormAura.damage_step']);
  assert.equal(a.targetR, initial + bb['StormAura.radius_step']); assert.ok(a.r < a.targetR);
  h.run(1); assert.equal(a.r, a.targetR); const value = a.d; h.run(2); assert.equal(a.d, value);
  assert.deepEqual(b.errors, []);
});
test('a storm consumes an entering Originium Slug once and boosts only its own source', () => {
  const ids = ['enemy_1420_lrmm', 'enemy_1424_lrboom'];
  const enemies = Object.fromEntries(ids.map(id => { const r = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); r.stats.moveSpeed = 0; return [id, r]; }));
  const h = makeBattle({ content: 'none', autoFinish: false, units: [], defs: { enemies }, setup: installEnemyFeatures });
  const b = h.b; b.start();
  const e = b.spawnEnemy(ids[0], { pos: [9, 8] }), distant = b.spawnEnemy(ids[0], { pos: [9, 12] });
  const a = e.mem.ab.list.find(a => a.storm), other = distant.mem.ab.list.find(a => a.storm), before = a.d;
  const slug = b.spawnEnemy(ids[1], { pos: [9, 8.3] }); h.step();
  assert.equal(slug.alive, false); assert.equal(slug.mem.suppressOriginiumTile, true);
  assert.equal(a.d, before + enemies[ids[0]].talents.bb['StormAura.damage_step']); assert.equal(other.d, before);
  h.run(2); assert.equal(a.d, before + enemies[ids[0]].talents.bb['StormAura.damage_step']); assert.deepEqual(b.errors, []);
});

test('Storm is invulnerable, non-attacking and follows the newest Beacon tile on its two-second trace clock', () => {
  const storm = 'enemy_1420_lrmm', beacon = 'enemy_1421_lrchld';
  const h = makeBattle({ content: 'none', autoFinish: false, units: [],
    defs: { enemies: Object.fromEntries([storm, beacon].map(id => [id, ENEMY_RECORDS.enemies[id].levels[0]])) }, setup: installEnemyFeatures });
  const b = h.b; b.start(); const e = b.spawnEnemy(storm, { pos: [10, 6] });
  e.route = { legs: [{ t: 'wait', time: Infinity }], legIdx: 0, pts: null, ptIdx: 0, waitLeft: null, version: -1 };
  const old = b.spawnEnemy(beacon, { pos: [10, 8] }), newest = b.spawnEnemy(beacon, { pos: [10, 3] });
  const hp = e.hp; b.dealDamage(null, e, { amount: 1e6, type: 'true' }); assert.equal(e.hp, hp);
  assert.equal(e.s.flags.unblockable, true); assert.equal(e.s.flags.healFree, true); assert.equal(e.profile.noAttack, true);
  for (const status of ['cold', 'disarm', 'stun', 'freeze', 'sleep']) assert.equal(b.applyStatus(e, status, { duration: 10 }), false);
  h.run(1.9); assert.equal(e.mem.storm.target, undefined); assert.equal(e.x, 6);
  h.run(.2); assert.equal(e.mem.storm.target, newest.id); assert.ok(e.x < 6);
  const x = e.x; b._remove(newest, 'pickup'); h.run(2); assert.equal(e.mem.storm.target, old.id); assert.ok(e.x < x);
  const at = e.x; h.run(1); assert.ok(e.x > at);
  b.leak(e); assert.ok(e.alive); assert.deepEqual(b.errors, []);
});
