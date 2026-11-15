// SPDX-License-Identifier: GPL-3.0-or-later
const node = (action, name) => action?.$type === `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const event = (nat, key, name) => {
  const events = nat.$template?.(key)?.eventToActions;
  return Object.keys(events ?? {}).join() === name ? events[name] : null;
};
function lancer(r, nat) {
  if (!['enemy_1072_dlancer', 'enemy_1072_dlancer_2'].includes(r.prefabKey) || r.applyWay !== 'MELEE' || r.skills.length) return false;
  const bb = r.talents.bb;
  if (Object.keys(bb).sort().join() !== 'firstattack.atk_scale,rush.dlancer_t[trigger].interval,rush.dlancer_t[trigger].move_speed,rush.dlancer_t[trigger].trig_cnt'
    || bb['rush.dlancer_t[trigger].interval'] !== .5 || bb['rush.dlancer_t[trigger].move_speed'] !== .5
    || bb['rush.dlancer_t[trigger].trig_cnt'] !== 25 || bb['firstattack.atk_scale'] !== (r.prefabKey.endsWith('_2') ? 800 : 600)) return false;
  const rush = nat.Rush?.[0], attack = nat.FirstAttack?.[0], buff = attack?._additiveActiveBuffs?.[0];
  if (nat.Rush?.length !== 1 || rush._buffs?.length !== 4 || nat.FirstAttack?.length !== 1
    || attack._additiveActiveBuffs?.length !== 1 || attack._buffs?.length !== 0 || attack._probKey !== ''
    || buff?.templateKey !== 'dlancer_t_atk' || buff.lifeTimeType !== 0 || buff.attributes.attributeModifiers.length !== 0) return false;
  for (const [i, key] of ['a', 'b', 'c'].entries()) {
    const listener = rush._buffs[i];
    if (listener.templateKey !== `dlancer_t_listener[${key}]` || Math.abs(listener.triggerInterval - .1) > 1e-7
      || listener.waitFirstTriggerInterval !== 0 || listener.isSilenceable !== 0) return false;
  }
  if (rush._buffs[3].buffKey !== 'dlancer_t_predelay' || rush._buffs[3].durationKey !== 'predelay'
    || rush._buffs[3].lifeTimeType !== 1 || rush._buffs[3].lifeTime !== 0
    || rush._buffs[3].isFreezable !== 0 || rush._buffs[3].isStunnable !== 0 || rush._buffs[3].isSilenceable !== 0) return false;
  const a = event(nat, 'dlancer_t_listener[a]', 'ON_BUFF_TRIGGER'), b = event(nat, 'dlancer_t_listener[b]', 'ON_BUFF_TRIGGER');
  for (const [actions, flag] of [[a, 'STUNNED'], [b, 'UNMOVABLE']])
    if (actions?.length !== 2 || !node(actions[0], 'CheckAbnormalFlag') || actions[0]._abnormalFlag !== flag
      || actions[0]._isUnset !== false || !node(actions[1], 'FinishBuffsById') || actions[1]._buffKey !== 'dlancer_t[trigger]') return false;
  const c = event(nat, 'dlancer_t_listener[c]', 'ON_BUFF_TRIGGER');
  if (c?.length !== 5 || !node(c[0], 'CheckBlocked') || !node(c[1], 'IfNot') || !node(c[2], 'CheckContainsBuff')
    || c[2]._buffKeys?.join() !== 'dlancer_t[trigger]' || !node(c[3], 'IfNot') || !node(c[4], 'CreateBuff')
    || c[4]._buff?.templateKey !== 'dlancer_t[trigger]') return false;
  const trigger = event(nat, 'dlancer_t[trigger]', 'ON_BUFF_TRIGGER'), modifier = trigger?.[2]?._buff?.attributes?.attributeModifiers;
  if (trigger?.length !== 3 || !node(trigger[0], 'CheckContainsBuff') || trigger[0]._buffKeys?.join() !== 'dlancer_t_predelay'
    || !node(trigger[1], 'IfNot') || !node(trigger[2], 'CreateBuff') || trigger[2]._buff?.buffKey !== 'dlancer_t[core]'
    || trigger[2]._buff.overrideType !== 'STACK' || modifier?.length !== 1
    || modifier[0].attributeType !== 'MOVE_SPEED' || modifier[0].formulaItem !== 'MULTIPLIER' || !modifier[0].loadFromBlackboard) return false;
  const hit = event(nat, 'dlancer_t_atk', 'ON_BUFF_FINISH');
  return hit?.length === 4 && node(hit[0], 'CheckContainsBuff') && hit[0]._buffKeys?.join() === 'dlancer_t[trigger]'
    && node(hit[1], 'DamageViaAttr') && hit[1]._attributeType === 'MOVE_SPEED' && hit[1]._blackboardKey === 'atk_scale'
    && hit[1]._damageType === 'PHYSICAL' && hit[1]._applyWay === 'MELEE' && hit[1]._ignoreForSp === true
    && hit[1]._attackType === 'NORMAL' && node(hit[2], 'AlwaysNext') && node(hit[3], 'FinishBuffsById')
    && hit[3]._buffKey === 'dlancer_t[trigger]';
}
export const CHARGE_ENEMY_FEATURES = Object.freeze({
  'talent:rush': { covers: lancer,
    stageOverrides: { 'rush.dlancer_t[trigger].trig_cnt': value => Number.isInteger(value) && value > 0 },
    stageInjectedParameters: { 'rush.dlancer_t_predelay.predelay': { type: 'number', validate: value => Number.isFinite(value) && value >= 0 } },
    ability: { kind: 'lancerCharge', params: r => ({ increase: r.talents.bb['rush.dlancer_t[trigger].move_speed'],
      interval: r.talents.bb['rush.dlancer_t[trigger].interval'], limit: r.talents.bb['rush.dlancer_t[trigger].trig_cnt'],
      damagePerSpeed: r.talents.bb['firstattack.atk_scale'], predelay: r.talents.bb['rush.dlancer_t_predelay.predelay'] ?? 0 }) },
    explains: /^Gradually accelerates when moving, and deals additional damage on the first attack after being blocked based upon Movement Speed\.$/,
    note: 'Unblocked acceleration with source control resets; one separate current-speed damage packet after contact.',
  },
  'talent:firstattack': { covers: lancer,
    stageMultipliers: { 'firstattack.atk_scale': value => Number.isFinite(value) && value >= 0 },
    note: 'The rush feature implements this linked first-hit payload once.' },
});
