// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };

function fixture(id, block) {
  assert.ok(support.enemies[id].policy);
  const guard = chessRec({ id: 'capacity_guard', profession: 'TANK', stats: { maxHp: 100000, atk: 0, def: 0, blockCnt: block }, skill: null });
  const records = Object.fromEntries([id, 'enemy_1007_slime'].map(key => [key, structuredClone(ENEMY_RECORDS.enemies[key].levels[0])]));
  for (const record of Object.values(records)) record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 30, defs: { chess: { [guard.chessId]: guard }, enemies: records },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }], setup: b => installEnemyFeatures(b) });
  const b = h.b; b.start();
  const target = b.allyUnits[0]; b.addBuff(target, { key: 'fixture:stationary', flags: { noMove: true, disarm: true } });
  const spawn = key => b.spawnEnemy(key, { pos: [9, 6] });
  return { h, b, target, spawn };
}

for (const id of ['enemy_1058_traink', 'enemy_1058_traink_2']) test(`${id} consumes three FREE block slots and releases them on death`, () => {
  for (const block of [2, 3, 4, 6]) {
    const { h, b, target, spawn } = fixture(id, block);
    const small = spawn('enemy_1007_slime'); assert.equal(b._checkBlock(small), true);
    const first = spawn(id); b.applyStatus(first, 'silence', { duration: 30 });
    assert.equal(first.blockWeight, 3); assert.equal(b._checkBlock(first), block >= 4);
    b.kill(small, target); assert.equal(b._checkBlock(first), block >= 3);
    const second = spawn(id); assert.equal(b._checkBlock(second), block >= 6);
    if (block === 4) {
      b.kill(first, target); assert.equal(b._checkBlock(second), true);
      b.addBuff(target, { key: 'fixture:block-loss', mods: { blockCnt: -2 } }); h.run(.1);
      assert.equal(second.blockedBy, null);
    }
    assert.deepEqual(b.errors, []);
  }
});

for (const id of ['enemy_1092_mdgint', 'enemy_1092_mdgint_2']) test(`${id} retains its ordinary attack and kill accounting with logging-only native evidence`, () => {
  const { h, b, target, spawn } = fixture(id, 3), e = spawn(id);
  const native = support.enemies[id].native[id];
  assert.deepEqual(native.auxiliaryComponents[0].templates, ['log_killed[filter_map_layer]']);
  assert.equal(b._checkBlock(e), true); h.run(.1);
  assert.equal(target.hp, target.s.maxHp - e.s.atk);
  let killed = 0; b.on('death', c => { if (c.unit === e) killed++; }); b.kill(e, target);
  assert.equal(killed, 1); assert.equal(e.alive, false); assert.deepEqual(b.errors, []);
});

test('logging-looking components cannot conceal stat modifiers, actions, selectors or changed block volume', () => {
  const id = 'enemy_1092_mdgint', entry = ENEMY_RECORDS.enemies[id];
  for (const edit of [
    changed => changed.templates['log_killed[filter_map_layer]'].eventToActions.ON_OWNER_KILLED.push({ $type: 'UnknownGameplayAction' }),
    changed => {
      const row = changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`][0], c = JSON.parse(row.originalJson);
      c._buffs[0].attributes.attributeModifiers.push({ attributeType: 1, value: 1 }); row.originalJson = JSON.stringify(c);
    },
    changed => {
      const row = changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`][0], c = JSON.parse(row.originalJson);
      c._selector.m_PathID = '123'; row.originalJson = JSON.stringify(c);
    },
  ]) {
    const changed = structuredClone(evidence); edit(changed);
    assert.equal(enemySupport(entry, index.prefabs, changed).policy, null);
  }
  const changed = structuredClone(evidence);
  for (const row of changed.prefabs['dyn/battle/prefabs/enemies/enemy_1058_traink.prefab']) {
    const c = JSON.parse(row.originalJson); if ('_blockVolume' in c) c._blockVolume = 1; row.originalJson = JSON.stringify(c);
  }
  assert.equal(enemySupport(ENEMY_RECORDS.enemies.enemy_1058_traink, index.prefabs, changed).policy, null);
});

test('automatic evidence intake admits only helpers already covered by the exact auxiliary contract', () => {
  const admitted = ['enemy_1254_lypa_2', 'enemy_1433_dsbasi', 'enemy_1433_dsbasi_2',
    'enemy_5013_daikis', 'enemy_5018_tethfd', 'enemy_5039_dqgint'];
  for (const id of admitted) {
    const decision = enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence);
    assert.equal(decision.policy, 'basic-stats-and-attacks', id);
    const path = `dyn/battle/prefabs/enemies/${id}.prefab`;
    assert.ok(evidence.automaticAuxiliaryCandidates[path]?.length);
    assert.equal(decision.native[id].claimedActive, decision.native[id].activeGeneralOrCommonAbilities);
    const { h, b, target, spawn } = fixture(id, 10), unit = spawn(id);
    h.run(.2); assert.equal(target.hp, target.s.maxHp - unit.s.atk);
    b.kill(unit, target); assert.equal(unit.alive, false); assert.equal(b.killed, 1);
    assert.deepEqual(b.errors, []);
  }
  // Empty handbook/skill lists are insufficient: retained native buffs carry
  // real flags, immunities or actions, so these stay blocked.
  for (const id of ['enemy_10092_hlslp', 'enemy_1230_dsbudr_3', 'enemy_1442_dsgun', 'enemy_1529_dsdevr_2', 'enemy_2035_sybox'])
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence).policy, null, id);
});

test('named infinite empty helpers do not invent gameplay; all newly covered basic bodies retain ordinary damage and death', () => {
  const ids = ['enemy_2046_smwar', 'enemy_2060_smshdw', 'enemy_2061_smhond',
    ...['deer', 'bull', 'crab', 'bird', 'crab2', 'moth', 'chpy', 'strch', 'firy', 'cbrb1', 'deer2', 'bull1']
      .map((name, i) => `enemy_${7096 + i}_xb2${name}o_2`)];
  for (const id of ids) {
    const decision = enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence);
    assert.equal(decision.policy, 'basic-stats-and-attacks', id);
    const { h, b, target, spawn } = fixture(id, 10), e = spawn(id), before = e.hp;
    b.dealDamage(target, e, { amount: 1, type: 'true' }); assert.equal(e.hp, before - 1);
    h.run(.2); b.kill(e, target); assert.equal(e.alive, false); assert.deepEqual(b.errors, []);
  }
  const id = 'enemy_10086_hltigr';
  for (const kind of ['finite', 'attributes', 'actions', 'selector']) {
    const changed = structuredClone(evidence);
    const rows = changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
    const row = rows.find(row => JSON.parse(row.originalJson)._metadata?.namedAsAlias === 'Effect');
    const c = JSON.parse(row.originalJson);
    if (kind === 'finite') c._buffs[0].lifeTimeType = 1;
    if (kind === 'attributes') c._buffs[0].attributes.abnormalFlags.push(5);
    if (kind === 'actions') changed.templates.empty.eventToActions.ON_BUFF_START = [{ $type: 'UnknownGameplayAction' }];
    if (kind === 'selector') c._selector.m_PathID = '123';
    row.originalJson = JSON.stringify(c);
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, changed).policy, null, kind);
  }
});
