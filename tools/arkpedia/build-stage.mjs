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
import { STAGE_TOKEN_UNITS } from '../../shared/arkpedia/stage-devices.js';
import { mergePristineHiddenGroups } from '../../shared/arkpedia/stage-conditional.js';
import { syntheticRoutePath } from '../../shared/arkpedia/stage-path.js';
import { assertRegularEnemies } from '../../shared/arkpedia/enemies.js';

const args = Object.fromEntries(process.argv.slice(2).flatMap((arg, i, all) =>
  arg.startsWith('--') ? [[arg.slice(2), all[i + 1]]] : []));
for (const key of ['stage', 'geometry', 'out']) if (!args[key]) throw Error(`Missing --${key}`);
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const [source, geometry, playbackFile, mvp, records, support, tokenData] = await Promise.all([
  read(args.stage), read(args.geometry), args.playback ? read(args.playback) : { playbackPaths: {} }, read(new URL('../../data/arkpedia-mvp.json', import.meta.url)),
  read(new URL(args.candidate === 'ch16' ? '../../data/candidates/arkpedia-enemy-records.canonical.json' : '../../data/arkpedia-enemy-records.json', import.meta.url)),
  read(new URL(args.candidate === 'ch16' ? '../../data/candidates/arkpedia-ch16-enemy-support.json' : '../../data/arkpedia-enemy-support.json', import.meta.url)), read(new URL('../../data/arkpedia-deployable-tokens.json', import.meta.url)),
]);
if (args.candidate === 'ch16') {
  if (source.code !== '16-2') throw Error('Chapter 16 candidate admission is currently reviewed only for test-only 16-2');
  const raw = await readFile(new URL('../../data/candidates/arkpedia-enemy-records.canonical.json', import.meta.url));
  if (createHash('sha256').update(raw).digest('hex') !== support.source.records.sha256)
    throw Error('Candidate support was generated from another canonical snapshot');
}
const supportOperators = await read(new URL('../../data/arkpedia-support-operators.json', import.meta.url));
const conditionalPath = args.conditional ?? join(dirname(args.geometry), '..', 'stage-conditional', basename(args.geometry));
if (geometry.hasConditionalSpawns && existsSync(conditionalPath)) {
  mergePristineHiddenGroups(geometry, JSON.parse(await readFile(conditionalPath, 'utf8')));
}
const paths = playbackFile.playbackPaths ?? playbackFile.paths ?? {};
// The geometry route is a reviewed start/checkpoint/end chain. When the viewer export omits a route,
// synthesize the same chain so the stage can still be played; the original path is preferred.
const syntheticRoutes = [];
const usedRoutes = new Set(geometry.waves.flatMap(wave => (wave.spawns || []).map(spawn => spawn.route)));
for (const [index, route] of geometry.routes.entries()) {
  if (!route || paths[index] || route.placeholder || !usedRoutes.has(index)) continue;
  paths[index] = syntheticRoutePath(route);
  syntheticRoutes.push(index);
}
if (!Object.keys(paths).length) throw Error('Playback export has no paths and no route to synthesize');
const devicePath = join(dirname(args.stage), '..', 'stage-devices.json');
const baseSlug = source.slug.replace(/_(challenge_mode|six_star|adverse_environment)$/, '');
const devices = existsSync(devicePath) ? (JSON.parse(await readFile(devicePath, 'utf8'))[source.geometryKey ?? baseSlug] ?? []) : [];
const tokens = (geometry.suppliedUnits?.deployable_tokens ?? []).filter(t => t.count !== 0).map(t => {
  const spec = STAGE_TOKEN_UNITS[t.unit_id];
  if (!spec) throw Error(`Unsupported stage token: ${t.unit_id}`);
  const token = tokenData.tokens[t.unit_id];
  if (!token) throw Error(`No token stats for ${t.unit_id}`);
  const stats = token.phases[0].levels.at(-1);
  return { unitId: t.unit_id, name: token.name, count: t.count, cost: stats.cost, hp: stats.maxHp,
    block: stats.block, position: token.position, behavior: spec.behavior, obstacle: spec.obstacle };
});
const fixedCards = geometry.suppliedUnits?.fixed_squad ?? [];
const supportForStage = Object.fromEntries(fixedCards
  .filter(card => !mvp.operators[card.unit_id] && supportOperators.operators[card.unit_id])
  .map(card => [card.unit_id, supportOperators.operators[card.unit_id]]));
const stage = {
  ...(args.candidate === 'ch16' ? { testOnly: true, enemyCatalogue: 'canonical-ch16-candidate-v1', canonicalData: records.canonicalData, upstream: records.upstream } : {}),
  code: source.code,
  name: source.name,
  description: source.description,
  battle: source.battle,
  mapTags: [],
  mapTagSource: null,
  geometry,
  conditionalHandled: args.allowConditional === '1',
  devices,
  tokens,
  operators: Object.keys(supportForStage).length ? supportForStage : undefined,
  pathing: {
    schemaVersion: 1,
    syntheticRoutes,
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
for (const device of devices) if (device.key === 'trap_329_rift') addEnemy('enemy_10211_murad');
for (const spawn of adapter.spawns) addEnemy(spawn.enemyKey);
stage.enemies = Object.fromEntries([...enemyIds].map(id => [id, configured(id)]));
assertRegularEnemies({ ...mvp, enemies: stage.enemies, stage });
await writeFile(args.out, JSON.stringify(stage, null, 1) + '\n');
console.log(`Built ${stage.code}: ${stage.geometry.rows}x${stage.geometry.cols}, ${stage.geometry.waves.length} waves, ${adapter.spawns.length} spawns, ${enemyIds.size} enemies -> ${args.out}`);
