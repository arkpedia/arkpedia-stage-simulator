// SPDX-License-Identifier: GPL-3.0-or-later
import {isPatriot,patriotNative} from './enemy-patriot-features.js';
const warriorLine = 'When coming into contact with a Pulse Wave, this unit instead takes no damage and will deal Arts damage with normal attacks.';
const casterLine = 'When coming into contact with a Pulse Wave, this unit instead takes no damage and their attack range expands';
const spellLine = "Casts Arts periodically, dealing Arts damage equivalent to unit's ATK to all surrounding units";
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const empty = a => a && Object.values(a).every(v => Array.isArray(v) && !v.length);
function passive(c, keys, nat) {
  return c?.m_Script?.m_PathID === '3800760148018415462' && zero(c._selector)
    && c._buffs?.length === keys.length && c._buffs.every((b, i) => b.buffKey === keys[i]
      && b.templateKey === 'empty' && nat.$template('empty') && !Object.keys(nat.$template('empty').eventToActions).length
      && b.loadFromDB === 0 && b.lifeTimeType === 2 && b.isSilenceable === 0
      && b.blackboard?.length === 0 && empty(b.attributes));
}
function modes(r, n, caster) {
  const root = n[r.prefabKey]?.[0], ms = root?._modes?.map(x => n.$ref(x));
  if (Object.keys(r.talents.bb).length || ms?.length !== 2 || ms.some(m => !m)
    || root._commonAbilities?.length !== 1 || !passive(n.$ref(root._commonAbilities[0]), ['ore_immune'], n)) return null;
  const prefix = caster ? 'sotiwz' : 'sotidm';
  if (ms[1]._generalAbilities?.length !== 1 || !passive(n.$ref(ms[1]._generalAbilities[0]), [prefix + '_effect', prefix + '_effect[eye]'], n)) return null;
  if (caster ? ms[0]._generalAbilities?.length !== 0
    : ms[0]._generalAbilities?.length !== 1 || !passive(n.$ref(ms[0]._generalAbilities[0]), ['ore_listener'], n)) return null;
  return ms;
}
function warrior(r, n) {
  if (!/^enemy_1084_sotidm(?:_[23])?$/.test(r.prefabKey) || r.skills.length || r.applyWay !== 'MELEE') return false;
  const ms = modes(r, n, false);
  return !!ms && ms.every((m, i) => {
    const c = n.$ref(m._combat);
    return zero(m._attack) && zero(m._attackTrigger) && c?._damageType === i + 1 && c._atkScale === 1
      && c._attackType === 1 && c._timeMode === 0 && c._activeBuffs?.length === 0
      && c._animKey === 'Attack' && c._waitForAttackEvent === 1 && zero(c._selector);
  });
}
function caster(r, n) {
  if (!/^enemy_1085_sotiwz(?:_[23])?$/.test(r.prefabKey) || r.skills.length !== 2 || r.stats.bat !== 5) return false;
  const ms = modes(r, n, true);
  if (!ms || !ms.every(m => {
    const c = n.$ref(m._combat), a = n.$ref(m._attack);
    return c?.m_Script?.m_PathID === '8145049199648393782' && c._activeBuffs?.length === 0 && c._animKey === ''
      && a?._atkScale === 0 && a._activeBuffs?.length === 0 && a._animKey === '' && zero(a._selector);
  })) return false;
  const trigger = n.Trigger?.[0], buffs = trigger?._buffs, reset = buffs?.[1];
  if (n.Trigger?.length !== 1 || !passive({ ...trigger, _buffs: buffs?.slice(0, 1) }, ['ore_listener'], n)
    || buffs?.length !== 2 || reset.buffKey !== 'sotiwz_reset_base_attack_time' || reset.templateKey !== 'empty'
    || reset.isSilenceable !== 0 || reset.lifeTimeType !== 2 || reset.loadFromDB !== 0
    || reset.blackboard?.length !== 1 || reset.blackboard[0].key !== 'base_attack_time'
    || Math.abs(reset.blackboard[0].value + 4.9) > 1e-6
    || !Object.entries(reset.attributes ?? {}).every(([key, entries]) => key === 'attributeModifiers'
      ? entries.length === 1 && entries[0].attributeType === 8 && entries[0].formulaItem === 0 && entries[0].loadFromBlackboard === 1
      : entries.length === 0)) return false;
  return ['Immo', 'Immo[Rage]'].every((key, i) => {
    const s = r.skills.find(s => s.prefabKey === key), rows = n[key] ?? [], c = rows.find(c => '_activeBuffs' in c), w = rows.find(c => '_familyMask' in c);
    const selector = n.$ref(c?._selector), siblings = n.$siblings(c?._selector), circle = siblings.find(c => 'm_Radius' in c), transform = siblings.find(c => 'm_LocalScale' in c);
    return s?.cooldown === 5 && s.initCooldown === 0 && s.spCost === 0 && Object.keys(s.bb).join() === 'atk_scale' && s.bb.atk_scale === 1
      && rows.length === 2 && w?._familyMask === 3 && w._ignoreSilence === 1 - i && w._castLikeAttack === 0
      && w._maxTriggerTime === -1 && w._overwriteInitCooldown === -1 && w._resetMainAbilityCdWhenCastEnd === 0
      && n.$ref(w._trigger)?.m_Script?.m_PathID === '-2995189732062982133'
      && c?._damageType === 2 && c._atkScale === 1 && c._attackType === 2 && c._timeMode === 2 && c._affectedBySlowDown === 0
      && c._animKey === '' && c._activeBuffs?.length === 0 && c._alwaysIncludeTarget === 0 && c._selectTargetSource === 1
      && selector?._targetMotion === 1 && selector._targetSide === 2 && selector._ignoreTargetFree === 0 && selector._limitTargetNum === 0
      && selector._abnormalCombo === 2 && selector._abnormalFlag === 42 && selector._excludeAbnormalFlag === 46 && selector._postFilter === 0
      && circle?.m_Radius === 1.5 + i && circle.m_Offset.x === 0 && circle.m_Offset.y === 0
      && transform && Object.values(transform.m_LocalScale).every(v => v === 1) && Object.values(transform.m_LocalPosition).every(v => v === 0);
  });
}
export const PULSE_ENEMY_FEATURES = Object.freeze({
  [`ability:${warriorLine}`]: { covers: warrior, ability: { kind: 'pulseCharged', params: () => ({}) },
    nativeClaim: () => ({ active: 3 }), note: 'Physical melee becomes Arts after a pulse; immune to pulse damage.' },
  'skill:Immo': { covers: caster, ability: { kind: 'pulseCaster', params: () => ({ cooldown: 5, radius: 1.5, chargedRadius: 2.5 }) },
    nativeClaim: () => ({ wrappers: 2, active: 2 }), explains: text => [casterLine, spellLine].includes(text),
    note: 'Ground-only periodic Arts splash; pulse changes mode and expands the original circle.' },
  'skill:Immo[Rage]': { covers: (r, n) => isPatriot(r) ? patriotNative(r, n) : caster(r, n), note: 'Charged mode of the shared periodic spell, or Patriot\'s Sacrifice (talent:immo_trigger[rage]).' },
});
