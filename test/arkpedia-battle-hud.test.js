import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { battleHud } from '../shared/arkpedia/battle-hud.js';

function battle() {
  const b = new StandardBattle(data, { operators: [defaultBuild(data.operators.char_208_melan)] });
  b.setViewport('fullscreen-workspace');
  return b;
}

test('HUD follows combat DP regeneration, spending, refund and remaining deployment slots', () => {
  const b = battle();
  assert.equal(battleHud(b, true).slots, 8);
  for (let i = 0; i < 15; i++) b.step();
  const charging = battleHud(b, false);
  assert.equal(charging.dp, 10);
  assert.ok(Math.abs(charging.recoveryFraction - 0.5) < 1e-6);
  assert.equal(charging.recoveryText, '+1 DP/s');
  b.addDp("arkpedia", 10);
  const before = b.dp;
  b.deployOperator('char_208_melan', 2, 7, 'RIGHT');
  assert.equal(battleHud(b, true).slots, 7);
  assert.equal(battleHud(b, true).deployed, 1);
  assert.equal(battleHud(b, true).dp, Math.floor(before - b.bench.char_208_melan.lastCost));
  assert.ok(Math.abs(battleHud(b, true).recoveryFraction - charging.recoveryFraction) < 1e-6);
  b.retreatOperator('char_208_melan');
  assert.equal(battleHud(b, true).slots, 8);
  assert.equal(battleHud(b, true).deployed, 0);
  b.addDp('arkpedia', 999);
  assert.equal(battleHud(b, false).dp, 99);
  assert.equal(battleHud(b, false).recoveryFraction, 1);
  assert.equal(battleHud(b, false).recoveryText, 'MAX');
});

test('leaks count as resolved enemies and reduce life; paused readouts do not advance', () => {
  const b = battle();
  const before = battleHud(b, true);
  assert.equal(before.recoveryText, 'Paused');
  assert.deepEqual(battleHud(b, true), before);
  for (let i = 0; i < 90 / b.dt && !b.finished; i++) b.step();
  const after = battleHud(b, true);
  assert.equal(b.killed, 0);
  assert.ok(b.leakedCount > 0);
  assert.equal(after.enemies, `${b.leakedCount}/${b.total}`);
  assert.ok(after.life < before.life);
  assert.equal(after.recoveryText, 'Ended');
  assert.equal(after.slots, 8);
});

test('stages without passive DP recovery do not animate a recovery meter', () => {
  const b = battle();
  b.flags.dpPerSec = 0;
  b.addDp('arkpedia', 0.5);
  assert.equal(battleHud(b, false).recoveryFraction, 0);
  assert.equal(battleHud(b, false).recoveryText, 'No recovery');
});
