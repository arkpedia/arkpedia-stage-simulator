// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import { REGULAR_ENEMIES, REGULAR_ENEMY_SPAWNS, assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { buildEnemySupport } from '../tools/arkpedia/enemy-support.mjs';
import { spawnAny } from './helpers/enemyHarness.js';

test('enemy support is derived from the committed catalogue and native timing index', async () => {
  assert.deepEqual(await buildEnemySupport(), support);
});
test('the regular registry is exactly the supported enemies, and keeps both 0-1 enemies', () => {
  const supported = Object.entries(support.enemies).filter(([, e]) => e.policy);
  assert.deepEqual(REGULAR_ENEMIES, Object.fromEntries(supported.map(([id, e]) => [id, e.policy])));
  assert.equal(support.summary.supported, supported.length);
  for (const id of ['enemy_1007_slime', 'enemy_1002_nsabr']) assert.equal(REGULAR_ENEMIES[id], 'basic-stats-and-attacks');
  assert.equal(REGULAR_ENEMIES.enemy_1026_aghost, 'stats-attacks-and-features', 'admitted through an approved feature');
  assert.equal(REGULAR_ENEMIES.enemy_1334_ristar, undefined, 'an enemy with unimplemented features is refused');
});
test('a supported enemy uses nothing unimplemented; an unsupported one names what is missing', () => {
  for (const [id, e] of Object.entries(support.enemies)) {
    if (e.policy) { assert.deepEqual(e.reasons, [], id); for (const n of Object.values(e.native)) assert.deepEqual([n.enemyAbilityWrappers, n.activeGeneralOrCommonAbilities], [0, 0], id); }
    else assert.ok(e.reasons.length > 0, id);
  }
});
test('every supported enemy fights to a death or a leak against a guard on the harness stage', () => {
  for (const id of Object.keys(REGULAR_ENEMIES)) {
    const h = spawnAny(id, { seconds: 0 }), e = () => h.b.units.find(u => u.side === 'enemy' && u.defId === id);
    h.runUntil(() => !e()?.alive, 240);
    assert.deepEqual(h.b.errors ?? [], [], id);
    assert.equal(e()?.alive ?? false, false, `${id} ends (killed or leaked) within 240 s`);
  }
});
test('a stage must ship the records of every enemy its enemies can spawn', () => {
  const [parent, [child]] = Object.entries(REGULAR_ENEMY_SPAWNS)[0];
  const stage = { ...mvp, enemies: { ...mvp.enemies, [parent]: {} }, stage: { ...mvp.stage, geometry: { ...mvp.stage.geometry, waves: [{ spawns: [] }] } } };
  assert.throws(() => assertRegularEnemies(stage), new RegExp(`spawns: ${child}`));
  assert.doesNotThrow(() => assertRegularEnemies({ ...stage, enemies: { ...stage.enemies, [child]: {} } }));
});
