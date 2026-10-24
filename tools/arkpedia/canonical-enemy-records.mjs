// SPDX-License-Identifier: GPL-3.0-or-later
// Compile enemy records from the checksum-verified canonical arkpedia-data snapshot.
// Writes ONLY candidate files; the reviewed public catalogue is untouched.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileEnemy, indexEnemyDatabase, enemyLevelRuleDivergences, enemyFeatures } from '../../shared/arkpedia/enemy-records.js';
import { loadCanonicalEnemyTables } from './canonical-data.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');

export async function generateCanonicalEnemyRecords({ lock, fetchImpl, cacheDir, outDir }) {
  const loaded = await loadCanonicalEnemyTables({ lock, fetchImpl, cacheDir });
  const raw = loaded.files.enemy_database.bytes;
  const handbookRaw = loaded.files.enemy_handbook_table.bytes;
  const database = JSON.parse(raw);
  const handbook = JSON.parse(handbookRaw).enemyData ?? {};
  if (!database || Array.isArray(database) || typeof database !== 'object') throw new Error('Unexpected canonical enemy_database shape');
  const index = indexEnemyDatabase({ enemies: Object.entries(database).map(([Key, Value]) => ({ Key, Value })) });
  const enemies = {};
  for (const key of [...index.keys()].sort()) {
    const rows = index.get(key), levels = {};
    for (const level of [...new Set(rows.map(r => r.level))].sort((a, b) => a - b))
      levels[level] = compileEnemy({ key, rows, handbook: handbook[key] ?? null, level });
    enemies[key] = { handbook: !!handbook[key], levels, features: enemyFeatures(levels[0]) };
  }
  const records = {
    schemaVersion: 1,
    scope: 'Compiled enemy records from the checksum-verified arkpedia-data canonical snapshot; candidate only.',
    canonicalData: { repository: loaded.repository, commit: loaded.commit },
    upstream: loaded.upstream,
    source: {
      repository: loaded.repository,
      commit: loaded.commit,
      files: Object.fromEntries(Object.entries(loaded.files).map(([k, v]) => [k, { path: v.url, bytes: v.bytes.length, sha256: v.sha256 }])),
    },
    levelRule: 'level 0 merged with the selected level',
    levelRuleDivergences: enemyLevelRuleDivergences(index),
    summary: { enemies: Object.keys(enemies).length, records: Object.values(enemies).reduce((n, e) => n + Object.keys(e.levels).length, 0), withoutHandbook: Object.values(enemies).filter(e => !e.handbook).length },
    enemies,
  };
  await mkdir(outDir, { recursive: true });
  const out = join(outDir, 'arkpedia-enemy-records.canonical.json');
  const receipt = join(outDir, 'arkpedia-enemy-records.canonical.receipt.json');
  const text = JSON.stringify(records) + '\n';
  await writeFile(out, text);
  await writeFile(receipt, JSON.stringify({ canonicalData: records.canonicalData, upstream: records.upstream, output: { bytes: Buffer.byteLength(text), sha256: sha(Buffer.from(text)) } }, null, 2) + '\n');
  return { records, out, receipt };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await generateCanonicalEnemyRecords({
    cacheDir: new URL('../../.cache/arkpedia/canonical/', import.meta.url).pathname,
    outDir: new URL('../../data/candidates/', import.meta.url).pathname,
  });
  console.log(`Wrote ${result.out} (${result.records.summary.enemies} enemies, canonical ${result.records.canonicalData.commit.slice(0, 8)})`);
}
