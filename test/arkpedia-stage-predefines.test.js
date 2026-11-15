// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectStaticDeviceInstances, validateStaticDeviceInstances } from '../tools/arkpedia/stage-device-instances.mjs';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
const device = { key: 'trap_057_wpnsts', name: "'Gelato Stop'", kind: 'device', row: 2, col: 4, hidden: false };
function fixture() {
  const instance = { position: { row: 2, col: 4 }, inst: { characterKey: device.key, phase: 'PHASE_0', level: 1 },
    skillIndex: 0, mainSkillLvl: 1, hidden: false, alias: 'trap_057_wpnsts#1', overrideSkillBlackboard: null };
  return { devices: [device, { ...device, hidden: true }], level: { predefines: { tokenInsts: [instance,
    { ...instance, hidden: true, alias: 'trap_057_wpnsts#2', skillIndex: 1 }] }, waves: [] } };
}

test('original activation selects exactly one instance at shared coordinates without mutating either input', () => {
  const f = fixture(), before = structuredClone(f);
  for (const [toggles, skill] of [[{}, 0], [{ 'trap_057_wpnsts#1': false, 'trap_057_wpnsts#2': true }, 1]]) {
    const selected = selectStaticDeviceInstances(f.devices, f.level, { predefinedDevices: toggles }), instances = {};
    validateStaticDeviceInstances(selected.devices, selected.level, instances);
    assert.equal(selected.devices.length, 1); assert.equal(selected.devices[0].hidden, false);
    assert.equal(instances['trap_057_wpnsts:2:4'].skillIndex, skill);
  }
  assert.deepEqual(f, before);
});

test('predefined selection refuses unknown aliases, duplicate active occupancy, omitted source devices, and scheduled hidden activation', () => {
  const f = fixture();
  assert.throws(() => selectStaticDeviceInstances(f.devices, f.level, { predefinedDevices: { 'trap_057_wpnsts#missing': true } }), /alias/);
  const both = selectStaticDeviceInstances(f.devices, f.level, { predefinedDevices: { 'trap_057_wpnsts#2': true } });
  assert.throws(() => validateStaticDeviceInstances(both.devices, both.level), /ambiguous/);
  assert.throws(() => selectStaticDeviceInstances([device], f.level), /omitted/);
  f.level.waves = [{ fragments: [{ actions: [{ key: 'trap_057_wpnsts#2', preDelay: 20 }] }] }];
  assert.throws(() => selectStaticDeviceInstances(f.devices, f.level), /Scheduled/);
});

test('GA-EX3 normal and challenge compile the four original allied and enemy stations respectively', async () => {
  const context = await loadContentContext();
  for (const [id, skill] of [['ga-ex-3', 0], ['ga-ex-3_challenge_mode', 1]]) {
    const plan = await planStage(context, id); assert.deepEqual(plan.blockers, []);
    assert.equal(plan.stage.devices.length, 4);
    assert.ok(plan.stage.devices.every(d => d.hidden === false && d.instance.skillIndex === skill));
    assert.equal(new Set(plan.stage.devices.map(d => `${d.row},${d.col}`)).size, 4);
  }
  const challenge = await planStage(context, 'ga-ex-5_challenge_mode');
  assert.deepEqual(challenge.blockers, []);
  assert.equal(challenge.stage.enemies.enemy_1218_bomscr_2.talents.bb['boom.attack@s2mode_boom_atk'], 900);
});
