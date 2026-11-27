// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 16, the Ursus army's soldiers that engage Miner Guerrillas. Reviewed so far: the Army Infiltrator
// `enemy_10120_uaghst` (PRTS 集团军潜行兵). Reviewed from its pinned prefab and templates. Runtime:
// server/sim/content/arkpedia-enemy-army.js.
// - It cannot be blocked (its handbook line).
// - Attack: its selector takes one ground unit holding `mark_neutral[effect]` within its radius (1.0), so it attacks only
//   neutral units (PRTS: Ursus civilians, Talulah the Fighter and Miner Guerrillas) and never an operator.
// - BlockMcreep `mainline16_g[block_mcreep]`, every 0.3 s: while it engages fewer than `block_mcreep_cnt` (1) Miner
//   Guerrillas, the nearest ground one holding `enemy_mcreep_able_to_be_blocked` inside a circle of `range_radius`
//   (0.9) gets `block_mcreep[to_mcreep]`: UNMOVABLE, and the Infiltrator gets `block_mcreep[stack]`, also UNMOVABLE.
//   Both stand and fight. That buff checks every 0.3 s that the Miner Guerrilla is still within `range_radius` +
//   `range_radius_add` (1.0), and ends otherwise or when the Infiltrator is gone (a derived buff); the Miner Guerrilla
//   can then be engaged again.
import { NEUTRAL_MARK } from './enemy-miner-guerrilla-features.js';

export const ARMY_INFILTRATOR = 'enemy_10120_uaghst';
const UNBLOCKABLE_TEXT = '无法被阻挡', ENGAGE_TEXT = '能和1名<矿工游击队>交战';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const type = a => a?.$type?.split('+')[1]?.split(',')[0] ?? a?.$type;
const types = list => (list ?? []).map(type).join();
export const isArmyInfiltrator = r => r?.prefabKey === ARMY_INFILTRATOR && r.key === ARMY_INFILTRATOR;

export function armyInfiltratorNative(r, n) {
  const bb = r?.talents?.bb ?? {};
  if (!isArmyInfiltrator(r) || r.stats.motion !== 'WALK' || r.stats.rawRangeRadius !== 1 || r.applyWay !== 'NONE' || r.skills.length
    || !same(Object.keys(bb).sort(), ['BlockMcreep.block_mcreep_cnt', 'BlockMcreep.range_radius', 'BlockMcreep.range_radius_add'])
    || !(bb['BlockMcreep.block_mcreep_cnt'] >= 1) || !(bb['BlockMcreep.range_radius'] > 0) || !(bb['BlockMcreep.range_radius_add'] >= 0)
    || !same(r.abilities.map(a => a.text), [UNBLOCKABLE_TEXT, ENGAGE_TEXT])) return false;
  const T = k => n?.$template?.(k)?.eventToActions, root = n?.[ARMY_INFILTRATOR]?.[0];
  const passive = (n?.Passive ?? []).flatMap(c => c._buffs ?? []), engage = passive.find(b => b.buffKey === 'mainline16_g[block_mcreep]');
  const attack = (n?.Attack ?? [])[0], trigger = n?.$ref?.((n?.Default ?? [])[0]?._attackTrigger);
  const selector = (trigger ? n.$siblings(trigger) : []).find(c => '_targetSide' in c);
  const nearest = n?.$ref?.((n?.SelectNearestMcreep ?? [])[0]?._selector);
  const run = T('mainline16_g[block_mcreep]')?.ON_BUFF_TRIGGER, hold = T('block_mcreep[to_mcreep]');
  return !!root && root._sideTypeIndex === 1 && root._modes?.length === 1
    && same(passive.map(b => b.buffKey).sort(), ['enemy_field_army_self_mark', 'mainline16_g[block_mcreep]'])
    && Math.abs(engage.triggerInterval - .3) < 1e-6 && engage.triggerLifeType === 2
    && attack?._animKey === 'Attack' && attack._damageType === 1 && !attack._projectileKey
    && selector?._targetSide === 2 && selector._targetMotion === 1 && selector._maxNum === 1 && selector._buffKey === NEUTRAL_MARK
    && nearest?._targetMotion === 1 && nearest._maxNum === 1 && nearest._buffKey === 'enemy_mcreep_able_to_be_blocked'
    && types(run) === 'FilterByBuffStackCount,CreateBuffUseAbilitySelector'
    && run[0]._buffKey === 'block_mcreep[stack]' && run[0]._stackCountKey === 'block_mcreep_cnt' && run[0]._condType === 'LT'
    && run[1]._abilityName === 'SelectNearestMcreep' && run[1]._buff.templateKey === 'block_mcreep[to_mcreep]'
    && same(run[1]._buff.attributes?.abnormalFlags, ['UNMOVABLE']) && run[1]._isDerivedBuff === true && run[1]._finishDerivedBuffIfParentFinish === true
    && Math.abs(run[1]._buff.triggerInterval - .3) < 1e-6
    && types(hold?.ON_BUFF_START) === 'CreateBuff,FinishBuffsById,BlackboardAdd'
    && hold.ON_BUFF_START[0]._buff.buffKey === 'block_mcreep[stack]' && same(hold.ON_BUFF_START[0]._buff.attributes?.abnormalFlags, ['UNMOVABLE'])
    && hold.ON_BUFF_START[0]._buffOwner === 'BUFF_SOURCE' && hold.ON_BUFF_START[1]._buffKey === 'enemy_mcreep_able_to_be_blocked'
    && hold.ON_BUFF_START[2]._blackboardKey === 'range_radius' && hold.ON_BUFF_START[2]._additionKey === 'range_radius_add'
    && types(hold.ON_BUFF_TRIGGER) === 'CheckTargetInRange,IfNot,FinishBuff' && hold.ON_BUFF_TRIGGER[0]._checkRadius === true
    && types(hold.ON_BUFF_FINISH) === 'CreateBuff,CreateBuff' && hold.ON_BUFF_FINISH[1]._buff.buffKey === 'enemy_mcreep_able_to_be_blocked';
}

export function minerEngageParams(r) {
  const bb = r.talents.bb;
  return { mark: NEUTRAL_MARK, neutralOnly: true,
    engage: { interval: .3, radius: bb['BlockMcreep.range_radius'], add: bb['BlockMcreep.range_radius_add'], count: bb['BlockMcreep.block_mcreep_cnt'] } };
}

const army = (note, extra = {}) => ({ matchesRecord: isArmyInfiltrator, covers: armyInfiltratorNative, ability: null, note, ...extra });
export const ARMY_FEATURES = Object.freeze({
  // Its unblockable handbook line is the shared key 'ability:无法被阻挡' (enemy-reactive-features.js).
  'talent:BlockMcreep': army('Army Infiltrator: engages one Miner Guerrilla in reach (both stand) and attacks only neutral units', {
    nativeClaim: () => ({ active: 1 }), explains: text => text === ENGAGE_TEXT,
    ability: r => ({ kind: 'minerEngage', params: () => minerEngageParams(r) }) }),
});
