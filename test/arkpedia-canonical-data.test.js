// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCanonicalEnemyTables } from '../tools/arkpedia/canonical-data.mjs';

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

test('the committed lock pins the preview data commit and byte hashes', async () => {
  const lock = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(new URL('../data/arkpedia-canonical.lock.json', import.meta.url), 'utf8')));
  assert.equal(lock.repository, 'arkpedia/arkpedia-data');
  assert.equal(lock.commit, '79e81a8a872b2ecc592647d81a864ccbf1f8ca06');
  for (const file of Object.values(lock.files)) { assert.match(file.sha256, /^[a-f0-9]{64}$/); assert.ok(file.bytes > 0); }
});
