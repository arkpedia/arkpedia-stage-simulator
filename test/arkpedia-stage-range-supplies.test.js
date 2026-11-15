// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { rangeSupplyDefinition, rangeSupplyNativeReviewed } from '../shared/arkpedia/stage-range-supplies.js';
import { canTargetAlly } from '../server/sim/targeting.js';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
const c = await loadContentContext(), plans = new Map();
for (const id of ['5-6', 'cb-6']) { const p = await planStage(c, id); assert.deepEqual(p.blockers, []); plans.set(id, p); }
function setup(id) {
  const stage = structuredClone(plans.get(id).stage);
  stage.waves = [];
  const b = new StandardBattle({ ...c.mvp, stage, enemies: { ...c.mvp.enemies, ...stage.enemies } },
    { operators: ['char_123_fang', 'char_122_beagle'].map(id => defaultBuild(c.mvp.operators[id])) });
  b.setViewport('fullscreen-workspace'); b.autoFinish = false; b.life = 1e6; b.getPlayer('arkpedia').dp = 99;
  const advance = t => { for (let i = 0; i < Math.ceil(t / b.dt); i++) b.step(); };
  const tile = (r, col, build) => b.grid.setTile(r, col, { ...b.grid.tile(r, col), build });
  return { b, advance, tile, card: stage.tokens[0] };
}

test('range supplies preserve original levels and reject changed source selection and SP clocks', () => {
  assert.equal(plans.get('5-6').stage.tokens[0].hp, 1000);
  for (const id of ['trap_006_antidr', 'trap_009_battery']) {
    assert.equal(rangeSupplyNativeReviewed(id), true);
    assert.throws(() => rangeSupplyDefinition(id, { level: 31 }), /Unsupported/);
    const changed = structuredClone(native), key = id === 'trap_006_antidr' ? 'sktok_antidr' : id;
    changed.prefabs[key].components.find(c => '_targetOptions' in c.data).data._targetOptions.targetCategory = 3;
    assert.equal(rangeSupplyNativeReviewed(id, changed), false);
  }
  const changed = structuredClone(native);
  changed.prefabs.trap_009_battery.components.find(c => '_removeBuffWhenTargetLeave' in c.data).data._buffs[0].waitFirstTriggerInterval = 0;
  assert.equal(rangeSupplyNativeReviewed('trap_009_battery', changed), false);
});

test('Jammer consumes a ranged supply card, has native HP and targetability, and removes its drone aura on retreat', () => {
  const { b, advance, tile, card } = setup('5-6');
  tile(2, 3, 'MELEE'); assert.match(b.tokenPlacementError(card.unitId, 2, 3), /ranged/);
  tile(2, 3, 'RANGED'); const unit = b.deployToken(card.unitId, 2, 3);
  assert.equal(unit.hp, 1000); assert.equal(unit.deploymentSlotCost, 0); assert.equal(unit.obstacle, false);
  assert.equal(b.getPlayer('arkpedia').dp, 59); assert.equal(b.mvpStageTokens.get(card.unitId), 0);
  assert.equal(unit.s.flags.noBlock, true); assert.equal(unit.s.flags.isolated, true);
  assert.equal(unit.s.taunt, 1);
  unit.hp = 500; assert.equal(b.heal(unit, unit, 100), 0); assert.equal(unit.hp, 500);
  const id = Object.keys(plans.get('5-6').stage.enemies).find(id => plans.get('5-6').stage.enemies[id].tags.includes('drone'));
  const drone = b.spawnEnemy(id, { pos: [2, 4] }), other = b.spawnEnemy(id, { pos: [2, 4] });
  assert.ok(drone.tags.has('drone')); assert.notEqual(drone.tags, other.tags);
  other.tags = new Set(); const speed = drone.s.moveSpeed;
  for (const e of [drone, other]) b.addBuff(e, { key: 'hold', flags: { noMove: true } });
  assert.equal(canTargetAlly(drone, unit), true);
  advance(.1); assert.equal(drone.s.flags.disarm, true); assert.equal(drone.s.flags.silence, true);
  assert.equal(drone.s.moveSpeed, speed * .5); assert.ok(!other.s.flags.silence);
  const dp = b.getPlayer('arkpedia').dp; b.retreatStageToken(unit.mem.stageSupplyId);
  assert.ok(!drone.s.flags.disarm); assert.ok(!drone.s.flags.silence); assert.equal(drone.s.moveSpeed, speed);
  assert.equal(b.getPlayer('arkpedia').dp, dp + 20); assert.equal(b.mvpStageTokens.get(card.unitId), 0);
  assert.deepEqual(b.errors, []);
});

test('Portable Supply Station faces a recipient, waits four seconds, ignores isolation and respects skill SP locks', () => {
  const { b, advance, tile, card } = setup('cb-6');
  tile(2, 3, 'RANGED'); tile(1, 3, 'MELEE'); tile(2, 4, 'MELEE');
  const station = b.deployToken(card.unitId, 2, 3, 'DOWN');
  const target = b.deployOperator('char_123_fang', 1, 3, 'RIGHT');
  const outside = b.deployOperator('char_122_beagle', 2, 4, 'RIGHT');
  for (const u of [target, outside]) { u.skill.spType = 'attack'; u.skill.sp = 0; b.addBuff(u, { key: 'hold', flags: { disarm: true, isolated: true } }); }
  advance(3.9); assert.equal(target.skill.sp, 0); advance(.2); assert.equal(target.skill.sp, 3); assert.equal(outside.skill.sp, 0);
  b.addBuff(target, { key: 'spLock', flags: { noSp: true } }); advance(4); assert.equal(target.skill.sp, 3);
  b.removeBuff(target, 'spLock'); advance(4); assert.equal(target.skill.sp, 6);
  b.addBuff(target, { key: 'exclude', flags: { untargetable: true } }); advance(2); b.removeBuff(target, 'exclude');
  advance(3.9); assert.equal(target.skill.sp, 6); advance(.2); assert.equal(target.skill.sp, 9);
  assert.equal(station.profile.enemyTargetableDevice, undefined);
  const dp = b.getPlayer('arkpedia').dp; b.retreatStageToken(station.mem.stageSupplyId); advance(4);
  assert.equal(target.skill.sp, 9); assert.ok(b.getPlayer('arkpedia').dp >= dp + 5); assert.equal(b.mvpStageTokens.get(card.unitId), 0);
  assert.deepEqual(b.errors, []);
});
