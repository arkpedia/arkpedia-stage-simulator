// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import { REGULAR_ENEMIES, REGULAR_ENEMY_SPAWNS, assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { buildEnemySupport, verifiedNative } from '../tools/arkpedia/enemy-support.mjs';
import nativeEvidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clockIndex from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { spawnAny } from './helpers/enemyHarness.js';

test('enemy support is derived from the committed catalogue and native timing index', async () => {
  assert.deepEqual(await buildEnemySupport(), support);
});
test('retained native ability components must hash to the timing index entries they name', () => {
  const sha = nativeEvidence.source.sha256, pin = mvp.behaviors.source, ok = verifiedNative(nativeEvidence, clockIndex.prefabs, sha, pin);
  assert.ok(Object.values(ok.prefabs).flat().length > 0);
  const [path, [first]] = Object.entries(nativeEvidence.prefabs)[0];
  const tampered = { ...nativeEvidence, prefabs: { [path]: [{ ...first, originalJson: first.originalJson.replace('"maxStackCnt":-1', '"maxStackCnt":5') }] } };
  assert.throws(() => verifiedNative(tampered, clockIndex.prefabs, sha, pin), /does not match the timing index/);
  const [rpath, rows] = Object.entries(nativeEvidence.prefabs).find(([, v]) => v.some(c => c.referenced)), ref = rows.find(c => c.referenced);
  const refTampered = { ...nativeEvidence, prefabs: { [rpath]: [{ ...ref, originalJson: ref.originalJson.replace('"targetSide":1', '"targetSide":2') }] } };
  assert.throws(() => verifiedNative(refTampered, clockIndex.prefabs, sha, pin), /does not match the timing index/);
  assert.throws(() => verifiedNative(nativeEvidence, clockIndex.prefabs, '0'.repeat(64), pin), /another timing index/);
  assert.throws(() => verifiedNative(nativeEvidence, clockIndex.prefabs, sha, { ...pin, sha256: '0'.repeat(64) }), /another template source/);
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
    if (e.policy) { assert.deepEqual(e.reasons, [], id); for (const n of Object.values(e.native)) {
      assert.equal(n.enemyAbilityWrappers - (n.claimedWrappers ?? 0), 0, `${id} wrappers`);
      assert.equal(n.activeGeneralOrCommonAbilities - (n.claimedActive ?? 0), 0, `${id} active abilities`);
    } }
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
