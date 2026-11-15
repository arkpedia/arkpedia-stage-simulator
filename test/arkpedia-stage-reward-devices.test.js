// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
import { StageRewardDevices } from '../server/sim/content/arkpedia-stage-reward-devices.js';
import { StageBranchScheduler } from '../server/sim/content/arkpedia-stage-branches.js';
import { readStageOutcomes } from '../server/sim/content/arkpedia-stage-outcomes.js';
import { rewardDeviceNativeReviewed, rewardDeviceDefinition } from '../shared/arkpedia/stage-reward-devices.js';
import { selectStaticDeviceInstances, validateStaticDeviceInstances } from '../tools/arkpedia/stage-device-instances.mjs';
import { compileStageWaves } from '../tools/arkpedia/stage-waves.mjs';
import { canTargetEnemy, canTargetAlly, areaSelectable } from '../server/sim/targeting.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
const id = 'trap_757_skzbox';
const entry = (extra = {}) => ({ name: 'Treasure Chest', kind: 'device', key: id, row: 9, col: 7, hidden: false,
  alias: 'chest#1', instance: { level: 1, skillLevel: 1 }, ...extra });
function fixture(hidden = false, rewardId = id, medic = false) {
  const op = chessRec({ id: 'chest_test', ...(medic ? { profession: 'MEDIC', subProf: 'physician', skill: null } : {}), stats: { atk: 1000, maxHp: 10000 } });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { chess: { [op.chessId]: op }, enemies: { target: enemyRec({ speed: 0 }) } },
    units: [{ chessId: op.chessId, row: 9, col: 6 }] });
  h.b.start();
  if (rewardId === 'trap_758_skzmbx') h.b.stageBranches = new StageBranchScheduler(h.b, { box: { spawns: [
    { enemyKey: 'target', routeIndex: 0, count: 1, offset: 0, interval: 1, order: 0 },
  ] } });
  const controller = new StageRewardDevices(h.b, [entry({ hidden, key: rewardId, instance: { level: 1, skillLevel: 1, branchId: 'box' } })]);
  return { ...h, controller, chest: controller.entries.get('chest#1').unit, ally: h.b.allyUnits[0] };
}
test('chest source admission checks side, abilities, immunities and result amount', () => {
  assert.equal(rewardDeviceNativeReviewed(id), true);
  for (const mutate of [
    n => n.prefabs[id].components.find(c => c.object === id).data._sideType = 1,
    n => n.prefabs[id].components.find(c => c.object === 'LogKilled').data._buffs[0].attributes.abnormalImmunes.push(7),
    n => n.templates.log_killed.eventToActions.ON_OWNER_KILLED[0]._additionValue = 2,
    n => n.templates.log_killed.eventToActions.ON_OWNER_KILLED[0]._additionValueKey = 'amount',
  ]) { const n = structuredClone(native); mutate(n); assert.equal(rewardDeviceNativeReviewed(id, n), false); }
  assert.equal(rewardDeviceDefinition(id, { level: 1, skillLevel: 1 }).hp, 5000);
  assert.equal(rewardDeviceDefinition(id, { level: 15, skillLevel: 1 }).hp, 145000);
  assert.equal(rewardDeviceDefinition(id, { level: 30, skillLevel: 1 }).hp, 295000);
  assert.throws(() => rewardDeviceDefinition(id, { level: 31, skillLevel: 1 }));
});
test('chests are stationary enemy-side targets with no wave, deployment or route-blocking credit', () => {
  const { b, chest, ally } = fixture();
  assert.equal(chest.side, 'enemy'); assert.equal(chest.def.profession, 'TRAP');
  assert.ok(b.enemies.includes(chest)); assert.ok(!b.allyUnits.includes(chest));
  assert.equal(chest.counted, false); assert.equal(chest.deploymentSlotCost, 0); assert.equal(chest.obstacle, false);
  assert.ok(canTargetEnemy(ally, chest)); assert.equal(b.total, 0);
  for (const status of ['stun', 'freeze', 'silence']) assert.equal(b.applyStatus(chest, status, { duration: 3 }), false);
  for (let i = 0; i < 30; i++) b.step();
  assert.equal(chest.x, 7); assert.equal(chest.y, 9); assert.deepEqual(b.errors, []);
  b.dealDamage(ally, chest, { amount: 1000000, type: 'true', isAttack: true });
  assert.equal(chest.alive, false); assert.equal(b.killed, 0); assert.equal(b.total, 0);
  assert.equal(readStageOutcomes(b).counters[id], 1);
  b.kill(chest); assert.equal(readStageOutcomes(b).counters[id], 1);
});
test('hidden chests activate once and non-kill removals give no reward counter', () => {
  const { b, controller, chest } = fixture(true);
  assert.equal(chest, null); assert.equal(controller.activate('absent'), false);
  controller.activate('chest#1'); const unit = controller.entries.get('chest#1').unit;
  controller.activate('chest#1'); assert.equal(b.units.filter(u => u.defId === id).length, 1);
  b._remove(unit, 'expire'); assert.deepEqual(readStageOutcomes(b), { counters: {}, events: [] });
  controller.activate('chest#1'); assert.equal(unit.alive, false);
});
test('source device aliases retain hidden state and require exact supported instances', () => {
  const d = entry({ hidden: true }), p = { hidden: true, alias: d.alias, position: { row: d.row, col: d.col },
    inst: { characterKey: id, level: 1, phase: 'PHASE_0', potentialRank: 0, favorPoint: 0 }, skillIndex: 0, mainSkillLvl: 1 };
  const level = { predefines: { tokenInsts: [p] }, waves: [{ fragments: [{ actions: [{ actionType: 'ACTIVATE_PREDEFINED', key: d.alias }] }] }] };
  const result = selectStaticDeviceInstances([d], level), instances = {};
  validateStaticDeviceInstances(result.devices, result.level, instances);
  assert.equal(result.devices[0].hidden, true); assert.deepEqual(instances[`${id}:9:7`], { level: 1, skillLevel: 1 });
  const bad = structuredClone(result.level); bad.predefines.tokenInsts[0].overrideTalents = [];
  assert.throws(() => validateStaticDeviceInstances(result.devices, bad), /Unimplemented device instance/);
});
test('the shared scheduler activates a hidden chest at the original offset without counting it as an enemy wave', () => {
  const data = structuredClone(mvp), d = entry({ row: 1, col: 1, hidden: true });
  data.stage.devices = [d];
  const action = { actionType: 'ACTIVATE_PREDEFINED', key: d.alias, managedByScheduler: true, count: 1, preDelay: 3, interval: 1 };
  const level = { waves: [{ preDelay: 0, postDelay: 0, maxTimeWaitingForNextWave: -1, fragments: [{ preDelay: 0, actions: [action] }] }] };
  const geometry = { waves: [{ pre_delay: 0, post_delay: 0, duration: 3, max_wait_for_next_wave: null, spawns: [] }] };
  data.stage.waveProgram = compileStageWaves(level, geometry, {}, null, [d.alias]);
  const b = new StandardBattle(data, { operators: [defaultBuild(mvp.operators.char_123_fang)] });
  while (b.time < 2.9 && !b.finished) b.step();
  assert.equal(b.stageRewardDevices.entries.get(d.alias).unit, null);
  while (b.time < 3.1 && !b.finished) b.step();
  assert.ok(b.stageRewardDevices.entries.get(d.alias).unit);
  assert.equal(b.total, 0); assert.equal(b.reason, 'cleared'); assert.deepEqual(b.errors, []);
  assert.throws(() => compileStageWaves(level, geometry), /Unsupported scheduled predefined target/);
});


test('Dying Fowlbeast starts at one HP, rejects hostile selection, and accepts ordinary healing', () => {
  const fowlId = 'trap_759_skzwyx', { b, chest: fowl, ally, runUntil } = fixture(false, fowlId, true);
  assert.equal(fowl.hp, 1); assert.equal(fowl.s.maxHp, 6000); assert.equal(fowl.side, 'ally');
  const enemy = b.spawnEnemy('target', { pos: [9, 9] });
  assert.equal(canTargetAlly(enemy, fowl, true), false); assert.equal(areaSelectable(enemy, fowl), false);
  assert.equal(b.applyStatus(fowl, 'stun', { duration: 1 }), false);
  ally.profile = { ...ally.profile, noAttack: false, heal: { mode: 'single' } };
  ally.rangeKeys = [9 * b.grid.cols + 7];
  assert.ok(b.injuredAlliesInKeys(ally.rangeKeys, ally).includes(fowl));
  runUntil(() => !fowl.alive, 30);
  assert.equal(fowl.alive, false, 'ordinary attack-loop healing completes the rescue');
  assert.equal(readStageOutcomes(b).counters[fowlId], 1); assert.equal(b.killed, 0);
  assert.ok(ally.stats.heal >= 5999); assert.deepEqual(b.errors, []);
});
test('Fowlbeast low taunt does not drain HP; damage floors at one and killing does not rescue', () => {
  const fowlId = 'trap_759_skzwyx', { b, chest: fowl, ally, run } = fixture(false, fowlId);
  b.heal(ally, fowl, 1000); const healed = ally.stats.heal;
  let damageEvents = 0; b.on('damaged', e => { if (e.target === fowl) damageEvents++; });
  run(1); assert.equal(fowl.hp, 1001); assert.equal(fowl.s.taunt, -1); assert.equal(damageEvents, 0); assert.equal(ally.stats.heal, healed);
  b.dealDamage(null, fowl, { amount: 100000, type: 'true' }); assert.equal(fowl.hp, 1); assert.equal(fowl.alive, true);
  b.kill(fowl); assert.equal(readStageOutcomes(b).counters[fowlId], undefined);
});
test('full ordinary healing logs once after HP settles and initializer runs before deployment observers', () => {
  const { b, ally } = fixture(true), seen = [];
  b.on('deploy', ({ unit }) => { if (unit.defId === 'trap_759_skzwyx') seen.push({ hp: unit.hp, side: unit.side, targetFree: unit.s.flags.targetFree }); });
  const c = new StageRewardDevices(b, [entry({ key: 'trap_759_skzwyx', row: 10, alias: 'bird' })]);
  const fowl = c.entries.get('bird').unit;
  assert.deepEqual(seen, [{ hp: 1, side: 'ally', targetFree: true }]);
  assert.equal(b.heal(ally, fowl, 10000), 5999); assert.equal(fowl.alive, false);
  assert.equal(readStageOutcomes(b).counters.trap_759_skzwyx, 1);
  assert.equal(b.heal(ally, fowl, 10000), 0); assert.equal(readStageOutcomes(b).events.length, 1);
});
test('Fowlbeast admission checks the HP threshold, protected initial loss, side and taunt attribute', () => {
  const fowlId = 'trap_759_skzwyx'; assert.equal(rewardDeviceNativeReviewed(fowlId), true);
  for (const mutate of [
    n => n.prefabs[fowlId].components.find(c => c.object === fowlId).data._sideType = 2,
    n => n.prefabs[fowlId].components.find(c => c.object === 'Passive').data._buffs[1].attributes.attributeModifiers[0].value = -10,
    n => n.templates['trap_skzwyx[init]'].eventToActions.ON_BUFF_START[0]._succeedNodes[0]._isUndeadable = false,
    n => n.templates['trap_skzwyx[hurt]'].eventToActions.ON_BUFF_TRIGGER[0]._conditionNode._value = .5,
  ]) { const n = structuredClone(native); mutate(n); assert.equal(rewardDeviceNativeReviewed(fowlId, n), false); }
  assert.equal(rewardDeviceDefinition(fowlId, { level: 30, skillLevel: 1 }).hp, 12000);
});

test('regeneration rescues on the periodic full-HP check without ordinary healing modifiers', () => {
  const { b, chest: fowl, run } = fixture(false, 'trap_759_skzwyx');
  let ordinary = 0, regenerated = 0;
  b.on('healed', () => ordinary++); b.on('regenerated', () => regenerated++);
  assert.equal(b.heal(null, fowl, 5999, { regen: true }), 5999);
  assert.equal(ordinary, 0); assert.equal(regenerated, 1); assert.equal(fowl.alive, true);
  run(.2); assert.equal(fowl.alive, false);
  assert.equal(readStageOutcomes(b).counters.trap_759_skzwyx, 1);
});

test('a mimic triggers its bound branch on the first ordinary hit, including fatal and reentrant hits', () => {
  for (const amount of [1, 100000]) {
    const { b, chest, ally } = fixture(false, 'trap_758_skzmbx');
    b.on('enemySpawn', () => b.dealDamage(ally, chest, { amount: 1, type: 'true' }));
    b.dealDamage(ally, chest, { amount, type: 'true' });
    assert.equal(chest.alive, false); assert.equal(b.enemies.filter(e => e.mem.stageBranch).length, 1);
    assert.equal(b.total, 0); assert.equal(b.killed, 0);
    assert.deepEqual(readStageOutcomes(b), { counters: {}, events: [] });
    assert.deepEqual(b.errors, []);
  }
});
test('HP loss and direct kill do not activate a mimic branch', () => {
  const { b, chest } = fixture(false, 'trap_758_skzmbx');
  b.loseHp(chest, 10); assert.equal(chest.alive, true); assert.equal(b.stageBranches.serial, 0);
  b.kill(chest); assert.equal(b.stageBranches.serial, 0);
});
test('mimic admission requires the original damage trigger and exact branch binding', () => {
  const id = 'trap_758_skzmbx'; assert.equal(rewardDeviceNativeReviewed(id), true);
  for (const mutate of [
    n => n.templates.trap_badbox_s.eventToActions.ON_TAKE_DAMAGE[0]._blockGameFinish = true,
    n => n.templates.trap_badbox_s.eventToActions.ON_TAKE_DAMAGE[1]._targetType = 'SOURCE',
    n => n.prefabs[id].components.find(c => c.object === id).data._sideType = 1,
  ]) { const n = structuredClone(native); mutate(n); assert.equal(rewardDeviceNativeReviewed(id, n), false); }
  assert.throws(() => rewardDeviceDefinition(id, { level: 1, skillLevel: 1 }), /branch binding/);
  const d = entry({ name: 'Stagnant Contraption', key: id, hidden: true }), instances = {};
  const p = { hidden: true, alias: d.alias, position: { row: d.row, col: d.col }, inst: {
    characterKey: id, level: 1, phase: 'PHASE_0', potentialRank: 0, favorPoint: 0 }, skillIndex: 0, mainSkillLvl: 1,
    overrideSkillBlackboard: [{ key: 'branch_id', value: 0, valueStr: 'box' }] };
  const level = { predefines: { tokenInsts: [p] }, branches: { box: { phases: [] } } };
  validateStaticDeviceInstances([d], level, instances); assert.equal(instances[`${id}:9:7`].branchId, 'box');
  p.overrideSkillBlackboard[0].valueStr = 'unknown';
  assert.throws(() => validateStaticDeviceInstances([d], level), /instance override/);
});
