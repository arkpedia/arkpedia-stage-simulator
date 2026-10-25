// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { makeBattle } from './helpers/battleHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { installChapter17Devices } from '../server/sim/content/chapter17.js';
import { verifiedChapter16Devices } from '../tools/arkpedia/enemy-support.mjs';
const bytes = p => readFileSync(new URL('../data/' + p, import.meta.url));
const read = p => JSON.parse(bytes(p));
const proof = read('candidates/arkpedia-ch17-marker-source.json');
const review = read('candidates/arkpedia-ch17-reviewed-marker.json');
function fixture(overrides = {}) {
  const key = 'enemy_10211_murad', rec = read('candidates/arkpedia-enemy-records.canonical.json').enemies[key].levels[0];
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: installEnemyFeatures, defs: { enemies: { [key]: rec } } });
  h.b.start();
  const env = installChapter17Devices(h.b, [{ key: 'trap_329_rift', row: 1, col: 1, ...overrides }]);
  return { h, b: h.b, env, marker: env.rifts[0] };
}

test('a successful marker summon has the native one-second repeat guard even when immediately recharged', () => {
  const { h, marker } = fixture({ spCost: 1, initSp: 1 });
  h.run(.04); assert.equal(marker.cycle, 1);
  marker.gainSp(1); h.run(.4);
  assert.equal(marker.cycle, 1, 'a full SP bar does not bypass trap_rift_s_flag');
  h.run(.7); assert.equal(marker.cycle, 2);
});

test('complete marker, skill and table evidence reproduce the reviewed default SP contract', () => {
  for (const file of Object.values(review.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file.path, import.meta.url))).digest('hex'), file.sha256);
  verifiedChapter16Devices(bytes('candidates/arkpedia-ch17-marker-source.json'), bytes('arkpedia-cn-native-source.json'),
    bytes('arkpedia-cn-enemy-native-source.json'), read('arkpedia-enemy-clock-source.json').source);
  for (const row of [...Object.values(proof.prefabs).flat(), ...Object.values(proof.skillPrefabs).flat(), ...Object.values(proof.templates)])
    assert.equal(createHash('sha256').update(row.originalJson).digest('hex'), row.sha256);
  const skill = proof.skills.sktok_rift.levels[0];
  assert.deepEqual(skill.spData, { spType: 'INCREASE_WITH_TIME', levelUpCost: null, maxChargeTime: 1, spCost: 55, initSp: 0, increment: 1 });
  assert.equal(skill.skillType, 'AUTO');
  const token = Object.values(proof.prefabs)[0].map(r => JSON.parse(r.originalJson));
  assert.equal(token.find(n => n._filterTag?.includes('trap_rift'))._rewriteTileOptions, 0, 'inactive tile defaults cannot alter the native map');
  const nativeSkill = Object.values(proof.skillPrefabs)[0].map(r => JSON.parse(r.originalJson));
  assert.ok(nativeSkill.some(n => n._buffKeys?.includes('trap_rift_s_flag')));
  assert.equal(nativeSkill.find(n => '_canSilenced' in n)._canSilenced, 0);
});

test('default native SP summons only after 55 seconds and creates an uncounted harmless canonical source', () => {
  const { h, b, marker } = fixture();
  h.run(54.8); assert.equal(marker.cycle, 0);
  h.run(.3); assert.equal(marker.cycle, 1);
  const source = b.enemies.find(e => e.mem.ch16Leak);
  assert.ok(source); assert.equal(source.counted, false); assert.equal(source.holdsBattle, false);
  assert.equal(source.route.legs[0].t, 'wait'); assert.deepEqual(b.errors, []);
});

test('a full marker retains SP after unsuccessful selection and uses the next attempt after a tile opens', () => {
  const { h, env, marker } = fixture({ initSp: 55 });
  const select = env.summonTiles; env.summonTiles = () => [];
  h.run(2); assert.equal(marker.cycle, 0); assert.equal(marker.sp, 55);
  env.summonTiles = select; h.run(.04);
  assert.equal(marker.cycle, 1); assert.ok(marker.sp < 1);
});

test('marker evidence rejects a changed retained skill component before admission', () => {
  const changed = structuredClone(proof);
  Object.values(changed.skillPrefabs)[0][0].originalJson += ' ';
  assert.throws(() => verifiedChapter16Devices(Buffer.from(JSON.stringify(changed)), bytes('arkpedia-cn-native-source.json'),
    bytes('arkpedia-cn-enemy-native-source.json'), read('arkpedia-enemy-clock-source.json').source), /hash|checksum|sha256/i);
});
