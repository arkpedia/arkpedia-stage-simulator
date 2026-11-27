// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 16: the pollution ("shadow") system `env_v066_mainline16_ctrl` and the global buff
// `mainline16_enemy_target_free`, which every level of the chapter names together.
// - The system keeps a shadow state for each tile (`in_sight` / `out_sight`) and draws it.
// - The buff checks every enemy each 0.3 s: on a shadowed tile and not blocked it is INVISIBLE
//   (`mainline16_enemy_target_free[core]`); blocked, or off such a tile, the flag goes.
// Tiles are shadowed by the chapter's devices and enemies (not built yet). Reviewed so far: a level with no device or
// card and only enemies known to shadow nothing gives both pieces nothing to do, and they compile to no behaviour
// (16-2). Any other level is refused until the shadow sources are modelled.
import environments from '../../data/arkpedia-environment-native-source.json' with { type: 'json' };

export const MAINLINE16_SYSTEM = 'env_v066_mainline16_ctrl', MAINLINE16_HIDE = 'mainline16_enemy_target_free';
/** Enemies reviewed to shadow no tile: the Patrol Captains, the Ursus beast, and the Miner Guerrilla (which only clears). */
export const MAINLINE16_PLAIN_ENEMIES = Object.freeze(['enemy_1107_uoffcr', 'enemy_1107_uoffcr_2', 'enemy_1108_uterer', 'enemy_3010_mcreep']);

export function mainline16NativeReviewed(e = environments) {
  const rows = (e.envSystems?.[MAINLINE16_SYSTEM] ?? []).map(r => r.data), hide = (e.prefabs?.[MAINLINE16_HIDE] ?? []).map(r => r.data ?? r);
  const draw = rows.find(r => '_tileInside' in r), mark = rows.find(r => '_tileStatusMarkedAsInside' in r), [buff] = hide[0]?._buffs ?? [];
  const tick = e.templates?.['mainline16_enemy_target_free[trigger]']?.eventToActions?.ON_BUFF_TRIGGER?.[0];
  const name = a => a?.$type?.split('+')[1]?.split(',')[0] ?? a?.$type, inShadow = tick?._failNodes?.[0];
  return rows.length === 3 && rows[0]._sideType === 2 && draw?._tileInside === 'in_sight' && draw._tileOutside === 'out_sight'
    && mark?._tileStatusMarkedAsInside === 'in_sight' && mark._tileStatusMarkedAsOutside === 'out_sight'
    && hide.length === 1 && hide[0]._options?.targetSide === 2 && buff?.templateKey === 'mainline16_enemy_target_free[trigger]'
    && Math.abs(buff.triggerInterval - .3) < 1e-6
    && name(tick) === 'IfElse' && name(tick._conditionNode) === 'CheckBlocked'
    && name(inShadow) === 'IfElse' && name(inShadow._conditionNode) === 'Main16CheckTargetInShadowStateTile'
    && JSON.stringify(inShadow._succeedNodes?.at(-1)?._buff?.attributes?.abnormalFlags) === '["INVISIBLE"]';
}

/** The level's two runes carry only their identities. */
export function compileMainline16Rule(rune, key) {
  if (!mainline16NativeReviewed() || rune?.blackboard?.length !== 1 || rune.blackboard[0].key !== 'key' || rune.blackboard[0].valueStr !== key
    || rune.blackboard[0].value !== 0) throw Error('Unsupported chapter 16 pollution rule');
  return true;
}

/** True when the original level has nothing that can shadow a tile: no device, no card, and only the plain enemies. */
export function mainline16Inert(level) {
  const p = [level.predefines, level.hardPredefines].flatMap(x => [...(x?.tokenInsts ?? []), ...(x?.tokenCards ?? [])]);
  const ids = new Set([...(level.enemyDbRefs ?? []).map(r => r.id), ...(level.waves ?? []).flatMap(w => (w.fragments ?? []).flatMap(f => (f.actions ?? [])
    .filter(a => ['SPAWN', 0].includes(a.actionType)).map(a => a.key))), ...Object.values(level.branches ?? {}).flatMap(br => (br.phases ?? []).flatMap(ph => (ph.actions ?? []).map(a => a.key)))]);
  return !p.length && [...ids].every(id => MAINLINE16_PLAIN_ENEMIES.includes(id))
    && !(level.mapData?.tiles ?? []).some(t => !['tile_forbidden', 'tile_start', 'tile_road', 'tile_floor', 'tile_wall', 'tile_end', 'tile_telin', 'tile_telout', 'tile_fence', 'tile_fence_bound', 'tile_hole', 'tile_empty'].includes(t.tileKey));
}
