// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import { REGULAR_ENEMIES, REGULAR_ENEMY_SPAWNS, assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { buildEnemySupport, verifiedNative, assertPreservedEnemySupport } from '../tools/arkpedia/enemy-support.mjs';
import nativeEvidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clockIndex from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { spawnAny } from './helpers/enemyHarness.js';

test('enemy additions refuse lost registrations even when new records hide a net coverage increase',()=>{
  const previous={enemies:{colossus:{policy:'basic'},formation:{policy:'features'},pending:{policy:null}}};
  const next={enemies:{colossus:{policy:'features'},formation:{policy:null},newA:{policy:'features'},newB:{policy:'basic'}}};
  assert.throws(()=>assertPreservedEnemySupport(previous,next),/remove 1 registered records: formation/);
  delete next.enemies.formation;
  assert.throws(()=>assertPreservedEnemySupport(previous,next),/formation/);
  next.enemies.formation={policy:'features'};
  assert.doesNotThrow(()=>assertPreservedEnemySupport(previous,next));
});

test('enemy support is derived from the committed catalogue and native timing index', async () => {
  assert.deepEqual(await buildEnemySupport(), support);
});
test('retained native ability components must hash to the timing index entries they name', () => {
  const sha = nativeEvidence.source.sha256, pin = mvp.behaviors.source, ok = verifiedNative(nativeEvidence, clockIndex.prefabs, sha, pin);
  assert.ok(Object.values(ok.prefabs).flat().length > 0);
  const [path, rows0] = Object.entries(nativeEvidence.prefabs).find(([, rows]) => rows.some(c => c.originalJson.includes('"maxStackCnt":-1')));
  const first = rows0.find(c => c.originalJson.includes('"maxStackCnt":-1'));
  const tampered = { ...nativeEvidence, prefabs: { [path]: [{ ...first, originalJson: first.originalJson.replace('"maxStackCnt":-1', '"maxStackCnt":5') }] } };
  assert.throws(() => verifiedNative(tampered, clockIndex.prefabs, sha, pin), /does not match the timing index/);
  const [rpath, rows] = Object.entries(nativeEvidence.prefabs).find(([, v]) => v.some(c => c.referenced && c.originalJson.includes('"targetSide":1'))), ref = rows.find(c => c.referenced && c.originalJson.includes('"targetSide":1'));
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
test('every supported enemy actually spawns and runs its registered features without runtime errors', () => {
  for (const id of Object.keys(REGULAR_ENEMIES)) {
    const h = spawnAny(id, { seconds: 0 }), e = () => h.b.units.find(u => u.kind === 'enemy' && u.defId === id);
    h.step(); assert.ok(e(), `${id} actually spawns before checking completion`);
    h.runUntil(() => !e().alive || h.b.finished, 240);
    assert.deepEqual(h.b.errors ?? [], [], id);
    if (e().profile.holdsBattle === false) { assert.equal(e().counted, false, id); assert.equal(h.b.reason, 'cleared', id); }
    else assert.ok(!e().alive || h.b.time >= 240 || h.b.finished, `${id} ran the combat window or resolved`);
  }
});
test('a stage must ship the records of every enemy its enemies can spawn', () => {
  const [parent, [child]] = Object.entries(REGULAR_ENEMY_SPAWNS)[0];
  const stage = { ...mvp, enemies: { ...mvp.enemies, [parent]: {} }, stage: { ...mvp.stage, geometry: { ...mvp.stage.geometry, waves: [{ spawns: [] }] } } };
  assert.throws(() => assertRegularEnemies(stage), new RegExp(`spawns: ${child}`));
  assert.doesNotThrow(() => assertRegularEnemies({ ...stage, enemies: { ...stage.enemies, [child]: {} } }));
});
