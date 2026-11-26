// SPDX-License-Identifier: GPL-3.0-or-later
// Light of Glory (trap_164_lrsiege, PRTS 振奋荣光; 14-10, 14-12). An ally-side trap (side 1, category 2: nothing selects
// it), hidden until a wave action activates it. Reviewed from the pinned prefab, its talents and five templates.
// - Talent `2` (operators: side 1, profession mask 767, read as every profession but TRAP): `trap_lrsiege[buff]` while
//   inside a circle that grows from `range_radius` (0.5). ATK and DEF as multipliers from `atk` (+300%) and `def`
//   (+400%), RES as a multiplier from `magic_resistance` (+30%), ASPD additive from `attack_speed` (absent: 0) and HP
//   recovery additive from `hp_recovery_per_sec` (+300/s). Its `trap_lrsiege[switch_tile]` (every 1 s) switches the
//   dynamic tiles inside the circle: Originium pollution is cleared.
// - Talent `3` (enemies, side 2): `trap_lrsiege[buff][enemy]`, Movement Speed additive from `move_speed` (-0.1), in the
//   same growing circle.
// - Growth (`trap_lrsiege[ctrl]`, every 0.03 s): the step starts at `radius_increase_per_tick` (0.0102) and gains
//   `radius_increase_addon_per_tick` (0.001) each tick up to `max_radius_increase_per_tick` (0.02); the circle's
//   radius is `range_radius` plus the summed steps, at most `max_radius` (20). Both auras are read as one circle [inference].
// - Talent `1` acts on an Active Originium Storm (`enemy_bigstorm[passive]`): not modelled; stages with a storm are
//   refused (LIGHT_OF_GLORY_UNMODELLED).
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const type = a => a?.$type?.split('+')[1]?.split(',')[0];
const types = list => (list ?? []).map(type).join();
export const LIGHT_OF_GLORY = 'trap_164_lrsiege';
/** Enemies whose interaction with it is not modelled: the Active Originium Storm. */
export const LIGHT_OF_GLORY_UNMODELLED = Object.freeze(['enemy_1420_lrmm', 'enemy_1420_lrmm_2']);

export function lightOfGloryNativeReviewed(e = native, t = tables) {
  const P = (e.prefabs?.[LIGHT_OF_GLORY]?.components ?? []), T = e.templates ?? {};
  const of = name => P.filter(c => c.object === name).map(c => c.data);
  const root = P.map(c => c.data).find(c => '_modes' in c);
  const ally = of('2').find(c => c._buffs), allyCircle = of('2').find(c => c.m_Radius !== undefined);
  const allyValidator = of('2').find(c => c._targetOptions);
  const foe = of('3').find(c => c._buffs), foeCircle = of('3').find(c => c.m_Radius !== undefined), foeValidator = of('3').find(c => c._targetOptions);
  const mods = b => (b?.attributes?.attributeModifiers ?? []).map(m => [m.attributeType, m.formulaItem, m.loadFromBlackboard]);
  const ctrl = T['trap_lrsiege[ctrl]']?.eventToActions, tile = T['trap_lrsiege[switch_tile]']?.eventToActions?.ON_BUFF_TRIGGER;
  const record = t.devices?.[LIGHT_OF_GLORY], talents = record?.talents ?? [];
  const bb = k => Object.fromEntries((talents.find(x => x.candidates[0].prefabKey === k)?.candidates[0].blackboard ?? []).map(x => [x.key, x.value]));
  const skill = t.skills?.sktok_lrsiege?.levels?.[0];
  return root?._sideType === 1 && root._category === 2 && root._modes?.length === 1
    && ally?._buffs?.[0]?.buffKey === 'trap_lrsiege[buff]' && same(mods(ally._buffs[0]), [[1, 1, 1], [2, 1, 1], [7, 0, 1], [3, 1, 1], [13, 0, 1]])
    && ally._removeBuffWhenTargetLeave === 1 && allyCircle?.m_Radius === 1
    && allyValidator?._targetOptions?.targetSide === 1 && allyValidator._targetOptions.professionMask === 767
    && ally._passiveBuffs?.map(x => x.templateKey).join() === 'trap_lrsiege[switch_tile],trap_lrsiege[ctrl]'
    && ally._passiveBuffs[0].triggerInterval === 1 && ally._passiveBuffs[1].triggerInterval === Math.fround(.03)
    && foe?._buffs?.[0]?.buffKey === 'trap_lrsiege[buff][enemy]' && same(mods(foe._buffs[0]), [[6, 0, 1]])
    && foe._removeBuffWhenTargetLeave === 1 && foeCircle?.m_Radius === 1 && foeValidator?._targetOptions?.targetSide === 2
    && foe._passiveBuffs?.[0]?.templateKey === 'trap_lrsiege[ctrl][enemy]'
    && types(ctrl?.ON_BUFF_START) === 'CalculateBlackboardValueViaParams' && ctrl.ON_BUFF_START[0]._addParamKey === 'radius_increase_per_tick'
    && types(ctrl.ON_BUFF_TRIGGER) === 'CalculateBlackboardValueViaParams,CalculateBlackboardValueViaParams,AttributeModifierWithBB,CalculateBlackboardValueViaParams'
    && ctrl.ON_BUFF_TRIGGER[0]._addParamKey === 'radius_increase_addon_per_tick' && ctrl.ON_BUFF_TRIGGER[0]._maxValueKey === 'max_radius_increase_per_tick'
    && ctrl.ON_BUFF_TRIGGER[1]._addParamKey === 'radius_increase_cur_tick' && ctrl.ON_BUFF_TRIGGER[1]._maxValueKey === 'max_radius'
    && ctrl.ON_BUFF_TRIGGER[3]._inputKey === 'range_radius' && ctrl.ON_BUFF_TRIGGER[3]._maxValueKey === 'max_radius'
    && types(tile) === 'AssignBuffBlackboardFromOthers,SwitchDynamicBuffTileModeInRange' && tile[1]._rangeRadiusKey === 'range_radius_current'
    && same(bb('2'), { range_radius: .5, radius_increase_per_tick: .0102, radius_increase_addon_per_tick: .001, max_radius_increase_per_tick: .02,
      max_radius: 20, atk: 3, hp_recovery_per_sec: 300, def: 4, magic_resistance: .3 })
    && same(bb('3'), { range_radius: .5, radius_increase_per_tick: .0102, radius_increase_addon_per_tick: .001, max_radius_increase_per_tick: .02, move_speed: -.1 })
    && skill?.skillType === 'AUTO' && skill.spData.spCost === 0;
}

/** One instance: level, skill level and facing change nothing. */
export function lightOfGloryDefinition(instance) {
  if (!lightOfGloryNativeReviewed() || !instance || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.skillLevel !== 1 || !['UP', 'RIGHT', 'DOWN', 'LEFT'].includes(instance.direction))
    throw Error('Unsupported original Light of Glory instance');
  return { kind: 'lightOfGlory', start: .5, step: .0102, stepGain: .001, maxStep: .02, maxRadius: 20, tick: Math.fround(.03), tileEvery: 1,
    ally: { atkPct: 3, defPct: 4, resPct: .3, hpRegen: 300 }, enemy: { moveFlat: -.1 },
    description: 'Once activated, a circle spreading from it to radius 20: operators inside gain ATK +300%, DEF +400%, RES +30% and 300 HP/s, enemies inside are slowed, and Originium pollution inside is cleared.' };
}
