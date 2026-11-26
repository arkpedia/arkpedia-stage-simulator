// SPDX-License-Identifier: GPL-3.0-or-later
// Explosives Loading Point (trap_126_outset, PRTS 炸弹载荷点; chapter 13). An ally-side trap (side 1, category 2:
// nothing selects it), not withdrawable. Skill sktok_outset: MANUAL, 40 SP at 1 SP/s from 0, cost 10 DP; it can only
// be cast while the Point does not carry trap_outset_hascar. The cast's trap_outset_s[summon] summons the bomb on the
// Point's own branch route (SummonEnemiesFollowBranchRoute: unharmful, always counted as killed, not managed by the
// scheduler) and marks it with trap_outset_mark, whose derived trap_outset_hascar sits on the Point while the bomb
// lives: one bomb per Point at a time.
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };

export function bombLoaderNativeReviewed(e = native, t = tables) {
  const rows = k => (e.prefabs?.[k]?.components ?? []).map(c => c.data);
  const root = rows('trap_126_outset').find(c => '_modes' in c), mode = rows('trap_126_outset').find(c => '_tileOptions' in c);
  const skill = rows('sktok_outset'), cond = skill.find(c => '_checkNotContainBuffs' in c), account = skill.find(c => '_canCastWithNoSp' in c);
  const cast = skill.find(c => c._activeBuffs?.[0]?.templateKey === 'trap_outset_s[summon]');
  const T = e.templates ?? {}, summon = T['trap_outset_s[summon]']?.eventToActions?.ON_BUFF_START;
  const mark = T.trap_outset_mark?.eventToActions?.ON_BUFF_START?.[0];
  const level = t.skills?.sktok_outset?.levels, bb = Object.fromEntries((level?.[0]?.blackboard ?? []).map(x => [x.key, x.valueStr ?? x.value]));
  const frames = t.devices?.trap_126_outset?.phases?.[0]?.attributesKeyFrames ?? [];
  return root?._sideType === 1 && root._category === 2 && root._withdrawable === 0 && root._modes?.length === 1
    && mode?._tileOptions?.passableMask === 2
    && cond?._checkNotContainBuffs === 1 && cond._buffKeys?.join() === 'trap_outset_hascar'
    && account?._canCastWithNoSp === 0 && account._canSilenced === 0 && cast?._activeBuffs.length === 1
    && summon?.length === 1 && summon[0].$type.includes('SummonEnemiesFollowBranchRoute') && summon[0]._unharmful === true
    && summon[0]._managedByScheduler === false && summon[0]._alwaysCountAsKilled === true && summon[0]._summonAllRoute === false
    && summon[0]._buffToEnemy?.templateKey === 'trap_outset_mark'
    && mark?.$type.includes('CreateBuff') && mark._buff?.buffKey === 'trap_outset_hascar' && mark._buffOwner === 'BUFF_SOURCE'
    && mark._isDerivedBuff === true && mark._finishDerivedBuffIfParentFinish === true
    && level?.length === 1 && level[0].skillType === 'MANUAL' && level[0].spData.spType === 'INCREASE_WITH_TIME'
    && level[0].spData.spCost === 40 && level[0].spData.initSp === 0 && level[0].spData.increment === 1
    && bb.cost === 10 && typeof bb.branch_id === 'string' && frames.length === 2 && frames[0].data.maxHp === frames[1].data.maxHp;
}

/** Blord2Trigger (13-21): a circle of radius 2 around the Point that gives Duq'arael's second form (enemy_blord2_mark)
 * trap_outset_blord2[trigger] (reviewed with the Throne of Blood, stage-blood-throne.js). */
export const BOMB_LOADER_LORD_RADIUS = 2;
export function bombLoaderLordTriggerReviewed(e = native) {
  const P = (e.prefabs?.trap_126_outset?.components ?? []).filter(c => c.object === 'Blord2Trigger').map(c => c.data);
  const aura = P.find(c => c._buffs?.[0]?.buffKey), circle = P.find(c => c.m_Radius !== undefined), validator = P.find(c => c._targetOptions);
  const run = e.templates?.['trap_outset_blord2[trigger]']?.eventToActions?.ON_BUFF_START?.[0];
  const names = list => (list ?? []).map(n => n.$type.split('+')[1].split(',')[0]).join();
  return aura?._buffs.length === 1 && aura._buffs[0].templateKey === 'trap_outset_blord2[trigger]' && aura._removeBuffWhenTargetLeave === 1
    && circle?.m_Radius === BOMB_LOADER_LORD_RADIUS && validator?._targetOptions?.targetSide === 2
    && JSON.stringify(validator._buffs) === '["enemy_blord2_mark"]'
    && run?.$type.includes('IfElse') && names(run._succeedNodes) === 'CheckEnemyAbilityName,IfNot,CreateBuff,CreateBuff,TriggerEnemySkill'
    && run._succeedNodes[0]._abilityName === 'BloodFountain2' && names(run._failNodes) === 'CreateBuff,CreateBuff,TriggerEnemySkill'
    && run._failNodes[0]._buff.buffKey === 'enemy_blord2_kill[mark]' && run._failNodes[0]._buffOwner === 'BUFF_SOURCE'
    && run._failNodes[2]._skillName === 'BloodFountain2';
}

/** One instance: its own branch (instance `branch_id` override). Level, skill level and facing change nothing. */
export function bombLoaderDefinition(instance) {
  if (!bombLoaderNativeReviewed() || !instance || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.skillLevel !== 1 || !['UP', 'RIGHT', 'DOWN', 'LEFT'].includes(instance.direction)
    || typeof instance.branchId !== 'string' || !instance.branchId) throw Error('Unsupported original Explosives Loading Point instance');
  return { kind: 'loader', branchId: instance.branchId, direction: instance.direction, spCost: 40, initSp: 0, spPerSecond: 1, dpCost: 10,
    range: [], description: 'Spend 10 DP to send an Anti-Witchcraft Repositionable Bomb along its track toward the next Bloodcalling Altar (one at a time).' };
}
