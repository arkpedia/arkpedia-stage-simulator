// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import native from '../data/arkpedia-water-source.json' with { type: 'json' };
import { StageWater } from '../server/sim/content/arkpedia-stage-water.js';
import { compileStageWater, waterNativeReviewed } from '../tools/arkpedia/stage-water.mjs';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { readOriginalLevel } from '../tools/arkpedia/original-level.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { makeBattle, enemyRec } from './helpers/battleHarness.js';

const spec = { kind: 'permanent-deep-water', tiles: [[10, 3], [10, 4]], damage: 40, aspd: -60, moveMul: .6,
  scanInterval: .2, damageInterval: 1 };
function fixture() {
  const h = makeBattle({ content: 'none', autoFinish: false,
    defs: { enemies: { enemy: enemyRec({ key: 'enemy', hp: 10000, speed: 1 }) } } });
  h.b.start(); const water = new StageWater(h.b, spec);
  const spawn = () => {
    const e = h.b.spawnEnemy('enemy', { pos: [10, 3] });
    h.b.addBuff(e, { key: 'test:hold', flags: { noMove: true, disarm: true } }); return e;
  };
  return { ...h, water, spawn };
}

test('deep water has independent immediate-entry and one-second damage clocks, and releases movement effects on exit', () => {
  const h = fixture(), a = h.spawn(), baseSpeed = a.s.moveSpeed;
  h.step(); assert.equal(a.hp, 9960); assert.ok(Math.abs(a.s.moveSpeed - baseSpeed * .6) < 1e-9);
  h.run(.4); const b = h.spawn(); h.run(.2); assert.equal(b.hp, 9960); assert.equal(a.hp, 9960);
  h.run(.45); assert.equal(a.hp, 9920); assert.equal(b.hp, 9960);
  a.x = 5; h.run(.2); assert.equal(a.findBuff('stage:water'), null); assert.equal(a.findBuff('buff_sea'), null);
  assert.equal(a.s.moveSpeed, baseSpeed);
  const hp = a.hp; h.run(1); assert.equal(a.hp, hp);
  a.x = 3; h.run(.2); assert.equal(a.hp, hp - 40, 're-entry starts a new periodic buff');
  assert.deepEqual(h.b.errors, []);
});

test('deep water ignores flyers, stops at floating platforms and cleans up dead recipients', () => {
  const h = fixture(), e = h.spawn(); e.motion = 'FLY'; h.run(.3);
  assert.equal(e.hp, 10000); assert.equal(e.findBuff('stage:water'), null);
  e.motion = 'WALK'; h.run(.2); assert.equal(e.hp, 9960);
  h.b.platformTiles = new Set(['10,3']); h.run(.2);
  assert.equal(e.findBuff('stage:water'), null); assert.equal(h.water.contains(10, 3), false);
  h.b.platformTiles.clear(); h.run(.2); assert.equal(e.hp, 9920);
  h.b.kill(e); h.run(.2); assert.equal(h.water.contacts.size, 0); assert.deepEqual(h.b.errors, []);
});

test('native evidence gates water targeting, modifier formulas and damage semantics', () => {
  assert.equal(waterNativeReviewed(), true);
  for (const mutate of [n => n.prefabs.sktok_tidectrl_3.components.find(r => r.data._buffs?.[0]?.buffKey === 'sea_drown[enemy]').data._buffs[0].waitFirstTriggerInterval = 1,
    n => n.templates.periodic_damage_without_modify_no_fx.eventToActions.ON_BUFF_TRIGGER[0]._damageWithoutModify = false]) {
    const changed = structuredClone(native); mutate(changed); assert.equal(waterNativeReviewed(changed), false);
  }
});

test('real source compiles one reusable water program and keeps timed tides or unknown overrides blocked', async () => {
  const context = await loadContentContext(), plan = await planStage(context, 'dh-7', { waves: true });
  assert.deepEqual(plan.blockers, []); assert.equal(plan.stage.water.moveMul, .6);
  assert.ok(plan.localSources.some(s => s.path === 'data/arkpedia-water-source.json'));
  const { receipt } = await loadStageRuleReceipt(context.root, 'dh-7');
  const { level } = await readOriginalLevel(context.root, receipt);
  for (const change of [p => p.skillIndex = 0, p => p.hidden = true,
    p => p.overrideSkillBlackboard = [{ key: 'unknown', value: 1 }]]) {
    const changed = structuredClone(level); change(changed.predefines.tokenInsts.find(p => p.inst.characterKey === 'trap_042_tidectrl'));
    assert.throws(() => compileStageWater(changed, plan.stage.geometry, plan.stage.devices), /water|tide/i);
  }
  const id = 'char_123_fang', b = new StandardBattle({ ...context.mvp, stage: plan.stage,
    enemies: { ...context.mvp.enemies, ...plan.stage.enemies } }, { operators: [defaultBuild(context.mvp.operators[id])] });
  b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const [r, c] = plan.stage.water.tiles[0]; assert.match(b.placementError(id, r, c), /floating platform/);
  const platform = b.deployToken('trap_040_canoe', r, c);
  assert.ok(platform?.alive); assert.equal(b.placementError(id, r, c), null);
  const unit = b.deployOperator(id, r, c, 'RIGHT'); assert.ok(unit?.alive);
  assert.deepEqual(b.errors, []);
});
