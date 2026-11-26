// SPDX-License-Identifier: GPL-3.0-or-later
// Modules worn by a stage's preset operators (`uniEquipIds` on a predefined character). Player loadouts have no
// modules; only a module reviewed here, at its reviewed stage, is accepted. Compile-time only.
//
// Logos, CCR-Δ `uniequip_002_logos` stage 3 (14-11, 14-20). Reviewed from the Global table rows and the pinned CN
// client's `[uc]equips.ab` prefabs and buff templates (data/arkpedia-predefined-module-source.json):
// - Attributes: +170 max HP, +67 ATK.
// - Trait part `logos_equip_1_3_p1` (hidden talent key `10`, `ep_damage_ratio` 0.08) attaches `logos_e_002_tr` for life:
//   after Logos outputs MAGICAL damage, the damaged unit takes Necrosis (DARK) element injury equal to the damage
//   value x 0.08 (`_isFixedEpDamage`, the fixed scale key is empty, so the ratio applies once).
// - Talent part `logos_equip_1_3_p2` (talent key `11_root`, talent index 0) replaces Lexical Evolution's buff
//   `logos_t_1` with the template `logos_e_002_t_1`: the same extra shot (probability 0.6, Arts ATK x0.6, or x0.65 from
//   Potential 5; Slow 0.8 s), and, when the shot's target is in its Necrosis burst (`IsTargetInEPBreakRecovery` DARK),
//   Elemental damage of ATK x0.6 after the Arts damage.
import source from '../../data/arkpedia-predefined-module-source.json' with { type: 'json' };

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const type = action => String(action?.$type ?? '').replace('Torappu.Battle.Action.Nodes+', '').replace(', Assembly-CSharp', '');
const pairs = rows => (rows ?? []).map(x => [x.key, x.value]);
export const LOGOS = 'char_4133_logos', LOGOS_MODULE = 'uniequip_002_logos';

export function logosModuleReviewed(e = source) {
  const module = e.modules?.[LOGOS_MODULE], equip = module?.equip, phases = module?.battle?.phases ?? [], phase = phases[2];
  const [display, hidden, talent] = phase?.parts ?? [];
  const trait = display?.overrideTraitDataBundle?.candidates, h = hidden?.addOrOverrideTalentDataBundle?.candidates;
  const t = talent?.addOrOverrideTalentDataBundle?.candidates;
  const unlocked = c => c?.unlockCondition?.phase === 'PHASE_2' && c.unlockCondition.level === 60;
  const part = key => e.prefabs?.[key]?.components?.map(c => c.data) ?? [];
  const p1 = part('logos_equip_1_3_p1'), p2 = part('logos_equip_1_3_p2');
  const key = rows => rows.find(c => '_overwriteTalentKey' in c)?._overwriteTalentKey;
  const buffs = rows => rows.find(c => '_buffs' in c)?._buffs ?? [];
  const tr = e.templates?.logos_e_002_tr?.eventToActions, tt = e.templates?.logos_e_002_t_1?.eventToActions;
  const after = tr?.ON_AFTER_OUTPUT_DAMAGE ?? [], cast = tt?.ON_ABILITY_CAST_ON_TARGET ?? [];
  const shot = cast[2], hit = shot?._actions ?? [];
  return equip?.charId === LOGOS && equip.type === 'ADVANCED' && equip.typeIcon === 'ccr-d' && equip.tmplId == null
    && equip.unlockEvolvePhase === 'PHASE_2' && equip.unlockLevel === 60
    && phases.length === 3 && phase.equipLevel === 3 && phase.parts.length === 3
    && same(pairs(phase.attributeBlackboard), [['max_hp', 170], ['atk', 67]]) && same(phase.tokenAttributeBlackboard, {})
    && display.target === 'DISPLAY' && display.isToken === false && display.addOrOverrideTalentDataBundle.candidates == null
    && trait?.length === 1 && unlocked(trait[0]) && trait[0].requiredPotentialRank === 0 && same(trait[0].blackboard, [])
    && trait[0].rangeId == null && trait[0].prefabKey == null && trait[0].overrideDescripton == null
    && hidden.target === 'TALENT' && hidden.isToken === false && hidden.resKey === 'logos_equip_1_3_p1'
    && hidden.overrideTraitDataBundle.candidates == null && h?.length === 1 && unlocked(h[0]) && h[0].requiredPotentialRank === 0
    && h[0].talentIndex === -1 && h[0].prefabKey === '10' && h[0].isHideTalent === true && h[0].rangeId == null && h[0].tokenKey == null
    && same(pairs(h[0].blackboard), [['ep_damage_ratio', .08]])
    && talent.target === 'TALENT' && talent.isToken === false && talent.resKey === 'logos_equip_1_3_p2'
    && talent.overrideTraitDataBundle.candidates == null && t?.length === 2
    && t.every(c => unlocked(c) && c.talentIndex === 0 && c.prefabKey === '11_root' && c.isHideTalent === false && c.rangeId == null
      && c.tokenKey == null && c.name === 'Lexical Evolution')
    && same(t.map(c => c.requiredPotentialRank), [0, 4])
    && same(pairs(t[0].blackboard), [['prob', .6], ['atk_scale', .6], ['sluggish', .8], ['element_atk_scale', .6]])
    && same(pairs(t[1].blackboard), [['prob', .6], ['atk_scale', .65], ['sluggish', .8], ['element_atk_scale', .6]])
    && [display, hidden, talent].every(p => p.validInGameTag == null && p.validInMapTag == null)
    // Prefabs: each part overwrites one talent key with one buff held for life.
    && key(p1) === '10' && buffs(p1).length === 1 && buffs(p1)[0].buffKey === 'logos_e_002_tr'
    && buffs(p1)[0].templateKey === 'logos_e_002_tr' && buffs(p1)[0].lifeTimeType === 2 && same(buffs(p1)[0].blackboard, [])
    && key(p2) === '11_root' && buffs(p2).length === 1 && buffs(p2)[0].buffKey === 'logos_t_1'
    && buffs(p2)[0].templateKey === 'logos_e_002_t_1' && buffs(p2)[0].lifeTimeType === 2
    && same(buffs(p2)[0].blackboard.map(x => [x.key, x.valueStr]), [['ability_name', 'LogosT1Attack'], ['projectile', 'projectile_chr_logos_t']])
    // Trait template: Arts damage output -> fixed Necrosis injury of the damage value x ep_damage_ratio.
    && same(Object.keys(tr ?? {}), ['ON_AFTER_OUTPUT_DAMAGE'])
    && same(after.map(type), ['IsBlackboardZero', 'IfNot', 'FilterDamageModifer', 'AssignDamageValueToBlackboard',
      'CalculateBlackboardValueViaParams', 'ApplyElementDamage'])
    && after[0]._var === 'ep_damage_ratio'
    && after[2]._filterDamageType === true && after[2]._damageMask === 'MAGICAL' && after[2]._filterAttackType === false
    && after[2]._filterModifierSource === false && after[2]._filterApplyWay === false && after[2]._filterSharedMask === false
    && after[3]._owner === 'MODIFIER_TARGET' && after[3]._assignValueWithoutCalculate === true && after[3]._assignRealDelta === false
    && after[4]._inputKey === 'value' && after[4]._outputKey === 'value' && after[4]._multiplyParamKey === 'ep_damage_ratio'
    && after[4]._dividedParamKey == null && after[4]._addParamKey == null && after[4]._minusParamKey == null && after[4]._finalAbs === true
    && after[5]._elementDamageType === 'DARK' && after[5]._sourceType === 'BUFF_OWNER' && after[5]._targetType === 'MODIFIER_TARGET'
    && after[5]._isFixedEpDamage === true && after[5]._fixedEpDamageKey === 'value' && after[5]._fixedEpDamageScale === ''
    && after[5]._noSource === false && after[5]._isEnvElementDamage === false
    // Talent template: the extra shot, then Elemental damage while the target's Necrosis burst runs.
    && same(Object.keys(tt ?? {}), ['ON_ABILITY_CAST_ON_TARGET', 'ON_BUFF_TRIGGER'])
    && same(cast.map(type), ['FilterAbilityFamily', 'Dice', 'EmitProjectileUseAbilitySelector'])
    && same(tt.ON_BUFF_TRIGGER, cast.slice(1))
    && cast[0]._familyGroupMask === 'ATTACK' && cast[1]._probKey === 'prob'
    && shot._ev === 'ON_HIT_OBJECT' && shot._emitCount === 1 && shot._cacheAtkToActions === true && shot._excludeTarget === false
    && same(shot._buffDataList.map(b => [b.buffKey, b.loadFromDB]), [['sluggish', true]])
    && same(hit.map(type), ['AdvancedApplyDamage', 'IsTargetInEPBreakRecovery', 'AdvancedApplyDamage'])
    && hit[0]._damageType === 'MAGICAL' && hit[0]._atkScaleVar === 'atk_scale' && hit[0]._applyWay === 'NONE'
    && hit[1]._target === 'TARGET' && hit[1]._checkRecoveryType === true && hit[1]._elementType === 'DARK'
    && hit[2]._damageType === 'ELEMENT' && hit[2]._atkScaleVar === 'element_atk_scale' && hit[2]._applyWay === 'NONE'
    && hit[2]._sourceType === 'SOURCE' && hit[2]._targetType === 'TARGET' && hit[2]._noSource === false;
}

/** The reviewed module of a preset operator, or an error. `module` is `{ id, stage }`; `build` is the operator's build.
 * The stage compiler stores the result on the preset entry; the battle applies it with predefined-module-record.js and
 * never imports this file or its source data. */
export function predefinedModuleDefinition(module, build) {
  if (!module || module.id !== LOGOS_MODULE || module.stage !== 3 || build?.id !== LOGOS || build.elite !== 2
    || !(build.level >= 60) || !Number.isSafeInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !logosModuleReviewed()) throw Error(`Unsupported predefined operator module: ${module?.id}`);
  const phase = source.modules[LOGOS_MODULE].battle.phases[2];
  const candidate = phase.parts[2].addOrOverrideTalentDataBundle.candidates.findLast(c => build.potential - 1 >= c.requiredPotentialRank);
  return { id: LOGOS_MODULE, stage: 3, operator: LOGOS, name: source.modules[LOGOS_MODULE].equip.uniEquipName,
    stats: { maxHp: 170, atk: 67 }, epDamageRatio: .08, element: 'apoptosis',
    trait: phase.parts[0].overrideTraitDataBundle.candidates[0].additionalDescription,
    talent: { index: 0, name: candidate.name, description: candidate.upgradeDescription, blackboard: candidate.blackboard,
      bb: Object.fromEntries(pairs(candidate.blackboard)) } };
}
