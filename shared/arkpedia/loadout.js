// SPDX-License-Identifier: GPL-3.0-or-later
import { validateLoadout } from "./squad.js";
import { assertRegularOperator } from "./operators.js";
const bb = (rows) =>
  Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
const phaseNumber = (phase) => Number(String(phase).replace("PHASE_", ""));
const rankCaps = [4, 7, 10];

// Older snapshots predate skill unlock metadata and contain only E0-unlocked S1s.
export function skillUnlockFor(skill) {
  const unlock = skill.unlockCondition ?? { phase: "PHASE_0", level: 1 };
  const elite = phaseNumber(unlock.phase);
  if (!/^PHASE_[012]$/.test(unlock.phase) || !Number.isSafeInteger(elite) || elite < 0 || elite > 2 ||
      !Number.isSafeInteger(unlock.level) || unlock.level < 1)
    throw new Error(`Invalid skill unlock condition: ${skill.id}`);
  return { elite, level: unlock.level };
}

export function availableSkills(op, elite, level) {
  return op.skills.filter((skill) => {
    if (op.skills.length > 1 && skill.unlockCondition == null)
      throw new Error(`Missing skill unlock condition: ${skill.id}`);
    const unlock = skillUnlockFor(skill);
    return elite > unlock.elite || (elite === unlock.elite && level >= unlock.level);
  });
}

export function skillRankCap(op, skillId, elite) {
  const skill = op.skills.find((entry) => entry.id === skillId);
  return skill && Number.isSafeInteger(rankCaps[elite])
    ? Math.min(rankCaps[elite], skill.levels.length) : 0;
}

export function catalogueFor(data) {
  return Object.fromEntries(
    Object.values(data.operators).map((op) => {
      assertRegularOperator(op);
      return [
        op.id,
        {
          id: op.id,
          promotions: op.phases.map((p, elite) => ({
            elite,
            maxLevel: p.maxLevel,
          })),
          maxPotential: op.potentialRanks.length + 1,
          maxTrust: 200,
          skills: op.skills.map((s) => {
            if (op.skills.length > 1 && s.unlockCondition == null)
              throw new Error(`Missing skill unlock condition: ${s.id}`);
            const unlock = skillUnlockFor(s);
            return {
              id: s.id,
              unlockElite: unlock.elite,
              minLevel: unlock.level,
              maxRankByElite: Object.fromEntries(op.phases.flatMap((phase, elite) =>
                elite >= unlock.elite && (elite > unlock.elite || phase.maxLevel >= unlock.level)
                  ? [[elite, skillRankCap(op, s.id, elite)]] : [])),
            };
          }),
          modules: [],
          skins: [],
        },
      ];
    }),
  );
}
export function defaultBuild(op) {
  const elite = op.phases.length - 1;
  const level = op.phases.at(-1).maxLevel;
  const skill = availableSkills(op, elite, level)[0];
  return {
    id: op.id,
    elite,
    level,
    potential: 1,
    trust: 0,
    skillId: skill?.id ?? null,
    skillRank: skill ? skillRankCap(op, skill.id, elite) : null,
  };
}
function interpolate(frames, level) {
  const low = frames[0],
    high = frames.at(-1);
  const t =
    high.level === low.level
      ? 0
      : Math.min(
          1,
          Math.max(0, (level - low.level) / (high.level - low.level)),
        );
  return Object.fromEntries(
    Object.entries(low.data)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => [k, v + ((high.data[k] ?? v) - v) * t]),
  );
}
/** Convert only supported operators and explicitly implement their talents. Unsupported records fail closed. */
export function recordFor(build, data) {
  validateLoadout(build, catalogueFor(data));
  const op = data.operators[build.id],
    phase = op.phases[build.elite];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  // Game favor keyframes use 0..50; full stat bonuses are reached at 100% displayed trust.
  const trust = interpolate(op.favorKeyFrames, Math.min(100, build.trust) / 2);
  for (const k of ["maxHp", "atk", "def"])
    stats[k] = Math.round(stats[k] + trust[k]);
  const attr = {
    COST: "cost",
    RESPAWN_TIME: "respawnTime",
    ATK: "atk",
    DEF: "def",
    MAX_HP: "maxHp",
    ATTACK_SPEED: "attackSpeed",
    MAGIC_RESISTANCE: "magicResistance",
  };
  for (const modifiers of op.potentialRanks.slice(0, build.potential - 1))
    for (const mod of modifiers) {
      if (!attr[mod.attributeType] || mod.formulaItem !== "ADDITION")
        throw new Error("Unsupported potential modifier");
      stats[attr[mod.attributeType]] += mod.value;
    }
  const talents = op.talents
    .map((t) =>
      t.candidates
        .filter((c) => {
          const elite = phaseNumber(c.unlockCondition.phase);
          return (
            (build.elite > elite ||
              (build.elite === elite &&
                build.level >= c.unlockCondition.level)) &&
            build.potential - 1 >= c.requiredPotentialRank
          );
        })
        .at(-1),
    )
    .filter(Boolean)
    .map((t) => ({ ...t, bb: bb(t.blackboard) }));
  const support = assertRegularOperator(op);
  const trait = op.trait?.candidates?.filter((candidate) => {
    const elite = phaseNumber(candidate.unlockCondition.phase);
    return (build.elite > elite || (build.elite === elite && build.level >= candidate.unlockCondition.level))
      && build.potential - 1 >= candidate.requiredPotentialRank;
  }).at(-1);
  const modifiers = {};
  const passiveKeys = support.passiveTalentKeys ?? ["atk", "def", "max_hp", "attack_speed"];
  for (const talent of talents)
    for (const [key, modifier] of Object.entries({ atk: "atkPct", def: "defPct", max_hp: "hpPct", attack_speed: "aspd" }))
      if (passiveKeys.includes(key) && talent.bb[key])
        modifiers[modifier] = (modifiers[modifier] ?? 0) + talent.bb[key];
  if (support.mechanic === "dodge-phys")
    modifiers.dodgePhys = talents[0]?.bb.prob ?? 0;
  if (support.mechanic === "dodge-arts")
    modifiers.dodgeArts = talents[0]?.bb.prob ?? 0;
  if (support.talentCostStat !== false)
    for (const talent of talents) {
      stats.cost += talent.bb.cost ?? 0;
      stats.respawnTime += talent.bb.respawn_time ?? 0;
    }
  const level = op.skills.find((entry) => entry.id === build.skillId)?.levels[build.skillRank - 1];
  const skill = level ? {
    skillId: build.skillId,
    name: level.name,
    skillType: level.skillType,
    durationType: level.durationType,
    duration: level.duration,
    rangeGrid: level.rangeGrid,
    ...level.spData,
    bb: bb(level.blackboard),
    trigger: {
      rule:
        level.skillType === "MANUAL"
          ? "NEVER"
          : /charge_cost/.test(build.skillId)
            ? "SP_FULL"
            : "DEFAULT",
    },
  } : null;
  return {
    chessId: op.id,
    baseId: op.id,
    charId: op.id,
    name: op.name,
    rarity: op.rarity,
    profession: op.profession,
    subProfessionId: op.subProfessionId,
    position: op.position,
    // Source faction identifiers, distinct from descriptive gameplay tags.
    tags: [op.nationId, op.groupId, op.teamId].filter(value => typeof value === 'string' && value),
    stats,
    rangeGrid: phase.rangeGrid,
    dmgType:
      op.profession === "MEDIC"
        ? "heal"
        : ["CASTER", "SUPPORT"].includes(op.profession) || op.subProfessionId === 'artsfghter'
          ? "arts"
          : "phys",
    skill,
    talents,
    trait: trait ? { ...trait, bb: bb(trait.blackboard) } : null,
    arkpedia: {
      modifiers,
      elite: build.elite,
      level: build.level,
      potential: build.potential,
      trust: build.trust,
      skillRank: build.skillRank,
      critical: support.criticalTalent === false ? undefined
        : talents.find((t) => t.bb.prob && t.bb.atk_scale)?.bb,
      highDef: op.id === "char_210_stward" && build.elite >= 1,
    },
  };
}
