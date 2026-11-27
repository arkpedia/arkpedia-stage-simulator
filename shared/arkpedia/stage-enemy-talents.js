// SPDX-License-Identifier: GPL-3.0-or-later
import { enemyFeature, recordFeatureIds } from './enemy-features.js';

/** Cooldown scaling is separate from skill blackboard values and attack/SP clocks. */
export function applyStageEnemySkillCooldown(record, scale) {
  if (scale == null || scale === 1) return record;
  if (!Number.isFinite(scale) || scale <= 0) throw Error('Invalid enemy skill cooldown scale');
  const skills = record.skills.filter(s => s.cooldown > 0 || s.initCooldown > 0);
  if (!skills.length) return record;
  const features = recordFeatureIds(record).map(id => enemyFeature(id)).filter(Boolean);
  for (const skill of skills) {
    const validators = features.map(f => f.stageSkillCooldown?.[skill.prefabKey]).filter(Boolean);
    if (!validators.length || !validators.every(check => check(record, skill, scale)))
      throw Error(`Unsupported enemy skill cooldown scale: ${record.key}.${skill.prefabKey}`);
  }
  return { ...record, stageSkillCooldownScale: scale };
}

/** `enemy_skill_cd_mul` (six-star 15-6, 15-7): one skill's periodic cooldown, not its first delay (PRTS 技能周期冷却时间).
 * Reviewed for the Prototype Auto Meal Distributor's Spawn only, which periodicSpawn reads from the record. */
const SKILL_PERIOD_TARGETS = Object.freeze({ enemy_10077_mpbarr: Object.freeze({ Spawn: 5 }) });
export function applyStageEnemySkillPeriod(record, scoped) {
  if (!scoped) return record;
  const skills = record.skills.map(skill => {
    const scale = scoped[skill.prefabKey];
    if (scale == null) return skill;
    if (SKILL_PERIOD_TARGETS[record.key]?.[skill.prefabKey] !== skill.cooldown) throw Error(`Unsupported enemy skill cooldown rule: ${record.key}.${skill.prefabKey}`);
    return { ...skill, cooldown: skill.cooldown * scale };
  });
  if (Object.keys(scoped).some(key => !record.skills.some(s => s.prefabKey === key))) throw Error(`Unknown enemy skill: ${record.key}`);
  return { ...record, skills };
}

/** A stage can scale only parameters explicitly exposed by an implemented
 * feature. It cannot create a talent, change a spawn ID, or register behavior. */
export function applyStageEnemyTalentMultipliers(record, multipliers, additions = {}) {
  const result = structuredClone(record);
  const declarations = recordFeatureIds(record).map(id => enemyFeature(id)?.stageMultipliers).filter(Boolean);
  for (const [key, multiplier] of Object.entries(multipliers ?? {})) {
    const validators = declarations.map(d => d[key]).filter(Boolean);
    const before = record.talents.bb[key], value = before * multiplier;
    if (!validators.length || !Number.isFinite(before) || !Number.isFinite(multiplier) || multiplier < 0
      || !validators.every(validate => validate(value))) throw Error(`Unsupported enemy talent multiplier: ${record.key}.${key}`);
    result.talents.bb[key] = value === 0 ? 0 : value;
  }
  const additive = recordFeatureIds(record).map(id => enemyFeature(id)?.stageAdditions).filter(Boolean);
  for (const [key, amount] of Object.entries(additions)) {
    const validators = additive.map(d => d[key]).filter(Boolean);
    const before = record.talents.bb[key], value = before + amount;
    if (Object.hasOwn(multipliers ?? {}, key)) throw Error(`Unreviewed mixed enemy talent arithmetic: ${record.key}.${key}`);
    if (!validators.length || !Number.isFinite(before) || !Number.isFinite(amount)
      || !validators.every(validate => validate(value))) throw Error(`Unsupported enemy talent addition: ${record.key}.${key}`);
    result.talents.bb[key] = value;
  }
  return result;
}

/** Skill range is a separate modifier from ordinary attack range and blast shape. */
export function applyStageEnemySkillRadius(record, multiplier) {
  if (multiplier == null) return record;
  const declarations = recordFeatureIds(record).map(id => enemyFeature(id)?.stageSkillRadius).filter(Boolean);
  if (!declarations.length || !Number.isFinite(multiplier) || multiplier <= 0
    || !declarations.every(validate => validate(record, multiplier)))
    throw Error(`Unsupported enemy skill-radius multiplier: ${record.key}`);
  return { ...record, stageSkillRadiusScale: multiplier };
}

/** Skill parameter changes are opt-in per implemented skill and parameter. */
export function applyStageEnemySkillMultipliers(record, skills = {}) {
  const result = structuredClone(record);
  const features = recordFeatureIds(record).map(id => enemyFeature(id)).filter(Boolean);
  for (const [name, values] of Object.entries(skills)) {
    const matches = result.skills.filter(s => s.prefabKey === name);
    if (matches.length !== 1) throw Error(`Missing or ambiguous enemy skill: ${record.key}.${name}`);
    for (const [key, scale] of Object.entries(values)) {
      const validators = features.map(f => f.stageSkillMultipliers?.[name]?.[key]).filter(Boolean);
      const before = matches[0].bb[key], value = before * scale;
      if (!validators.length || !Number.isFinite(before) || !Number.isFinite(scale) || scale <= 0
        || !validators.every(check => check(value))) throw Error(`Unsupported enemy skill multiplier: ${record.key}.${name}.${key}`);
      matches[0].bb[key] = value;
    }
  }
  return result;
}

/** Literal per-level overrides are not multiplicative challenge rules. Only
 * parameters declared by a reviewed feature may change; no implicit new kit. */
export function applyStageEnemyBlackboard(record, override) {
  if (!override) return record;
  if (override.level !== record.level) throw Error(`Original enemy level differs from map export: ${record.key}`);
  const result = structuredClone(record);
  const features = recordFeatureIds(record).map(id => enemyFeature(id)).filter(Boolean);
  // A sparse higher level that its contract reads over level zero (the Steam Knight's level 1 lists only reborn.def)
  // takes a stage talent override against that overlay; the overlay itself adds no key the database lacks.
  const talentBases = features.map(f => f.stageSparseTalents?.(record)).filter(Boolean);
  if (talentBases.length > 1) throw Error(`Unsupported original enemy parameter: ${record.key}`);
  if (talentBases.length === 1 && override.blackboard?.length) {
    record = { ...record, talents: structuredClone(talentBases[0]) }; result.talents = structuredClone(talentBases[0]);
  }
  applyLiteralParameters(record.key, record.talents, result.talents, override.blackboard,
    features.map(f => f.stageOverrides).filter(Boolean), features.map(f => f.stageInjectedParameters).filter(Boolean),
    features.map(f => f.stageStringOverrides).filter(Boolean));
  const invalid = () => { throw Error(`Unsupported original enemy skill/SP override: ${record.key}`); };
  let sparse = false;
  if (override.skills != null) {
    // A sparse higher level that its contract reads over level zero (Patriot level 1 lists only some skills) takes a
    // stage skill override against that overlay, never an implicit new kit; the skills it does not name are kept.
    const bases = features.map(f => f.stageSparseSkills?.(record)).filter(Boolean);
    if (bases.length > 1) invalid();
    if (bases.length === 1) { sparse = true; record = { ...record, skills: structuredClone(bases[0]) }; result.skills = structuredClone(bases[0]); }
  }
  if (override.skills != null) {
    if (!Array.isArray(override.skills)) invalid();
    const keys = override.skills.map(s => s?.prefabKey), canonicalKeys = record.skills.map(s => s.prefabKey);
    if (new Set(keys).size !== keys.length || keys.some(k => typeof k !== 'string' || !canonicalKeys.includes(k))) invalid();
    if (keys.length !== canonicalKeys.length || keys.some((k, i) => k !== canonicalKeys[i])) {
      const validators = features.map(f => f.stageSkillSetOverride).filter(Boolean);
      if (!validators.length || !validators.every(check => check(record, keys))) invalid();
      // Original lists replace the database list. A reviewed subset may omit
      // a skill or change tie priority order, but can never introduce a kit.
      // On a sparse overlay level the named skills are changed in place instead.
      if (!sparse) result.skills = keys.map(key => structuredClone(record.skills.find(s => s.prefabKey === key)));
    }
    override.skills.forEach(skill => {
      const before = record.skills.find(s => s.prefabKey === skill?.prefabKey);
      const target = result.skills.find(s => s.prefabKey === skill?.prefabKey);
      if (!skill || Object.keys(skill).some(k => !['prefabKey', 'priority', 'cooldown', 'initCooldown', 'spCost', 'blackboard'].includes(k))
        || ['prefabKey', 'spCost'].some(k => skill[k] !== before[k])) invalid();
      // A changed tie priority needs a reviewed feature that declares it for this skill.
      if (skill.priority !== before.priority) {
        const validators = features.map(f => f.stageSkillPriorityOverrides?.[before.prefabKey]).filter(Boolean);
        if (!Number.isInteger(skill.priority) || !validators.length || !validators.every(check => check(skill.priority, before))) invalid();
        target.priority = skill.priority;
      }
      for (const key of ['cooldown', 'initCooldown']) {
        if (skill[key] === before[key]) continue;
        const validators = features.map(f => f.stageSkillTimingOverrides?.[before.prefabKey]?.[key]).filter(Boolean);
        if (!Number.isFinite(skill[key]) || !validators.length || !validators.every(check => check(skill[key], before))) invalid();
        target[key] = skill[key];
      }
      applyLiteralParameters(`${record.key}.${before.prefabKey}`, before, target, skill.blackboard,
        features.map(f => f.stageSkillOverrides?.[before.prefabKey]).filter(Boolean), [],
        features.map(f => f.stageSkillStringOverrides?.[before.prefabKey]).filter(Boolean));
    });
  }
  if (override.spData != null) {
    const sp = override.spData, before = record.sp;
    if (!sp || Object.keys(sp).sort().join() !== 'increment,initSp,maxSp,spType') invalid();
    if (!before) {
      const validators = features.map(f => f.stageSpInitialization).filter(Boolean);
      if (!validators.length || !validators.every(check => check(record, sp))) invalid();
      result.sp = { type: sp.spType, maxSp: sp.maxSp, initSp: sp.initSp, increment: sp.increment };
    } else {
      if (sp.spType !== before.type) invalid();
      for (const key of ['maxSp', 'initSp', 'increment']) {
        if (sp[key] === before[key]) continue;
        const validators = features.map(f => f.stageSpOverrides?.[key]).filter(Boolean);
        if (!validators.length || !validators.every(validate => validate(sp[key], before))) invalid();
        result.sp[key] = sp[key];
      }
    }
  }
  return result;
}

function applyLiteralParameters(id, beforeRecord, result, entries, declarations, injected = [], strings = []) {
  if (!Array.isArray(entries)) throw Error(`Malformed original enemy blackboard: ${id}`);
  const seen = new Set();
  for (const entry of entries) {
    const key = entry?.key, before = beforeRecord.bb[key];
    if (typeof key !== 'string' || seen.has(key) || !Number.isFinite(entry.value))
      throw Error(`Unsupported original enemy parameter: ${id}.${key}`);
    seen.add(key);
    const str = entry.valueStr != null && entry.valueStr !== '';
    const permitted = injected.map(d => d[key]).filter(Boolean);
    if (permitted.length) {
      const value = str ? entry.valueStr : entry.value;
      if (str && entry.value !== 0 || !permitted.every(p => p.type === (str ? 'string' : 'number') && p.validate(value)))
        throw Error(`Unsupported injected enemy parameter: ${id}.${key}`);
      result[str ? 'bbStr' : 'bb'][key] = value;
      continue;
    }
    // Explicit identical values (including spawn identities) need no new
    // behavioral permission. Changed strings may introduce new dependencies.
    if (str) {
      if (entry.value === 0 && beforeRecord.bbStr[key] === entry.valueStr && !Object.hasOwn(beforeRecord.bb, key)) continue;
      // A changed string is accepted only where a reviewed feature declares that key, for an existing string
      // parameter of the same entry (never a new dependency or a new key).
      const validators = strings.map(d => d[key]).filter(Boolean);
      if (entry.value !== 0 || !Object.hasOwn(beforeRecord.bbStr, key) || Object.hasOwn(beforeRecord.bb, key)
        || !validators.length || !validators.every(validate => validate(entry.valueStr)))
        throw Error(`Unsupported original enemy parameter: ${id}.${key}`);
      result.bbStr[key] = entry.valueStr;
      continue;
    }
    if (Object.hasOwn(beforeRecord.bb, key) && entry.value === before) continue;
    const validators = declarations.map(d => d[key]).filter(Boolean);
    if (!Number.isFinite(before) || !validators.length || !validators.every(validate => validate(entry.value)))
      throw Error(`Unsupported original enemy parameter: ${id}.${key}`);
    result.bb[key] = entry.value;
  }
}


/** Stage-owned native parameters can name supply-card dependencies. Every
 * required identity must resolve before the stage enters the catalogue. */
export function stageEnemyTokenDependencies(record) {
  return [...new Set(recordFeatureIds(record).flatMap(id => enemyFeature(id)?.stageTokenDependencies?.(record) ?? []))];
}
