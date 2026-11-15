// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { readStageOutcomes } from '../server/sim/content/arkpedia-stage-outcomes.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
const id = 'enemy_2069_skzbox', record = ENEMY_RECORDS.enemies[id].levels[0];
function fixture(tile = 'tile_end') {
  const { b } = makeBattle({ content: 'none', timeLimit: 100, autoFinish: false, setup: installEnemyFeatures,
    defs: { enemies: { [id]: record } } });
  b.start(); b.grid.setTile(10, 5, { ...b.grid.tile(10, 5), key: tile });
  const enemy = b.spawnEnemy(id, { pos: [10, 5] });
  return { b, enemy };
}
test('Lost Contraption records objective theft once, without treating zero-life loss as no event', () => {
  const { b, enemy } = fixture(); b.applyStatus(enemy, 'silence', { duration: 30 });
  b.leak(enemy); b.leak(enemy);
  const outcomes = readStageOutcomes(b);
  assert.deepEqual(outcomes.counters, { rogue_thief_reach_exit: 1 });
  assert.equal(outcomes.events.length, 1); assert.equal(outcomes.events[0].enemy, id);
  assert.equal(b.killed, 0); assert.deepEqual(b.errors, []);
});
test('killing the contraption uses the native blackboard counter and never also steals', () => {
  const { b, enemy } = fixture(); b.applyStatus(enemy, 'silence', { duration: 30 });
  b.kill(enemy, null); b.leak(enemy); b.kill(enemy, null);
  assert.deepEqual(readStageOutcomes(b).counters, { trap_758_skzmbx: 1 });
  assert.equal(b.killed, 1); assert.deepEqual(b.errors, []);
});
test('non-objective exits and non-kill removal produce no run outcome', () => {
  for (const tile of ['tile_start', 'tile_end_y', 'tile_floor']) {
    const { b, enemy } = fixture(tile); b.leak(enemy); assert.deepEqual(readStageOutcomes(b).events, []);
  }
  const { b, enemy } = fixture(); b._remove(enemy, 'expired');
  assert.deepEqual(readStageOutcomes(b).events, []);
});
test('stage results return isolated counters and event snapshots, including after battle completion', () => {
  const data = { ...mvp, enemies: { ...mvp.enemies, [id]: record } };
  const selection = { operators: [defaultBuild(mvp.operators.char_123_fang)] };
  const b = new StandardBattle(data, selection);
  const enemy = b.spawnEnemy(id, { pos: [b.rect.r0, b.rect.c0] });
  b.kill(enemy, null); b._finish('cleared');
  const result = b.result(); assert.deepEqual(result.stageOutcomes.counters, { trap_758_skzmbx: 1 });
  result.stageOutcomes.counters.trap_758_skzmbx = 99; result.stageOutcomes.events[0].key = 'changed';
  assert.equal(b.result().stageOutcomes.events[0].key, 'trap_758_skzmbx');
  assert.equal(b.result().stageOutcomes.counters.trap_758_skzmbx, 1);
  assert.deepEqual(new StandardBattle(data, selection).result().stageOutcomes, { counters: {}, events: [] });
});
test('all three database levels require the exact native event filters, keys, buffs and combat', () => {
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, native).policy);
  for (const mutation of ['exitReason', 'tile', 'counter', 'silence', 'attributes', 'combat', 'extraAbility']) {
    const evidence = structuredClone(native);
    const actions = evidence.templates.log_thief_reach_exit.eventToActions.ON_OWNER_FINISH;
    if (mutation === 'exitReason') actions[0]._finishReason = 'KILLED';
    if (mutation === 'tile') actions[1]._isExclude = true;
    if (mutation === 'counter') actions[2]._additionValue = 2;
    for (const row of evidence.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) {
      const d = JSON.parse(row.originalJson);
      if (row.objectName === 'LogKilled') {
        if (mutation === 'silence') d._buffs[2].isSilenceable = 1;
        if (mutation === 'attributes') d._buffs[0].attributes.abnormalFlags.push(1);
      }
      if (mutation === 'combat' && row.objectName === 'Combat') d._atkScale = 2;
      if (mutation === 'extraAbility' && row.objectName === id) d._commonAbilities.push(d._commonAbilities[0]);
      row.originalJson = JSON.stringify(d);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, evidence).policy, null, mutation);
  }
});
test('Window releases immediate Arts attacks, including while blocked, and records kills independently of its birth visual', () => {
  const windowId = 'enemy_2091_skzgds', windowRecord = ENEMY_RECORDS.enemies[windowId].levels[0];
  const op = chessRec({ id: 'window_target', stats: { maxHp: 100000, atk: 0, def: 10000, magicResistance: 0 } });
  const h = makeBattle({ content: 'none', timeLimit: 100, autoFinish: false, setup: installEnemyFeatures,
    defs: { enemies: { [windowId]: windowRecord }, chess: { [op.chessId]: op } },
    units: [{ chessId: op.chessId, row: 10, col: 6 }] });
  const b = h.b; b.start(); const enemy = b.spawnEnemy(windowId, { pos: [10, 5] });
  b.addBuff(enemy, { key: 'hold', flags: { noMove: true } });
  const attacks = [], hits = [];
  b.on('attack', c => { if (c.attacker === enemy) attacks.push(b.time); });
  b.on('hit', c => { if (c.source === enemy) hits.push({ time: b.time, ...c.dmg }); });
  h.runUntil(() => hits.length >= 2, 9);
  assert.ok(hits.length >= 2, 'the ten-second visual does not prevent attacks');
  assert.equal(hits.length, attacks.length); assert.deepEqual(hits.map(hit => hit.time), attacks);
  assert.ok(hits.every(hit => hit.type === 'arts' && hit.amount === windowRecord.stats.atk && hit.applyWay === 'ranged'));
  assert.equal(b.projectiles.list.length, 0);
  b.kill(enemy, null); assert.deepEqual(readStageOutcomes(b).counters, { killed: 1 });
  assert.equal(readStageOutcomes(b).events[0].enemy, windowId); assert.deepEqual(b.errors, []);
});
test('Window requires native immediate-hit transport; another talent named 1 cannot inherit the behavior', () => {
  const windowId = 'enemy_2091_skzgds', entry = ENEMY_RECORDS.enemies[windowId];
  assert.ok(enemySupport(entry, clocks.prefabs, native).policy);
  for (const mutation of ['delay', 'extraHit', 'buff', 'talent', 'leakLog']) {
    const evidence = structuredClone(native), records = structuredClone(entry);
    for (const row of evidence.projectiles.projectile_enemy_skzgds) {
      const d = JSON.parse(row.originalJson);
      if (mutation === 'delay' && '_immediatelyReach' in d) d._delayToStart = 1;
      if (mutation === 'extraHit' && '_maxHitNum' in d) d._maxHitNum = 2;
      row.originalJson = JSON.stringify(d);
    }
    if (mutation === 'buff') for (const row of evidence.prefabs[`dyn/battle/prefabs/enemies/${windowId}.prefab`]) {
      const d = JSON.parse(row.originalJson); if (row.objectName === 'Combat') d._activeBuffs.push({ buffKey: 'stun' });
      row.originalJson = JSON.stringify(d);
    }
    if (mutation === 'talent') records.levels[0].talents.bb['1.effect_duration'] = 11;
    if (mutation === 'leakLog') evidence.templates.log_killed.eventToActions.ON_OWNER_FINISH = evidence.templates.log_killed.eventToActions.ON_OWNER_KILLED;
    assert.equal(enemySupport(records, clocks.prefabs, evidence).policy, null, mutation);
  }
});
