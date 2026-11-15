// SPDX-License-Identifier: GPL-3.0-or-later
const sig = 'cchmpn_t_buff_blocker.def,cchmpn_t_buff_self.damage_scale,cchmpn_t_buff_self.def,cchmpn_t_buff_self.taunt_level';
const modifier = (m, attributeType, formulaItem) => m?.attributeType === attributeType && m.formulaItem === formulaItem
  && m.loadFromBlackboard === 1 && m.fetchBaseValueFromSourceEntity === 0;
function duel(r, nat) {
  if (!['enemy_1098_cchmpn', 'enemy_1098_cchmpn_2'].includes(r.prefabKey) || r.applyWay !== 'MELEE'
    || r.skills.length || r.talents.groups.duel?.join() !== sig) return false;
  const bb = r.talents.bb, rows = nat.duel ?? [], toggle = rows.find(c => '_checker' in c), checker = nat.$ref?.(toggle?._checker);
  const own = toggle?._buffs?.[0], foe = checker?._buffsToBlockee?.[0];
  const actions = nat.$template?.('enemy_cchmpn_t')?.eventToActions?.ON_TAKE_DAMAGE;
  return bb['duel.cchmpn_t_buff_self.def'] === -.7 && bb['duel.cchmpn_t_buff_blocker.def'] === -.7
    && bb['duel.cchmpn_t_buff_self.damage_scale'] === 0 && bb['duel.cchmpn_t_buff_self.taunt_level'] === -1
    && toggle?._isInverseToggle === 0 && toggle._buffs.length === 1 && toggle._buffsWhenToggleOff?.length === 0
    && toggle._unmanagedBuffsWhenToggleOn?.length === 0
    && checker?._blockMinCnt === 1 && checker._blockMaxCnt === -1 && checker._useBlockAsMin === 1
    && checker._buffsToBlockee.length === 1
    && own.buffKey === 'cchmpn_t_buff_self' && own.templateKey === 'enemy_cchmpn_t'
    && own.isSilenceable === 1 && own.disableOverride === 0 && own.lifeTimeType === 2
    && own.attributes.attributeModifiers.length === 2
    && modifier(own.attributes.attributeModifiers[0], 2, 3) && modifier(own.attributes.attributeModifiers[1], 20, 0)
    && foe.buffKey === 'cchmpn_t_buff_blocker' && foe.templateKey === 'empty'
    && foe.isSilenceable === 0 && foe.disableOverride === 0 && foe.independentCharacterSource === 0
    && foe.lifeTimeType === 2 && foe.attributes.attributeModifiers.length === 1
    && modifier(foe.attributes.attributeModifiers[0], 2, 3)
    && actions?.length === 3 && actions[0]._checkBlockedBySource === true && actions[0]._checkBlockedBySourceToken === false
    && actions[0]._sourceType === 'MODIFIER_SOURCE' && actions[0]._targetType === 'BUFF_OWNER'
    && actions[1].$type === 'Torappu.Battle.Action.Nodes+IfNot, Assembly-CSharp'
    && actions[2].$type === 'Torappu.Battle.Action.Nodes+DamageScale, Assembly-CSharp'
    && actions[2]._filterDamageType === false && actions[2]._filterApplyWay === false && actions[2]._isOneMinus === false;
}
export const DUEL_ENEMY_FEATURES = Object.freeze({
  'talent:duel': {
    covers: duel,
    ability: { kind: 'blockedDuel', params: r => ({ selfDef: r.talents.bb['duel.cchmpn_t_buff_self.def'],
      blockerDef: r.talents.bb['duel.cchmpn_t_buff_blocker.def'], taunt: r.talents.bb['duel.cchmpn_t_buff_self.taunt_level'],
      otherDamage: r.talents.bb['duel.cchmpn_t_buff_self.damage_scale'] }) },
    explains: /^When blocked, this unit will only receive damage from the unit blocking it, and the DEF of both units is decreased\.$/,
    note: 'Block ownership, shared nonstacking blocker DEF penalty, silenceable self DEF/taunt and damage-source exclusion.',
  },
});
