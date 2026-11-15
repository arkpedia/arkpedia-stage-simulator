// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { StageReeds } from '../server/sim/content/arkpedia-stage-reeds.js';
import { readStageOutcomes } from '../server/sim/content/arkpedia-stage-outcomes.js';
import { compileReedTileRule } from '../shared/arkpedia/stage-reeds.js';
import { compileStageReeds, reedsNativeReviewed } from '../tools/arkpedia/stage-reeds.mjs';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { readOriginalLevel } from '../tools/arkpedia/original-level.mjs';
import { makeBattle, enemyRec, chessRec } from './helpers/battleHarness.js';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
const params = { ignite_duration: 1, extinct_duration: 2, cooldown_duration: .5, damage: 40, ep_damage: 40 };
const spec = { kind: 'reeds', scanInterval: .1, damageInterval: 1, entryStealth: .2,
  tiles: [[10, 3], [10, 4], [10, 5]].map(([row, col]) => ({ row, col, ...params })) };
function fixture({ occupied = true, reverse = false } = {}) {
  const guard = chessRec({ id: 'reeds_guard', stats: { maxHp: 10000, atk: 0, magicResistance: 0 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, units: occupied ? [{ chessId: guard.chessId, row: 10, col: 3 }] : [],
    defs: { chess: { [guard.chessId]: guard }, enemies: { enemy: enemyRec({ key: 'enemy', hp: 10000, speed: 0 }) } } });
  h.b.start(); const reeds = new StageReeds(h.b, { ...spec, tiles: reverse ? [...spec.tiles].reverse() : spec.tiles }); h.b.stageReeds = reeds;
  return { ...h, reeds, ally: h.b.allyUnits[0] };
}
test('Reeds gives temporary entry invisibility and camouflage only while not blocking, preserving other flag sources', () => {
  const h = fixture(), u = h.ally; h.step();
  assert.equal(u.s.flags.stealth, true); assert.equal(u.s.flags.camou, true);
  h.run(.3); assert.equal(!!u.s.flags.stealth, false); assert.equal(u.s.flags.camou, true);
  const e = h.b.spawnEnemy('enemy', { pos: [10, 3] }); e.blockedBy = u; u.blocking = [e]; h.run(.15);
  assert.equal(!!u.s.flags.camou, false); e.x = 8; h.b._unblock(e); h.run(.15); assert.equal(u.s.flags.camou, true);
  h.b.addBuff(u, { key: 'independent', flags: { camou: true } });
  u.x = 8; u.tileC = 8; h.run(.15); assert.equal(u.findBuff('stage:reeds:camouflage'), null); assert.equal(u.s.flags.camou, true);
  h.b.removeBuff(u, 'independent'); assert.equal(!!u.s.flags.camou, false); assert.deepEqual(h.b.errors, []);
});
test('burning Reeds damages only allies on one-second clocks and occupied tiles extinguish without spreading', () => {
  const h = fixture(), u = h.ally; h.step(); const hp = u.hp;
  const enemy = h.b.spawnEnemy('enemy', { pos: [10, 3] }), enemyHp = enemy.hp;
  assert.equal(h.reeds.ignite(10, 3), true); assert.equal(h.reeds.ignite(10, 3), false);
  h.run(.8); assert.equal(u.hp, hp); assert.equal(!!u.s.flags.camou, false);
  h.run(.3); assert.equal(u.hp, hp - 40); assert.equal(u.elem.burn, 40); assert.equal(enemy.hp, enemyHp);
  assert.equal(h.reeds.at(10, 4).mode, 0);
  h.run(1); assert.equal(h.reeds.at(10, 3).mode, 2); assert.equal(h.reeds.ignite(10, 3), false);
  h.run(.5); assert.equal(h.reeds.at(10, 3).mode, 0); assert.equal(h.reeds.ignite(10, 3), true);
  assert.deepEqual(h.b.errors, []);
});
test('fire spreads one adjacent step per interval independent of source tile insertion order', () => {
  for (const reverse of [false, true]) {
    const h = fixture({ occupied: false, reverse }); h.reeds.ignite(10, 3); h.run(1.1);
    assert.deepEqual([3, 4, 5].map(c => h.reeds.at(10, c).mode), [1, 1, 0]);
    h.run(1.1); assert.deepEqual([3, 4, 5].map(c => h.reeds.at(10, c).mode), [1, 1, 1]);
    const report = readStageOutcomes(h.b); assert.equal(report.tileStates.length, 3);
    report.tileStates[0].value = 99; assert.ok(readStageOutcomes(h.b).tileStates.every(t => t.value === 1));
  }
});
test('changing occupancy starts the new spread/extinguish timer and dead units stop holding fire', () => {
  const h = fixture(); h.reeds.ignite(10, 3); h.run(1.2); h.b.kill(h.ally); h.run(.8);
  assert.equal(h.reeds.at(10, 4).mode, 0); h.run(.3); assert.equal(h.reeds.at(10, 4).mode, 1);
  assert.equal(h.reeds.contacts.has(h.ally), false); assert.deepEqual(h.b.errors, []);
});
test('Reeds source and rule gates reject extra effects, duplicate keys, unknown tiles and changed damage timing', () => {
  assert.equal(reedsNativeReviewed(), true);
  const n = structuredClone(native); n.templates['buff_reed_flaming[ally]'].eventToActions.ON_BUFF_TRIGGER[0]._isEnvDamage = false;
  assert.equal(reedsNativeReviewed(n), false);
  const rune = { professionMask: 1023, buildableMask: 'ALL', blackboard: [{ key: 'tile', value: 0, valueStr: 'tile_reed|tile_reedw|tile_reedf' },
    ...Object.entries(params).map(([key, value]) => ({ key, value, valueStr: null }))] };
  assert.equal(compileReedTileRule(rune).tile_reed.damage, 40);
  for (const change of [r => r.blackboard.push({ key: 'damage', value: 1 }), r => r.blackboard[0].valueStr = 'tile_road',
    r => r.blackboard[1].value = 0, r => r.blackboard.push({ key: 'unexpected', value: 2 })]) {
    const r = structuredClone(rune); change(r); assert.throws(() => compileReedTileRule(r), /Reeds/);
  }
});
test('FC stages load both terrain programs and original rules when their shared enemy features are supported', async () => {
  const c = await loadContentContext(), plan = await planStage(c, 'fc-1', { waves: true }); assert.deepEqual(plan.blockers, []);
  assert.equal(plan.stage.reeds.tiles.length, 13); assert.ok(plan.stage.mire.tiles.length);
  assert.equal(plan.stage.reeds.tiles[0].ignite_duration, 15); assert.equal(plan.stage.reeds.tiles[0].extinct_duration, 20);
  const { receipt } = await loadStageRuleReceipt(c.root, 'fc-1'), { level } = await readOriginalLevel(c.root, receipt);
  const changed = structuredClone(level); changed.mapData.tiles.find(t => t.tileKey === 'tile_reed').effects = ['unknown'];
  assert.throws(() => compileStageReeds(changed, plan.stage.geometry, plan.stage.rules), /Reeds tile effects/);
  for (const id of ['fc-2', 'fc-ex-1']) { const plan = await planStage(c, id, { waves: true }); assert.deepEqual(plan.blockers, [], id); }
});

test('original burning tiles and challenge ignition locations share the same Reeds state machine', async () => {
  const { readFile } = await import('node:fs/promises');
  const { compileStageRules } = await import('../shared/arkpedia/stage-rules.js');
  const c = await loadContentContext();
  for (const id of ['fc-ex-2', 'fc-tr-2', 'fc-ex-4_challenge_mode', 'fc-ex-8_challenge_mode']) {
    const source = JSON.parse(await readFile(`${c.source}/stages/${id}.json`));
    const geometry = JSON.parse(await readFile(`${c.source}/stage-geometry/${id.replace('_challenge_mode', '')}.json`));
    const { receipt } = await loadStageRuleReceipt(c.root, id), { level } = await readOriginalLevel(c.root, receipt);
    const rules = compileStageRules(source, receipt), program = compileStageReeds(level, geometry, rules);
    assert.ok(program.tiles.some(t => t.initialMode === 1), id);
    if (id === 'fc-ex-4_challenge_mode') assert.equal(program.tiles.find(t => t.row === 1 && t.col === 10).initialMode, 1);
    if (id === 'fc-ex-8_challenge_mode') for (const cell of rules.reedIgnitions)
      assert.equal(program.tiles.find(t => t.row === cell.row && t.col === cell.col).initialMode, 1);
    const bad = structuredClone(level); bad.mapData.tiles.find(t => t.tileKey.startsWith('tile_reed')).blackboard = [{ key: 'mode', value: 3 }];
    assert.throws(() => compileStageReeds(bad, geometry, rules), /initial Reeds mode/);
    assert.throws(() => compileStageReeds(level, geometry, { ...rules, reedIgnitions: [{ row: 999, col: 999, mode: 1 }] }), /ignition target/);
  }
  const h = makeBattle({ content: 'none', autoFinish: false }); h.b.start();
  const reeds = new StageReeds(h.b, { kind: 'reeds', scanInterval: .1, damageInterval: 1, entryStealth: .2,
    tiles: [{ row: 10, col: 3, ...params, initialMode: 1 }, { row: 10, col: 4, ...params }] });
  assert.equal(reeds.at(10, 3).mode, 1); h.run(1.1); assert.equal(reeds.at(10, 4).mode, 1);
});
