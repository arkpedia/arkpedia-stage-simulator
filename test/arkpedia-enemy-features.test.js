// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import { ENEMY_FEATURES, recordFeatureIds } from '../shared/arkpedia/enemy-features.js';
import { enemyStealthed } from '../server/sim/targeting.js';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';

const enemy = (h, key) => h.b.units.find(u => u.side === 'enemy' && u.defId === key);
const usedBy = id => Object.entries(support.enemies).filter(([, e]) => e.features?.includes(id)).map(([k]) => k);

test('every registered feature is used by an enemy and approved for at least one', () => {
  for (const id of Object.keys(ENEMY_FEATURES)) {
    const users = Object.entries(ENEMY_RECORDS.enemies).filter(([, e]) => Object.values(e.levels).some(r => recordFeatureIds(r).includes(id)));
    assert.ok(users.length, `${id} is used`);
    assert.ok(usedBy(id).length, `${id} clears at least one enemy`);
  }
});
test('Flying unit: the record flies; a ground guard does not block it', () => {
  const h = spawnAny('enemy_1005_yokai', { seconds: 8 }), e = enemy(h, 'enemy_1005_yokai');
  assert.equal(e.motion, 'FLY'); assert.equal(e.blockedBy ?? null, null);
});
test('Regenerates HP over time: the record regeneration heals it', () => {
  const h = spawnAny('enemy_1043_zomsbr', { units: [] }), e = (h.run(0.1), enemy(h, 'enemy_1043_zomsbr'));
  e.hp = e.s.maxHp / 2; const hp = e.hp; h.run(2);
  assert.ok(e.hp >= hp + 2 * ENEMY_RECORDS.enemies.enemy_1043_zomsbr.levels[0].stats.hpRecoveryPerSec - 1, `${e.hp} from ${hp}`);
});
for (const key of usedBy('ability:Cannot be blocked.')) test(`Cannot be blocked (${key}): it walks past a guard without being blocked`, () => {
  const h = spawnAny(key, { seconds: 0.1 }), e = () => enemy(h, key);
  assert.ok(e()?.alive, 'spawned');
  h.runUntil(() => !e()?.alive || e().blockedBy, 120);
  assert.equal(e()?.blockedBy ?? null, null); assert.ok(e().s.flags.unblockable);
});
for (const key of usedBy('ability:<$ba.invisible>Invisible</>')) test(`Invisible (${key}): stealthed for selection until a blocker reveals it`, () => {
  const h = spawnAny(key, { seconds: 0.1 }), e = () => enemy(h, key);
  assert.equal(enemyStealthed(e()), true, 'stealthed at spawn');
  h.runUntil(() => !e()?.alive || e().blockedBy, 120);
  assert.ok(e().blockedBy, 'the guard blocks it'); h.run(0.1);
  assert.equal(enemyStealthed(e()), false, 'blocking reveals it');
});
for (const key of usedBy('ability:Attacks two targets simultaneously.')) test(`Attacks two targets simultaneously (${key}): two ranged targets per attack`, () => {
  const h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key);
  assert.equal(e.profile.maxTargets, 2);
});
for (const key of ['enemy_1365_spnwiz', 'enemy_1104_lfkght']) test(`Reborn (${key}): the first knock-out starts a rebirth of the talent duration, then it stands up again`, () => {
  const r = ENEMY_RECORDS.enemies[key].levels[0], g = Object.keys(r.talents.groups).find(x => x.toLowerCase() === 'reborn');
  const dur = r.talents.bb[`${g}.duration`], ratio = r.talents.bb[`${g}.hp_ratio`] ?? 1;
  const h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key);
  h.b.dealDamage(null, e, { amount: e.hp + 1, type: 'true', sourceless: true }); h.run(0.05);
  assert.equal(e.alive, true, 'the first knock-out is a rebirth'); assert.equal(e.s.flags.untargetable, true);
  h.run(dur + 0.2);
  assert.equal(e.alive, true); assert.ok(!e.s.flags.untargetable, 'stands up'); assert.ok(Math.abs(e.hp - e.s.maxHp * ratio) < 1, `${e.hp} vs ${e.s.maxHp * ratio}`);
  h.b.dealDamage(null, e, { amount: e.hp + 1, type: 'true', sourceless: true }); h.run(0.05);
  assert.equal(e.alive, false, 'the second knock-out is final');
});
const firstWith = (pred) => Object.keys(ENEMY_RECORDS.enemies).find(k => pred(ENEMY_RECORDS.enemies[k].levels[0]));
const group = (r, name) => Object.keys(r.talents.groups).find(g => g.toLowerCase() === name);
test('periodic_damage: loses the talent damage every second', () => {
  const key = 'enemy_1062_rager', r = ENEMY_RECORDS.enemies[key].levels[0], h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key);
  const hp = e.hp; h.run(3.05);
  assert.ok(Math.abs(hp - e.hp - 3 * r.talents.bb['periodic_damage.damage']) <= r.talents.bb['periodic_damage.damage'] + 1, `${hp - e.hp}`);
});
test('Refraction: RES rises by the talent value, and silence switches it off', () => {
  const key = firstWith(r => group(r, 'refracting') && r.abilities.some(a => a.text.includes('<$ba.refraction>'))), r = ENEMY_RECORDS.enemies[key].levels[0];
  const h = spawnAny(key, { seconds: 0.2, units: [] }), e = enemy(h, key), base = r.stats.res;
  assert.equal(e.s.res, Math.min(100, base + r.talents.bb[`${group(r, 'refracting')}.magic_resistance`]));
  h.b.applyStatus(e, 'silence', { duration: 3 }); h.run(0.2); assert.equal(e.s.res, base);
});
test('atkup: ATK rises once HP first drops below half', () => {
  const key = 'enemy_1025_reveng', r = ENEMY_RECORDS.enemies[key].levels[0], h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key), atk = e.s.atk;
  h.b.dealDamage(null, e, { amount: e.s.maxHp * 0.6, type: 'true', sourceless: true }); h.run(0.05);
  assert.ok(Math.abs(e.s.atk - atk * (1 + r.talents.bb['atkup.atk'])) < 1, `${e.s.atk}`);
});
test('epdamage: every attack hit adds the named element damage', () => {
  const key = 'enemy_1148_dssbr', h = spawnAny(key, { seconds: 0 }), els = [];
  h.b.on('damaged', c => { if (c.source?.defId === key && c.dmg.type === 'element') els.push(c.dmg.element); });
  h.runUntil(() => els.length > 0, 30); assert.deepEqual([...new Set(els)], ['neural']);
});
test('DeadSpawn: killed, it spawns its supported children', () => {
  const key = 'enemy_1195_sfyin', r = ENEMY_RECORDS.enemies[key].levels[0], g = group(r, 'deadspawn'), child = r.talents.bbStr[`${g}.enemy_key`];
  assert.ok(support.enemies[key].policy, 'supported'); assert.ok(support.enemies[child].policy, 'its child is supported');
  const h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key);
  h.b.dealDamage(null, e, { amount: 1e9, type: 'true', sourceless: true, ignoreTimes: true });
  for (let i = 0; i < 400 && e.alive; i++) { h.b.dealDamage(null, e, { amount: 1e9, type: 'true', sourceless: true }); h.step(); }
  h.run(0.5); assert.equal(h.b.units.filter(u => u.side === 'enemy' && u.defId === child).length, r.talents.bb[`${g}.cnt`]);
});
test('Must be damaged N times: it takes exactly N hits', () => {
  const key = 'enemy_1196_msfyin', n = ENEMY_RECORDS.enemies[key].levels[0].stats.maxHp, h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key);
  for (let i = 0; i < n - 1; i++) h.b.dealDamage(null, e, { amount: 1e6, type: 'phys', sourceless: true });
  h.run(0.05); assert.equal(e.alive, true, `${n - 1} hits`); h.b.dealDamage(null, e, { amount: 1, type: 'phys', sourceless: true }); h.run(0.05); assert.equal(e.alive, false);
});
test('Can only be blocked by units with at least N Block: block weight N', () => {
  const key = firstWith(r => r.abilities.some(a => /^Can only be blocked by units with at least \d+ Block$/.test(a.text)));
  const n = Number(ENEMY_RECORDS.enemies[key].levels[0].abilities.find(a => /at least \d+ Block/.test(a.text)).text.match(/(\d+) Block/)[1]);
  const h = spawnAny(key, { seconds: 0.1, units: [] }); assert.equal(enemy(h, key).blockWeight, n);
});
test('confinement/liberty: starts imprisoned with reduced ASPD and is freed after the talent number of attacks', () => {
  const key = Object.keys(support.enemies).find(k => support.enemies[k].features?.includes('talent:confinement')), r = ENEMY_RECORDS.enemies[key].levels[0];
  const h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key), aspd = r.stats.aspd;
  assert.ok(e.findBuff('ab:confined')); assert.equal(e.s.aspd, aspd + r.talents.bb['confinement.attack_speed'], 'confined ASPD');
  let attacks = 0; h.b.on('attack', c => { if (c.attacker === e) attacks++; });
  h.runUntil(() => e.findBuff('ab:liberty') || !e.alive, 120);
  assert.ok(e.findBuff('ab:liberty'), 'freed'); assert.equal(attacks, r.talents.bb['confinement.times']); assert.equal(e.findBuff('ab:confined'), null);
});
test('Evade: Physical dodge while unblocked, none while blocked', () => {
  const key = Object.keys(support.enemies).find(k => support.enemies[k].features?.includes('talent:Evade')), r = ENEMY_RECORDS.enemies[key].levels[0];
  const h = spawnAny(key, { seconds: 0.2 }), e = () => enemy(h, key);
  assert.equal(e().s.dodgePhys, r.talents.bb['Evade.prob']);
  h.runUntil(() => !e()?.alive || e().blockedBy, 120); h.run(0.1);
  if (e()?.alive) assert.equal(e().s.dodgePhys, 0);
});
test('taunt: the talent taunt level makes it more likely to be targeted', () => {
  const key = Object.keys(support.enemies).find(k => support.enemies[k].features?.includes('talent:taunt')), r = ENEMY_RECORDS.enemies[key].levels[0];
  const h = spawnAny(key, { seconds: 0.1, units: [] }); assert.equal(enemy(h, key).s.taunt, r.stats.tauntLevel + r.talents.bb['taunt.taunt_level']);
});
test('defdown: every attack hit adds one permanent, uncapped stack of the talent DEF to the operator hit', () => {
  const key = 'enemy_1004_mslime', r = ENEMY_RECORDS.enemies[key].levels[0], def = r.talents.bb['defdown.def'];
  assert.ok(support.enemies[key].features.includes('talent:defdown'));
  assert.equal(support.enemies.enemy_1500_skulsr.policy, null, 'the grenade DEF-down component is a different feature');
  const h = spawnAny(key, { seconds: 0.1 }), guard = h.b.units.find(u => u.side === 'ally'), base = guard.s.def;
  let hits = 0; h.b.on('damaged', c => { if (c.source?.defId === key && c.target === guard && c.dmg.type !== 'element') hits++; });
  h.runUntil(() => hits >= 3, 120); assert.ok(hits >= 3, `${hits} hits`);
  assert.equal(guard.findBuff('ab:defdown').stacks, hits); assert.equal(guard.s.def, base + def * hits);
  const e = enemy(h, key); h.b.dealDamage(null, e, { amount: 1e9, type: 'true', sourceless: true }); h.run(30);
  assert.equal(guard.s.def, base + def * hits, 'the stacks outlive their source');
});
test('approved features apply only to enemies that use them', () => {
  const h = spawnAny('enemy_1007_slime', { seconds: 0.2 }), e = enemy(h, 'enemy_1007_slime');
  assert.equal(e.s.flags.unblockable ?? false, false); assert.equal(e.s.flags.stealth ?? false, false); assert.equal(e.profile?.maxTargets ?? 1, 1);
});
