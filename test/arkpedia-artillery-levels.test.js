// SPDX-License-Identifier: GPL-3.0-or-later
// The Londinium artillery reads its original instance: skill level (cost and starting SP) and whether it is active.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { artilleryDefinition } from '../shared/arkpedia/stage-artillery.js';
import { selectStaticDeviceInstances } from '../tools/arkpedia/stage-device-instances.mjs';

const ARTILLERY = 'Londinium Secondary Defense Artillery';

test('sktok_gunctrl levels: 120/0, 90/40, 120/60; other instances are refused', () => {
  assert.deepEqual([1, 2, 3].map(skillLevel => artilleryDefinition({ level: 1, skillLevel })),
    [{ spCost: 120, initSp: 0, spPerSecond: 1 }, { spCost: 90, initSp: 40, spPerSecond: 1 }, { spCost: 120, initSp: 60, spPerSecond: 1 }]);
  for (const bad of [null, { level: 1, skillLevel: 4 }, { level: 2, skillLevel: 1 }, { level: 1 }])
    assert.throws(() => artilleryDefinition(bad), /Unsupported original artillery instance/);
});

test('10-4: one active artillery; the adverse rune swaps the visible level-1 gun for the hidden level-3 one', () => {
  const gun = (alias, hidden, mainSkillLvl) => ({ alias, hidden, mainSkillLvl, skillIndex: 0, position: { row: 0, col: 0 },
    inst: { characterKey: 'trap_058_gunctrl', level: 1, phase: 'PHASE_0' } });
  const level = { predefines: { tokenInsts: [gun('trap_058_gunctrl#1', false, 1), gun('trap_058_gunctrl#2', true, 3)] }, waves: [] };
  const devices = [false, true].map(hidden => ({ kind: 'device', name: ARTILLERY, key: 'trap_058_gunctrl', row: 0, col: 0, hidden }));
  const normal = selectStaticDeviceInstances(devices, level, {});
  assert.deepEqual(normal.devices.map(d => [d.alias, d.hidden]), [['trap_058_gunctrl#1', false]]);
  const adverse = selectStaticDeviceInstances(devices, level, { predefinedDevices: { 'trap_058_gunctrl#1': false, 'trap_058_gunctrl#2': true } });
  assert.deepEqual(adverse.devices.map(d => [d.alias, d.hidden]), [['trap_058_gunctrl#2', false]]);
  assert.equal(adverse.level.predefines.tokenInsts.find(p => p.alias === 'trap_058_gunctrl#2').mainSkillLvl, 3);
  // An activation inside a hidden group the stage switches off never runs (AW-1 `raid`): the gun is dropped.
  // One that runs keeps the hidden gun, switched on by its alias; any other activation key is refused.
  const raid = (key = 'trap_058_gunctrl#1') => ({ ...level, predefines: { tokenInsts: [gun('trap_058_gunctrl#1', true, 1)] },
    waves: [{ fragments: [{ actions: [{ actionType: 'ACTIVATE_PREDEFINED', key, hiddenGroup: 'raid' }] }] }] });
  assert.deepEqual(selectStaticDeviceInstances([devices[1]], raid(), { hiddenGroups: { raid: false } }).devices, []);
  assert.deepEqual(selectStaticDeviceInstances([devices[1]], raid(), { hiddenGroups: { raid: true } }).devices.map(d => [d.alias, d.hidden, d.scheduledActivation]),
    [['trap_058_gunctrl#1', true, true]]);
  assert.throws(() => selectStaticDeviceInstances([devices[1]], raid('trap_058_gunctrl'), { hiddenGroups: { raid: true } }), /requires a controller/);
});

// AW-1 Challenge (`raid` on, wave 0) and victoria_camp_r_23 (wave 2) switch a hidden level-1 gun on by its alias.
for (const stageId of ['aw-1_challenge_mode', 'victoria_camp_r_23'])
  test(`compiled ${stageId}: the hidden artillery stays off until its ACTIVATE_PREDEFINED, then charges from 0`, async () => {
    const { StandardBattle } = await import('../server/sim/arkpedia.js');
    const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
    const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
    const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
    const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
    const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
    const entry = manifest.stages.find(s => s.id === stageId);
    assert.equal(entry.availability, 'available');
    const stage = await loader.load(entry);
    assert.ok(stage.waveProgram.waves.some(w => w.fragments.some(f => (f.activations ?? f.actions ?? []).some(a => a.key === 'trap_058_gunctrl#1')))
      || JSON.stringify(stage.waveProgram).includes('trap_058_gunctrl#1'), 'the activation is in the wave program');
    const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
      { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
    const [gun, ...rest] = b.mvpStageDevices.filter(d => d.name === ARTILLERY);
    assert.equal(rest.length, 0);
    assert.deepEqual([gun.alias, gun.active, gun.sp, gun.artillery.spCost], ['trap_058_gunctrl#1', false, 0, 120]);
    assert.equal(b.chargeStageArtillery(5), false, 'an inactive gun takes no charge');
    let on = null;
    // Kill every enemy so the waves advance; the gun stays at 0 SP until the activation.
    while (!b.finished && b.time < 900 && on == null) {
      for (const e of b.enemies) if (e.alive && !e.mem?.stageUnitDevice) b.kill(e);
      b.step();
      if (gun.active) on = b.time; else assert.equal(gun.sp, 0);
    }
    assert.ok(on != null, 'switched on');
    const until = b.time + 5; while (!b.finished && b.time < until) b.step();
    assert.ok(gun.sp > 4 && gun.sp <= 5.1, `${gun.sp} SP five seconds after it was switched on`);
    assert.deepEqual(b.errors, []);
  });

// [stage, artillery count, SP cost, starting SP] observed in the compiled battle.
for (const [stageId, count, cost, initSp] of [['10-4', 1, 120, 0], ['10-4_adverse_environment', 1, 120, 60], ['10-12', 1, 120, 60],
  ['13-5', 1, 120, 60], ['tr-20', 1, 90, 40], ['10-17', 1, 120, 0], ['aw-1', 0]])
  test(`compiled ${stageId}: ${count} artillery${count ? `, cost ${cost}, starting SP ${initSp}` : ''}`, async () => {
    const { StandardBattle } = await import('../server/sim/arkpedia.js');
    const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
    const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
    const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
    const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
    const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
    const entry = manifest.stages.find(s => s.id === stageId);
    assert.equal(entry.availability, 'available');
    const stage = await loader.load(entry);
    const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
      { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
    const guns = b.mvpStageDevices.filter(d => d.name === ARTILLERY);
    assert.equal(guns.length, count);
    if (!count) return;
    const [gun] = guns;
    assert.deepEqual([gun.artillery.spCost, gun.sp, gun.active], [cost, initSp, true]);
    // The SP climbs 1/s from its starting value (enemy chargers may add more, as on 13-5) and is capped by
    // this gun's cost; with no operator deployed it never fires.
    const until = b.time + 10; while (!b.finished && b.time < until) b.step();
    assert.ok(gun.sp >= Math.min(cost, initSp + b.time) - .1 && gun.sp <= cost, `${gun.sp} after ${b.time}`);
    assert.equal(b.chargeStageArtillery(1e4), true); assert.equal(gun.sp, cost);
    assert.deepEqual(b.errors, []);
  });
