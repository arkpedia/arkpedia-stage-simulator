// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
import { STAGE_DEVICES, stageDeviceSpec, pulseTiles } from '../shared/arkpedia/stage-devices.js';
import { validateStaticDeviceInstances } from '../tools/arkpedia/stage-device-instances.mjs';
import { buildStageDeviceSource } from '../tools/arkpedia/stage-device-source.mjs';
import original from '../data/arkpedia-device-source.json' with { type: 'json' };
import stage from '../data/arkpedia-stage-7-8.json' with { type: 'json' };
const device = { kind: 'device', name: 'Originium Ice Crystal', key: 'trap_010_frosts', hidden: false, row: 9, col: 6 };
function fixture(count = 1) {
  const guard = chessRec({ id: 'ice_target', stats: { maxHp: 100000, atk: 0 }, skill: null });
  const enemy = enemyRec({ key: 'ice_enemy', atk: 0, speed: 0 });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 90,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [enemy.key]: enemy } },
    units: [[9, 4], [10, 5], [10, 4]].map(([row, col]) => ({ chessId: guard.chessId, row, col })),
    setup: b => {
      b.mvpStageDevices = Array.from({ length: count }, () => ({ ...device, sp: 0 }));
      b.on('tick', ({ dt }) => StandardBattle.prototype._tickMvpStageDevices.call(b, dt));
    } });
  const b = h.b; b.start(); const [outer, diagonal, outside] = b.allyUnits;
  for (const u of b.allyUnits) b.addBuff(u, { key: 'stationary', flags: { noMove: true, disarm: true } });
  const e = b.spawnEnemy(enemy.key, { pos: [9, 7] }); e.profile.noAttack = true;
  return { h, b, outer, diagonal, outside, e };
}
test('retained device tables reproduce the source and both devices use the original x-1 range', async () => {
  assert.deepEqual(await buildStageDeviceSource(), original);
  for (const [id, name] of [['trap_010_frosts', 'Originium Ice Crystal'], ['trap_011_ore', 'Originium Altar']]) {
    const c = original.devices[id], skill = original.skills[c.skills[0].skillId].levels[0];
    const spec = STAGE_DEVICES[name].statusPulse ?? STAGE_DEVICES[name].pulse;
    assert.equal(spec.range, skill.rangeId); assert.equal(spec.spCost, skill.spData.spCost);
    assert.equal(spec.spPerSecond, c.phases[0].attributesKeyFrames[0].data.spRecoveryPerSec);
  }
  assert.deepEqual(pulseTiles(0, 0), original.ranges['x-1'].grids.map(p => [p.row, p.col]));
  assert.equal(pulseTiles(0, 0).length, 13);
});
test('first pulse occurs after 15 seconds and reaches the diamond boundary, without affecting enemies', () => {
  const { h, b, outer, diagonal, outside, e } = fixture(); const aspd = outer.s.aspd;
  h.run(14.9); assert.equal(outer.findBuff('cold'), null);
  h.run(.2); assert.ok(outer.findBuff('cold')); assert.ok(diagonal.findBuff('cold'));
  assert.equal(outer.s.aspd, aspd - 30); assert.equal(outside.findBuff('cold'), null); assert.equal(e.findBuff('cold'), null);
  assert.ok(outer.findBuff('cold').timeLeft > 9.8); h.run(10.1); assert.equal(outer.findBuff('cold'), null);
  assert.deepEqual(b.errors, []);
});
test('a stage skill-cost multiplier changes only the crystal SP threshold, preserving Cold and range', () => {
  const { h, b, outer, diagonal, outside } = fixture();
  b.stageCardRules = { deviceSkillCost: { trap_010_frosts: .5 } };
  h.run(7.4); assert.equal(outer.findBuff('cold'), null); h.run(.2);
  assert.equal(outer.findBuff('cold').duration, 10); assert.ok(diagonal.findBuff('cold'));
  assert.equal(outside.findBuff('cold'), null); h.run(7.5); assert.ok(outer.findBuff('freeze'));
  assert.equal(STAGE_DEVICES['Originium Ice Crystal'].statusPulse.spCost, 15);
  assert.deepEqual(b.errors, []);
});
test('overlapping crystals freeze via the common status pipeline; resistance halves duration and immunity applies', () => {
  const { h, b, outer, diagonal } = fixture(2);
  b.applyStatus(outer, 'resist', { duration: 60 }); diagonal.def = { ...diagonal.def, immune: new Set(['frozen']) };
  h.run(15.1); assert.ok(outer.findBuff('freeze')); assert.ok(outer.findBuff('freeze').timeLeft < 5);
  assert.ok(diagonal.findBuff('cold')); assert.equal(diagonal.findBuff('freeze'), null);
  h.run(5.1); assert.equal(outer.findBuff('freeze'), null); assert.deepEqual(b.errors, []);
});
test('device identity is checked, and its tile blocks ground travel and deployment without mutating source geometry', () => {
  assert.equal(stageDeviceSpec({ ...device, key: 'trap_1643_akbtbd' }), null);
  assert.equal(stageDeviceSpec({ ...device, hidden: true }), null);
  const input = structuredClone(stage), originalGrid = structuredClone(input.geometry.tileGrid);
  input.devices = [{ ...device, row: 3, col: 1 }];
  const adapted = stageAdapter(input), tile = adapted.stage.legend[adapted.stage.rows[3][1]];
  assert.equal(tile.pass, 'FLY'); assert.equal(tile.build, 'NONE'); assert.deepEqual(input.geometry.tileGrid, originalGrid);
  input.devices[0].key = 'trap_1643_akbtbd'; assert.throws(() => stageAdapter(input), /Unsupported stage devices/);
});
test('static-device preflight rejects altered skills, activation schedules and omitted original instances', () => {
  const instance = { position: { row: 9, col: 6 }, inst: { characterKey: device.key, phase: 'PHASE_0', level: 1 },
    skillIndex: 0, mainSkillLvl: 1, hidden: false, alias: 'ice#1', overrideSkillBlackboard: null };
  const level = { predefines: { tokenInsts: [instance] }, waves: [] };
  assert.doesNotThrow(() => validateStaticDeviceInstances([device], level));
  const legacy = structuredClone(level); legacy.predefines.tokenInsts[0].inst.phase = 0; legacy.predefines.tokenInsts[0].alias = null;
  legacy.waves = [{ fragments: [{ actions: [{ key: null, actionType: 'WAIT' }] }] }];
  assert.doesNotThrow(() => validateStaticDeviceInstances([device], legacy));
  for (const edit of [
    l => { l.predefines.tokenInsts[0].overrideSkillBlackboard = [{ key: 'freeze', value: 100 }]; },
    l => { l.predefines.tokenInsts[0].hidden = true; },
    l => { l.predefines.tokenInsts.push({ ...instance, position: { row: 8, col: 6 } }); },
    l => { l.waves = [{ fragments: [{ actions: [{ key: 'ice#1' }] }] }]; },
  ]) { const changed = structuredClone(level); edit(changed); assert.throws(() => validateStaticDeviceInstances([device], changed)); }
});
