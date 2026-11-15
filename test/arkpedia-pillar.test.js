// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import stageData from '../data/arkpedia-stage-9-14_challenge_mode.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { canTargetEnemy } from '../server/sim/targeting.js';
import { demolitionDefinition, demolitionNativeReviewed } from '../shared/arkpedia/stage-demolition.js';
const token = { ...demolitionDefinition({ level: 1, elite: 0, potential: 0, skill_index: 0, skill_level: 1 }),
  unitId: 'trap_045_dublst', name: 'Demolition Device', behavior: 'demolition', count: 3, block: 0 };
function setup(chain = false) {
  const stage = structuredClone(stageData); stage.waves = [];
  stage.devices = [stage.devices.find(d => d.row === 6 && d.col === 3)];
  if (chain) stage.devices.push({ ...stage.devices[0], col: 5 });
  stage.tokens = [token];
  const data = { ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } };
  const b = new StandardBattle(data, { operators: Object.values(data.operators).slice(0, 5).map(defaultBuild) });
  b.autoFinish = false; b.life = 1e6; b.getPlayer('arkpedia').dp = 99;
  const advance = t => { for (let i = 0; i < Math.ceil(t / b.dt); i++) b.step(); };
  for (let r = 5; r <= 7; r++) for (let c = 1; c <= 8; c++) b.grid.setTile(r, c, { ...b.grid.tile(r, c), pass: 'ALL', build: 'MELEE' });
  const enemy = (r, c, hp = 20000) => {
    const e = b.spawnEnemy('pillar-test', { pos: [r, c], def: { key: 'pillar-test', name: 'Target', applyWay: 'MELEE', dmgType: 'phys',
      stats: { maxHp: hp, hp, atk: 1000, def: 0, res: 0, moveSpeed: 0, bat: 1, rangeRadius: 0, blockCnt: 1, lpr: 0 } } });
    e.profile.noAttack = true; return e;
  };
  return { b, advance, enemy, pillar: b.enemies.find(e => e.mem.stageUnitDevice?.pillar) };
}
const hit = (b, source, target, amount = 99999, extra = {}) => b.dealDamage(source, target, { amount, type: 'true', ...extra });

test('demolition source review rejects changed timing, selection and instance tuples', () => {
  assert.equal(demolitionNativeReviewed(), true);
  const n = structuredClone(native);
  n.prefabs.trap_045_dublst.components.find(c => c.data._damageType === 3).data._preDelay = 0;
  assert.equal(demolitionNativeReviewed(n), false);
  assert.throws(() => demolitionDefinition({ level: 31 }), /Unsupported/);
});

test('pillars reject diagonal, distant, sourceless and environment damage before HP loss', () => {
  const { b, pillar } = setup();
  const diagonal = b.spawnDevice('diagonal', 5, 2, { hp: 100 });
  const near = b.spawnDevice('near', 6, 2, { hp: 100 });
  assert.equal(canTargetEnemy(diagonal, pillar), false); assert.equal(canTargetEnemy(near, pillar), true);
  for (const [s, extra] of [[diagonal, {}], [null, {}], [near, { sourceless: true }], [near, { isEnvironment: true }]]) {
    assert.equal(hit(b, s, pillar, 99999, extra), 0); assert.equal(pillar.hp, 5000);
  }
  assert.equal(hit(b, near, pillar, 3000), 3000); assert.equal(pillar.hp, 2000);
  assert.equal(pillar.mem.stageUnitDevice.state, 'intact');
  assert.deepEqual(b.errors, []);
});

test('ordinary lethal hits use two-second protection, then a delayed two-forward-tile collapse', () => {
  const { b, advance, enemy, pillar } = setup();
  const source = b.spawnDevice('source', 6, 2, { hp: 100 });
  const first = enemy(6, 4), second = enemy(6, 5), beyond = enemy(6, 6);
  hit(b, source, pillar); assert.equal(pillar.hp, 1); assert.equal(pillar.alive, true);
  assert.equal(pillar.s.flags.undeadable, undefined); assert.equal(pillar.s.flags.untargetable, true);
  hit(b, source, pillar); advance(1.9); assert.ok(!pillar.mem.stageUnitDevice.collapsed);
  advance(.2); hit(b, source, pillar); assert.equal(pillar.mem.stageUnitDevice.state, 'collapsing');
  advance(1.4); assert.equal(first.hp, 20000); advance(.2);
  assert.equal(first.hp, 8000); assert.equal(second.hp, 8000); assert.equal(beyond.hp, 20000);
  assert.ok(first.s.flags.stun); assert.equal(pillar.alive, false);
  const ruins = b.allyUnits.filter(u => u.mem.battlefieldRuins);
  assert.deepEqual(ruins.map(u => [u.tileR, u.tileC]), [[6, 4], [6, 5]]);
  assert.equal(ruins[0].hp, 100); assert.equal(ruins[0].s.blockCnt, 3);
  hit(b, first, ruins[0], 9999, { isEnvironment: true }); assert.equal(ruins[0].hp, 100);
  hit(b, first, ruins[0]); assert.equal(ruins[0].alive, false); assert.equal(b.grid.isObstacle(6, 4), false);
  b.retreatStageToken(ruins[1].mem.stageSupplyId); assert.equal(b.grid.isObstacle(6, 5), false);
  assert.deepEqual(b.errors, []);
});

test('a demolition supply faces, spends stock and DP, fires once and chains through another pillar', () => {
  const { b, advance, pillar } = setup(true);
  const second = b.enemies.find(e => e !== pillar && e.mem.stageUnitDevice?.pillar);
  const device = b.deployToken(token.unitId, 6, 2, 'RIGHT');
  assert.equal(b.getPlayer('arkpedia').dp, 94); assert.equal(b.mvpStageTokens.get(token.unitId), 2);
  assert.equal(device.deploymentSlotCost, 0); assert.match(b.tokenPlacementError(token.unitId, 5, 2), /recharging/);
  advance(1.1); assert.equal(pillar.mem.stageUnitDevice.state, 'intact'); advance(.1);
  assert.equal(device.alive, false); assert.equal(pillar.mem.stageUnitDevice.state, 'collapsing');
  advance(1.6); assert.equal(pillar.alive, false); assert.equal(second.mem.stageUnitDevice.state, 'collapsing');
  advance(1.6); assert.equal(second.alive, false);
  assert.deepEqual(b.errors, []);
});

test('a demolition blast hits ground bodies and pushes in its chosen direction without hitting flyers', () => {
  const { b, advance, enemy } = setup();
  const ground = enemy(5, 3), air = enemy(5, 3); air.motion = 'FLY'; air.def.motion = 'FLY';
  const device = b.deployToken(token.unitId, 5, 4, 'LEFT');
  advance(1.2); assert.equal(ground.hp, 18000); assert.ok(ground.x < 3);
  assert.equal(air.hp, 20000); assert.equal(device.alive, false);
  advance(2); assert.equal(ground.hp, 18000); assert.deepEqual(b.errors, []);
});

test('retreat cancels demolition and rubble can be destroyed by a blocked enemy attack', () => {
  const { b, advance, enemy, pillar } = setup();
  const device = b.deployToken(token.unitId, 6, 2, 'RIGHT');
  b.retreatStageToken(device.mem.stageSupplyId); const dp = b.getPlayer('arkpedia').dp;
  advance(2); assert.equal(pillar.mem.stageUnitDevice.state, 'intact'); assert.ok(b.getPlayer('arkpedia').dp >= dp);
  const ruin = b.stageDemolition.spawnRuins(5, 3), e = enemy(5, 3);
  e.x = 3.5; // Inside this native obstacle's sqrt(.3) radius, outside the generic sqrt(.2) device radius.
  e.profile.noAttack = false;
  assert.equal(b._checkBlock(e), true); assert.equal(e.blockedBy, ruin);
  advance(2); assert.equal(ruin.alive, false); assert.equal(b.grid.isObstacle(5, 3), false);
  assert.deepEqual(b.errors, []);
});

test('collapse force-kills allies, spares existing obstacle bodies and skips non-buildable rubble tiles', () => {
  const { b, advance, pillar } = setup();
  const source = b.spawnDevice('demolition-source', 6, 2, { hp: 100 }); source.tags.add('dupilr');
  const ally = b.spawnDevice('ally', 6, 4, { hp: 100 });
  b.addBuff(ally, { key: 'protected', flags: { invulnerable: true, undeadable: true } });
  const ruin = b.stageDemolition.spawnRuins(6, 5);
  b.grid.setTile(6, 4, { ...b.grid.tile(6, 4), build: 'NONE' });
  hit(b, source, pillar); advance(1.6);
  assert.equal(ally.alive, false); assert.equal(ruin.alive, true);
  assert.equal(b.grid.isObstacle(6, 4), false); assert.equal(b.allyUnits.filter(u => u.mem.battlefieldRuins).length, 1);
  assert.deepEqual(b.errors, []);
});
