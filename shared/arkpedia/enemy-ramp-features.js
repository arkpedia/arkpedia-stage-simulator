// SPDX-License-Identifier: GPL-3.0-or-later
const empty = a => a && Object.values(a).every(v => !v?.length);
export const AXE_DESCRIPTION = 'Continuous attacks will increase ATK and ASPD, up to a limit. This effect will reset after a few seconds after this unit stops attacking';
export function axeDamageRamp(r, nat) {
  const bb = r.talents.bb;
  if (r.prefabKey !== 'enemy_2005_axetro' || r.applyWay !== 'ALL' || r.skills.length
    || r.talents.groups.atkup?.join() !== 'atk,attack_speed,max_stack_cnt' || r.talents.groups.checker?.join() !== 'delay'
    || bb['atkup.atk'] !== .07 || bb['atkup.attack_speed'] !== 5 || bb['atkup.max_stack_cnt'] !== 28 || bb['checker.delay'] !== 4) return false;
  const up = nat.AtkUp?.[0], toggle = nat.Checker?.[0], checker = nat.$ref?.(toggle?._checker);
  const damage = nat.$template?.('enemy_axetro_t')?.eventToActions?.ON_AFTER_OUTPUT_DAMAGE;
  const stack = damage?.[0]?._buff, mods = stack?.attributes?.attributeModifiers;
  const reset = nat.$template?.('enemy_axetro_t[checker]')?.eventToActions?.ON_BUFF_START;
  const attack = nat.Attack?.[0], combat = nat.Combat?.[0];
  const projectile = nat.$projectile?.('projectile_enemy_axetro') ?? [];
  const motion = projectile.find(c => '_speed' in c), life = projectile.find(c => '_lifeTime' in c);
  return nat.AtkUp?.length === 1 && nat.Checker?.length === 1 && nat.Combat?.length === 1 && nat.Attack?.length === 1
    && up._buffs?.length === 1 && up._buffs[0].templateKey === 'enemy_axetro_t' && up._buffs[0].isSilenceable === 0
    && toggle._buffs?.length === 1 && toggle._buffs[0].templateKey === 'enemy_axetro_t[checker]'
    && toggle._isInverseToggle === 0 && toggle._buffsWhenToggleOff?.length === 0 && toggle._unmanagedBuffsWhenToggleOn?.length === 0
    && checker?._disableWhenInAttackState === 1 && checker._disableWhenInCombatState === 1 && checker._isInitToggled === 0
    && Object.entries(checker).filter(([k]) => k.startsWith('_disable') && !['_disableWhenInAttackState', '_disableWhenInCombatState'].includes(k)).every(([, v]) => v === 0)
    && damage?.length === 3 && damage[0].$type === 'Torappu.Battle.Action.Nodes+CreateBuff, Assembly-CSharp'
    && damage[0]._buffOwner === 'BUFF_OWNER' && stack.buffKey === 'axetro_t[stack]' && stack.templateKey === 'empty'
    && stack.overrideType === 'STACK' && stack.maxStackCnt === -1 && stack.lifeTimeType === 'INFINITY' && stack.isSilenceable === false
    && mods?.length === 2 && mods[0].attributeType === 'ATK' && mods[0].formulaItem === 'MULTIPLIER' && mods[0].loadFromBlackboard === true
    && mods[1].attributeType === 'ATTACK_SPEED' && mods[1].formulaItem === 'ADDITION' && mods[1].loadFromBlackboard === true
    && damage[1].$type === 'Torappu.Battle.Action.Nodes+FilterByBuffStackCount, Assembly-CSharp'
    && damage[2]._buff?.templateKey === 'empty' && empty(damage[2]._buff.attributes)
    && reset?.length === 3 && reset.slice(0, 2).every((a, i) => a.$type === 'Torappu.Battle.Action.Nodes+FinishBuffsById, Assembly-CSharp'
      && a._buffKey === ['axetro_t[stack]', 'axetro_t[effect]'][i] && a._decCntIfStack === false && a._targetType === 'BUFF_OWNER')
    && reset[2].$type === 'Torappu.Battle.Action.Nodes+FinishBuff, Assembly-CSharp'
    && [attack, combat].every(a => a._damageType === 1 && a._attackType === 1 && a._atkScale === 1 && a._timeMode === 0
      && a._selectTargetSource === 2 && a._selector?.m_PathID === '0' && a._activeBuffs?.length === 0 && a._waitForAttackEvent === 1)
    && combat._animKey === 'Attack_2' && attack._animKey === 'Attack_1' && attack._useCachedAtkOnly === 0
    && attack._projectileKey === 'projectile_enemy_axetro' && attack._extraProjectileKeys?.length === 0
    && motion?._speed === 10 && motion._flyToTargetLocationOnly === 0 && motion._forceReachedWhenTimeup === 1
    && life?._lifeTime === 5 && life._hitNumType === 1 && life._maxHitNum === 1 && life._stopWhenSourceInvalid === 0
    && life._alwaysHitTraceTargetInTheEnd === 1 && life._canHitSameTargetMultipleTimes === 0;
}
export const axeRampAbility = { kind: 'axeRamp', params: r => ({ atkPct: r.talents.bb['atkup.atk'],
  aspd: r.talents.bb['atkup.attack_speed'], maxStacks: r.talents.bb['atkup.max_stack_cnt'], resetAfter: r.talents.bb['checker.delay'] }) };
