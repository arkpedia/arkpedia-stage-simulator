// SPDX-License-Identifier: GPL-3.0-or-later
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readOriginalLevel } from './original-level.mjs';
import { REED_TILE_KEYS, validateReedParameters } from '../../shared/arkpedia/stage-reeds.js';
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const digest = v => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
// Exact original tile flags, entry/exit buffs, mode order and game-end logging.
// Timer orchestration follows the documented terrain behavior; native C# bodies
// are not retained, so this is not a native frame-order certificate.
const REVIEWED = {
  "prefabs": {
    "tile_reed": "9c2843bc1df3267267cb74e3c9ff78b8fe8d85e568e724e00fbf38a5766f043d",
    "tile_reedf": "c58058de7ca8092de4c13d236d0b6ed0e89a1f49aa9529b543f3f7dce3b6ff9c",
    "tile_reedw": "93fc8316825e3b046e7edf6a7ac03dd64aa695e5e22fbe4b0c52c2df8b3a750a"
  },
  "templates": {
    "buff_reed_extinct": "fc1dc30fa11a355c9cfdeab8774ab5cc6ed24dc7438b1827b27efd8196bb99ac",
    "buff_reed_flaming": "3326d78cf9ee7b6cb3bcd4204d2ec61e7889e68e07c11a2a4818b8adfaa09fb0",
    "buff_reed_extinct[ally]": "a13ec92b839cbaa3ed9c763faa2ce8b9ac46c27b056ff9065484a529a5c1aebe",
    "buff_reed_flaming[ally]": "b5efe47b69dd987e62476e4f5bc1e8fdb17ea8f708b85eb8046ccf9e656e5cc6"
  }
};
export function reedsNativeReviewed(evidence = native) {
  return Object.keys(REVIEWED.prefabs).length === 3 && Object.keys(REVIEWED.templates).length === 4
    && JSON.stringify(tables.ranges['x-5']?.grids) === JSON.stringify([{ row: 1, col: 0 }, { row: 0, col: -1 },
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: -1, col: 0 }])
    && Object.entries(REVIEWED.prefabs).every(([k, hash]) => evidence.prefabs[k] && digest(evidence.prefabs[k].components.map(c => c.data)) === hash)
    && Object.entries(REVIEWED.templates).every(([k, hash]) => evidence.templates[k] && digest(evidence.templates[k]) === hash);
}
export function compileStageReeds(level, geometry, rules, evidence = native) {
  if (!geometry.tileLegend.some(t => REED_TILE_KEYS.includes(t.key))) {
    if (Object.keys(rules?.reedTileParameters ?? {}).length || rules?.reedIgnitions?.length) throw Error('Reeds rules have no matching terrain');
    return null;
  }
  if (!reedsNativeReviewed(evidence)) throw Error('Unreviewed Reeds source');
  const map = level.mapData, tiles = [];
  if (map?.map?.length !== geometry.rows || map.map.some(r => r.length !== geometry.cols)) throw Error('Reeds map dimensions differ');
  for (const [row, cells] of geometry.tileGrid.entries()) for (const [col, type] of cells.entries()) {
    const original = map.tiles[map.map[geometry.rows - 1 - row][col]], exported = geometry.tileLegend[type];
    if (REED_TILE_KEYS.includes(original.tileKey) !== REED_TILE_KEYS.includes(exported.key)) throw Error('Reeds tile export differs');
    if (!REED_TILE_KEYS.includes(original.tileKey)) continue;
    if (original.tileKey !== exported.key || original.effects?.length) throw Error('Unsupported Reeds tile effects');
    const bb = {};
    let initialMode = 0;
    for (const entry of original.blackboard ?? []) {
      if (Object.hasOwn(bb, entry.key) || entry.valueStr != null && entry.valueStr !== '') throw Error('Invalid Reeds tile blackboard');
      bb[entry.key] = entry.value;
    }
    if (Object.hasOwn(bb, 'mode')) {
      if (![0, 1].includes(bb.mode)) throw Error('Unsupported initial Reeds mode');
      initialMode = bb.mode; delete bb.mode;
    }
    Object.assign(bb, rules?.reedTileParameters?.[original.tileKey]); validateReedParameters(bb);
    tiles.push({ row, col, ...bb, ...(initialMode ? { initialMode } : {}) });
  }
  for (const cell of rules?.reedIgnitions ?? []) {
    const tile = tiles.find(t => t.row === cell.row && t.col === cell.col);
    // Reviewed additions ignite an unlit Reeds tile. Refuse ambiguous repeated
    // assignment/addition to an already burning tile or a different terrain.
    if (!tile || tile.initialMode || cell.mode !== 1) throw Error('Unsupported Reeds ignition target');
    tile.initialMode = 1;
  }
  return { kind: 'reeds', tiles, scanInterval: .1, damageInterval: 1, entryStealth: .2 };
}
export async function prepareStageReeds({ root, rules, compiledRules, geometry }) {
  if (!geometry || !geometry.tileLegend.some(t => REED_TILE_KEYS.includes(t.key))
    && !Object.keys(compiledRules?.reedTileParameters ?? {}).length && !compiledRules?.reedIgnitions?.length) return { reeds: null, sources: [] };
  const { level, source } = await readOriginalLevel(root, rules);
  const reeds = compileStageReeds(level, geometry, compiledRules), sources = [source];
  for (const path of ['data/arkpedia-device-native-source.json', 'data/arkpedia-device-source.json'])
    sources.push({ path, sha256: createHash('sha256').update(await readFile(join(root, path))).digest('hex') });
  return { reeds, sources };
}
