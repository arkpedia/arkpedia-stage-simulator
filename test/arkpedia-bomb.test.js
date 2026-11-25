// SPDX-License-Identifier: GPL-3.0-or-later
// Explosives Loading Point and the Anti-Witchcraft bomb (shared/arkpedia/stage-bomb-loader.js,
// shared/arkpedia/enemy-bomb-features.js; server/sim/content/arkpedia-stage-bomb-loaders.js, arkpedia-enemy-bombs.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../data/arkpedia-device-source.json' with { type: 'json' };
import enemyNative from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import inventory from '../data/arkpedia-content-inventory.json' with { type: 'json' };
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { bombLoaderNativeReviewed, bombLoaderDefinition } from '../shared/arkpedia/stage-bomb-loader.js';
import { bombCartNative, bombCarrierNative, bombCartParams } from '../shared/arkpedia/enemy-bomb-features.js';
import { enemyAttackTargets, sortAllyTargets } from '../server/sim/targeting.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const clone = v => JSON.parse(JSON.stringify(v));
const record = id => Object.values(ENEMY_RECORDS.enemies[id].levels)[0];
const battle = stage => {
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
  b.life = 999; b.getPlayer('arkpedia').dp = 99;
  return b;
};
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const send = b => {
  const L = [...b.stageBombLoaders.entries.values()][0];
  until(b, () => !b.stageBombLoaders.error(L.id), 60);
  const bomb = b.stageBombLoaders.activate(L.id);
  return { L, bomb, a: bomb.mem.ab.list.find(x => typeof x.carrierHit === 'function') };
};

test('the Loading Point, the bomb and its carrier are reviewed; changes are refused', () => {
  assert.equal(bombLoaderNativeReviewed(), true);
  const cost = clone(tables); cost.skills.sktok_outset.levels[0].blackboard.find(x => x.key === 'cost').value = 5;
  assert.equal(bombLoaderNativeReviewed(native, cost), false, 'a cheaper bomb');
  const many = clone(native); many.templates['trap_outset_s[summon]'].eventToActions.ON_BUFF_START[0]._unharmful = false;
  assert.equal(bombLoaderNativeReviewed(many), false, 'a harmful bomb');
  assert.throws(() => bombLoaderDefinition({ level: 1, skillLevel: 1, direction: 'UP' }), /Unsupported/, 'no branch');
  const cart = record('enemy_1369_bmbcar1'), n = nativeComponents(enemyNative, 'enemy_1369_bmbcar1');
  assert.equal(bombCartNative(cart, n), true);
  assert.equal(bombCartNative({ ...cart, stats: { ...cart.stats, moveSpeed: .8 } }, n), false, 'a faster bomb');
  assert.equal(bombCartNative({ ...cart, talents: { ...cart.talents, bb: { ...cart.talents.bb, 'SpCtrl.reduce_duration1': 5 } } }, n), false, 'a slower decay');
  assert.equal(bombCarrierNative(record('enemy_1370_bmbcar2'), nativeComponents(enemyNative, 'enemy_1370_bmbcar2')), true);
  assert.equal(bombCarrierNative(record('enemy_1370_bmbcar2'), n), false, 'the bomb tree is not the carrier');
  const p = bombCartParams(cart);
  assert.deepEqual([p.maxSp, p.initSp, p.speedPerSp, p.hitLoss, p.decay.after1, p.decay.step1, p.decay.after2, p.decay.step2],
    [10, 0, .1, -1, 3, -1, 6, -2]);
  assert.deepEqual([p.explosion.scale, p.explosion.radius, p.explosion.trigger, p.explosion.anim.dur], [10, 1.7, 1 + Math.fround(.1), 2]);
});

test('13-7: one bomb per Point for 10 DP; it waits at 0 SP; carrier hits are cancelled and drive it', async () => {
  for (const id of ['13-7_adverse_environment', '13-20', '13-20_adverse_environment', 'tr-24']) await load(id);
  const b = battle(await load('13-7'));
  const L = [...b.stageBombLoaders.entries.values()][0];
  assert.match(b.stageBombLoaders.error(L.id), /charging/);
  until(b, () => !b.stageBombLoaders.error(L.id), 60);
  assert.ok(Math.abs(b.time - 40) < .1, 'ready at 40 SP');
  const dp = b.getPlayer('arkpedia').dp;
  const bomb = b.stageBombLoaders.activate(L.id), a = bomb.mem.ab.list.find(x => typeof x.carrierHit === 'function');
  assert.equal(b.getPlayer('arkpedia').dp, dp - 10);
  assert.match(b.stageBombLoaders.error(L.id), /still on the field|charging/);
  assert.deepEqual([bomb.side, bomb.counted, bomb.profile.holdsBattle, bomb.profile.enemyTargetable, bomb.s.taunt], ['neutral', false, false, true, 1]);
  assert.deepEqual([a.carrier.defId, a.carrier.side, a.carrier.counted], ['enemy_1370_bmbcar2', 'enemy', false]);
  const at = [bomb.x, bomb.y];
  until(b, () => false, b.time + 2);
  assert.deepEqual([bomb.x, bomb.y], at, 'at 0 SP it does not move');
  // An operator's hit on the carrier is cancelled and adds 1 SP.
  const hp = a.carrier.hp;
  b.dealDamage(null, a.carrier, { amount: 300, type: 'phys', sourceless: true });
  assert.deepEqual([a.carrier.hp, a.sp], [hp, 1]);
  for (let i = 0; i < 12; i++) b.dealDamage(null, a.carrier, { amount: 300, type: 'phys', sourceless: true });
  assert.equal(a.sp, 10, 'capped at 10');
  // Damage on the bomb itself: -1 SP each.
  b.dealDamage(null, bomb, { amount: 100, type: 'phys', sourceless: true });
  assert.equal(a.sp, 9);
  until(b, () => false, b.time + 1);
  assert.ok(Math.hypot(bomb.x - at[0], bomb.y - at[1]) > 0.1, 'it moved while charged');
});

test('the bomb loses no SP for 3 s after a carrier hit, then 1/s, and 2/s from 6 s', async () => {
  // 13-7 with the bomb kept out of enemy selection (a test buff) and no operator on the field: only the decay acts.
  const b = battle(await load('13-7'));
  const { bomb, a } = send(b);
  b.addBuff(bomb, { key: 'test:unselectable', persist: true, flags: { untargetable: true } });
  for (let i = 0; i < 10; i++) b.dealDamage(null, a.carrier, { amount: 1, type: 'phys', sourceless: true });
  const t0 = b.time, sp = [];
  for (let k = 1; k <= 9; k++) { until(b, () => false, t0 + k - .05); sp.push(a.sp); }
  assert.ok(bomb.alive);
  const lost = sp.map((v, i) => (i ? sp[i - 1] : 10) - v);
  assert.deepEqual(lost.slice(0, 2), [0, 0], `quiet for the first 3 s (${sp})`);
  assert.ok(lost.slice(3, 5).every(x => x === 1), `1/s between 3 and 6 s (${sp})`);
  assert.ok(lost.slice(6).every(x => x === 2 || sp[sp.length - 1] === 0), `2/s from 6 s (${sp})`);
});

test('at the Altar the bomb explodes: 10x ATK True around it, the Altar dies, the bomb and carrier leave', async () => {
  const b = battle(await load('13-7'));
  const { L, bomb, a } = send(b);
  const altar = b.stageBloodAltars.entries[0];
  const boom = [];
  b.on('damaged', c => { if (c.dmg?.tags?.[0] === 'bombExplosion') boom.push({ t: b.time, target: c.target, amount: c.amount, type: c.type }); });
  // An operator-like driver: one carrier hit every 0.9 s keeps it moving.
  let last = -1;
  while (!a.boom && bomb.alive && b.time < 160) {
    if (b.time - last >= .9 && a.carrier?.alive) { last = b.time; b.dealDamage(null, a.carrier, { amount: 1, type: 'phys', sourceless: true }); }
    b.step();
  }
  assert.ok(a.boom, 'reaches the Altar');
  const start = b.time;
  assert.ok(Math.hypot(altar.col - bomb.x, altar.row - bomb.y) <= 1.1 + 1e-6);
  assert.equal(!!bomb.s.flags.invulnerable, true, 'INVINCIBLE through the cast');
  until(b, () => !bomb.alive, start + 3);
  assert.equal(bomb.alive, false); assert.equal(a.carrier, null);
  assert.equal(altar.unit.alive, false, 'the Altar dies');
  assert.ok(boom.every(h => h.type === 'true' && h.target.side === 'enemy' && Math.abs(h.t - start - Math.fround(1.1333333253860474)) < .05));
  const pulses = altar.pulses; until(b, () => false, b.time + 25); assert.equal(altar.pulses, pulses, 'no pulse after it dies');
  assert.equal(L.bomb, null); assert.equal(b.stageBombLoaders.error(L.id), null, 'the Point can send the next bomb');
});

test('enemies take the bomb before taunt-0 operators; a parked bomb never holds the win', async () => {
  const b = battle(await load('13-7'));
  const { bomb } = send(b);
  const shooter = b.spawnEnemy('enemy_1361_dthrow', { pos: [Math.round(bomb.y), Math.round(bomb.x) + 1], countInTotal: false });
  b.addBuff(shooter, { key: 'test:hold', persist: true, flags: { noMove: true } });
  const targets = sortAllyTargets(shooter, enemyAttackTargets(b, shooter, shooter.base.rangeRadius));
  assert.equal(targets[0], bomb, 'taunt 1 neutral bomb first');
  b.dealDamage(null, shooter, { amount: 1e7, type: 'true', sourceless: true });
  b.on('enemySpawn', ({ enemy: e }) => { if (e.counted) b.dealDamage(null, e, { amount: 1e7, type: 'true', sourceless: true }); });
  for (const e of b.enemies) if (e.counted && e.alive) b.dealDamage(null, e, { amount: 1e7, type: 'true', sourceless: true });
  until(b, () => b.finished, 900);
  assert.equal(b.reason, 'cleared');
});

test('an Altar with a multi-phase branch spawns a different route each time until all have run (TR-24)', async () => {
  const b = battle(await load('tr-24'));
  const altar = b.stageBloodAltars.entries[0];
  assert.equal(b.stageBranches.branches[altar.spec.branchId].randomPhases.length, 3);
  const routes = [];
  b.on('enemySpawn', ({ enemy: e }) => { if (e.mem.stageBranch) routes.push(e.route?.legs?.length ? JSON.stringify([e.x, e.y]) : null); });
  for (let i = 0; i < 3; i++) b.stageBranches.startRandomPhase(altar.spec.branchId);
  assert.equal(new Set(routes).size, 3, 'three different phases in one loop');
});

test('stages with Boneguards and a Loading Point stay blocked until the bomb stop is built', () => {
  for (const id of ['13-10', '13-10_adverse_environment']) {
    const s = inventory.stages.find(x => x.id === id);
    assert.ok(s.blockers.some(x => x.id === 'Bomb Loading Point' && /BmbcarBuff/.test(x.message)), id);
    assert.notEqual(manifest.stages.find(x => x.id === id)?.availability, 'available', id);
  }
});
