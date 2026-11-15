// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileEnemyTables, appendEnemySupplement, fetchEnemyTables } from '../tools/arkpedia/enemy-records.mjs';

function fixture(channel, entries) {
  const language = channel === 'cn' ? 'zh_CN' : 'en_US';
  const raw = { enemy_database: Buffer.from(JSON.stringify({ enemies: entries.map(([Key, atk]) => ({ Key,
    Value: [{ level: 0, enemyData: { attributes: { atk: { m_defined: true, m_value: atk } } } }] })) })),
    enemy_handbook_table: Buffer.from(JSON.stringify({ enemyData: {} })) };
  const source = { repository: channel === 'cn' ? 'Kengxxiao/ArknightsGameData' : 'Kengxxiao/ArknightsGameData_YoStar', commit: 'a'.repeat(40),
    files: Object.fromEntries(Object.entries(raw).map(([key, bytes]) => [key, {
      path: `${language}/gamedata/${key === 'enemy_database' ? 'levels/enemydata' : 'excel'}/${key}.json`, bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      gitBlob: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
    }])) };
  return { raw, source, compiled: compileEnemyTables(raw, source) };
}

test('CN supplementation adds only absent IDs and preserves the full primary record', () => {
  const global = fixture('global', [['enemy_existing', 100]]), cn = fixture('cn', [['enemy_existing', 999], ['enemy_new', 200]]);
  const before = structuredClone(global.compiled), result = appendEnemySupplement(global.compiled, cn.compiled, 'cn');
  assert.deepEqual(result.enemies.enemy_existing, before.enemies.enemy_existing);
  assert.equal(result.enemies.enemy_new.levels[0].stats.atk, 200);
  assert.equal(result.enemies.enemy_new.sourceChannel, 'cn');
  assert.deepEqual(result.summary.sourceCounts, { global: 1, cn: 1 });
  assert.deepEqual(result.source.supplements[0].addedIds, ['enemy_new']);
  assert.deepEqual(global.compiled, before);
  assert.throws(() => appendEnemySupplement(result, cn.compiled, 'cn'), /duplicate/);
});

test('source downloads are checksum verified before caching and on reuse', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'enemy-source-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const cacheRoot = pathToFileURL(dir + '/'), input = fixture('global', [['enemy_fixture', 100]]);
  const lock = { schemaVersion: 1, primary: { channel: 'global', ...input.source }, supplements: [] };
  let calls = 0;
  const fetchImpl = async url => {
    calls++; const key = url.split('/').at(-1).slice(0, -5);
    return { ok: true, arrayBuffer: async () => input.raw[key] };
  };
  assert.equal((await fetchEnemyTables({ lock, cacheRoot, fetchImpl })).length, 2); assert.equal(calls, 2);
  await fetchEnemyTables({ lock, cacheRoot, fetchImpl }); assert.equal(calls, 2);
  await writeFile(join(dir, 'enemy_database.json'), '{}');
  await assert.rejects(fetchEnemyTables({ lock, cacheRoot, fetchImpl }), /checksum mismatch/);
  const raw = { ...input.raw, enemy_database: Buffer.from('{}') };
  assert.throws(() => compileEnemyTables(raw, input.source), /checksum mismatch/);
});
