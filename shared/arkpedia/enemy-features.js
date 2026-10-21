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
    covers: r => r.talents.groups[group].includes('duration') && r.talents.groups[group].every(p => REBORN_PARAMS.has(p)),
    ability: { kind: 'reborn', params: r => ({ dur: r.talents.bb[`${group}.duration`], hpRatio: r.talents.bb[`${group}.hp_ratio`] ?? 1,
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
    explains: /^(Starts imprisoned\. When imprisoned, ASPD is reduced|Freed after a few attacks, gaining increased ATK)$/ },
  'talent:liberty': { covers: r => CONFINEMENT_SIGS.some(p => sig(r, 'confinement', p)) && LIBERTY_SIGS.some(p => sig(r, 'liberty', p)),
    note: 'the liberty buffs of the confinement feature' },
  // 嘲讽: "More likely to be targeted by attacks" — taunt level +taunt_level.
  'talent:taunt': { covers: r => sig(r, 'taunt', ['taunt_level']), ability: { kind: 'taunt', params: r => ({ n: r.talents.bb['taunt.taunt_level'] }) },
    note: 'taunt level', explains: /^More likely to be targeted by attacks\.$/ },
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
    r => r.abilities.some(a => a.text.includes('<$ba.refraction>')), 'RES +magic_resistance while not silenced', null, /^<\$ba\.refraction>Refraction<\/>$/),
  // "Gains significantly increased ATK when HP is under 50%": ATK +atk once HP first drops below half.
  ...family(['atkup'], ['atk'], g => ({ kind: 'lowHpBuff', params: r => ({ ratio: 0.5, mods: { atkPct: r.talents.bb[`${g}.atk`] } }) }),
    r => r.abilities.some(a => /under 50%/.test(a.text) && /ATK/.test(a.text)), 'ATK +atk below 50% HP (ratio from the handbook line)', null,
    /^Gains significantly increased ATK when HP is under 50%$/),
  // Element damage on every attack hit: ATK x attack@ep_damage_ratio of the element its handbook line names.
  ...family(['epdamage', 'EpDamage'], ['attack@ep_damage_ratio'], g => ({ kind: 'elementOnHit', params: r => ({ element: elementOf(r), ratio: r.talents.bb[`${g}.attack@ep_damage_ratio`] }) }),
    r => !!elementOf(r), 'element damage on every attack hit', null,
    /^(Every attack deals|Attacks inflict additional|Attacks deal) <\$ba\.dt\.(erosion|neural|apoptosis|burning)>[^<]*<\/>\.?$/),
  // "Spawns N <X> when defeated": cnt enemy_key on death; supported only when the spawned enemy is.
  ...family(['DeadSpawn'], ['cnt', 'enemy_key'], g => ({ kind: 'deathSpawn', params: r => ({ key: r.talents.bbStr[`${g}.enemy_key`], cnt: r.talents.bb[`${g}.cnt`] }) }),
    r => true, 'spawns cnt enemy_key when killed', r => Object.entries(r.talents.bbStr).filter(([k]) => /^deadspawn\.enemy_key$/i.test(k)).map(([, v]) => v),
    /^Spawns \d+ <[^>]+> when defeated$/),
  // "Splits into N <X> upon death" (deathrattle): cnt children after `delay` s, spread around the parent's tile.
  'talent:deathrattle': { covers: r => sig(r, 'deathrattle', ['cnt', 'delay', 'enemy_key', 'offset_bound']) && r.skills.length === 0
      && r.abilities.some(a => /^Splits into \d+ <[^>]+> upon death$/.test(a.text)),
    ability: { kind: 'deathSpawnDelayed', params: r => ({ key: r.talents.bbStr['deathrattle.enemy_key'], cnt: r.talents.bb['deathrattle.cnt'],
      delay: r.talents.bb['deathrattle.delay'] ?? 0 }) },
    note: 'splits into cnt children after delay s', dependsOn: r => [r.talents.bbStr['deathrattle.enemy_key']].filter(Boolean),
    explains: /^Splits into \d+ <[^>]+> upon death$/ },
  // Death blast (boom): atk_scale × ATK around the corpse; the cold/elemental variants add their reviewed status or
  // element. Records whose line names anything else (ignite Reeds, seize Gramophones, grant Energy) are not covered.
  'talent:boom': { covers: r => coversDeathBlast(r, 'boom'),
    ability: { kind: 'deathBoom', params: r => deathBlastParams(r, 'boom') },
    note: 'death blast: atk_scale × ATK, with the reviewed cold/elemental rider', explains: deathBlastText },
  // DefDown: every attack hit adds a permanent, uncapped stack of DEF +defdown.def (flat) to the operator hit
  // (PRTS 酸液源石虫 天赋 corroborates: 防御力-10, 可无限叠加, linear in stacks).
  'talent:defdown': { covers: (r, nat) => sig(r, 'defdown', ['def']) && r.talents.bb['defdown.def'] < 0 && isStackingDefDown(nat),
    ability: { kind: 'defDownOnHit', params: r => ({ def: r.talents.bb['defdown.def'] }) },
    note: 'each hit: permanent stacking DEF +def on the target', explains: /^Every attack reduces the enemy's DEF$/ },
  // enhance (沸血骑士团): each enemy-side unit killed anywhere on the field (isolation ignored) gives one permanent stack of
  // ATK +atk (×) and ASPD +attack_speed, up to max_stack_cnt (PRTS 沸血骑士团学徒 天赋 corroborates: 场上每有一名敌方单位
  // 死亡时 攻击力+10%，攻击速度+5，最多叠加10次).
  'talent:enhance': { covers: (r, nat) => sig(r, 'enhance', ['atk', 'attack_speed', 'max_stack_cnt']) && isAllyDeathEnhance(r, nat),
    ability: { kind: 'allyDeathStacks', params: r => ({ atk: r.talents.bb['enhance.atk'], aspd: r.talents.bb['enhance.attack_speed'], max: r.talents.bb['enhance.max_stack_cnt'] }) },
    note: 'stacks ATK/ASPD per enemy-side death', explains: /^Each time an enemy is defeated, gains ATK and ASPD, stacking up to 10 times\.$/ },
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
  ])];
}
