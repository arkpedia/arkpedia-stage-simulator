// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-mudrock-animations.json' with { type: 'json' };
const node = (a, name) => a?.$type === `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
export function mudrockNative(r, n) {
  if (r.prefabKey !== 'enemy_1511_mdrock' || ![0, 1].includes(r.level) || r.applyWay !== 'MELEE'
    || r.skills.length !== 2 || r.stats.dmgType !== 'phys') return false;
  const amount = r.level ? 6667 : 5500, cooldown = r.level ? 15 : 17;
  const expected = r.level ? { dynamic: amount, max_hp: .5, attack_speed: 50 }
    : { 'shield.dynamic': amount, 'shield.max_hp': .5, 'shield.attack_speed': 50 };
  expected['charge.attack@enemy_mdrock_s_1[charge].atk'] = .6;
  if (Object.keys(r.talents.bb).length !== 4 || Object.entries(expected).some(([k, v]) => r.talents.bb[k] !== v)) return false;
  const root = n[r.prefabKey]?.[0], clock = clocks.enemies[r.prefabKey];
  if (root?._modes.length !== 6 || root._commonAbilities.length !== 1 || !clock
    || n.$ref(n.$ref(root._animator)?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId) return false;
  for (const [i, ref] of root._modes.entries()) {
    const m = n.$ref(ref), c = n.$ref(m?._combat);
    if (!m || m._generalAbilities.length || n.$ref(m._attack) !== c || c?._animKey !== (i < 4 ? 'Attack_1' : 'Attack_2')
      || c._damageType !== 1 || c._atkScale !== 1 || c._timeMode !== 0 || c._waitForAttackEvent !== 1
      || c._activeBuffs[0]?.templateKey !== 'enemy_mdrock_s_1') return false;
  }
  const sleep = n.$ref(root._commonAbilities[0])?._buffs;
  if (sleep?.length !== 1 || sleep[0].templateKey !== 'empty' || sleep[0].isSilenceable !== 0
    || sleep[0].attributes.abnormalComboImmunes.join() !== '0') return false;
  for (const [i, name] of ['RefreshShield', 'Occupy'].entries()) {
    const s = r.skills[i], c = n[name]?.find(x => '_activeBuffs' in x), w = n[name]?.find(x => '_familyMask' in x);
    const immunity = n.$siblings(c).find(x => '_buffs' in x)?._buffs;
    if (s.prefabKey !== (i ? 'occupy' : name) || s.priority !== 1 - i || s.cooldown !== (i ? 35 : cooldown)
      || s.initCooldown !== s.cooldown || s.spCost !== 0 || w?._familyMask !== 3 || w._ignoreSilence !== 0
      || w._resetMainAbilityCdWhenCastEnd !== 0 || c?._waitForAttackEvent !== 1 || c._timeMode !== 1
      || c._affectedBySlowDown !== 1 || c._animKey !== (i ? 'Skill_1' : 'Skill_2') || c._selectTargetTiming !== 0
      || c._activeBuffs.length !== 1 || c._activeBuffs[0].templateKey !== (i ? 'tower_t_3[be_enemy_instant]' : 'enemy_mdrock_s_2[shield][refresh]')
      || immunity?.length !== 2 || immunity[0].attributes.abnormalFlags.join() !== '8'
      || immunity[1].attributes.abnormalImmunes.join() !== '0') return false;
  }
  const refresh = r.skills[0].bb, occupy = r.skills[1].bb;
  if (Object.keys(refresh).length !== 3 || refresh.dynamic !== amount || refresh.max_hp !== .5 || refresh.attack_speed !== 50
    || Object.keys(occupy).join() !== 'sp' || occupy.sp !== -1) return false;
  const selector = n.$ref(n.Occupy.find(x => '_selector' in x)._selector), geometry = n.$siblings(selector);
  if (selector?._targetSide !== 1 || selector._targetCategory !== 2 || selector._targetMotion !== 3
    || selector._filterTag !== 'tower' || selector._buffKey !== 'tower_t_4[mark]' || selector._buffKeyExcluded !== 1
    || selector._postFilter !== 11 || selector._maxNum !== 1 || selector._ignoreTargetFree !== 1
    || !geometry.some(c => c.m_Script?.m_PathID === '6275044311115013764' && c._useBlackboardRangeId === 0)) return false;
  const stack = n.$template('enemy_mdrock_s_1')?.eventToActions.ON_BUFF_START?.[0];
  if (!node(stack, 'CreateBuff') || stack._buffOwner !== 'BUFF_SOURCE' || stack._buff.maxStackCnt !== 6
    || stack._buff.overrideType !== 'STACK' || stack._buff.isSilenceable || stack._buff.lifeTimeType !== 'INFINITY'
    || stack._buff.attributes.attributeModifiers.length !== 1
    || stack._buff.attributes.attributeModifiers[0]?.attributeType !== 'ATK'
    || stack._buff.attributes.attributeModifiers[0].formulaItem !== 'MULTIPLIER'
    || !stack._buff.attributes.attributeModifiers[0].loadFromBlackboard) return false;
  const init = n.Shield?.find(c => '_buffs' in c)?._buffs;
  const regen = n.$template('enemy_mdrock_s_2[shield][refresh]')?.eventToActions.ON_BUFF_START;
  if (init?.length !== 1 || init[0].templateKey !== 'enemy_mdrock_s_2[shield][refresh]' || regen?.length !== 7
    || regen.slice(0, 3).some(a => !node(a, 'FinishBuffsById'))
    || regen.slice(3, 6).some((a, i) => !node(a, 'CreateBuff') || a._buff.templateKey !== `enemy_mdrock_s_2[shield_${i === 2 ? 'last' : 'normal'}]`)) return false;
  const mods = regen[6]._buff?.attributes.attributeModifiers;
  if (regen[6]._buff?.buffKey !== 'enemy_mdrock_s_2[shield][buff]' || mods?.length !== 2
    || mods.some((m, i) => m.attributeType !== ['MAX_HP', 'ATTACK_SPEED'][i]
      || m.formulaItem !== ['MULTIPLIER', 'ADDITION'][i] || !m.loadFromBlackboard)) return false;
  for (const name of ['normal', 'last']) {
    const actions = n.$template(`enemy_mdrock_s_2[shield_${name}]`)?.eventToActions.ON_TAKE_DAMAGE;
    if (!node(actions?.[0], 'BlockDamage') || actions[0]._damageMask !== 'MAGICAL' || !actions[0]._useDynamicVar
      || actions[0]._useFixedValue || !node(actions[1], 'IsBlackboardZero') || actions[1]._var !== 'dynamic'
      || !node(actions[2], 'FinishBuff') || name === 'last' && actions[3]?._buffKey !== 'enemy_mdrock_s_2[shield][buff]') return false;
  }
  const capture = n.$template('tower_t_3[be_enemy_instant]')?.eventToActions.ON_BUFF_START;
  return capture?.[0]?._filterTag === 'tower' && capture[1]._modifyByRatio && !capture[1]._forceFlag
    && capture[4]._modeIndex === 2;
}
const cast = (r, i, clip) => ({ cooldown: r.skills[i].cooldown, initial: r.skills[i].initCooldown, clip, slowDown: true,
  duration: clocks.enemies[r.prefabKey].durations[clip], release: clocks.enemies[r.prefabKey].events[clip][0].time });
export const MUDROCK_FEATURES = {
  'skill:RefreshShield': { matchesRecord: r => r.prefabKey === 'enemy_1511_mdrock', covers: mudrockNative, nativeClaim: () => ({ wrappers: 2, active: 1 }),
    ability: { kind: 'mudrock', params: r => ({ amount: r.skills[0].bb.dynamic,
      atkPct: r.talents.bb['charge.attack@enemy_mdrock_s_1[charge].atk'], refresh: cast(r, 0, 'Skill_2'), occupy: cast(r, 1, 'Skill_1') }) },
    explains: /^(Every attack permanently increases ATK, stacking up to 6 times|Has a Barrier that absorbs Arts damage; while the Barrier persists, this unit has significantly increased Max HP and ASPD\.|Barrier periodically refreshes\.|Can use a skill to automatically seize control of the nearest non-enemy controlled 'Gramophone')$/ },
  'skill:occupy': { covers: mudrockNative },
  ...Object.fromEntries(['dynamic', 'attack_speed', 'max_hp'].map(k => [`talent:${k}`, { covers: mudrockNative }])),
};
