// SPDX-License-Identifier: GPL-3.0-or-later
// Sarkaz drones and Heirbearer Artificers charge the Londinium Secondary Defense Artillery (trap_058_gunctrl).
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { artilleryChargerNative } from '../shared/arkpedia/enemy-artillery-charge-features.js';

const ids = ['enemy_1227_dair', 'enemy_1227_dair_2', 'enemy_1223_dmech', 'enemy_1223_dmech_2'];

test('all four are admitted from their pinned charge abilities; another link length is refused', () => {
  for (const id of ids) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    assert.equal(artilleryChargerNative(records.enemies[id].levels[0], nativeComponents(native, id)), true, id);
  }
  const link = structuredClone(native);
  for (const row of link.projectiles.projectile_enemy_dmech_charge) row.originalJson = row.originalJson.replace('"_linkDuration":20.0', '"_linkDuration":10.0');
  assert.equal(artilleryChargerNative(records.enemies.enemy_1223_dmech.levels[0], nativeComponents(link, 'enemy_1223_dmech')), false);
});

import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

// One unit, one operator target, and a stubbed artillery that records every charge.
function fixture(id, record = records.enemies[id].levels[0]) {
  const op = chessRec({ id: 'charge-target', stats: { maxHp: 1e8, atk: 0, def: 0, res: 0, blockCnt: 0 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 300,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(record) } },
    units: [{ chessId: op.chessId, row: 9, col: 7 }], setup: installEnemyFeatures });
  const b = h.b, charges = [];
  b.chargeStageArtillery = amount => { charges.push({ t: b.time, amount }); return true; };
  b.mvpStageDevices = [{ key: 'trap_058_gunctrl' }];
  b.start(); for (const u of b.allyUnits) b.addBuff(u, { key: 'hold', flags: { disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 9] }); b.addBuff(e, { key: 'hold', persist: true, flags: { noMove: true } });
  return { ...h, b, e, charges };
}

test('a drone charges the artillery by charge.sp on every attack cast on a target', () => {
  for (const id of ['enemy_1227_dair', 'enemy_1227_dair_2']) {
    const { b, e, run, charges } = fixture(id); let attacks = 0;
    b.on('attack', c => { if (c.attacker === e) attacks += (c.targets ?? []).length; });
    run(20);
    assert.ok(attacks >= 3, `${id} attacks`); assert.equal(charges.length, attacks); assert.ok(charges.every(c => c.amount === 1));
    assert.deepEqual(b.errors, []);
  }
});

test('an Artificer links once, after its 5 SP: +1 a second for 20 s; a stun mid-link costs 15', () => {
  for (const stun of [false, true]) {
    const { b, e, run, charges } = fixture('enemy_1223_dmech');
    run(4.5); assert.equal(charges.length, 0, 'no charge before 5 SP');
    run(1.5); assert.ok(e.findBuff('ab:artificerCharge'), 'linking');
    if (stun) { run(5); b.applyStatus(e, 'stun', { duration: 2 }); run(.1); }
    run(30);
    const gained = charges.filter(c => c.amount === 1), lost = charges.filter(c => c.amount === -15);
    if (!stun) { assert.equal(gained.length, 20); assert.equal(lost.length, 0); assert.ok(!e.findBuff('ab:artificerCharge')); }
    else { assert.ok(gained.length >= 5 && gained.length <= 6, `${gained.length}`); assert.equal(lost.length, 1); }
    run(60); assert.equal(charges.filter(c => c.amount === 1).length, stun ? gained.length : 20, 'once only');
    assert.deepEqual(b.errors, []);
  }
});

test('compiled adverse records carry the multiplied charges (10-14: charge.sp x3, 10-6: charge_gunctrl.sp x2)', async () => {
  const { readFile } = await import('node:fs/promises');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const load = id => loader.load(manifest.stages.find(s => s.id === id));
  const s14 = await load('10-14_adverse_environment'), s6 = await load('10-6_adverse_environment');
  assert.equal(s14.enemies.enemy_1227_dair.talents.bb['charge.sp'], 3);
  assert.equal(s6.enemies.enemy_1223_dmech.skills[0].bb.sp, 2);
});
