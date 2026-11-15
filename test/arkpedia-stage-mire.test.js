// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import { StageMire } from '../server/sim/content/arkpedia-stage-mire.js';
import { compileStageMire, mireNativeReviewed } from '../tools/arkpedia/stage-mire.mjs';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { readOriginalLevel } from '../tools/arkpedia/original-level.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { makeBattle, enemyRec, chessRec } from './helpers/battleHarness.js';
const spec = { kind: 'mire', tiles: [[10, 3], [10, 4]], scanInterval: .1, interval: 1, max: 10, aspdPer: -5, movePer: -.05, heavyWeight: 3 };
function fixture() {
  const guard = chessRec({ id: 'mire_guard', stats: { atk: 0 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, units: [{ chessId: guard.chessId, row: 10, col: 4 }],
    defs: { chess: { [guard.chessId]: guard }, enemies: { light: enemyRec({ key: 'light', mass: 1, speed: 1 }), heavy: enemyRec({ key: 'heavy', mass: 3, speed: 1 }) } } });
  h.b.start(); const mire = new StageMire(h.b, spec);
  const spawn = (id = 'light') => { const e = h.b.spawnEnemy(id, { pos: [10, 3] });
    h.b.addBuff(e, { key: 'test:hold', flags: { noMove: true, disarm: true } }); return e; };
  return { ...h, mire, spawn };
}
test('regular Mire shares immediate/periodic layers, weight threshold, cap and exit cleanup with the existing mode', () => {
  const h = fixture(), light = h.spawn(), heavy = h.spawn('heavy'), ally = h.b.allyUnits[0];
  h.run(.2); assert.equal(light.s.aspd, 95); assert.equal(heavy.s.aspd, 90); assert.equal(ally.s.aspd, 95);
  assert.equal(light.s.moveSpeed, .95); assert.equal(heavy.s.moveSpeed, .9); assert.equal(ally.findBuff('terrain:mire').mods.moveMul, undefined);
  h.run(1); assert.equal(light.s.aspd, 90); assert.equal(heavy.s.aspd, 80);
  h.run(10); assert.equal(light.s.aspd, 50); assert.equal(heavy.s.aspd, 50);
  light.x = 5; h.run(.2); assert.equal(light.findBuff('terrain:mire'), null); assert.equal(light.s.moveSpeed, 1);
  light.x = 3; h.run(.2); assert.equal(light.s.aspd, 95);
  assert.equal(h.b.stageOutcomes.counters.locate_on_tile_mire, 1, 'one contact, not one log per scan');
  assert.deepEqual(h.b.errors, []);
});
test('Mire skips airborne, hidden and target-free units, cleans dead recipients and honors immunity', () => {
  const h = fixture(), e = h.spawn(); e.motion = 'FLY'; h.run(.2); assert.equal(e.s.aspd, 100);
  e.motion = 'WALK'; h.run(.2); assert.equal(e.s.aspd, 95);
  h.b.addBuff(e, { key: 'immune', flags: { mireImmune: true } }); h.run(.2); assert.equal(e.s.aspd, 100);
  assert.equal(e.mem.mireContact, true, 'immunity preserves contact for Gloompincers');
  h.b.addBuff(e, { key: 'free', flags: { targetFree: true } }); h.run(.2); assert.equal(e.mem.mireContact, false);
  h.b.removeBuff(e, 'free'); h.run(.2); assert.equal(e.mem.mireContact, true);
  e.hidden = true; h.run(.2); assert.equal(e.mem.mireContact, false);
  e.hidden = false; h.run(.2); h.b.kill(e); h.run(.2); assert.equal(h.mire.contacts.has(e), false);
  assert.deepEqual(h.b.errors, []);
});
test('Mire native gate rejects targeting, timing and action graph drift', () => {
  assert.equal(mireNativeReviewed(), true);
  for (const mutate of [
    n => { n.prefabs.tile_mire.components[0].data._clearBuffsWhenLeft = 0; },
    n => { n.templates['buff_mire[trigger]'].eventToActions.ON_BUFF_TRIGGER[0]._forceTrigger = true; },
    n => { n.templates['buff_mire[mark]'].eventToActions.ON_BUFF_TRIGGER[0]._condType = 'GE'; },
  ]) { const n = structuredClone(native); mutate(n); assert.equal(mireNativeReviewed(n), false); }
});
test('FC-1 compiles its Mire controller and validates original overrides', async () => {
  const context = await loadContentContext(), plan = await planStage(context, 'fc-1', { waves: true });
  assert.deepEqual(plan.blockers, []);
  assert.ok(plan.blockers.every(b => b.id !== 'Mire controller' && b.kind !== 'device-instance'));
  const geometry = JSON.parse(await readFile(join(context.source, 'stage-geometry/fc-1.json'), 'utf8'));
  const devices = context.devices['fc-1'];
  assert.ok(plan.localSources.some(s => s.path === 'data/arkpedia-device-native-source.json'));
  const { receipt } = await loadStageRuleReceipt(context.root, 'fc-1'), { level } = await readOriginalLevel(context.root, receipt);
  for (const change of [p => { p.hidden = true; }, p => { p.skillIndex = 1; },
    p => { p.overrideSkillBlackboard.push({ key: 'unknown', value: 1 }); },
    p => { p.overrideSkillBlackboard.push({ key: 'attack_speed', value: -.1 }); }]) {
    const changed = structuredClone(level); change(changed.predefines.tokenInsts[0]);
    assert.throws(() => compileStageMire(changed, geometry, devices), /Mire/);
  }
  const changed = structuredClone(level); changed.predefines.tokenInsts[0].overrideSkillBlackboard.find(v => v.key === 'attack_speed').value = -.1;
  assert.equal(compileStageMire(changed, geometry, devices).aspdPer, -10);
  const mismatch = structuredClone(geometry); mismatch.tileLegend.find(t => t.key === 'tile_mire').key = 'tile_road';
  assert.throws(() => compileStageMire(level, mismatch, devices), /Mire tile export/);
  const id = 'char_123_fang', selection = { operators: [defaultBuild(context.mvp.operators[id])] };
  const probe = new StandardBattle(context.mvp, selection);
  probe.setViewport('fullscreen-workspace'); probe.addDp('arkpedia', 99);
  const positions = context.mvp.stage.geometry.tileGrid.flatMap((cells, r) => cells.map((_, c) => [r, c]));
  const [r, c] = positions.find(([r, c]) => !probe.placementError(id, r, c));
  const mire = { ...compileStageMire(level, geometry, devices), tiles: [[r, c]] };
  const b = new StandardBattle({ ...context.mvp, stage: { ...context.mvp.stage, mire } }, selection);
  b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const unit = b.deployOperator(id, r, c, 'RIGHT'); b.start(); for (let i = 0; i < 12; i++) b.step();
  assert.equal(unit.s.aspd, 95); assert.equal(b.stageOutcomes.counters.locate_on_tile_mire, 1); assert.deepEqual(b.errors, []);
});
