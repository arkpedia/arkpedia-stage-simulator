// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const permanent = b => b?.lifeTimeType === 2 && b.isSilenceable === 0;
const rows = (key, n) => n.prefabs[key]?.components.map(c => c.data) ?? [];
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';

/** Capturable devices keep one identity, tile and asset across both factions. */
export function capturableDeviceNativeReviewed(key, n = native) {
  if (key !== 'trap_057_wpnsts') return false;
  const parts = rows(key, n), root = parts.find(c => '_modes' in c);
  const modes = parts.filter(c => '_tileOptions' in c), auras = parts.filter(c => '_removeBuffWhenTargetLeave' in c);
  const respawns = parts.filter(c => '_maxRespawnCnt' in c), validators = parts.filter(c => '_targetOptions' in c);
  const immunity = parts.flatMap(c => c._buffs ?? []).find(b => b.buffKey === 'wpnsts_abnormalimmunes');
  const names = n.statusDefinitions ?? {};
  if (root?._modes.length !== 2 || root._sideType !== 1 || root._category !== 1
    || root._occupiedRemainingCharacterCnt !== 0 || root._withdrawable !== 0 || root._filterTag.join() !== 'TAG_TRAP_WPNSTS'
    || modes.length !== 2 || !modes.every(m => zero(m._attack) && zero(m._combat) && m._tileOptions.passableMask === 2 && m._tileOptions.buildableType === 0)
    || !permanent(immunity) || immunity.templateKey !== 'immu_environment_damage'
    || immunity.attributes.abnormalFlags.join() !== ['UNBALANCE_IMMUNE', 'ELEMENT_FREE_ALL', 'HEAL_FREE', 'ALLY_TARGET_FREE'].map(k => names[k]).join()
    || immunity.attributes.abnormalImmunes.join() !== ['STUNNED', 'FROZEN', 'SILENCED', 'COLD', 'DISARMED'].map(k => names[k]).join()
    || immunity.attributes.abnormalComboImmunes.join() !== String(names.SLEEPING)) return false;
  if (auras.length !== 2 || !auras.every((a, i) => {
    const [buff] = a._buffs, side = i === 0 ? 'ally' : 'enemy';
    const [blast, change] = a._passiveBuffs ?? [];
    return a._buffs.length === 1 && a._selfOption === 2 && a._removeBuffWhenTargetLeave === 1
      && a._removeBuffWhenAbilityDetached === 1 && a._ignoreOwnerFakeDeath === 0
      && permanent(buff) && buff.buffKey === `wpnsts_t_1[${side}]` && buff.templateKey === 'modify_sp[trigger]'
      && buff.triggerLifeType === 2 && buff.waitFirstTriggerInterval === 1 && buff.stripBlackboardParamsWithBuffKey === 1
      && buff.maxStackCnt === 1 && buff.independentCharacterSource === 0
      && permanent(blast) && blast.templateKey === 'wpnsts_change_side'
      && blast.blackboard.find(p => p.key === 'value')?.value === (i === 0 ? 2 : 1)
      && change?.templateKey === 'switch_side_when_start' && change.lifeTimeType === 0
      && change.blackboard.find(p => p.key === 'value')?.value === i + 1;
  })) return false;
  if (validators.length !== 2 || !validators.every(v => {
    const t = v._targetOptions;
    return t.targetSide === 1 && t.targetMotion === 3 && t.targetCategory === 1 && t.professionMask === 639
      && t.ignoreTargetFree === 1 && t.ignoreAllyTargetFree === 0 && t.ignoreHealFree === 0;
  }) || respawns.length !== 2 || !respawns.every((r, i) => r._maxRespawnCnt === -1 && r._modeIndex === 1 - i
    && r._keepAlive === 0 && r._useAbilityToHandle === 0 && r._hpRechargeRatio === 1 && r._detachAbilityWhenReborn === 1
    && r._buffsRetainedWhenReborn.join() === 'wpnsts_abnormalimmunes,wpnsts_s_hp,mpctrl_tower_point_wpnsts')) return false;
  for (let i = 0; i < 2; i++) {
    const skill = rows(`sktok_wpnsts_${i + 1}`, n), account = skill.find(c => '_defaultModeIndex' in c);
    const buffs = skill.flatMap(c => c._buffs ?? []), regen = buffs.find(b => b.buffKey === 'wpnsts_s_hp');
    if (account?._defaultModeIndex !== (i === 0 ? 0 : -1) || !permanent(regen)
      || regen.attributes.attributeModifiers.map(m => `${m.attributeType}:${m.formulaItem}:${m.loadFromBlackboard}`).join() !== '13:0:1') return false;
    if (i && !buffs.some(b => b.templateKey === 'switch_mode_no_restore' && b.lifeTimeType === 0 && b.blackboard[0]?.key === 'mode' && b.blackboard[0]?.value === 1)) return false;
  }
  const events = n.templates?.wpnsts_change_side?.eventToActions, actions = events?.ON_BEFORE_TRY_SET_HP_ZERO;
  const blast = actions?.[1], side = actions?.[2], sp = n.templates?.['modify_sp[trigger]']?.eventToActions?.ON_BUFF_TRIGGER?.[0];
  const env = n.templates?.immu_environment_damage?.eventToActions?.ON_TAKE_DAMAGE;
  const mode = n.templates?.switch_mode_no_restore?.eventToActions?.ON_BUFF_START?.[0];
  return Object.keys(events ?? {}).join() === 'ON_BEFORE_TRY_SET_HP_ZERO' && actions.length === 4
    && blast.$type === 'Torappu.Battle.Action.Nodes+AOEDamage, Assembly-CSharp' && blast._useAbilitySourceSide
    && blast._sourceType === 'BUFF_SOURCE' && blast._targetType === 'BUFF_OWNER' && blast._damageType === 'MAGICAL'
    && blast._targetOptions.targetSide === 'ALLY' && blast._targetOptions.targetMotion === 'ALL'
    && !blast._targetOptions.ignoreTargetFree && !blast._targetOptions.ignoreAllyTargetFree && !blast._targetOptions.ignoreHealFree
    && blast._excludeTarget && blast._rangeId === 'x-1' && blast._useDamageFromBB && blast._damageKey === 'blast_damage'
    && blast._buffs.length === 1 && blast._buffs[0].buffKey === 'stun' && !blast._buffs[0].isDamageMissable
    && side.$type === 'Torappu.Battle.Action.Nodes+SwitchSide, Assembly-CSharp' && !side._markEnemyKilled
    && sp?.$type === 'Torappu.Battle.Action.Nodes+ModifySp, Assembly-CSharp' && sp._targetType === 'TARGET'
    && sp._spMask === 'ALL' && !sp._forceFlag && !sp._dontCheckSpType && sp._spString === 'sp'
    && env?.length === 2 && env[0]._filterSharedMask && env[0]._sharedFlag === 'IS_ENVIRONMENT_DAMAGE'
    && env[1].$type === 'Torappu.Battle.Action.Nodes+DamageScale, Assembly-CSharp'
    && mode?.$type === 'Torappu.Battle.Action.Nodes+SwitchMode, Assembly-CSharp' && mode._loadModeFromBlackboard && !mode._restoreDefault;
}

export function capturableDeviceDefinition(key, instance) {
  if (!capturableDeviceNativeReviewed(key) || !Number.isSafeInteger(instance?.level) || instance.level < 1 || instance.level > 90
    || instance.skillLevel !== 1 || ![0, 1].includes(instance.skillIndex)) throw Error(`Unsupported capturable device instance: ${key}`);
  const record = tables.devices[key], skill = tables.skills[record.skills[instance.skillIndex].skillId].levels[0];
  const bb = Object.fromEntries(record.talents[0].candidates[0].blackboard.map(p => [p.key, p.value]));
  const stats = record.phases[0].attributesKeyFrames[0].data;
  const regen = skill.blackboard.find(p => p.key === 'hp_recovery_per_sec').value;
  return { kind: 'supplyStation', passive: true, position: record.position, side: instance.skillIndex === 0 ? 'ally' : 'enemy',
    stats: { hp: stats.maxHp, def: stats.def, res: stats.magicResistance }, taunt: stats.tauntLevel, regen,
    range: tables.ranges[skill.rangeId].grids.map(p => [p.row, p.col]),
    recharge: { ally: { amount: bb['wpnsts_t_1[ally].sp'], interval: bb['wpnsts_t_1[ally].interval'] },
      enemy: { amount: bb['wpnsts_t_1[enemy].sp'], interval: bb['wpnsts_t_1[enemy].interval'] } },
    duration: bb.duration, damage: bb.blast_damage, stun: bb.stun,
    description: `Restores 1 SP to nearby units on its side every 2 seconds and regenerates ${regen} HP per second. When depleted, damages and stuns nearby units on its former side, then reboots for ${bb.duration} seconds under the opposing side's control.` };
}
