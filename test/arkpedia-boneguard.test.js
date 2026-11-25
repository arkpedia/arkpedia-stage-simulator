// SPDX-License-Identifier: GPL-3.0-or-later
// Sarkaz Boneguard Fluxcaster / Captain (shared/arkpedia/enemy-boneguard-features.js,
// server/sim/content/arkpedia-enemy-boneguard.js) and its Bloodcalling Altar rebirth and revive.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import enemyNative from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import deviceNative from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { boneguardNative, boneguardParams } from '../shared/arkpedia/enemy-boneguard-features.js';
import { BLOOD_AMBER, bloodAltarNativeReviewed } from '../shared/arkpedia/stage-blood-altar.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const FLUX = 'enemy_1365_spnwiz', CAPTAIN = 'enemy_1365_spnwiz_2';
const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const clone = v => JSON.parse(JSON.stringify(v));
const record = id => Object.values(ENEMY_RECORDS.enemies[id].levels)[0];
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const battle = stage => new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
/** A stage with no waves or predefined units. SE-7 has one Altar at (5,9) facing LEFT: its range is rows 4-6, columns
 * 9 and below. */
const quiet = async (id = 'se-7') => {
  const stage = clone(await load(id));
  for (const w of stage.geometry.waves) w.spawns = [];
  const b = battle(stage);
  b.life = 999;
  b.step();
  for (const e of b.enemies.filter(u => u.alive && !u.mem.stageDeviceId)) b._remove(e, 'withdraw', null, true);
  b.after(1e6, () => {}, { holdsBattle: true });
  return b;
};
const place = (b, key, r, c) => {
  const e = b.spawnEnemy(key, { pos: [r, c] });
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true } });
  return e;
};
const strike = (b, e) => b.dealDamage(null, e, { amount: 1e7, type: 'true', sourceless: true });
/** Past the 0.15 s entry INVINCIBLE, then knocked out. */
const knockOut = (b, e) => { until(b, () => !e.s.flags.invulnerable, b.time + 1); strike(b, e); };

test('the Fluxcasters\' rebirth and the Altar\'s side of it are reviewed; changes are refused', () => {
  for (const id of [FLUX, CAPTAIN]) assert.equal(boneguardNative(record(id), nativeComponents(enemyNative, id)), true, id);
  const r = record(FLUX), n = id => nativeComponents(enemyNative, id);
  assert.equal(boneguardNative({ ...r, talents: { ...r.talents, bb: { 'Reborn.duration': 5 } } }, n(FLUX)), false, 'a longer rebirth');
  const once = clone(enemyNative);
  const prefab = once.prefabs['dyn/battle/prefabs/enemies/enemy_1365_spnwiz.prefab'];
  const row = prefab.find(c => JSON.parse(c.originalJson)._maxRespawnCnt === -1);
  row.originalJson = JSON.stringify({ ...JSON.parse(row.originalJson), _maxRespawnCnt: 1 });
  assert.equal(boneguardNative(r, nativeComponents(once, FLUX)), false, 'a single rebirth');
  const stay = clone(enemyNative);
  stay.templates.enemy_spnwiz_ghost_suicide.eventToActions.ON_BUFF_TRIGGER[0]._buffKeys = ['trap_bonore_in_range[default]'];
  assert.equal(boneguardNative(r, nativeComponents(stay, FLUX)), false, 'a ghost that checks the wrong range');
  const noMark = clone(deviceNative);
  noMark.prefabs.trap_125_bonore.components.find(c => c.object === 'SpnwizInRange2' && c.data._buffs).data._buffs.pop();
  assert.equal(bloodAltarNativeReviewed(noMark), false, 'an Altar that does not mark drifting ones');
  assert.deepEqual(boneguardParams(r), { reborn: 2, check: .5, spawnInvincible: Math.fround(.15), hp: 1, ownMark: false });
  assert.equal(boneguardParams(record(CAPTAIN)).ownMark, true);
});

test('knocked out in an Altar\'s range: 2 s rebirth, then an untouchable, rooted drift at full HP', async () => {
  const b = await quiet();
  const e = place(b, FLUX, 5, 5);
  knockOut(b, e);
  assert.equal(e.alive, true);
  assert.equal(e.hp, e.s.maxHp);
  assert.equal(!!e.s.flags.untargetable, true, 'reborning');
  assert.equal(e.mem.boneguardGhost, false);
  const t0 = b.time;
  assert.ok(until(b, () => e.mem.boneguardGhost, t0 + 3));
  assert.ok(Math.abs(b.time - t0 - 2) < .05, `${b.time - t0}`);
  const f = e.s.flags;
  assert.deepEqual([!!f.invulnerable, !!f.untargetable, !!f.unblockable, !!f.noMove, !!f.disarm], [true, true, true, true, true]);
  strike(b, e);
  assert.equal(e.alive, true, 'untouchable');
  assert.equal(b.stageBloodAltars.marks(e), 1, 'the Altar marks it');
  // A row outside the Altar's three lines: an ordinary knock-out.
  const out = place(b, FLUX, 2, 5);
  knockOut(b, out);
  assert.equal(out.alive, false);
  // A fall is never a rebirth.
  const fell = place(b, FLUX, 4, 3);
  until(b, () => !fell.s.flags.invulnerable, b.time + 1);
  fell.mem.deathByFall = true; b.kill(fell, null);
  assert.equal(fell.alive, false);
});

test('the pulse revives a drifting Fluxcaster with no Spawn and stops there; Amber in the same pulse still converts', async () => {
  const b = await quiet();
  const altar = b.stageBloodAltars.entries[0];
  const e = place(b, FLUX, 5, 6), beyond = place(b, BLOOD_AMBER, 5, 2);
  knockOut(b, e);
  assert.ok(until(b, () => e.mem.boneguardGhost, 5));
  const spawned = [];
  b.on('enemySpawn', ({ enemy }) => { if (enemy.mem.stageBranch) spawned.push(enemy.defId); });
  assert.ok(until(b, () => !e.mem.boneguardGhost, 25));
  assert.ok(b.time > 20 && b.time < 20.5, `${b.time}`);
  assert.equal(altar.conversions, 0);
  assert.deepEqual(spawned, []);
  assert.equal(beyond.alive, true, 'the pulse ended at the Fluxcaster');
  assert.equal(e.alive, true);
  assert.equal(!!e.s.flags.untargetable, false, 'back in caster mode');
  // Knocked out again, it drifts again; the 40 s pulse takes it together with an Amber beside it.
  knockOut(b, e);
  assert.ok(until(b, () => e.mem.boneguardGhost, b.time + 3));
  const twin = place(b, BLOOD_AMBER, 4, 6);
  assert.ok(until(b, () => !e.mem.boneguardGhost, 45));
  assert.equal(twin.alive, false);
  assert.equal(altar.conversions, 1);
  assert.deepEqual(spawned, ['enemy_1360_dfello']);
});

test('a drifting Fluxcaster withdraws within 0.5 s once no Altar covers it; the Captain carries its own mark', async () => {
  const b = await quiet();
  const e = place(b, FLUX, 5, 5);
  knockOut(b, e);
  assert.ok(until(b, () => e.mem.boneguardGhost, 5));
  const killed = b.killed;
  b.stageBloodAltars.destroy(b.stageBloodAltars.entries[0]);
  const t0 = b.time;
  assert.ok(until(b, () => !e.alive, t0 + 1));
  assert.ok(b.time - t0 <= .5 + 1e-6, `${b.time - t0}`);
  assert.equal(b.killed, killed + 1, 'it counts as a kill');
  const c = await quiet('h13-2_adverse_environment'); // Altars at (5,1) and (2,1), facing RIGHT
  const cap = place(c, CAPTAIN, 5, 5);
  knockOut(c, cap);
  assert.ok(until(c, () => cap.mem.boneguardGhost, 5));
  for (const a of c.stageBloodAltars.entries) a.destroyed = true; // their range is gone, its own mark is not
  assert.equal(c.stageBloodAltars.marks(cap), 1);
});

for (const id of ['se-7', 'se-7_challenge_mode', 'h13-2_adverse_environment', 'vec-sp07_act1break_sp07']) {
  test(`headless ${id} clears with Fluxcasters drifting and reviving`, async () => {
    const b = battle(await load(id));
    b.life = 999;
    b.on('enemySpawn', ({ enemy: e }) => {
      if (!/spnwiz|dseed/.test(e.defId) && !e.mem.stageBranch) b.after(.5, () => e.alive && strike(b, e));
    });
    let last = 0, drifted = 0;
    while (!b.finished && b.time < 900) {
      b.step();
      for (const e of b.enemies) if (e.alive && e.mem.boneguardGhost) drifted++;
      if (b.time - last >= 3) {
        last = b.time;
        for (const e of b.enemies) if (/spnwiz/.test(e.defId) && e.alive && !e.s.flags.untargetable) strike(b, e);
      }
    }
    assert.equal(b.reason, 'cleared');
    if (id !== 'vec-sp07_act1break_sp07') assert.ok(drifted > 0, 'a Fluxcaster drifted');
  });
}
