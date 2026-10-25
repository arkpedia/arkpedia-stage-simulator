// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import stage from '../data/arkpedia-stage-16-2.json' with { type: 'json' };
import { chapter16Shadow, facilityShadow, FACILITY_SHADOW_RANGE } from '../server/sim/content/chapter16-shadow.js';

const evidence = JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-ch16-device-source.json', import.meta.url)));
const battle = () => {
  const isolatedStage = { ...stage, geometry: { ...stage.geometry, waves: [] } };
  const b = new StandardBattle({ ...structuredClone(mvp), stage: isolatedStage, enemies: structuredClone(stage.enemies) },
    { operators: [defaultBuild(Object.values(mvp.operators)[0])] });
  b.life = 1000;
  return b;
};

test('facility field range and start/finish semantics agree with retained native actions', () => {
  const key = ([r, c]) => `${r},${c}`;
  assert.deepEqual(FACILITY_SHADOW_RANGE.map(key).sort(), evidence.ranges['x-2'].grids.map(t => key([t.row, t.col])).sort());
  const template = JSON.parse(evidence.templates['fowstn_t[shadow_tile]'].originalJson);
  const actions = template.eventToActions._items.map(e => JSON.parse(e.value.SerializedState)[0]);
  assert.equal(actions[0]._toShadow, true);
  assert.equal(actions[1]._toShadow, false);
  assert.ok(actions.every(a => a._changeTileShadowState && !a._temporaryEscapeShadowState));
  const b = battle(), env = chapter16Shadow(b), owner = { alive: true, tileR: 3, tileC: 4 };
  const finish = facilityShadow(b, owner);
  assert.ok(env.isShadow(3, 4));
  assert.ok(env.isShadow(1, 5));
  assert.equal(env.isShadow(1, 6), false);
  finish();
  assert.equal(env.isShadow(3, 4), false);
});

test('overlapping fields survive one source death and escape suppresses all sources only until expiry', () => {
  const b = battle(), env = chapter16Shadow(b);
  const first = { alive: true, tileR: 3, tileC: 4 }, second = { alive: true, tileR: 3, tileC: 5 };
  facilityShadow(b, first); const finishOld = facilityShadow(b, second);
  env.suppressShadow(3, 4, 2);
  b.time = 1; env.suppressShadow(3, 4, 2);
  first.alive = false;
  b.time = 2.9; assert.equal(env.isShadow(3, 4), false);
  b.time = 3; assert.equal(env.isShadow(3, 4), true);
  second.alive = false; assert.equal(env.isShadow(3, 4), false);
  second.alive = true; second.deploySeq = 2;
  assert.equal(env.isShadow(3, 4), false, 'a reused unit object cannot restore its previous field');
  facilityShadow(b, second);
  finishOld();
  assert.equal(env.isShadow(3, 4), true);
  second.deployed = false;
  assert.equal(env.isShadow(3, 4), false, 'removal ends a live source field');
});

test('miner escape affects real shadow fields, stops on fear, and cannot wrap across map edges', () => {
  const b = battle(), env = chapter16Shadow(b);
  const owner = { alive: true, tileR: 3, tileC: 4 };
  facilityShadow(b, owner);
  const miner = b.spawnEnemy('enemy_3010_mcreep', { pos: [3, 4] });
  miner.route = { legs: [{ t: 'wait', time: 1e9 }], legIdx: 0 };
  for (let i = 0; i < Math.ceil(.4 / b.dt); i++) b.step();
  assert.equal(env.isShadow(3, 4), false);
  b.applyStatus(miner, 'fear', { duration: 5 });
  b.addBuff(miner, { key: 'test:hold', duration: 5, flags: { noMove: true } });
  const until = env.shadowSuppressedUntil.get(3 * b.grid.cols + 4);
  for (let i = 0; i < Math.ceil(1 / b.dt); i++) b.step();
  assert.equal(env.shadowSuppressedUntil.get(3 * b.grid.cols + 4), until);
  env.suppressShadow(2, -1, 100);
  assert.equal(env.shadowSuppressedUntil.has(1 * b.grid.cols + b.grid.cols - 1), false);
});
