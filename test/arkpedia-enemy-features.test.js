// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import { ENEMY_FEATURES, recordFeatureIds } from '../shared/arkpedia/enemy-features.js';
import { enemyStealthed, canTargetAlly, canTargetEnemy, sortAllyTargets } from '../server/sim/targeting.js';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

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
test('death blast: its reviewed physical explosion hits nearby allies', () => {
  const key = 'enemy_1021_bslime', r = ENEMY_RECORDS.enemies[key].levels[0];
  assert.ok(support.enemies[key].features.includes('talent:boom'));
  const h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key), guard = h.b.units.find(u => u.side === 'ally');
  e.x = guard.x; e.y = guard.y;
  let hit = null; h.b.on('damaged', c => { if (c.source === e && c.target === guard) hit = c; });
  const hp = guard.hp; h.b.dealDamage(null, e, { amount: 1e9, type: 'true', sourceless: true }); h.run(0.05);
  assert.equal(e.alive, false); assert.ok(hit, 'the explosion dealt damage'); assert.equal(hit.dmg.type, 'phys');
  assert.equal(hit.dmg.amount, e.s.atk * r.talents.bb['boom.atk_scale']); assert.ok(guard.hp < hp);
});
test('cold death blast: it applies the reviewed Cold duration', () => {
  const key = 'enemy_1067_snslime', r = ENEMY_RECORDS.enemies[key].levels[0];
  const h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key), guard = h.b.units.find(u => u.side === 'ally');
  e.x = guard.x; e.y = guard.y;
  h.b.dealDamage(null, e, { amount: 1e9, type: 'true', sourceless: true }); h.run(0.05);
  const cold = guard.buffs.find(b => b.status === 'cold');
  assert.ok(cold, 'Cold applied'); assert.equal(cold.duration, r.talents.bb['boom.freeze']);
});
test('elemental death blast: it deals the named element at the reviewed ratio', () => {
  const key = 'enemy_2012_csbln', r = ENEMY_RECORDS.enemies[key].levels[0];
  const h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key), guard = h.b.units.find(u => u.side === 'ally');
  e.x = guard.x; e.y = guard.y;
  const elements = []; h.b.on('damaged', c => { if (c.source === e && c.target === guard && c.dmg.type === 'element') elements.push(c.dmg); });
  h.b.dealDamage(null, e, { amount: 1e9, type: 'true', sourceless: true }); h.run(0.05);
  assert.equal(elements.length, 1); assert.equal(elements[0].element, 'neural');
  assert.equal(elements[0].amount, e.s.atk * r.talents.bb['boom.ep_damage_ratio']);
});
test('split on death: the children spawn after the reviewed delay on the parent route', () => {
  const key = 'enemy_1130_infstr', r = ENEMY_RECORDS.enemies[key].levels[0], child = r.talents.bbStr['deathrattle.enemy_key'];
  assert.ok(support.enemies[child].policy, 'the child is supported');
  const h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key); h.b.autoFinish = false;
  h.b.dealDamage(null, e, { amount: 1e9, type: 'true', sourceless: true }); h.run(0.05);
  assert.equal(h.b.units.filter(u => u.side === 'enemy' && u.defId === child).length, 0, 'nothing before the delay');
  h.run(r.talents.bb['deathrattle.delay'] + 0.2);
  assert.equal(h.b.units.filter(u => u.side === 'enemy' && u.defId === child).length, r.talents.bb['deathrattle.cnt']);
});
test('atkSpeedDown: the blocker loses the reviewed ASPD while it stays blocked, and gets it back', () => {
  const key = 'enemy_1138_tumor', r = ENEMY_RECORDS.enemies[key].levels[0], h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key);
  const guard = h.b.units.find(u => u.side === 'ally'), base = guard.s.aspd;
  h.runUntil(() => !e.alive || e.blockedBy, 120); h.run(0.1);
  assert.ok(e.blockedBy, 'the guard blocks it'); assert.equal(guard.s.aspd, base + r.talents.bb['atkSpeedDown.attack_speed'] * 100);
  h.b.dealDamage(null, e, { amount: 1e9, type: 'true', sourceless: true }); h.run(0.1);
  assert.equal(guard.s.aspd, base, 'the debuff ends with its source');
});
test('Senior Caster: the normal attack splashes the four cardinal neighbours of its target', () => {
  const key = 'enemy_1018_aoemag', rec = ENEMY_RECORDS.enemies[key].levels[0];
  const a = chessRec({ id: 'splash_a', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const b = chessRec({ id: 'splash_b', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const h = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [a.chessId]: a, [b.chessId]: b } },
    units: [{ chessId: a.chessId, row: 9, col: 6 }, { chessId: b.chessId, row: 9, col: 7 }],
    enemies: [{ key, time: 0, route: 0 }], content: 'none', autoFinish: false, timeLimit: 30,
    setup: battle => installEnemyFeatures(battle) });
  const hits = { [a.chessId]: 0, [b.chessId]: 0 }; let splash = 0;
  h.b.on('damaged', c => { if (c.source?.defId !== key || c.target.side !== 'ally') return; hits[c.target.defId]++; if (c.dmg.tags?.includes('splash')) splash++; });
  h.runUntil(() => hits[a.chessId] > 0 && hits[b.chessId] > 0, 20);
  assert.ok(hits[a.chessId] > 0 && hits[b.chessId] > 0, 'both adjacent guards took damage');
  assert.ok(splash > 0, 'the second guard was hit by the cardinal splash');
});
test('Defender-4: other enemies in range gain the reviewed DEF aura', () => {
  const key = 'enemy_1017_defdrn', base = ENEMY_RECORDS.enemies[key].levels[0].stats.def, h = spawnAny(key, { seconds: 0.1, units: [] });
  h.b.autoFinish = false;
  const first = enemy(h, key), second = h.b.spawnEnemy(key, { pos: [first.y, Math.max(0, first.x - 1)] });
  h.run(0.8);
  assert.ok(first.s.def >= base + 300, `${first.s.def}`); assert.ok(second.s.def >= base + 300, `${second.s.def}`);
});
test('Skullshatterer grenade: a 5 s DEF multiplier on the target and its cardinal neighbours', () => {
  const key = 'enemy_1500_skulsr', rec = ENEMY_RECORDS.enemies[key].levels[0], pct = rec.talents.bb['defdown.def'];
  const a = chessRec({ id: 'grenade_a', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 300 } });
  const b = chessRec({ id: 'grenade_b', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 300 } });
  const h = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [a.chessId]: a, [b.chessId]: b } },
    units: [{ chessId: a.chessId, row: 9, col: 6 }, { chessId: b.chessId, row: 9, col: 7 }],
    enemies: [{ key, time: 0, route: 0 }], content: 'none', autoFinish: false, timeLimit: 40,
    setup: battle => installEnemyFeatures(battle) });
  const guards = h.b.units.filter(u => u.side === 'ally'), base = guards.map(g => g.s.def);
  h.runUntil(() => guards.every(g => g.findBuff('ab:defdownGrenade')), 25);
  for (let i = 0; i < guards.length; i++) {
    assert.ok(guards[i].findBuff('ab:defdownGrenade'), `${guards[i].defId} has the grenade debuff`);
    assert.ok(Math.abs(guards[i].s.def - base[i] * (1 + pct)) < 1, `${guards[i].defId}: ${guards[i].s.def} vs ${base[i] * (1 + pct)}`);
  }
  const enemy = h.b.units.find(u => u.side === 'enemy' && u.defId === key);
  h.b.dealDamage(null, enemy, { amount: 1e9, type: 'true', sourceless: true }); h.run(5.5);
  for (let i = 0; i < guards.length; i++) { assert.equal(guards[i].findBuff('ab:defdownGrenade'), null); assert.equal(guards[i].s.def, base[i]); }
});
test('Crownslayer: the reviewed Blink wrapper is claimed and blinks past its blocker', () => {
  const key = 'enemy_1502_crowns', rec = ENEMY_RECORDS.enemies[key].levels[0];
  const evidence = support.enemies[key].native[rec.prefabKey];
  assert.ok(support.enemies[key].policy, 'supported'); assert.equal(evidence.claimedWrappers, 1);
  assert.ok(support.enemies[key].features.includes('skill:blink'));
  const guard = chessRec({ id: 'crown_guard', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 300 } });
  const h = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [guard.chessId]: guard } },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }], enemies: [{ key, time: 0, route: 0 }],
    content: 'none', autoFinish: false, timeLimit: 40, setup: battle => installEnemyFeatures(battle) });
  h.run(20);
  assert.ok(h.eventsOf('fx').some(event => event[1] === 'blink'), 'the blink fired');
  assert.deepEqual(h.b.errors, []);
});
test('Reborn Creation: 90% Physical/Arts reduction and +1 Block for its blocker', () => {
  const key = 'enemy_1220_dzoms', h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key);
  const guard = h.b.units.find(u => u.side === 'ally'), baseBlock = guard.s.blockCnt;
  h.runUntil(() => !e.alive || e.blockedBy, 20); h.run(0.3);
  assert.ok(e.blockedBy, 'the creation is blocked'); assert.equal(guard.s.blockCnt, baseBlock + 1);
  const hp = e.hp; h.b.dealDamage(null, e, { amount: 1000, type: 'phys', sourceless: true }); h.run(0.05);
  assert.ok(hp - e.hp <= 100, `1000 physical was reduced to ${hp - e.hp}`);
});
test('Reborn Creation: a first death spawns the reviewed child after the delay', () => {
  const key = 'enemy_1222_dpvt', child = 'enemy_1220_dzoms', h = spawnAny(key, { seconds: 0.1 });
  assert.ok(support.enemies[child].policy, 'the child is supported');
  h.b.autoFinish = false;
  const e = enemy(h, key), delay = ENEMY_RECORDS.enemies[key].levels[0].talents.bb['deathrattle.delay'];
  h.b.dealDamage(null, e, { amount: 1e9, type: 'true', sourceless: true }); h.run(delay + 0.3);
  assert.equal(h.b.units.filter(u => u.side === 'enemy' && u.defId === child).length, 1);
});
test('vampire: up to three targets and healing from the damage actually dealt', () => {
  const key = 'enemy_1114_rgrdmn', rec = ENEMY_RECORDS.enemies[key].levels[0];
  const guard = chessRec({ id: 'vampire_guard', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 300 } });
  const h = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [guard.chessId]: guard } },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }], enemies: [{ key, time: 0, route: 0 }],
    content: 'none', autoFinish: false, timeLimit: 30, setup: battle => installEnemyFeatures(battle) });
  h.run(0.05);
  const e = h.b.units.find(u => u.side === 'enemy' && u.defId === key);
  assert.equal(e.profile.maxTargets, 3);
  e.hp = e.s.maxHp * 0.5; const before = e.hp;
  h.run(12);
  assert.ok(e.hp > before, `${before} -> ${e.hp}`);
});
test('Hatedrinker: ATK rises per living Reborn Creation, up to the talent cap', () => {
  const key = 'enemy_1226_dklord', creation = 'enemy_1220_dzoms';
  const defs = { [key]: ENEMY_RECORDS.enemies[key].levels[0], [creation]: ENEMY_RECORDS.enemies[creation].levels[0] };
  const h = makeBattle({ defs: { enemies: defs, chess: {} }, units: [], enemies: [{ key, time: 0, route: 0 }],
    content: 'none', autoFinish: false, timeLimit: 30, setup: battle => installEnemyFeatures(battle) });
  h.run(0.2); const e = h.b.units.find(u => u.side === 'enemy' && u.defId === key), base = e.s.atk;
  const c = h.b.spawnEnemy(creation, { pos: [e.y, Math.max(0, e.x - 1)] });
  assert.ok(c); h.run(0.6);
  assert.ok(Math.abs(e.s.atk - base * 1.15) < 1, `${e.s.atk} vs ${base * 1.15}`);
});
test('Yeti Caster: every third attack applies the reviewed 10 s Cold', () => {
  const key = 'enemy_1068_snmage', rec = ENEMY_RECORDS.enemies[key].levels[0];
  const guardRec = chessRec({ id: 'cold_guard', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 300 } });
  const h = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [guardRec.chessId]: guardRec } },
    units: [{ chessId: guardRec.chessId, row: 9, col: 6 }], enemies: [{ key, time: 0, route: 0 }],
    content: 'none', autoFinish: false, timeLimit: 40, setup: battle => installEnemyFeatures(battle) });
  let attacks = 0; h.b.on('attack', c => { if (c.attacker?.defId === key) attacks++; });
  h.runUntil(() => attacks >= 3, 30); h.run(0.1);
  assert.ok(attacks >= 3);
  const guard = h.b.units.find(u => u.side === 'ally');
  const cold = guard.buffs.find(b => b.status === 'cold');
  assert.ok(cold, 'the third attack applied Cold'); assert.equal(cold.duration, 10);
});
test('Chain Caster: Necrosis jumps to nearby targets with falloff', () => {
  const key = 'enemy_1225_dkmage', rec = ENEMY_RECORDS.enemies[key].levels[0];
  const a = chessRec({ id: 'chain_a', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const b = chessRec({ id: 'chain_b', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const h = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [a.chessId]: a, [b.chessId]: b } },
    units: [{ chessId: a.chessId, row: 9, col: 6 }, { chessId: b.chessId, row: 9, col: 7 }],
    enemies: [{ key, time: 0, route: 0 }], content: 'none', autoFinish: false, timeLimit: 40,
    setup: battle => installEnemyFeatures(battle) });
  const hits = { [a.chessId]: 0, [b.chessId]: 0 }, elements = new Set();
  h.b.on('damaged', c => { if (c.source?.defId !== key) return; if (c.target.defId in hits) hits[c.target.defId]++; if (c.dmg.type === 'element') elements.add(c.target.defId); });
  h.runUntil(() => hits[a.chessId] > 0 && hits[b.chessId] > 0, 30);
  assert.ok(hits[a.chessId] > 0 && hits[b.chessId] > 0, JSON.stringify(hits));
  assert.ok(elements.has(a.chessId) && elements.has(b.chessId), 'both targets received Necrosis');
});
test('Frost: the ally aura reduces ASPD by the reviewed amount', () => {
  const key = 'enemy_1042_frostd', h = spawnAny(key, { seconds: 0.1 });
  const guard = h.b.units.find(u => u.side === 'ally'), base = guard.s.aspd;
  h.runUntil(() => guard.findBuff('ab:frost') || !h.b.units.some(u => u.side === 'enemy' && u.alive), 30);
  assert.ok(guard.findBuff('ab:frost'), 'the aura reached the guard');
  assert.equal(guard.s.aspd, base - 50);
});
test('ASV: Reborn Creations gain the ATK aura and their attacks add Necrosis', () => {
  const asv = 'enemy_1224_dsuply', creation = 'enemy_1220_dzoms';
  const guard = chessRec({ id: 'asv_guard', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const h = makeBattle({ defs: { enemies: { [asv]: ENEMY_RECORDS.enemies[asv].levels[0], [creation]: ENEMY_RECORDS.enemies[creation].levels[0] },
      chess: { [guard.chessId]: guard } }, units: [{ chessId: guard.chessId, row: 9, col: 6 }],
    enemies: [{ key: asv, time: 0, route: 0 }, { key: creation, time: 0, route: 0 }],
    content: 'none', autoFinish: false, timeLimit: 40, setup: battle => installEnemyFeatures(battle) });
  const c = () => h.b.units.find(u => u.side === 'enemy' && u.defId === creation);
  h.run(0.8); const base = ENEMY_RECORDS.enemies[creation].levels[0].stats.atk;
  assert.ok(Math.abs(c().s.atk - base * 1.1) < 1, `${c().s.atk} vs ${base * 1.1}`);
  let element = false; h.b.on('damaged', e => { if (e.source === c() && e.dmg.type === 'element') element = true; });
  h.runUntil(() => element, 30);
  assert.ok(element, 'the creation attack applied Necrosis');
});
test('Punisher: every third attack stuns the target area for four seconds', () => {
  const key = 'enemy_1362_dfat', rec = ENEMY_RECORDS.enemies[key].levels[0];
  const guard = chessRec({ id: 'punish_guard', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 300 } });
  const h = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [guard.chessId]: guard } },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }], enemies: [{ key, time: 0, route: 0 }],
    content: 'none', autoFinish: false, timeLimit: 40, setup: battle => installEnemyFeatures(battle) });
  let attacks = 0; h.b.on('attack', c => { if (c.attacker?.defId === key) attacks++; });
  h.runUntil(() => attacks >= 3, 30); h.run(0.1);
  const g = h.b.units.find(u => u.side === 'ally'), stun = g.buffs.find(b => b.status === 'stun');
  assert.ok(stun, 'the third attack stunned the area'); assert.equal(stun.duration, 4);
});
test('Technical Scout: camouflage is ignored only inside the reviewed reveal range', () => {
  const key = 'enemy_1020_obsv', h = spawnAny(key, { seconds: 0.1 });
  const e = h.b.units.find(u => u.side === 'enemy' && u.defId === key), guard = h.b.units.find(u => u.side === 'ally');
  h.b.addBuff(guard, { key: 'test:camou', flags: { camou: true }, persist: true });
  e.x = guard.x + 1; e.y = guard.y;
  assert.equal(canTargetAlly(e, guard, true), true, 'revealed inside 3.3');
  e.x = guard.x + 5;
  assert.equal(canTargetAlly(e, guard, true), false, 'hidden outside the aura');
});
test('Tiacauh: flat DEF while blocked and the reviewed melee multiplier', () => {
  const defKey = 'enemy_1093_ccsbr', h = spawnAny(defKey, { seconds: 0.1 });
  const e = h.b.units.find(u => u.side === 'enemy' && u.defId === defKey), base = ENEMY_RECORDS.enemies[defKey].levels[0].stats.def;
  h.runUntil(() => e.blockedBy, 20); h.run(0.2);
  assert.ok(e.blockedBy); assert.equal(e.s.def, base + 130);

  const key = 'enemy_1096_ccwitch', rec = ENEMY_RECORDS.enemies[key].levels[0];
  const guard = chessRec({ id: 'tiacauh_guard', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const b = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [guard.chessId]: guard } },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }], enemies: [{ key, time: 0, route: 0 }],
    content: 'none', autoFinish: false, timeLimit: 30, setup: battle => installEnemyFeatures(battle) });
  b.run(0.05); const unit = b.b.units.find(u => u.defId === key), g = b.b.units.find(u => u.side === 'ally');
  unit.x = g.x; unit.y = g.y; b.step(); assert.ok(unit.blockedBy, 'the guard blocks it');
  let hit = null; b.b.on('damaged', c => { if (c.source === unit && c.dmg?.isAttack) hit = c; });
  b.runUntil(() => hit, 25);
  assert.ok(hit); assert.equal(hit.dmg.amount, unit.s.atk * 4);
});
test('Sankta SelfFear: first HP drop below half applies fear and the speed buff', () => {
  const key = 'enemy_10083_hlbird', h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key);
  h.b.dealDamage(null, e, { amount: e.s.maxHp * 0.6, type: 'true', sourceless: true }); h.run(0.05);
  assert.ok(e.buffs.some(b => b.status === 'fear'), 'fear applied'); assert.ok(e.findBuff('ab:fearRun'), 'speed buff applied');
});
test('Roar Knightclub: the timed DEF/RES buff applies and expires', () => {
  const key = 'enemy_1101_plkght', base = ENEMY_RECORDS.enemies[key].levels[0].stats.def, h = spawnAny(key, { seconds: 0.1 });
  const e = enemy(h, key); h.run(0.5);
  assert.equal(e.s.def, base + 3000); assert.equal(e.s.res, 95); assert.equal(e.findBuff('ab:timedStat').duration, 30);
  h.run(31);
  assert.equal(e.findBuff('ab:timedStat'), null); assert.equal(e.s.def, base);
});
test('Rhine Defense: the first Physical hit is fully blocked', () => {
  const key = 'enemy_1249_lysdb', h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key);
  const guard = chessRec({ id: 'shield_guard', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const hp = e.hp;
  h.b.dealDamage({ s: { atk: 1 } }, e, { amount: 100, type: 'phys', sourceless: true });
  assert.equal(e.hp, hp, 'first hit blocked');
  h.b.dealDamage({ s: { atk: 1 } }, e, { amount: 100, type: 'phys', sourceless: true });
  assert.ok(e.hp < hp, 'second hit lands');
});
test('Evade: unblocked dodge, initial timed dodge and the first low-HP dodge', () => {
  const unblocked = 'enemy_1159_swfmob', h1 = spawnAny(unblocked, { seconds: 0.1, units: [] }), e1 = enemy(h1, unblocked);
  h1.run(0.2); assert.equal(e1.s.dodgePhys, 0.4);

  const timed = 'enemy_1258_durman', h2 = spawnAny(timed, { seconds: 0.1 }), e2 = enemy(h2, timed);
  h2.run(0.5); assert.equal(e2.s.dodgePhys, 1); h2.run(21); assert.equal(e2.s.dodgePhys, 0);

  const low = 'enemy_1259_durwar', h3 = spawnAny(low, { seconds: 0.1, units: [] }), e3 = enemy(h3, low);
  assert.equal(e3.s.dodgePhys, 0); h3.b.dealDamage(null, e3, { amount: e3.s.maxHp * 0.6, type: 'true', sourceless: true }); h3.run(0.1);
  assert.equal(e3.s.dodgePhys, 1);
});
test('Volleyball cart: attack stacks raise ATK and a negative status clears them', () => {
  const key = 'enemy_1261_dursho', base = ENEMY_RECORDS.enemies[key].levels[0].stats.atk, h = spawnAny(key, { seconds: 0.1 });
  const e = enemy(h, key); h.runUntil(() => e.mem.ab?.list?.[0]?.n >= 3, 25); h.run(0.1);
  assert.equal(e.s.atk, base * 1.3);
  h.b.applyStatus(e, 'cold', { duration: 5, source: null }); h.run(0.1);
  assert.equal(e.findBuff('ab:atkUpStacks'), null); assert.equal(e.s.atk, base);
});
test('Sarkaz Grudgebearer: standby until injured, then combat-ready with two targets', () => {
  const key = 'enemy_1074_dbskar', h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key);
  assert.ok(e.s.flags.stun, 'standby stun'); assert.ok(e.findBuff('ab:standby'));
  h.b.dealDamage(null, e, { amount: e.s.maxHp * 0.01, type: 'true', sourceless: true }); h.run(0.1);
  assert.ok(!e.s.flags.stun, 'standby ends'); assert.ok(e.findBuff('ab:standbySpeed')); assert.equal(e.profile.maxTargets, 2);
});
test('Originium Colossus: the melee attack splashes the adjacent guard', () => {
  const key = 'enemy_10078_mprein', rec = ENEMY_RECORDS.enemies[key].levels[0];
  const a = chessRec({ id: 'splash_a', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const b = chessRec({ id: 'splash_b', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const h = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [a.chessId]: a, [b.chessId]: b } },
    units: [{ chessId: a.chessId, row: 9, col: 6 }, { chessId: b.chessId, row: 9, col: 7 }],
    enemies: [{ key, time: 0, route: 0 }], content: 'none', autoFinish: false, timeLimit: 30,
    setup: battle => installEnemyFeatures(battle) });
  const hits = { [a.chessId]: 0, [b.chessId]: 0 };
  h.b.on('damaged', c => { if (c.source?.defId === key && c.target.defId in hits) hits[c.target.defId]++; });
  h.runUntil(() => hits[a.chessId] > 0 && hits[b.chessId] > 0, 25);
  assert.ok(hits[a.chessId] > 0 && hits[b.chessId] > 0, JSON.stringify(hits));
});
test('target priority: lowest DEF and lowest HP fraction sort after the blocker', () => {
  const a = { s: { def: 500, maxHp: 1000, taunt: 0 }, aggroSeq: 1, hp: 800 };
  const b = { s: { def: 100, maxHp: 1000, taunt: 0 }, aggroSeq: 2, hp: 200 };
  assert.equal(sortAllyTargets({ blockedBy: null, profile: { targetPriority: 'lowestDef' } }, [a, b])[0], b);
  assert.equal(sortAllyTargets({ blockedBy: null, profile: { targetPriority: 'lowestHp' } }, [a, b])[0], b);
  assert.equal(sortAllyTargets({ blockedBy: a, profile: { targetPriority: 'lowestDef' } }, [a, b])[0], a);
});
test('Big Snowball Thrower: only the first attack is scaled', () => {
  const key = 'enemy_15002_dqwing', rec = ENEMY_RECORDS.enemies[key].levels[0];
  const guard = chessRec({ id: 'first_guard', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const h = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [guard.chessId]: guard } },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }], enemies: [{ key, time: 0, route: 0 }],
    content: 'none', autoFinish: false, timeLimit: 30, setup: battle => installEnemyFeatures(battle) });
  const hits = []; h.b.on('damaged', c => { if (c.source?.defId === key && c.dmg?.isAttack) hits.push(c.dmg.amount); });
  h.runUntil(() => hits.length >= 2, 25);
  const atk = h.b.units.find(u => u.defId === key).s.atk;
  assert.equal(hits[0], atk * 1.5); assert.equal(hits[1], atk);
});
test('Seed of Withering: detonates near a guard and dies', () => {
  const key = 'enemy_1269_nhfly', h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key);
  const guard = h.b.units.find(u => u.side === 'ally'), hp = guard.hp;
  h.runUntil(() => !e.alive, 20);
  assert.ok(!e.alive, 'it self-destructed'); assert.ok(guard.hp < hp, 'the guard took the blast');
});
test('Theater Golem: needs 4 Block and splashes allies around itself', () => {
  const key = 'enemy_2011_csppt', rec = ENEMY_RECORDS.enemies[key].levels[0];
  const a = chessRec({ id: 'golem_a', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const b = chessRec({ id: 'golem_b', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const h = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [a.chessId]: a, [b.chessId]: b } },
    units: [{ chessId: a.chessId, row: 9, col: 6 }, { chessId: b.chessId, row: 9, col: 7 }],
    enemies: [{ key, time: 0, route: 0 }], content: 'none', autoFinish: false, timeLimit: 30,
    setup: battle => installEnemyFeatures(battle) });
  h.run(0.05); const e = h.b.units.find(u => u.side === 'enemy' && u.defId === key), guards = h.b.units.filter(u => u.side === 'ally');
  e.profile.requiredBlock = 4;
  guards[0].s.blockCnt = 3; assert.equal(h.b._blockerFor(guards[0], e, 1), false);
  guards[0].s.blockCnt = 4; assert.equal(h.b._blockerFor(guards[0], e, 1), true);
  const other = guards[1]; other.x = e.x + 0.5; other.y = e.y;
  const hp = other.hp; const splash = e.mem.ab.list.find(a => a.dealt); splash.dealt({ dmg: { isAttack: true, type: 'phys' }, target: guards[0] }, h.b, e, splash);
  assert.ok(other.hp < hp, 'the nearby ally took the self-splash');
});
test('Wither Vanguard: attacks become Arts only on toxic tiles', () => {
  const key = 'enemy_1422_lrsldr', h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key), ability = e.mem.ab.list.find(a => a.hitOut);
  const toxic = { dmg: { isAttack: true, type: 'phys' } };
  ability.hitOut(toxic, { grid: { tile: () => ({ key: 'tile_toxicroad' }) } }, e);
  assert.equal(toxic.dmg.type, 'arts');
  const road = { dmg: { isAttack: true, type: 'phys' } };
  ability.hitOut(road, { grid: { tile: () => ({ key: 'tile_road' }) } }, e);
  assert.equal(road.dmg.type, 'phys');
});
test('Active Originium Storm: the growing aura damages the guard', () => {
  const key = 'enemy_1420_lrmm', h = spawnAny(key, { seconds: 0.1 }), guard = h.b.units.find(u => u.side === 'ally'), hp = guard.hp;
  let storm = false; h.b.on('damaged', c => { if (c.source?.defId === key && c.dmg?.tags?.includes('storm')) storm = true; });
  h.runUntil(() => storm, 25);
  assert.ok(storm, 'the storm hit the guard'); assert.ok(guard.hp < hp);
});
test('Guerrilla Herald: the battlefield aura buffs other enemies while it lives', () => {
  const herald = 'enemy_1080_sotidp', other = 'enemy_1222_dpvt';
  const h = makeBattle({ defs: { enemies: { [herald]: ENEMY_RECORDS.enemies[herald].levels[0], [other]: ENEMY_RECORDS.enemies[other].levels[0] } },
    units: [], enemies: [{ key: herald, time: 0, route: 0 }, { key: other, time: 0, route: 0 }], content: 'none', autoFinish: false,
    timeLimit: 30, setup: battle => installEnemyFeatures(battle) });
  h.run(0.8); const hd = enemy(h, herald), o = enemy(h, other);
  const baseAtk = ENEMY_RECORDS.enemies[other].levels[0].stats.atk, baseDef = ENEMY_RECORDS.enemies[other].levels[0].stats.def;
  assert.ok(Math.abs(o.s.atk - baseAtk * 1.1) < 1, `${o.s.atk} vs ${baseAtk * 1.1}`); assert.equal(o.s.def, baseDef + 100);
  h.b.kill(hd, null); h.run(1); assert.ok(Math.abs(o.s.atk - baseAtk) < 1); assert.equal(o.s.def, baseDef);
});
test('Sudaram: the attack hits both adjacent guards', () => {
  const key = 'enemy_1427_lrnazg', rec = ENEMY_RECORDS.enemies[key].levels[0];
  const a = chessRec({ id: 'sud_a', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const b = chessRec({ id: 'sud_b', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const h = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [a.chessId]: a, [b.chessId]: b } },
    units: [{ chessId: a.chessId, row: 9, col: 6 }, { chessId: b.chessId, row: 9, col: 7 }],
    enemies: [{ key, time: 0, route: 0 }], content: 'none', autoFinish: false, timeLimit: 30,
    setup: battle => installEnemyFeatures(battle) });
  const hits = { [a.chessId]: 0, [b.chessId]: 0 };
  h.b.on('damaged', c => { if (c.source?.defId === key && c.target.defId in hits) hits[c.target.defId]++; });
  h.runUntil(() => hits[a.chessId] > 0 && hits[b.chessId] > 0, 25);
  assert.ok(hits[a.chessId] > 0 && hits[b.chessId] > 0, JSON.stringify(hits));
});
test('Norport Civilian: friendly, untargetable, and grants max DP on the objective', () => {
  const key = 'enemy_1313_wdfmr', h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key), guard = h.b.units.find(u => u.side === 'ally');
  assert.equal(e.profile.friendly, true); assert.equal(e.profile.civilianDp, 2);
  assert.equal(canTargetEnemy(guard, e, {}), false);
  const before = h.b.flags.dpMax, leaked = h.b.leakedCount; h.b.leak(e);
  assert.equal(h.b.flags.dpMax, before + 2); assert.equal(h.b.leakedCount, leaked); assert.ok(!e.alive);
});
test('Spies: reveal is one-shot and applies the reviewed consequence', () => {
  const stealthKey = 'enemy_1315_wdyjd', h1 = spawnAny(stealthKey, { seconds: 0.1 }), e1 = enemy(h1, stealthKey);
  assert.equal(e1.profile.spy, true); assert.ok(e1.findBuff('ab:moveSpeed'));
  assert.equal(h1.b.revealIdentity(e1), true); assert.equal(e1.s.flags.stealth, true); assert.equal(h1.b.revealIdentity(e1), false);

  const attackKey = 'enemy_1314_wdnjd', h2 = spawnAny(attackKey, { seconds: 0.1 }), e2 = enemy(h2, attackKey);
  h2.b.revealIdentity(e2);
  const arm = e2.mem.ab.list.find(a => a.reveal); assert.ok(arm.armed);
  const c = { dmg: { isAttack: true, amount: 100 } }; arm.hitOut(c, h2.b, e2, arm);
  assert.equal(c.dmg.amount, 200); assert.equal(arm.armed, false);
});
test('Instigator: unrevealed spies cannot be blocked while it is unblocked', () => {
  const spy = 'enemy_1315_wdyjd', lock = 'enemy_1319_wdfmpm';
  const guard = chessRec({ id: 'lock_guard', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0 } });
  const h = makeBattle({ defs: { enemies: { [spy]: ENEMY_RECORDS.enemies[spy].levels[0], [lock]: ENEMY_RECORDS.enemies[lock].levels[0] }, chess: { [guard.chessId]: guard } },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }], enemies: [{ key: spy, time: 0, route: 0 }, { key: lock, time: 0, route: 0 }],
    content: 'none', autoFinish: false, timeLimit: 30, setup: battle => installEnemyFeatures(battle) });
  h.run(0.5); const s = enemy(h, spy), g = h.b.units.find(u => u.side === 'ally');
  s.x = g.x; s.y = g.y; assert.ok(h.b.identityLocks.size);
  assert.equal(h.b._checkBlock(s), false); h.b.identityLocks.clear(); assert.equal(h.b._checkBlock(s), true);
});
test('Checkpoint blink: the 1322 family advances after two attacks', () => {
  const key = 'enemy_1322_wdgyht', h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key), x0 = e.x;
  h.runUntil(() => e.x < x0 - 0.5 || !e.alive, 30);
  assert.ok(e.x < x0 - 0.5, `${e.x} vs ${x0}`);
});
test('Absurdist Operative: three attacks drain DP, then the ammo is gone', () => {
  const key = 'enemy_1317_wdexg', h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key);
  const owner = h.b.getPlayer(e.ownerId), ability = e.mem.ab.list.find(a => a.attack), c = { targets: [] };
  owner.dp = 50; ability.attack(c, h.b, e, ability); assert.equal(owner.dp, 48); assert.equal(ability.ammo, 2);
  ability.attack(c, h.b, e, ability); ability.attack(c, h.b, e, ability); assert.equal(owner.dp, 44); assert.equal(ability.ammo, 0);
  ability.attack(c, h.b, e, ability); assert.equal(owner.dp, 44, 'no drain without ammo');
});
test('Splitcaster: one Virtual Image at half HP, and the clone cannot split', () => {
  const key = 'enemy_1318_wdsmgc', h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key);
  h.b.dealDamage(null, e, { amount: e.s.maxHp * 0.6, type: 'true', sourceless: true }); h.run(0.1);
  const kids = h.b.enemies.filter(u => u.defId === key && u !== e); assert.equal(kids.length, 1); assert.equal(kids[0].profile.virtualImage, true);
  h.b.dealDamage(null, kids[0], { amount: kids[0].s.maxHp * 0.6, type: 'true', sourceless: true }); h.run(0.1);
  assert.equal(h.b.enemies.filter(u => u.defId === key && u !== e).length, 1, 'no second split');
});
test('1320: the first attack splashes, later attacks are single-target', () => {
  const key = 'enemy_1320_wdrrl', rec = ENEMY_RECORDS.enemies[key].levels[0];
  const a = chessRec({ id: 'aoa', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0, blockCnt: 3 } });
  const b = chessRec({ id: 'aob', profession: 'WARRIOR', stats: { atk: 0, maxHp: 1e6, def: 0, blockCnt: 3 } });
  const h = makeBattle({ defs: { enemies: { [key]: rec }, chess: { [a.chessId]: a, [b.chessId]: b } },
    units: [{ chessId: a.chessId, row: 9, col: 6 }, { chessId: b.chessId, row: 9, col: 7 }],
    enemies: [{ key, time: 0, route: 0 }], content: 'none', autoFinish: false, timeLimit: 30,
    setup: battle => installEnemyFeatures(battle) });
  const hits = { [a.chessId]: 0, [b.chessId]: 0 }; let attacks = 0;
  h.b.on('attack', c => { if (c.attacker?.defId === key) attacks++; });
  h.b.on('damaged', c => { if (c.source?.defId === key && c.target.defId in hits) hits[c.target.defId]++; });
  h.runUntil(() => attacks >= 2, 25); h.run(0.1);
  assert.ok(hits[a.chessId] + hits[b.chessId] >= 3, JSON.stringify(hits));
  assert.ok(Math.min(hits[a.chessId], hits[b.chessId]) >= 1, 'the first hit splashed both');
});
test('1321: the BornBugs summoner drops Seeds of Withering', () => {
  const key = 'enemy_1321_wdarft', h = spawnAny(key, { seconds: 0.1, units: [] }), seeds = [];
  h.b.on('enemySpawn', ({ enemy }) => { if (enemy.defId === 'enemy_1269_nhfly') seeds.push(enemy); });
  h.run(11); assert.ok(seeds.length >= 1, 'at least one seed spawned');
});
test('Sarkaz Caster lasso: the attack is 0.35x Arts and stuns for 20 s', () => {
  const key = 'enemy_1022_dmage', h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key), guard = h.b.units.find(u => u.side === 'ally');
  let hit = null; h.b.on('damaged', c => { if (c.source?.defId === key && c.target === guard) hit = c; });
  h.runUntil(() => hit, 25);
  assert.ok(hit); assert.equal(hit.dmg.type, 'arts'); assert.equal(hit.dmg.amount, e.s.atk * 0.35);
  const stun = guard.buffs.find(b => b.status === 'stun'); assert.ok(stun); assert.equal(stun.duration, 20);
});
test('Rotchaser: the hit applies the Arts bleed, healing removes it', () => {
  const key = 'enemy_1270_nhstlk', h = spawnAny(key, { seconds: 0.1 }), guard = h.b.units.find(u => u.side === 'ally');
  h.runUntil(() => guard.findBuff('ab:bleed'), 25);
  const bleed = guard.findBuff('ab:bleed'); assert.ok(bleed, 'bleed applied'); const hp = guard.hp;
  h.run(1.1); assert.ok(guard.hp < hp, 'bleed ticked');
  h.b.heal(guard, guard, 1, { self: true }); assert.equal(guard.findBuff('ab:bleed'), null);
});
test('Witherer: the death corruption zone damages nearby allies', () => {
  const key = 'enemy_1267_nhpbr', h = spawnAny(key, { seconds: 0.1 }), e = enemy(h, key), guard = h.b.units.find(u => u.side === 'ally');
  e.x = guard.x + 1; e.y = guard.y; h.b.autoFinish = false; const hp = guard.hp; h.b.kill(e, null); h.run(2);
  assert.ok(guard.hp < hp, `${guard.hp} vs ${hp}`);
});
test('named priority: the Ursus civilian/Talulah target sorts first', () => {
  const a = { def: { raw: { name: 'Ursus Civilian' } }, s: { taunt: 0 }, aggroSeq: 1 };
  const b = { def: { raw: { name: 'Guard' } }, s: { taunt: 0 }, aggroSeq: 2 };
  assert.equal(sortAllyTargets({ blockedBy: null, profile: { targetPriority: 'named', priorityNames: ['Ursus Civilian'] } }, [b, a])[0], a);
});
test('Altar Keeper: picks up a Beacon and drops it on death', () => {
  const keeper = 'enemy_1426_lrthef', beacon = 'enemy_1421_lrchld';
  const h = makeBattle({ defs: { enemies: { [keeper]: ENEMY_RECORDS.enemies[keeper].levels[0], [beacon]: ENEMY_RECORDS.enemies[beacon].levels[0] } },
    units: [], enemies: [{ key: keeper, time: 0, route: 0 }, { key: beacon, time: 0, pos: [9, 9] }], content: 'none', autoFinish: false,
    timeLimit: 30, setup: battle => installEnemyFeatures(battle) });
  h.run(0.6); const k = enemy(h, keeper);
  assert.equal(k.profile.carryingBeacon, true); assert.equal(h.b.enemies.filter(u => u.defId === beacon).length, 0);
  h.b.kill(k, null); h.run(0.1); assert.equal(h.b.enemies.filter(u => u.defId === beacon).length, 1, 'the Beacon dropped');
});
test('Drains 1 Life Point: the engine leak drains the record stat', () => {
  const key = 'enemy_1137_plasm';
  assert.ok(support.enemies[key].policy, 'supported by the existing leak rule');
  const h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key);
  let leaked = null; h.b.on('enemyLeak', c => { leaked = c.enemy; });
  h.b.leak(e); assert.equal(leaked, e); assert.equal(e.lpr, e.def.raw.stats.lpr);
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
  assert.ok(support.enemies.enemy_1500_skulsr.policy, 'the grenade component has its own reviewed branch');
  assert.ok(support.enemies.enemy_1500_skulsr.features.includes('talent:defdown'));
  const h = spawnAny(key, { seconds: 0.1 }), guard = h.b.units.find(u => u.side === 'ally'), base = guard.s.def;
  let hits = 0; h.b.on('damaged', c => { if (c.source?.defId === key && c.target === guard && c.dmg.type !== 'element') hits++; });
  h.runUntil(() => hits >= 3, 120); assert.ok(hits >= 3, `${hits} hits`);
  assert.equal(guard.findBuff('ab:defdown').stacks, hits); assert.equal(guard.s.def, base + def * hits);
  const e = enemy(h, key); h.b.dealDamage(null, e, { amount: 1e9, type: 'true', sourceless: true }); h.run(30);
  assert.equal(guard.s.def, base + def * hits, 'the stacks outlive their source');
});
test('enhance: every other enemy killed anywhere adds one permanent ATK/ASPD stack, up to the talent cap', () => {
  const key = 'enemy_1103_wdkght', r = ENEMY_RECORDS.enemies[key].levels[0], bb = k => r.talents.bb[`enhance.${k}`];
  for (const k of ['enemy_4009_murgby', 'enemy_4010_mubsbl']) assert.equal(support.enemies[k].policy, null, 'a different enhance component');
  const h = spawnAny(key, { seconds: 0.1, units: [] }), e = enemy(h, key), atk = e.s.atk, aspd = e.s.aspd;
  const kill = u => { h.b.dealDamage(null, u, { amount: 1e9, type: 'true', sourceless: true }); h.run(0.05); };
  const other = () => h.b.spawnEnemy(key, { pos: [0, 0] });
  h.b.leak(other()); h.run(0.05); assert.equal(e.findBuff('ab:enhance'), null, 'a leak is not a kill');
  kill(other()); assert.equal(e.findBuff('ab:enhance').stacks, 1);
  assert.ok(Math.abs(e.s.atk - atk * (1 + bb('atk'))) < 1, `${e.s.atk}`); assert.equal(e.s.aspd, aspd + bb('attack_speed'));
  for (let i = 0; i < bb('max_stack_cnt') + 3; i++) kill(other());
  assert.equal(e.findBuff('ab:enhance').stacks, bb('max_stack_cnt'), 'capped');
  assert.ok(Math.abs(e.s.atk - atk * (1 + bb('atk') * bb('max_stack_cnt'))) < 1);
});
test('approved features apply only to enemies that use them', () => {
  const h = spawnAny('enemy_1007_slime', { seconds: 0.2 }), e = enemy(h, 'enemy_1007_slime');
  assert.equal(e.s.flags.unblockable ?? false, false); assert.equal(e.s.flags.stealth ?? false, false); assert.equal(e.profile?.maxTargets ?? 1, 1);
});
