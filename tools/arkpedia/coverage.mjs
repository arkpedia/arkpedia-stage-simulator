#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from "node:fs/promises";
import { createHash } from 'node:crypto';
import { writeJSONAtomic } from './write-json.mjs';
import { pathToFileURL } from "node:url";
import { execFileSync } from 'node:child_process';
import { kitCoverage } from "../kit-coverage.mjs";
import { KITS, STATS_ONLY } from "../../server/sim/content/enemies.js";
import { BOSS_KITS } from "../../server/sim/content/bosses.js";
import { REGULAR_OPERATORS, assertRegularOperator } from "../../shared/arkpedia/operators.js";
import { REGULAR_ENEMIES } from "../../shared/arkpedia/enemies.js";

/** Source coverage, not a claim of game fidelity. Mode kits remain candidates. */
export function coverageFor({ characters, enemies, chess, inherited, data, assetModels = data.sd.models, rosterTarget = null, globalForms = {} }) {
  const operators = Object.entries(characters)
    .filter(([id, op]) => id.startsWith("char_") && !op.isNotObtainable && !["TOKEN", "TRAP"].includes(op.profession))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, op]) => {
      const imported = data.operators[id];
      if (imported) assertRegularOperator(imported);
      const candidates = inherited.chess.filter(row => chess[row.chessId]?.charId === id);
      const models = ["front", "back"].map(f => assetModels[`operator/${id}/default/${f}`]);
      return {
        id, name: op.name, rarity: Number(op.rarity.replace("TIER_", "")), archetype: op.subProfessionId,
        playable: !!imported,
        animations: models.every(m => m?.animationRoles?.idle &&
          (REGULAR_OPERATORS[id]?.noBasicAttack || m?.animationRoles?.attack) &&
          typeof m.premultipliedAlpha === "boolean") ? "imported" : "not-imported",
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
      operatorsWithImportedAnimations: operators.filter(o => o.animations === 'imported').length,
      playableOperators: operators.filter(o => o.playable).length,
      regularSkills: operators.reduce((n, o) => n + o.skills.filter(s => s.regularAdapter).length, 0),
      skillsWithStrongholdCandidates: operators.reduce((n, o) => n + o.skills.filter(s => s.strongholdCandidates.length).length, 0),
      enemies: enemyRows.length, regularEnemies: enemyRows.filter(e => e.regularAdapter !== "not-integrated").length,
      enemiesWithStrongholdCandidates: enemyRows.filter(e => e.strongholdCandidate).length,
    },
    ...(rosterTarget ? { fullRosterTarget: { ...rosterTarget.summary, source: rosterTarget.source,
      playableOperatorForms: rosterTarget.operators.filter(o => !!data.operators[o.id]).length,
      remainingOperatorForms: rosterTarget.operators.filter(o => !data.operators[o.id]).length,
      remainingOutsideGlobalSnapshot: rosterTarget.operators.filter(o => !characters[o.id] && !globalForms[o.id] && !data.operators[o.id]).length,
      remainingOutsideOrdinaryGlobalTable: rosterTarget.operators.filter(o => !characters[o.id] && !data.operators[o.id]).length,
      missingForms: rosterTarget.operators.filter(o => !data.operators[o.id]).map(o => o.id),
    } } : {}),
    ...(data.globalAlternateFormSource ? { globalAlternateForms: {
      source: data.globalAlternateFormSource,
      forms: Object.keys(globalForms).map(id => ({ id, playable: !!data.operators[id] })),
    } } : {}),
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
  if (!/^[a-f0-9]{40}$/.test(data.sd.commit)) throw Error('Missing immutable SD asset revision');
  // The battle snapshot lazy-loads only reviewed kits. Asset coverage includes
  // the entire published catalogue at the same pin, without enabling combat.
  const assetModels = JSON.parse(execFileSync('git', ['show', `${data.sd.commit}:manifest.json`], {
    cwd: new URL('../../../arkpedia-sd-assets/', import.meta.url), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  })).models;
  const rosterTarget = await read("../../data/arkpedia-roster-target.json");
  let globalForms = {};
  if (data.globalAlternateFormSource) {
    const bytes = await readFile(new URL('../../.cache/arkpedia/char_patch_table.json', import.meta.url));
    if (createHash('sha256').update(bytes).digest('hex') !== data.globalAlternateFormSource.sha256)
      throw Error('Global form coverage cache differs from the reviewed snapshot');
    globalForms = JSON.parse(bytes).patchChars;
  }
  const report = coverageFor({ characters, enemies, chess, inherited: kitCoverage(), data, assetModels, rosterTarget, globalForms });
  await writeJSONAtomic(new URL("../../data/arkpedia-coverage.json", import.meta.url), report);
  const { missingForms, source, ...fullRosterTarget } = report.fullRosterTarget;
  console.log(JSON.stringify({ globalSnapshot: report.summary, fullRosterTarget: {
    ...fullRosterTarget, sourceCommit: source.commit,
  } }));
}
