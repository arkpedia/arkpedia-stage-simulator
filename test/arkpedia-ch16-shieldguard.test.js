// SPDX-License-Identifier: GPL-3.0-or-later
// Direct candidate attachment; stage admission has a separate source gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { shieldguard } from '../server/sim/content/chapter16-shieldguard.js';
import { frontlineCommander } from '../server/sim/content/chapter16-commander.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { attach, installFeatureDispatch } from '../server/sim/content/enemies.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { verifiedNative, verifiedChapter16FamilyGraph } from '../tools/arkpedia/enemy-support.mjs';
const bytes = p => readFileSync(new URL('../data/' + p, import.meta.url));
const read = p => JSON.parse(bytes(p));
const records = read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const key = 'enemy_10124_uashld', miner = 'enemy_3010_mcreep';
const proof = read('candidates/arkpedia-ch16-shieldguard-source.json');
function fixture({ variant = false, operator = false } = {}) {
  const id = key + (variant ? '_2' : '');
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: b => { installFeatureDispatch(b); installEnemyFeatures(b); },
    defs: { enemies: Object.fromEntries([id, miner, 'enemy_10125_uacomd'].map(k => [k, records[k].levels[0]])),
      chess: { dummy: chessRec({ id: 'dummy', stats: { maxHp: 1e6, atk: 0, def: 0, blockCnt: 1 } }) } },
    units: operator ? [{ chessId: 'dummy', row: 10, col: 6 }] : [] });
  h.b.start();
  const e = h.spawn(id, { pos: [10, 6] }); e.base.moveSpeed = 0; e.markDirty();
  const a = e.mem.ab.list.find(a => a.engagements);
  assert.ok(a, 'normal feature dispatch installs the Shieldguard controller');
  const spawn = (x, y = 10) => {
    const m = h.spawn(miner, { pos: [y, x] }); m.base.moveSpeed = 0; m.markDirty(); return m;
  };
  return { h, b: h.b, e, a, spawn, u: operator ? h.unit('dummy') : null };
}
const actions = (key, event) => JSON.parse(JSON.parse(proof.templates[key].originalJson).eventToActions._items.find(e => e.key === event).value.SerializedState);

test('full Shieldguard graphs and indexed fields bind the existing immutable sources', () => {
  const index = read('arkpedia-enemy-clock-source.json');
  verifiedChapter16FamilyGraph(bytes('candidates/arkpedia-ch16-shieldguard-source.json'), bytes('arkpedia-cn-native-source.json'), bytes('arkpedia-cn-enemy-native-source.json'), index);
  verifiedNative(read('candidates/arkpedia-ch16-shieldguard-native.json'), index.prefabs,
    createHash('sha256').update(bytes('arkpedia-enemy-clock-source.json')).digest('hex'), read('arkpedia-mvp.json').behaviors.source);
  assert.equal(Object.keys(proof.prefabs).length, 2); assert.equal(Object.keys(proof.templates).length, 6);
  const damage = actions('uashld_t[limit_damage]', 10)[1];
  assert.equal(damage._damageMask, 'PHYSICAL_AND_MAGICAL'); assert.equal(damage._isOneMinus, true);
  assert.equal(damage._isStackable, false);
  const acquire = actions('mainline16_g[block_mcreep]', 2);
  assert.equal(acquire[0]._stackCountKey, 'block_mcreep_cnt'); assert.equal(acquire[1]._abilityName, 'SelectNearestMcreep');
});

for (const variant of [false, true]) test(`variant ${variant} retains three nearest links, acquiring one per native scan`, () => {
  const { h, e, a, spawn } = fixture({ variant });
  const miners = [.3, .5, .7, .9].map(d => spawn(6 + d));
  h.run(.31); assert.equal(a.engagements.size, 1); assert.equal(miners[0].mem.blockedMcreepBy, e.id);
  h.run(.3); assert.equal(a.engagements.size, 2);
  h.run(.3); assert.equal(a.engagements.size, 3); h.run(.6); assert.equal(a.engagements.size, 3);
  assert.equal(miners[3].mem.blockedMcreepBy, undefined);
  assert.ok(miners.slice(0, 3).every(m => m.s.flags.noMove)); assert.ok(e.s.flags.noMove);
});

test('releasing one engagement frees only that pair and immediately permits replacement at the next scan', () => {
  const { h, b, e, a, spawn } = fixture(); const miners = [.3, .5, .7, .9].map(d => spawn(6 + d));
  h.run(.91); b.kill(miners[0], null);
  assert.equal(a.engagements.size, 2); assert.ok(e.s.flags.noMove);
  assert.ok(miners.slice(1, 3).every(m => m.s.flags.noMove));
  h.run(.3); assert.equal(a.engagements.size, 3); assert.equal(miners[3].mem.blockedMcreepBy, e.id);
});

test('three movement engagements still use one independently selected weapon target per attack', () => {
  const { h, b, e, a, spawn } = fixture(); const miners = [.3, .5, .7].map(d => spawn(6 + d));
  const attacks = []; b.on('attack', c => { if (c.attacker === e) attacks.push(c.targets); });
  h.run(1); assert.equal(a.engagements.size, 3); assert.equal(attacks.length, 1);
  assert.equal(attacks[0].length, 1); assert.equal(attacks[0][0], miners[2], 'weapon uses latest-deployment taunt order');
});

test('release radius uses the same center rule independently for each linked miner', () => {
  const { h, e, a, spawn } = fixture(); const miners = [.3, .5, .7].map(d => spawn(6 + d)); h.run(.91);
  miners[0].x = 6.99; miners[1].x = 7.01; h.run(.31);
  assert.equal(a.engagements.size, 2); assert.equal(miners[0].mem.blockedMcreepBy, e.id);
  assert.equal(miners[1].mem.blockedMcreepBy, undefined); assert.ok(!miners[1].s.flags.noMove);
});

for (const stop of ['death', 'battleEnd']) test(`${stop} retires every movement link and its owned marker`, () => {
  const { h, b, e, a, spawn } = fixture(); const miners = [.3, .5, .7].map(d => spawn(6 + d));
  h.run(.91); b.addBuff(e, { key: 'enemy_uacomd_extra_power', persist: true }); h.run(.11);
  assert.ok(e.findBuff('uashld_a[extra_effect_core]'));
  if (stop === 'death') b.kill(e, null); else b.emit('battleEnd', {});
  assert.equal(a.engagements.size, 0); assert.ok(!e.findBuff('uashld_a[extra_effect_core]'));
  assert.equal(b._takenMultipliers.has(e), false);
  assert.ok(miners.every(m => !m.s.flags.noMove && m.mem.blockedMcreepBy == null)); assert.deepEqual(b.errors, []);
});

test('orders reduce post-mitigation physical/Arts damage immediately, excluding true damage and HP loss', () => {
  const { b, e } = fixture(); b.addBuff(e, { key: 'enemy_uacomd_extra_power', persist: true });
  let hp = e.hp; b.dealDamage(null, e, { amount: 2000, type: 'phys' }); assert.equal(hp - e.hp, 300);
  hp = e.hp; b.dealDamage(null, e, { amount: 1000, type: 'arts' }); assert.equal(hp - e.hp, 240);
  hp = e.hp; b.dealDamage(null, e, { amount: 1000, type: 'true' }); assert.equal(hp - e.hp, 1000);
  hp = e.hp; b.loseHp(e, 100); assert.equal(hp - e.hp, 100);
  b.removeBuff(e, 'enemy_uacomd_extra_power'); hp = e.hp;
  b.dealDamage(null, e, { amount: 2000, type: 'phys' }); assert.equal(hp - e.hp, 500);
});

test('real commander orders grant reduction without stacking, and removal restores incoming damage', () => {
  const { h, b, e } = fixture(); const c = h.spawn('enemy_10125_uacomd', { pos: [10, 9] });
  attach(b, c, [frontlineCommander(records.enemy_10125_uacomd.levels[0])]); h.run(.3);
  assert.ok(e.findBuff('enemy_uacomd_extra_power'));
  let hp = e.hp; b.dealDamage(null, e, { amount: 2000, type: 'phys' }); assert.equal(hp - e.hp, 300);
  b.kill(c, null); h.run(.3); assert.equal(e.findBuff('enemy_uacomd_extra_power'), null);
  hp = e.hp; b.dealDamage(null, e, { amount: 2000, type: 'phys' }); assert.equal(hp - e.hp, 500);
});

test('Attack and Combat have independent clocks across a change of blocker', () => {
  const { h, e, b, u, spawn } = fixture({ operator: true });
  h.run(.1); assert.ok(e.blockedBy === u); assert.ok(e.profile.attackCooldowns.combat > 3);
  assert.equal(e.profile.attackCooldowns.attack, 0);
  spawn(6.8); b.retreat(u); h.run(.1); assert.equal(e.stats.attacks, 2);
  assert.ok(e.profile.attackCooldowns.combat > 3 && e.profile.attackCooldowns.attack > 3);
});

test('candidate Shieldguard support binds the exact record, complete retained components and native claim', async () => {
  const { deriveEnemySupport, prefabPath } = await import('../shared/arkpedia/enemy-support.js');
  const review = read('candidates/arkpedia-ch16-reviewed-shieldguard.json'), native = read('candidates/arkpedia-ch16-shieldguard-native.json');
  for (const file of Object.values(review.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file.path, import.meta.url))).digest('hex'), file.sha256);
  const index = read('arkpedia-enemy-clock-source.json'), entries = Object.fromEntries(Object.keys(review.enemies).map(k => [k, records[k]]));
  const evidence = { ...native, chapter16Families: { shieldguard: { graphSha256: review.sources.graph.sha256 } } };
  for (const id of Object.keys(entries)) {
    assert.equal(deriveEnemySupport(entries, index.prefabs, evidence)[id].policy, 'stats-attacks-and-features');
    assert.equal(deriveEnemySupport(entries, index.prefabs, native)[id].policy, null);
    const changed = structuredClone(evidence); changed.prefabs[prefabPath(id)][0].originalJson += ' ';
    assert.equal(deriveEnemySupport(entries, index.prefabs, changed)[id].policy, null);
    const wrong = structuredClone(entries); wrong[id].levels[0].talents.bb['BlockMcreep.block_mcreep_cnt'] = 4;
    assert.equal(deriveEnemySupport(wrong, index.prefabs, evidence)[id].policy, null);
    const extra = structuredClone(index.prefabs); extra[prefabPath(id)].clockComponents.push({ fields: { _generalAbilities: [{ m_FileID: 0, m_PathID: '123' }] } });
    assert.equal(deriveEnemySupport(entries, extra, evidence)[id].policy, null);
  }
});

test('nonsilenceable orders and engagement survive silence; named visual cleanup follows the native action', () => {
  const { h, b, e, a, spawn } = fixture(); spawn(6.5);
  const foreign = b.addBuff(e, { key: 'uashld_a[extra_effect_core]', persist: true });
  b.applyStatus(e, 'silence', { duration: 3 }); b.addBuff(e, { key: 'enemy_uacomd_extra_power', persist: true }); h.run(.31);
  assert.equal(a.engagements.size, 1); let hp = e.hp;
  b.dealDamage(null, e, { amount: 2000, type: 'phys' }); assert.equal(hp - e.hp, 300);
  b.removeBuff(e, 'enemy_uacomd_extra_power'); h.run(.11);
  assert.ok(!e.buffs.includes(foreign));
  const clear = actions('uashld_a[extra_effect]', 2)[0]._failNodes[0];
  assert.equal(clear._checkBuffSource, false);
});

test('ordered Shieldguard reduction cannot alter a damage packet reused for another recipient', async () => {
  const { makeDamageInfo } = await import('../server/sim/damage.js');
  const { h, b, e } = fixture(); const other = h.spawn(key, { pos: [10, 9] });
  b.addBuff(e, { key: 'enemy_uacomd_extra_power', persist: true });
  const packet = makeDamageInfo({ amount: 2000, type: 'phys' }), before = [e.hp, other.hp];
  b.dealDamage(null, e, packet); b.dealDamage(null, other, packet);
  assert.equal(before[0] - e.hp, 300); assert.equal(before[1] - other.hp, 500);
  assert.equal(packet.mul, 1);
});
