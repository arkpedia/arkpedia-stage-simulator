// SPDX-License-Identifier: GPL-3.0-or-later
import { validateLoadout } from "./squad.js";
import { assertRegularOperator } from "./operators.js";
const bb = (rows) =>
  Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
const phaseNumber = (phase) => Number(String(phase).replace("PHASE_", ""));
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
          skills: op.skills.map((s) => ({
            id: s.id,
            maxRankByElite: { 0: 4, 1: 7 },
          })),
          modules: [],
          skins: [],
        },
      ];
    }),
  );
}
export function defaultBuild(op) {
  return {
    id: op.id,
    elite: 1,
    level: 55,
    potential: 1,
    trust: 0,
    skillId: op.skills[0].id,
    skillRank: 7,
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
  const modifiers = {};
  for (const talent of talents)
    for (const [key, modifier] of Object.entries({ atk: "atkPct", def: "defPct", max_hp: "hpPct", attack_speed: "aspd" }))
      if (talent.bb[key]) modifiers[modifier] = (modifiers[modifier] ?? 0) + talent.bb[key];
  for (const talent of talents) stats.cost += talent.bb.cost ?? 0;
  const level = op.skills[0].levels[build.skillRank - 1];
  const skill = {
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
  };
  return {
    chessId: op.id,
    baseId: op.id,
    charId: op.id,
    name: op.name,
    rarity: 3,
    profession: op.profession,
    subProfessionId: op.subProfessionId,
    position: op.position,
    stats,
    rangeGrid: phase.rangeGrid,
    dmgType:
      op.profession === "MEDIC"
        ? "heal"
        : ["CASTER", "SUPPORT"].includes(op.profession)
          ? "arts"
          : "phys",
    skill,
    talents,
    arkpedia: {
      modifiers,
      critical: talents.find((t) => t.bb.prob && t.bb.atk_scale)?.bb,
      highDef: op.id === "char_210_stward" && build.elite >= 1,
    },
  };
}
