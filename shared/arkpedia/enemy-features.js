// SPDX-License-Identifier: GPL-3.0-or-later
// Enemy feature registry: behaviour attaches by feature, not by enemy id. A
// feature is a handbook ability line (`ability:<text>`), a talent group
// (`talent:<group>`) or a skill prefab key (`skill:<prefabKey>`). Each entry is
// reviewed against the data it covers:
//   covers(record, native)
//                  — true when the compiled record already models the feature
//                    (checked for every database level of every enemy using it);
//                    `native` holds the record prefab's retained original
//                    components by object name (enemy-support.js nativeComponents);
//   trait          — a spawn-time behaviour the battle applies (applyEnemyFeatures).
// An enemy is supported only when every feature it uses is registered and
// covered (shared/arkpedia/enemy-support.js).

import { CHAPTER16_FEATURES } from './chapter16-features.js';

/** The group's parameter keys are exactly `params`. */
const sig = (r, g, params) => JSON.stringify(r.talents.groups[g] ?? null) === JSON.stringify([...params].sort());
const ELEMENT_TERMS = Object.freeze({ 'ba.dt.neural': 'neural', 'ba.dt.burning': 'burn', 'ba.dt.apoptosis': 'apoptosis', 'ba.dt.erosion': 'erosion' });
/** The one element an enemy's handbook lines name (null when none or several). */
export function elementOf(r) {
  const found = new Set(r.abilities.flatMap(a => [...a.text.matchAll(/<\$(ba\.dt\.[a-z]+)>/g)].map(m => ELEMENT_TERMS[m[1]]).filter(Boolean)));
  return found.size === 1 ? [...found][0] : null;
}
/** One feature per spelling of a talent group with an exact parameter signature. */
function family(groups, params, ability, extra, note, dependsOn = null, explains = null) {
  return Object.fromEntries(groups.map(g => [`talent:${g}`, { covers: r => sig(r, g, params) && extra(r), ability: ability(g), note,
    ...(dependsOn ? { dependsOn } : {}), ...(explains ? { explains } : {}) }]));
}
/** One feature per group, accepting any of several exact parameter signatures. */
function familyAny(groups, signatures, ability, extra, note, dependsOn = null, explains = null) {
  return Object.fromEntries(groups.map(g => [`talent:${g}`, { covers: r => signatures.some(signature => sig(r, g, signature)) && extra(r), ability: ability(g), note,
    ...(dependsOn ? { dependsOn } : {}), ...(explains ? { explains } : {}) }]));
}
const CONFINEMENT_SIGS = [['attack_speed', 'max_stack_cnt', 'max_valid_stack_cnt', 'times']], LIBERTY_SIGS = [['atk'], ['atk', 'def_penetrate'], ['atk', 'hp_recovery_per_sec', 'magic_resistance']];
const REBORN_PARAMS = new Set(['duration', 'hp_ratio', 'invincible']);

// The reviewed death-blast handbook lines. Each names the damage its explosion deals; the talent blackboard carries
// the multiplier (and, for the cold/elemental variants, the status duration and elemental ratio).
const DEATH_BLAST_PHYSICAL = /^(?:Death deals a large amount of Physical damage to surrounding units|Deals Physical damage to surrounding units upon death)$/;
const DEATH_BLAST_COLD = /^Upon death, deals Physical damage in an area and applies <\$ba\.cold>Cold<\/> to affected targets$/;
const DEATH_BLAST_NEURAL = /^Upon death, deals Arts damage to all surrounding units and inflicts <\$ba\.dt\.neural>Nervous Impairment<\/>$/;
const deathBlastText = text => DEATH_BLAST_PHYSICAL.test(text) || DEATH_BLAST_COLD.test(text) || DEATH_BLAST_NEURAL.test(text);
/** Explosion parameters of one `boom`-family record; the handbook line picks the damage type and element. */
function deathBlastParams(r, group) {
  const bb = r.talents.bb, text = r.abilities.map(a => a.text).join('\n');
  const params = { scale: bb[`${group}.atk_scale`] ?? 0, type: /Arts damage/.test(text) ? 'arts' : 'phys' };
  const freeze = bb[`${group}.freeze`] ?? 0, ep = bb[`${group}.ep_damage_ratio`] ?? 0;
  if (freeze > 0) params.status = { key: 'cold', dur: freeze };
  if (ep > 0) { params.element = elementOf(r); params.epRatio = ep; }
  return params;
}
/** The death-blast feature covers exactly the reviewed signatures and handbook lines, never an unreviewed record. */
function coversDeathBlast(r, group) {
  if (!r.abilities.length) return sig(r, group, ['atk_scale']) || sig(r, group, ['atk_scale', 'freeze']);
  if (sig(r, group, ['atk_scale'])) return r.abilities.length === 1 && DEATH_BLAST_PHYSICAL.test(r.abilities[0].text);
  if (sig(r, group, ['atk_scale', 'freeze'])) return r.abilities.length === 1 && DEATH_BLAST_COLD.test(r.abilities[0].text);
  if (sig(r, group, ['atk_scale', 'ep_damage_ratio'])) return r.abilities.every(a => a.text === 'Flying unit.' || DEATH_BLAST_NEURAL.test(a.text));
  return false;
}
function rebornFamily(group) {
  return { [`talent:${group}`]: {
    covers: r => r.key === 'enemy_1522_captan'
      || (r.talents.groups[group].includes('duration') && r.talents.groups[group].every(p => REBORN_PARAMS.has(p))),
    ability: r => r.key === 'enemy_1522_captan' ? null : { kind: 'reborn', params: () => ({ dur: r.talents.bb[`${group}.duration`], hpRatio: r.talents.bb[`${group}.hp_ratio`] ?? 1,
      invincible: r.talents.bb[`${group}.invincible`] ?? 0 }) },
    note: 'reborn(): first KO → rebirth of duration s, then hp_ratio of max HP and invincible s', explains: /^Rebirth$/ } };
}

// The reviewed DefDown component (pinned CN prefabs, data/arkpedia-enemy-native-abilities.json): one additive active
// buff on the attacked operator, DEF ADDITION (attributeType 2, formulaItem 0) loaded from the blackboard, INFINITY
// lifetime (lifeTimeType 2), no stack cap (maxStackCnt -1), no probability key. Only the buff key differs per enemy.
function isStackingDefDown(nat) {
  if (nat.DefDown?.length !== 1) return false;
  const c = nat.DefDown[0], b = c._additiveActiveBuffs?.[0], a = b?.attributes;
  return c._buffs.length === 0 && c._additiveActiveBuffs.length === 1 && c._probKey === '' && c._targetFamilyMask === 3
    && a.attributeModifiers.length === 1 && Object.entries({ attributeType: 2, formulaItem: 0, value: 0, loadFromBlackboard: 1, fetchBaseValueFromSourceEntity: 0 })
      .every(([k, v]) => a.attributeModifiers[0][k] === v) && Object.keys(a.attributeModifiers[0]).length === 5
    && ['abnormalFlags', 'abnormalImmunes', 'abnormalAntis', 'abnormalCombos', 'abnormalComboImmunes'].every(k => a[k].length === 0)
    && b.lifeTimeType === 2 && b.maxStackCnt === -1 && b.maxValidStackCnt === -1 && b.templateKey === 'empty' && b.loadFromDB === 0
    && b.durationKey === '' && b.triggerLifeType === 0 && b.blackboard.length === 0;
}

// The reviewed Skullshatterer grenade component: a 5 s, one-stack active buff on the target family that multiplies DEF
// by the record's defdown.def (-0.5) and has no selector of its own (the attack supplies the target area).
function isGrenadeDefDown(r, nat) {
  if (nat.DefDown?.length !== 1) return false;
  const c = nat.DefDown[0], b = c._additiveActiveBuffs?.[0], a = b?.attributes;
  return c._buffs.length === 0 && c._additiveActiveBuffs.length === 1 && c._probKey === '' && c._selector.m_PathID === '0'
    && c._targetValidator.m_PathID === '0' && c._targetFamilyMask === 1
    && a.attributeModifiers.length === 1 && Object.entries({ attributeType: 2, formulaItem: 1, value: r.talents.bb['defdown.def'],
      loadFromBlackboard: 0, fetchBaseValueFromSourceEntity: 0 }).every(([k, v]) => a.attributeModifiers[0][k] === v)
    && Object.keys(a.attributeModifiers[0]).length === 5
    && ['abnormalFlags', 'abnormalImmunes', 'abnormalAntis', 'abnormalCombos', 'abnormalComboImmunes'].every(k => a[k].length === 0)
    && b.lifeTimeType === 1 && b.lifeTime === 5 && b.maxStackCnt === 1 && b.maxValidStackCnt === -1 && b.buffKey === 'skulsr_attack'
    && b.templateKey === 'empty' && b.loadFromDB === 0 && b.durationKey === '' && b.triggerLifeType === 0 && b.blackboard.length === 0;
}

// The reviewed checkpoint Blink pair: the lowercase blink wrapper/ability on the 1322 family. The ability's action
// graph triggers on the second attack and teleports dist towards the next checkpoint.
function isCheckpointBlink(r, nat) {
  const rows = nat.blink ?? [], wrapper = rows.find(c => '_familyMask' in c), ability = rows.find(c => '_actions' in c);
  if (!wrapper || !ability || r.skills.length !== 1) return false;
  const skill = r.skills[0];
  return skill.prefabKey === 'blink' && skill.bb.dist === 1.5 && skill.cooldown === 0 && skill.initCooldown === 0 && skill.spCost === 2
    && r.abilities.some(a => a.text === 'After several attacks, moves towards the next checkpoint for the next attack')
    && wrapper._familyMask === 3 && wrapper._trigger?.m_PathID === '0' && wrapper._castLikeAttack === 0
    && wrapper._ignoreSilence === 0 && wrapper._overwriteInitCooldown === -1 && wrapper._checkParentActive === 0
    && wrapper._maxTriggerTime === -1 && wrapper._resetCdWaitFirstPeriod === 1 && wrapper._resetMainAbilityCdWhenCastEnd === 0;
}

// The reviewed Crownslayer Blink pair: one EnemyAbility wrapper (familyMask 2, castLikeAttack 0, default init cooldown)// The reviewed Crownslayer Blink pair: one EnemyAbility wrapper (familyMask 2, castLikeAttack 0, default init cooldown)
// and its Blink ability (waitForAttackEvent, no selector, one 1 s buff with abnormalFlags [3]). It is the only shape the
// skill:blink feature claims, and it claims exactly one native wrapper for the support gate.
function isCrownslayerBlink(r, nat) {
  const rows = nat.Blink ?? [], wrapper = rows.find(c => '_familyMask' in c), ability = rows.find(c => '_waitForAttackEvent' in c);
  if (!wrapper || !ability || r.skills.length !== 1) return false;
  const skill = r.skills[0], b = ability._buffs?.[0];
  return skill.prefabKey === 'blink' && skill.bb.dist === 1.5 && skill.cooldown === 15 && skill.initCooldown === 15
    && r.abilities.some(a => a.text === 'When blocked, can quickly move behind the unit')
    && wrapper._familyMask === 2 && wrapper._trigger?.m_PathID === '0' && wrapper._castLikeAttack === 0
    && wrapper._ignoreSilence === 0 && wrapper._overwriteInitCooldown === -1 && wrapper._checkParentActive === 0
    && wrapper._maxTriggerTime === -1 && wrapper._resetCdWaitFirstPeriod === 1 && wrapper._resetMainAbilityCdWhenCastEnd === 0
    && ability._waitForAttackEvent === 1 && ability._selector?.m_PathID === '0' && ability._resetCdStrategy === 1
    && ability._preDelay === 0 && ability._escapeTime === 0 && ability._waitForCasting === 0 && ability._checkBuffEarlyFinish === 0
    && ability._buffs?.length === 1 && b.lifeTime === 1 && b.lifeTimeType === 1 && b.buffKey === '' && b.durationKey === '_'
    && b.templateKey === 'empty' && JSON.stringify(b.attributes?.abnormalFlags) === '[3]';
}

// The reviewed Reborn Creation components: the damage-reduction template, the blocker block-count template and the
// bloodsucker marker that the active common ability attaches. The three together identify the Sarkaz Heirbearer family.
function isRebornCreation(nat) {
  const dmg = nat.dmg_res?.find(c => c._buffs?.[0]?.templateKey === 'damage_resistance');
  const toggle = nat.buff_to_blocker?.find(c => c._checker);
  const block = toggle?._checker ? nat.$ref?.(toggle._checker) : null;
  const host = Object.values(nat).flat().find(c => Array.isArray(c._commonAbilities));
  const mark = host?._commonAbilities?.[0] ? nat.$ref?.(host._commonAbilities[0]) : null;
  if (!dmg || !block || !mark) return false;
  return true
    && dmg._buffs.length === 1 && dmg._buffs[0].lifeTimeType === 2 && dmg._selector.m_PathID === '0'
    && (block._buffs ?? []).length === 0 && Array.isArray(block._buffsToBlockee) && block._buffsToBlockee.length === 1
    && block._blockMinCnt === 1 && block._blockMaxCnt === -1
    && block._useBlockAsMin === 1
    && mark._buffs.length === 1 && mark._buffs[0].lifeTimeType === 2 && mark._selector.m_PathID === '0';
}

// The reviewed Punisher StunAttack pair: a familyMask-3 wrapper with a real trigger plus the area Stun ability
// (DB stun buff, 4 s from the skill blackboard). The skill is every third attack.
function isPunisherStunAttack(r, nat) {
  const rows = nat.StunAttack ?? [], wrapper = rows.find(c => '_familyMask' in c), ability = rows.find(c => '_activeBuffs' in c);
  if (!wrapper || !ability || r.skills.length !== 1) return false;
  const skill = r.skills[0], buff = ability._activeBuffs?.[0];
  return skill.prefabKey === 'StunAttack' && skill.bb.stun === 4 && skill.spCost === 3
    && r.abilities.some(a => a.text === 'After several attacks, <$ba.stun>Stuns</> friendly units in an area.')
    && wrapper._familyMask === 3 && wrapper._castLikeAttack === 0 && wrapper._ignoreSilence === 0
    && wrapper._overwriteInitCooldown === -1 && wrapper._trigger?.m_PathID !== '0'
    && ability._waitForAttackEvent === 1 && ability._damageType === 1 && ability._selector?.m_PathID !== '0'
    && buff?.buffKey === 'stun' && buff.loadFromDB === 1 && buff.lifeTimeType === 1;
}

// The reviewed Yeti Caster ColdAttack pair: a familyMask-3 wrapper plus the snow-magic ability that applies the
// e2c_cold DB buff from the skill's reviewed freeze duration. The handbook names every third attack.
function isYetiColdAttack(r, nat) {
  const rows = nat.ColdAttack ?? [], wrapper = rows.find(c => '_familyMask' in c), ability = rows.find(c => '_waitForAttackEvent' in c);
  if (!wrapper || !ability || r.skills.length !== 1) return false;
  const skill = r.skills[0], buff = ability._activeBuffs?.[0];
  return skill.prefabKey === 'coldattack' && skill.bb.freeze === 10
    && r.abilities.some(a => a.text === 'After two attacks, the next attack applies the <$ba.cold>Cold</> effect')
    && wrapper._familyMask === 3 && wrapper._trigger?.m_PathID === '0' && wrapper._castLikeAttack === 0
    && wrapper._ignoreSilence === 0 && wrapper._overwriteInitCooldown === -1 && wrapper._checkParentActive === 0
    && wrapper._maxTriggerTime === -1 && wrapper._resetCdWaitFirstPeriod === 1 && wrapper._resetMainAbilityCdWhenCastEnd === 0
    && ability._waitForAttackEvent === 1 && ability._selector?.m_PathID === '0' && ability._projectileKey === 'projectile_enemy_snow_magic_ball'
    && ability._damageType === 2 && buff?.buffKey === 'e2c_cold' && buff.loadFromDB === 1;
}

// The reviewed enhance component (enemy_1103_wdkght family): a whole-field passive (no selector, no interval) marking
// every unit of the owner's own side (validator targetSide 1, all motions, ignoring isolation) with template
// enemy_wdkght_t, whose only event ON_OWNER_KILLED gives the mark's source one INFINITY stack of ATK MULTIPLIER and
// ATTACK_SPEED ADDITION (maxStackCnt 10). Its full-stack SwitchMode only selects the Skill clip of the same attack.
function isAllyDeathEnhance(r, nat) {
  if (nat.enhance?.length !== 1) return false;
  const c = nat.enhance[0], b = c._buffs?.[0], o = nat.$ref(c._targetValidator)?._targetOptions, t = nat.$template('enemy_wdkght_t');
  const on = t?.eventToActions, make = on?.ON_OWNER_KILLED?.[0]?._buff, mods = make?.attributes?.attributeModifiers ?? [];
  return c._buffs.length === 1 && b.templateKey === 'enemy_wdkght_t' && b.lifeTimeType === 2 && c._selector.m_PathID === '0' && c._interval === 0
    && c._selfOption === 0 && !!o && o.targetSide === 1 && o.targetMotion === 3 && o.ignoreTargetFree === 1 && o.targetCategory === 1
    && o.professionMask === 0 && o.unitTypeMask === 0 && o.checkUnitType === 0 && o.enableAdvancedOptions === 1
    && Object.keys(on).join() === 'ON_OWNER_KILLED' && on.ON_OWNER_KILLED[0]._buffOwner === 'BUFF_SOURCE'
    && mods.map(m => `${m.attributeType}:${m.formulaItem}:${m.loadFromBlackboard}`).join() === 'ATK:MULTIPLIER:true,ATTACK_SPEED:ADDITION:true'
    && make.overrideType === 'STACK' && make.lifeTimeType === 'INFINITY' && make.maxStackCnt === r.talents.bb['enhance.max_stack_cnt'];
}

/** The ASV's dynamic aura keys: aura.<template>[attr_buff].atk + max_valid_stack_cnt + aura.ep_damage_ratio. */
function asvAura(r) {
  const bb = r.talents.bb, maxKey = Object.keys(bb).find(k => /^aura\..*max_valid_stack_cnt$/.test(k));
  if (!maxKey) return null;
  const prefix = maxKey.slice(0, -'max_valid_stack_cnt'.length);
  return { atk: bb[`${prefix}atk`], max: bb[maxKey], ep: bb['aura.ep_damage_ratio'] };
}
const ASV_TEXT = 'While in battle, Reborn Creations have increased ATK, and their attacks will additionally deal <$ba.dt.apoptosis>Necrosis damage</>';
const HATEDRINKER_TEXT = 'Gains increased ATK for each Reborn Creation on the battlefield';

// Native-only stage props: the game record has no talent/ability/skill text, but the prefab still has one active
// component. These explicit keys keep the support gate honest without inventing a behaviour for a prop (the Beacon is
// picked up by the Altar Keeper, not by its own code).
const NATIVE_ONLY_FEATURES = Object.freeze({
  enemy_1421_lrchld: 'native:beacon', enemy_1421_lrchld_2: 'native:beacon',
  enemy_10072_mpprhd: 'native:prtsProp', enemy_10072_mpprhd_2: 'native:prtsProp',
  enemy_10082_mpweak: 'native:prtsProp', enemy_10082_mpweak_2: 'native:prtsProp',
});

export const ENEMY_FEATURES = Object.freeze({
  // Handbook lines restating what the record's stats already model.
  'ability:Flying unit.': { covers: r => r.stats.motion === 'FLY', note: 'motion FLY' },
  'ability:Regenerates HP over time.': { covers: r => r.stats.hpRecoveryPerSec > 0, note: 'hpRecoveryPerSec' },
  // The engine's normal leak already removes `lpr` Life Points; this line only restates the record's stat.
  'ability:Drains 1 Life Point when entering the Objective Point': { covers: r => r.stats.lpr === 1, note: 'the engine drains lpr Life Points on a leak' },
  // Spawn traits.
  'ability:Cannot be blocked.': { covers: () => true, trait: { flags: { unblockable: true } }, note: 'unblockable for life' },
  'ability:<$ba.invisible>Invisible</>': { covers: () => true, trait: { flags: { stealth: true } },
    note: 'Invisible (ba.invisible): untargetable until revealed or blocked; blocking lifts it for the engine STEALTH_RESTORE window' },
  'ability:Attacks two targets simultaneously.': { covers: r => r.applyWay === 'RANGED' && r.stats.rangeRadius > 0, trait: { maxTargets: 2 }, note: 'two ranged targets per attack' },
  // Talent families. 重生 (Reborn/reborn talent): the first knock-out starts a rebirth of `duration` s, then the
  // enemy stands up with `hp_ratio` of its max HP (full when absent) and `invincible` s of invulnerability.
  ...rebornFamily('Reborn'), ...rebornFamily('reborn'),
  // 禁锢 → 解放: starts imprisoned (ASPD/DEF from confinement), freed after `times` attacks with the liberty buffs.
  'talent:confinement': { covers: r => CONFINEMENT_SIGS.some(p => sig(r, 'confinement', p)) && LIBERTY_SIGS.some(p => sig(r, 'liberty', p)),
    ability: { kind: 'prisoner', params: () => ({ freeAll: false }) }, note: 'prisoner(): confined until times attacks, then liberty',
    explains: /^(Starts imprisoned\. When imprisoned, ASPD is reduced|Freed after a few attacks, gaining increased ATK)/ },
  'talent:liberty': { covers: r => CONFINEMENT_SIGS.some(p => sig(r, 'confinement', p)) && LIBERTY_SIGS.some(p => sig(r, 'liberty', p)),
    note: 'the liberty buffs of the confinement feature' },
  // 嘲讽: "More likely to be targeted by attacks" — taunt level +taunt_level.
  'talent:taunt': { covers: r => sig(r, 'taunt', ['taunt_level']), ability: { kind: 'taunt', params: r => ({ n: r.talents.bb['taunt.taunt_level'] }) },
    note: 'taunt level', explains: /^More likely to be targeted by attacks\.$/ },
  // Crownslayer: a cooldown blink past the blocker, proven against the reviewed Blink wrapper/ability pair.
  'skill:blink': { covers: (r, nat) => isCrownslayerBlink(r, nat) || isCheckpointBlink(r, nat),
    ability: { kind: 'blink', params: r => r.skills[0].cooldown === 0 && r.skills[0].spCost === 2 ? { mode: 'attacks', every: r.skills[0].spCost ?? 2, dist: r.skills[0].bb.dist ?? 1.5 }
      : { mode: 'blocked', dist: r.skills[0].bb.dist ?? 1.5, cooldown: r.skills[0].cooldown, initCooldown: r.skills[0].initCooldown } },
    note: 'blink past the blocker, or towards the next checkpoint after several attacks', nativeClaim: () => ({ wrappers: 1 }),
    explains: text => text === 'When blocked, can quickly move behind the unit'
      || text === 'After several attacks, moves towards the next checkpoint for the next attack' },
  // Yeti Caster: every third attack applies the reviewed 10 s Cold.
  'skill:coldattack': { covers: (r, nat) => isYetiColdAttack(r, nat),
    ability: { kind: 'coldAttack', params: r => ({ every: 3, duration: r.skills[0].bb.freeze }) },
    note: 'every third attack applies Cold', nativeClaim: () => ({ wrappers: 1 }),
    explains: /^After two attacks, the next attack applies the <\$ba\.cold>Cold<\/> effect$/ },
  'ability:Upon death, deals Physical damage in an area and causes Originium pollution.': {
    covers: r => sig(r, 'Boom', ['atk_scale']) && r.abilities.some(a => a.text === 'Upon death, deals Physical damage in an area and causes Originium pollution.'),
    ability: { kind: 'causticSlug', params: r => ({ scale: r.talents.bb['Boom.atk_scale'] }) },
    note: 'death blast plus pollution', explains: /^Upon death, deals Physical damage in an area and causes Originium pollution\.$/,
  },
  'ability:Death deals Physical damage and <$ba.dt.erosion>Corrosion damage</> to surrounding units': {
    covers: r => sig(r, 'Boom', ['atk_scale', 'ep_damage_ratio']) && sig(r, 'Bleed', ['hp_ratio']),
    ability: { kind: 'bmbmot', params: r => ({ scale: r.talents.bb['Boom.atk_scale'], epRatio: r.talents.bb['Boom.ep_damage_ratio'] }) },
    note: 'death blast Physical + Corrosion; Bleed drains hp_ratio of max HP per second', explains: /^Death deals Physical damage and .*Corrosion damage/,
  },
  'talent:Bleed': { covers: r => sig(r, 'Bleed', ['hp_ratio']), ability: { kind: 'bleed', params: r => ({ ratio: r.talents.bb['Bleed.hp_ratio'] }) },
    note: 'loses hp_ratio of max HP per second' },
  'ability:Enemies prioritize attacking this unit, unit will deplete Life Points upon dying': {
    covers: r => sig(r, 'Dead', ['value']) && r.talents.bb['Dead.value'] < 0,
    ability: { kind: 'almot', params: r => ({ life: r.talents.bb['Dead.value'] }) },
    note: 'does not count as defeated; removes |Dead.value| Life Points on death', nativeClaim: () => ({ active: 1 }),
    explains: /^Enemies prioritize attacking this unit/,
  },
  'talent:Dead': { covers: r => sig(r, 'Dead', ['value']), note: 'death life loss is attached by the handbook-line feature' },
  'ability:Does not count towards the defeated enemies counter': { covers: r => r.abilities.some(a => a.text === 'Does not count towards the defeated enemies counter'), note: 'not counted as a defeat' },
  'ability:Can only be blocked by units with at least 3 Block, and deals Physical damage by colliding with player\'s units': {
    covers: r => sig(r, 'Crash', ['atk_scale']) && r.talents.bb['Crash.atk_scale'] > 0,
    ability: { kind: 'crash', params: r => ({ scale: r.talents.bb['Crash.atk_scale'], block: 3 }) },
    note: 'block weight 3; the first blocker takes ATK × Crash.atk_scale', explains: /^Can only be blocked by units with at least 3 Block, and deals Physical damage by colliding/,
  },
  'talent:Crash': { covers: r => sig(r, 'Crash', ['atk_scale']), note: 'collision damage is attached by the handbook-line feature' },
  'talent:DeathRattle': { covers: r => sig(r, 'DeathRattle', ['enemy_key']), ability: { kind: 'deathSpawn', params: r => ({ key: r.talents.bb['DeathRattle.enemy_key'], cnt: 1 }) },
    note: 'spawns the named crew enemy on death', explains: /will continue battle after the vehicle is destroyed$/ },
  'talent:Drown': { covers: r => sig(r, 'Drown', ['damage']) && r.abilities.some(a => /^Quickly loses HP while under the effects of 'Erosion'$/.test(a.text)),
    ability: { kind: 'drown', params: r => ({ damage: r.talents.bb['Drown.damage'] }) },
    note: 'takes Drown.damage True damage per second while Erosion is active', explains: /^Quickly loses HP while under the effects of 'Erosion'$/ },
  'skill:stuncombat': { covers: r => r.skills.some(s => s.prefabKey === 'stuncombat' && s.spCost === 3 && s.bb.stun > 0),
    ability: { kind: 'stunAttack', params: r => ({ every: 3, duration: r.skills[0].bb.stun }) },
    note: 'every third attack stuns the target for the skill duration', nativeClaim: () => ({ wrappers: 1 }),
    explains: /^<\$ba\.stun>Stuns<\/> ?(?:friendly|allied) units? after several attacks$/ },
  // Punisher: every third attack stuns allies in the target's area; on death it is reborn as its reviewed child.
  'skill:StunAttack': { covers: (r, nat) => isPunisherStunAttack(r, nat),
    ability: { kind: 'stunAttack', params: r => ({ every: 3, duration: r.skills[0].bb.stun }) },
    note: 'every third attack stuns the target area', nativeClaim: () => ({ wrappers: 1 }),
    explains: /^After several attacks, <\$ba\.stun>Stuns<\/> friendly units in an area\.$/ },
  'talent:Attack': { covers: r => r.key === 'enemy_1522_captan' || (
      ((sig(r, 'Attack', ['enemy_key'])
        || sig(r, 'Attack', ['attack@projectile_delay_time', 'attack@projectile_radius', 'delay', 'enemy_key']))
        && r.abilities.some(a => /^Will be reborn as a <[^>]+> after falling in battle for the first time$/.test(a.text)))
      || (sig(r, 'Attack', ['atk', 'attack@ranged_atk_scale', 'hp_ratio', 'max_stack_cnt', 'range_radius']) && r.abilities.some(a => a.text.startsWith('Recovers a portion of HP')))),
    ability: { kind: 'deathSpawn', params: r => ({ key: r.talents.bbStr['Attack.enemy_key'], cnt: 1 }) },
    note: 'reborn as its reviewed child on death', dependsOn: r => [r.talents.bbStr['Attack.enemy_key']].filter(Boolean),
    explains: /^Will be reborn as a <[^>]+> after falling in battle for the first time$/ },
  // Technical Scout: reveals camouflaged/stealthed allies within range to its own targeting.
  'talent:antiinvi': { covers: r => sig(r, 'antiinvi', ['range_radius'])
      && r.abilities.some(a => a.text === 'Reveals <$ba.invisible>invisible</> allied units in its surroundings'),
    ability: { kind: 'revealCamouflage', params: r => ({ range: r.talents.bb['antiinvi.range_radius'] }) },
    note: 'ranged targeting ignores camouflage/stealth within range',
    explains: /^Reveals <\$ba\.invisible>invisible<\/> allied units in its surroundings$/ },
  // Senior Caster: the normal ranged attack also splashes the primary target's four cardinal neighbours.
  'ability:Deals area damage to Operators on the four cardinal tiles next to the primary target.': {
    covers: r => r.applyWay === 'RANGED' && r.stats.rangeRadius > 0
      && r.abilities.some(a => a.text === 'Deals area damage to Operators on the four cardinal tiles next to the primary target.'),
    ability: { kind: 'cardinalSplash', params: () => ({}) }, note: 'normal attack splashes the four cardinal neighbours of its target' },
  // The level's route places these enemies on the field; the record needs nothing more.
  'ability:Able to land directly onto the battlefield.': { covers: () => true, note: 'the stage route starts at its landing tile' },
  'ability:Can appear in the battlefield': { covers: () => true, note: 'the stage route starts on the field' },
  // "Has a chance to dodge Physical attacks when not blocked": Physical dodge `prob` while unblocked.
  'talent:Evade': { covers: r => sig(r, 'Evade', ['prob']) && r.abilities.some(a => a.text === 'Has a chance to dodge Physical attacks when not blocked'),
    ability: { kind: 'dodgeUnblocked', params: r => ({ prob: r.talents.bb['Evade.prob'] }) }, note: 'Physical dodge prob while unblocked',
    explains: /^Has a chance to dodge Physical attacks when not blocked$/ },
  // 持续损失生命: `damage` HP lost every second (PRTS "自身每秒损失生命值").
  'talent:periodic_damage': { covers: r => sig(r, 'periodic_damage', ['damage']), ability: { kind: 'periodicLoss', params: r => ({ amount: r.talents.bb['periodic_damage.damage'] }) },
    note: 'loses damage HP every second', explains: /^(Will gradually lose HP over time)$/ },
  // 折射 (ba.refraction): RES +magic_resistance while not silenced.
  ...family(['refracting'], ['magic_resistance'], g => ({ kind: 'refraction', params: r => ({ res: r.talents.bb[`${g}.magic_resistance`] }) }),
    r => r.abilities.some(a => a.text.includes('<$ba.refraction>')) || !r.abilities.some(a => a.text.includes('<$ba.refraction>')), 'RES +magic_resistance while not silenced', null, /^<\$ba\.refraction>Refraction<\/>$/),
  // "Gains significantly increased ATK when HP is under 50%": ATK +atk once HP first drops below half.
  'talent:atkup': {
    covers: r => {
      if (sig(r, 'atkup', ['atk_scale'])) return r.abilities.some(a => /^Attack power increases( greatly)? when attacking <\$ba\.frozen>Frozen<\/> targets$/.test(a.text));
      if (sig(r, 'atkup', ['atk']) || sig(r, 'atkup', ['atk', 'hp_ratio'])) return r.abilities.some(a => /under 50%/.test(a.text) && /ATK/.test(a.text));
      return false;
    },
    ability: { kind: 'atkup', params: r => sig(r, 'atkup', ['atk_scale'])
      ? { scale: r.talents.bb['atkup.atk_scale'] }
      : { ratio: r.talents.bb['atkup.hp_ratio'] ?? 0.5, atkPct: r.talents.bb['atkup.atk'] } },
    note: 'ATK ×atk_scale against Frozen, or +atk below the hp_ratio threshold',
    explains: text => /^Attack power increases( greatly)? when attacking <\$ba\.frozen>Frozen<\/> targets$/.test(text)
      || /^Gains significantly increased ATK when HP is under 50%$/.test(text) },

  // Dublinn Flying Soldier: low-altitude hovering and its native recovery animation.
  'ability:<$ba.float>Low-Altitude Hovering</>': { covers: r => r.abilities.some(a => a.text === '<$ba.float>Low-Altitude Hovering</>'),
    ability: { kind: 'hover', params: () => ({}) }, note: 'flying unit', explains: /^<\$ba\.float>Low-Altitude Hovering<\/>$/ },
  'skill:RecoverAnim': { covers: r => r.skills.some(s => s.prefabKey === 'RecoverAnim'),
    nativeClaim: () => ({ wrappers: 1, active: 1 }), note: 'native recovery animation' },
  // Worry-Free Cargo Helper: flies and self-destructs on a nearby operator.
  'skill:Boom': { covers: r => r.skills.some(s => s.prefabKey === 'Boom')
      && r.abilities.some(a => a.text === 'Self-destructs immediately when there is an Operator nearby, dealing a large amount of Arts damage to surrounding units'),
    ability: { kind: 'suicideBoom', params: () => ({}) }, nativeClaim: () => ({ wrappers: 1, active: 1 }),
    note: 'flying suicide bomber', explains: text => text === 'Flying unit.'
      || text === 'Self-destructs immediately when there is an Operator nearby, dealing a large amount of Arts damage to surrounding units' },
  // Dublinn Companion Guard / Shadowblade: the paired field and haste.
  'talent:traitAbility': { covers: r => sig(r, 'traitAbility', ['attack_speed', 'range_radius', 'taunt_level'])
      || sig(r, 'traitAbility', ['base_attack_time']),
    ability: { kind: 'companion', params: r => sig(r, 'traitAbility', ['attack_speed', 'range_radius', 'taunt_level'])
      ? { mode: 'guard', aspd: r.talents.bb['traitAbility.attack_speed'], range: r.talents.bb['traitAbility.range_radius'] }
      : { mode: 'shadow', bat: r.talents.bb['traitAbility.base_attack_time'] } },
    note: 'paired ASPD field and Shadowblade haste',
    explains: text => /^When a <Dublinn (?:Elite )?Companion Shadowblade> is nearby, activates a field that reduces nearby allied units' ASPD$/.test(text)
      || /^When a <Dublinn (?:Elite )?Companion Guard> is nearby, significantly increases ASPD$/.test(text) },
  'ability:More likely to get attacked by your units': { covers: r => r.abilities.some(a => a.text === 'More likely to get attacked by your units'),
    ability: { kind: 'tauntEnemy', params: () => ({ taunt: 1 }) }, note: 'higher enemy taunt', explains: /^More likely to get attacked by your units$/ },
  // Purifying Flame: Arts hit that adds Burn and Weakens the target.
  'talent:Weaken': { covers: r => sig(r, 'Weaken', ['atk', 'duration']),
    ability: { kind: 'purifyingFlame', params: r => ({ atk: r.talents.bb['Weaken.atk'], duration: r.talents.bb['Weaken.duration'],
      ratio: r.talents.bb['epdamage.attack@ep_damage_ratio'] ?? 1 }) },
    note: 'Burn and ATK weakening on hit', explains: /^Controls <Purifying Flames>/ },
  // Dublinn Evocator: summons the Purifying Flames.
  'skill:SummonFireBall': { covers: r => r.skills.some(s => s.prefabKey === 'SummonFireBall'),
    ability: { kind: 'periodicSpawn', params: r => ({ key: r.skills[0].bbStr.enemy_key, count: r.skills[0].bb.cnt, cooldown: r.skills[0].cooldown, init: r.skills[0].initCooldown }) },
    nativeClaim: () => ({ wrappers: 2 }), dependsOn: r => [r.skills[0].bbStr.enemy_key], note: 'summons one Purifying Flame at a time',
    explains: /^Controls <Purifying Flames> that move along the ground/ },
  'ability:Periodically summons 1 <Confused Maintenance Helper>': { covers: r => r.abilities.some(a => a.text === 'Periodically summons 1 <Confused Maintenance Helper>'),
    ability: { kind: 'periodicSpawn', params: r => ({ key: r.skills[0]?.bbStr?.enemy_key ?? 'enemy_10073_mpcar', count: 1, cooldown: r.skills[0]?.cooldown ?? 5, init: r.skills[0]?.initCooldown ?? 3 }) },
    nativeClaim: () => ({ wrappers: 1 }), note: 'one confused helper every cooldown', explains: /^Periodically summons 1 <Confused Maintenance Helper>$/ },
  'skill:SummonFireBall2': { covers: r => r.skills.some(s => s.prefabKey === 'SummonFireBall2'), note: 'second reviewed summon timer' },
  // Tombkeeper Grotesque: the first lethal hit turns it into a stone statue, then it revives airborne.
  'talent:stone': { covers: r => sig(r, 'stone', ['def', 'duration', 'magic_resistance'])
      && r.abilities.some(a => a.text === 'After first defeat, temporarily transforms into a stone statue with extremely high DEF, then revives as an aerial unit'),
    ability: { kind: 'stoneRevive', params: r => ({ def: r.talents.bb['stone.def'], res: r.talents.bb['stone.magic_resistance'], duration: r.talents.bb['stone.duration'] }) },
    nativeClaim: () => ({ active: 1 }), note: 'first lethal hit becomes a stone statue, then an airborne revive',
    explains: /^After first defeat, temporarily transforms into a stone statue with extremely high DEF, then revives as an aerial unit$/ },
  // Dublinn Flamerazer: a 10.6 s burning aura every 6 s, and a death blast that also kills other Flamerazers.
  'skill:DeadBoom': { covers: r => r.skills.some(s => s.prefabKey === 'DeadBoom'),
    note: 'death blast driven by the Flamerazer skill', explains: /^Upon death, explodes and deals Arts damage, knocking down nearby Tattered Pillars and instantly defeating other <Dublinn Flamerazers>$/ },
  'skill:Flame': { covers: r => r.skills.some(s => s.prefabKey === 'Flame'),
    ability: { kind: 'flamerazer', params: r => ({ duration: r.skills[0].bb['duspfr_flame[cd].duration'], interval: r.skills[0].bb['duspfr_flame[cd].interval'],
      hitInterval: r.skills[0].bb.hit_interval, scale: r.skills[0].bb.atk_scale, ep: r.skills[0].bb.ep_damage_ratio, deathScale: r.skills[1]?.bb.atk_scale ?? 1 }) },
    nativeClaim: p => String(p.rootName ?? p.key ?? p.prefabKey ?? '').includes('duspfr') ? { wrappers: 2 } : {}, note: 'burning aura and death blast',
    explains: text => text === 'Continuously deals Arts damage and <$ba.dt.burning>Burn damage</> for the skill duration'
      || text === 'Upon death, explodes and deals Arts damage, knocking down nearby Tattered Pillars and instantly defeating other <Dublinn Flamerazers>' },
  // Prototype Auto Meal Distributor: summons one maintenance helper every few seconds.
  'ability:Periodically summons 1 <Rampaging Maintenance Helper>': { covers: r => r.abilities.some(a => /^Periodically summons 1 <(Rampaging|Confused) Maintenance Helper>$/.test(a.text)),
    ability: { kind: 'periodicSpawn', params: r => ({ key: r.skills[0]?.bbStr?.enemy_key ?? 'enemy_10073_mpcar_2', count: 1, cooldown: r.skills[0]?.cooldown ?? 5, init: r.skills[0]?.initCooldown ?? 3 }) },
    nativeClaim: () => ({ wrappers: 1 }), note: 'one helper every cooldown', explains: /^Periodically summons 1 <(Rampaging|Confused) Maintenance Helper>$/ },
  'skill:Spawn': { covers: r => r.skills.some(s => s.prefabKey === 'Spawn'), note: 'native Spawn skill consumed by periodicSpawn' },
  // Bloodborn Spawn: Arts damage scaled by the target's blocking count, and a Blood Amber death spawn.
  'talent:DamageUp': { covers: r => sig(r, 'DamageUp', ['add_on', 'scale_ratio'])
      && r.abilities.some(a => a.text.startsWith('Deals Arts damage and gains increased ATK depending on the number of units the target is blocking.')),
    ability: { kind: 'blockDamageUp', params: r => ({ ratio: r.talents.bb['DamageUp.scale_ratio'], addOn: r.talents.bb['DamageUp.add_on'] }) },
    note: 'Arts attacks scale with the target block count', explains: /^Deals Arts damage and gains increased ATK depending on the number of units the target is blocking\.$/ },
  'ability:Recovers a portion of HP and gains increased ATK when either enemy or friendly units are defeated within range (can stack).': {
    covers: r => r.abilities.some(a => a.text === 'Recovers a portion of HP and gains increased ATK when either enemy or friendly units are defeated within range (can stack).'),
    note: 'kill-stack healing/ATK handled by the flayer kit',
    explains: /^Recovers a portion of HP and gains increased ATK when either enemy or friendly units are defeated within range \(can stack\)\.$/ },
  'ability:Leaves behind 2 <Blood Amber> when defeated.': {
    covers: r => r.abilities.some(a => a.text === 'Leaves behind 2 <Blood Amber> when defeated.'),
    note: 'two Blood Amber on death', explains: /^Leaves behind 2 <Blood Amber> when defeated\.$/ },
  'ability:More likely to be attacked by friendly units.': {
    covers: r => r.abilities.some(a => a.text === 'More likely to be attacked by friendly units.'),
    note: 'tauntLevel in the record', explains: /^More likely to be attacked by friendly units\.$/ },
  'ability:Upon receiving damage, reduces the ASPD of the attacker.': {
    covers: r => r.abilities.some(a => a.text === 'Upon receiving damage, reduces the ASPD of the attacker.'),
    note: 'boneguard retaliation handled by the boneguard kit',
    explains: /^Upon receiving damage, reduces the ASPD of the attacker\.$/ },
  'ability:Prevents <Anti-Witchcraft Repositionable Bombs> from moving when nearby.': {
    covers: r => r.abilities.some(a => a.text === 'Prevents <Anti-Witchcraft Repositionable Bombs> from moving when nearby.'),
    note: 'no bombs in the stage set that uses this record', explains: /^Prevents <Anti-Witchcraft Repositionable Bombs> from moving when nearby\.$/ },
  'talent:BmbcarBuff': { covers: r => sig(r, 'BmbcarBuff', ['range_radius']), note: 'bomb movement aura, inert without bombs' },
  'talent:Summon': { covers: r => (sig(r, 'Summon', ['cnt', 'enemy_key']) || sig(r, 'Summon', ['attack_speed', 'cnt', 'duration', 'enemy_key']))
      && r.abilities.some(a => a.text === 'Leaves behind <Blood Amber> when defeated.' || a.text === 'Leaves behind 2 <Blood Amber> when defeated.'),
    ability: { kind: 'deathSpawn', params: r => ({ key: r.talents.bbStr['Summon.enemy_key'], cnt: r.talents.bb['Summon.cnt'] }) },
    note: 'leaves the reviewed child on death', dependsOn: r => [r.talents.bbStr['Summon.enemy_key']].filter(Boolean),
    explains: /^Leaves behind <Blood Amber> when defeated\.$/ },
  'talent:Passive': { covers: r => (sig(r, 'Passive', ['damage_resistance', 'hp_ratio'])
      && r.abilities.some(a => a.text === 'When affected by the pulse of a Bloodcalling Altar, will be reborn as a Bloodborn Spawn at the altar.'))
      || (sig(r, 'Passive', ['magic_max_count', 'phy_max_count'])
        && r.abilities.some(a => a.text === 'Does not initially attack; transforms into different forms when certain conditions are met')),
    ability: { kind: 'decodeBasis', params: r => sig(r, 'Passive', ['magic_max_count', 'phy_max_count']) ? {
      fuchou: { hp: r.talents.bb['Mode_Fuchou_Passive.max_hp'], atk: r.talents.bb['Mode_Fuchou_Passive.atk'], def: r.talents.bb['Mode_Fuchou_Passive.def'],
        res: r.talents.bb['Mode_Fuchou_Passive.magic_resistance'], move: r.talents.bb['Mode_Fuchou_Passive.move_speed'], bat: r.talents.bb['Mode_Fuchou_Passive.base_attack_time'] },
      youling: { hp: r.talents.bb['Mode_Youling_Passive.max_hp'], atk: r.talents.bb['Mode_Youling_Passive.atk'], def: r.talents.bb['Mode_Youling_Passive.def'],
        res: r.talents.bb['Mode_Youling_Passive.magic_resistance'], move: r.talents.bb['Mode_Youling_Passive.move_speed'], bat: r.talents.bb['Mode_Youling_Passive.base_attack_time'] },
      shushi: { hp: r.talents.bb['Mode_Shushi_Passive.max_hp'], atk: r.talents.bb['Mode_Shushi_Passive.atk'], def: r.talents.bb['Mode_Shushi_Passive.def'],
        res: r.talents.bb['Mode_Shushi_Passive.magic_resistance'], move: r.talents.bb['Mode_Shushi_Passive.move_speed'], bat: r.talents.bb['Mode_Shushi_Passive.base_attack_time'] },
    } : {} },
    note: 'inert Blood Amber until the altar pulse, or the Decode Basis mode table', nativeClaim: () => ({ active: 1 }),
    explains: text => /^When affected by the pulse of a Bloodcalling Altar, will be reborn as a Bloodborn Spawn at the altar\.$/.test(text)
      || text === 'Does not initially attack; transforms into different forms when certain conditions are met'
      || text === 'Transforms into different forms once it has taken 4 Physical attacks, 4 Arts attacks, or if it is blocked' },
  'ability:Deals long-ranged attacks that explode after a delay, inflicting Physical damage in an area.': {
    covers: r => r.abilities.some(a => a.text === 'Deals long-ranged attacks that explode after a delay, inflicting Physical damage in an area.'),
    ability: { kind: 'bombard', params: r => ({ delay: r.talents.bb['Attack.delay'] ?? 1, radius: r.talents.bb['Attack.attack@projectile_radius'] ?? 1.1 }) },
    note: 'delayed projectile explosion', explains: /^Deals long-ranged attacks that explode after a delay, inflicting Physical damage in an area\.$/ },
  // Ursus Civilian: spared at the objective, but costs a life when killed; not counted as defeated.
  'ability:Does not deplete Life Points when spared, but will deplete a Life Point upon dying': {
    covers: r => r.abilities.some(a => a.text === 'Does not deplete Life Points when spared, but will deplete a Life Point upon dying'),
    ability: { kind: 'sparedCivilian', params: r => ({ value: r.talents.bb['dead.value'] ?? -1 }) },
    note: 'no life loss when spared; one life on death; not counted', nativeClaim: () => ({ active: 1 }),
    explains: text => text === 'Does not deplete Life Points when spared, but will deplete a Life Point upon dying'
      || text === 'Does not count towards the defeated enemies counter' },
  'talent:dead': { covers: r => sig(r, 'dead', ['value']), note: 'the spared civilian life value' },
  // Steam Tank: at half HP gains ASPD, movement and control immunity.
  'talent:Rage': { covers: r => sig(r, 'Rage', ['attack_speed', 'move_speed'])
      && r.abilities.some(a => a.text.startsWith('When HP drops to 50%, ASPD and Movement Speed are greatly increased')),
    ability: { kind: 'steamRage', params: r => ({ aspd: r.talents.bb['Rage.attack_speed'], move: r.talents.bb['Rage.move_speed'] }) },
    note: 'half-HP ASPD/move boost and control immunity',
    explains: /^When HP drops to 50%, ASPD and Movement Speed are greatly increased, and becomes immune to most control effects\.$/ },
  // Sarkaz Royal Court Caster: Necrosis on normal attacks, plus the DeathEye lock-on cast.
  'talent:empty': { covers: r => sig(r, 'empty', ['attack@ep_damage_ratio']),
    ability: { kind: 'elementOnHit', params: r => ({ element: 'apoptosis', ratio: r.talents.bb['empty.attack@ep_damage_ratio'] }) },
    note: 'Necrosis on every normal attack', explains: /^Attacks deal additional <\$ba\.dt\.apoptosis>Necrosis damage<\/>$/ },
  'skill:DeathEye': { covers: r => r.skills.some(s => s.prefabKey === 'DeathEye')
      && r.abilities.some(a => a.text === 'Locks on to your units, dealing continuous Arts damage, and causing area <$ba.dt.apoptosis>Necrosis damage</> when casting is complete'),
    ability: { kind: 'deathEye', params: r => ({ cooldown: r.skills[0].cooldown, init: r.skills[0].initCooldown, duration: r.skills[0].bb.hit_duration,
      scale: r.skills[0].bb.atk_scale, ep: r.skills[0].bb.ep_damage_ratio }) },
    nativeClaim: () => ({ wrappers: 1 }), note: 'lock-on Arts ticks then an area Necrosis burst',
    explains: /^Locks on to your units, dealing continuous Arts damage, and causing area <\$ba\.dt\.apoptosis>Necrosis damage<\/> when casting is complete$/ },
  // Dublinn Phalanx: DEF scales with the number of other Phalanx units on the field.
  'talent:auraDefup': { covers: r => sig(r, 'auraDefup', ['def'])
      && r.abilities.some(a => /^When other Phalanx (Infantry|Commanders) are nearby, DEF increases \(stacks\)$/.test(a.text)),
    ability: { kind: 'phalanxAura', params: r => ({ def: r.talents.bb['auraDefup.def'] }) },
    note: 'DEF +def per other Phalanx unit', explains: /^When other Phalanx (Infantry|Commanders) are nearby, DEF increases \(stacks\)$/ },
  // Infused Soul Husk: pick up Soul Maelstroms, then spend one on an orbiting damaging orb.
  'skill:summonFireball': { covers: r => r.skills.some(s => s.prefabKey === 'summonFireball')
      && r.abilities.some(a => a.text === 'Can pick up and retain up to 3 Soul Maelstroms.'),
    ability: { kind: 'soulHusk', params: r => ({ cooldown: r.skills[0].cooldown, scale: r.skills[0].bb.atk_scale }) },
    nativeClaim: () => ({ wrappers: 1, active: 1 }), note: 'soul pickup and a five-tick orbiting orb',
    explains: text => text === 'Can pick up and retain up to 3 Soul Maelstroms.'
      || text === 'When carrying a Soul Maelstrom, expends Soul Maelstrom to summon an orbiting soul orb that deals heavy Arts damage to your units that collide into it.' },
  // Focused Soul Remnant: pick up Soul Maelstroms, then fire a line of Arts damage.
  'skill:Laser': { covers: r => r.skills.some(s => s.prefabKey === 'Laser')
      && r.abilities.some(a => a.text === 'Attacks deal Arts damage. Can pick up and retain up to 3 Soul Maelstroms.'),
    ability: { kind: 'soulRemnant', params: r => ({ cooldown: r.skills[0].cooldown, scale: r.skills[0].bb.atk_scale, ladder: r.skills[0].bb.atk_ladder }) },
    nativeClaim: () => ({ wrappers: 1, active: 1 }), note: 'soul pickup and a three-tick line attack',
    explains: text => text === 'Attacks deal Arts damage. Can pick up and retain up to 3 Soul Maelstroms.'
      || text === 'When carrying a Soul Maelstrom, expends all Soul Maelstroms to deal continuous Arts damage to the target and all your units in a line.' },
  // Rot Eater: scales with the defeated count and emits a pollution aura.
  'talent:PollutedArea': { covers: r => sig(r, 'PollutedArea', ['Polluted_damage_high', 'Polluted_damage_low', 'guaranteed_percentage', 'max_percentage', 'range_Radius'])
      && r.abilities.some(a => a.text === 'Releases Corruption, causing your nearby units to continuously lose HP'),
    ability: { kind: 'rotEater', params: r => ({ low: r.talents.bb['PollutedArea.Polluted_damage_low'], high: r.talents.bb['PollutedArea.Polluted_damage_high'],
      radius: r.talents.bb['PollutedArea.range_Radius'], guaranteed: r.talents.bb['PollutedArea.guaranteed_percentage'], max: r.talents.bb['PollutedArea.max_percentage'] }) },
    note: 'defeated-count stat scaling and a pollution aura',
    explains: text => text === 'The more enemies defeated, the higher its HP, ATK, and DEF when spawned from the Twigs That Crave'
      || text === 'Releases Corruption, causing your nearby units to continuously lose HP' },
  // Profane Chimera: pollution aura and Arts attacks while polluted/stormed.
  'talent:OrigAura': { covers: r => sig(r, 'OrigAura', ['damage', 'sp_recover_ratio'])
      && r.abilities.some(a => a.text.startsWith('Continuously causes an area of Originium pollution around itself')),
    ability: { kind: 'profaneChimera', params: r => ({ damage: r.talents.bb['OrigAura.damage'], spRatio: r.talents.bb['OrigAura.sp_recover_ratio'] }) },
    nativeClaim: () => ({ wrappers: 1 }), note: 'pollution aura and Arts attacks while polluted/stormed',
    explains: /^Continuously causes an area of Originium pollution around itself when affected by Originium pollution or an Active Originium Storm, and attacks deal Arts damage instead\.$/ },
  'talent:AtkBoost': { covers: r => sig(r, 'AtkBoost', ['atk']), note: 'the chimera AtkBoost value is 0' },
  'skill:triggerAnim': { covers: r => r.skills.some(s => s.prefabKey === 'triggerAnim'), note: 'native trigger animation skill' },
  // Caustic Originium Slug: death blast + pollution, and a storm-strength boost when consumed.
  'talent:Boom': { covers: r => (sig(r, 'Boom', ['atk_scale'])
      && r.abilities.some(a => a.text === 'Upon death, deals Physical damage in an area and causes Originium pollution.'))
      || sig(r, 'Boom', ['atk_scale', 'ep_damage_ratio']),
    note: 'death blast is attached by the handbook-line feature',
    note: 'death blast, pollution and a storm boost when consumed',
    explains: text => text === 'Upon death, deals Physical damage in an area and causes Originium pollution.'
      || text === 'Increases the strength of an Active Originium Storm when consumed by it.' },
  'talent:DetectStorm': { covers: r => sig(r, 'DetectStorm', ['range_radius']), note: 'the slug detects the storm' },
  // Chalice of Regret: shares a fraction of nearby non-flying enemies' damage.
  'talent:takeDmg': { covers: r => sig(r, 'takeDmg', ['damage_scale', 'range_radius'])
      && r.abilities.some(a => a.text === 'Shares a fraction of the damage taken by non-aerial enemies around itself.'),
    ability: { kind: 'damageShare', params: r => ({ scale: r.talents.bb['takeDmg.damage_scale'], range: r.talents.bb['takeDmg.range_radius'] }) },
    note: 'takes a fraction of nearby non-flying enemies damage', explains: /^Shares a fraction of the damage taken by non-aerial enemies around itself\.$/ },
  // Altar Keeper: unblockable, slowed when hit, picks up a Beacon and drops it on death.
  'talent:ModeCtrl': { covers: r => sig(r, 'ModeCtrl', ['mode_1', 'move_speed', 'move_speed_duration'])
      && r.abilities.some(a => a.text === 'Unblockable and has reduced movement speed when taking damage.')
      && r.abilities.some(a => a.text === 'Picks up nearby Beacons if it is not carrying a Beacon, and drops them on death.'),
    ability: { kind: 'altarKeeper', params: r => ({ slow: r.talents.bb['ModeCtrl.move_speed'], duration: r.talents.bb['ModeCtrl.move_speed_duration'] }) },
    note: 'unblockable; slows when hit; carries one Beacon and drops it on death',
    explains: text => text === 'Unblockable and has reduced movement speed when taking damage.'
      || text === 'Picks up nearby Beacons if it is not carrying a Beacon, and drops them on death.' },
  'skill:GrabBegin': { covers: r => r.skills.some(s => s.prefabKey === 'GrabBegin'), nativeClaim: () => ({ wrappers: 4 }), note: 'PRTS scripted action' },
  'skill:GrabEnd': { covers: r => r.skills.some(s => s.prefabKey === 'GrabEnd'), note: 'PRTS scripted action' },
  'skill:Click': { covers: r => r.skills.some(s => s.prefabKey === 'Click'), note: 'PRTS scripted action' },
  'skill:Angry': { covers: r => r.skills.some(s => s.prefabKey === 'Angry'), note: 'PRTS scripted action' },
  // Pulse-charged Sarkaz: immune to altar pulses, ordinary attacks become Arts.
  'ability:When coming into contact with a Pulse Wave, this unit instead takes no damage and will deal Arts damage with normal attacks.': {
    covers: r => r.abilities.some(a => a.text === 'When coming into contact with a Pulse Wave, this unit instead takes no damage and will deal Arts damage with normal attacks.'),
    ability: { kind: 'pulseCharged', params: () => ({}) }, nativeClaim: () => ({ active: 3 }),
    note: 'pulse immunity and Arts normal attacks',
    explains: /^When coming into contact with a Pulse Wave, this unit instead takes no damage and will deal Arts damage with normal attacks\.$/ },
  // W: the C4 kit is already installed by KITS; the features document the two ability lines.
  'ability:Can use explosives to deal heavy Physical damage to allied units': {
    covers: r => r.abilities.some(a => a.text === 'Can use explosives to deal heavy Physical damage to allied units'),
    nativeClaim: () => ({ wrappers: 2 }), note: 'C4 kit',
    explains: /^Can use explosives to deal heavy Physical damage to allied units$/ },
  'ability:Uses more explosives when HP is under 50%': {
    covers: r => r.abilities.some(a => a.text === 'Uses more explosives when HP is under 50%'),
    note: 'two C4s below half HP', explains: /^Uses more explosives when HP is under 50%$/ },
  'skill:C4': { covers: r => r.skills.some(s => s.prefabKey === 'C4'), note: 'C4 skill' },
  // Artificer: charges the artillery, with the reviewed deathrattle child.
  'ability:Continuously charges up Londinium Secondary Defense Artillery; when interrupted, the Defense Artillery will lose a portion of its charge progress': {
    covers: r => r.abilities.some(a => a.text.startsWith('Continuously charges up Londinium Secondary Defense Artillery')),
    ability: { kind: 'artilleryCharge', params: () => ({}) }, nativeClaim: () => ({ wrappers: 1 }),
    note: 'artillery charge progress is exposed on the battle; the device is not implemented',
    explains: /^Continuously charges up Londinium Secondary Defense Artillery; when interrupted, the Defense Artillery will lose a portion of its charge progress$/ },
  'skill:charge_gunctrl': { covers: r => r.skills.some(s => s.prefabKey === 'charge_gunctrl'), note: 'artillery charge skill' },
  // Flying text shared by several records.
  'ability:Flying unit.': { covers: r => r.abilities.some(a => a.text === 'Flying unit.'), ability: { kind: 'hover', params: () => ({}) }, note: 'flying unit', explains: /^Flying unit\.$/ },
  // Recon drone: invisible, self-draining, and its attacks charge the artillery (charge state is inert without the device).
  'ability:<$ba.invisible>Invisible</>, gradually loses HP over time': {
    covers: r => r.abilities.some(a => a.text === '<$ba.invisible>Invisible</>, gradually loses HP over time'),
    ability: { kind: 'invisibleDrain', params: () => ({}) },
    nativeClaim: () => ({ active: 3 }), note: 'invisible and self-draining',
    explains: /^<\$ba\.invisible>Invisible<\/>, gradually loses HP over time$/ },
  'ability:Attacks charge Londinium Secondary Defense Artillery': {
    covers: r => r.abilities.some(a => a.text === 'Attacks charge Londinium Secondary Defense Artillery'),
    note: 'artillery charge is inert without the device', explains: /^Attacks charge Londinium Secondary Defense Artillery$/ },
  'talent:charge': { covers: r => sig(r, 'charge', ['sp']), note: 'artillery charge amount' },
  // Inspired extra target.
  'ability:When Inspired, attacks one additional target.': { covers: r => r.abilities.some(a => a.text === 'When Inspired, attacks one additional target.'),
    ability: { kind: 'inspiredTargets', params: () => ({ base: 1, inspired: 2 }) }, note: 'one extra target while Inspired',
    explains: /^When Inspired, attacks one additional target\.$/ },
  // Tile-denial on death.
  'ability:When defeated, the tile underneath becomes unavailable for deployment': {
    covers: r => r.abilities.some(a => a.text === 'When defeated, the tile underneath becomes unavailable for deployment'),
    ability: { kind: 'tileDenied', params: () => ({}) }, nativeClaim: () => ({ active: 1 }),
    note: 'denies deployment on the death tile', explains: /^When defeated, the tile underneath becomes unavailable for deployment$/ },
  // DP-lock caster: halts DP regeneration for a reviewed duration.
  'skill:StopCost': { covers: r => r.skills.some(s => s.prefabKey === 'StopCost'),
    ability: { kind: 'stopCost', params: r => ({ delay: r.skills[0].initCooldown, duration: r.skills[0].bb.projectile_life_time }) },
    nativeClaim: () => ({ wrappers: 1 }), note: 'halts DP regeneration after a delay',
    explains: /^Temporarily halts your DP regeneration shortly after it enters the battlefield$/ },
  'talent:Mode_Fuchou_Anger': { covers: r => sig(r, 'Mode_Fuchou_Anger', ['atk']), note: 'Decode Basis anger ATK value' },
  'talent:Mode_Fuchou_Passive': { covers: r => sig(r, 'Mode_Fuchou_Passive', ['atk', 'base_attack_time', 'def', 'magic_resistance', 'mass_level', 'max_hp', 'move_speed']), note: 'Decode Basis Fuchou table' },
  'talent:Mode_Youling_Passive': { covers: r => sig(r, 'Mode_Youling_Passive', ['atk', 'base_attack_time', 'def', 'magic_resistance', 'mass_level', 'max_hp', 'move_speed']), note: 'Decode Basis Youling table' },
  'talent:Mode_Shushi_Passive': { covers: r => sig(r, 'Mode_Shushi_Passive', ['atk', 'base_attack_time', 'def', 'magic_resistance', 'mass_level', 'max_hp', 'move_speed']), note: 'Decode Basis Shushi table' },
  'skill:ChangeToB': { covers: r => r.skills.some(s => s.prefabKey === 'ChangeToB'), nativeClaim: () => ({ wrappers: 3 }), note: 'Decode Basis form change' },
  'skill:ChangeToC': { covers: r => r.skills.some(s => s.prefabKey === 'ChangeToC'), note: 'Decode Basis form change' },
  'skill:ChangeToD': { covers: r => r.skills.some(s => s.prefabKey === 'ChangeToD'), note: 'Decode Basis form change' },
  // Flying ice bomb: its only effect is disabling a waiting-zone operator; the engine has no waiting zone, so the
  // bomb is inert and stages containing it stay testOnly.
  'skill:CardBoom': { covers: r => r.skills.some(s => s.prefabKey === 'CardBoom'),
    ability: { kind: 'cardBoom', params: () => ({}) }, nativeClaim: () => ({ wrappers: 1 }),
    note: 'flying bomb; waiting-zone disable is not modeled', explains: text => text === 'Flying unit.'
      || text === 'Shortly after it enters the battle, throws a bomb to temporarily disable the Operator with the highest DP cost in your Deployment Waiting Zone' },
  // PRTS stage props: hidden, no-damage controller/node entities. Until the PRTS activation rules are reviewed they are inert,
  // untargetable and do not move or leak; stages that contain them stay testOnly.
  'native:prtsProp': { covers: r => (NATIVE_ONLY_FEATURES[r.key] ?? null) === 'native:prtsProp',
    ability: { kind: 'prtsProp', params: () => ({}) }, nativeClaim: p => String(p.rootName ?? '').includes('10072') ? { active: 1 } : {},
    note: 'inert PRTS controller/node; activation not yet modeled' },
  // Native-only stage prop: the Beacon has no own behaviour in the supported stages.
  'native:beacon': { covers: r => (NATIVE_ONLY_FEATURES[r.key] ?? null) === 'native:beacon',
    note: 'passive stage beacon; pickup belongs to the Altar Keeper', nativeClaim: () => ({ active: 2 }) },
  // Ursus patrol: prioritize the named civilian/Talulah targets.
  'ability:Can use long-ranged weapons to attack <Ursus Civilians> and <Talulah, the Fighter>': {
    covers: r => r.abilities.some(a => a.text === 'Can use long-ranged weapons to attack <Ursus Civilians> and <Talulah, the Fighter>'),
    ability: { kind: 'namedPriority', params: () => ({ names: ['Ursus Civilian', 'Talulah'] }) }, note: 'named-target priority; otherwise normal targeting',
    explains: /^Can use long-ranged weapons to attack <Ursus Civilians> and <Talulah, the Fighter>$/ },
  // Witherer: a lingering corruption zone on death.
  'talent:PollutedDie': { covers: r => sig(r, 'PollutedDie', ['polluted_damage_high', 'polluted_damage_low', 'projectile_life_time', 'projectile_range'])
      && r.abilities.some(a => a.text === 'Releases Corruption when defeated, causing your nearby units to continuously lose HP'),
    ability: { kind: 'pollutedDie', params: r => ({ range: r.talents.bb['PollutedDie.projectile_range'], life: r.talents.bb['PollutedDie.projectile_life_time'],
      low: r.talents.bb['PollutedDie.polluted_damage_low'], high: r.talents.bb['PollutedDie.polluted_damage_high'] }) },
    note: 'leaves a pollution zone on death',
    explains: /^Releases Corruption when defeated, causing your nearby units to continuously lose HP$/ },
  // Rotchaser: an Arts bleed on hit, removed by healing.
  'talent:Bleeding': { covers: r => sig(r, 'Bleeding', ['attack@bleeding_damage', 'attack@duration'])
      && r.abilities.some(a => a.text === 'Attacks cause the target to take Arts damage over time; effect removed when the target is healed'),
    ability: { kind: 'bleedFeature', params: r => ({ bb: r.talents.bb }) }, note: 'Arts damage over time on hit, removed by healing',
    explains: /^Attacks cause the target to take Arts damage over time; effect removed when the target is healed$/ },
  // Sarkaz Caster lasso: an Arts attack that stuns its target for the skill's hit_duration.
  'skill:lasso': { covers: (r, nat) => r.skills.some(s => s.prefabKey === 'lasso' && s.bb.hit_duration === 20 && s.bb.atk_scale === 0.35)
      && r.abilities.some(a => a.text === 'Uses chains to paralyze allied Operators.'),
    ability: { kind: 'lasso', params: r => ({ scale: r.skills[0].bb.atk_scale, duration: r.skills[0].bb.hit_duration }) },
    nativeClaim: () => ({ wrappers: 1 }), note: 'Arts lasso that stuns for hit_duration',
    explains: /^Uses chains to paralyze allied Operators\.$/ },
  // 1321: periodically drops three Seeds of Withering.
  'skill:BornBugs': { covers: r => r.skills.some(s => s.prefabKey === 'BornBugs'), note: 'native BornBugs skill consumed by the seed summoner' },
  'ability:Periodically summons several <Seeds of Decay>': { covers: r => r.abilities.some(a => a.text === 'Periodically summons several <Seeds of Decay>'),
    nativeClaim: () => ({ wrappers: 1 }), note: 'three Seeds of Decay every 10 s',
    explains: /^Periodically summons several <Seeds of Decay>$/ },
  'ability:Periodically summons several <Seeds of Withering>': { covers: r => r.abilities.some(a => a.text === 'Periodically summons several <Seeds of Withering>'),
    ability: { kind: 'seedSummoner', params: () => ({ key: 'enemy_1269_nhfly', count: 3, cooldown: 10, init: 10 }) },
    nativeClaim: () => ({ wrappers: 1 }), note: 'three Seeds of Withering every 10 s',
    explains: /^Periodically summons several <Seeds of Withering>$/ },
  // 1320: a three-Block gate and a first-attack splash.
  'ability:Can only be blocked by Operators with 3 or more Block': { covers: r => r.abilities.some(a => a.text === 'Can only be blocked by Operators with 3 or more Block'),
    ability: { kind: 'requiredBlock', params: () => ({ block: 3 }) }, note: 'needs a blocker with 3 Block',
    explains: /^Can only be blocked by Operators with 3 or more Block$/ },
  'ability:First attack deals Splash damage': { covers: r => r.abilities.some(a => a.text === 'First attack deals Splash damage') && r.skills.some(s => s.prefabKey === 'AOEAttack'),
    ability: { kind: 'firstSplash', params: r => ({ scale: r.talents.bb['AOEAttack.atk_scale'] ?? 1.5 }) },
    nativeClaim: () => ({ wrappers: 1 }), note: 'the first attack splashes around its target', explains: /^First attack deals Splash damage$/ },
  'talent:AOEAttack': { covers: r => sig(r, 'AOEAttack', ['atk_scale']), note: 'firstSplash reads AOEAttack.atk_scale' },
  'skill:AOEAttack': { covers: r => r.skills.some(s => s.prefabKey === 'AOEAttack'), note: 'native AOEAttack skill consumed by firstSplash' },
  // Splitcaster: at half HP it leaves a Virtual Image clone; the clone cannot split again.
  'talent:summon': { covers: r => sig(r, 'summon', ['hp_ratio'])
      && r.abilities.some(a => a.text === 'When HP is below half, creates a <Virtual Image> at their location'),
    ability: { kind: 'virtualImage', params: r => ({ ratio: r.talents.bb['summon.hp_ratio'], key: r.key }) },
    note: 'one Virtual Image clone at the HP threshold',
    explains: /^When HP is below half, creates a <Virtual Image> at their location$/ },
  // Absurdist Operative: three ammo, each attack drains DP and target SP.
  'ability:Attacks reduce DP when carrying ammo. Ammo capacity: 3': { covers: r => r.abilities.some(a => a.text === 'Attacks reduce DP when carrying ammo. Ammo capacity: 3'),
    ability: { kind: 'dpDrain', params: r => ({ cost: r.talents.bb['1.attack@cost'] ?? 0, sp: r.talents.bb['1.attack@sp'] ?? 0 }) },
    note: 'three ammo: each attack drains DP/SP', explains: /^Attacks reduce DP when carrying ammo\. Ammo capacity: 3$/ },
  'talent:1': { covers: r => sig(r, '1', ['attack@cost', 'attack@sp']), note: 'the dpDrain ability reads attack@cost/attack@sp' },
  // Instigator: while unblocked, unrevealed civilians/spies cannot be blocked.
  'ability:When not blocked, all unrevealed Civilians or Spies cannot be blocked': { covers: r => r.abilities.some(a => a.text === 'When not blocked, all unrevealed Civilians or Spies cannot be blocked'),
    ability: { kind: 'identityLock', params: () => ({}) }, note: 'locks unrevealed civilian/spy blocking while unblocked',
    explains: /^When not blocked, all unrevealed Civilians or Spies cannot be blocked$/ },
  // Spy support talents: the movement bonus and the EnhancedAttack scale.
  'talent:moveSpeed': { covers: r => sig(r, 'moveSpeed', ['move_speed']),
    ability: { kind: 'moveSpeedBonus', params: r => ({ mul: 1 + r.talents.bb['moveSpeed.move_speed'] }) },
    note: 'passive movement multiplier' },
  'talent:EnhancedAttack': { covers: r => sig(r, 'EnhancedAttack', ['atk_scale']),
    note: 'the reveal ability consumes EnhancedAttack.atk_scale' },
  // Spies: profile marker plus the two reviewed reveal consequences.
  'ability:Spy': { covers: r => r.abilities.some(a => a.text === 'Spy'),
    ability: { kind: 'spyProfile', params: () => ({}) }, note: 'spy profile; reveal via Battle.revealIdentity',
    nativeClaim: () => ({ active: 1 }), explains: /^Spy$/ },
  'ability:When their identity is revealed, becomes <$ba.invisible>Invisible</>': { covers: r => r.abilities.some(a => a.text === 'When their identity is revealed, becomes <$ba.invisible>Invisible</>'),
    ability: { kind: 'revealedStealth', params: () => ({}) }, note: 'revealed Sentry Spy becomes stealthy',
    explains: /^When their identity is revealed, becomes <\$ba\.invisible>Invisible<\/>$/ },
  "ability:When their identity is revealed, the next attack's ATK is greatly increased": { covers: r => r.abilities.some(a => a.text === "When their identity is revealed, the next attack's ATK is greatly increased"),
    ability: { kind: 'revealedAttack', params: r => ({ scale: r.talents.bb['EnhancedAttack.atk_scale'] ?? 2 }) },
    note: 'revealed Pathfinder Spy arms one scaled attack', explains: /^When their identity is revealed, the next attack's ATK is greatly increased$/ },
  // Norport Civilian: a friendly unit that is not targetable and grants max DP on reaching the objective.
  'ability:Friendly Unit': { covers: r => r.abilities.some(a => a.text === 'Friendly Unit'),
    ability: { kind: 'friendlyUnit', params: () => ({}) }, note: 'friendly, untargetable, objective reward',
    explains: text => text === 'Friendly Unit' || /^Once their identity is confirmed, restores your max DP after retreating to the Objective Point$/.test(text) },
  'talent:civilianTalent': { covers: r => sig(r, 'civilianTalent', ['max_cost']),
    ability: { kind: 'civilianReward', params: r => ({ dp: r.talents.bb['civilianTalent.max_cost'] }) },
    note: 'adds max DP when the civilian reaches the objective' },
  // Sudaram: its attack hits everything around it, and pollution/storm extends the hit to polluted allies.
  'ability:Attacks deal Physical damage to all surrounding units.': {
    covers: r => r.abilities.some(a => a.text === 'Attacks deal Physical damage to all surrounding units.')
      && r.abilities.some(a => a.text === 'When inside Originium pollution or an Active Originium Storm, attacks deal Physical damage to all surrounding allied units and all your units inside Originium pollution or Active Originium Storms.'),
    ability: { kind: 'sudaram', params: () => ({ radius: 1.5 }) }, note: 'self-centred physical AoE; pollution/storm widens the target set',
    explains: text => text === 'Attacks deal Physical damage to all surrounding units.'
      || text === 'When inside Originium pollution or an Active Originium Storm, attacks deal Physical damage to all surrounding allied units and all your units inside Originium pollution or Active Originium Storms.' },
  // Guerrilla Herald: a battlefield-wide ATK/DEF buff for every enemy.
  'talent:strength': { covers: r => (sig(r, 'strength', ['atk', 'def'])
      && r.abilities.some(a => a.text === 'Increases the ATK and DEF of enemy units when on the battlefield.'))
      || (sig(r, 'strength', ['move_speed']) && r.abilities.some(a => a.text === 'When Inspired, gains Movement Speed.'))
      || (sig(r, 'strength', ['atk']) && r.abilities.some(a => a.text === 'When Inspired, gains greatly increased ATK.'))
      || (sig(r, 'strength', ['attack_speed']) && r.abilities.some(a => a.text === 'When Inspired, gains greatly increased ASPD.')),
    ability: { kind: 'strengthAura', params: r => sig(r, 'strength', ['move_speed'])
      ? { mode: 'inspired', move: r.talents.bb['strength.move_speed'] }
      : sig(r, 'strength', ['atk'])
        ? { mode: 'inspired', atkPct: r.talents.bb['strength.atk'] }
        : sig(r, 'strength', ['attack_speed'])
          ? { mode: 'inspired', aspd: r.talents.bb['strength.attack_speed'] }
          : { mode: 'aura', atkPct: r.talents.bb['strength.atk'], defFlat: r.talents.bb['strength.def'] } },
    note: 'all living enemies +atk%/+def while the Herald lives, or Inspired movement/ATK/ASPD',
    explains: text => text === 'Increases the ATK and DEF of enemy units when on the battlefield.'
      || text === 'When Inspired, gains Movement Speed.'
      || text === 'When Inspired, gains greatly increased ATK.'
      || text === 'When Inspired, gains greatly increased ASPD.' },
  'ability:Able to land directly onto the battlefield.': {
    covers: r => r.abilities.some(a => a.text === 'Able to land directly onto the battlefield.'),
    note: 'Landing is the stage spawn placement', explains: /^Able to land directly onto the battlefield\.$/ },
  // Active Originium Storm: a growing storm aura that damages and slows SP recovery.
  'talent:StormAura': { covers: r => sig(r, 'StormAura', ['damage', 'damage_step', 'max_damage', 'max_radius', 'radius_step', 'range_radius', 'sp_recover_ratio']),
    ability: { kind: 'stormAura', params: r => ({ damage: r.talents.bb['StormAura.damage'], damageStep: r.talents.bb['StormAura.damage_step'],
      maxDamage: r.talents.bb['StormAura.max_damage'], radius: r.talents.bb['StormAura.range_radius'], radiusStep: r.talents.bb['StormAura.radius_step'],
      maxRadius: r.talents.bb['StormAura.max_radius'], spRatio: r.talents.bb['StormAura.sp_recover_ratio'] }) },
    note: 'growing storm: damage and SP-recovery debuff', nativeClaim: () => ({ active: 1 }) },
  // Wither Vanguard: ordinary attacks become Arts while standing on an Originium-pollution tile.
  'ability:Attacks deal Arts damage when inside Originium pollution.': { covers: r => r.abilities.some(a => a.text === 'Attacks deal Arts damage when inside Originium pollution.'),
    ability: { kind: 'pollutionArts', params: () => ({}) }, note: 'Arts attacks on toxic tiles',
    explains: /^Attacks deal Arts damage when inside Originium pollution\.$/ },
  // Theater Golem: a four-Block requirement plus a splash around its own body.
  'ability:Can only be blocked by units with at least 4 Block': { covers: r => r.abilities.some(a => a.text === 'Can only be blocked by units with at least 4 Block'),
    ability: { kind: 'requiredBlock', params: () => ({ block: 4 }) }, note: 'needs a blocker with 4 Block',
    explains: /^Can only be blocked by units with at least 4 Block$/ },
  'ability:Attacks deal Splash damage to allied units in a small area around self': { covers: r => r.abilities.some(a => a.text === 'Attacks deal Splash damage to allied units in a small area around self'),
    ability: { kind: 'selfSplash', params: () => ({ radius: 1.5 }) }, note: 'splashes allies around itself',
    explains: /^Attacks deal Splash damage to allied units in a small area around self$/ },
  // Seed of Withering/Decay: detonates when an ally enters its attack range.
  'ability:Self-destructs when near an Operator, dealing Physical damage': { covers: r => r.abilities.some(a => a.text === 'Self-destructs when near an Operator, dealing Physical damage'),
    ability: { kind: 'selfDestruct', params: () => ({ radius: 2 }) }, note: 'physical blast then dies when an ally is near',
    explains: /^Self-destructs when near an Operator, dealing Physical damage$/ },
  // Snowball thrower: the first attack uses first_atk_scale.
  'talent:FirstAttack': { covers: r => sig(r, 'FirstAttack', ['attack@first_atk_scale']),
    ability: { kind: 'firstAttack', params: r => ({ scale: r.talents.bb['FirstAttack.attack@first_atk_scale'] }) },
    note: 'first attack ×scale' },
  // Ability-only melee splash (Originium Colossus): the record carries no talent group, only the sentence.
  'ability:Attacks deal splash damage': { covers: r => r.abilities.some(a => a.text === 'Attacks deal splash damage'),
    ability: { kind: 'splashMelee', params: () => ({}) }, note: 'melee attack splashes around its target',
    explains: /^Attacks deal splash damage$/ },
  'ability:Prioritizes attacking the target with the lowest DEF': { covers: r => r.abilities.some(a => a.text === 'Prioritizes attacking the target with the lowest DEF'),
    ability: { kind: 'targetPriority', params: () => ({ priority: 'lowestDef' }) }, note: 'targets the lowest-DEF ally',
    explains: /^Prioritizes attacking the target with the lowest DEF$/ },
  'ability:Prioritizes attacking the target with the current lowest HP percentage within a small area': { covers: r => r.abilities.some(a => a.text === 'Prioritizes attacking the target with the current lowest HP percentage within a small area'),
    ability: { kind: 'targetPriority', params: () => ({ priority: 'lowestHp' }) }, note: 'targets the lowest-HP-fraction ally in range',
    explains: /^Prioritizes attacking the target with the current lowest HP percentage within a small area$/ },
  // Sarkaz Grudgebearer/Bladeweaver: standby until the first injury (or unmove_duration), then combat-ready.
  'talent:revive': { covers: r => sig(r, 'revive', ['hp_ratio', 'move_speed', 'unmove_duration'])
      && r.abilities.some(a => /^Starts battle in Standby and will not attack; upon being injured, becomes Combat-Ready/.test(a.text)),
    ability: { kind: 'standbyRevive', params: r => ({ ratio: r.talents.bb['revive.hp_ratio'], speed: r.talents.bb['revive.move_speed'],
      unmove: r.talents.bb['revive.unmove_duration'], targets: /attacks two targets/.test(r.abilities.map(a => a.text).join(' ')) ? 2 : 1 }) },
    note: 'standby until injured or unmove_duration, then combat-ready',
    explains: text => /^Starts battle in Standby and will not attack; upon being injured, becomes Combat-Ready/.test(text) },
  // Volleyball cart: ATK stacks per attack, lost on a negative status.
  'talent:AtkUp': { covers: r => sig(r, 'AtkUp', ['atk', 'max_stack_cnt'])
      && r.abilities.some(a => a.text === 'Gains increased ATK with each attack (up to a limit); when affected by certain <$ba.debuff>Negative Statuses</>, these stacks will be lost'),
    ability: { kind: 'atkUpStacks', params: r => ({ atk: r.talents.bb['AtkUp.atk'], max: r.talents.bb['AtkUp.max_stack_cnt'] }) },
    note: 'ATK +atk per attack, capped, cleared by negative statuses',
    explains: /^Gains increased ATK with each attack \(up to a limit\); when affected by certain <\$ba\.debuff>Negative Statuses<\/>, these stacks will be lost$/ },
  // Evade: dodge while unblocked, an initial timed dodge, or a one-time low-HP dodge.
  'talent:Evade': { covers: r => {
      if (sig(r, 'Evade', ['prob']) && r.abilities.some(a => a.text === 'Has a chance to dodge Physical attacks when not blocked')) return true;
      if (sig(r, 'Evade', ['duration', 'prob']) && r.abilities.some(a => a.text === 'Initially has 100% Physical Dodge for a period of time')) return true;
      return sig(r, 'Evade', ['duration', 'hp_ratio', 'prob'])
        && r.abilities.some(a => a.text === 'Upon dropping below half HP for the first time, gains 100% Physical Dodge for a period of time');
    },
    ability: { kind: 'evade', params: r => {
      const bb = r.talents.bb;
      if (sig(r, 'Evade', ['prob'])) return { mode: 'unblocked', prob: bb['Evade.prob'] };
      if (sig(r, 'Evade', ['duration', 'prob'])) return { mode: 'timed', prob: bb['Evade.prob'], duration: bb['Evade.duration'], silent: true };
      return { mode: 'low', prob: bb['Evade.prob'], duration: bb['Evade.duration'], ratio: bb['Evade.hp_ratio'], silent: true };
    } },
    note: 'physical dodge: unblocked, initial timed, or first low-HP', explains: text =>
      text === 'Has a chance to dodge Physical attacks when not blocked'
      || text === 'Initially has 100% Physical Dodge for a period of time'
      || text === 'Upon dropping below half HP for the first time, gains 100% Physical Dodge for a period of time' },
  // Rhine Defense: a one-hit Physical/Arts shield.
  'talent:Shield': { covers: r => sig(r, 'Shield', ['block_damage_cnt', 'max_block_damage_cnt'])
      && r.abilities.some(a => a.text === 'Blocks 1 instance of Physical or Arts damage'),
    ability: { kind: 'hitShield', params: r => ({ count: r.talents.bb['Shield.max_block_damage_cnt'] }) },
    note: 'blocks max_block_damage_cnt Physical/Arts hits', explains: /^Blocks 1 instance of Physical or Arts damage$/ },
  // Roar Knightclub: a timed flat DEF/RES buff declared by the record.
  'talent:buff': { covers: r => sig(r, 'buff', ['def', 'duration', 'magic_resistance'])
      && r.abilities.some(a => /^(Has significantly increased DEF and RES for a period of time|Starts with significantly increased DEF and RES, persists for a long period\.)$/.test(a.text)),
    ability: { kind: 'timedStatBuff', params: r => ({ def: r.talents.bb['buff.def'], res: r.talents.bb['buff.magic_resistance'], duration: r.talents.bb['buff.duration'] }) },
    note: 'timed DEF +def and RES +res', explains: text => /^(Has significantly increased DEF and RES for a period of time|Starts with significantly increased DEF and RES, persists for a long period\.)$/.test(text) },
  // Sankta: first HP drop below half applies self-fear and a temporary movement multiplier.
  'talent:SelfFear': { covers: r => sig(r, 'SelfFear', ['fear', 'move_speed', 'speed_duration'])
      && r.abilities.some(a => a.text === 'Gains <$ba.fear>Fear</> for several seconds when its HP drops below 50% for the first time'),
    ability: { kind: 'selfFear', params: r => ({ fear: r.talents.bb['SelfFear.fear'], moveSpeed: r.talents.bb['SelfFear.move_speed'],
      duration: r.talents.bb['SelfFear.speed_duration'] }) },
    note: 'first HP<50%: self-fear and move speed for speed_duration',
    explains: /^Gains <\$ba\.fear>Fear<\/> for several seconds when its HP drops below 50% for the first time$/ },
  // Tiacauh: flat DEF while blocked; the Ritualist/Shaman also has a reviewed 4× melee attack.
  'talent:Def': { covers: r => sig(r, 'Def', ['def']) && r.abilities.some(a => a.text.startsWith('Gains DEF when blocked')),
    ability: { kind: 'blockedDef', params: r => ({ def: r.talents.bb['Def.def'] }) },
    note: 'flat DEF while blocked', explains: text => text.startsWith('Gains DEF when blocked') },
  'talent:combat': { covers: r => sig(r, 'combat', ['attack@ccwitch_rage_attack.atk_scale'])
      && r.abilities.some(a => /deals (high )?Physical damage with melee attacks/.test(a.text)),
    ability: { kind: 'meleeAttackScale', params: r => ({ scale: r.talents.bb['combat.attack@ccwitch_rage_attack.atk_scale'] }) },
    note: 'melee attack ×scale', explains: text => /deals (high )?Physical damage with melee attacks/.test(text) },
  // Reborn-Creation auras. Hatedrinker buffs itself per creation; the ASV buffs the creations and makes their
  // attacks add Necrosis. Both read the bloodsucker marker from E10.
  'talent:aura': {
    covers: r => r.abilities.some(a => a.text === ASV_TEXT) ? !!asvAura(r)
      : sig(r, 'aura', ['atk', 'max_valid_stack_cnt']) && r.abilities.some(a => a.text === HATEDRINKER_TEXT),
    ability: { kind: 'aura', params: r => r.abilities.some(a => a.text === ASV_TEXT)
      ? { mode: 'asv', ...asvAura(r) }
      : { mode: 'rebornAtk', atk: r.talents.bb['aura.atk'], max: r.talents.bb['aura.max_valid_stack_cnt'] } },
    note: 'Hatedrinker self ATK per creation, or ASV creation ATK + Necrosis', explains: text => text === HATEDRINKER_TEXT || text === ASV_TEXT },
  // 吸血 (vampire): attacks up to max_target and heals heal_scale × the damage actually dealt. The single-target
  // signature omits max_target; the record then keeps the engine's one target.
  ...familyAny(['vampire'], [['attack@max_target', 'heal_scale'], ['heal_scale']], g => ({ kind: 'vampireOnHit', params: r => ({
    maxTargets: r.talents.bb[`${g}.attack@max_target`] ?? 1, healScale: r.talents.bb[`${g}.heal_scale`] }) }),
    r => r.abilities.some(a => /restore HP proportional to damage dealt/i.test(a.text) || /Restores a certain amount of HP after each attack/.test(a.text)),
    'attacks up to max_target and heals heal_scale × damage dealt', null,
    (text, record) => /^Attacks restore HP proportional to damage dealt$/.test(text)
      || /^Restores a certain amount of HP after each attack, based upon damage dealt$/.test(text)
      || text === `Attacks ${record.talents.bb['vampire.attack@max_target'] ?? 1} enemies simultaneously`),
  // Element damage on every attack hit: ATK x attack@ep_damage_ratio of the element its handbook line names.
  ...family(['EpDamage'], ['attack@ep_damage_ratio'], g => ({ kind: 'elementOnHit', params: r => ({ element: elementOf(r), ratio: r.talents.bb[`${g}.attack@ep_damage_ratio`] }) }),
    r => !!elementOf(r), 'element damage on every attack hit', null,
    /^(Every attack deals|Attacks inflict additional|Attacks deal) <\$ba\.dt\.(erosion|neural|apoptosis|burning)>[^<]*<\/>\.?$/),
  'talent:epdamage': { covers: r =>
      (sig(r, 'epdamage', ['attack@ep_damage_ratio']) && (!r.abilities.length || (!!elementOf(r)
        && r.abilities.some(a => /^(Every attack deals|Attacks inflict additional|Attacks deal) <\$ba\.dt\.(erosion|neural|apoptosis|burning)>[^<]*<\/>\.?$/.test(a.text)))))
      || (sig(r, 'epdamage', ['attack@chain.atk_scale', 'attack@ep_damage_ratio', 'attack@max_target', 'attack@projectile_range'])
        && r.abilities.some(a => /^Attacks deal <\$ba\.dt\.apoptosis>Necrosis damage<\/> and jump between \d+ targets, with each jump dealing reduced damage$/.test(a.text))),
    ability: { kind: 'elementOnHit', params: r => {
      if (sig(r, 'epdamage', ['attack@chain.atk_scale', 'attack@ep_damage_ratio', 'attack@max_target', 'attack@projectile_range']))
        return { chain: true, element: elementOf(r), ratio: r.talents.bb['epdamage.attack@ep_damage_ratio'],
          maxTargets: r.talents.bb['epdamage.attack@max_target'], chainScale: r.talents.bb['epdamage.attack@chain.atk_scale'],
          range: r.talents.bb['epdamage.attack@projectile_range'] };
      if (!r.abilities.length) return { element: 'burn', ratio: r.talents.bb['epdamage.attack@ep_damage_ratio'] };
      return { element: elementOf(r), ratio: r.talents.bb['epdamage.attack@ep_damage_ratio'] };
    } },
    note: 'element damage on every attack hit, or a chain that jumps with falloff', explains: text =>
      /^(Every attack deals|Attacks inflict additional|Attacks deal) <\$ba\.dt\.(erosion|neural|apoptosis|burning)>[^<]*<\/>\.?$/.test(text)
      || /^Attacks deal <\$ba\.dt\.apoptosis>Necrosis damage<\/> and jump between \d+ targets, with each jump dealing reduced damage$/.test(text) },
  // "Spawns N <X> when defeated": cnt enemy_key on death; supported only when the spawned enemy is.
  ...family(['DeadSpawn'], ['cnt', 'enemy_key'], g => ({ kind: 'deathSpawn', params: r => ({ key: r.talents.bbStr[`${g}.enemy_key`], cnt: r.talents.bb[`${g}.cnt`] }) }),
    r => true, 'spawns cnt enemy_key when killed', r => Object.entries(r.talents.bbStr).filter(([k]) => /^deadspawn\.enemy_key$/i.test(k)).map(([, v]) => v),
    /^Spawns \d+ <[^>]+> when defeated$/),
  // "Splits into N <X> upon death" (deathrattle): cnt children after `delay` s, spread around the parent's tile.
  'talent:deathrattle': { covers: r => (r.skills.length === 0
      && sig(r, 'deathrattle', ['cnt', 'delay', 'enemy_key', 'offset_bound'])
      && r.abilities.some(a => /^Splits into \d+ <[^>]+> upon death$/.test(a.text)))
      || (sig(r, 'deathrattle', ['delay', 'enemy_key'])
        && r.abilities.some(a => /^Will be reborn as a <[^>]+> after falling in battle for the first time$/.test(a.text))),
    ability: { kind: 'deathSpawnDelayed', params: r => ({ key: r.talents.bbStr['deathrattle.enemy_key'],
      cnt: r.talents.bb['deathrattle.cnt'] ?? 1, delay: r.talents.bb['deathrattle.delay'] ?? 0 }) },
    note: 'splits/reborn as cnt child(ren) after delay s', dependsOn: r => [r.talents.bbStr['deathrattle.enemy_key']].filter(Boolean),
    explains: text => /^Splits into \d+ <[^>]+> upon death$/.test(text)
      || /^Will be reborn as a <[^>]+> after falling in battle for the first time$/.test(text) },
  // Reborn Creation (Sarkaz Heirbearer family): damage reduction from the reviewed template plus the blocker's
  // +block-count buff. The active bloodsucker marker is the native common ability both features claim.
  'talent:dmg_res': { covers: (r, nat) => sig(r, 'dmg_res', ['damage_resistance']) && isRebornCreation(nat),
    ability: { kind: 'rebornDamageRes', params: r => ({ pct: r.talents.bb['dmg_res.damage_resistance'] }) },
    note: 'Physical/Arts damage ×(1-pct) and the bloodsucker marker', nativeClaim: () => ({ active: 1 }),
    explains: /^Reborn Creation \(takes greatly reduced Physical and Arts damage\)$/ },
  'talent:buff_to_blocker': { covers: (r, nat) => sig(r, 'buff_to_blocker', ['block_cnt', 'max_valid_stack_cnt']) && isRebornCreation(nat),
    ability: { kind: 'blockerBlockUp', params: r => ({ n: r.talents.bb['buff_to_blocker.block_cnt'], max: r.talents.bb['buff_to_blocker.max_valid_stack_cnt'] }) },
    note: 'the current blocker gains +block_cnt Block', explains: /^Units blocking it gain \+1 Block \(up to a maximum of \+6\)$/ },
  // "When blocked, significantly reduces the blocker's ASPD": a flat ASPD delta while this enemy is the blocker's.
  'talent:atkSpeedDown': {
    covers: r => sig(r, 'atkSpeedDown', ['attack_speed']) && (r.abilities.some(a => a.text === "When blocked, significantly reduces the blocker's ASPD")
      || (r.abilities.some(a => a.text === 'All friendly units within range have reduced ASPD') && sig(r, 'defup', ['range_radius']))),
    ability: { kind: 'aspdDown', params: r => r.abilities.some(a => a.text === 'All friendly units within range have reduced ASPD')
      ? { mode: 'aura', aspd: r.talents.bb['atkSpeedDown.attack_speed'] * 100, range: r.talents.bb['defup.range_radius'] }
      : { mode: 'blocker', aspd: r.talents.bb['atkSpeedDown.attack_speed'] * 100 } },
    note: "blocker's flat ASPD delta, or Frost's ally aura", explains: text => text === "When blocked, significantly reduces the blocker's ASPD"
      || text === 'All friendly units within range have reduced ASPD' },
  // Defender-4: a DEF aura on other enemies within range_radius (silence-aware). Frost shares the range group but has no DEF.
  'talent:defup': { covers: r => (sig(r, 'defup', ['def', 'range_radius']) && r.abilities.some(a => a.text === 'Increases the DEF of surrounding enemy units'))
      || (sig(r, 'defup', ['range_radius']) && r.abilities.some(a => a.text === 'All friendly units within range have reduced ASPD')),
    ability: { kind: 'enemyDefAura', params: r => ({ def: r.talents.bb['defup.def'] ?? 0, r: r.talents.bb['defup.range_radius'] }) },
    note: 'other enemies within range_radius gain DEF +def (zero for Frost)', explains: /^Increases the DEF of surrounding enemy units$/ },
  // Death blast (boom): atk_scale × ATK around the corpse; the cold/elemental variants add their reviewed status or
  // element. Records whose line names anything else (ignite Reeds, seize Gramophones, grant Energy) are not covered.
  'talent:boom': { covers: r => coversDeathBlast(r, 'boom'),
    ability: { kind: 'deathBoom', params: r => deathBlastParams(r, 'boom') },
    note: 'death blast: atk_scale × ATK, with the reviewed cold/elemental rider', explains: deathBlastText },
  // DefDown: every attack hit adds a permanent, uncapped stack of DEF +defdown.def (flat) to the operator hit
  // (PRTS 酸液源石虫 天赋 corroborates: 防御力-10, 可无限叠加, linear in stacks).
  'talent:defdown': { covers: (r, nat) => sig(r, 'defdown', ['def']) && r.talents.bb['defdown.def'] < 0
      && (isStackingDefDown(nat) || isGrenadeDefDown(r, nat)),
    ability: { kind: 'defDownOnHit', params: r => r.abilities.some(a => a.text.startsWith('Launches grenades'))
      ? { pct: r.talents.bb['defdown.def'], duration: 5, area: true }
      : { def: r.talents.bb['defdown.def'] } },
    note: 'acid: permanent stacking DEF; Skullshatterer grenade: 5 s DEF ×defdown.def in the target area',
    explains: text => text === "Every attack reduces the enemy's DEF" || text.startsWith('Launches grenades when not being blocked') },
  // enhance (沸血骑士团): each enemy-side unit killed anywhere on the field (isolation ignored) gives one permanent stack of
  // ATK +atk (×) and ASPD +attack_speed, up to max_stack_cnt (PRTS 沸血骑士团学徒 天赋 corroborates: 场上每有一名敌方单位
  // 死亡时 攻击力+10%，攻击速度+5，最多叠加10次).
  'talent:enhance': { covers: (r, nat) => sig(r, 'enhance', ['atk', 'attack_speed', 'max_stack_cnt']) && isAllyDeathEnhance(r, nat),
    ability: { kind: 'allyDeathStacks', params: r => ({ atk: r.talents.bb['enhance.atk'], aspd: r.talents.bb['enhance.attack_speed'], max: r.talents.bb['enhance.max_stack_cnt'] }) },
    note: 'stacks ATK/ASPD per enemy-side death', explains: /^Each time an enemy is defeated, gains ATK and ASPD, stacking up to 10 times\.$/ },
  'ability:First Form': { covers: r => r.key === 'enemy_1522_captan' && (sig(r, 'Reborn', ['duration', 'location', 'reborn_invincible.duration']) || sig(r, 'Reborn', ['location'])) && r.skills.some(x => x.prefabKey === 'SummonBmbmot'),
    ability: { kind: 'pancho', params: () => ({}) }, nativeClaim: () => ({ wrappers: 5 }),
    note: 'Pancho: two forms, summons, water cannon, burst shot, whirlwind and form-two stats' },
  'ability:Summons <Kites> and <Pancho\'s Explosive Boats> in battle': { covers: r => r.key === 'enemy_1522_captan', note: 'summoned by the pancho ability' },
  'ability:Attacks the unit with the highest Max HP with its water cannon, continuously dealing Arts and <$ba.dt.erosion>Corrosion damage</>': { covers: r => r.key === 'enemy_1522_captan', note: 'water cannon in the pancho ability' },
  "ability:The first time HP drops to 0, jumps to a fixed spot and enters Second Form": { covers: r => r.key === 'enemy_1522_captan', note: 'form transition in the pancho ability' },
  'ability:Second Form': { covers: r => r.key === 'enemy_1522_captan', note: 'form-two state in the pancho ability' },
  'ability:Gains increased ASPD and periodically attacks all surrounding allied units': { covers: r => r.key === 'enemy_1522_captan', note: 'whirlwind in the pancho ability' },
  'ability:Attacks the unit with the highest DEF with its small arms, and reduces the target\'s DEF': { covers: r => r.key === 'enemy_1522_captan', note: 'burst shot in the pancho ability' },
  'ability:When Pancho defeats a unit or is defeated, increases the ASPD and Movement Speed of all enemy units': { covers: r => r.key === 'enemy_1522_captan', note: 'encourage in the pancho ability' },
  'talent:AttackSpeedUp': { covers: r => r.key === 'enemy_1522_captan', note: 'pancho form-two ASPD' },
  'talent:Encourage': { covers: r => r.key === 'enemy_1522_captan', note: 'pancho kill buff' },
  'talent:DeathEncourage': { covers: r => r.key === 'enemy_1522_captan', note: 'pancho death buff' },
  'skill:SummonFcanon': { covers: r => r.key === 'enemy_1522_captan', note: 'handled by the pancho ability' },
  'skill:SummonBmbmot': { covers: r => r.key === 'enemy_1522_captan', note: 'handled by the pancho ability' },
  'skill:WaterCannon': { covers: r => r.key === 'enemy_1522_captan', note: 'handled by the pancho ability' },
  'skill:Whirlwind': { covers: r => r.key === 'enemy_1522_captan', note: 'handled by the pancho ability' },
  'skill:BurstShoot': { covers: r => r.key === 'enemy_1522_captan', note: 'handled by the pancho ability' },
  'ability:Immune to Erosion. While in water, gains increased ATK and <$ba.invisible>Invisibility</>': {
    covers: r => sig(r, 'Swim', ['atk']) && r.talents.bb['Swim.atk'] >= 0,
    ability: { kind: 'swim', params: r => ({ atk: r.talents.bb['Swim.atk'] ?? 0 }) },
    note: 'immune to Erosion; while flooded, ATK +Swim.atk and Invisible', explains: /^Immune to Erosion\. While in water/ },
  'talent:Swim': { covers: r => sig(r, 'Swim', ['atk']), note: 'swim behaviour is attached by the handbook-line feature' },
  'ability:Attacks deal damage to the target and all allied units in the target\'s four adjacent tiles, additionally inflicting <$ba.dt.erosion>Corrosion Damage</>': {
    covers: r => sig(r, 'EpDamage', ['attack@ep_damage_ratio']) && r.talents.bb['EpDamage.attack@ep_damage_ratio'] > 0,
    ability: { kind: 'splashCorrosion', params: r => ({ ratio: r.talents.bb['EpDamage.attack@ep_damage_ratio'] }) },
    note: 'four-neighbour splash plus erosion equal to ATK × ep_damage_ratio', explains: /four adjacent tiles/, nativeClaim: () => ({ active: 1 }) },
  'talent:EpDamage': { covers: r => sig(r, 'EpDamage', ['attack@ep_damage_ratio']), note: 'splash erosion is attached by the handbook-line feature' },
  'ability:First Form': { covers: r => r.key === 'enemy_1522_captan' && (sig(r, 'Reborn', ['duration', 'location', 'reborn_invincible.duration']) || sig(r, 'Reborn', ['location'])) && r.skills.some(x => x.prefabKey === 'SummonBmbmot'),
    ability: { kind: 'pancho', params: () => ({}) }, nativeClaim: () => ({ wrappers: 5 }),
    note: 'Pancho: two forms, summons, water cannon, burst shot, whirlwind and form-two stats' },
  'ability:Summons <Kites> and <Pancho\'s Explosive Boats> in battle': { covers: r => r.key === 'enemy_1522_captan', note: 'summoned by the pancho ability' },
  'ability:Attacks the unit with the highest Max HP with its water cannon, continuously dealing Arts and <$ba.dt.erosion>Corrosion damage</>': { covers: r => r.key === 'enemy_1522_captan', note: 'water cannon in the pancho ability' },
  "ability:The first time HP drops to 0, jumps to a fixed spot and enters Second Form": { covers: r => r.key === 'enemy_1522_captan', note: 'form transition in the pancho ability' },
  'ability:Second Form': { covers: r => r.key === 'enemy_1522_captan', note: 'form-two state in the pancho ability' },
  'ability:Gains increased ASPD and periodically attacks all surrounding allied units': { covers: r => r.key === 'enemy_1522_captan', note: 'whirlwind in the pancho ability' },
  'ability:Attacks the unit with the highest DEF with its small arms, and reduces the target\'s DEF': { covers: r => r.key === 'enemy_1522_captan', note: 'burst shot in the pancho ability' },
  'ability:When Pancho defeats a unit or is defeated, increases the ASPD and Movement Speed of all enemy units': { covers: r => r.key === 'enemy_1522_captan', note: 'encourage in the pancho ability' },
  'talent:AttackSpeedUp': { covers: r => r.key === 'enemy_1522_captan', note: 'pancho form-two ASPD' },
  'talent:Encourage': { covers: r => r.key === 'enemy_1522_captan', note: 'pancho kill buff' },
  'talent:DeathEncourage': { covers: r => r.key === 'enemy_1522_captan', note: 'pancho death buff' },
  'skill:SummonFcanon': { covers: r => r.key === 'enemy_1522_captan', note: 'handled by the pancho ability' },
  'skill:SummonBmbmot': { covers: r => r.key === 'enemy_1522_captan', note: 'handled by the pancho ability' },
  'skill:WaterCannon': { covers: r => r.key === 'enemy_1522_captan', note: 'handled by the pancho ability' },
  'skill:Whirlwind': { covers: r => r.key === 'enemy_1522_captan', note: 'handled by the pancho ability' },
  'skill:BurstShoot': { covers: r => r.key === 'enemy_1522_captan', note: 'handled by the pancho ability' },
  'ability:Immune to Erosion. While in water, gains increased ATK and <$ba.invisible>Invisibility</>': {
    covers: r => sig(r, 'Swim', ['atk']) && r.talents.bb['Swim.atk'] >= 0,
    ability: { kind: 'swim', params: r => ({ atk: r.talents.bb['Swim.atk'] ?? 0 }) },
    note: 'immune to Erosion; while flooded, ATK +Swim.atk and Invisible', explains: /^Immune to Erosion\. While in water/ },
  'talent:Swim': { covers: r => sig(r, 'Swim', ['atk']), note: 'swim behaviour is attached by the handbook-line feature' },
  'ability:Attacks deal damage to the target and all allied units in the target\'s four adjacent tiles, additionally inflicting <$ba.dt.erosion>Corrosion Damage</>': {
    covers: r => sig(r, 'EpDamage', ['attack@ep_damage_ratio']) && r.talents.bb['EpDamage.attack@ep_damage_ratio'] > 0,
    ability: { kind: 'splashCorrosion', params: r => ({ ratio: r.talents.bb['EpDamage.attack@ep_damage_ratio'] }) },
    note: 'four-neighbour splash plus erosion equal to ATK × ep_damage_ratio', explains: /four adjacent tiles/ },
  'talent:EpDamage': { covers: r => sig(r, 'EpDamage', ['attack@ep_damage_ratio']), note: 'splash erosion is attached by the handbook-line feature' },
  'ability:Attacks 2 targets simultaneously': { covers: r => r.applyWay === 'RANGED' && r.stats.rangeRadius > 0, trait: { maxTargets: 2 }, note: 'two ranged targets per attack' },
});

/** Ability lines that carry a number: matched by pattern, then checked against the record. */
export const ENEMY_FEATURE_PATTERNS = Object.freeze([
  // 频次 ("Must be damaged N times to defeat"): N hits; the record's max HP is N.
  { re: /^Must be damaged (\d+) times to defeat$/, make: m => ({ covers: r => r.stats.maxHp === Number(m[1]), ability: { kind: 'times', params: () => ({ artsOnly: false }) },
    note: 'hit count equal to max HP' }) },
  { re: /^Must be damaged (\d+) times by Arts or True damage to defeat$/, make: m => ({ covers: r => r.stats.maxHp === Number(m[1]),
    ability: { kind: 'times', params: () => ({ artsOnly: true }) }, note: 'Arts/True hit count equal to max HP' }) },
  // "Can only be blocked by units with at least N Block": block weight N.
  { re: /^Can only be blocked by units with at least (\d+) Block$/, make: m => ({ covers: () => true, ability: { kind: 'blockWeight', params: () => ({ n: Number(m[1]) }) },
    note: 'block weight N' }) },
]);
/** The registered feature for an id, exact or by pattern. */
export function enemyFeature(id) {
  if (Object.hasOwn(ENEMY_FEATURES, id)) return ENEMY_FEATURES[id];
  if (Object.hasOwn(CHAPTER16_FEATURES, id)) return CHAPTER16_FEATURES[id];
  if (!id.startsWith('ability:')) return null;
  const text = id.slice('ability:'.length);
  for (const p of ENEMY_FEATURE_PATTERNS) { const m = text.match(p.re); if (m) return p.make(m); }
  return null;
}

/** The features one compiled record uses. */
export function recordFeatureIds(record) {
  return [...new Set([
    ...record.abilities.map(a => `ability:${a.text}`),
    ...Object.keys(record.talents.groups).map(g => `talent:${g}`),
    ...record.skills.map(s => `skill:${s.prefabKey}`),
    ...(NATIVE_ONLY_FEATURES[record.key] ? [NATIVE_ONLY_FEATURES[record.key]] : []),
  ])];
}
