// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const type = n => `Torappu.Battle.Action.Nodes+${n}, Assembly-CSharp`;
export function flowGeneratorNativeReviewed(e = native) {
  const device = e.prefabs.trap_013_blower?.components.map(c => c.data) ?? [];
  const skill = e.prefabs.sktok_blower?.components ?? [], root = device.find(c => '_modes' in c);
  if (root?._sideType !== 1 || root._category !== 2 || root._occupiedRemainingCharacterCnt !== 0
    || root._rewriteTileOptions !== 0 || root._withdrawable !== 1 || root._withdrawCostRecoverRatio !== .5
    || root._modes.length !== 1 || root._commonAbilities.length) return false;
  for (const [name, side, mask, prefix] of [['Ally', 1, 639, 'character'], ['Enemy', 2, 635, 'enemy']]) {
    const rows = skill.filter(c => c.object === name).map(c => c.data), aura = rows.find(c => '_selfOption' in c);
    const validator = rows.find(c => '_targetOptions' in c)?._targetOptions;
    if (aura?._selfOption !== 2 || aura._removeBuffWhenTargetLeave !== 1 || aura._removeBuffWhenAbilityDetached !== 1
      || aura._buffs.length !== 3 || aura._passiveBuffs.length || validator?.targetSide !== side || validator.targetMotion !== 3
      || validator.targetCategory !== 1 || validator.professionMask !== mask || validator.ignoreTargetFree !== 0
      || !rows.some(c => c.m_Script.m_PathID === '-2891200616113119906' && c._useBlackboardRangeId === 0 && c._extendable === 0)) return false;
    for (const direction of ['equal', 'opposite', 'vertical']) {
      const key = `blower_s_${prefix}[${direction}]`, buff = aura._buffs.find(b => b.templateKey === key);
      if (!buff || buff.lifeTimeType !== 2 || buff.isSilenceable !== 0 || buff.isDamageMissable !== 0 || buff.maxStackCnt !== 1
        || buff.stripBlackboardParamsWithBuffKey !== 1 || buff.overrideType !== (side === 1 ? 2 : 0)
        || side === 2 && (buff.triggerInterval !== Math.fround(.3) || buff.waitFirstTriggerInterval !== 1)) return false;
      const actions = e.templates[key]?.eventToActions[side === 1 ? 'ON_BUFF_START' : 'ON_BUFF_TRIGGER'];
      if (actions?.[0]?.$type !== type('CheckDirection') || actions[0]._source !== 'BUFF_SOURCE'
        || actions[0]._target !== 'BUFF_OWNER' || actions[0]._judgeType !== direction.toUpperCase()) return false;
      if (side === 2 && (actions[1]?.$type !== type('FinishBuffsById') || actions[1]._buffKey !== 'blower_s[speed]' || actions[1]._checkBuffSource)) return false;
      if (side === 2 && direction === 'vertical') { if (actions.length !== 2) return false; continue; }
      if (side === 1 && direction === 'vertical' && (actions[1]?.$type !== type('FilterByBlackboardValue')
        || actions[1]._blackboardKey !== 'atk' || actions[1]._condType !== 'LT' || actions[1]._valueToCompare !== 0)) return false;
      const create = actions.at(-1), child = create?._buff, mods = child?.attributes.attributeModifiers;
      if (actions.length !== (side === 2 || direction === 'vertical' ? 3 : 2) || create?.$type !== type('CreateBuff')
        || !create._isDerivedBuff || create._finishDerivedBuffIfParentFinish || child.buffKey !== (side === 1 ? 'blower_s[atk]' : 'blower_s[speed]')
        || child.disableOverride !== (side === 1) || child.lifeTimeType !== 'INFINITY' || child.maxStackCnt !== 1
        || child.independentCharacterSource || mods?.length !== 1 || !mods[0].loadFromBlackboard
        || mods[0].attributeType !== (side === 1 ? 'ATK' : 'MOVE_SPEED')
        || mods[0].formulaItem !== (direction === 'equal' ? 'MULTIPLIER' : 'FINAL_SCALER')) return false;
    }
  }
  return true;
}
export function flowGeneratorDefinition(instance) {
  if (!flowGeneratorNativeReviewed() || !instance || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || ![1, 2].includes(instance.skillLevel) || !['UP', 'RIGHT', 'DOWN', 'LEFT'].includes(instance.direction)) throw Error('Unsupported original Flow Generator instance');
  const record = tables.devices.trap_013_blower, skill = tables.skills.sktok_blower.levels[instance.skillLevel - 1];
  const bb = Object.fromEntries(skill.blackboard.map(p => [p.key, p.value]));
  const expected = ['blower_s_character[equal].atk', 'blower_s_character[vertical].atk', 'blower_s_character[opposite].atk',
    'blower_s_enemy[equal].move_speed', 'blower_s_enemy[opposite].move_speed'];
  if (skill.skillType !== 'PASSIVE' || Object.keys(bb).sort().join() !== expected.sort().join()
    || bb['blower_s_character[equal].atk'] !== .3 || bb['blower_s_character[opposite].atk'] !== -.3
    || bb['blower_s_character[vertical].atk'] !== 0 || bb['blower_s_enemy[equal].move_speed'] !== (instance.skillLevel === 1 ? .8 : .5)
    || bb['blower_s_enemy[opposite].move_speed'] !== -.5) throw Error('Changed Flow Generator skill');
  const range = tables.ranges[record.phases[0].rangeId].grids.map(p => [p.row, p.col]);
  if (JSON.stringify(range) !== '[[0,0],[0,1],[0,2],[0,3]]') throw Error('Changed Flow Generator range');
  return { kind: 'flow-generator', passive: true, retreatable: true, direction: instance.direction, range, hp: 100,
    atkBonus: bb['blower_s_character[equal].atk'], atkPenalty: bb['blower_s_character[opposite].atk'],
    speedBonus: bb['blower_s_enemy[equal].move_speed'], speedPenalty: bb['blower_s_enemy[opposite].move_speed'], poll: Math.fround(.3),
    description: 'Blows across the next three tiles. Operators facing with the flow gain 30% ATK; those facing against it lose 30% final ATK. Enemies moving with or against the flow speed up or slow down.' };
}
