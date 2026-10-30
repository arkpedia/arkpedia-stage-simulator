// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCanonicalEnemyTables } from '../tools/arkpedia/canonical-data.mjs';
import { generateCanonicalEnemyRecords } from '../tools/arkpedia/canonical-enemy-records.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const lockFor = (bytes, extra = {}) => ({ schemaVersion: 1, repository: 'arkpedia/arkpedia-data', commit: 'a'.repeat(40),
  files: { enemy_database: { path: 'source/data/simulator/raw/enemy_database.json', bytes: bytes.length, sha256: sha(bytes) }, ...extra } });
const okFetch = bytes => async () => ({ ok: true, status: 200, arrayBuffer: async () => bytes });

test('the canonical loader verifies bytes and writes an atomic cache', async () => {
  const bytes = Buffer.from('{"enemy_1":[]}\n');
  const cacheDir = await mkdtemp(join(tmpdir(), 'canonical-'));
  const loaded = await loadCanonicalEnemyTables({ lock: lockFor(bytes), cacheDir, fetchImpl: okFetch(bytes) });
  assert.equal(loaded.commit, 'a'.repeat(40));
  assert.deepEqual(loaded.files.enemy_database.bytes, bytes);
});

test('hash corruption and missing snapshots are rejected', async () => {
  const bytes = Buffer.from('{"enemy_1":[]}\n');
  const cacheDir = await mkdtemp(join(tmpdir(), 'canonical-'));
  await assert.rejects(() => loadCanonicalEnemyTables({ lock: lockFor(bytes), cacheDir, fetchImpl: okFetch(Buffer.from('corrupt')) }), /checksum mismatch/);
  await assert.rejects(() => loadCanonicalEnemyTables({ lock: lockFor(bytes), cacheDir, fetchImpl: async () => ({ ok: false, status: 404 }) }), /HTTP 404/);
});

// arkpedia-data's importer publishes the raw tables nightly (source/data/simulator/raw/), and the
// lock pins one of its main commits; re-pinning moves the commit, so only its shape is held here.
test('the committed lock pins an arkpedia-data commit and the raw tables by bytes and hash', async () => {
  const lock = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(new URL('../data/arkpedia-canonical.lock.json', import.meta.url), 'utf8')));
  assert.equal(lock.repository, 'arkpedia/arkpedia-data');
  assert.match(lock.commit, /^[a-f0-9]{40}$/);
  assert.deepEqual(Object.keys(lock.files).sort(), ['enemy_database', 'enemy_handbook_table']);
  for (const file of Object.values(lock.files)) {
    assert.match(file.path, /^source\/data\/simulator\/raw\/[a-z_]+\.json$/);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.ok(file.bytes > 0);
  }
  assert.equal(lock.upstream.repository, 'ArknightsAssets/ArknightsGamedata');
  assert.match(lock.upstream.commit, /^[a-f0-9]{40}$/);
});

test('canonical bytes compile into candidate enemy records', async () => {
  const db = Buffer.from(JSON.stringify({ enemy_1: [{ level: 0, enemyData: { name: 'One', attributes: { maxHp: { m_defined: true, m_value: 10 }, atk: { m_defined: true, m_value: 1 }, def: { m_defined: true, m_value: 0 }, magicResistance: { m_defined: true, m_value: 0 }, moveSpeed: { m_defined: true, m_value: 1 }, attackSpeed: { m_defined: true, m_value: 100 }, baseAttackTime: { m_defined: true, m_value: 1 }, blockCnt: { m_defined: true, m_value: 1 }, massLevel: { m_defined: true, m_value: 1 }, lifePointReduce: { m_defined: true, m_value: 0 } }, skills: [], talentBlackboard: {}, talents: [] } }], enemy_3010_mcreep: [{ level: 0, enemyData: { name: 'Civilian', attributes: { maxHp: { m_defined: true, m_value: 1 }, atk: { m_defined: true, m_value: 0 }, def: { m_defined: true, m_value: 0 }, magicResistance: { m_defined: true, m_value: 0 }, moveSpeed: { m_defined: true, m_value: 1 }, attackSpeed: { m_defined: true, m_value: 100 }, baseAttackTime: { m_defined: true, m_value: 1 }, blockCnt: { m_defined: true, m_value: 1 }, massLevel: { m_defined: true, m_value: 0 }, lifePointReduce: { m_defined: true, m_value: 0 } }, skills: [], talentBlackboard: {}, talents: [] } }] }));
  const hb = Buffer.from(JSON.stringify({ enemyData: { enemy_1: { abilityList: [] }, enemy_3010_mcreep: { abilityList: [] } } }));
  const lock = { schemaVersion: 1, repository: 'arkpedia/arkpedia-data', commit: 'b'.repeat(40), upstream: { repository: 'ArknightsAssets/ArknightsGamedata', commit: 'c'.repeat(40) }, files: {
    enemy_database: { path: 'source/data/simulator/raw/enemy_database.json', bytes: db.length, sha256: sha(db) },
    enemy_handbook_table: { path: 'source/data/simulator/raw/enemy_handbook_table.json', bytes: hb.length, sha256: sha(hb) },
  } };
  const cacheDir = await mkdtemp(join(tmpdir(), 'canonical-'));
  const outDir = await mkdtemp(join(tmpdir(), 'candidate-'));
  const fetchImpl = async url => ({ ok: true, status: 200, arrayBuffer: async () => url.includes('enemy_database') ? db : hb });
  const result = await generateCanonicalEnemyRecords({ lock, fetchImpl, cacheDir, outDir });
  assert.ok(result.records.enemies.enemy_3010_mcreep);
  assert.equal(result.records.canonicalData.commit, 'b'.repeat(40));
  assert.equal(result.records.upstream.commit, 'c'.repeat(40));
});
