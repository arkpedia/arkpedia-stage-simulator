// SPDX-License-Identifier: GPL-3.0-or-later
// Build one file-backed stage from the public Arkpedia sources used by the
// simulator. It is the small counterpart of build-mvp.mjs: the global payload
// keeps operators/enemies/effects, and each stage stays in its own JSON file.
//
//   node tools/arkpedia/build-stage.mjs \
//     --stage ../arkpedia-data/source/data/stages/0-2.json \
//     --geometry ../arkpedia-data/source/data/stage-geometry/0-2.json \
//     --playback ../arkpedia-stage-overhaul/public/stage-detail/0-2.json \
//     --out data/arkpedia-stage-0-2.json
//
// A stage is refused unless its route export matches the geometry hash and its
// spawns only use supported enemy records. Original stage art and gates are
// optional: the renderer labels the simplified fallback when they are absent.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { stageAdapter } from '../../server/sim/arkpedia.js';
import { assertRegularEnemies } from '../../shared/arkpedia/enemies.js';

const args = Object.fromEntries(process.argv.slice(2).flatMap((arg, i, all) =>
  arg.startsWith('--') ? [[arg.slice(2), all[i + 1]]] : []));
for (const key of ['stage', 'geometry', 'playback', 'out']) if (!args[key]) throw Error(`Missing --${key}`);
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const [source, geometry, playbackFile, mvp, records, support] = await Promise.all([
  read(args.stage), read(args.geometry), read(args.playback), read(new URL('../../data/arkpedia-mvp.json', import.meta.url)),
  read(new URL('../../data/arkpedia-enemy-records.json', import.meta.url)),
  read(new URL('../../data/arkpedia-enemy-support.json', import.meta.url)),
]);
// A pristine `hidden_group` entry is hidden from the preview but still spawns. Entries with random packs,
// weights or branches are real conditions and keep the stage refused.
const conditionalPath = args.conditional ?? join(dirname(args.geometry), '..', 'stage-conditional', basename(args.geometry));
if (geometry.hasConditionalSpawns && existsSync(conditionalPath)) {
  const entries = JSON.parse(await readFile(conditionalPath, 'utf8'));
  const pristine = entries.length > 0 && entries.every(e => e.condition?.hidden_group && Object.keys(e.condition).length === 1 && !e.branch && e.source === 'wave');
  if (pristine) {
    for (const entry of entries) {
      const { condition, branch, wave, ...spawn } = entry;
      const target = geometry.waves[wave ?? 0] ?? geometry.waves[0];
      if (target) target.spawns.push(spawn);
    }
    geometry.hasConditionalSpawns = false;
    geometry.hiddenGroupsMerged = entries.length;
  }
}
const paths = playbackFile.playbackPaths ?? playbackFile.paths;
if (!paths || !Object.keys(paths).length) throw Error('Playback export has no paths');
const stage = {
  code: source.code,
  name: source.name,
  description: source.description,
  battle: source.battle,
  mapTags: [],
  mapTagSource: null,
  geometry,
  pathing: {
    schemaVersion: 1,
    producer: 'Arkpedia stage browser / buildPlaybackPaths',
    stage: source.code,
    geometryHash: createHash('sha256').update(JSON.stringify(geometry)).digest('hex'),
    moveScale: 0.65,
    paths,
  },
  art: null,
  gates: null,
  fixedSquad: null,
};
// The battle compiler and the supported-enemy gate are the same ones used by 0-1.
const adapter = stageAdapter(stage);
stage.fixedSquad = adapter.fixedSquad;
// The level file owns each enemy's database level and any attribute overrides
// (stage geometry `enemyConfigurations`); the catalogue is the source record.
const OVERRIDE = Object.freeze({ hp: 'maxHp', atk: 'atk', def: 'def', res: 'res', move_speed: 'moveSpeed',
  attack_interval: 'bat', attack_speed: 'aspd', weight: 'massLevel', range: 'rawRangeRadius', life_cost: 'lpr',
  taunt: 'tauntLevel', elemental_res: 'elementRes', elemental_damage_res: 'elementDmgRes' });
const configs = new Map((geometry.enemyConfigurations ?? []).map(config => [config.enemy_id, config]));
const configured = id => {
  const entry = records.enemies[id], config = configs.get(id), level = config?.database_level ?? 0;
  const base = entry?.levels[level];
  if (!base) throw Error(`Missing enemy record: ${id}@${level}`);
  if (!config?.overrides || !Object.keys(config.overrides).length) return base;
  const record = structuredClone(base), stats = record.stats;
  for (const [key, value] of Object.entries(config.overrides)) {
    if (!(key in OVERRIDE) || typeof value !== 'number') continue;
    const field = OVERRIDE[key];
    stats[field] = value;
    if (field === 'rawRangeRadius') stats.rangeRadius = record.applyWay === 'MELEE' ? 0 : Math.max(0, value);
  }
  return record;
};
const enemyIds = new Set();
const addEnemy = id => {
  if (enemyIds.has(id)) return;
  if (!records.enemies[id]) throw Error(`Missing enemy record: ${id}`);
  if (!support.enemies[id]?.policy) throw Error(`Unsupported regular-stage enemy: ${id} (${support.enemies[id]?.reasons.join(', ')})`);
  enemyIds.add(id);
  for (const child of support.enemies[id].spawns ?? []) addEnemy(child);
};
for (const spawn of adapter.spawns) addEnemy(spawn.enemyKey);
stage.enemies = Object.fromEntries([...enemyIds].map(id => [id, configured(id)]));
assertRegularEnemies({ ...mvp, enemies: stage.enemies, stage });
await writeFile(args.out, JSON.stringify(stage, null, 1) + '\n');
console.log(`Built ${stage.code}: ${stage.geometry.rows}x${stage.geometry.cols}, ${stage.geometry.waves.length} waves, ${adapter.spawns.length} spawns, ${enemyIds.size} enemies -> ${args.out}`);
