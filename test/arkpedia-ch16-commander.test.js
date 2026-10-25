// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate support only; stage and public admission remain separate gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { installFeatureDispatch } from '../server/sim/content/enemies.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { deriveEnemySupport, prefabPath } from '../shared/arkpedia/enemy-support.js';
import { verifiedNative, verifiedChapter16FamilyGraph } from '../tools/arkpedia/enemy-support.mjs';
const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const records = read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
const proof = read('data/candidates/arkpedia-ch16-commander-source.json');
const review = read('data/candidates/arkpedia-ch16-reviewed-commander.json');
const commander = 'enemy_10125_uacomd', bow = 'enemy_10121_uasnip';
const KEY = 'enemy_uacomd_extra_power';
function fixture() {
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: b => { installFeatureDispatch(b); installEnemyFeatures(b); },
    defs: { enemies: Object.fromEntries([commander, commander + '_2', bow, 'enemy_3010_mcreep', 'enemy_10123_uareap', 'enemy_10124_uashld', 'enemy_10122_uacann'].map(k => [k, records[k].levels[0]])),
      chess: { dummy: chessRec({ id: 'dummy', stats: { maxHp: 1e6, atk: 0, blockCnt: 0 } }) } },
    units: [{ chessId: 'dummy', row: 10, col: 6 }] });
  h.b.start();
  const spawn = (key, row, col) => {
    const e = h.spawn(key, { pos: [row, col] }); e.base.moveSpeed = 0; e.markDirty();
    const a = e.mem.ab.list.find(a => a.disposeOrders);
    if (key.startsWith(commander)) assert.ok(a, 'normal feature dispatch installs Commander');
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
  assert.equal(Object.keys(proof.prefabs).length, 2, 'both native variants retained; public admission remains separate');
});

test('retained commander variants match the timing index and clear only exact candidate support', () => {
  const bytes = readFileSync(new URL('../data/arkpedia-enemy-clock-source.json', import.meta.url)), index = JSON.parse(bytes);
  const native = read('data/candidates/arkpedia-ch16-commander-native.json');
  assert.doesNotThrow(() => verifiedNative(native, index.prefabs, createHash('sha256').update(bytes).digest('hex'),
    read('data/arkpedia-mvp.json').behaviors.source));
  const support = read('data/candidates/arkpedia-ch16-enemy-support.json');
  for (const key of [commander, commander + '_2']) {
    assert.equal(support.enemies[key].policy, 'stats-attacks-and-features');
    assert.equal(support.enemies[key].native[key].claimedActive, 1);
  }
  verifiedChapter16FamilyGraph(readFileSync(new URL('../data/candidates/arkpedia-ch16-commander-source.json', import.meta.url)),
    readFileSync(new URL('../data/arkpedia-cn-native-source.json', import.meta.url)),
    readFileSync(new URL('../data/arkpedia-cn-enemy-native-source.json', import.meta.url)), index);
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

test('independent Commander review rejects missing family proof, altered native component and record drift', () => {
  for (const file of Object.values(review.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file.path, import.meta.url))).digest('hex'), file.sha256);
  const native = read('data/candidates/arkpedia-ch16-commander-native.json'), index = read('data/arkpedia-enemy-clock-source.json');
  const evidence = { ...native, chapter16Families: { commander: { graphSha256: review.sources.graph.sha256 } } };
  for (const key of Object.keys(review.enemies)) {
    const entries = { [key]: records[key] }, decision = deriveEnemySupport(entries, index.prefabs, evidence)[key];
    assert.equal(decision.policy, 'stats-attacks-and-features');
    assert.equal(decision.native[key].claimedActive, decision.native[key].activeGeneralOrCommonAbilities);
    assert.equal(deriveEnemySupport(entries, index.prefabs, native)[key].policy, null);
    const changed = structuredClone(evidence); changed.prefabs[prefabPath(key)][0].originalJson += ' ';
    assert.equal(deriveEnemySupport(entries, index.prefabs, changed)[key].policy, null);
    const wrong = structuredClone(entries); wrong[key].levels[0].talents.bb['BlockMcreep.block_mcreep_cnt'] = 3;
    assert.equal(deriveEnemySupport(wrong, index.prefabs, evidence)[key].policy, null);
  }
});
for (const key of [commander, commander + '_2']) test(`${key} supplies real six-round Fortbreaker volleys and ends its owned aura on battle end`, () => {
  const { h, b, spawn } = fixture(); const { e: leader } = spawn(key, 9, 2);
  const { e: fort } = spawn('enemy_10123_uareap', 10, 7);
  fort.profile.attackCooldowns = { attack: 1e6, combat: 1e6 };
  const a = fort.mem.ab.list.find(a => a.cast), launches = [];
  b.on('ch16FortbreakerLaunch', c => launches.push(c)); h.run(.04);
  assert.ok(fort.findBuff(KEY)); assert.equal(fort.findBuff(KEY).source, leader);
  a.cast(); h.run(1.9); assert.equal(launches.length, 6); assert.ok(launches.every(c => c.count === 6));
  b.emit('battleEnd', {}); assert.equal(fort.findBuff(KEY), null); assert.equal(a.pending, null);
  assert.deepEqual(b.errors, []);
});
test('Commander movement engages only one miner and releases both participants on source death', () => {
  const { h, b, spawn } = fixture(); const { e, a } = spawn(commander, 10, 7);
  const first = spawn('enemy_3010_mcreep', 10, 7.3).e, second = spawn('enemy_3010_mcreep', 10, 7.5).e;
  h.run(.61); assert.equal(a.engagements.size, 1); assert.equal(first.mem.blockedMcreepBy, e.id);
  assert.equal(second.mem.blockedMcreepBy, undefined); assert.ok(e.s.flags.noMove);
  b.kill(e, null); assert.equal(a.engagements.size, 0); assert.equal(first.mem.blockedMcreepBy, undefined);
  assert.ok(!first.s.flags.noMove); assert.deepEqual(b.errors, []);
});
