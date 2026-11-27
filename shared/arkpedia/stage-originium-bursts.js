// SPDX-License-Identifier: GPL-3.0-or-later
// Originium crystal bursts: the environment system `env_030_random_tile_selector` (PRTS 【源石晶簇爆发】; six-star
// 15-14's base condition). Reviewed from its pinned prefab:
// - a selector with `_maxTarget` 1 and `_waitFirstPeriod` 1 picks one of the rule's tiles every `interval` s and
//   raises the status `trigger_event` (originiums_warning) there; `delay_trigger_interval` s later it raises
//   `delay_trigger_event` (originiums_start);
// - on originiums_start: CreateBuffOnTileInRange (`range_id`, the ally side, every motion, devices and tokens
//   included) with `instant_damage_magic[buff]` of `damage`; then SpawnTokenOnTargetTile `trap_055_tileblock`
//   level 0 (Sealed Ground) with `suicide_after_buff[not_source]` for `life_time` s. A token cannot be put on a taken
//   tile, which is PRTS's "if no ally unit stands on the tile".
// The tile choice is compiled game code. Each tile carries a weight and the rule gives `add_other_weight`; PRTS says
// the crystals appear "as evenly as possible". Read as: a weighted draw, after which the drawn tile's weight changes
// by `add_other_weight` [inference].
import environments from '../../data/arkpedia-environment-native-source.json' with { type: 'json' };

export const ORIGINIUM_BURST_SYSTEM = 'env_030_random_tile_selector';
/** Range `x-4`: the tile and the eight around it (checked against the device source in the tests). */
export const ORIGINIUM_BURST_RANGE = Object.freeze([[1, -1], [1, 0], [1, 1], [0, -1], [0, 0], [0, 1], [-1, -1], [-1, 0], [-1, 1]].map(Object.freeze));

export function originiumBurstNativeReviewed(e = environments) {
  const rows = (e.envSystems?.[ORIGINIUM_BURST_SYSTEM] ?? []).map(r => r.data), pick = rows.find(r => '_triggerEventBB' in r);
  const burst = rows.find(r => r._envStatus);
  let actions = null;
  try { actions = JSON.parse(burst?._actions?.SerializedState ?? 'null'); } catch { return false; }
  const [damage, seal] = actions ?? [], name = a => a?.$type?.split('+')[1]?.split(',')[0];
  return rows.length === 5 && rows[0]._sideType === 2 && pick?._maxTarget === 1 && pick._waitFirstPeriod === 1
    && pick._triggerEventBB === 'trigger_event' && pick._delayTriggerIntervalBB === 'delay_trigger_interval' && pick._delayTriggerEventBB === 'delay_trigger_event'
    && JSON.stringify(burst?._envStatus) === '["originiums_start"]' && actions?.length === 2
    && name(damage) === 'CreateBuffOnTileInRange' && damage._side === 'ALLY' && damage._targetOptions.targetSide === 'ALLY'
    && damage._targetOptions.targetMotion === 'ALL' && damage._buffs?.length === 1 && damage._buffs[0].templateKey === 'instant_damage_magic[buff]'
    && name(seal) === 'SpawnTokenOnTargetTile' && seal._tokenToSpawn?.inst?.characterKey === 'trap_055_tileblock' && seal._tokenToSpawn.inst.level === 0
    && seal._buffs?.length === 1 && seal._buffs[0].templateKey === 'suicide_after_buff[not_source]' && seal._buffs[0].durationKey === 'life_time';
}

/** The level's rune: tiles "(row,col,weight)|…", the period, the warning time, the damage and the seal's life. */
export function compileOriginiumBurstRule(rune) {
  const bb = Object.fromEntries((rune?.blackboard ?? []).map(x => [x.key, x.valueStr ?? x.value]));
  const tiles = String(bb.tile ?? '').split('|').map(t => /^\((\d+),(\d+),(\d+)\)$/.exec(t)).map(m => m && { row: +m[1], col: +m[2], weight: +m[3] });
  if (!originiumBurstNativeReviewed() || rune.blackboard.length !== 10 || bb.key !== ORIGINIUM_BURST_SYSTEM || !tiles.length || tiles.some(t => !t || !(t.weight > 0))
    || new Set(tiles.map(t => `${t.row},${t.col}`)).size !== tiles.length || !(bb.interval > 0) || !(bb.delay_trigger_interval >= 0) || !(bb.life_time > 0)
    || !(bb.damage > 0) || bb.range_id !== 'x-4' || bb.trigger_event !== 'originiums_warning' || bb.delay_trigger_event !== 'originiums_start'
    || !Number.isFinite(bb.add_other_weight)) throw Error('Unsupported Originium burst rule');
  return { tiles, interval: bb.interval, delay: bb.delay_trigger_interval, life: bb.life_time, damage: bb.damage, addWeight: bb.add_other_weight,
    range: ORIGINIUM_BURST_RANGE.map(([r, c]) => [r, c]) };
}
