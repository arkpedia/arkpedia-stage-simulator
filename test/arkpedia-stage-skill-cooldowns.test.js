// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import { applyStageEnemySkillCooldown } from '../shared/arkpedia/stage-enemy-talents.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
const key = 'enemy_1502_crowns', original = records.enemies[key].levels[0];

test('1-8 Challenge preserves native Blink records and applies the original .35 skill-clock multiplier', async () => {
  const c = await loadContentContext(), p = await planStage(c, '1-8_challenge_mode');
  assert.deepEqual(p.blockers, []);
  const r = p.stage.enemies[key]; assert.equal(r.stageSkillCooldownScale, .35);
  assert.equal(r.skills[0].cooldown, 15); assert.equal(r.skills[0].initCooldown, 15);
  assert.equal(original.stageSkillCooldownScale, undefined);
  assert.equal(r.stats.maxHp, original.stats.maxHp * 1.5);
  assert.throws(() => applyStageEnemySkillCooldown(records.enemies.enemy_1104_lfkght.levels[0], .35), /Unsupported enemy skill/);
  assert.throws(() => applyStageEnemySkillCooldown(original, 0), /Invalid/);
});

test('Crownslayer uses the scaled initial and repeat clocks without modifying attack interval', () => {
  const rec = applyStageEnemySkillCooldown(original, .35), guard = chessRec({ id: 'cooldown-guard', stats: { maxHp: 1e7, atk: 0, def: 1000 } });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 40,
    defs: { enemies: { [key]: rec }, chess: { [guard.chessId]: guard } }, units: [{ chessId: guard.chessId, row: 9, col: 6 }],
    enemies: [{ key, time: 0, route: 0 }], setup: installEnemyFeatures });
  h.step(1); const b = h.b, e = b.enemies[0], interval = e.s.interval;
  const block = () => { e.x = 5.8; e.y = 9; e.tileR = 9; e.tileC = 6; assert.ok(b._checkBlock(e)); };
  block(); h.run(5.1); assert.equal(h.eventsOf('fx').filter(x => x[1] === 'blink').length, 0);
  assert.ok(h.runUntil(() => h.eventsOf('fx').some(x => x[1] === 'blink'), .2));
  const first = b.time; assert.ok(first >= 5.25 && first < 5.35); assert.equal(e.s.interval, interval);
  h.run(1.1); block(); h.run(3.9); assert.equal(h.eventsOf('fx').filter(x => x[1] === 'blink').length, 1);
  assert.ok(h.runUntil(() => h.eventsOf('fx').filter(x => x[1] === 'blink').length === 2, .4));
  assert.ok(b.time - first >= 5.2 && b.time - first <= 5.3); assert.deepEqual(b.errors, []);
});
