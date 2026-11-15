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
  applyLiteralParameters(record.key, record.talents, result.talents, override.blackboard,
    features.map(f => f.stageOverrides).filter(Boolean), features.map(f => f.stageInjectedParameters).filter(Boolean));
  const invalid = () => { throw Error(`Unsupported original enemy skill/SP override: ${record.key}`); };
  if (override.skills != null) {
    if (!Array.isArray(override.skills)) invalid();
    const keys = override.skills.map(s => s?.prefabKey), canonicalKeys = record.skills.map(s => s.prefabKey);
    if (new Set(keys).size !== keys.length || keys.some(k => typeof k !== 'string' || !canonicalKeys.includes(k))) invalid();
    if (keys.length !== canonicalKeys.length || keys.some((k, i) => k !== canonicalKeys[i])) {
      const validators = features.map(f => f.stageSkillSetOverride).filter(Boolean);
      if (!validators.length || !validators.every(check => check(record, keys))) invalid();
      // Original lists replace the database list. A reviewed subset may omit
      // a skill or change tie priority order, but can never introduce a kit.
      result.skills = keys.map(key => structuredClone(record.skills.find(s => s.prefabKey === key)));
    }
    override.skills.forEach((skill, i) => {
      const before = record.skills.find(s => s.prefabKey === skill?.prefabKey);
      if (!skill || Object.keys(skill).some(k => !['prefabKey', 'priority', 'cooldown', 'initCooldown', 'spCost', 'blackboard'].includes(k))
        || ['prefabKey', 'priority', 'spCost'].some(k => skill[k] !== before[k])) invalid();
      for (const key of ['cooldown', 'initCooldown']) {
        if (skill[key] === before[key]) continue;
        const validators = features.map(f => f.stageSkillTimingOverrides?.[before.prefabKey]?.[key]).filter(Boolean);
        if (!Number.isFinite(skill[key]) || !validators.length || !validators.every(check => check(skill[key], before))) invalid();
        result.skills[i][key] = skill[key];
      }
      applyLiteralParameters(`${record.key}.${before.prefabKey}`, before, result.skills[i], skill.blackboard,
        features.map(f => f.stageSkillOverrides?.[before.prefabKey]).filter(Boolean));
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

function applyLiteralParameters(id, beforeRecord, result, entries, declarations, injected = []) {
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
      throw Error(`Unsupported original enemy parameter: ${id}.${key}`);
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
