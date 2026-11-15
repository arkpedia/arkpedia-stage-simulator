// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { witheredAltarDefinition, witheredAltarNativeReviewed } from '../shared/arkpedia/stage-withered-altars.js';
import { beaconNative } from '../shared/arkpedia/enemy-beacon-features.js';
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import enemyNative from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
const c = await loadContentContext(), plan = await planStage(c, '14-3'); assert.deepEqual(plan.blockers, []);
function setup() {
  const stage = structuredClone(plan.stage); stage.waves = []; stage.geometry.waves = [];
  const b = new StandardBattle({ ...c.mvp, stage, enemies: { ...c.mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(c.mvp.operators.char_123_fang)] });
  b.setViewport('fullscreen-workspace'); b.autoFinish = false; b.getPlayer('arkpedia').dp = 99;
  const card = stage.tokens.find(t => t.unitId === 'trap_161_lrcage'), r = b.rect.r0 + 2, col = b.rect.c0 + 2;
  b.grid.setTile(r, col, { ...b.grid.tile(r, col), build: 'MELEE' });
  return { b, card, r, col, advance: t => { for (let i = 0; i < Math.ceil(t / b.dt); i++) b.step(); },
    deploy: () => b.deployToken(card.unitId, r, col) };
}
test('Altar gates retain original stats, enemy side, passive skill, death child and no-retreat policy', () => {
  assert.ok(witheredAltarNativeReviewed());
  const inst = { level: 30, elite: 0, potential: 0, skill_index: 0, skill_level: 1 };
  assert.equal(witheredAltarDefinition(inst).hp, 5000);
  assert.throws(() => witheredAltarDefinition({ ...inst, potential: 1 }), /Unsupported/);
  for (const mutate of [
    n => { n.prefabs.trap_161_lrcage.components.find(c => '_modes' in c.data).data._withdrawable = 1; },
    n => { n.templates['trap_stormcoord[summon_and_suicide]'].eventToActions.ON_OWNER_FINISH[0]._enemyKey = 'other'; },
  ]) { const n = structuredClone(native); mutate(n); assert.equal(witheredAltarNativeReviewed(n), false); }
  const rec = c.records.enemies.enemy_1421_lrchld.levels[0];
  assert.ok(beaconNative(rec, nativeComponents(enemyNative, rec.key)));
  const n = structuredClone(enemyNative), row = n.prefabs[`dyn/battle/prefabs/enemies/${rec.key}.prefab`].find(x => x.objectName === 'Default');
  const value = JSON.parse(row.originalJson); value._attack.m_PathID = '123'; row.originalJson = JSON.stringify(value);
  assert.equal(beaconNative(rec, nativeComponents(n, rec.key)), false);
});
test('Altar supply dependency includes Beacon even without a scheduled Beacon wave', () => {
  assert.ok(plan.dependencies.enemies.includes('enemy_1421_lrchld'));
  assert.ok(plan.stage.enemies.enemy_1421_lrchld);
  assert.ok(plan.stage.enemies.enemy_1421_lrchld.notCountInTotal);
});
test('player-placed altar is an attackable enemy, occupies its deployment tile without blocking routes, and cannot retreat', () => {
  const { b, deploy, card, r, col, advance } = setup(), total = b.total, altar = deploy();
  assert.equal(altar.side, 'enemy'); assert.ok(b.enemies.includes(altar)); assert.equal(altar.hp, 2000);
  assert.equal(altar.counted, false); assert.equal(b.total, total); assert.equal(altar.deploymentSlotCost, 0);
  assert.equal(b.getPlayer('arkpedia').dp, 94); assert.equal(b.mvpStageTokens.get(card.unitId), 0);
  assert.equal(b.unitAt(r, col), altar); assert.equal(b.grid.isObstacle(r, col), false);
  assert.throws(() => b.retreatStageToken(altar.mem.stageSupplyId), /cannot be retreated/);
  for (const status of ['stun', 'cold', 'freeze', 'levitate', 'silence', 'sleep']) assert.equal(b.applyStatus(altar, status, { duration: 10 }), false, status);
  advance(5); assert.equal(altar.x, col); assert.equal(altar.y, r); assert.equal(altar.profile.noAttack, true);
  const before = altar.hp; b.dealDamage(null, altar, { amount: 100, type: 'true' }); assert.equal(altar.hp, before - 100);
  assert.deepEqual(b.errors, []);
});
test('lethal altar damage releases exactly one non-counting Beacon on the same tile and clears the supply occupancy', () => {
  const { b, deploy, r, col, advance } = setup(), altar = deploy(), total = b.total;
  b.dealDamage(null, altar, { amount: 1e6, type: 'true' });
  const children = b.enemies.filter(e => e.defId === 'enemy_1421_lrchld'); assert.equal(children.length, 1);
  const beacon = children[0]; assert.equal(beacon.x, col); assert.equal(beacon.y, r);
  assert.equal(b.unitAt(r, col), null); assert.equal(beacon.counted, false); assert.equal(beacon.lpr, 0);
  assert.equal(b.total, total); assert.equal(b.killed, 0);
  b.kill(altar); assert.equal(b.enemies.filter(e => e.defId === 'enemy_1421_lrchld').length, 1);
  advance(10); assert.equal(beacon.x, col); assert.equal(beacon.y, r); assert.equal(beacon.profile.noAttack, true);
  assert.deepEqual(b.errors, []);
});
test('Beacon damage floor permits target selection and displacement while preventing damage loss, blocking and goal exit', () => {
  const { b, deploy, advance } = setup(), altar = deploy(); b.kill(altar);
  const beacon = b.enemies.find(e => e.defId === 'enemy_1421_lrchld'), hp = beacon.hp;
  assert.equal(beacon.s.flags.unblockable, true); assert.ok(!beacon.s.flags.untargetable); assert.ok(!beacon.s.flags.invulnerable);
  for (const type of ['phys', 'arts', 'true', 'elemental']) {
    b.dealDamage(null, beacon, { amount: 1e6, type, canDodge: false }); assert.equal(beacon.hp, hp, type);
  }
  for (const status of ['stun', 'cold', 'freeze', 'levitate', 'silence', 'sleep', 'disarm']) assert.equal(b.applyStatus(beacon, status, { duration: 10 }), false, status);
  assert.ok(beacon.findBuff('immune_shu_blink')); assert.ok(!beacon.s.flags.noDisplace);
  for (let dc = 0; dc < 4; dc++) b.grid.setTile(beacon.tileR, beacon.tileC + dc, { ...b.grid.tile(beacon.tileR, beacon.tileC + dc), pass: 'ALL', build: 'MELEE' });
  const x = beacon.x; b.push(beacon, 3, { dir: { x: 1, y: 0 } }); advance(.5); assert.ok(beacon.x > x);
  b.leak(beacon); assert.ok(beacon.alive); assert.equal(b.leakedCount, 0); assert.deepEqual(b.errors, []);
});

test('a surviving non-counting Beacon does not hold victory open after all waves finish', () => {
  const { b, deploy } = setup(), altar = deploy(); b.kill(altar); b.autoFinish = true; b.step();
  assert.equal(b.finished, true); assert.equal(b.reason, 'cleared');
});
