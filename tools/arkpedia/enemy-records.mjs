// SPDX-License-Identifier: GPL-3.0-or-later
// Compile every pinned enemy at every database level into
// data/arkpedia-enemy-records.json (shared/arkpedia/enemy-records.js).
// Source priority and byte hashes are in arkpedia-enemy-record-sources.json.
// --fetch restores verified source tables; --preview reports without writing.
//   node tools/arkpedia/enemy-records.mjs          # write
//   node tools/arkpedia/enemy-records.mjs --check  # regenerate and compare
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { writeJSONAtomic } from './write-json.mjs';
import { compileEnemy, indexEnemyDatabase, enemyLevelRuleDivergences, enemyFeatures } from '../../shared/arkpedia/enemy-records.js';

const root = new URL('../../', import.meta.url), cache = new URL('.cache/arkpedia/', root);
const OUT = new URL('data/arkpedia-enemy-records.json', root);
const REPO = 'Kengxxiao/ArknightsGameData_YoStar';
const PATHS = { enemy_database: 'en_US/gamedata/levels/enemydata/enemy_database.json', enemy_handbook_table: 'en_US/gamedata/excel/enemy_handbook_table.json' };
const sha = b => createHash('sha256').update(b).digest('hex');
const checkFile = (bytes, pin) => !!pin && bytes.length === pin.bytes && sha(bytes) === pin.sha256
  && (!pin.gitBlob || createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') === pin.gitBlob);

export function compileEnemyTables(raw, source) {
  for (const [key, bytes] of Object.entries(raw)) {
    const pin = source.files[key];
    if (!checkFile(bytes, pin))
      throw Error(`Enemy source checksum mismatch: ${source.repository}/${key}`);
  }
  if (!raw.enemy_database || !raw.enemy_handbook_table || !/^[a-f0-9]{40}$/.test(source.commit)) throw Error('Incomplete pinned enemy tables');
  const database = JSON.parse(raw.enemy_database), index = indexEnemyDatabase(database);
  if (index.size !== database.enemies.length) throw Error('Duplicate enemy database identity');
  const handbook = JSON.parse(raw.enemy_handbook_table).enemyData ?? {};
  const enemies = {};
  for (const key of [...index.keys()].sort()) {
    const rows = index.get(key), levels = {};
    if (!/^enemy_[a-z0-9_]+$/i.test(key) || new Set(rows.map(r => r.level)).size !== rows.length)
      throw Error(`Invalid or duplicate enemy level identity: ${key}`);
    for (const level of [...new Set(rows.map(r => r.level))].sort((a, b) => a - b))
      levels[level] = compileEnemy({ key, rows, handbook: handbook[key] ?? null, level });
    enemies[key] = { handbook: !!handbook[key], levels, features: enemyFeatures(levels[0]) };
  }
  return {
    schemaVersion: 1,
    scope: 'Compiled Global enemy records for every enemy at every database level. Stats, motion, attack mode, damage type, immunities, talents and skills only; behaviour support is decided separately by the feature registry.',
    source,
    levelRule: 'level 0 merged with the selected level',
    levelRuleDivergences: enemyLevelRuleDivergences(index),
    summary: { enemies: Object.keys(enemies).length, records: Object.values(enemies).reduce((n, e) => n + Object.keys(e.levels).length, 0),
      withoutHandbook: Object.values(enemies).filter(e => !e.handbook).length },
    enemies,
  };
}

/** Priority is explicit. A supplement can add IDs, never change a Global
 * level, skill, translation or stat record through an incidental refresh. */
export function appendEnemySupplement(primary, supplement, channel) {
  if (channel !== 'cn' || primary.source.supplements?.some(s => s.channel === channel)) throw Error('Invalid or duplicate enemy source channel');
  const added = Object.keys(supplement.enemies).filter(id => !Object.hasOwn(primary.enemies, id)).sort();
  const enemies = { ...primary.enemies };
  for (const id of added) enemies[id] = { ...supplement.enemies[id], sourceChannel: channel };
  const addedSet = new Set(added);
  return { ...primary,
    scope: 'Global enemy records preserved at their original revision, supplemented with absent IDs from pinned CN tables. Every database level is retained. Data import is not behavior admission.',
    source: { ...primary.source, supplements: [...(primary.source.supplements ?? []),
      { channel, ...supplement.source, addedIds: added }] },
    levelRuleDivergences: [...primary.levelRuleDivergences, ...supplement.levelRuleDivergences.filter(row => addedSet.has(row.key))],
    summary: { enemies: Object.keys(enemies).length, records: Object.values(enemies).reduce((n, e) => n + Object.keys(e.levels).length, 0),
      withoutHandbook: Object.values(enemies).filter(e => !e.handbook).length,
      sourceCounts: { ...(primary.summary.sourceCounts ?? { global: Object.keys(primary.enemies).length }), [channel]: added.length } },
    enemies,
  };
}

export async function buildEnemyRecords() {
  const lock = JSON.parse(await readFile(new URL('data/arkpedia-enemy-record-sources.json', root)));
  if (lock.schemaVersion !== 1 || lock.primary?.channel !== 'global' || lock.primary.repository !== REPO)
    throw Error('Invalid enemy source manifest');
  const load = async ({ channel, ...source }, primary = false) => {
    if (!/^[a-f0-9]{40}$/.test(source.commit) || !['global', 'cn'].includes(channel)) throw Error('Invalid pinned enemy source');
    const dir = primary ? cache : new URL(`enemy-tables-${channel}-${source.commit}/`, cache);
    const raw = Object.fromEntries(await Promise.all(Object.keys(PATHS).map(async key => [key, await readFile(new URL(`${key}.json`, dir))])));
    return compileEnemyTables(raw, source);
  };
  let records = await load(lock.primary, true);
  for (const source of lock.supplements ?? []) records = appendEnemySupplement(records, await load(source), source.channel);
  return records;
}

export async function fetchEnemyTables({ lock, cacheRoot = cache, fetchImpl = fetch } = {}) {
  lock ??= JSON.parse(await readFile(new URL('data/arkpedia-enemy-record-sources.json', root)));
  if (lock.schemaVersion !== 1 || lock.primary?.channel !== 'global') throw Error('Invalid enemy source manifest');
  const sources = [lock.primary, ...(lock.supplements ?? [])];
  const results = await Promise.all(sources.flatMap((source, i) => Object.entries(source.files).map(async ([key, pin]) => {
    if (!['global', 'cn'].includes(source.channel) || !/^[a-f0-9]{40}$/.test(source.commit)
      || !['Kengxxiao/ArknightsGameData', REPO].includes(source.repository) || !Object.hasOwn(PATHS, key)
      || !/^(en_US|zh_CN)\/gamedata\/(excel|levels\/enemydata)\/[a-z_]+\.json$/.test(pin.path)) throw Error('Invalid pinned enemy file');
    const dir = i === 0 ? cacheRoot : new URL(`enemy-tables-${source.channel}-${source.commit}/`, cacheRoot);
    const target = new URL(`${key}.json`, dir);
    let bytes;
    try { bytes = await readFile(target); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const response = await fetchImpl(`https://raw.githubusercontent.com/${source.repository}/${source.commit}/${pin.path}`);
      if (!response.ok) throw Error(`Enemy source download failed: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (!checkFile(bytes, pin)) throw Error(`Enemy source checksum mismatch: ${source.channel}/${key}`);
      await mkdir(dir, { recursive: true });
      try { await writeFile(target, bytes, { flag: 'wx' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; bytes = await readFile(target); }
    }
    if (!checkFile(bytes, pin)) throw Error(`Enemy source checksum mismatch: ${source.channel}/${key}`);
    return { channel: source.channel, key, bytes: bytes.length };
  })));
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--fetch')) await fetchEnemyTables();
  const records = await buildEnemyRecords(), text = JSON.stringify(records) + '\n';
  if (process.argv.includes('--check')) {
    const old = await readFile(OUT, 'utf8');
    if (old !== text) { console.error('data/arkpedia-enemy-records.json differs from the pinned sources'); process.exit(1); }
    console.log('Enemy records match the pinned sources');
  } else if (process.argv.includes('--preview')) console.log(JSON.stringify({ summary: records.summary,
    sources: [records.source, ...(records.source.supplements ?? [])].map(s => ({ repository: s.repository, commit: s.commit, added: s.addedIds?.length })) }, null, 2));
  else { await writeJSONAtomic(OUT, records, { space: 0 }); console.log(`Wrote ${text.length} bytes`); }
}
