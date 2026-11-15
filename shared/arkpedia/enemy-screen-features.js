// SPDX-License-Identifier: GPL-3.0-or-later
const node = name => `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const emptyAttributes = attributes => attributes && Object.values(attributes).every(v => Array.isArray(v) && v.length === 0);
const values = {
  enemy_1329_cbshld: [80, -4000, -160, 15, 45],
  enemy_1329_cbshld_2: [85, -4250, -170, 15, 60],
};
const keys = ['max_stack_cnt', 'def', 'magic_resistance', 'change1_stack_cnt', 'change2_stack_cnt'];

function visualActions(actions) {
  return Array.isArray(actions) && actions.every(a => {
    if (a.$type === node('IfNot')) return Object.keys(a).length === 1;
    if (a.$type === node('CheckContainsDerviedBuff')) return /^enemy_cbshld_t\[effect_[123]\]$/.test(a._derviedBuffKey);
    if (a.$type === node('FinishDerivedBuffById')) return /^enemy_cbshld_t\[effect_[123]\]$/.test(a._buffKey) && !a._decCntIfStack;
    if (a.$type === node('CreateBuff')) return a._buffOwner === 'BUFF_OWNER' && a._isDerivedBuff
      && a._finishDerivedBuffIfParentFinish && !a._useSpecialBuffSource && !a._inherateSourceProjectileFromParentBuff
      && !a._hookEffectKeyFromSourceProjectile && /^enemy_cbshld_t\[effect_[123]\]$/.test(a._buff?.buffKey)
      && a._buff.templateKey === 'empty' && emptyAttributes(a._buff.attributes) && !a._buff.loadFromDB
      && a._buff.blackboard?.length === 0 && a._buff.lifeTimeType === 'INFINITY' && a._buff.overrideType === 'DEFAULT'
      && a._buff.triggerCnt === 0 && a._buff.triggerInterval === -1;
    if (a.$type !== node('IfElse')) return false;
    const c = a._conditionNode;
    return c?.$type === node('FilterByBuffStackCount') && c._targetType === 'BUFF_OWNER'
      && c._buffKey === 'enemy_cbshld_t_cnt' && ['change1_stack_cnt', 'change2_stack_cnt'].includes(c._stackCountKey)
      && c._stackCount === 0 && c._stackCountPeeling === 0 && c._condType === 'LT'
      && !c._checkFromUnoverridableBuffCount && !c._checkSnapshotBuff && !c._checkBuffSource && !c._checkTargetHost
      && visualActions(a._succeedNodes) && visualActions(a._failNodes);
  });
}

export function screenGuardNative(record, native) {
  const expected = values[record.prefabKey], bb = record.talents.bb;
  if (!expected || record.applyWay !== 'MELEE' || record.skills.length
    || record.talents.groups.def_reduce?.join() !== [...keys].sort().join()
    || keys.some((key, i) => bb[`def_reduce.${key}`] !== expected[i])) return false;
  const root = native[record.prefabKey]?.[0], mode = native.Default?.[0], attack = native.Combat?.[0];
  const passive = native.def_reduce?.[0], buff = passive?._buffs?.[0];
  const events = native.$template?.('enemy_cbshld_t')?.eventToActions, actions = events?.ON_TAKE_DAMAGE;
  const stack = actions?.[0]?._buff;
  return root?._modes?.length === 1 && native.$ref(root._modes[0]) === mode && root._commonAbilities.length === 0
    && mode?._generalAbilities?.length === 0 && native.$ref(mode._combat) === attack
    && mode._attack.m_PathID === '0' && mode._attackTrigger.m_PathID === '0'
    && attack?._attackType === 1 && attack._damageType === 1 && attack._atkScale === 1 && attack._activeBuffs.length === 0
    && attack._selector.m_PathID === '0' && attack._selectTargetSource === 2 && attack._waitForAttackEvent === 1
    && attack._epDamageRatio === 0 && attack._extraDamageType === 0
    && native.def_reduce?.length === 1 && passive._selector.m_PathID === '0' && passive._buffs.length === 1
    && buff.templateKey === 'enemy_cbshld_t' && buff.buffKey === 'enemy_cbshld_t' && buff.lifeTimeType === 2
    && buff.loadFromDB === 0 && buff.isSilenceable === 0 && buff.isStunnable === 0 && buff.isFreezable === 0
    && buff.blackboard.length === 0 && emptyAttributes(buff.attributes)
    && Object.keys(events ?? {}).sort().join() === 'ON_BUFF_START,ON_TAKE_DAMAGE' && actions?.length === 4
    && actions[0].$type === node('CreateBuff') && actions[0]._buffOwner === 'BUFF_OWNER' && actions[0]._isDerivedBuff
    && !actions[0]._useSpecialBuffSource && actions[0]._finishDerivedBuffIfParentFinish
    && stack?.buffKey === 'enemy_cbshld_t_cnt' && stack.templateKey === 'empty' && emptyAttributes(stack.attributes)
    && stack.overrideType === 'STACK' && stack.maxStackCnt === 100 && stack.maxValidStackCnt === -1
    && stack.lifeTimeType === 'INFINITY' && !stack.isSilenceable && !stack.loadFromDB && stack.blackboard.length === 0
    && actions.slice(1, 3).every((a, i) => a.$type === node('AttributeModifierWithCertainBuffCount')
      && a._targetType === 'BUFF_OWNER' && a._attributeType === ['DEF', 'MAGIC_RESISTANCE'][i]
      && a._formulaType === 'ADDITION' && a._maxCnt === 80 && a._buffKey === 'enemy_cbshld_t_cnt'
      && !a._useOneAsMinCnt && !a._writeModifyValueToBB)
    && visualActions([actions[3]]) && visualActions(events.ON_BUFF_START);
}

export const SCREEN_ENEMY_FEATURES = Object.freeze({
  'talent:def_reduce': { covers: screenGuardNative,
    ability: { kind: 'damageStatDecay', params: r => ({ maxStacks: r.talents.bb['def_reduce.max_stack_cnt'],
      defTotal: r.talents.bb['def_reduce.def'], resTotal: r.talents.bb['def_reduce.magic_resistance'] }) },
    explains: /^Starting DEF and RES are high, but reduced whenever damage is taken$/,
    note: 'Damage adds a count after resolution. At two or more counts, each count removes 50 DEF and 2 RES, bounded by the source count; silence does not suppress it. Native shield-effect visuals remain separate.' },
});
