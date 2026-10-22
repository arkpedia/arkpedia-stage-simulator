// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { pulseTiles, STAGE_DEVICES } from '../shared/arkpedia/stage-devices.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import stage from '../data/arkpedia-stage-7-8.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
const data = { ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } };

test('the Originium Altar pulse covers its own cross and the reviewed damage', () => {
  assert.deepEqual(pulseTiles(3, 1), [[3, 1], [2, 1], [4, 1], [3, 0], [3, 2]]);
  assert.equal(STAGE_DEVICES['Originium Altar'].pulse.damage, 500);
  assert.equal(STAGE_DEVICES['Originium Altar'].pulse.spCost, 7);
});

test('an altar pulses both sides on its own SP clock', () => {
  const battle = new StandardBattle(data, { operators: Object.values(data.operators).slice(0, 5).map(defaultBuild) });
  const e = battle.spawnEnemy('enemy_1077_sotihd', { pos: [3, 1] });
  const before = e.hp;
  battle._tickMvpStageDevices(7.01);
  assert.ok(e.hp <= before - 500 + 1e-6);
});
