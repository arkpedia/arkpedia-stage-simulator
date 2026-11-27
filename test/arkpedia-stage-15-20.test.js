// SPDX-License-Identifier: GPL-3.0-or-later
// 15-20: PRTS, Source Code and the Mimic Machine (shared/arkpedia/enemy-prts-source-features.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { PRTS_SOURCE, MIMIC_MACHINE, prtsSourceNative, mimicMachineNative, prtsSourceParams, mimicMachineParams } from '../shared/arkpedia/enemy-prts-source-features.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url)));
const manifest = await read('../data/arkpedia-library.json'), evidence = await read('../data/arkpedia-enemy-native-abilities.json');
const records = (await read('../data/arkpedia-enemy-records.json')).enemies, support = await read('../data/arkpedia-enemy-support.json');
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const clone = v => JSON.parse(JSON.stringify(v));
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const open = async (id, operators = ['char_151_myrtle']) => {
  const entry = manifest.stages.find(s => s.id === id); assert.equal(entry.availability, 'available', id);
  const stage = await loader.load(entry);
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: operators.map(k => defaultBuild(mvp.operators[k])) }, { seed: 1 });
  const life = b.life; b.life = 999;
  return { b, stage, life, mimic: () => b.prtsBossPair?.mimic ?? null, source: () => b.prtsBossPair?.source ?? null,
    landed: () => !!b.prtsBossPair?.mimic && !b.prtsBossPair.mimic.unit.mem.prtsCarried };
};
const strike = (b, unit, amount) => b.dealDamage(null, unit, { amount, type: 'true', applyWay: 'none', tags: ['test'] });
const deploy = (b, id, row, col, dir = 'RIGHT') => {
  const u = b._deployOperator(id, row, col, dir, { fromSkill: true, predefined: true });
  u.base.maxHp = 1e6; u.markDirty(); u.hp = u.s.maxHp; return u;
};

test('both bosses are reviewed at both levels; other numbers are refused', () => {
  const view = id => nativeComponents(evidence, id), level = (id, i) => Object.values(records[id].levels)[i];
  for (const i of [0, 1]) {
    assert.equal(prtsSourceNative(level(PRTS_SOURCE, i), view(PRTS_SOURCE)), true);
    assert.equal(mimicMachineNative(level(MIMIC_MACHINE, i), view(MIMIC_MACHINE)), true);
  }
  for (const id of [PRTS_SOURCE, MIMIC_MACHINE]) assert.equal(support.enemies[id].policy, 'stats-attacks-and-features');
  const s = clone(level(PRTS_SOURCE, 0)); s.talents.bb['TimeUp.interval'] = 600;
  assert.equal(prtsSourceNative(s, view(PRTS_SOURCE)), false);
  const m = clone(level(MIMIC_MACHINE, 0)); m.talents.bb['MoveFly_p1.duration'] = 30;
  assert.equal(mimicMachineNative(m, view(MIMIC_MACHINE)), false);
  // The Spawn talent is in the prefab but off: a record that turns it on is refused.
  const spawn = clone(level(MIMIC_MACHINE, 0)); spawn.talents.bb['Spawn.enemy_key'] = 1;
  assert.equal(mimicMachineNative(spawn, view(MIMIC_MACHINE)), false);
  const orb = clone(level(MIMIC_MACHINE, 0)); orb.skills[0].bb.damage_scale = 3;
  assert.equal(mimicMachineNative(orb, view(MIMIC_MACHINE)), false);
  assert.deepEqual([prtsSourceParams(level(PRTS_SOURCE, 0)).deadline, prtsSourceParams(level(PRTS_SOURCE, 0)).spCost], [420, 50]);
  const p = mimicMachineParams(level(MIMIC_MACHINE, 0));
  assert.deepEqual([p.orb.steps, p.fly[0].cooldown, p.fly[1].range, p.ray.duration, p.stack], [14, 35, 4.5, 20, { atk: 100, max: 5 }]);
});

test('15-20: the hand puts the Mimic Machine on 2,3; PRTS, Source Code is invincible and loses the battle at 420 s', async () => {
  const { b, stage, mimic, source, landed } = await open('15-20');
  assert.deepEqual([stage.enemies[PRTS_SOURCE].stats.maxHp, stage.enemies[MIMIC_MACHINE].stats.maxHp], [50000, 25000]);
  b.step();
  const s = source().unit;
  assert.deepEqual([s.y, s.x, s.hitArea, !!s.s.flags.invulnerable, s.profile.noAttack], [1, 1, { w: 2.95, h: 4.95, dx: 0, dy: 2 }, true, true]);
  strike(b, s, 5000);
  assert.equal(s.hp, 50000);
  assert.equal(mimic(), null, 'the Mimic Machine comes 8 s in, carried by the hand');
  assert.ok(until(b, landed, 30));
  const m = mimic().unit;
  assert.ok(Math.abs(b.time - 16.6) < .3, `${b.time}`);
  assert.deepEqual([Math.round(m.y), Math.round(m.x), m.counted], [2, 3, false], 'a carried enemy is not counted');
  until(b, () => b.finished, 430);
  assert.deepEqual([b.reason, b.life], ['defeated', 0]);
  assert.ok(Math.abs(b.time - 420.5) < .2, `${b.time}`);
});

test('Write Restriction: 5 s after it lands, the four costliest waiting cards are sealed for 20 s', async () => {
  const ids = ['char_151_myrtle', 'char_002_amiya', 'char_010_chen', 'char_103_angel', 'char_136_hsguma', 'char_147_shining'].filter(k => mvp.operators[k]);
  assert.ok(ids.length >= 5, `${ids}`);
  const { b, mimic } = await open('15-20', ids);
  assert.ok(until(b, () => mimic()?.a.sealed > 0, 40));
  const sealed = ids.filter(id => b.deploymentRestrictionError(id)), free = ids.filter(id => !b.deploymentRestrictionError(id));
  assert.equal(sealed.length, 4);
  assert.ok(sealed.every(id => free.every(other => b.cost(id) >= b.cost(other))), JSON.stringify(ids.map(id => [id, b.cost(id)])));
  assert.equal(b.deploymentRestrictionError(sealed[0]), 'Sealed by the Mimic Machine.');
  const t = b.time;
  until(b, () => !b.deploymentRestrictionError(sealed[0]), t + 30);
  assert.ok(Math.abs(b.time - t - 20) < .2, `${b.time - t}`);
});

test('Heavy Ion Elastic Recoil: a slow orb that weakens as it flies and bursts 0.75 s after it reaches an operator', async () => {
  const { b, mimic, landed } = await open('15-20');
  assert.ok(until(b, landed, 30));
  const m = mimic().unit, a = mimic().a;
  a.flyAt = Infinity; // keep it on the ground for this test
  const far = deploy(b, 'char_151_myrtle', 6, 8);
  const hits = [];
  b.on('damaged', c => { if (c.dmg?.tags?.includes('mimic:orb')) hits.push([b.time, c.target, c.amount]); });
  assert.ok(until(b, () => a.orbs.length === 1, 60));
  const fired = b.time, o = a.orbs[0], d0 = Math.hypot(o.tx - o.x, o.ty - o.y);
  assert.deepEqual([o.hit, o.radius, o.scale, o.target], [1, 1.5, 2.4, far]);
  until(b, () => b.time >= fired + 1, fired + 2);
  assert.ok(Math.abs(d0 - Math.hypot(far.x - o.x, far.y - o.y) - 2) < .15, 'it flies 2 tiles a second');
  assert.ok(Math.abs(o.scale - 2.0) < 1e-9 && Math.abs(o.radius - 1.2) < 1e-9 && Math.abs(o.hit - .8) < 1e-9, JSON.stringify(o, ['hit', 'radius', 'scale']));
  let stopped = null;
  assert.ok(until(b, () => { if (stopped == null && o.fuse != null) stopped = b.time; return hits.length > 0; }, fired + 12), 'it bursts');
  assert.ok(Math.abs(hits[0][0] - stopped - .75) < .1, `${hits[0][0] - stopped}`);
  assert.ok(Math.hypot(far.x - o.x, far.y - o.y) <= o.hit + .25 + 1e-6, 'it stopped when the operator entered its collider');
  // Arts damage of the ATK at firing x the decayed scale (before RES); the scale never falls under 1.
  assert.deepEqual([hits[0][1], a.orbHits, o.atk], [far, 1, 600]);
  assert.ok(o.scale >= 1 && o.scale < 2.4 && o.radius >= .45 && hits[0][2] > 0, JSON.stringify([o.scale, o.radius, hits[0][2]]));
});

test('Dynamic Deployment: the hand holds it for 25 s (range 3.5, interval 3.5 s, two targets); damage past 30% of its HP lands it', async () => {
  const { b, mimic, landed } = await open('15-20');
  assert.ok(until(b, () => mimic()?.a.mode === 'takeoff', 80));
  const m = mimic().unit, a = mimic().a, P = b.stagePrts;
  assert.equal(!!m.s.flags.noMove, true, 'it stops and waits for the hand');
  assert.ok(until(b, () => a.mode === 'fly', b.time + 40));
  const up = b.time;
  assert.deepEqual([P.holding(m), m.isFlying, !!m.s.flags.unblockable, m.base.rangeRadius, m.s.bat, m.profile.maxTargets, !!m.s.flags.noMove], [true, true, true, 3.5, 3.5, 2, false]);
  const [y, x] = [m.y, m.x];
  until(b, () => b.time >= up + 5, up + 6);
  assert.ok(Math.hypot(m.y - y, m.x - x) > .5, 'it keeps its route in the air');
  assert.deepEqual([P.hand.y, P.hand.x], [m.y, m.x], 'the hand stays on it');
  strike(b, m, 25000 * .29);
  assert.equal(a.mode, 'fly');
  strike(b, m, 25000 * .02);
  assert.equal(a.mode, 'landing', 'at or under its recorded ratio the next hit lands it');
  assert.deepEqual([m.isFlying, m.base.rangeRadius, m.s.bat, m.profile.maxTargets, P.holding(m)], [false, 2.5, 4, 1, false]);
  assert.ok(until(b, () => a.mode === 'ground', b.time + 5));
  // The next take-off comes 35 s after the hand took hold.
  assert.ok(until(b, () => a.mode === 'takeoff', up + 60));
  assert.ok(Math.abs(b.time - (up + 35)) < .3, `${b.time - up}`);
  // A full flight lasts 25 s.
  assert.ok(until(b, () => a.mode === 'fly', b.time + 40));
  const second = b.time;
  assert.ok(until(b, () => a.mode === 'landing', second + 30));
  assert.ok(Math.abs(b.time - second - 25) < .2, `${b.time - second}`);
});

test('it cannot be downed in the air: a lethal hit lands it at 1 HP', async () => {
  const { b, mimic, landed } = await open('15-20');
  assert.ok(until(b, () => mimic()?.a.mode === 'fly', 120));
  const m = mimic().unit, a = mimic().a;
  strike(b, m, 1e6);
  assert.deepEqual([m.alive, m.hp, a.mode, a.downs], [true, 1, 'landing', 0]);
  assert.deepEqual([m.base.rangeRadius, m.s.bat, m.profile.maxTargets], [2.5, 4, 1]);
});

test('taking off under 30% HP: no hit lands it early except a lethal one', async () => {
  const { b, mimic, landed } = await open('15-20');
  assert.ok(until(b, () => mimic()?.a.mode === 'takeoff', 80));
  const m = mimic().unit, a = mimic().a;
  strike(b, m, 25000 * .8); // 20% left before the hand takes hold
  assert.ok(until(b, () => a.mode === 'fly', b.time + 40));
  assert.ok(a.fly.threshold < 0, `${a.fly.threshold}`);
  strike(b, m, 25000 * .15);
  assert.deepEqual([a.mode, Math.round(m.hp)], ['fly', 1250]);
  strike(b, m, 1e6);
  assert.deepEqual([a.mode, m.hp, m.alive], ['landing', 1, true]);
  // On the ground again it can be downed.
  assert.ok(until(b, () => a.mode === 'ground', b.time + 5));
  strike(b, m, 10);
  assert.deepEqual([a.mode, a.downs, m.hp], ['down', 1, 25000]);
});

test('Rebuild: downed, it is invincible while PRTS, Source Code fills 50 SP (1 a second, 1 a hit), then stands up with +100 ATK', async () => {
  const { b, mimic, source, landed } = await open('15-20');
  assert.ok(until(b, landed, 30));
  const m = mimic().unit, a = mimic().a, s = source().unit, sa = source().a, rate = b.dpRecoveryRateFor();
  assert.equal(b.stageWaveScheduler.wave, 0);
  const down = b.time;
  strike(b, m, 1e6);
  assert.deepEqual([m.alive, m.hp, a.mode, a.downs, !!m.s.flags.invulnerable], [true, 25000, 'down', 1, true]);
  // The first downing releases the wave: nothing of wave 0 holds it open any more.
  assert.equal(b.stageWaveScheduler.membership(m).dontBlockWave, true);
  assert.equal(b.stageWaveScheduler.membership(s).dontBlockWave, true);
  assert.ok(until(b, () => sa.mode === 'dizzy', b.time + 6));
  assert.ok(Math.abs(b.time - down - (1 + 2.667)) < .15, `${b.time - down}`); // Die, then Dizzy_Begin
  assert.deepEqual([!!s.s.flags.invulnerable, Math.round(b.dpRecoveryRateFor() / rate * 100) / 100], [false, 3.03]);
  const dizzy = b.time;
  strike(b, s, 1000); strike(b, s, 1000); strike(b, s, 1000);
  assert.deepEqual([s.hp, sa.sp], [47000, 3]);
  assert.ok(until(b, () => sa.mode === 'rising', b.time + 60));
  assert.ok(Math.abs(b.time - dizzy - 47) < .2, `${b.time - dizzy}`, 'three hits saved three seconds');
  assert.deepEqual([!!s.s.flags.invulnerable, a.mode], [true, 'reviving']);
  assert.ok(until(b, () => a.mode === 'ground', b.time + 3));
  assert.deepEqual([a.phase2, a.stacks, m.s.atk, !!m.s.flags.invulnerable, b.dpRecoveryRateFor()], [true, 1, 700, false, rate]);
  // A second downing does not release a wave again, and the stacks stop at five.
  for (let i = 0; i < 6; i++) {
    strike(b, m, 1e6);
    assert.ok(until(b, () => sa.mode === 'dizzy', b.time + 8), `dizzy ${i}`);
    sa.sp = 49;
    assert.ok(until(b, () => a.mode === 'ground', b.time + 8), `up ${i}`);
  }
  assert.deepEqual([a.stacks, m.s.atk, a.downs], [5, 1100, 7]);
});

test('defeating PRTS, Source Code while it is exposed ends the Mimic Machine too', async () => {
  const { b, mimic, source, landed } = await open('15-20');
  assert.ok(until(b, landed, 30));
  strike(b, mimic().unit, 1e6);
  assert.ok(until(b, () => source().a.mode === 'dizzy', b.time + 6));
  strike(b, source().unit, 1e6);
  assert.deepEqual([source().unit.alive, mimic().unit.alive, b.dpRecoveryRateFor() > 0, b.stageDpIntervalScale], [false, false, true, null]);
});

test('Chain Reaction: after a recovery it is held for 20 s and its beams burn operators on the line through each node', async () => {
  const { b, mimic, source, landed } = await open('15-20');
  assert.ok(until(b, landed, 30));
  const m = mimic().unit, a = mimic().a, sa = source().a;
  strike(b, m, 1e6);
  assert.ok(until(b, () => sa.mode === 'dizzy', b.time + 6));
  sa.sp = 49;
  assert.ok(until(b, () => a.mode === 'ground', b.time + 8));
  const nodes = [...b.stageWeakeningNodes.entries.values()];
  assert.deepEqual(nodes.map(d => [d.row, d.col]), [[2, 6], [5, 8]]);
  a.flyAt = Infinity; a.orbAt = Infinity; a.sealAt = Infinity;
  assert.ok(until(b, () => a.mode === 'fly' && a.fly.kind === 'ray', b.time + 60));
  const up = b.time, node = a.fly.nodes[0];
  assert.deepEqual([a.fly.nodes.length, m.profile.noAttack, m.isFlying], [2, true, true]);
  // Hold it still, and put one operator on the line 2 tiles beyond the first node and one well off both lines.
  b.addBuff(m, { key: 'test:hold', persist: true, flags: { noMove: true } });
  const on = deploy(b, 'char_151_myrtle', 6, 8), dx = node.col - m.x, dy = node.row - m.y, len = Math.hypot(dx, dy);
  on.x = node.col + dx / len * 2; on.y = node.row + dy / len * 2;
  const hits = [];
  b.on('damaged', c => { if (c.dmg?.tags?.includes('mimic:ray')) hits.push([b.time, c.target, c.dmg.type]); });
  const from = b.time;
  assert.ok(until(b, () => a.mode === 'landing', up + 25));
  assert.ok(Math.abs(b.time - up - 20) < .2, `${b.time - up}`, 'Chain Reaction lasts 20 s, not 25');
  const mine = hits.filter(h => h[1] === on);
  assert.ok(mine.length >= Math.floor(b.time - from) - 1 && mine.length <= Math.ceil(b.time - from) + 1, `${mine.length} in ${b.time - from}`);
  assert.ok(mine.every(h => h[2] === 'arts') && Math.abs(mine[1][0] - mine[0][0] - 1) < .1);
  on.x = 0; on.y = 8; // off every line
  // A node the player switched on is no target; with no target at all the flight ends at once.
  for (const d of nodes) { d.state = 'active'; d.mode = 'ally'; d.until = b.time + 500; }
  a.rayAt = b.time; a.flyAt = Infinity;
  until(b, () => b.time >= from + 60, from + 61);
  assert.equal(a.flights, 1, 'it does not take off for Chain Reaction without a target');
});

test('the stage runs to its deadline with a squad; H15-4 and the six-star stage use their own numbers', async () => {
  const hard = await open('h15-4');
  assert.deepEqual([hard.stage.enemies[PRTS_SOURCE].stats.maxHp >= 60000, hard.stage.enemies[MIMIC_MACHINE].level], [true, 1]);
  until(hard.b, () => hard.b.finished, 430);
  assert.deepEqual([hard.b.reason, (hard.b.errors ?? []).length], ['defeated', 0]);
  const six = await open('15-20_six_star');
  assert.deepEqual([six.life, six.stage.enemies[PRTS_SOURCE].stats.maxHp, six.stage.enemies[MIMIC_MACHINE].stats.atk], [1, 60000, 660]);
  // The six-star condition (move speed 130%) reaches the hand as well.
  six.b.step(); (await open('15-20')).b.step();
  const base = await open('15-20'); base.b.step();
  assert.ok(Math.abs(six.b.stagePrts.hand.s.moveSpeed / base.b.stagePrts.hand.s.moveSpeed - 1.3) < 1e-9);
  until(six.b, () => six.b.finished, 430);
  assert.deepEqual([six.b.reason, (six.b.errors ?? []).length], ['defeated', 0]);
});

const clearRun = async ({ breakMachines }) => {
  const { b, mimic, source } = await open('15-20');
  const boss = e => [PRTS_SOURCE, MIMIC_MACHINE].includes(e.def?.key), waves = new Set();
  let hits = 0;
  while (!b.finished && b.time < 400) {
    b.step(); waves.add(b.stageWaveScheduler.wave);
    // Every ordinary enemy on the field is defeated at once; the fixed forms are left standing unless asked.
    for (const e of [...b.enemies]) if (e.alive && !boss(e) && !e.mem.prtsCarried && e !== b.stagePrts.hand
      && (e.mem.prtsStatic ? breakMachines && e.mem.prtsStatic === 'trap_230_mpcatab' && waves.has(1) : e.counted !== false)) b.kill(e, null);
    const m = mimic(), s = source();
    if (m && !m.unit.mem.prtsCarried && m.a.mode === 'ground' && b.time > 30) strike(b, m.unit, 1e6);
    if (s?.a.mode === 'dizzy') { strike(b, s.unit, 5000); hits++; }
  }
  return { b, waves, hits, mimic: mimic(), source: source(),
    fixed: b.enemies.filter(e => e.alive && e.mem.prtsStatic).map(e => `${e.mem.prtsStatic}@${e.y},${e.x}`).sort() };
};

test('a cleared run: everything else defeated, the Mimic Machine downed, PRTS, Source Code defeated while exposed', async () => {
  const run = await clearRun({ breakMachines: false }), b = run.b;
  assert.deepEqual([b.reason, (b.errors ?? []).length, run.source.unit.alive, run.mimic.unit.alive], ['cleared', 0, false, false]);
  assert.ok(run.waves.has(1), 'the first downing let wave 1 start');
  assert.ok(run.hits >= 10 && b.time < 400 && b.total >= 29, `${run.hits} ${b.time} ${b.total}`);
  // Wave 1 sends two Shadows to 3,8 and 4,8, where wave 0's Hot Drink Machines stand as fixed forms: a taken
  // highland tile fails the deploy, and both Shadows are lost.
  assert.deepEqual([b.stagePrts.failed, run.fixed], [2, ['trap_230_mpcatab@3,8', 'trap_230_mpcatab@4,8']]);
});

test('with the Hot Drink Machines destroyed, the Shadows are fixed on their tiles', async () => {
  const run = await clearRun({ breakMachines: true }), b = run.b;
  assert.deepEqual([b.reason, (b.errors ?? []).length], ['cleared', 0]);
  assert.deepEqual([b.stagePrts.failed, run.fixed], [0, ['trap_232_mpgroub@3,8', 'trap_232_mpgroub@4,8']]);
});
