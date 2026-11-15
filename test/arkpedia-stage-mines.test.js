// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { selectStaticDeviceInstances, validateStaticDeviceInstances } from '../tools/arkpedia/stage-device-instances.mjs';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { mineDefinition, mineNativeReviewed } from '../shared/arkpedia/stage-mines.js';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
const c = await loadContentContext(), plan = await planStage(c, 'h7-3');
assert.deepEqual(plan.blockers, []);
function setup() {
  const stage = structuredClone(plan.stage); stage.waves = []; stage.geometry.waves = [];
  const b = new StandardBattle({ ...c.mvp, stage, enemies: { ...c.mvp.enemies, ...stage.enemies } }, { operators: [defaultBuild(c.mvp.operators.char_123_fang)] });
  b.setViewport('fullscreen-workspace'); b.autoFinish = false; b.life = 1e6; b.getPlayer('arkpedia').dp = 99;
  const card = stage.tokens.find(t => t.unitId === 'trap_012_mine'), r = b.rect.r0 + 2, col = b.rect.c0 + 2;
  for (let i = 0; i < 3; i++) b.grid.setTile(r, col + i, { ...b.grid.tile(r, col + i), build: 'MELEE' });
  const advance = t => { for (let i = 0; i < Math.ceil(t / b.dt); i++) b.step(); };
  const enemy = (dx = 0, flying = false) => {
    const e = b.spawnEnemy(Object.keys(stage.enemies)[0], { pos: [r, col] });
    e.x = col + dx; e.y = r; e.motion = flying ? 'FLY' : 'WALK'; e.ground = !flying;
    e.base.maxHp = 100000; e.base.def = 0; e.base.res = 0; e.markDirty(); e.hp = e.s.maxHp;
    b.addBuff(e, { key: 'hold', persist: true, flags: { noMove: true, disarm: true } });
    return e;
  };
  return { b, advance, card, r, col, enemy, deploy: () => b.deployToken(card.unitId, r, col) };
}
test('mine gate rejects changed geometry, effect order, stacking and instance', () => {
  assert.equal(mineNativeReviewed(), true);
  const instance = { level: 1, elite: 0, potential: 0, skill_index: 0, skill_level: 1 };
  assert.equal(mineDefinition(instance).spCost, 25);
  assert.throws(() => mineDefinition({ ...instance, skill_level: 2 }), /Unsupported/);
  for (const mutate of [
    a => { a.find(c => 'm_Radius' in c.data).data.m_Radius = 1; },
    a => { a.find(c => c.data._activeBuffs?.length).data._activeBuffs.reverse(); },
    a => { a.find(c => c.data._activeBuffs?.length).data._activeBuffs[0].independentCharacterSource = 1; },
  ]) { const changed = structuredClone(native); mutate(changed.prefabs.sktok_mine.components); assert.equal(mineNativeReviewed(changed), false); }
});
test('H7-3 mines use stock, DP, ground placement and cooldown; retreat cancels the live SP account with no refund', () => {
  const { b, card, r, col, deploy, advance } = setup();
  assert.equal(card.count, 2); assert.equal(card.cost, 5); assert.equal(card.cooldown, 7);
  b.grid.setTile(r, col, { ...b.grid.tile(r, col), build: 'RANGED' });
  assert.match(b.tokenPlacementError(card.unitId, r, col), /ground/);
  b.grid.setTile(r, col, { ...b.grid.tile(r, col), build: 'MELEE' });
  const mine = deploy(); assert.equal(mine.hp, 100); assert.equal(mine.s.blockCnt, 0);
  assert.equal(mine.obstacle, false); assert.equal(mine.deploymentSlotCost, 0);
  assert.equal(b.getPlayer('arkpedia').dp, 94); assert.equal(b.mvpStageTokens.get(card.unitId), 1);
  assert.match(b.tokenPlacementError(card.unitId, r, col + 1), /recharging/);
  advance(7); const second = b.deployToken(card.unitId, r, col + 1); assert.ok(second.alive);
  const dp = b.getPlayer('arkpedia').dp; b.retreatStageToken(mine.mem.stageSupplyId);
  assert.equal(b.getPlayer('arkpedia').dp, dp); assert.equal(b.mvpStageTokens.get(card.unitId), 0);
  const sp = mine.skill.sp; advance(30); assert.equal(mine.skill.sp, sp); assert.ok(!mine.alive);
  assert.deepEqual(b.errors, []);
});
test('mine waits 25 SP, ignores stealth, applies amplification before True damage and excludes air/outside radius', () => {
  const { b, advance, deploy, enemy, card } = setup(), mine = deploy();
  const target = enemy(), inside = enemy(card.radius - .001), outside = enemy(card.radius + .001), air = enemy(0, true);
  b.addBuff(target, { key: 'stealth', flags: { stealth: true, untargetable: true } });
  advance(24.9); assert.ok(mine.alive); assert.equal(target.hp, 100000);
  advance(.2); assert.equal(mine.alive, false); assert.equal(mine.skill.activations, 1);
  assert.equal(target.hp, 97000); assert.equal(inside.hp, 97000); assert.equal(outside.hp, 100000); assert.equal(air.hp, 100000);
  assert.equal(target.s.dmgTakenMul, 1.5);
  assert.deepEqual(b.errors, []);
});
test('external SP and SP locks use the common account; stun defers casting and silence does not', () => {
  const { b, advance, deploy, enemy } = setup(), mine = deploy(), target = enemy();
  b.addBuff(mine, { key: 'lock', flags: { noSp: true } });
  advance(2); mine.skill.gainSp(25, 'external'); assert.equal(mine.skill.sp, 0);
  b.removeBuff(mine, 'lock'); b.applyStatus(mine, 'stun', { duration: 2 });
  mine.skill.gainSp(25, 'external'); advance(1); assert.equal(mine.skill.sp, 25); assert.ok(mine.alive);
  b.applyStatus(mine, 'silence', { duration: 10 }); advance(1.1);
  assert.equal(target.hp, 97000); assert.equal(mine.alive, false); assert.deepEqual(b.errors, []);
});
test('full mines retain their charge without ground targets; independent copies refresh one damage effect for 15s', () => {
  const { b, advance, deploy, enemy, r, col, card } = setup(), mine = deploy();
  advance(25.1); assert.ok(mine.skill.ready); assert.ok(mine.alive);
  const target = enemy(); advance(.1); assert.equal(target.hp, 97000);
  advance(7); const second = b.deployToken(card.unitId, r, col); second.skill.gainSp(25, 'external'); advance(.1);
  assert.equal(target.hp, 94000); assert.equal(target.buffs.filter(x => x.key === 'stage:mineDamageTaken').length, 1);
  for (const type of ['phys', 'arts', 'true', 'elemental']) {
    const before = target.hp; b.dealDamage(null, target, { amount: 100, type, canDodge: false, ignoreSelect: true });
    assert.equal(before - target.hp, type === 'elemental' ? 100 : 150, type);
  }
  advance(14.8); assert.equal(target.s.dmgTakenMul, 1.5);
  advance(.3); assert.equal(target.s.dmgTakenMul, 1); assert.deepEqual(b.errors, []);
});

test('preplaced mines load from original instances across six stages without spending stock or DP', async () => {
  for (const [id, count] of [['s7-1', 2], ['s7-2', 1], ['mn-ex-6', 5], ['mn-ex-6_challenge_mode', 5], ['sv-6_act10d5_06', 5], ['sv-6_challenge_mode', 5]]) {
    const p = await planStage(c, id); assert.deepEqual(p.blockers, [], id);
    const stage = structuredClone(p.stage); stage.waves = []; stage.geometry.waves = [];
    const b = new StandardBattle({ ...c.mvp, stage, enemies: { ...c.mvp.enemies, ...stage.enemies } },
      { operators: [defaultBuild(c.mvp.operators.char_123_fang)] });
    b.setViewport('fullscreen-workspace'); b.autoFinish = false;
    const mines = b.units.filter(u => u.mem.stageSupplyToken === 'trap_012_mine');
    assert.equal(mines.length, count, id);
    const stock = stage.tokens.find(t => t.unitId === 'trap_012_mine');
    assert.equal(b.mvpStageTokens.get('trap_012_mine'), stock?.count);
    const dp = b.getPlayer('arkpedia').dp;
    assert.equal(dp, stage.battle.initial_dp);
    const mine = mines[0], definition = mine.mem.stageSupplyDefinition;
    assert.equal(mine.skill.sp, 0); assert.equal(mine.deploymentSlotCost, 0); assert.equal(mine.obstacle, false);
    assert.ok(stage.devices.some(d => d.key === 'trap_012_mine' && d.row === mine.tileR && d.col === mine.tileC));
    const enemy = b.spawnEnemy(Object.keys(stage.enemies)[0], { pos: [mine.tileR, mine.tileC] });
    enemy.mem.pulseImmune = true; // Keep the controlled target out of the altar damage assertion.
    enemy.base.maxHp = 100000; enemy.markDirty(); enemy.hp = enemy.s.maxHp;
    b.addBuff(enemy, { key: 'hold', persist: true, flags: { noMove: true, disarm: true } });
    for (let i = 0; i < Math.floor(24.9 / b.dt); i++) b.step();
    assert.ok(mine.alive, id); assert.equal(enemy.hp, 100000);
    for (let i = 0; i < Math.ceil(.2 / b.dt); i++) b.step();
    assert.equal(mine.alive, false); assert.equal(enemy.hp, 97000, id);
    assert.equal(b.mvpStageTokens.get('trap_012_mine'), stock?.count);
    assert.equal(definition.refundRatio, 0); assert.ok(b.getPlayer('arkpedia').dp >= dp);
    if (count > 1) {
      const before = b.getPlayer('arkpedia').dp;
      b.retreatStageToken(mines.at(-1).mem.stageSupplyId);
      assert.equal(b.getPlayer('arkpedia').dp, before);
    } else assert.throws(() => b.retreatStageToken(mine.mem.stageSupplyId), /no longer/);
    assert.deepEqual(b.errors, [], id);
  }
});


test('preplaced mines reject missing, changed and scheduled source instances; hidden copies stay absent', () => {
  const device = { key: 'trap_012_mine', name: 'Interference Mine', row: 2, col: 3, hidden: false };
  const original = { position: { row: 2, col: 3 }, alias: 'mine', hidden: false,
    inst: { characterKey: device.key, phase: 'PHASE_0', level: 1, favorPoint: 0, potentialRank: 0 },
    skillIndex: 0, mainSkillLvl: 1 };
  const level = p => ({ predefines: { tokenInsts: [p] }, waves: [] });
  const instances = {}; validateStaticDeviceInstances([device], level(original), instances);
  assert.deepEqual(instances['trap_012_mine:2:3'], { level: 1, skillLevel: 1 });
  for (const mutate of [
    p => p.inst.level = 31, p => p.inst.phase = 1, p => p.inst.potentialRank = 1,
    p => p.skillIndex = 1, p => p.mainSkillLvl = 2, p => p.overrideSkillBlackboard = [],
  ]) { const p = structuredClone(original); mutate(p); assert.throws(() => validateStaticDeviceInstances([device], level(p)), /override/); }
  assert.throws(() => validateStaticDeviceInstances([device], { predefines: { tokenInsts: [] } }), /Missing/);
  assert.throws(() => selectStaticDeviceInstances([device], { ...level(original), waves: [{ fragments: [{ actions: [{ key: 'mine' }] }] }] }), /Scheduled/);
  const hidden = selectStaticDeviceInstances([{ ...device, hidden: true }], level({ ...original, hidden: true }));
  assert.deepEqual(hidden.devices, []);
});
