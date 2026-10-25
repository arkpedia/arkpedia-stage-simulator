// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate attachment only; the commander remains outside support admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { frontlineCommander } from '../server/sim/content/chapter16-commander.js';
import { mobileCrossbow } from '../server/sim/content/chapter16-crossbow.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { installFeatureDispatch, attach } from '../server/sim/content/enemies.js';
import { verifiedNative } from '../tools/arkpedia/enemy-support.mjs';
const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const records = read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
const proof = read('data/candidates/arkpedia-ch16-commander-source.json');
const commander = 'enemy_10125_uacomd', bow = 'enemy_10121_uasnip';
const KEY = 'enemy_uacomd_extra_power';
function fixture() {
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: installFeatureDispatch,
    defs: { enemies: Object.fromEntries([commander, bow].map(k => [k, records[k].levels[0]])),
      chess: { dummy: chessRec({ id: 'dummy', stats: { maxHp: 1e6, atk: 0, blockCnt: 0 } }) } },
    units: [{ chessId: 'dummy', row: 10, col: 6 }] });
  h.b.start();
  const spawn = (key, row, col) => {
    const e = h.spawn(key, { pos: [row, col] }); e.base.moveSpeed = 0; e.markDirty();
    const a = key === commander ? frontlineCommander(records[key].levels[0]) : mobileCrossbow(records[key].levels[0]);
    attach(h.b, e, [a]);
    return { e, a };
  };
  return { h, b: h.b, spawn };
}

test('native command aura is global, marked-ground-unit filtered, source owned and not detached by disappearance', () => {
  for (const [path, rows] of Object.entries(proof.prefabs)) {
    for (const row of rows) assert.equal(createHash('sha256').update(row.originalJson).digest('hex'), row.sha256);
    const by = new Map(rows.map(r => [r.pathId, JSON.parse(r.originalJson)]));
    const aura = [...by.values()].find(r => '_removeBuffWhenAbilityDetached' in r);
    assert.equal(aura._interval, 0, path);
    assert.equal(aura._clearBuffsWhenDisappear, 0); assert.equal(aura._removeBuffWhenAbilityDetached, 1);
    const validator = by.get(aura._targetValidator.m_PathID);
    assert.deepEqual(validator._buffs, ['enemy_field_army_self_mark']);
    assert.equal(validator._targetOptions.targetMotion, 1);
    assert.equal(aura._buffs[0].buffKey, KEY); assert.equal(aura._buffs[0].isSilenceable, 0);
  }
  assert.equal(Object.keys(proof.prefabs).length, 2, 'both native variants retained; neither is automatically admitted');
});

test('retained commander variants match the pinned timing index and remain unadmitted', () => {
  const bytes = readFileSync(new URL('../data/arkpedia-enemy-clock-source.json', import.meta.url)), index = JSON.parse(bytes);
  const native = read('data/candidates/arkpedia-ch16-commander-native.json');
  assert.doesNotThrow(() => verifiedNative(native, index.prefabs, createHash('sha256').update(bytes).digest('hex'),
    read('data/arkpedia-mvp.json').behaviors.source));
  const support = read('data/candidates/arkpedia-ch16-enemy-support.json');
  for (const key of [commander, commander + '_2']) assert.equal(support.enemies[key].policy, null);
});

test('a distant commander changes the actual crossbow listener and source death restores the original radius', () => {
  const { h, b, spawn } = fixture();
  const { e: archer } = spawn(bow, 10, 7);
  h.run(.11); assert.equal(archer.stats.attacks, 0);
  const { e: leader } = spawn(commander, 9, 2);
  assert.ok(archer.findBuff(KEY)); assert.ok(leader.findBuff('uacomd_a[effect]'));
  assert.equal(leader.findBuff(KEY), null, 'commander has no army recipient self-mark');
  h.run(.11); assert.equal(archer.stats.attacks, 1); assert.ok(archer.findBuff('uacomd_t[extra_effect]'));
  b.kill(leader, null); assert.equal(archer.findBuff(KEY), null);
  h.run(.11); assert.equal(archer.findBuff('uasnip_no_ally_nearby_able_attack'), null);
  assert.deepEqual(b.errors, []);
});

test('overlapping commanders retain orders until the last owner detaches', () => {
  const { h, b, spawn } = fixture();
  const { e: archer } = spawn(bow, 10, 7);
  const first = spawn(commander, 9, 2), second = spawn(commander, 12, 2);
  assert.ok(archer.findBuff(KEY));
  first.a.disposeOrders(); assert.ok(archer.findBuff(KEY));
  assert.equal(archer.findBuff(KEY).source, second.e);
  second.a.disposeOrders(); assert.equal(archer.findBuff(KEY), null);
  assert.deepEqual(b.errors, []);
});

test('new marked recipients join, airborne recipients leave, and friendly invisibility does not suppress orders', () => {
  const { h, b, spawn } = fixture();
  spawn(commander, 9, 2);
  const { e: archer } = spawn(bow, 10, 7);
  h.run(.04); assert.ok(archer.findBuff(KEY));
  const stealth = b.addBuff(archer, { key: 'test:invisible', persist: true, flags: { stealth: true } });
  h.run(.04); assert.ok(archer.findBuff(KEY));
  const air = b.addBuff(archer, { key: 'test:air', persist: true, flags: { levitate: true } });
  h.run(.04); assert.equal(archer.findBuff(KEY), null);
  b.removeBuff(archer, air); b.removeBuff(archer, stealth);
  h.run(.04); assert.ok(archer.findBuff(KEY));
  const isolated = b.addBuff(archer, { key: 'test:isolated', persist: true, flags: { isolated: true } });
  h.run(.04); assert.equal(archer.findBuff(KEY), null);
  b.removeBuff(archer, isolated); h.run(.04); assert.ok(archer.findBuff(KEY));
  assert.deepEqual(b.errors, []);
});

test('owner hiding and silence preserve the native aura; owner death ends it without touching a foreign buff', () => {
  const { h, b, spawn } = fixture();
  const { e: archer } = spawn(bow, 10, 7), { e: leader } = spawn(commander, 9, 2);
  b.addBuff(leader, { key: 'test:silence', persist: true, flags: { silence: true } });
  b._setHidden(leader, true); h.run(.1); assert.ok(archer.findBuff(KEY));
  const foreign = b.addBuff(archer, { key: KEY, persist: true, refresh: 'replace' });
  b.kill(leader, null);
  assert.equal(archer.findBuff(KEY), foreign, 'cleanup removes only its owned receipt');
  assert.deepEqual(b.errors, []);
});
