// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 15: the PRTS control system (shared/arkpedia/stage-prts-control.js), accepted only where it has nothing to do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import environments from '../data/arkpedia-environment-native-source.json' with { type: 'json' };
import { prtsControlNativeReviewed, compilePrtsControlRule, prtsControlInert, PRTS_CONTROL_SYSTEM, PRTS_INTRUSIVE_CALL,
  PRTS_DRAG_TILE } from '../shared/arkpedia/stage-prts-control.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const clone = v => JSON.parse(JSON.stringify(v));

test('the control system is reviewed; another actor, drag tile or device pair is refused', () => {
  assert.equal(prtsControlNativeReviewed(), true);
  const config = e => e.envSystems[PRTS_CONTROL_SYSTEM].find(r => '_prtsEnemyKey' in r.data).data;
  const a = clone(environments); config(a)._prtsEnemyKey = 'enemy_10073_mpcar';
  assert.equal(prtsControlNativeReviewed(a), false);
  const b = clone(environments); config(b)._prtsEnemyDragTileKey = 'tile_road';
  assert.equal(prtsControlNativeReviewed(b), false);
  const c = clone(environments); config(c)._enemyTrapKeyPairs.pop();
  assert.equal(prtsControlNativeReviewed(c), false);
  const rune = bb => ({ key: 'env_system_new', blackboard: bb });
  assert.equal(compilePrtsControlRule(rune([{ key: 'key', value: 0, valueStr: PRTS_CONTROL_SYSTEM }])), true);
  assert.throws(() => compilePrtsControlRule(rune([{ key: 'key', value: 0, valueStr: PRTS_CONTROL_SYSTEM }, { key: 'x', value: 1 }])), /Unsupported PRTS control rule/);
});

test('a level is inert only without the Intrusive Call and without a drag tile', () => {
  const level = { enemyDbRefs: [{ id: 'enemy_10073_mpcar' }], waves: [], mapData: { tiles: [{ tileKey: 'tile_road' }] } };
  assert.equal(prtsControlInert(level), true);
  assert.equal(prtsControlInert({ ...level, enemyDbRefs: [{ id: PRTS_INTRUSIVE_CALL }] }), false);
  assert.equal(prtsControlInert({ ...level, waves: [{ fragments: [{ actions: [{ key: PRTS_INTRUSIVE_CALL }] }] }] }), false);
  assert.equal(prtsControlInert({ ...level, mapData: { tiles: [{ tileKey: PRTS_DRAG_TILE }] } }), false);
});

test('15-4 compiles with the system and runs its 30 enemies; 15-5, which has the Intrusive Call, stays blocked', async () => {
  const entry = manifest.stages.find(s => s.id === '15-4');
  assert.equal(entry.availability, 'available');
  assert.equal(manifest.stages.find(s => s.id === '15-5').availability, 'blocked');
  const stage = await loader.load(entry);
  assert.equal(stage.rules.prtsControl, true);
  assert.equal(Object.hasOwn(stage.enemies, PRTS_INTRUSIVE_CALL), false);
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
  b.life = 999;
  let spawned = 0; b.on('enemySpawn', () => spawned++);
  while (!b.finished && b.time < 400) b.step();
  assert.equal(b.reason, 'cleared');
  assert.deepEqual([spawned, b.total, (b.errors ?? []).length], [30, 30, 0]);
});
