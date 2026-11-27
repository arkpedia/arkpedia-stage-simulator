// SPDX-License-Identifier: GPL-3.0-or-later
// 14-18: the Kindling Revenant (shared/arkpedia/enemy-kindling-revenant-features.js), its Torrent Beam Activators, Core
// Amplifiers and beam system (shared/arkpedia/stage-kindling-revenant.js; server/sim/content/arkpedia-stage-kindling-revenant.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import deviceNative from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import deviceTables from '../data/arkpedia-device-source.json' with { type: 'json' };
import { revenantGunNativeReviewed, revenantCoreNativeReviewed } from '../shared/arkpedia/stage-kindling-revenant.js';
import { revenantSystemNativeReviewed, compileRevenantBeamRule, revenantBeamReach, revenantBeamDamage, REVENANT_FIRST, REVENANT_SECOND,
  REVENANT_SYSTEM } from '../shared/arkpedia/stage-kindling-revenant-beams.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const support = JSON.parse(await readFile(new URL('../data/arkpedia-enemy-support.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const clone = v => JSON.parse(JSON.stringify(v));
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const RULE = { enemyStartCol: 4, allyStartCol: 11, difs: [0, 1, 2, 3, 4, 5, 6], offsets: [1, 2, 3, 4, 5, 6, 7],
  enemy: { base: 150, step: 25, bound: 400 }, ally: { base: 150, step: 25, bound: 400 }, bossScale: 100, interval: 1, rows: 5 };
/** The stage with a one-operator squad kept on the bench. `life` 999 unless a test needs the real 3. */
const battle = async (id = '14-18', { life = 999 } = {}) => {
  const stage = await load(id);
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
  if (life != null) b.life = life;
  b.step();
  return b;
};
/** Removes the preset Wiš'adel and every enemy but the Revenant as it appears, so only the scripted clocks run. */
const quiet = async (id, opts) => {
  const b = await battle(id, opts);
  const wis = b.bench.char_1035_wisdel.unit; if (wis?.alive) b.retreat(wis, { reason: 'withdraw', permanent: true });
  const sweep = e => { if (e.alive && ![REVENANT_FIRST, REVENANT_SECOND].includes(e.def?.key ?? e.defId) && !e.mem.test) b._remove(e, 'withdraw', null, true); };
  for (const e of [...b.enemies]) if (e.kind === 'enemy') sweep(e);
  b.on('enemySpawn', ({ enemy }) => b.after(0, () => sweep(enemy)));
  return b;
};
const smash = (b, core) => b.dealDamage(null, core.unit, { amount: 1e6, type: 'true', sourceless: true });
/** Breaks each exposed core as soon as it is exposed, until the second form is in play. */
const toSecondForm = (b, limit = 400) => until(b, () => { for (const c of b.stageRevenant.cores) if (c.exposed && c.unit.hp > 1) smash(b, c);
  return !!b.stageRevenant.second && b.stageRevenant.beams.on; }, limit);
const dummy = (b, row, col) => {
  const e = b.spawnEnemy('enemy_1428_lrsoul', { pos: [row, col], countInTotal: false }); e.mem.test = true;
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true, disarm: true } });
  e.base.maxHp = 1e9; e.markDirty(); e.hp = e.s.maxHp;
  return e;
};

test('the guns, cores and beam system are reviewed; changes and H14-3\'s numbers are refused', () => {
  assert.equal(revenantGunNativeReviewed(), true);
  assert.equal(revenantCoreNativeReviewed(), true);
  assert.equal(revenantSystemNativeReviewed(), true);
  const n = clone(deviceNative);
  n.prefabs.projectile_enemy_lrdead_p1.components.find(c => '_keepAlreadyHitTime' in c.data).data._keepAlreadyHitTime = .5;
  assert.equal(revenantGunNativeReviewed(n), false, 'a faster beam');
  const t = clone(deviceTables);
  t.devices.trap_159_lrcore.phases[0].attributesKeyFrames[1].data.maxHp = 9000;
  assert.equal(revenantCoreNativeReviewed(deviceNative, t), false, 'a different core HP');
  const t2 = clone(deviceTables);
  t2.skills.sktok_lrcore.levels[0].spData.spCost = 10;
  assert.equal(revenantCoreNativeReviewed(deviceNative, t2), false, 'a cheaper core skill');
  const rune = values => ({ key: 'env_system_new', blackboard: [{ key: 'key', value: 0, valueStr: REVENANT_SYSTEM },
    { key: 'difs', value: 0, valueStr: '0|1|2|3|4|5|6' }, { key: 'offsets', value: 0, valueStr: '1|2|3|4|5|6|7' },
    ...Object.entries(values).map(([key, value]) => ({ key, value, valueStr: null }))] });
  const numbers = { enemy_eff_start_col: 4, ally_eff_start_col: 11, base_enemy_atk: 150, base_ally_atk: 150, bound_ally_atk: 400,
    bound_enemy_atk: 400, atk_scale_to_boss: 100, dmg_interval: 1, ally_atk_step: 25, enemy_atk_step: 25 };
  assert.deepEqual(compileRevenantBeamRule(rune(numbers)), RULE);
  assert.throws(() => compileRevenantBeamRule(rune({ ...numbers, ally_eff_start_col: 12, base_enemy_atk: 50, base_ally_atk: 200, bound_ally_atk: 500,
    bound_enemy_atk: 500, atk_scale_to_boss: 60, ally_atk_step: 50, enemy_atk_step: 50 })), /Unsupported Kindling Revenant beam rule/);
});

test('beam reach: the red beams reach the guns until the first core skill; the gold beams reach the Revenant only six ahead', () => {
  const reach = (e, a, gold) => revenantBeamReach(RULE, e, a, gold);
  assert.deepEqual(reach(0, 0, false), { red: null, gold: null, bossHit: false });
  assert.deepEqual(reach(1, 0, false), { red: [4, 10], gold: null, bossHit: false });
  assert.deepEqual(reach(1, 1, true), { red: [4, 9], gold: [10, 10], bossHit: false });
  assert.deepEqual(reach(5, 1, true), { red: [4, 9], gold: [10, 10], bossHit: false }, 'behind counts as level');
  assert.deepEqual(reach(1, 4, true), { red: [4, 6], gold: [7, 10], bossHit: false });
  assert.deepEqual(reach(1, 6, true), { red: [4, 4], gold: [5, 10], bossHit: false });
  assert.deepEqual(reach(1, 7, true), { red: null, gold: [4, 10], bossHit: true });
  assert.deepEqual(reach(2, 7, true), { red: [4, 4], gold: [5, 10], bossHit: false }, 'one enemy cast pushes the gold beams off it');
  assert.deepEqual(reach(1, 12, true), { red: null, gold: [4, 10], bossHit: true });
  assert.deepEqual([1, 2, 11, 30].map(e => revenantBeamDamage(RULE.enemy, e)), [150, 175, 400, 400]);
});

test('14-18 and its adverse variant compile; H14-3 stays blocked; both forms are supported', async () => {
  const stage = await load('14-18');
  assert.deepEqual(stage.rules.revenantBeams, RULE);
  assert.deepEqual(stage.waveProgram.branches.branch_1.sequencePhases.map(p => p.length), [6, 7, 9]);
  const cores = stage.devices.filter(d => d.key === 'trap_159_lrcore').map(d => [d.row, d.col, d.instance.level, d.instance.skillLevel, d.instance.branchId ?? null]);
  assert.deepEqual(cores, [[5, 9, 1, 1, 'branch_1'], [4, 7, 2, 2, 'branch_1'], [2, 7, 3, 3, 'branch_1'], [1, 9, 4, 4, null]]);
  assert.deepEqual(stage.devices.filter(d => d.key === 'trap_160_lrlgun').map(d => [d.row, d.col]), [[1, 11], [2, 11], [3, 11], [4, 11], [5, 11]]);
  assert.equal(stage.waveProgram.predefined.entries[0].build.id, 'char_1035_wisdel');
  assert.ok(stage.enemies[REVENANT_SECOND], 'the summoned second form is carried by the stage');
  await load('14-18_adverse_environment');
  assert.equal(manifest.stages.find(s => s.id === 'h14-3_adverse_environment').availability, 'blocked');
  for (const key of [REVENANT_FIRST, REVENANT_SECOND]) assert.equal(support.enemies[key].policy, 'stats-attacks-and-features', key);
  assert.deepEqual(support.enemies[REVENANT_FIRST].spawns, [REVENANT_SECOND]);
});

test('Soul Echo: the guns fire 0.5 s in; each second the first unit in a row takes the gun\'s ATK as Arts damage', async () => {
  const b = await battle(), R = b.stageRevenant, wis = b.bench.char_1035_wisdel.unit;
  assert.equal(R.first.unit.s.flags.invulnerable, true);
  assert.equal(R.gunSync, 150);
  assert.deepEqual(R.cores.map(c => [c.spec.unlock, c.exposed, !!c.unit.s.flags.invulnerable]), [[1, true, false], [2, false, true], [3, false, true], [4, false, true]]);
  b.getPlayer('arkpedia').dp = 99; b.setViewport?.('fullscreen-workspace');
  const myrtle = b.deployOperator('char_151_myrtle', 4, 8, 'LEFT');
  const hits = [];
  // Row 4 only (her summoned shadows stand in other rows and are the first units there).
  b.on('damaged', ({ target, dmg, amount }) => { if (dmg?.tags?.includes('revenant:echo') && target.tileR === 4) hits.push([b.time, target, amount]); });
  const t0 = R.guns[0].firing.at - .5;
  until(b, () => b.time >= t0 + 3.6, t0 + 5);
  assert.ok(hits.length >= 3 && hits.every(([, u]) => u === wis), 'only the unit nearest the gun');
  assert.ok(Math.abs(hits[0][0] - t0 - .5) < .07, `first hit ${hits[0][0] - t0}`);
  assert.ok(Math.abs(hits[1][0] - hits[0][0] - 1) < .07);
  assert.ok(Math.abs(hits[0][2] - 150 * (1 - wis.s.res / 100)) < 1, `${hits[0][2]}`);
  // With the first unit gone, the next one in the row takes it.
  b.retreat(wis, { reason: 'withdraw', permanent: true });
  hits.length = 0;
  until(b, () => hits.length > 0, b.time + 1.2);
  assert.equal(hits[0]?.[1], myrtle);
});

test('breaking the exposed core: invincible again within 0.5 s, its branch phase runs, the guns stop, the next Echo comes 90 s later', async () => {
  const b = await battle(), R = b.stageRevenant, [c1, c2] = R.cores;
  b.retreat(b.bench.char_1035_wisdel.unit, { reason: 'withdraw', permanent: true });
  const spawned = [];
  b.on('enemySpawn', ({ enemy }) => spawned.push([b.time, enemy.defId, enemy.counted]));
  until(b, () => b.time >= 2, 3);
  smash(b, c1);
  assert.equal(Math.round(c1.unit.hp), 1, 'UNDEADABLE');
  const t = b.time;
  assert.ok(until(b, () => c1.broken, t + .6));
  const broken = b.time;
  assert.equal(c1.unit.s.flags.invulnerable, true);
  assert.ok(until(b, () => !R.guns[0].firing, t + 1.6), 'the controller stops the guns on its next check');
  const stopped = b.time;
  assert.ok(until(b, () => R.first.echoes === 2, stopped + 91));
  assert.ok(Math.abs(b.time - stopped - 90) < .1, `${b.time - stopped}`);
  assert.equal(c2.exposed, true);
  // Phase 0 of branch_1: six groups of Soul Maelstroms, none counted.
  assert.equal(spawned.filter(([, id]) => id === 'enemy_1428_lrsoul').length, 19);
  assert.ok(spawned.every(([, , counted]) => counted === false));
  assert.ok(Math.abs(spawned[0][0] - broken - 8) < .1, `first spawn ${spawned[0][0] - broken} s after the break`);
});

test('a Soul Maelstrom near a core is absorbed: +20 gun ATK until the Echo ends; the third Echo\'s end keeps it; the fourth adds 100', async () => {
  const b = await quiet(), R = b.stageRevenant;
  const feed = core => { const e = dummy(b, core.row, core.col - .5); b.step(); assert.equal(e.alive, false, 'absorbed'); };
  feed(R.cores[1]);
  assert.equal(R.gunAtk(), 170);
  for (const [i, expected] of [[0, 150], [1, 150], [2, 190]]) {
    assert.ok(until(b, () => R.cores[i].exposed, b.time + 95));
    if (i === 2) feed(R.cores[3]);
    smash(b, R.cores[i]);
    assert.ok(until(b, () => !R.guns[0].firing, b.time + 2));
    assert.equal(R.gunAtk(), expected, `after Echo ${i + 1}`);
    if (i < 2) feed(R.cores[3]);
  }
  assert.ok(until(b, () => R.cores[3].exposed, b.time + 65));
  assert.equal(R.gunAtk(), 290, 'the fourth Echo: +100 for good');
});

test('the first form\'s deadline: 500 s in, 99 life points are lost', async () => {
  const b = await quiet('14-18', { life: null });
  assert.equal(b.life, 3);
  until(b, () => false, 510);
  assert.equal(b.finished, true);
  assert.equal(b.reason, 'defeated');
  assert.ok(Math.abs(b.time - 500) < .2, `${b.time}`);
});

test('all cores broken: 5 s later the wave is released and the second form appears on the first\'s tile; its first cast starts the beams', async () => {
  const b = await quiet(), R = b.stageRevenant;
  let allBroken = null;
  assert.ok(until(b, () => { for (const c of R.cores) if (c.exposed && c.unit.hp > 1) smash(b, c); if (allBroken == null && R.first.done) allBroken = b.time; return !!R.second; }, 400));
  assert.ok(Math.abs(b.time - allBroken - 5) < .1, `${b.time - allBroken}`);
  const boss = R.second, born = b.time;
  assert.deepEqual([boss.y, boss.x], [1, 1]);
  assert.deepEqual({ ...boss.hitArea }, { w: 3.95, h: 4.95, dx: -.5, dy: 2 });
  assert.equal(boss.s.maxHp, 500000);
  assert.equal(boss.s.flags.invulnerable, true, 'not in play while it appears');
  assert.equal(R.absorbing, false);
  assert.ok(until(b, () => R.beams.on, born + 6));
  assert.ok(Math.abs(b.time - born - 3 - 1.84) < .1, `${b.time - born}`);
  assert.equal(R.beams.enemy, 1);
  assert.deepEqual(R.beamReach, { red: [4, 10], gold: null, bossHit: false });
  // The cores: second mode, full HP, charged, no damage taken.
  assert.ok(R.cores.every(c => c.second && c.unit.hp === c.unit.s.maxHp && c.sp === 25));
  smash(b, R.cores[0]);
  assert.equal(R.cores[0].unit.hp, R.cores[0].unit.s.maxHp);
  // Raging Souls: first 12 s after the first cast ends, then every 15 s.
  const ignited = b.time;
  assert.ok(until(b, () => R.beams.enemy === 2, ignited + 20));
  assert.ok(Math.abs(b.time - ignited - (3.84 - 1.84) - 12 - 2.84) < .15, `${b.time - ignited}`);
  const second = b.time;
  assert.ok(until(b, () => R.beams.enemy === 3, second + 16));
  assert.ok(Math.abs(b.time - second - 15) < .15, `${b.time - second}`);
});

test('the beams: red damages operators, a core skill costs 25 SP and locks the others 1.8 s, gold damages enemies and, six ahead, the Revenant x100', async () => {
  const b = await quiet(), R = b.stageRevenant;
  b.getPlayer('arkpedia').dp = 99; b.setViewport?.('fullscreen-workspace');
  const myrtle = b.deployOperator('char_151_myrtle', 3, 6, 'LEFT');
  myrtle.base.maxHp = 1e6; myrtle.markDirty(); myrtle.hp = myrtle.s.maxHp;
  assert.ok(toSecondForm(b));
  const boss = R.second, [c1, c2] = R.cores, taken = { red: [], gold: [], boss: [] };
  const foe = dummy(b, 3, 9);
  b.on('damaged', ({ target, dmg, amount, type }) => {
    if (dmg?.tags?.includes('revenant:redBeam')) taken.red.push([target, amount, type]);
    if (dmg?.tags?.includes('revenant:goldBeam')) (target === boss ? taken.boss : taken.gold).push([target, amount, type]);
  });
  until(b, () => taken.red.length > 0, b.time + 1.2);
  assert.deepEqual([taken.red[0][0], taken.red[0][2]], [myrtle, 'arts']);
  assert.ok(Math.abs(taken.red[0][1] - 150 * (1 - myrtle.s.res / 100)) < 1);
  // First core skill: the gold beams start one column from the guns.
  assert.equal(R.error(c1.id), null);
  R.activate(c1.id);
  assert.equal(c1.sp, 0);
  assert.match(R.error(c1.id), /charging/);
  assert.match(R.error(c2.id), /just used/);
  assert.deepEqual(R.beamReach, { red: [4, 9], gold: [10, 10], bossHit: false });
  const used = b.time;
  assert.ok(until(b, () => R.error(c2.id) == null, used + 2));
  assert.ok(Math.abs(b.time - used - 1.8) < .07, `${b.time - used}`);
  // Hits charge a second-mode core: 1 SP each, no damage.
  const hp = c1.unit.hp;
  for (let i = 0; i < 25; i++) b.dealDamage(myrtle, c1.unit, { amount: 500, type: 'phys', isAttack: true });
  assert.deepEqual([c1.sp, c1.unit.hp], [25, hp]);
  b.step(); b.step();
  until(b, () => b.time >= c1.tauntAt - .01 + .5, b.time + 1);
  assert.equal(c1.unit.s.taunt, -1, 'taunt -1 while full');
  // Three more skills: 4 against the enemy's 1 or 2: the gold beams cover the enemy at column 9 but not the Revenant.
  for (const c of [c2, R.cores[2], R.cores[3]]) { until(b, () => R.error(c.id) == null, b.time + 2); R.activate(c.id); }
  taken.gold.length = 0;
  until(b, () => taken.gold.length > 0, b.time + 1.2);
  assert.deepEqual([taken.gold[0][0], taken.gold[0][2]], [foe, 'true']);
  assert.equal(taken.gold[0][1], revenantBeamDamage(RULE.ally, R.beams.ally));
  assert.equal(taken.boss.length, 0);
  // Push six ahead: the Revenant takes the gold damage x100.
  while (R.beams.ally - R.beams.enemy < 6) {
    const c = R.cores.find(x => x.sp < 25) ?? R.cores[0];
    for (let i = 0; i < 25 && c.sp < 25; i++) b.dealDamage(myrtle, c.unit, { amount: 1, type: 'phys', isAttack: true });
    until(b, () => R.error(c.id) == null, b.time + 2); R.activate(c.id);
  }
  assert.equal(R.beamReach.bossHit, true);
  until(b, () => taken.boss.length > 0, b.time + 1.2);
  assert.equal(taken.boss[0][1], revenantBeamDamage(RULE.ally, R.beams.ally) * 100);
});

test('the second form: one extra cast at 40% HP; its death stops the beams and ends the first form; the stage clears', async () => {
  const b = await quiet(), R = b.stageRevenant;
  assert.ok(toSecondForm(b));
  const boss = R.second, energy = R.beams.enemy;
  until(b, () => !boss.s.flags.invulnerable, b.time + 4);
  b.dealDamage(null, boss, { amount: boss.s.maxHp * .61, type: 'true', sourceless: true });
  const t = b.time;
  // It finishes its first cast (up to 2 s), then winds up 2.84 s in its second mode.
  assert.ok(until(b, () => R.beams.enemy === energy + 1, t + 5));
  assert.ok(b.time - t > 2.8, 'after its wind-up');
  b.dealDamage(null, boss, { amount: boss.s.maxHp, type: 'true', sourceless: true });
  assert.equal(boss.alive, false);
  assert.equal(R.beams.on, false);
  until(b, () => b.finished, b.time + 3);
  assert.equal(R.first.unit.alive, false);
  assert.equal(b.reason, 'cleared');
});

test('the second form\'s deadline: 200 s after it appears, 99 life points are lost', async () => {
  const b = await quiet('14-18', { life: null }), R = b.stageRevenant;
  assert.ok(toSecondForm(b));
  const born = R.second.deployedAt + 3;
  until(b, () => false, born + 210);
  assert.equal(b.reason, 'defeated');
  // Suicide waits for a cast in progress (up to 4.84 s), then takes 1 s.
  assert.ok(b.time - born >= 201 - .1 && b.time - born < 206, `${b.time - born}`);
});

test('adverse 14-18: the first form\'s ATK +20% reaches the guns; the core HP does not change', async () => {
  const b = await quiet('14-18_adverse_environment'), R = b.stageRevenant;
  assert.equal(Math.round(R.gunSync), 180);
  assert.deepEqual(R.cores.map(c => c.unit.s.maxHp), [5000, 15000, 22500, 30000]);
});

test('every phase of a branch ships its routes and enemy records (14-18\'s sequence branch, 13-14\'s random phases)', async () => {
  for (const id of ['14-18', '13-14']) {
    const stage = await load(id);
    for (const [key, branch] of Object.entries(stage.waveProgram.branches)) {
      const spawns = [...branch.spawns, ...(branch.randomPhases ?? []).flat(), ...(branch.sequencePhases ?? []).flat()];
      for (const s of spawns) {
        assert.ok(stage.pathing.paths[s.routeIndex], `${id} ${key}: route ${s.routeIndex} has a path`);
        assert.ok(stage.enemies[s.enemyKey], `${id} ${key}: ${s.enemyKey} has a record`);
      }
    }
  }
});

test('the second phase\'s Chalice of Regret has its own record, waits beside the cores and takes none of a core\'s damage', async () => {
  const b = await battle(), R = b.stageRevenant;
  b.retreat(b.bench.char_1035_wisdel.unit, { reason: 'withdraw', permanent: true });
  let chalice = null;
  b.on('enemySpawn', ({ enemy }) => { if (enemy.defId === 'enemy_1430_lrrook' && !chalice) chalice = enemy; });
  assert.ok(until(b, () => { for (const c of R.cores.slice(0, 2)) if (c.exposed && c.unit.hp > 1) smash(b, c); return R.cores[2].exposed; }, 200));
  assert.ok(chalice?.alive);
  assert.equal(chalice.s.maxHp, 100000);
  assert.deepEqual([Math.round(chalice.y), Math.round(chalice.x)], [3, 7], 'parked for 150 s');
  const core = R.cores[2], before = [core.unit.hp, chalice.hp];
  assert.ok(Math.hypot(core.col - chalice.x, core.row - chalice.y) <= 1.7);
  b.dealDamage(null, core.unit, { amount: 1000, type: 'true', sourceless: true });
  assert.deepEqual([core.unit.hp, chalice.hp], [before[0] - 1000, before[1]], 'ALLY_TARGET_FREE: the aura does not take the core');
});

test('an operator\'s own attacks charge a second-mode core, and nothing can be deployed on a device tile', async () => {
  const b = await battle(), R = b.stageRevenant, wis = b.bench.char_1035_wisdel.unit;
  wis.base.maxHp = 1e7; wis.markDirty(); wis.hp = wis.s.maxHp;
  b.getPlayer('arkpedia').dp = 99; b.setViewport?.('fullscreen-workspace');
  assert.throws(() => b.deployOperator('char_151_myrtle', 5, 11, 'LEFT'), /unavailable for deployment/);
  const sweep = e => { if (e.alive && e.kind === 'enemy' && ![REVENANT_FIRST, REVENANT_SECOND].includes(e.def?.key ?? e.defId)) b._remove(e, 'withdraw', null, true); };
  for (const e of [...b.enemies]) sweep(e);
  b.on('enemySpawn', ({ enemy }) => b.after(0, () => sweep(enemy)));
  assert.ok(toSecondForm(b));
  const core = R.cores[0];
  R.activate(core.id);
  assert.equal(core.sp, 0);
  let hits = 0;
  // Her shells and her summoned shadows both land hits on it.
  b.on('hit', ({ source, target }) => { if (source?.side === 'ally' && target === core.unit) hits++; });
  assert.ok(until(b, () => core.sp >= 3, b.time + 30), `SP ${core.sp} after ${hits} hits`);
  assert.ok(hits >= 3);
  assert.equal(core.unit.hp, core.unit.s.maxHp);
});
