// SPDX-License-Identifier: GPL-3.0-or-later
// Weakening Node `trap_227_mpweak` (PRTS 弱化节点(装置); chapter 15). An ally-side trap: nothing can attack it
// (TARGET_FREE, BLOCK_FREE, UNDEADABLE). Reviewed from the pinned prefab, sktok_mpweak_1, their templates and the record.
// - Skill 弱化 (MANUAL, 30 SP at 1 SP/s from 0, 30 s, range x-4: its own tile and the eight around it).
// - When its SP is full, `trap_mpweak_s_ready` inserts a PRTS action (MOVE_AND_CREATEBUFF, priority 100, above the
//   grab orders' 50): the Intrusive Call flies to it. On arrival (`trap_mpweak_s_trigger[prts]`): if the skill is
//   already active the hand is Angry; otherwise the skill is cast for free in mode Enemy for `duration_prts` (20 s),
//   and a cast that cannot start also makes the hand Angry.
// - The player may cast it for `cost` (10) DP: mode Ally for 30 s.
// - Mode Ally: every enemy in range (ground and air) has DEF x0.5 and RES x0.5 (talent `1`: `def`, `magic_resistance`;
//   its `atk` 1 changes nothing) while it stays in range. Mode Enemy: the same for ground ally units in range.
// - When the skill ends it returns to its idle mode and charges again from 0.
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const type = a => a?.$type?.split('+')[1]?.split(',')[0];
const types = list => (list ?? []).map(type).join();
const keys = list => (list ?? []).map(b => b.buffKey).join();
export const WEAKENING_NODE = 'trap_227_mpweak';

export function weakeningNodeNativeReviewed(e = native, t = tables) {
  const P = k => e.prefabs?.[k]?.components ?? [], T = k => e.templates?.[k]?.eventToActions;
  const rows = P(WEAKENING_NODE), root = rows.find(c => '_modes' in c.data)?.data;
  const byId = ref => rows.find(c => c.pathId === String(ref?.m_PathID))?.data;
  const auras = rows.filter(c => c.object === '1' && c.data._buffs).map(c => c.data);
  const aura = key => auras.find(a => a._buffs[0].buffKey === key), side = a => byId(a?._targetValidator)?._targetOptions;
  const mods = a => a?._buffs[0].attributes?.attributeModifiers?.map(m => [m.attributeType, m.formulaItem, m.loadFromBlackboard]);
  const passive = rows.find(c => c.data._buffs?.[0]?.buffKey === 'trap_mpweak_passive')?.data._buffs;
  const skill = P('sktok_mpweak_1').map(c => c.data), cast = skill.find(c => c._buffs?.[0]?.buffKey === 'trap_mpweak_s');
  const ready = T('trap_mpweak_s_ready')?.ON_BUFF_START, arrive = T('trap_mpweak_s_arrive[prts]')?.ON_BUFF_START;
  const trigger = T('trap_mpweak_s_trigger[prts]')?.ON_BUFF_START?.[0], run = T('trap_mpweak_s');
  const record = t.devices?.[WEAKENING_NODE], frame = record?.phases?.[0]?.attributesKeyFrames?.[0], level = t.skills?.sktok_mpweak_1?.levels;
  const range = t.ranges?.['x-4']?.grids?.map(g => [g.row, g.col]);
  return root?._sideType === 1 && root._category === 2 && root._modes?.length === 3
    && keys(passive) === 'trap_mpweak_passive' && same(passive[0].attributes?.abnormalFlags, [3, 2, 6])
    && auras.length === 2 && auras.every(a => a._removeBuffWhenTargetLeave === 1)
    && same(mods(aura('trap_mpweak[enemy]')), [[2, 3, 1], [3, 3, 1], [1, 3, 1]]) && side(aura('trap_mpweak[enemy]'))?.targetSide === 2
    && side(aura('trap_mpweak[enemy]')).targetMotion === 3
    && same(mods(aura('trap_mpweak[ally]')), [[2, 3, 1], [3, 3, 1]]) && side(aura('trap_mpweak[ally]'))?.targetSide === 1
    && side(aura('trap_mpweak[ally]')).targetMotion === 1
    && rows.filter(c => c.data._rangeId === 'x-4').length === 2
    && cast?._buffs[0].lifeTimeType === 1 && cast._buffs[0].durationKey === 'duration'
    && types(ready) === 'Main15InsertPrtsAction' && ready[0]._actionType === 'MOVE_AND_CREATEBUFF' && ready[0]._priority === 100
    && ready[0]._buffData.templateKey === 'trap_mpweak_s_arrive[prts]'
    && types(arrive) === 'CreateBuffOnTileInRange' && arrive[0]._buffs[0].templateKey === 'trap_mpweak_s_trigger[prts]'
    && type(trigger) === 'IfElse' && type(trigger._conditionNode) === 'CheckCharSkillAffecting'
    && trigger._succeedNodes.some(a => type(a) === 'TriggerEnemySkill' && a._skillName === 'Angry')
    && types(trigger._failNodes) === 'SetCastSkillCost,IfElse' && type(trigger._failNodes[1]._conditionNode) === 'TriggerSkill'
    && trigger._failNodes[1]._succeedNodes[1]._buff.durationKey === 'duration_prts'
    && trigger._failNodes[1]._failNodes.some(a => type(a) === 'TriggerEnemySkill' && a._skillName === 'Angry')
    && types(T('trap_mpweak_s_prts')?.ON_BUFF_FINISH) === 'InterruptCharacterSkill'
    && type(run?.ON_BUFF_START?.[0]) === 'IfElse' && run.ON_BUFF_START[0]._succeedNodes[0]._modeIndex === 2
    && run.ON_BUFF_START[0]._failNodes[0]._modeIndex === 1 && types(run.ON_BUFF_FINISH) === 'SwitchMode'
    && record?.name === '弱化节点' && frame?.level === 1 && frame.data.maxHp === 10000 && frame.data.def === 0 && frame.data.tauntLevel === -1
    && same((record.talents?.[0]?.candidates?.[0]?.blackboard ?? []).map(x => [x.key, x.value]), [['magic_resistance', .5], ['def', .5], ['atk', 1]])
    && level?.length === 1 && level[0].skillType === 'MANUAL' && level[0].spData.spType === 'INCREASE_WITH_TIME'
    && level[0].spData.spCost === 30 && level[0].spData.initSp === 0 && level[0].duration === 30 && level[0].rangeId === 'x-4'
    && same(level[0].blackboard.map(x => [x.key, x.value]), [['cost', 10], ['duration_prts', 20]])
    && same(range, [[1, -1], [1, 0], [1, 1], [0, -1], [0, 0], [0, 1], [-1, -1], [-1, 0], [-1, 1]]);
}

export function weakeningNodeDefinition(instance) {
  if (!weakeningNodeNativeReviewed() || instance?.level !== 1 || instance.skillLevel !== 1) throw Error('Unsupported Weakening Node instance');
  return { hp: 10000, spCost: 30, initSp: 0, spPerSecond: 1, dpCost: 10, duration: 30, prtsDuration: 20, defScale: .5, resScale: .5,
    range: [[1, -1], [1, 0], [1, 1], [0, -1], [0, 0], [0, 1], [-1, -1], [-1, 0], [-1, 1]] };
}
