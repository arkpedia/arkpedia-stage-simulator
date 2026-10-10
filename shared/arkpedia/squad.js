// SPDX-License-Identifier: GPL-3.0-or-later
// Standard-stage preparation contract; battle execution and data adapters follow separately.
export const SQUAD_LIMIT = 12;

function integer(value, min, max, field) {
  if (!Number.isSafeInteger(value) || !Number.isSafeInteger(max) || value < min || value > max) throw new Error(`Invalid ${field}`);
}

function operatorFor(catalogue, id) {
  const operator = catalogue[id];
  if (!operator || operator.id !== id) throw new Error(`Unknown operator: ${id}`);
  return operator;
}

/**
 * Catalogue adapter supplies real caps from a pinned release:
 * { id, promotions:[{elite,maxLevel}], maxPotential, maxTrust,
 *   skills:[{id,unlockElite,minLevel,maxRankByElite:{0:4,1:7,2:10}}],
 *   modules:[{id,maxStage,unlockElite,minLevel}], skins:[skinId] }
 */
export function validateLoadout(build, catalogue) {
  const operator = operatorFor(catalogue, build.id);
  const promotion = operator.promotions.find((phase) => phase.elite === build.elite);
  if (!promotion) throw new Error(`Unavailable promotion: ${build.id}`);
  integer(build.level, 1, promotion.maxLevel, 'level');
  integer(build.potential, 1, operator.maxPotential, 'potential');
  integer(build.trust, 0, operator.maxTrust, 'trust');
  if (operator.skills.length === 0) {
    if (build.skillId != null || build.skillRank != null) throw new Error(`Operator has no skills: ${build.id}`);
  } else {
    const skill = operator.skills.find((entry) => entry.id === build.skillId);
    const maxRank = skill?.maxRankByElite[build.elite];
    const unlockElite = skill?.unlockElite ?? 0;
    const minLevel = skill?.minLevel ?? 1;
    if (!Number.isSafeInteger(maxRank) || maxRank < 1 || build.elite < unlockElite ||
        (build.elite === unlockElite && build.level < minLevel))
      throw new Error(`Unavailable skill: ${build.skillId}`);
    integer(build.skillRank, 1, maxRank, 'skill rank');
  }
  if (build.module) {
    const module = operator.modules.find((entry) => entry.id === build.module.id);
    if (!module || build.elite < module.unlockElite || build.level < module.minLevel) throw new Error(`Unavailable module: ${build.module.id}`);
    integer(build.module.stage, 1, module.maxStage, 'module stage');
  }
  if (build.skinId !== undefined && !operator.skins.includes(build.skinId)) throw new Error(`Unavailable skin: ${build.skinId}`);
  // Copy only supported fields; never retain supplied combat stats or mechanic flags.
  return Object.freeze({
    id: build.id, elite: build.elite, level: build.level, potential: build.potential,
    trust: build.trust, skillId: build.skillId ?? null, skillRank: build.skillRank ?? null,
    ...(build.module ? { module: Object.freeze({ id: build.module.id, stage: build.module.stage }) } : {}),
    ...(build.skinId !== undefined ? { skinId: build.skinId } : {})
  });
}

/** A support selection becomes a maxed build inside the simulator, not in the host app. */
export function maxedSupport(selection, catalogue) {
  const operator = operatorFor(catalogue, selection.id);
  if (!operator.promotions.length) throw new Error(`Missing promotion caps: ${selection.id}`);
  const promotion = operator.promotions.reduce((best, phase) => phase.elite > best.elite ? phase : best);
  const skill = operator.skills.find((entry) => entry.id === selection.skillId);
  const module = selection.moduleId === undefined ? null : operator.modules.find((entry) => entry.id === selection.moduleId);
  if (selection.moduleId !== undefined && !module) throw new Error(`Unavailable module: ${selection.moduleId}`);
  return validateLoadout({
    id: selection.id, elite: promotion.elite, level: promotion.maxLevel,
    potential: operator.maxPotential, trust: operator.maxTrust,
    skillId: selection.skillId ?? null, skillRank: skill?.maxRankByElite[promotion.elite] ?? null,
    ...(module ? { module: { id: module.id, stage: module.maxStage } } : {}),
    ...(selection.skinId !== undefined ? { skinId: selection.skinId } : {})
  }, catalogue);
}

export function prepareSquad(selection, catalogue) {
  if (!Array.isArray(selection.operators) || selection.operators.length < 1 || selection.operators.length > SQUAD_LIMIT) throw new Error('Choose 1–12 operators');
  const operators = selection.operators.map((build) => validateLoadout(build, catalogue));
  const support = selection.support ? maxedSupport(selection.support, catalogue) : null;
  const ids = [...operators.map((operator) => operator.id), ...(support ? [support.id] : [])];
  if (new Set(ids).size !== ids.length) throw new Error('Squad and support must use distinct operators');
  const identities = ids.map(id => catalogue[id].formOf ?? id);
  if (new Set(identities).size !== identities.length) throw new Error('Choose only one form of each operator, including support');
  return Object.freeze({ operators: Object.freeze(operators), support });
}

/** Both the UI and placement command handler must gate deployment. */
export function canDeployInViewport(viewport) {
  return viewport === 'native-fullscreen' || viewport === 'fullscreen-workspace';
}
