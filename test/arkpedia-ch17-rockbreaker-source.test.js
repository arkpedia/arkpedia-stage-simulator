// SPDX-License-Identifier: GPL-3.0-or-later
// Retained source is not controller or stage admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { verifiedNative, verifiedChapter16FamilyGraph } from '../tools/arkpedia/enemy-support.mjs';
import { resolveStage } from '../shared/arkpedia/stages.js';
const bytes = p => readFileSync(new URL('../data/' + p, import.meta.url));
const read = p => JSON.parse(bytes(p));
const proof = read('candidates/arkpedia-ch17-rockbreaker-source.json');
const index = read('arkpedia-enemy-clock-source.json');
const actions = key => JSON.parse(JSON.parse(proof.templates[key].originalJson).eventToActions._items.find(e => e.key === 0).value.SerializedState);

test('both Rockbreaker graphs and all indexed components bind the existing native inventories', () => {
  verifiedChapter16FamilyGraph(bytes('candidates/arkpedia-ch17-rockbreaker-source.json'), bytes('arkpedia-cn-native-source.json'), bytes('arkpedia-cn-enemy-native-source.json'), index);
  verifiedNative(read('candidates/arkpedia-ch17-rockbreaker-native.json'), index.prefabs,
    createHash('sha256').update(bytes('arkpedia-enemy-clock-source.json')).digest('hex'), read('arkpedia-mvp.json').behaviors.source);
  assert.equal(Object.keys(proof.prefabs).length, 2); assert.equal(Object.keys(proof.templates).length, 3);
});

test('pollution forcibly triggers SummonSelf only without in-progress or completed split flags', () => {
  const a = actions('enemy_mudia_summon');
  assert.deepEqual(a.filter(x => x.$type.endsWith('+CheckContainsBuff')).map(x => x._buffKeys), [['enemy_mudia_summon_ing'], ['enemy_mudia_casted_flag']]);
  assert.equal(a.filter(x => x.$type.endsWith('+IfNot')).length, 2);
  const trigger = a.find(x => x.$type.endsWith('+TriggerEnemySkill'));
  assert.equal(trigger._skillName, 'SummonSelf'); assert.equal(trigger._interruptCurAbility, true);
  assert.equal(trigger._checkSkillReady, false); assert.equal(trigger._clearPalsyingBuffBeforeTrigger, true);
});

test('native split retains one hostile child on the remaining route and permanent flags on both bodies', () => {
  const a = actions('enemy_mudia_summon_self'), spawn = a[0];
  assert.ok(spawn.$type.endsWith('+SummonEnemiesFollowMyRoute'));
  assert.equal(spawn._summonCount, 1); assert.equal(spawn._delayTime, 0);
  assert.equal(spawn._managedByScheduler, true); assert.equal(spawn._dontBlockWave, true);
  assert.equal(spawn._unharmful, false); assert.equal(spawn._skipCheckPoint, false);
  assert.equal(spawn._randomOffsetBound, .5); assert.equal(spawn._stopSummonIfHostDead, true);
  assert.equal(spawn._buffToEnemy.buffKey, 'enemy_mudia_casted_flag');
  assert.equal(a[1]._buff.buffKey, 'enemy_mudia_casted_flag');
  assert.equal(a[1]._buff.lifeTimeType, 'INFINITY');
  assert.equal(a[1]._buff.isSilenceable, false);
});

test('stronger Rockbreaker explicitly overrides its child identity instead of spawning the base variant', () => {
  const rows = Object.entries(proof.prefabs).find(([key]) => key.endsWith('enemy_10204_mudia_2.prefab'))[1];
  const blackboards = rows.flatMap(row => JSON.parse(row.originalJson)._buffs ?? []).flatMap(buff => buff.blackboard ?? []);
  assert.ok(blackboards.some(bb => bb.key === 'enemy_key' && bb.valueStr === 'enemy_10204_mudia_2'));
});

test('candidate Rockbreaker review cannot promote public records or bypass 17-4 experimental mode', () => {
  for (const key of ['enemy_10204_mudia', 'enemy_10204_mudia_2']) assert.equal(read('arkpedia-enemy-support.json').enemies[key]?.policy ?? null, null);
  assert.throws(() => resolveStage(read('arkpedia-stages.json'), '17-4'), /test-only/);
  assert.equal(resolveStage(read('arkpedia-stages.json'), '17-4', { experimental: true }).testOnly, true);
});
