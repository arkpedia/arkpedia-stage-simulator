#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { kitCoverage } from "../kit-coverage.mjs";
import { KITS, STATS_ONLY } from "../../server/sim/content/enemies.js";
import { BOSS_KITS } from "../../server/sim/content/bosses.js";
import { REGULAR_OPERATORS, assertRegularOperator } from "../../shared/arkpedia/operators.js";
import { REGULAR_ENEMIES } from "../../shared/arkpedia/enemies.js";

/** Source coverage, not a claim of game fidelity. Mode kits remain candidates. */
export function coverageFor({ characters, enemies, chess, inherited, data }) {
  const operators = Object.entries(characters)
    .filter(([id, op]) => id.startsWith("char_") && !op.isNotObtainable && !["TOKEN", "TRAP"].includes(op.profession))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, op]) => {
      const imported = data.operators[id];
      if (imported) assertRegularOperator(imported);
      const candidates = inherited.chess.filter(row => chess[row.chessId]?.charId === id);
      const models = ["front", "back"].map(f => data.sd.models[`operator/${id}/default/${f}`]);
      return {
        id, name: op.name, rarity: Number(op.rarity.replace("TIER_", "")), archetype: op.subProfessionId,
        playable: !!imported,
        animations: models.every(m => m?.animationRoles?.idle && m?.animationRoles?.attack && typeof m.premultipliedAlpha === "boolean") ? "imported" : "not-imported",
        skills: op.skills.map(s => ({ id: s.skillId,
          regularAdapter: !!imported && (REGULAR_OPERATORS[id].skillIds ?? [REGULAR_OPERATORS[id].skillId]).includes(s.skillId),
          strongholdCandidates: candidates.flatMap(c => c.skills.filter(k => k.skillId === s.skillId && k.covered).map(() => c.chessId)),
        })),
        effects: imported ? "placeholder-projectiles" : "not-integrated",
        ...(imported && data.skillEffects?.bindings[id] ? {
          originalSkillBursts:[data.skillEffects.bindings[id].key],
          effectLimitations:["DP-counter flight deferred; shader, damping and anchor approximated"],
        } : {}),
        gameFidelityVerified: false,
      };
    });
  const enemyRows = enemies.enemies.map(({ Key: id, Value: levels }) => ({
    id, databaseLevels: levels.map(l => l.level),
    regularAdapter: data.enemies[id] && REGULAR_ENEMIES[id] ? REGULAR_ENEMIES[id] : "not-integrated",
    strongholdCandidate: BOSS_KITS[id] ? "boss-kit" : KITS[id] ? "ability-kit" : STATS_ONLY[id] ? "stats-only" : null,
    candidateNotes: STATS_ONLY[id] ?? null,
    gameFidelityVerified: false,
  })).sort((a, b) => a.id.localeCompare(b.id));
  return {
    schemaVersion: 1,
    scope: "Pinned Global source catalogue; Stronghold mode kits require regular-stage adaptation and tests.",
    sources: data.sources,
    assets: { repository: data.sd.repository, commit: data.sd.commit },
    summary: {
      operators: operators.length, skills: operators.reduce((n, o) => n + o.skills.length, 0),
      playableOperators: operators.filter(o => o.playable).length,
      regularSkills: operators.reduce((n, o) => n + o.skills.filter(s => s.regularAdapter).length, 0),
      skillsWithStrongholdCandidates: operators.reduce((n, o) => n + o.skills.filter(s => s.strongholdCandidates.length).length, 0),
      enemies: enemyRows.length, regularEnemies: enemyRows.filter(e => e.regularAdapter !== "not-integrated").length,
      enemiesWithStrongholdCandidates: enemyRows.filter(e => e.strongholdCandidate).length,
    },
    operators, enemies: enemyRows,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
  const [characters, enemies, chess, data, pins] = await Promise.all([
    "../../.cache/arkpedia/character_table.json", "../../.cache/arkpedia/enemy_database.json",
    "../../data/chess.json", "../../data/arkpedia-mvp.json", "../../.cache/arkpedia/pins.json",
  ].map(read));
  if (Object.entries(pins).some(([repo, sha]) => data.sources[repo] !== sha))
    throw Error("Source cache pins differ from the playable snapshot; rebuild first");
  const report = coverageFor({ characters, enemies, chess, inherited: kitCoverage(), data });
  await writeFile(new URL("../../data/arkpedia-coverage.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary));
}
