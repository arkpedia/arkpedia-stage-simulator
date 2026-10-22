// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { pulseTiles, artilleryTiles, STAGE_DEVICES } from '../shared/arkpedia/stage-devices.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { readFileSync } from 'node:fs';
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

test('the Londinium artillery hits both sides in its reviewed shape', () => {
  const tiles = artilleryTiles(4, 4);
  assert.equal(tiles.length, 21);
  assert.ok(tiles.some(([r, c]) => r === 4 && c === 4));
  assert.ok(tiles.some(([r, c]) => r === 2 && c === 4));
  assert.ok(!tiles.some(([r, c]) => r === 2 && c === 2));
  const stage = JSON.parse(readFileSync(new URL('../data/arkpedia-stage-10-14.json', import.meta.url)));
  const data = { ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } };
  const battle = new StandardBattle(data, { operators: Object.values(data.operators).slice(0, 5).map(defaultBuild) });
  battle.setViewport('fullscreen-workspace');
  battle.addDp('arkpedia', 99);
  const op = Object.values(data.operators).find(o => ['CASTER', 'SNIPER'].includes(o.profession)) ?? Object.values(data.operators)[0];
  assert.ok(battle.deployOperator(op.id, 4, 4, 'RIGHT'));
  const ally = battle.allyUnits.find(u => u.defId === op.id && u.alive);
  const enemy = battle.spawnEnemy(Object.keys(stage.enemies)[0], { pos: [4, 5] });
  const allyHp = ally.hp, enemyHp = enemy.hp;
  battle.mvpStageDevices[0].sp = 119.9;
  battle._tickMvpStageDevices(0.2);
  assert.ok(ally.hp === 0 || allyHp - ally.hp >= 3000 - 1e-6);
  assert.ok(enemy.hp <= enemyHp - 3000 + 1e-6);
});

test('the EP14 controller drains pollution tiles', () => {
  const stage = JSON.parse(readFileSync(new URL('../data/arkpedia-stage-14-2.json', import.meta.url)));
  const data = { ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } };
  const battle = new StandardBattle(data, { operators: Object.values(data.operators).slice(0, 5).map(defaultBuild) });
  const enemy = battle.spawnEnemy(Object.keys(stage.enemies)[0], { pos: [2, 1] });
  const hp = enemy.hp;
  battle._tickMvpStageDevices(1.01);
  assert.ok(enemy.findBuff('device:pollution'));
  assert.ok(hp - enemy.hp >= 50 - 1e-6);
});
