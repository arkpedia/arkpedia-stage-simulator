// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { verifiedNative } from '../tools/arkpedia/enemy-support.mjs';
import { deriveEnemySupport, prefabPath } from '../shared/arkpedia/enemy-support.js';

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url)));
const candidate = { ...read('candidates/arkpedia-ch16-native-abilities.json'), actions: read('candidates/arkpedia-ch16-action-source.json') };
const indexBytes = readFileSync(new URL('../data/arkpedia-enemy-clock-source.json', import.meta.url));
const index = JSON.parse(indexBytes);
const indexSha = createHash('sha256').update(indexBytes).digest('hex');
const templates = read('arkpedia-mvp.json').behaviors.source;
const keys = ['enemy_3010_mcreep', 'enemy_10203_mumag', 'enemy_10211_murad',
  'enemy_10206_muveg', 'enemy_10208_mucow', 'enemy_10210_muwiz'];

test('chapter 16 candidate retains every indexed component of the six existing prefabs', () => {
  verifiedNative(candidate, index.prefabs, indexSha, templates);
  assert.deepEqual(Object.keys(candidate.prefabs).sort(), keys.map(prefabPath).sort());
  for (const key of keys) {
    const path = prefabPath(key), rows = candidate.prefabs[path];
    assert.equal(new Set(rows.map(row => row.pathId)).size, rows.length, `${key}: duplicate path IDs`);
    assert.deepEqual(rows.filter(row => !row.referenced).map(row => row.pathId).sort(),
      index.prefabs[path].clockComponents.map(row => row.pathId).sort(), key);
  }
});

test('candidate original component corruption fails the existing evidence verifier', () => {
  const changed = structuredClone(candidate);
  changed.prefabs[prefabPath(keys[0])].find(row => !row.referenced).originalJson += ' ';
  assert.throws(() => verifiedNative(changed, index.prefabs, indexSha, templates), /does not match the timing index/);
});

test('all six base prefabs require complete records and reviewed native contracts', () => {
  const records = read('candidates/arkpedia-enemy-records.canonical.json');
  const support = deriveEnemySupport(Object.fromEntries(keys.map(key => [key, records.enemies[key]])),
    index.prefabs, candidate);
  for (const key of keys) {
    assert.equal(support[key].policy, 'stats-attacks-and-features', key);
    assert.deepEqual(support[key].reasons, [], key);
  }
});

test('miner support requires its retained native healing clock and passive reference', () => {
  const records = read('candidates/arkpedia-enemy-records.canonical.json');
  for (const change of [
    c => { c._buffs[0].triggerInterval = 0.5; },
    c => { c._buffs[0].templateKey = 'unreviewed_heal'; },
  ]) {
    const changed = structuredClone(candidate), row = changed.prefabs[prefabPath(keys[0])].find(c => c.objectName === 'GetHeal' && !c.referenced);
    const component = JSON.parse(row.originalJson); change(component); row.originalJson = JSON.stringify(component);
    const support = deriveEnemySupport({ [keys[0]]: records.enemies[keys[0]] }, index.prefabs, changed);
    assert.equal(support[keys[0]].policy, null);
  }
});


test('miner support refuses a changed native profession validator', () => {
  const records = read('candidates/arkpedia-enemy-records.canonical.json'), changed = structuredClone(candidate);
  const rows = changed.prefabs[prefabPath(keys[0])];
  const heal = JSON.parse(rows.find(c => c.objectName === 'GetHeal' && !c.referenced).originalJson);
  const validator = rows.find(c => c.pathId === heal._targetValidator.m_PathID);
  const value = JSON.parse(validator.originalJson); value._targetOptions.professionMask = 16;
  validator.originalJson = JSON.stringify(value);
  assert.equal(deriveEnemySupport({ [keys[0]]: records.enemies[keys[0]] }, index.prefabs, changed)[keys[0]].policy, null);
});
