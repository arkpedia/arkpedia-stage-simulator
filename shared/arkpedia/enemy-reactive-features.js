// SPDX-License-Identifier: GPL-3.0-or-later
import { INFANTRY_ATTACK, isInfantry } from './enemy-infantry-features.js';
// Small source-backed families share the regular enemy dispatcher. Registration
// stays separate from runtime factories and from generated support decisions.
const signature = (r, group, keys) => JSON.stringify(r.talents.groups[group]) === JSON.stringify([...keys].sort());
const noAbnormal = a => ['abnormalFlags', 'abnormalImmunes', 'abnormalAntis', 'abnormalCombos', 'abnormalComboImmunes']
  .every(k => a?.[k]?.length === 0);
const attribute = (buff, type, formula) => {
  const mods = buff?.attributes?.attributeModifiers;
  return mods?.length === 1 && noAbnormal(buff.attributes)
    && JSON.stringify(Object.keys(mods[0]).sort()) === JSON.stringify(['attributeType', 'fetchBaseValueFromSourceEntity', 'formulaItem', 'loadFromBlackboard', 'value'])
    && mods[0].attributeType === type && mods[0].formulaItem === formula
    && mods[0].loadFromBlackboard === 1 && mods[0].value === 0 && mods[0].fetchBaseValueFromSourceEntity === 0;
};

function agent(r, nat) {
  const c = nat.ReduceBlockCnt?.[0], buff = c?._additiveActiveBuffs?.[0];
  return ['enemy_1049_eagent', 'enemy_1049_eagent_2'].includes(r.prefabKey)
    && r.applyWay === 'MELEE' && r.skills.length === 0 && signature(r, 'ReduceBlockCnt', ['duration', 'block_cnt'])
    && r.talents.bb['ReduceBlockCnt.block_cnt'] === -1
    && r.talents.bb['ReduceBlockCnt.duration'] === (r.prefabKey.endsWith('_2') ? 10 : 5)
    && nat.ReduceBlockCnt?.length === 1 && c._buffs?.length === 0 && c._additiveActiveBuffs.length === 1
    && c._probKey === '' && c._targetFamilyMask === 3 && c._selector?.m_PathID === '0' && c._targetValidator?.m_PathID === '0'
    && attribute(buff, 5, 0) && buff.buffKey === 'eagent_t_debuff' && buff.templateKey === 'empty'
    && buff.lifeTimeType === 1 && buff.lifeTime === 0 && buff.durationKey === '' && buff.overrideType === 3
    && buff.maxStackCnt === -1 && buff.maxValidStackCnt === -1 && buff.independentCharacterSource === 0
    && buff.statusResistable === 2 && buff.loadFromDB === 0 && buff.blackboard?.length === 0;
}

function duck(r, nat) {
  const run = nat.Run?.find(c => c._buffs), mode = nat.Run?.find(c => c._generalAbilities);
  const speed = nat.SpeedUp?.find(c => c._buffs), buff = speed?._buffs?.[0];
  const transition = nat.$template?.('enemy_duckmi_t')?.eventToActions;
  const actions = transition?.ON_TAKE_DAMAGE, action = actions?.[0];
  return r.prefabKey === 'enemy_2001_duckmi' && r.applyWay === 'NONE' && r.skills.length === 0
    && signature(r, 'run', ['attack@move_speed'])
    && r.talents.bb['run.attack@move_speed'] === ({ enemy_2001_duckmi: 4, enemy_2001_duckmi_2: 3 })[r.key]
    && run?._buffs?.length === 2 && run._buffs[0].templateKey === 'enemy_duckmi_t'
    && run._buffs[0].lifeTimeType === 2 && run._buffs[1].templateKey === 'log_killed'
    && Object.keys(transition ?? {}).join() === 'ON_TAKE_DAMAGE' && actions?.length === 1
    && action.$type === 'Torappu.Battle.Action.Nodes+SwitchMode, Assembly-CSharp'
    && action._modeIndex === 1 && action._loadModeFromBlackboard === false && action._restoreDefault === false
    && action._restartFSM === true && action._targetType === 'TARGET'
    && mode?._generalAbilities?.length === 1 && nat.$ref?.(mode._generalAbilities[0]) === speed
    && mode._combat?.m_PathID === '0' && mode._attack?.m_PathID === '0'
    && speed._selector?.m_PathID === '0' && speed._buffs.length === 1 && attribute(buff, 6, 1)
    && buff.buffKey === 'duckmi_speed_up' && buff.lifeTimeType === 2 && buff.maxStackCnt === 1
    && buff.templateKey === 'empty' && buff.blackboard?.length === 0 && buff.isSilenceable === 0;
}

export const REACTIVE_ENEMY_FEATURES = Object.freeze({
  'ability:无法被阻挡': { covers: (r, n) => r.key === 'enemy_2001_duckmi_2' && duck(r, n),
    trait: { flags: { unblockable: true } }, note: 'Reviewed CN Duck Lord variant: unblockable for life.' },
  'ability:<$ba.invisible>隐匿</>': { covers: (r, n) => r.key === 'enemy_2034_sythef_2' && cryingThief(r, n),
    trait: { flags: { stealth: true } }, note: 'Reviewed CN Crying Thief variant: shared native invisibility toggle.' },
  'talent:Combat': {
    covers: (r, n) => isInfantry(r) ? INFANTRY_ATTACK.covers(r, n) : cryingThief(r, n),
    ability: r => isInfantry(r) ? INFANTRY_ATTACK.ability : { kind: 'ordinaryAttackStatus', params: r => ({ status: 'stun',
      duration: r.talents.bb['Combat.attack@stun'], stealthRestore: 0 }) },
    explains: (text, r) => isInfantry(r) ? INFANTRY_ATTACK.explains.test(text)
      : /^(?:Attacks <\$ba\.stun>Stun<\/> the target|攻击会<\$ba\.stun>晕眩<\/>目标)$/.test(text),
    note: 'Ordinary melee attacks apply resistance-aware stun, including dodged damage; invisibility restores immediately after unblocking.',
  },
  'talent:ReduceBlockCnt': {
    covers: agent,
    stageMultipliers: { 'ReduceBlockCnt.duration': value => Number.isFinite(value) && value > 0 && value <= 3600 },
    ability: { kind: 'blockReductionOnHit', params: r => ({ amount: r.talents.bb['ReduceBlockCnt.block_cnt'], duration: r.talents.bb['ReduceBlockCnt.duration'] }) },
    explains: /^Attacks temporarily reduce allied units' Block$/,
    note: 'Shared nonstacking block reduction; repeated hits extend to the greater remaining/source duration.',
  },
  'talent:run': {
    covers: duck,
    ability: { kind: 'runWhenHit', params: r => ({ bonus: r.talents.bb['run.attack@move_speed'] }) },
    explains: /^(?:Gains significantly increased Movement Speed after being attacked|受到攻击后移动速度大幅度提升)$/,
    nativeClaim: () => ({ active: 1 }),
    note: 'First damage switches permanently to the non-attacking run mode; the source record supplies the single movement bonus.',
  },
});

function cryingThief(r, nat) {
  const rows = nat.Combat ?? [], attack = rows.find(c => c._activeBuffs), stealth = rows.find(c => c._checker);
  const check = nat.$ref?.(stealth?._checker), buff = attack?._activeBuffs?.[0], hidden = stealth?._buffs?.[0];
  return r.prefabKey === 'enemy_2034_sythef' && r.applyWay === 'MELEE' && r.skills.length === 0
    && signature(r, 'Combat', ['attack@stun'])
    && r.talents.bb['Combat.attack@stun'] === ({ enemy_2034_sythef: 4, enemy_2034_sythef_2: 3.5 })[r.key]
    && rows.length === 2 && attack._selector?.m_PathID === '0' && attack._selectTargetSource === 2
    && attack._atkScale === 1 && attack._damageType === 1 && attack._activeBuffs.length === 1
    && buff.buffKey === 'stun' && buff.loadFromDB === 1 && buff.lifeTimeType === 1
    && buff.statusResistable === 2 && buff.isDamageMissable === 0 && buff.blackboard?.length === 0
    && Object.values(buff.attributes ?? {}).every(list => Array.isArray(list) && list.length === 0)
    && stealth._buffs?.length === 1 && stealth._buffsWhenToggleOff?.length === 0 && stealth._isInverseToggle === 0
    && hidden.lifeTimeType === 2 && hidden.isSilenceable === 0 && hidden.templateKey === 'empty'
    && hidden.attributes?.abnormalFlags?.join() === '9' && hidden.attributes.attributeModifiers?.length === 0
    && check?._isInitToggled === 1 && check._disableWhenAttack === 1 && check._disableWhenBlocked === 1
    && check._restoreDelay === 0 && check._disableWhenTakeDamage === 0 && check._disableWhenMoving === 0
    && check._disableWhenAppliedDamageModifier === 0 && check._disableWhenAppliedModifier === 0
    && check._disableWhenInAttackState === 0 && check._disableWhenInCombatState === 0;
}
