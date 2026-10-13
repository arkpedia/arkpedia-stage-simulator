// SPDX-License-Identifier: GPL-3.0-or-later
// Compact, pinned public data for the first regular-stage slice. No private app source is used.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { REGULAR_OPERATORS, assertRegularOperator } from "../../shared/arkpedia/operators.js";
import { assertRegularEnemies } from "../../shared/arkpedia/enemies.js";
import { compileReviewedOperators, operatorChannel } from "./operator-source.mjs";
import { writeJSONAtomic } from "./write-json.mjs";
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
  original_level: ["Kengxxiao/ArknightsGameData_YoStar", "en_US/gamedata/levels/obt/main/level_main_00-01.json"],
  char_patch_table: ["Kengxxiao/ArknightsGameData_YoStar", "en_US/gamedata/excel/char_patch_table.json"],
};
if (process.argv.includes("--refresh")) {
  const pins = {};
  for (const repo of new Set([
    ...Object.values(paths).map(([r]) => r),
    "arkpedia/arkpedia-image-assets",
    "arkpedia/arkpedia-skin-assets",
  ]))
    pins[repo] = execFileSync("gh", ["api", `repos/${repo}/commits/main`, "--jq", ".sha"], {
        encoding: "utf8",
      }).trim();
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
const [characters, skills, ranges, enemies, stage, geometry, buffTemplates, originalLevel, forms, pins] =
  await Promise.all(Object.keys(paths).concat("pins").map(read));
if (originalLevel.mapData.tags != null && (!Array.isArray(originalLevel.mapData.tags)
  || originalLevel.mapData.tags.some(tag => typeof tag !== 'string'))) throw Error('Unsupported source map tags');
const ids = Object.keys(REGULAR_OPERATORS);
if (ids.includes('char_4147_mitm')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-mitm-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-mitm-prefabs.json', import.meta.url));
  const artwork = await readFile(new URL('../../data/arkpedia-mitm-device-art.json', import.meta.url));
  const evidence = JSON.parse(foundation), art = JSON.parse(artwork);
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify(['char_4147_mitm']) || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.deviceArtworkSha256 !== createHash('sha256').update(artwork).digest('hex')
    || art.foundation.sha256 !== review.sourceFoundationSha256
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Mitm public review differs from its pinned native source/artwork');
}
if (ids.includes('char_4072_ironmn')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-stainless-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-stainless-prefabs.json', import.meta.url));
  const artwork = await readFile(new URL('../../data/arkpedia-stainless-device-art.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify(['char_4072_ironmn']) || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.deviceArtworkSha256 !== createHash('sha256').update(artwork).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Stainless public review differs from its pinned native source/artwork');
}
if (ids.includes('char_2026_yu')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-yu-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-yu-prefabs.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify(['char_2026_yu']) || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Yu public runtime review differs from its pinned native source');
}
if (ids.includes('char_2025_shu')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-shu-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-shu-prefabs.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (!review.enabledOperators.includes('char_2025_shu') || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Shu public runtime review differs from its pinned native source');
}
if (ids.includes('char_2023_ling')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-ling-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-ling-prefabs.json', import.meta.url));
  const artwork = await readFile(new URL('../../data/arkpedia-ling-dragon-art.json', import.meta.url));
  const evidence = JSON.parse(foundation), art = JSON.parse(artwork);
  if (!review.enabledOperators.includes('char_2023_ling') || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.dragonArtworkSha256 !== createHash('sha256').update(artwork).digest('hex')
    || art.foundation.sha256 !== review.sourceFoundationSha256
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Ling public runtime review differs from its pinned native source/artwork');
}
if (ids.includes('char_248_mgllan')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-magallan-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-magallan-prefabs.json', import.meta.url));
  const artwork = await readFile(new URL('../../data/arkpedia-magallan-drone-art.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (!review.enabledOperators.includes('char_248_mgllan') || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.droneArtworkSha256 !== createHash('sha256').update(artwork).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Magallan public runtime review differs from its pinned native source/artwork');
}
if (ids.includes('char_1039_thorn2')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-thorns-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-thorns-lodestar-prefabs.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (!review.enabledOperators.includes('char_1039_thorn2') || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Thorns public runtime review differs from the pinned native source');
}
const usesCN = ids.some(id => operatorChannel(id, REGULAR_OPERATORS[id]) === 'cn');
if (ids.includes('char_1041_angel2')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-exusiai-covenant-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-exusiai-covenant-prefabs.json', import.meta.url));
  const artwork = await readFile(new URL('../../data/arkpedia-exusiai-covenant-coordinates-art.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (!review.enabledOperators.includes('char_1041_angel2') || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.coordinateArtworkSha256 !== createHash('sha256').update(artwork).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Exusiai Covenant public runtime review differs from its pinned native source/artwork');
}
if(ids.includes('char_1040_blaze2')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-blaze-igniting-runtime-review.json',import.meta.url)));
  const foundation=await readFile(new URL('../../data/arkpedia-blaze-igniting-prefabs.json',import.meta.url));
  const evidence=JSON.parse(foundation);
  if(!review.enabledOperators.includes('char_1040_blaze2')||review.frameParity!==false
    ||review.sourceFoundationSha256!==createHash('sha256').update(foundation).digest('hex')
    ||evidence.source.commit!==pins[paths.character_table[0]])
    throw Error('Blaze Igniting public runtime review differs from the pinned native source');
}
if (ids.includes('char_4194_rmixer')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-rmixer-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-rmixer-prefabs.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify(['char_4194_rmixer']) || review.frameParity !== false
    || review.moduleSupport !== false || review.nativeParticleSupport !== false
    || review.recipientPolicy !== 'missing-ammo-then-latest-deployment-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Sankta public runtime review differs from the pinned native source');
}
const cnEvidence = usesCN ? JSON.parse(await readFile(new URL('../../data/arkpedia-cn-source.json', import.meta.url), 'utf8')) : null;
if (cnEvidence) {
  const roster = JSON.parse(await readFile(new URL('../../data/arkpedia-roster-target.json', import.meta.url), 'utf8'));
  if (cnEvidence.source.repository !== roster.source.repository || cnEvidence.source.commit !== roster.source.commit
    || cnEvidence.globalSource.commit !== pins[paths.character_table[0]]
    || cnEvidence.globalSource.characterTableSha256 !== createHash('sha256').update(await readFile(new URL('character_table.json', cache))).digest('hex'))
    throw Error('CN candidate tables do not match the reviewed roster/Global snapshot');
  for (const id of ids) if (operatorChannel(id, REGULAR_OPERATORS[id]) === 'cn' && REGULAR_OPERATORS[id].templateKey)
    throw Error(`CN shared skill-prefab binding requires a separate native review: ${id}`);
}
const usesForms = ids.some(id => REGULAR_OPERATORS[id].sourceForm);
let formSource;
if (usesForms) {
  const audits = await Promise.all(ids.filter(id => REGULAR_OPERATORS[id].sourceForm).map(async id => {
    const name = id === 'char_1001_amiya2' ? 'amiya-guard' : id === 'char_1037_amiya3' ? 'amiya-medic' : null;
    if (!name) throw Error(`Unreviewed Global alternate form: ${id}`);
    const evidence = JSON.parse(await readFile(new URL(`../../data/arkpedia-${name}-prefabs.json`, import.meta.url)));
    if (!evidence.enabledOperators.includes(id) || evidence.heldOperators.includes(id))
      throw Error(`Global alternate form lacks complete combat review: ${id}`);
    return evidence;
  }));
  const evidence = audits[0];
  const hash = createHash('sha256').update(await readFile(new URL('char_patch_table.json', cache))).digest('hex');
  if (audits.some(e => e.source.commit !== pins[paths.character_table[0]] || hash !== e.source.tableHashes.char_patch_table))
    throw Error('Global alternate-form cache differs from the reviewed source');
  formSource = { commit: evidence.source.commit, sha256: hash,
    patchTable: evidence.source.patchTable, formIds: Object.keys(forms.patchChars) };
}
const operators = compileReviewedOperators({ registry: REGULAR_OPERATORS,
  global: { characters, skills, ranges, forms }, cn: cnEvidence?.tables });
for (const op of Object.values(operators)) assertRegularOperator(op);
const tokenIds = ['token_10056_angel2_target', 'token_10035_wisdel_wward', 'token_10012_rosmon_shield', 'token_10031_swire2_gdtrap', 'token_10033_ela_grzmot', 'token_10034_ray_sndbst', 'token_10028_vigil_wolf', 'token_10026_bgsnow_subbow', 'token_10017_skadi2_dedant', 'token_10025_doroth_recttp', 'token_10036_lasher_mcbird', 'token_10032_jesca2_jckshd', 'token_10040_siege2_vlion', 'token_10009_weedy_cannon', 'token_10024_ebnhlz_rcube', 'token_10044_wulfen_mine', 'token_10042_tecno_puppet', 'token_10041_cathy_catsld', 'token_10022_kazema_shadow', 'token_10001_deepcl_tentac', 'token_10018_robrta_mach', 'token_10014_bstalk_crab', 'token_10011_beewax_oblisk', 'token_10006_vodfox_doll', 'token_10003_cgbird_bird', 'token_10000_silent_healrb', 'token_10015_dusk_drgn', 'token_10007_phatom_twin', 'token_10008_cqbw_box', 'token_10029_slent2_protrb', 'token_10019_nearl2_sword', 'token_10002_kalts_mon3tr', 'token_10010_folivo_car', 'token_10021_blkngt_hypnos', 'token_10023_windft_wrench', 'token_10045_alanna_crane', 'token_10013_robin_mine', 'token_10016_rfrost_mine', 'token_10004_otter_motter'];
tokenIds.unshift('token_10005_mgllan_drone1', 'token_10005_mgllan_drone2', 'token_10005_mgllan_drone3');
tokenIds.unshift('token_10020_ling_soul1', 'token_10020_ling_soul2', 'token_10020_ling_soul3');
tokenIds.unshift(...[1, 2, 3].map(n => `token_10027_ironmn_pile${n}`));
tokenIds.unshift('token_10037_mitm_trshrb');
const tokens = Object.fromEntries(tokenIds.map(id => {
  const c = characters[id];
  if (!c) throw Error(`Missing original token: ${id}`);
  const candidate = v => v.rangeId
    ? { ...v, rangeGrid: ranges[v.rangeId].grids.map(p => [p.row, p.col]) } : v;
  return [id, { id, name: c.name, profession: c.profession,
    subProfessionId: c.subProfessionId, position: c.position,
    phases: c.phases.map(p => ({ maxLevel: p.maxLevel,
      attributesKeyFrames: p.attributesKeyFrames,
      rangeGrid: ranges[p.rangeId].grids.map(p => [p.row, p.col]),
    })),
    trait: c.trait ? { ...c.trait, candidates: c.trait.candidates.map(candidate) } : null,
    talents: (c.talents ?? []).map(t => ({ ...t, candidates: (t.candidates ?? []).map(candidate) })),
    skills: (c.skills ?? []).map(s => ({ id: s.skillId, unlockCondition: s.unlockCond,
      levels: (s.skillId === null ? [] : skills[s.skillId].levels).map(level => level.rangeId
        ? { ...level, rangeGrid: ranges[level.rangeId].grids.map(p => [p.row, p.col]) } : level) })),
  }];
}));
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
    // Undeclared overrides inherit the serialized base enum (normally NORMAL).
    const values = { levelType: rows[0]?.enemyData.levelType?.m_value },
      stats = {};
    for (const row of rows.filter((r) => r.level <= config.database_level)) {
      for (const [k, v] of Object.entries(row.enemyData))
        if (v?.m_defined) values[k] = v.m_value;
      for (const [k, v] of Object.entries(row.enemyData.attributes))
        if (v.m_defined) stats[k] = v.m_value;
    }
    if (!['NORMAL', 'ELITE', 'BOSS'].includes(values.levelType))
      throw new Error(`Unsupported source enemy rank: ${config.enemy_id}:${values.levelType}`);
    return [
      config.enemy_id,
      {
        name: values.name,
        rank: values.levelType,
        motion: values.motion,
        applyWay: values.applyWay,
        lifePointReduce: values.lifePointReduce,
        tags: values.enemyTags ?? [],
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
const sdArg = process.argv.indexOf('--sd-commit');
const sdRequested = sdArg < 0 ? null : process.argv[sdArg + 1];
if (sdArg >= 0 && !/^[a-f0-9]{40}$/.test(sdRequested ?? ''))
  throw Error('--sd-commit requires an immutable forty-character Git commit');
const sdCommit = execFileSync("git", ["rev-parse", ...(sdRequested ? ["--verify", `${sdRequested}^{commit}`] : ["HEAD"])], {
  cwd: new URL("../../../arkpedia-sd-assets/", import.meta.url),
  encoding: "utf8",
}).trim();
const sd = JSON.parse(
  execFileSync("git", ["show", `${sdCommit}:manifest.json`], {
    cwd: new URL("../../../arkpedia-sd-assets/", import.meta.url),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }),
);
const modelKeys = [
  ...ids.flatMap((id) =>
    ["front", "back"].map((f) => `operator/${id}/default/${f}`),
  ),
  ...tokenIds.flatMap(id => ['front', 'back'].map(f => `operator/${id}/default/${f}`)),
  'operator/token_10027_ironmn_pile3/default/down',
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
    const op = operators[model.id];
    if (op?.skills.length > 1 && op.skills.some((_, index) => !model.animationRoles.skills?.[index]))
      throw new Error(`Missing per-skill SD animation roles: ${k}`);
    return [k, sd.models[k]];
  }),
);
// Bind the published default dragon files to the independently audited artwork,
// rather than approving whichever model happens to be at the latest asset HEAD.
if (ids.includes('char_4147_mitm')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-mitm-runtime-review.json', import.meta.url)));
  for (const [key, expected] of Object.entries(review.originalArtwork)) {
    if (!models[key] || JSON.stringify(models[key]) !== JSON.stringify(expected))
      throw Error(`Mitm published model differs from reviewed native artwork: ${key}`);
  }
}
if (ids.includes('char_4072_ironmn')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-stainless-runtime-review.json', import.meta.url)));
  for (const [key, expected] of Object.entries(review.originalArtwork)) {
    const model = models[key];
    if (!model || JSON.stringify(model) !== JSON.stringify(expected))
      throw Error(`Stainless published model differs from reviewed native artwork: ${key}`);
  }
}
if (ids.includes('char_2026_yu')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-yu-runtime-review.json', import.meta.url)));
  const evidence = JSON.parse(await readFile(new URL('../../data/arkpedia-yu-prefabs.json', import.meta.url)));
  for (const facing of ['front', 'back']) {
    const model = models[`operator/char_2026_yu/default/${facing}`], art = review.originalArtwork[facing];
    if (!model || JSON.stringify([model.skeleton, model.atlas, ...model.textures]) !== JSON.stringify(art.files)
      || JSON.stringify(model.source) !== JSON.stringify(art.source)
      || JSON.stringify(model.animations) !== JSON.stringify(art.animations)
      || model.source.commit !== evidence.source.modelCommit
      || model.skeleton.sha256 !== evidence.officialSkeletonBindings.char_2026_yu[facing === 'front' ? 'Front' : 'Back'].sha256
      || !model.premultipliedAlpha || !art.premultipliedAlpha)
      throw Error(`Yu published owner differs from reviewed native artwork: ${facing}`);
  }
}
if (ids.includes('char_2025_shu')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-shu-runtime-review.json', import.meta.url)));
  const evidence = JSON.parse(await readFile(new URL('../../data/arkpedia-shu-prefabs.json', import.meta.url)));
  for (const facing of ['front', 'back']) {
    const model = models[`operator/char_2025_shu/default/${facing}`], art = review.originalArtwork[facing];
    const files = [model.skeleton, model.atlas, ...model.textures];
    if (JSON.stringify(files) !== JSON.stringify(art.files)
      || JSON.stringify(model.source) !== JSON.stringify(art.source)
      || JSON.stringify(model.animations) !== JSON.stringify(art.animations)
      || model.source.commit !== evidence.source.modelCommit
      || model.skeleton.sha256 !== evidence.officialSkeletonBindings.char_2025_shu[facing === 'front' ? 'Front' : 'Back'].sha256
      || !model.premultipliedAlpha || !art.premultipliedAlpha)
      throw Error(`Shu published owner differs from reviewed native artwork: ${facing}`);
  }
}
if (ids.includes('char_2023_ling')) {
  const art = JSON.parse(await readFile(new URL('../../data/arkpedia-ling-dragon-art.json', import.meta.url)));
  for (const [id, record] of Object.entries(art.models)) for (const facing of ['front', 'back']) {
    const model = models[`operator/${id}/default/${facing}`];
    const files = [model.skeleton, model.atlas, ...model.textures, model.avatar];
    if (files.length !== Object.keys(record.files).length || files.some(file => {
      const expected = record.files[file?.path?.split('/').at(-1)];
      return !expected || file.sha256 !== expected.sha256 || file.bytes !== expected.bytes;
    }) || JSON.stringify(model.source.originalPathIds) !== JSON.stringify(record.originalPathIds)
      || JSON.stringify(model.animations) !== JSON.stringify(record.durations) || !model.premultipliedAlpha)
      throw Error(`Ling published dragon differs from reviewed native artwork: ${id}/${facing}`);
  }
}
for (const token of Object.values(tokens)) {
  if (token.id === 'token_10031_swire2_gdtrap') token.automaticOnly = true;
  const model = models[`operator/${token.id}/default/front`];
  // Golden Vows, Tactical Equipment and Revenant's Shadow spawn automatically.
  // Their default models have no portrait; retain the original absence.
  if (['token_10040_siege2_vlion','token_10012_rosmon_shield','token_10035_wisdel_wward'].includes(token.id) && !model.avatar) {
    token.automaticOnly = true; token.avatar = null; continue;
  }
  if (!model?.avatar?.path) throw Error(`Missing original token portrait: ${token.id}`);
  token.avatar = `https://raw.githubusercontent.com/arkpedia/arkpedia-sd-assets/${sdCommit}/${model.avatar.path}`;
}
const output = {
  schemaVersion: 1,
  ...(formSource ? { globalAlternateFormSource: formSource } : {}),
  sources: cnEvidence ? { ...pins, [cnEvidence.source.repository]: cnEvidence.source.commit } : pins,
  ...(cnEvidence ? { operatorSourceChannels: Object.fromEntries(ids.map(id => [id, operatorChannel(id, REGULAR_OPERATORS[id])])) } : {}),
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
    mapTags: originalLevel.mapData.tags ?? [],
    mapTagSource: { repository: paths.original_level[0], commit: pins[paths.original_level[0]],
      path: paths.original_level[1], sha256: createHash('sha256').update(await readFile(new URL('original_level.json', cache))).digest('hex') },
    geometry,
  },
  operators,
  tokens,
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
await writeJSONAtomic(
  new URL("../../data/arkpedia-mvp.json", import.meta.url),
  output,
);
console.log(
  `Built ${stage.code}: ${ids.length} operators, ${Object.keys(enemyRecords).length} enemies; SD ${sdCommit}`,
);
