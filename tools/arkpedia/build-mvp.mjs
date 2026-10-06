// SPDX-License-Identifier: GPL-3.0-or-later
// Compact, pinned public data for the first regular-stage slice. No private app source is used.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
const [characters, skills, ranges, enemies, stage, geometry, pins] =
  await Promise.all(Object.keys(paths).concat("pins").map(read));
const ids = [
  "char_123_fang",
  "char_208_melan",
  "char_122_beagle",
  "char_124_kroos",
  "char_120_hibisc",
  "char_210_stward",
];
const operators = Object.fromEntries(
  ids.map((id) => {
    const c = characters[id];
    if (!c || c.phases.length !== 2 || c.skills.length !== 1)
      throw new Error(`Unsupported operator shape: ${id}`);
    return [
      id,
      {
        id,
        name: c.name,
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
          levels: skills[s.skillId].levels.slice(0, 7),
        })),
      },
    ];
  }),
);
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
await writeFile(
  new URL("../../data/arkpedia-mvp.json", import.meta.url),
  `${JSON.stringify(output, null, 2)}\n`,
);
console.log(
  `Built ${stage.code}: ${ids.length} operators, ${Object.keys(enemyRecords).length} enemies; SD ${sdCommit}`,
);
