// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 16 candidates are exact-record families. Native source availability
// alone never clears their support gate.
import reviewed from '../../data/candidates/arkpedia-ch17-reviewed-contracts.json' with { type: 'json' };
import crossbowReview from '../../data/candidates/arkpedia-ch16-reviewed-crossbow.json' with { type: 'json' };
import reactionReview from '../../data/candidates/arkpedia-ch17-reviewed-reactions.json' with { type: 'json' };
import rockbreakerReview from '../../data/candidates/arkpedia-ch17-rockbreaker-contract.json' with { type: 'json' };
import shieldguardReview from '../../data/candidates/arkpedia-ch16-reviewed-shieldguard.json' with { type: 'json' };
import artilleryReview from '../../data/candidates/arkpedia-ch16-reviewed-artillery.json' with { type: 'json' };
import commanderReview from '../../data/candidates/arkpedia-ch16-reviewed-commander.json' with { type: 'json' };
import fortbreakerReview from '../../data/candidates/arkpedia-ch16-reviewed-fortbreaker.json' with { type: 'json' };
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
function familyCovered(review, family, r, n) {
  const proof = review.enemies[r.key];
  return review.testOnly === true && !!proof && r.prefabKey === r.key
    && n.$familyEvidence?.(family) === review.sources.graph.sha256
    && JSON.stringify(r.talents.groups) === JSON.stringify(proof.groups)
    && JSON.stringify(r.talents.bb) === JSON.stringify(proof.bb)
    && JSON.stringify(r.abilities) === JSON.stringify(proof.abilities)
    && JSON.stringify(r.skills) === JSON.stringify(proof.skills)
    && JSON.stringify(n.$retained?.()) === JSON.stringify(proof.native);
}
export const commanderCovered = (r, n) => familyCovered(commanderReview, 'commander', r, n);
export const fortbreakerCovered = (r, n) => familyCovered(fortbreakerReview, 'fortbreaker', r, n);
export const shieldguardCovered = (r, n) => familyCovered(shieldguardReview, 'shieldguard', r, n);
function familyFeature(review, family, kind) {
  return {
    covers: (r, n) => familyCovered(review, family, r, n),
    ability: r => review.enemies[r.key] ? { kind, params: () => r } : null,
    explains: (text, r) => review.enemies[r.key]?.abilities.some(a => a.text === text),
    nativeClaim: (p, n) => {
      const proof = Object.values(review.enemies).find(p => JSON.stringify(n.$retained?.()) === JSON.stringify(p.native));
      return proof ? { wrappers: proof.counts.enemyAbilityWrappers, active: proof.counts.activeGeneralOrCommonAbilities } : null;
    },
    note: 'Source-bound experimental controller; captured native frame/render parity held.',
  };
}
export const CHAPTER16_FEATURES = {
  'ability:Gives <@eb.key>orders</> to Army enemies on the field': familyFeature(commanderReview, 'commander', 'ch16Commander'),
  'skill:SkyProjectile': familyFeature(fortbreakerReview, 'fortbreaker', 'ch16Fortbreaker'),
  'talent:ExtraPower': familyFeature(shieldguardReview, 'shieldguard', 'ch16Shieldguard'),
  'talent:ProjectileBoomRange': familyFeature(artilleryReview, 'artillery', 'ch16LightArtillery'),
  'skill:SummonSelf': {
    covers: (r, n) => {
      const proof = rockbreakerReview.enemies[r.key];
      return rockbreakerReview.testOnly === true && !!proof && r.prefabKey === r.key
        && n.$familyEvidence?.('rockbreaker') === rockbreakerReview.sources.graph.sha256
        && JSON.stringify(r.talents.groups) === JSON.stringify(proof.groups)
        && JSON.stringify(r.talents.bb) === JSON.stringify(proof.bb)
        && JSON.stringify(r.abilities) === JSON.stringify(proof.abilities)
        && JSON.stringify(r.skills) === JSON.stringify(proof.skills)
        && JSON.stringify(n.$retained?.()) === JSON.stringify(proof.native);
    },
    ability: r => rockbreakerReview.enemies[r.key] ? { kind: 'ch17Rockbreaker', params: () => r } : null,
    explains: (text, r) => rockbreakerReview.enemies[r.key]?.abilities.some(a => a.text === text),
    dependsOn: r => rockbreakerReview.enemies[r.key] ? [r.key] : [],
    nativeClaim: (p, n) => {
      const proof = Object.values(rockbreakerReview.enemies).find(p => JSON.stringify(n.$retained?.()) === JSON.stringify(p.native));
      return proof ? { wrappers: proof.counts.enemyAbilityWrappers, active: proof.counts.activeGeneralOrCommonAbilities } : null;
    },
    note: 'Experimental native-event split; forced-control and placement conventions remain candidate limits.',
  },
  'talent:ExtraPowerListener': {
    covers: (r, n) => {
      const proof = crossbowReview.enemies[r.key];
      return crossbowReview.testOnly === true && !!proof && r.prefabKey === r.key
        && n.$familyEvidence?.('crossbow') === crossbowReview.sources.graph.sha256
        && JSON.stringify(r.talents.groups) === JSON.stringify(proof.groups)
        && JSON.stringify(r.talents.bb) === JSON.stringify(proof.bb)
        && JSON.stringify(r.abilities) === JSON.stringify(proof.abilities)
        && JSON.stringify(r.skills) === JSON.stringify(proof.skills)
        && JSON.stringify(n.$retained?.()) === JSON.stringify(proof.native);
    },
    ability: r => crossbowReview.enemies[r.key] ? { kind: 'ch16MobileCrossbow', params: () => r } : null,
    explains: (text, r) => crossbowReview.enemies[r.key]?.abilities.some(a => a.text === text),
    nativeClaim: (p, n) => {
      const proof = Object.values(crossbowReview.enemies).find(proof => JSON.stringify(n.$retained?.()) === JSON.stringify(proof.native));
      return proof ? { wrappers: proof.counts.enemyAbilityWrappers, active: proof.counts.activeGeneralOrCommonAbilities } : null;
    },
    note: 'Experimental crossbow candidate; center-distance radius model. Original collider-edge parity remains unverified.',
  },
  'talent:GetHeal': miner,
  'talent:TileEscapeShadowManager': { covers: minerCovered, note: 'Included in GetHeal controller.' },
  'talent:FearLoseBlood': { covers: minerCovered, note: 'Included in GetHeal controller.' },
  ...chapter17Features(),
  ...pollutionReactionFeatures(),
};

function pollutionReactionCovered(r, n) {
  const proof = reactionReview.enemies[r.key];
  return reactionReview.testOnly === true && !!proof && r.prefabKey === r.key
    && n.$familyEvidence?.('infantryBow') === reactionReview.sources.graph.sha256
    && JSON.stringify(r.talents.groups) === JSON.stringify(proof.groups)
    && JSON.stringify(r.talents.bb) === JSON.stringify(proof.bb)
    && JSON.stringify(r.abilities) === JSON.stringify(proof.abilities)
    && JSON.stringify(r.skills) === JSON.stringify(proof.skills)
    && JSON.stringify(n.$retained?.()) === JSON.stringify(proof.native);
}
function pollutionReactionFeatures() {
  const explains = (text, r) => reactionReview.enemies[r.key]?.abilities.some(a => a.text === text);
  const nativeClaim = (p, n) => {
    const proof = Object.values(reactionReview.enemies).find(proof => JSON.stringify(n.$retained?.()) === JSON.stringify(proof.native));
    return proof ? { wrappers: proof.counts.enemyAbilityWrappers, active: proof.counts.activeGeneralOrCommonAbilities } : null;
  };
  return {
    // This group also belongs to the previously reviewed Trimortalis. Its
    // ReverseDamage anchor retains that controller and its native claim.
    'talent:MuradPollut': {
      covers: (r, n) => coversChapter17(r, n) || pollutionReactionCovered(r, n),
      ability: r => reactionReview.enemies[r.key] && r.key.startsWith('enemy_10201_')
        ? { kind: 'ch17PollutionInfantry', params: () => r } : null,
      explains, nativeClaim, note: 'Exact native pollution reaction; infantry immediate heal, existing Trimortalis boost retained.',
    },
    'ability:Next attack deals Arts damage when affected by a <Leak Source>.': {
      covers: pollutionReactionCovered, ability: r => reactionReview.enemies[r.key]
        ? { kind: 'ch17PollutionBowman', params: () => r } : null,
      nativeClaim, note: 'Experimental bowman mode and cast-end cooldown reset; native animation duration unverified.',
    },
  };
}

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
