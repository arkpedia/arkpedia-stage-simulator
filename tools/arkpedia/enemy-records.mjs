// SPDX-License-Identifier: GPL-3.0-or-later
// Compile every Global enemy at every database level into
// data/arkpedia-enemy-records.json (shared/arkpedia/enemy-records.js).
// Inputs are the pinned enemy_database and enemy_handbook_table in
// .cache/arkpedia (fetched by build-mvp.mjs --refresh, pinned by pins.json).
//   node tools/arkpedia/enemy-records.mjs          # write
//   node tools/arkpedia/enemy-records.mjs --check  # regenerate and compare
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compileEnemy, indexEnemyDatabase, enemyLevelRuleDivergences, enemyFeatures } from '../../shared/arkpedia/enemy-records.js';

const root = new URL('../../', import.meta.url), cache = new URL('.cache/arkpedia/', root);
const OUT = new URL('data/arkpedia-enemy-records.json', root);
const REPO = 'Kengxxiao/ArknightsGameData_YoStar';
const PATHS = { enemy_database: 'en_US/gamedata/levels/enemydata/enemy_database.json', enemy_handbook_table: 'en_US/gamedata/excel/enemy_handbook_table.json' };
const sha = b => createHash('sha256').update(b).digest('hex');

export async function buildEnemyRecords() {
  const pins = JSON.parse(await readFile(new URL('pins.json', cache), 'utf8'));
  const raw = Object.fromEntries(await Promise.all(Object.keys(PATHS).map(async k => [k, await readFile(new URL(`${k}.json`, cache))])));
  const index = indexEnemyDatabase(JSON.parse(raw.enemy_database));
  const handbook = JSON.parse(raw.enemy_handbook_table).enemyData ?? {};
  const enemies = {};
  for (const key of [...index.keys()].sort()) {
    const rows = index.get(key), levels = {};
    for (const level of [...new Set(rows.map(r => r.level))].sort((a, b) => a - b))
      levels[level] = compileEnemy({ key, rows, handbook: handbook[key] ?? null, level });
    enemies[key] = { handbook: !!handbook[key], levels, features: enemyFeatures(levels[0]) };
  }
  return {
    schemaVersion: 1,
    scope: 'Compiled Global enemy records for every enemy at every database level. Stats, motion, attack mode, damage type, immunities, talents and skills only; behaviour support is decided separately by the feature registry.',
    source: { repository: REPO, commit: pins[REPO],
      files: Object.fromEntries(Object.entries(PATHS).map(([k, path]) => [k, { path, bytes: raw[k].length, sha256: sha(raw[k]) }])) },
    levelRule: 'level 0 merged with the selected level',
    levelRuleDivergences: enemyLevelRuleDivergences(index),
    summary: { enemies: Object.keys(enemies).length, records: Object.values(enemies).reduce((n, e) => n + Object.keys(e.levels).length, 0),
      withoutHandbook: Object.values(enemies).filter(e => !e.handbook).length },
    enemies,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = JSON.stringify(await buildEnemyRecords()) + '\n';
  if (process.argv.includes('--check')) {
    const old = await readFile(OUT, 'utf8');
    if (old !== text) { console.error('data/arkpedia-enemy-records.json differs from the pinned sources'); process.exit(1); }
    console.log('Enemy records match the pinned sources');
  } else { await writeFile(OUT, text); console.log(`Wrote ${text.length} bytes`); }
}
