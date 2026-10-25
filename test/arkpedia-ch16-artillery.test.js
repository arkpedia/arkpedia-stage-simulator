// SPDX-License-Identifier: GPL-3.0-or-later
// Direct candidate attachment. No support or stage approval follows from this suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { lightArtillery } from '../server/sim/content/chapter16-artillery.js';
import { frontlineCommander } from '../server/sim/content/chapter16-commander.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { attach, installFeatureDispatch } from '../server/sim/content/enemies.js';
import { verifiedNative } from '../tools/arkpedia/enemy-support.mjs';
const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const records = read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
const proof = read('data/candidates/arkpedia-ch16-artillery-source.json');
const key = 'enemy_10122_uacann', rec = records[key].levels[0];
function fixture({ second = false } = {}) {
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: installFeatureDispatch,
    defs: { enemies: Object.fromEntries([key, 'enemy_3010_mcreep', 'enemy_10125_uacomd'].map(k => [k, records[k].levels[0]])),
      chess: { dummy: chessRec({ id: 'dummy', stats: { maxHp: 1e6, atk: 0, def: 100, blockCnt: 0 } }) } },
    units: [{ chessId: 'dummy', row: 10, col: 5 }, ...(second ? [{ chessId: 'dummy', row: 11, col: 5 }] : [])] });
  h.b.start();
  const e = h.spawn(key, { pos: [10, 7] }); e.base.moveSpeed = 0; e.markDirty();
  const a = lightArtillery(rec); attach(h.b, e, [a]);
  return { h, b: h.b, e, a, u: h.unit('dummy') };
}

test('artillery source closure retains both projectiles, native collision radius, source check and fixed Arts action', () => {
  for (const rows of [...Object.values(proof.prefabs), ...Object.values(proof.projectiles), Object.values(proof.templates)])
    for (const row of rows) assert.equal(createHash('sha256').update(row.originalJson).digest('hex'), row.sha256);
  assert.equal(Object.keys(proof.prefabs).length, 2);
  assert.equal(Object.keys(proof.projectiles).length, 2);
  const shell = Object.entries(proof.projectiles).find(([k]) => k.endsWith('/projectile_enemy_uacann.prefab'))[1].map(r => JSON.parse(r.originalJson));
  const field = Object.entries(proof.projectiles).find(([k]) => k.endsWith('/projectile_enemy_uacann_range.prefab'))[1].map(r => JSON.parse(r.originalJson));
  assert.equal(shell.find(n => '_speed' in n)._speed, 4);
  assert.equal(shell.find(n => '_lifeTime' in n)._stopWhenSourceInvalid, 0);
  assert.equal(field.find(n => 'm_Radius' in n).m_Radius, 1.5);
  const controller = field.find(n => '_getLifeTimeFromBB' in n);
  assert.equal(controller._getLifeTimeFromBB, 1); assert.equal(controller._stopWhenSourceInvalid, 0);
  assert.equal(controller._actionController._detachBuffsWhenTargetLeave, 1);
  assert.equal(controller._actionController._detachAllBuffsWhenStopped, 1);
  const emit = JSON.parse(proof.templates['uacann_ma[emit_projectile]'].originalJson);
  const start = JSON.parse(emit.eventToActions._items.find(e => e.key === 0).value.SerializedState);
  assert.equal(start[0].$type, 'Torappu.Battle.Action.Nodes+CheckUnitAlive');
  assert.equal(start[1]._projectileKey, 'projectile_enemy_uacann_range');
  assert.equal(start[1]._buffDataList[0].triggerInterval, 1);
  assert.equal(start[1]._buffDataList[0].disableOverride, true, 'independent areas stack');
  const damage = JSON.parse(proof.templates['uacann_ma[range_damage]'].originalJson);
  const action = JSON.parse(damage.eventToActions._items.find(e => e.key === 2).value.SerializedState)[0];
  assert.equal(action._damageType, 'MAGICAL'); assert.equal(action._damageKey, 'value');
  assert.equal(action._attackType, 'BUFF'); assert.equal(action._noSourceDamage, false);
});

test('both artillery variants retain indexed evidence and clear only candidate admission', () => {
  const bytes = readFileSync(new URL('../data/arkpedia-enemy-clock-source.json', import.meta.url)), index = JSON.parse(bytes);
  verifiedNative(read('data/candidates/arkpedia-ch16-artillery-native.json'), index.prefabs,
    createHash('sha256').update(bytes).digest('hex'), read('data/arkpedia-mvp.json').behaviors.source);
  const support = read('data/candidates/arkpedia-ch16-enemy-support.json');
  for (const k of [key, key + '_2']) assert.equal(support.enemies[k].policy, 'stats-attacks-and-features');
});

test('shared engine shell deals physical impact, then three independent fixed Arts ticks', () => {
  const { h, e, b, u } = fixture(), hp = u.hp;
  h.run(.1); assert.equal(e.stats.attacks, 1); assert.equal(u.hp, hp);
  assert.equal(b.projectiles.list[0].speed, 4);
  h.run(.6); assert.equal(hp - u.hp, 250);
  h.run(3); assert.equal(hp - u.hp, 550);
  assert.equal(u.buffs.filter(b => b.key.startsWith('ch16:burn:')).length, 0);
  assert.deepEqual(b.errors, []);
});

test('born shell survives source death but cannot create a new burn; existing burn survives source death', () => {
  const first = fixture(), hp = first.u.hp;
  first.h.run(.1); first.b.kill(first.e, null); first.h.run(4);
  assert.equal(hp - first.u.hp, 250);
  const second = fixture(), hp2 = second.u.hp;
  second.h.run(.7); second.b.kill(second.e, null); second.h.run(3);
  assert.equal(hp2 - second.u.hp, 550);
  assert.deepEqual([...first.b.errors, ...second.b.errors], []);
});

test('distinct burning areas stack, and leaving/reentering resets only that recipient timer', () => {
  const { h, b, e, u } = fixture();
  h.run(.7);
  b.chapter16Artillery.add(e, u.x, u.y, 3, 100);
  const hp = u.hp;
  h.run(1.1); assert.equal(hp - u.hp, 200);
  u.x = 1; h.run(.1); assert.equal(u.buffs.filter(b => b.key.startsWith('ch16:burn:')).length, 0);
  u.x = 5; h.run(.6); assert.equal(hp - u.hp, 200, 'prior partial clocks do not survive exit');
  h.run(.5); assert.equal(hp - u.hp, 400);
  assert.deepEqual(b.errors, []);
});

test('actual commander orders prefer a marked miner over the ordinary operator target and removal restores selection', () => {
  const { h, b, e, u } = fixture();
  const miner = h.spawn('enemy_3010_mcreep', { pos: [10, 4] });
  miner.profile.neutral = true; miner.profile.noAttack = true; miner.base.moveSpeed = 0; miner.markDirty();
  b.addBuff(miner, { key: 'enemy_mcreep_self_mark', persist: true });
  b.addBuff(miner, { key: 'test:low-taunt', persist: true, mods: { taunt: -1 } });
  const leader = h.spawn('enemy_10125_uacomd', { pos: [1, 1] });
  attach(b, leader, [frontlineCommander(records.enemy_10125_uacomd.levels[0])]);
  h.run(.1); assert.equal(b.projectiles.list[0].target, miner);
  h.run(.11); assert.ok(e.findBuff('uacann_a[extra_effect_core]'));
  b.kill(leader, null); h.run(.21); assert.equal(e.findBuff('uacann_a[extra_effect_core]'), null);
  e.atkCd = 0; h.run(.04); assert.equal(b.projectiles.list.at(-1).target, u);
  assert.deepEqual(b.errors, []);
});

test('burning collider ignores camouflage, excludes airborne recipients, and cleans up at battle end', () => {
  const { h, b, e, u } = fixture();
  e.profile.noAttack = true;
  b.addBuff(u, { key: 'test:camou', persist: true, flags: { camou: true } });
  b.chapter16Artillery.add(e, u.x, u.y, 10, 100);
  const hp = u.hp; h.run(1.1); assert.equal(hp - u.hp, 100);
  const air = b.addBuff(u, { key: 'test:air', persist: true, flags: { liftoff: true } });
  h.run(1.1); assert.equal(hp - u.hp, 100);
  b.removeBuff(u, air); h.run(1.1); assert.equal(hp - u.hp, 200);
  b.emit('battleEnd', {});
  assert.equal(u.buffs.filter(b => b.key.startsWith('ch16:burn:')).length, 0);
  assert.deepEqual(b.errors, []);
});

test('explicit burning collider includes a touching operator body and does not tick an outside body', () => {
  const { h, b, e, u } = fixture(); e.profile.noAttack = true;
  b.chapter16Artillery.add(e, 5, 10, 10, 100);
  u.x = 6.74; const hp = u.hp;
  h.run(1.1); assert.equal(hp - u.hp, 100, 'native 1.5 circle plus operator .25 collider');
  u.x = 6.76; h.run(1.1); assert.equal(hp - u.hp, 100);
  assert.deepEqual(b.errors, []);
});

test('shell reads live attack at impact while its lingering Arts damage remains a fixed table value', () => {
  const { h, b, e, u } = fixture(); const hp = u.hp;
  h.run(.1);
  b.addBuff(e, { key: 'test:attack', persist: true, mods: { atkPct: 1 } });
  h.run(.6); assert.equal(hp - u.hp, 600, '700 live ATK minus 100 DEF');
  h.run(3); assert.equal(hp - u.hp, 900, 'burn does not scale with source ATK');
  assert.deepEqual(b.errors, []);
});

test('battle end retires the field manager even when a pending impact callback arrives afterwards', () => {
  const { h, b, e, u } = fixture();
  h.run(.1); b.emit('battleEnd', {});
  b.chapter16Artillery.add(e, u.x, u.y, 3, 100);
  h.run(.6);
  assert.equal(u.buffs.filter(b => b.key.startsWith('ch16:burn:')).length, 0);
  assert.deepEqual(b.errors, []);
});

test('a damage hook ending the battle cannot attach field receipts to later recipients', () => {
  const { h, b, e } = fixture({ second: true }); e.profile.noAttack = true;
  const units = [...b.allyUnits];
  b.chapter16Artillery.add(e, 5, 10, 3, 100);
  b.on('damaged', () => b.emit('battleEnd', {}));
  h.run(1.1);
  assert.ok(units.every(u => u.buffs.every(buff => !buff.key.startsWith('ch16:burn:'))));
  assert.deepEqual(b.errors, []);
});

test('ordinary feature dispatch installs source-reviewed artillery and rejects missing or changed family proof', async () => {
  const { installEnemyFeatures } = await import('../server/sim/content/arkpedia-enemy-features.js');
  const { deriveEnemySupport, prefabPath } = await import('../shared/arkpedia/enemy-support.js');
  const review = read('data/candidates/arkpedia-ch16-reviewed-artillery.json'), native = read('data/candidates/arkpedia-ch16-artillery-native.json');
  for (const file of Object.values(review.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file.path, import.meta.url))).digest('hex'), file.sha256);
  const index = read('data/arkpedia-enemy-clock-source.json'), entries = Object.fromEntries(Object.keys(review.enemies).map(k => [k, records[k]]));
  const evidence = { ...native, chapter16Families: { artillery: { graphSha256: review.sources.graph.sha256 } } };
  for (const k of Object.keys(entries)) {
    assert.equal(deriveEnemySupport(entries, index.prefabs, evidence)[k].policy, 'stats-attacks-and-features');
    assert.equal(deriveEnemySupport(entries, index.prefabs, native)[k].policy, null);
    const changed = structuredClone(evidence); changed.prefabs[prefabPath(k)][0].originalJson += ' ';
    assert.equal(deriveEnemySupport(entries, index.prefabs, changed)[k].policy, null);
  }
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: installEnemyFeatures,
    defs: { enemies: { [key]: records[key].levels[0] } } });
  h.b.start(); const e = h.spawn(key, { pos: [10, 7] });
  assert.equal(e.profile.deferHit, true); assert.ok(h.b.chapter16Artillery); assert.ok(e.findBuff('enemy_field_army_self_mark'));
});
