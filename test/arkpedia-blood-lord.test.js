// SPDX-License-Identifier: GPL-3.0-or-later
// Duq'arael, 'Regent's Crimson' (shared/arkpedia/enemy-blood-lord-features.js, server/sim/content/arkpedia-enemy-blood-lord.js)
// and the Throne of Blood (shared/arkpedia/stage-blood-throne.js, server/sim/content/arkpedia-stage-blood-throne.js), with
// Blood Mist and Blood Surge (arkpedia-blood-mist.js). 13-21: the Throne at (4,2), Loading Points at (7,9), (5,10),
// (3,10) and (1,8).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import enemyNative from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import deviceNative from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import deviceTables from '../data/arkpedia-device-source.json' with { type: 'json' };
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { BLOOD_LORD, BLOOD_LORD_TWO, bloodLordNative, bloodLordTwoNative, bloodLordParams, bloodLordTwoParams }
  from '../shared/arkpedia/enemy-blood-lord-features.js';
import { bloodThroneNativeReviewed, BLOOD_AMBER_KEY } from '../shared/arkpedia/stage-blood-throne.js';
import { bombLoaderLordTriggerReviewed } from '../shared/arkpedia/stage-bomb-loader.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { bloodMists } from '../server/sim/content/arkpedia-blood-mist.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const clone = v => JSON.parse(JSON.stringify(v));
const level = (k, l = 0) => ENEMY_RECORDS.enemies[k].levels[l];
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const battle = stage => new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
const strike = (b, e, amount = 1e7) => b.dealDamage(null, e, { amount, type: 'true', sourceless: true });
/** 13-21 with no waves: only the devices and what they make. */
const quiet = async (id = '13-21') => {
  const stage = clone(await load(id));
  for (const w of stage.geometry.waves) w.spawns = [];
  const b = battle(stage);
  b.life = 999;
  b.step();
  for (const e of b.enemies.filter(u => u.alive && !u.mem.stageDeviceId)) b._remove(e, 'withdraw', null, true);
  b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 99;
  return b;
};
const deploy = (b, near) => {
  for (let r = 0; r < b.regularMapSize.rows; r++) for (let c = 0; c < b.regularMapSize.cols; c++) {
    if (near && Math.abs(r - near[0]) + Math.abs(c - near[1]) > 1) continue;
    try { const op = b.deployOperator('char_151_myrtle', r, c, 'UP'); if (op) return op; } catch { /* next tile */ }
  }
  return null;
};
const place = (b, key, r, c) => {
  const e = b.spawnEnemy(key, { pos: [r, c] });
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true } });
  return e;
};
const state = (e, field) => e.mem.ab.list.find(x => field in x);
const fullBombs = b => { for (const e of b.neutralUnits ?? []) if (e.alive) { const s = state(e, 'carrier'); if (s) s.sp = 10; } };

test('the Throne of Blood, both forms and the Loading Points\' Blord2Trigger are reviewed; changes are refused', () => {
  assert.equal(bloodThroneNativeReviewed(), true);
  assert.equal(bombLoaderLordTriggerReviewed(), true);
  const t = clone(deviceTables), bb = t.skills.sktok_bldore.levels[0].blackboard;
  bb.find(x => x.key === 'blordreborn.duration').value = 30;
  assert.equal(bloodThroneNativeReviewed(deviceNative, t), false, 'a faster return');
  const t2 = clone(deviceTables); t2.skills.sktok_bldore.levels[0].blackboard.find(x => x.key === 'fountaindamage.value').value = 600;
  assert.equal(bloodThroneNativeReviewed(deviceNative, t2), false, 'a weaker surge');
  const wide = clone(deviceNative); wide.prefabs.sktok_bldore.components.find(c => c.object === 'KillBmbcar' && c.data.m_Radius !== undefined).data.m_Radius = 1.5;
  assert.equal(bloodThroneNativeReviewed(wide), false, 'a wider bomb circle');
  const open = clone(deviceNative); open.prefabs.trap_127_bldore.components.find(c => c.object === 'Passive').data._buffs.splice(2, 1);
  assert.equal(bloodThroneNativeReviewed(open), false, 'a Throne that does not hold the battle');
  const far = clone(deviceNative); far.prefabs.trap_126_outset.components.find(c => c.object === 'Blord2Trigger' && c.data.m_Radius !== undefined).data.m_Radius = 3;
  assert.equal(bombLoaderLordTriggerReviewed(far), false, 'a wider Loading Point trigger');
  const n = k => nativeComponents(enemyNative, k);
  for (const l of [0, 1]) {
    assert.equal(bloodLordNative(level(BLOOD_LORD, l), n(BLOOD_LORD)), true, `first form, level ${l}`);
    assert.equal(bloodLordTwoNative(level(BLOOD_LORD_TWO, l), n(BLOOD_LORD_TWO)), true, `second form, level ${l}`);
  }
  const one = level(BLOOD_LORD), fast = { ...one, skills: [{ ...one.skills[0], cooldown: 20 }, one.skills[1]] };
  assert.equal(bloodLordNative(fast, n(BLOOD_LORD)), false, 'a faster mist');
  const two = level(BLOOD_LORD_TWO), soft = { ...two, talents: { ...two.talents, bb: { ...two.talents.bb, 'HpAura.damage_resistance': .5 } } };
  assert.equal(bloodLordTwoNative(soft, n(BLOOD_LORD_TWO)), false, 'a weaker Sanctuary');
  const near = clone(enemyNative), circle = near.prefabs['dyn/battle/prefabs/enemies/enemy_1547_blord_2.prefab']
    .find(c => c.objectName === 'KillBmbcar' && JSON.parse(c.originalJson).m_Radius !== undefined);
  circle.originalJson = JSON.stringify({ ...JSON.parse(circle.originalJson), m_Radius: 1 });
  assert.equal(bloodLordTwoNative(two, nativeComponents(near, BLOOD_LORD_TWO)), false, 'a wider bomb contact');
  // Level 1 reads over level 0: only the aura's pause differs.
  assert.equal(bloodLordTwoParams(level(BLOOD_LORD_TWO, 1)).aura.off, 10);
  assert.equal(bloodLordTwoParams(two).aura.off, 15);
  assert.equal(level(BLOOD_AMBER_KEY).talents.bb['Passive.hp_ratio'], .1, 'the Amber decay the Throne runtime uses');
  assert.deepEqual(bloodLordParams(one).surge, { duration: 20, interval: 5, cast: 4, release: 2, cross: [[1, 0], [0, -1], [0, 0], [0, 1], [-1, 0]] });
});

test('the Throne: Blood Amber every 10 s, Blood Mist on itself at 5 s (SP 15 of 20) and again 30 s later; it holds the battle', async () => {
  const b = await quiet(), T = b.stageBloodThrone, a = T.entry;
  const ambers = [];
  const start = 0, mists = [];
  b.on('enemySpawn', ({ enemy }) => { if (enemy.defId === BLOOD_AMBER_KEY && enemy.mem.stageBranch) ambers.push(Math.round(b.time - start)); });
  const release = bloodMists(b).release.bind(bloodMists(b));
  bloodMists(b).release = (src, x, y, p) => { mists.push([Math.round(b.time - start), y, x]); return release(src, x, y, p); };
  until(b, () => b.time >= start + 50, start + 51);
  assert.deepEqual(ambers.slice(0, 4), [10, 20, 30, 40]);
  // The skill lasts until its mist ends (10 s) and charges only between mists [inference]: 5, then 5 + 10 + 20.
  assert.deepEqual(mists.map(m => m[0]), [5, 35]);
  assert.deepEqual(mists[0].slice(1), [a.row, a.col]);
  assert.equal(b.finished, false, 'held by the Throne');
});

test('Blood Mist: ASPD -40 and Arts damage rising 50 -> 200 over 10 s, kept after leaving, x2 redeployment; Amber turns into a Spawn', async () => {
  const b = await quiet();
  const op = deploy(b); assert.ok(op);
  op.atkCd = 1e6;
  const amber = place(b, BLOOD_AMBER_KEY, op.tileR, op.tileC + 1 < b.regularMapSize.cols ? op.tileC + 1 : op.tileC - 1);
  const hits = [];
  b.on('damaged', c => { if (c.target === op && c.dmg?.tags?.includes('bloodMist')) hits.push([+(b.time).toFixed(2), c.amount]); });
  const spawns = [];
  b.on('enemySpawn', ({ enemy }) => { if (enemy.defId === 'enemy_1360_dfello') spawns.push([b.time, enemy.y, enemy.x]); });
  const t0 = b.time, ax = amber.x, ay = amber.y;
  b.addBuff(op, { key: 'test:undying', persist: true, flags: { undeadable: true } });
  const m = bloodMists(b).release(null, op.tileC, op.tileR, bloodLordParams(level(BLOOD_LORD)).mist);
  assert.equal(op.findBuff('bloodMist').mods.aspd, -40);
  assert.equal(amber.alive, false, 'the Amber leaves at once');
  assert.ok(op.findBuff('bloodMist:redeploy'));
  until(b, () => b.time >= t0 + 10.5, t0 + 11);
  assert.equal(hits.length, 10, JSON.stringify(hits));
  assert.ok(Math.abs(hits[0][1] - 50 * (1 - op.s.res / 100)) < 1e-6, `${hits[0][1]}`);
  const raw = hits.map(([, d]) => d / (1 - op.s.res / 100));
  assert.ok(raw.every((d, i) => Math.abs(d - (50 + 15 * i)) < 1e-6), JSON.stringify(raw));
  assert.equal(op.findBuff('bloodMist'), null, 'ends with the mist');
  assert.equal(op.findBuff('bloodMist:redeploy'), null);
  assert.equal(spawns.length, 1);
  assert.ok(Math.abs(spawns[0][0] - t0 - 1) < .05 && Math.abs(spawns[0][1] - ay) < 1e-6 && Math.abs(spawns[0][2] - ax) < 1e-6);
  assert.equal(m.affected.size, 0);
  // A knock-out under the mist doubles that redeployment.
  bloodMists(b).release(null, op.tileC, op.tileR, bloodLordParams(level(BLOOD_LORD)).mist);
  const base = op.base.respawnTime;
  b.kill(op, null);
  const wait = b.bench[op.defId].readyAt - b.time;
  assert.ok(Math.abs(wait - 2 * base) < 1e-6, `${wait} vs ${2 * base}`);
  b.step();
  assert.equal(op.findBuff('bloodMist:redeploy'), null, 'the penalty is spent with that knock-out');
});

test('first form: undying; its defeat is a 4 s invincible cast, the Throne surges 4 times, then he dies and returns 40 s later', async () => {
  const b = await quiet(), T = b.stageBloodThrone;
  const op = deploy(b); assert.ok(op); b.addBuff(op, { key: 'test:undying', persist: true, flags: { undeadable: true } });
  const e = place(b, BLOOD_LORD, 4, 6);
  until(b, () => b.time >= 1, 2);
  assert.ok(T.holds(e));
  strike(b, e);
  assert.equal(e.alive, true, 'UNDEADABLE');
  assert.equal(e.s.flags.invulnerable, true);
  const t0 = b.time, surges = [];
  b.on('damaged', c => { if (c.dmg?.tags?.includes('bloodSurge')) surges.push(+(b.time - t0).toFixed(2)); });
  assert.ok(until(b, () => !e.alive, t0 + 5));
  assert.ok(Math.abs(b.time - t0 - 4) < .05, `${b.time - t0}`);
  assert.equal(T.entry.returns.length, 1);
  until(b, () => b.time >= t0 + 23, t0 + 24);
  // The round started at the cast's OnAttack (2 s): hits 5, 10, 15 and 20 s later, 800 Arts each, stun 5 s.
  assert.deepEqual([...new Set(surges)].map(t => Math.round(t)), [7, 12, 17, 22], JSON.stringify(surges));
  const back = [];
  b.on('enemySpawn', ({ enemy }) => { if (enemy.defId === BLOOD_LORD) back.push(b.time - t0); });
  until(b, () => back.length > 0, t0 + 45);
  assert.ok(Math.abs(back[0] - 44) < .05, `${back[0]}`);
});

test('a first form without the Throne dies 0.5 s in; a bomb at the Throne calls the second form, kills the first and releases the wave', async () => {
  const b = await quiet(), T = b.stageBloodThrone;
  const first = place(b, BLOOD_LORD, 4, 6);
  const twos = [];
  b.on('enemySpawn', ({ enemy }) => { if (enemy.defId === BLOOD_LORD_TWO) twos.push(enemy); });
  T.bombed();
  assert.equal(T.alive, false);
  assert.equal(first.alive, false, 'force-killed with the Throne');
  assert.equal(T.entry.returns.length, 0, 'no return');
  until(b, () => twos.length > 0, b.time + 1);
  assert.equal(twos.length, 1);
  assert.equal(twos[0].profile.holdsBattle, true);
  const late = place(b, BLOOD_LORD, 4, 6), t0 = b.time;
  assert.ok(until(b, () => !late.alive, t0 + 1));
  assert.ok(Math.abs(b.time - t0 - .5) < .05);
  // Without the Throne (and no Altar), Blood Amber loses 10% of its max HP each second.
  const amber = place(b, BLOOD_AMBER_KEY, 1, 2), hp = amber.hp;
  until(b, () => b.time >= t0 + 3.05, t0 + 4);
  assert.ok(amber.hp <= hp * .8 + 1e-6 && amber.hp >= hp * .7 - 1e-6, `${amber.hp / hp}`);
});

test('the first form reaching the exit frees the battle: a bomb then destroys the Throne without a second form', async () => {
  const b = await quiet(), T = b.stageBloodThrone;
  const e = place(b, BLOOD_LORD, 4, 6);
  b._remove(e, 'exit', null, true);
  assert.equal(T.hold, null);
  const twos = [];
  b.on('enemySpawn', ({ enemy }) => { if (enemy.defId === BLOOD_LORD_TWO) twos.push(enemy); });
  T.bombed();
  until(b, () => b.time >= 2, 3);
  assert.equal(twos.length, 0);
});

test('second form: Sanctuary 90% (Physical and Arts) and +300 HP/s around him; a bomb\'s explosion turns both off for 15 s and stops Crimson Edict', async () => {
  const b = await quiet();
  b.stageBloodThrone.bombed();
  until(b, () => b.enemies.some(e => e.alive && e.defId === BLOOD_LORD_TWO), b.time + 1);
  const e = b.enemies.find(u => u.alive && u.defId === BLOOD_LORD_TWO);
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true } });
  const ally = place(b, 'enemy_1360_dfello', e.tileR, e.tileC);
  b.step();
  const taken = (type, amount = 1000) => { const before = e.hp; b.dealDamage(null, e, { amount, type, sourceless: true }); const d = before - e.hp; e.hp = before; return d; };
  assert.ok(Math.abs(taken('arts') - 1000 * (1 - e.s.res / 100) * .1) < 1e-6, `${taken('arts')}`);
  assert.equal(taken('true'), 1000, 'True damage is not reduced');
  ally.hp = 1; const t0 = b.time;
  until(b, () => b.time >= t0 + 2, t0 + 3);
  assert.ok(Math.abs(ally.hp - 1 - 2 * 300) < 40, `${ally.hp}`);
  // Crimson Edict starts 10 s in; an explosion during it interrupts it at the next 0.5 s check.
  const edict = state(e, 'edicts');
  assert.ok(until(b, () => edict.cast, t0 + 11));
  b.step();
  b.dealDamage(null, e, { amount: 1, type: 'true', sourceless: true, tags: ['bombExplosion'] });
  const hit = b.time;
  assert.ok(until(b, () => !edict.cast, hit + .6));
  assert.equal(e.findBuff('ab:crimsonCrown'), null);
  assert.ok(Math.abs(taken('arts') - 1000 * (1 - e.s.res / 100)) < 1e-6, 'no Sanctuary while off');
  assert.ok(until(b, () => !!e.findBuff('ab:crimsonCrown'), hit + 16));
  assert.ok(Math.abs(b.time - hit - 15) < .6, `${b.time - hit}`);
});

test('Crimson Edict: Blood Amber at 0, 5, 10 and 15 s (each 1 s later), then Blood Mist on his own tile', async () => {
  const b = await quiet();
  b.stageBloodThrone.bombed();
  until(b, () => b.enemies.some(e => e.alive && e.defId === BLOOD_LORD_TWO), b.time + 1);
  const e = b.enemies.find(u => u.alive && u.defId === BLOOD_LORD_TWO);
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true } });
  const edict = state(e, 'edicts');
  assert.ok(until(b, () => edict.cast, b.time + 11));
  const t0 = b.time, ambers = [], mists = [];
  b.on('enemySpawn', ({ enemy }) => { if (enemy.defId === BLOOD_AMBER_KEY && !enemy.mem.stageBranch) ambers.push(+(b.time - t0).toFixed(1)); });
  const release = bloodMists(b).release.bind(bloodMists(b));
  bloodMists(b).release = (src, x, y, p) => { if (src === e) mists.push([+(b.time - t0).toFixed(2), y, x]); return release(src, x, y, p); };
  until(b, () => !edict.cast, t0 + 20);
  assert.deepEqual(ambers, [1, 6, 11, 16]);
  assert.equal(mists.length, 1);
  assert.ok(Math.abs(mists[0][0] - 15.43) < .05, `${mists[0][0]}`);
  assert.deepEqual(mists[0].slice(1), [e.tileR, e.tileC]);
});

test('Sunken Death: a bomb at him marks its Loading Point; two surges at ATK x0.5; the Point dies 7.37 s in; a Point within 2 does the same', async () => {
  const b = await quiet();
  b.stageBloodThrone.bombed();
  until(b, () => b.enemies.some(e => e.alive && e.defId === BLOOD_LORD_TWO), b.time + 1);
  const e = b.enemies.find(u => u.alive && u.defId === BLOOD_LORD_TWO);
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true } });
  const op = deploy(b); assert.ok(op); b.addBuff(op, { key: 'test:undying', persist: true, flags: { undeadable: true } });
  const L = b.stageBombLoaders, point = [...L.entries.values()].find(d => d.row === 7 && d.col === 9);
  const handle = e.mem.bloodLordTwo, sunk = state(e, 'sunkenCasts');
  until(b, () => b.time >= 41, 42);
  const bomb = L.activate(point.id);
  assert.equal(L.senderOf(bomb), point);
  const t0 = b.time, surges = [];
  b.on('damaged', c => { if (c.dmg?.tags?.includes('bloodSurge')) surges.push([+(b.time - t0).toFixed(2), c.amount]); });
  assert.equal(handle.bombed(L.senderOf(bomb)), true);
  assert.equal(point.marked, true);
  assert.equal(handle.bombed(null), false, 'already casting');
  until(b, () => !point.unit.alive, t0 + 8);
  assert.ok(Math.abs(b.time - t0 - 7.37) < .05, `${b.time - t0}`);
  until(b, () => b.time >= t0 + 10.5, t0 + 11);
  assert.deepEqual([...new Set(surges.map(s => Math.round(s[0])))], [5, 10]);
  assert.equal(sunk.sunkenCasts, 1);
  // The Loading Point at (3,10): bring him within 2.1 of it.
  const other = [...L.entries.values()].find(d => d.row === 3 && d.col === 10);
  e.x = 9; e.y = 3; e.tileR = 3; e.tileC = 9;
  b.step();
  assert.equal(other.marked, true);
  assert.equal(sunk.sunkenCasts, 2);
  assert.equal(sunk.lastSunken, 'loader');
});

test('Blood Affliction: his hits start a 10 s ramping Arts DoT (first tick after 1 s), refreshed by later hits, with x2 redeployment', async () => {
  const b = await quiet();
  b.stageBloodThrone.bombed();
  until(b, () => b.enemies.some(e => e.alive && e.defId === BLOOD_LORD_TWO), b.time + 1);
  const e = b.enemies.find(u => u.alive && u.defId === BLOOD_LORD_TWO);
  const op = deploy(b); assert.ok(op); b.addBuff(op, { key: 'test:undying', persist: true, flags: { undeadable: true } });
  const ticks = [];
  b.on('damaged', c => { if (c.target === op && c.dmg?.tags?.includes('bloodAffliction')) ticks.push(b.time); });
  b.emit('damaged', { source: e, target: op, amount: 1, hpLoss: 1, type: 'arts', dmg: { isAttack: true, type: 'arts' }, credit: e });
  const t0 = b.time;
  assert.ok(op.findBuff('bloodAffliction'));
  assert.ok(op.findBuff('bloodMist:redeploy'));
  until(b, () => b.time >= t0 + 3.5, t0 + 4);
  assert.deepEqual(ticks.map(t => Math.round(t - t0)), [1, 2, 3]);
  until(b, () => !op.findBuff('bloodAffliction'), t0 + 12);
  b.step();
  assert.equal(op.findBuff('bloodMist:redeploy'), null);
});

for (const id of ['13-21', '13-21_adverse_environment']) {
  test(`headless ${id} clears: bombs destroy the Throne, the second form falls`, async () => {
    const b = battle(await load(id));
    b.life = 999;
    let last = 0, forms = 0;
    b.on('enemySpawn', ({ enemy }) => { if (enemy.defId === BLOOD_LORD_TWO) forms++; });
    while (!b.finished && b.time < 900) {
      b.step();
      b.getPlayer('arkpedia').dp = 99; fullBombs(b);
      for (const d of b.stageBombLoaders.entries.values()) if (d.state === 'ready' && b.time >= 30) b.stageBombLoaders.activate(d.id);
      // Everything that can be struck is knocked out every 3 s (the first form keeps returning until the Throne falls).
      if (b.time - last >= 3) { last = b.time;
        for (const e of b.enemies) if (e.alive && !e.mem.stageDeviceId && !e.s.flags.untargetable && !e.s.flags.invulnerable && e.side === 'enemy')
          strike(b, e, e.defId === BLOOD_LORD_TWO ? 1e8 : 1e7); }
    }
    assert.equal(b.reason, 'cleared');
    assert.equal(b.stageBloodThrone.alive, false);
    assert.equal(forms, 1);
  });
}
