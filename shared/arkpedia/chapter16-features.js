// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 16 candidates are exact-record families. Native source availability
// alone never clears their support gate.
const MINER_TEXT = "Allied unit; recovers HP when within any Medic Operator's Attack Range";
const groups = { TileEscapeShadowManager: ['times'], GetHeal: ['heal_scale'], FearLoseBlood: ['value'] };
function minerCovered(r, n) {
  return r.prefabKey === 'enemy_3010_mcreep' && JSON.stringify(r.talents.groups) === JSON.stringify(groups)
    && r.skills.length === 0 && r.abilities.length === 1 && r.abilities[0].text === MINER_TEXT
    && r.notCountInTotal && r.stats.lpr === 0
    && n.GetHeal?.length === 1 && n.GetHeal[0]._buffs?.[0]?.triggerInterval === 1
    && n.GetHeal[0]._buffs.length === 1 && n.GetHeal[0]._buffs[0].templateKey === 'mcreep_t[get_heal]'
    && n.$ref(n.GetHeal[0]._targetValidator)?._targetOptions?.professionMask === 8
    && n.$ref(n.GetHeal[0]._targetValidator)?._targetOptions?.targetSide === 7
    && n.FearLoseBlood?.[0]?._buffs?.[0]?.templateKey === 'mcreep_t[fear_listener]'
    && Math.abs(n.FearLoseBlood[0]._buffs[0].triggerInterval - 0.3) < 1e-7
    && n.TileEscapeShadowManager?.[0]?._buffs?.[0]?.templateKey === 'mcreep_t[work_espace_shadow]'
    && JSON.stringify(n.Passive?.[0]?._buffs?.map(b => b.buffKey)) === JSON.stringify([
      'enemy_mcreep_self_mark', 'enemy_mcreep_able_to_be_blocked', 'mark_neutral[effect]', 'mcreep_a[reach_exit]'])
    && n.Default?.[0]?._generalAbilities?.length === 1
    && n.$ref(n.Default?.[0]?._generalAbilities?.[0]) === n.Passive[0];
}
const miner = { covers: minerCovered, ability: { kind: 'ch16Miner', params: r => r },
  nativeClaim: (p, n) => n.Passive?.length === 1 ? { active: 1 } : null,
  explains: text => text === MINER_TEXT, note: 'Neutral miner: Medic range healing, fear blood loss and shadow suppression.' };
export const CHAPTER16_FEATURES = {
  'talent:GetHeal': miner,
  'talent:TileEscapeShadowManager': { covers: minerCovered, note: 'Included in GetHeal controller.' },
  'talent:FearLoseBlood': { covers: minerCovered, note: 'Included in GetHeal controller.' },
  // Keep map-bound candidates refused until their environment integration and
  // native parity tests are complete. The runtime factories remain testable.
  'skill:ChargeRift': { covers: () => false, ability: { kind: 'ch16ChargeRift', params: r => r } },
  'talent:ReverseDamage': { covers: () => false, ability: { kind: 'ch16ReverseDamage', params: r => r } },
  'talent:DeadSummon': { covers: () => false, ability: { kind: 'ch16DeadSummon', params: r => r } },
  'talent:Shiled': { covers: () => false, ability: { kind: 'ch16WarCaster', params: r => r } },
  'talent:CheckAppear': { covers: () => false, ability: { kind: 'ch16LeakSource', params: r => r } },
};
