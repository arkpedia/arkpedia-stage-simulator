// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import stage from '../data/arkpedia-stage-9-14_challenge_mode.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const data = { ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } };

test('the first lethal pillar hit leaves it at 1 HP and invulnerable', () => {
  const battle = new StandardBattle(data, { operators: Object.values(data.operators).slice(0, 5).map(defaultBuild) });
  const pillar = battle.enemies.find(e => e.mem?.stageUnitDevice?.pillar);
  assert.ok(pillar);
  const source = { side: 'ally', tileR: pillar.tileR, tileC: pillar.tileC, alive: true };
  battle.emit('damaged', { source, target: pillar, dmg: { amount: 99999 } });
  assert.equal(pillar.hp, 1);
  assert.equal(pillar.mem.stageUnitDevice.state, 'damaged');
  assert.ok(pillar.findBuff('pillar:damaged'));
});

test('collapsing a pillar damages and stuns enemies in its two tiles', () => {
  const battle = new StandardBattle(data, { operators: Object.values(data.operators).slice(0, 5).map(defaultBuild) });
  const pillar = battle.enemies.find(e => e.mem?.stageUnitDevice?.pillar);
  const d = pillar.mem.stageUnitDevice;
  d.lastSource = { r: d.row - 1, c: d.col };
  const enemy = battle.spawnEnemy('enemy_1077_sotihd', { pos: [d.row + 1, d.col] });
  battle._collapsePillar(pillar, d);
  assert.ok(enemy.hp < enemy.s.maxHp);
  assert.ok(enemy.hp < enemy.s.maxHp);
});
