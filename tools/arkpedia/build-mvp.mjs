// SPDX-License-Identifier: GPL-3.0-or-later
// Compact, pinned public data for the first regular-stage slice. No private app source is used.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { REGULAR_OPERATORS, assertRegularOperator } from "../../shared/arkpedia/operators.js";
import { assertRegularEnemies } from "../../shared/arkpedia/enemies.js";
import { compileBuffTemplate } from "../../shared/arkpedia/behavior.js";
const cache = new URL("../../.cache/arkpedia/", import.meta.url);
await mkdir(cache, { recursive: true });
const paths = {
  character_table: [
    "Kengxxiao/ArknightsGameData_YoStar",
    "en_US/gamedata/excel/character_table.json",
  ],
  skill_table: [
    "Kengxxiao/ArknightsGameData_YoStar",
    "en_US/gamedata/excel/skill_table.json",
  ],
  range_table: [
    "Kengxxiao/ArknightsGameData_YoStar",
    "en_US/gamedata/excel/range_table.json",
  ],
  enemy_database: [
    "Kengxxiao/ArknightsGameData_YoStar",
    "en_US/gamedata/levels/enemydata/enemy_database.json",
  ],
  stage: ["arkpedia/arkpedia-data", "source/data/stages/0-1.json"],
  geometry: ["arkpedia/arkpedia-data", "source/data/stage-geometry/0-1.json"],
  buff_template_data: ["Kengxxiao/ArknightsGameData_YoStar", "en_US/gamedata/battle/buff_template_data.json"],
};
if (process.argv.includes("--refresh")) {
  const pins = {};
  for (const repo of new Set([
    ...Object.values(paths).map(([r]) => r),
    "arkpedia/arkpedia-image-assets",
    "arkpedia/arkpedia-skin-assets",
  ]))
    pins[repo] = JSON.parse(
      execFileSync("gh", ["api", `repos/${repo}/commits/main`], {
        encoding: "utf8",
      }),
    ).sha;
  for (const [key, [repo, path]] of Object.entries(paths)) {
    const response = await fetch(
      `https://raw.githubusercontent.com/${repo}/${pins[repo]}/${path}`,
    );
    if (!response.ok)
      throw new Error(`Source unavailable: ${key} (${response.status})`);
    await writeFile(new URL(`${key}.json`, cache), await response.text());
  }
  await writeFile(new URL("pins.json", cache), JSON.stringify(pins));
}
const read = async (name) =>
  JSON.parse(await readFile(new URL(`${name}.json`, cache), "utf8"));
const [characters, skills, ranges, enemies, stage, geometry, buffTemplates, pins] =
  await Promise.all(Object.keys(paths).concat("pins").map(read));
const ids = Object.keys(REGULAR_OPERATORS);
const operators = Object.fromEntries(
  ids.map((id) => {
    const c = characters[id];
    if (!c || !(c.rarity === "TIER_3" && c.phases.length === 2 && c.skills.length === 1
      || c.rarity === "TIER_2" && c.phases.length === 1 && c.skills.length === 0))
      throw new Error(`Unsupported operator shape: ${id}`);
    return [
      id,
      {
        id,
        name: c.name,
        rarity: Number(c.rarity.replace("TIER_", "")),
        profession: c.profession,
        subProfessionId: c.subProfessionId,
        position: c.position,
        phases: c.phases.map((p) => ({
          maxLevel: p.maxLevel,
          attributesKeyFrames: p.attributesKeyFrames,
          rangeGrid: ranges[p.rangeId].grids.map((p) => [p.row, p.col]),
        })),
        favorKeyFrames: c.favorKeyFrames,
        potentialRanks: c.potentialRanks.map(
          (p) => p.buff?.attributes?.attributeModifiers ?? [],
        ),
        talents: c.talents,
        skills: c.skills.map((s) => ({
          id: s.skillId,
          levels: skills[s.skillId].levels.slice(0, 7).map(level => level.rangeId
            ? { ...level, rangeGrid: ranges[level.rangeId].grids.map(p => [p.row, p.col]) } : level),
        })),
      },
    ];
  }),
);
for (const op of Object.values(operators)) assertRegularOperator(op);
const bindingEvidence = JSON.parse(await readFile(new URL("../../data/arkpedia-skill-prefabs.json", import.meta.url), "utf8"));
const tableHash = createHash("sha256").update(await readFile(new URL("buff_template_data.json", cache))).digest("hex");
if (bindingEvidence.templateTableSha256 !== tableHash)
  throw Error("Skill-prefab evidence does not match source templates; re-extract and review before rebuilding");
const templates = {};
for (const [id, support] of Object.entries(REGULAR_OPERATORS)) {
  if (!support.templateKey) continue;
  if (JSON.stringify(bindingEvidence.prefabs[support.prefabId]?.buffTemplates) !== JSON.stringify([support.templateKey]))
    throw Error(`Missing verified skill binding: ${id}`);
  const program = compileBuffTemplate(buffTemplates[support.templateKey]);
  for (const level of operators[id].skills[0].levels) {
    if (level.prefabId !== support.prefabId) throw Error(`Unexpected skill prefab: ${id}`);
    program.validateBlackboard(Object.fromEntries(level.blackboard.map(({ key, value }) => [key, value])));
  }
  templates[support.templateKey] = buffTemplates[support.templateKey];
}
const enemyRecords = Object.fromEntries(
  geometry.enemyConfigurations.map((config) => {
    const rows = enemies.enemies.find((e) => e.Key === config.enemy_id)?.Value;
    if (!rows) throw new Error(`Missing enemy: ${config.enemy_id}`);
    const values = {},
      stats = {};
    for (const row of rows.filter((r) => r.level <= config.database_level)) {
      for (const [k, v] of Object.entries(row.enemyData))
        if (v?.m_defined) values[k] = v.m_value;
      for (const [k, v] of Object.entries(row.enemyData.attributes))
        if (v.m_defined) stats[k] = v.m_value;
    }
    return [
      config.enemy_id,
      {
        name: values.name,
        motion: values.motion,
        applyWay: values.applyWay,
        lifePointReduce: values.lifePointReduce,
        stats: { ...stats, ...config.overrides },
      },
    ];
  }),
);
if (
  geometry.hasConditionalSpawns ||
  geometry.suppliedUnits.length ||
  geometry.waves.length !== 1
)
  throw new Error("Stage now needs unsupported mechanics");
const sdCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: new URL("../../../arkpedia-sd-assets/", import.meta.url),
  encoding: "utf8",
}).trim();
const sd = JSON.parse(
  execFileSync("git", ["show", `${sdCommit}:manifest.json`], {
    cwd: new URL("../../../arkpedia-sd-assets/", import.meta.url),
    encoding: "utf8",
  }),
);
const modelKeys = [
  ...ids.flatMap((id) =>
    ["front", "back"].map((f) => `operator/${id}/default/${f}`),
  ),
  ...Object.keys(enemyRecords).map((id) => `enemy/${id}/default/default`),
];
const models = Object.fromEntries(
  modelKeys.map((k) => {
    if (!sd.models[k]) throw new Error(`Missing SD model: ${k}`);
    const model = sd.models[k];
    if (
      !/^3\.8\./.test(model.spineVersion) ||
      !model.animationRoles?.idle ||
      !model.animations ||
      typeof model.premultipliedAlpha !== "boolean"
    )
      throw new Error(`Unverified SD runtime metadata: ${k}`);
    return [k, sd.models[k]];
  }),
);
const output = {
  schemaVersion: 1,
  sources: pins,
  behaviors: {
    source: { repository: paths.buff_template_data[0], commit: pins[paths.buff_template_data[0]],
      path: paths.buff_template_data[1], sha256: tableHash },
    templates,
  },
  sd: { repository: "arkpedia/arkpedia-sd-assets", commit: sdCommit, models },
  stage: {
    code: stage.code,
    name: stage.name,
    description: stage.description,
    battle: stage.battle,
    geometry,
  },
  operators,
  enemies: enemyRecords,
};
assertRegularEnemies(output);
// Consume the existing stage browser's public route output without publishing its private application source.
const routeArg = process.argv.indexOf("--routes");
const prior = JSON.parse(
  await readFile(
    new URL("../../data/arkpedia-mvp.json", import.meta.url),
    "utf8",
  ),
);
const pathing =
  routeArg >= 0
    ? JSON.parse(await readFile(process.argv[routeArg + 1], "utf8"))
    : prior.stage.pathing;
if (
  !pathing ||
  pathing.stage !== stage.code ||
  pathing.schemaVersion !== 1 ||
  pathing.geometryHash !==
    createHash("sha256").update(JSON.stringify(geometry)).digest("hex")
)
  throw new Error(
    "Export matching routes from Arkpedia's stage browser and pass --routes <routes.json>",
  );
output.stage.pathing = pathing;
const stageAssets = JSON.parse(execFileSync("git", ["show", `${sdCommit}:stage-manifest.json`], {
  cwd: new URL("../../../arkpedia-sd-assets/", import.meta.url), encoding: "utf8",
}));
if (!stageAssets.stages[stage.code]) throw Error("Missing original stage artwork");
output.stage.art = { repository: "arkpedia/arkpedia-sd-assets", commit: sdCommit, scene: stageAssets.stages[stage.code] };
if (!stageAssets.effects?.standardGates) throw Error("Missing original entry/defence box artwork");
output.stage.gates = { repository: "arkpedia/arkpedia-sd-assets", commit: sdCommit, pack: stageAssets.effects.standardGates };
if (!stageAssets.effects?.chargeCost) throw Error("Missing original charge-cost activation burst");
const bindings = {};
for (const [id,support] of Object.entries(REGULAR_OPERATORS)) {
  if (support.templateKey !== "charge_cost") continue;
  const key="common_charge_cost_start_01";
  if (!bindingEvidence.prefabs[support.prefabId]?.effectKeys.includes(key))
    throw Error(`Missing verified skill effect binding: ${id}`);
  bindings[id]={skillId:support.skillId,prefabId:support.prefabId,key};
}
output.skillEffects = {repository:"arkpedia/arkpedia-sd-assets",commit:sdCommit,
  pack:stageAssets.effects.chargeCost,bindings};
await writeFile(
  new URL("../../data/arkpedia-mvp.json", import.meta.url),
  `${JSON.stringify(output, null, 2)}\n`,
);
console.log(
  `Built ${stage.code}: ${ids.length} operators, ${Object.keys(enemyRecords).length} enemies; SD ${sdCommit}`,
);
