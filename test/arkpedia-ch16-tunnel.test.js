// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle } from './helpers/battleHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { hiddenTunnel, TUNNEL_CONTRACT } from '../server/sim/content/chapter16-tunnel.js';
const proof = JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-ch16-device-source.json', import.meta.url)));
const skillProof = JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-ch16-tunnel-skill-source.json', import.meta.url)));
const records = JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-enemy-records.canonical.json', import.meta.url))).enemies;
const miner = 'enemy_3010_mcreep';
function fixture({ hold = true, fail = false } = {}) {
  const h = makeBattle({ content: 'generic', autoFinish: false, timeLimit: 10000,
    defs: { enemies: { [miner]: records[miner].levels[0] } }, setup: installEnemyFeatures });
  const { b } = h;
  const calls = [], born = [];
  const install = col => {
    const owner = b.spawnDevice('tunnel', 10, col, { hp: 3000, def: 100, blockCnt: 0 });
    const state = hiddenTunnel(b, owner, { spawnBranch(branch, action, source) {
      calls.push({ branch, action, source, at: b.time });
      if (fail) return null;
      const child = h.spawn(miner, { route: { motion: 'WALK', start: [10, col], end: [10, 2], checkpoints: [] }, countInTotal: false });
      if (hold) b.addBuff(child, { key: 'test:independent-hold', persist: true, flags: { noMove: true } });
      born.push(child); return child;
    } });
    return { owner, state };
  };
  const { owner, state } = install(8);
  const run = seconds => { h.run(seconds); assert.deepEqual(b.errors, []); };
  return { h, b, owner, state, run, calls, born, install };
}
const actions = (key, event) => JSON.parse(JSON.parse(proof.templates[key].originalJson)
  .eventToActions._items.find(e => e.key === event).value.SerializedState);

test('tunnel parameters and manual mode switches agree with retained original data', () => {
  const skill = proof.skills.sktok_spawnp.levels[0];
  assert.equal(skill.skillType, 'MANUAL');
  assert.equal(skill.spData.spType, 'INCREASE_WITH_TIME');
  assert.equal(skill.spData.spCost, TUNNEL_CONTRACT.spCost);
  assert.equal(skill.spData.initSp, TUNNEL_CONTRACT.initSp);
  assert.equal(skill.spData.increment, TUNNEL_CONTRACT.spPerSecond);
  const bb = Object.fromEntries(skill.blackboard.map(v => [v.key, v.valueStr ?? v.value]));
  for (const [key, name] of [['interval', 'interval'], ['total', 'max_mcreep_count'], ['waiting', 'max_mcreep_near_count'], ['branch', 'branch_id'], ['action', 'action_index']])
    assert.equal(TUNNEL_CONTRACT[key], bb[`talent@${name}`]);
  const native = Object.values(skillProof.prefabs)[0].map(r => JSON.parse(r.originalJson)).find(o => '_switchToMode' in o);
  assert.equal(native._switchToMode, 1); assert.equal(native._switchToModeDown, 0);
  assert.equal(native._canSilenced, 0); assert.equal(native._canUseInAbnormalState, 0);
  const trigger = actions('spawnp_t[summon_trigger]', 2);
  assert.equal(trigger[0]._stackCountKey, 'max_mcreep_near_count');
  assert.equal(trigger[1]._stackCountKey, 'max_mcreep_count');
  assert.ok(trigger.slice(0, 2).every(a => a._condType === 'LT'));
  const mode = trigger[2];
  assert.equal(mode._conditionNode._checkCurModeIndex, 0);
  for (const summon of [mode._succeedNodes[0], mode._failNodes[0]]) {
    assert.ok(summon.$type.endsWith('SummonEnemiesFollowBranchRoute'));
    assert.equal(summon._managedByScheduler, false); assert.equal(summon._unharmful, true);
    assert.equal(summon._setHostUid, true); assert.equal(summon._summonAllRoute, false);
  }
});

test('standby waits for the first 15-second summon, then caps the waiting queue at three', () => {
  const { state, run, born, calls, owner } = fixture();
  run(14.8); assert.equal(born.length, 0); assert.equal(state.activate(), false);
  run(.3); assert.equal(born.length, 1); assert.equal(state.waiting, 1);
  assert.deepEqual(calls[0].branch, 'mcreep_route'); assert.equal(calls[0].action, 0); assert.equal(calls[0].source, owner);
  assert.equal(born[0].counted, false); assert.equal(born[0].lpr, 0);
  assert.equal(born[0].mem.ch16TunnelHost.unit, owner);
  run(45); assert.equal(born.length, 3); assert.equal(state.total, 3); assert.equal(state.waiting, 3);
  assert.ok(born.every(m => m.findBuff('spawnp_t[stop_move]')));
});

test('manual command releases only the owner queue, and toggling back does not recall released miners', () => {
  const { state, run, born, install } = fixture({ hold: false });
  const other = install(9);
  run(15.1); assert.equal(state.waiting, 1); assert.equal(other.state.waiting, 1);
  const own = born.find(m => m.mem.ch16TunnelHost.unit !== other.owner), foreign = born.find(m => m.mem.ch16TunnelHost.unit === other.owner);
  const x = own.x;
  assert.equal(state.activate(), true); assert.equal(state.mode, 1);
  assert.equal(state.waiting, 0); assert.equal(other.state.waiting, 1);
  assert.equal(own.findBuff('spawnp_t[stop_move]'), null);
  assert.ok(foreign.findBuff('spawnp_t[stop_move]'));
  run(.5); assert.notEqual(own.x, x);
  run(14.5); assert.equal(state.activate(), true); assert.equal(state.mode, 0);
  assert.ok(born.filter(m => m.mem.ch16TunnelHost.unit !== other.owner).every(m => !m.findBuff('spawnp_t[stop_move]')));
});

test('total cap counts released survivors and a freed slot waits until the next scheduled attempt', () => {
  const { b, state, run, born } = fixture();
  run(60); assert.equal(state.activate(), true);
  run(30); assert.equal(state.total, 5); assert.equal(state.waiting, 0);
  assert.equal(state.activate(), true); assert.equal(state.mode, 0);
  run(15); assert.equal(born.length, 5);
  b.kill(born[0], null); assert.equal(state.total, 4);
  run(.1); assert.equal(born.length, 5);
  run(14.9); assert.equal(born.length, 6); assert.equal(state.total, 5); assert.equal(state.waiting, 1);
});

test('failed summons do not fabricate miners or retry continuously; abnormal casting preserves SP', () => {
  const { b, owner, state, run, calls } = fixture({ fail: true });
  run(15); assert.equal(calls.length, 1); assert.equal(state.total, 0);
  b.applyStatus(owner, 'stun', { duration: 1 });
  assert.equal(state.activate(), false); assert.ok(Math.abs(state.sp - 15) < 1e-9);
  run(1.1); assert.equal(calls.length, 1);
  b.applyStatus(owner, 'silence', { duration: 5 });
  assert.equal(state.activate(), true, 'the original manual command cannot be silenced');
  run(14); assert.equal(calls.length, 2);
});

test('removing the tunnel does not invent release of already-born independent buffs', () => {
  const { b, owner, state, run, born } = fixture();
  run(15); b.kill(owner, null); run(30);
  assert.equal(born.length, 1); assert.equal(state.activate(), false);
  assert.ok(born[0].findBuff('spawnp_t[stop_move]'));
  b.kill(born[0], null); assert.equal(state.total, 0); assert.equal(state.waiting, 0);
});

test('total and waiting counters follow their own native finish actions', () => {
  const { b, state, run, born } = fixture();
  run(15);
  b.removeBuff(born[0], 'spawnp_t[count_manager_m0]');
  assert.equal(state.total, 0); assert.equal(state.waiting, 1);
  assert.ok(born[0].findBuff('spawnp_t[stop_move]'), 'finishing the manager does not finish its independent stop buff');
  assert.equal(state.activate(), true);
  assert.equal(state.waiting, 1, 'the move selector requires the same-source count_manager_m0 mark');
  b.removeBuff(born[0], 'spawnp_t[stop_move]');
  assert.equal(state.waiting, 0);
});

test('natural SP modifiers and recovery locks do not change the independent summon interval', () => {
  const { b, owner, state, run, born } = fixture();
  b.addBuff(owner, { key: 'test:sp-scale', persist: true, mods: { spRecoveryMul: .2 } });
  run(15); assert.ok(Math.abs(state.sp - 3) < 1e-9); assert.equal(born.length, 1);
  b.addBuff(owner, { key: 'test:no-sp', persist: true, flags: { noSp: true } });
  run(15); assert.ok(Math.abs(state.sp - 3) < 1e-9); assert.equal(born.length, 2);
  b.removeBuff(owner, 'test:sp-scale'); b.removeBuff(owner, 'test:no-sp');
  run(12); assert.equal(state.activate(), true);
});
