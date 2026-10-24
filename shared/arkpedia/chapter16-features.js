// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 16 candidates are exact-record families. Native source availability
// alone never clears their support gate.
import reviewed from '../../data/candidates/arkpedia-ch17-reviewed-contracts.json' with { type: 'json' };
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
  ...chapter17Features(),
};

function coversChapter17(r, n) {
  const proof = reviewed.enemies[r.key];
  return !!proof && JSON.stringify(n.$actions?.()) === JSON.stringify(reviewed.actions) && r.prefabKey === r.key
    && JSON.stringify(r.talents.groups) === JSON.stringify(proof.groups)
    && JSON.stringify(r.abilities.map(a => a.text)) === JSON.stringify(proof.abilities)
    && JSON.stringify(r.skills.map(s => ({ prefabKey: s.prefabKey, bb: Object.keys(s.bb).sort() }))) === JSON.stringify(proof.skills)
    && Object.keys(r.talents.bb).sort().join('|') === Object.entries(proof.groups).flatMap(([g, ps]) => ps.map(p => `${g}.${p}`)).sort().join('|')
    && Object.values(r.talents.bb).every(Number.isFinite) && r.skills.every(s => Object.values(s.bb).every(Number.isFinite)
      && [s.cooldown, s.initCooldown, s.spCost].every(v => Number.isFinite(v) && v >= 0))
    && (r.key !== 'enemy_10210_muwiz' || r.talents.bb['Shiled.hp_ratio'] > 0 && r.skills.find(s => s.prefabKey === 'GetShield').bb.dynamic_add > 0)
    && (r.key !== 'enemy_10211_murad' || r.sp?.type === 'INCREASE_WITH_TIME' && [r.sp.increment, r.sp.initSp, r.sp.maxSp].every(Number.isFinite)
      && r.skills.filter(s => /RoundLaser$/.test(s.prefabKey)).every(s => s.bb.projectileNum >= 2))
    && JSON.stringify(n.$retained?.()) === JSON.stringify(proof.native);
}
function chapter17Features() {
  const out = {};
  const anchors = {
    enemy_10203_mumag: ['skill:ChargeRift', 'ch16ChargeRift'],
    enemy_10206_muveg: ['talent:ReverseDamage', 'ch16ReverseDamage'],
    enemy_10208_mucow: ['talent:DeadSummon', 'ch16DeadSummon'],
    enemy_10210_muwiz: ['talent:Shiled', 'ch16WarCaster'],
    enemy_10211_murad: ['talent:CheckAppear', 'ch16LeakSource'],
  };
  for (const [key, proof] of Object.entries(reviewed.enemies)) {
    const [anchor, kind] = anchors[key];
    for (const id of [...Object.keys(proof.groups).map(g => `talent:${g}`), ...proof.skills.map(s => `skill:${s.prefabKey}`)]) {
      // No two reviewed records share these skill/talent names except the
      // MuradPollut group; the covers predicate still checks the entire record.
      out[id] = { covers: coversChapter17, note: 'Exact retained native contract and implemented chapter 17 controller.' };
    }
    Object.assign(out[anchor], { ability: r => r.key === key ? { kind, params: () => r } : null,
      explains: (text, r) => r.key === key && proof.abilities.includes(text),
      nativeClaim: (p, n) => JSON.stringify(n.$retained?.()) === JSON.stringify(proof.native)
        ? { wrappers: proof.counts.enemyAbilityWrappers, active: proof.counts.activeGeneralOrCommonAbilities } : null,
      ...(key === 'enemy_10208_mucow' ? { dependsOn: () => ['enemy_10211_murad'] } : {}) });
  }
  return out;
}
