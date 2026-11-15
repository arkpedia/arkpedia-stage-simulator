// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemyRuntimeRecord } from '../shared/arkpedia/enemy-features.js';
import { nativeComponents, enemySupport } from '../shared/arkpedia/enemy-support.js';
import { epochGuardNative } from '../shared/arkpedia/enemy-epoch-guard-features.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const id = 'enemy_2064_skzwdd', markId = 'enemy_2088_skzdwz';
function fixture({ marked = false } = {}) {
  const r = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); r.stats.moveSpeed = 0;
  const op = chessRec({ id: 'epoch_guard_target', stats: { atk: 0, maxHp: 1e6, def: 0, blockCnt: 3 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, captureNoisy: true,
    defs: { enemies: { [id]: r, [markId]: enemyRuntimeRecord(ENEMY_RECORDS.enemies[markId].levels[0]) }, chess: { [op.chessId]: op } },
    kits: { [op.chessId]: () => ({ trait: { noAttack: true } }) },
    units: [{ chessId: op.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  h.b.start(); const e = h.b.spawnEnemy(id, { pos: [9, 6] }); h.b._checkBlock(e); e.atkCd = .5;
  const marks = []; if (marked) marks.push(h.b.spawnEnemy(markId, { pos: [9, 6] }));
  const hits = []; h.b.on('damaged', c => { if (c.source === e) hits.push({ ...c, time: h.b.time }); });
  return { ...h, e, u: h.b.allyUnits[0], hits, marks };
}
test('one ordinary attack becomes two source-timed physical strikes on an Epoch Mark', () => {
  for (const marked of [false, true]) {
    const f = fixture({ marked }); f.run(1); assert.equal(f.hits.length, 0);
    assert.equal(f.e.mem.regularFormVisual.clip, marked ? 'Skill' : 'Attack');
    f.run(.3); assert.equal(f.hits.length, 1); assert.equal(f.hits[0].dmg.amount, 800);
    f.run(.9); assert.equal(f.hits.length, marked ? 2 : 1);
    assert.equal(f.e.stats.attacks, 1);
    for (const hit of f.hits) { assert.equal(hit.dmg.isSkill, false); assert.equal(hit.dmg.applyWay, 'melee'); }
    if (marked) assert.equal(f.hits[0].dmg.attackId, f.hits[1].dmg.attackId);
    assert.deepEqual(f.b.errors, []);
  }
});
test('overlapping marks do not multiply strikes and removing one preserves contact', () => {
  const f = fixture({ marked: true }), second = f.b.spawnEnemy(markId, { pos: [9, 7] });
  f.run(.8); f.b.kill(f.marks[0]); assert.equal(f.b.stageEpoch.has(f.e), true);
  f.run(1.5); assert.equal(f.hits.length, 2); assert.ok(f.e.findBuff('skzwdd_a[effect]'));
  f.b.kill(second); f.run(.4); assert.equal(f.b.stageEpoch.has(f.e), false);
  assert.equal(f.e.findBuff('skzwdd_a[effect]'), null); assert.deepEqual(f.b.errors, []);
});
test('leaving the field detaches the combat mode and cancels remaining strikes without resetting cooldown', () => {
  const f = fixture({ marked: true }); f.run(1.3); assert.equal(f.hits.length, 1);
  const cooldown = f.e.atkCd; f.b.kill(f.marks[0]); f.run(.4);
  assert.equal(f.e.mem.regularFormVisual, null); assert.ok(f.e.atkCd < cooldown);
  f.run(.5); assert.equal(f.hits.length, 1); assert.equal(f.e.stats.attacks, 1); assert.deepEqual(f.b.errors, []);
});
test('control and source death cancel future strikes; replacement target life cannot receive them', () => {
  for (const action of ['stun', 'death', 'replacement']) {
    const f = fixture({ marked: true }); f.run(1.3); assert.equal(f.hits.length, 1);
    if (action === 'stun') f.b.applyStatus(f.e, 'stun', { duration: 3 });
    if (action === 'death') f.b.kill(f.e);
    if (action === 'replacement') f.u.deploySeq++;
    f.run(1); assert.equal(f.hits.length, 1, action); assert.deepEqual(f.b.errors, []);
  }
});
test('silence does not suppress the passive mode; Slow Down stretches both strike clocks', () => {
  const f = fixture({ marked: true }); f.b.applyStatus(f.e, 'silence', { duration: 10 });
  f.b.addBuff(f.e, { key: 'fixture:slow', mods: { slowDownMul: .5 } });
  f.run(1.6); assert.equal(f.hits.length, 0); assert.equal(f.e.mem.regularFormVisual.clip, 'Skill');
  f.run(.5); assert.equal(f.hits.length, 1); f.run(1.6); assert.equal(f.hits.length, 2);
  assert.deepEqual(f.b.errors, []);
});
test('native admission checks the global field key, repeat count, restart rule and damage payload', () => {
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence).policy);
  for (const kind of ['key', 'restart', 'count', 'split']) {
    const ev = structuredClone(evidence);
    if (kind === 'key') ev.templates['skzwdd_a[multi_attack]'].eventToActions.ON_BUFF_TRIGGER[0]._conditionNode._buffKeys = ['other'];
    if (kind === 'restart') ev.templates['skzwdd_a[multi_attack]'].eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[1]._restartFSM = true;
    if (kind === 'count' || kind === 'split') {
      const row = ev.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`].find(c => c.objectName === 'Combat' && JSON.parse(c.originalJson)._additionalTimes === 1);
      const c = JSON.parse(row.originalJson); c[kind === 'count' ? '_additionalTimes' : '_splitDamage'] = kind === 'count' ? 2 : 1; row.originalJson = JSON.stringify(c);
    }
    assert.equal(epochGuardNative(ENEMY_RECORDS.enemies[id].levels[0], nativeComponents(ev, id)), false, kind);
  }
});
