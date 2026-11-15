// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import { compileStageEnemyAlias, prepareStageEnemyAliases } from '../tools/arkpedia/stage-enemy-aliases.mjs';
import { assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import { enemyModelKey, regularModelKey } from '../shared/arkpedia/facing.js';
import { normalizeEnemy } from '../server/sim/simdata.js';
const id = 'enemy_1000_gopro_x', base = 'enemy_1000_gopro';
const field = value => ({ m_defined: true, m_value: value });
function reference(hp = 800) {
  return { useDb: false, id, level: 0, overwrittenData: {
    prefabKey: field(base), name: field('Weak Hound'), applyWay: field('MELEE'), motion: field('WALK'),
    attributes: { maxHp: field(hp), atk: field(160), magicResistance: field(20), moveSpeed: field(1.9),
      attackSpeed: field(100), baseAttackTime: field(1.4) }, lifePointReduce: field(1),
    skills: null, talentBlackboard: null, spData: null,
  } };
}
function runtime(record) { return { enemies: { [id]: record }, stage: { enemyAliases: { [id]: base },
  geometry: { waves: [{ spawns: [{ enemy_id: id }] }] } } }; }

test('stage-local stats are complete independent definitions sharing the original prefab and asset', () => {
  const before = structuredClone(records.enemies[base]);
  const a = compileStageEnemyAlias(reference(), records, support).record;
  const b = compileStageEnemyAlias(reference(900), records, support).record;
  assert.equal(a.stats.maxHp, 800); assert.equal(b.stats.maxHp, 900);
  assert.equal(a.stats.atk, 160); assert.equal(a.stats.res, 20);
  assert.equal(a.stats.moveSpeed, 1.9); assert.equal(a.stats.bat, 1.4);
  assert.equal(a.stats.blockCnt, 1); assert.equal(a.stats.def, 0);
  assert.deepEqual(records.enemies[base], before); assert.equal(records.enemies[id], undefined);
  assert.doesNotThrow(() => assertRegularEnemies(runtime(a)));
  const model = enemyModelKey(base, before.levels[0]);
  assert.equal(enemyModelKey(id, a), model);
  assert.equal(regularModelKey({ side: 'enemy', defId: id, def: normalizeEnemy(id, a) }), model);
});

test('an alias cannot smuggle skills, talents, another prefab or unsupported behavior into a stage', () => {
  for (const mutate of [
    r => r.overwrittenData.skills = [{ prefabKey: 'unknown' }],
    r => r.overwrittenData.talentBlackboard = [{ key: 'unknown', value: 1 }],
    r => r.overwrittenData.prefabKey = field('enemy_missing'),
    r => r.overwrittenData.applyWay = field('RANGED'),
    r => r.overwrittenData.motion = field('FLY'),
    r => r.overwrittenData.attributes.blockCnt = field(3),
    r => r.overwrittenData.spData = { maxSp: 1 },
    r => r.overwrittenData.viewRadius = field(5),
    r => r.useDb = true,
    r => r.overwrittenData.unknownMechanic = field(1),
    r => r.overwrittenData.attributes.baseForceLevel = field(2),
  ]) {
    const ref = reference(); mutate(ref);
    assert.throws(() => compileStageEnemyAlias(ref, records, support));
  }
  const record = compileStageEnemyAlias(reference(), records, support).record;
  const missing = runtime(record); delete missing.stage.enemyAliases;
  assert.throws(() => assertRegularEnemies(missing), /Unsupported regular-stage enemy/);
  for (const mutate of [r => r.skills.push({ prefabKey: 'unknown' }), r => r.assetPrefabKey = 'enemy_missing',
    r => r.prefabKey = 'enemy_missing', r => r.talents.bb.unknown = 1, r => r.stats.maxHp = NaN]) {
    const data = runtime(structuredClone(record)); mutate(data.enemies[id]);
    assert.throws(() => assertRegularEnemies(data), /Unsupported stage-local enemy alias/);
  }
});

test('alias compilation preserves the reviewed prefab damage type', () => {
  const source = structuredClone(records), local = source.enemies[base].levels[0];
  local.stats.dmgType = 'arts'; local.stats.dmgTypes = ['arts'];
  const record = compileStageEnemyAlias(reference(), source, support).record;
  assert.equal(record.stats.dmgType, 'arts'); assert.deepEqual(record.stats.dmgTypes, ['arts']);
});

test('original source hashes gate aliases and partial viewer overrides never replace original stats', async t => {
  const root = await mkdtemp(join(tmpdir(), 'stage-alias-')); t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from(JSON.stringify({ enemyDbRefs: [reference()] }));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const dir = join(root, '.cache/arkpedia/original-level-blobs'); await mkdir(dir, { recursive: true });
  const path = join(dir, `${gitBlob}.json`); await writeFile(path, bytes);
  const args = { root, records, support, rules: { source: { sha256, gitBlob } }, geometry: {
    enemyConfigurations: [{ enemy_id: id, source: 'stage-local enemy; useDb false', overrides: { blockVolume: 0, maxHp: 9999 } }],
  } };
  const result = await prepareStageEnemyAliases(args);
  assert.deepEqual(result.failures, []); assert.deepEqual(result.aliases, { [id]: base });
  assert.equal(result.records[id].levels[0].stats.maxHp, 800); assert.equal(result.records[id].levels[0].stats.blockCnt, 1);
  assert.equal(result.sources[0].sha256, sha256);
  await writeFile(path, JSON.stringify({ enemyDbRefs: [reference(1)] }));
  assert.match((await prepareStageEnemyAliases(args)).failures[0].message, /checksum mismatch/);
  await rm(path);
  assert.match((await prepareStageEnemyAliases(args)).failures[0].message, /restore it with content:rules/);
});
