// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 15: the PRTS control system `env_v060_mainline15_prtsCtrl` (a compiled controller named by `env_system_new`).
// Its prefab names what it works with: the Intrusive Call `enemy_10072_mpprhd` (`_prtsEnemyKey`), the tile it drags
// enemies from (`_prtsEnemyDragTileKey` `tile_mpprts_enemy_born`), and eight enemy-to-device pairs it places
// (`_enemyTrapKeyPairs`: the drink machines, the monstrosity echoes, the caster crystals and the Weakening Node).
// Every action runs through the Intrusive Call. Reviewed so far: a level that has neither the Intrusive Call nor a
// drag tile gives the system nothing to do (15-4, 15-19), and it compiles to no behaviour. Any other level is refused
// until the Intrusive Call's actions are modelled.
import environments from '../../data/arkpedia-environment-native-source.json' with { type: 'json' };

export const PRTS_CONTROL_SYSTEM = 'env_v060_mainline15_prtsCtrl';
export const PRTS_INTRUSIVE_CALL = 'enemy_10072_mpprhd', PRTS_DRAG_TILE = 'tile_mpprts_enemy_born';
const PAIRS = Object.freeze([['enemy_10074_mpcata', 'trap_229_mpcata', 2], ['enemy_10074_mpcata_2', 'trap_230_mpcatab', 2],
  ['enemy_10076_mpgrou', 'trap_231_mpgrou', 2], ['enemy_10076_mpgrou_2', 'trap_232_mpgroub', 2], ['enemy_10079_mpmage', 'trap_233_mpmage', 2],
  ['enemy_10079_mpmage_2', 'trap_234_mpmageb', 2], ['enemy_10082_mpweak', 'trap_227_mpweak', 1], ['enemy_10082_mpweak', 'trap_227_mpweak', 1]]);

export function prtsControlNativeReviewed(e = environments) {
  const rows = (e.envSystems?.[PRTS_CONTROL_SYSTEM] ?? []).map(r => r.data), c = rows.find(r => '_prtsEnemyKey' in r);
  return rows.length === 2 && rows[0]._sideType === 2 && JSON.stringify(rows[0]._blackboard) === '[]'
    && c?._prtsEnemyKey === PRTS_INTRUSIVE_CALL && c._prtsEnemyDragTileKey === PRTS_DRAG_TILE
    && JSON.stringify(c._enemyTrapKeyPairs?.map(p => [p.enemyKey, p.trapInst?.inst?.characterKey, p.trapSide])) === JSON.stringify(PAIRS)
    && c._buffToPrtsWhenActionFinish?.templateKey === 'enemy_mpprhd_action_end';
}

/** The level's rune for the system: only its identity, no parameters. */
export function compilePrtsControlRule(rune) {
  if (!prtsControlNativeReviewed() || rune?.blackboard?.length !== 1 || rune.blackboard[0].key !== 'key' || rune.blackboard[0].valueStr !== PRTS_CONTROL_SYSTEM)
    throw Error('Unsupported PRTS control rule');
  return true;
}

/** True when the original level gives the system nothing to act with: no Intrusive Call and no drag tile anywhere. */
export function prtsControlInert(level) {
  const text = JSON.stringify([level.enemyDbRefs, level.enemies, level.waves, level.branches, level.routes, level.extraRoutes, level.predefines, level.hardPredefines]);
  return !text.includes(PRTS_INTRUSIVE_CALL) && !(level.mapData?.tiles ?? []).some(t => t.tileKey === PRTS_DRAG_TILE);
}

/** The level's one drag tile (`tile_mpprts_enemy_born`), in level coordinates (row 0 at the bottom). */
export function prtsDragTile(level) {
  const map = level.mapData?.map ?? [], tiles = level.mapData?.tiles ?? [], found = [];
  for (const [ri, row] of map.entries()) for (const [col, index] of row.entries())
    if (tiles[index]?.tileKey === PRTS_DRAG_TILE) found.push({ row: map.length - 1 - ri, col });
  if (found.length !== 1) throw Error('PRTS control needs exactly one drag tile');
  return found[0];
}

/** Enemies the Intrusive Call places as a device instead: the Weakening Node anywhere, the others on a highland tile. */
export const PRTS_NODE_ENEMY = 'enemy_10082_mpweak';
export const PRTS_STATIC_ENEMIES = Object.freeze(PAIRS.map(p => p[0]).filter(k => k !== PRTS_NODE_ENEMY));
/** Where a grabbed enemy is deployed: the start of its own route. Device forms are not modelled yet and are refused. */
export function prtsGrabTarget(level, action) {
  const route = level.routes?.[action.routeIndex], p = route?.startPosition, map = level.mapData?.map ?? [];
  const tile = level.mapData?.tiles?.[map[map.length - 1 - p?.row]?.[p?.col]];
  if (!tile || !Number.isInteger(p.row) || !Number.isInteger(p.col)) throw Error('Intrusive Call grab without a target tile');
  const highland = ['HIGHLAND', 1].includes(tile.heightType);
  if (action.key === PRTS_NODE_ENEMY) throw Error('Unsupported Intrusive Call deploy: the Weakening Node device');
  if (highland && PRTS_STATIC_ENEMIES.includes(action.key)) throw Error(`Unsupported Intrusive Call deploy: a static ${action.key}`);
  return { row: p.row, col: p.col, highland };
}
