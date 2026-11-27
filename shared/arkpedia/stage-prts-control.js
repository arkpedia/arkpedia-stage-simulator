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
