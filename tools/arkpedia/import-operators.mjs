#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Import pinned Front/Back models into the separate asset repo and inspect them
// with the renderer's Spine parser. Publication and visual QA remain separate.
import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { parseSkel } from "../assets/skel.mjs";
import { atlasInfo } from "../assets/atlas.mjs";
import { resolveRoles } from "../assets/anim-roles.mjs";
import { REGULAR_OPERATORS } from "../../shared/arkpedia/operators.js";

/** Explicit exceptions must keep the same pinned catalogue identity and
 * default model directory. Never map a missing original to a skin/other unit. */
export function validateSourceOverrides({ ids, singleModels, fixedFrontModels, directoryMap, catalogue }) {
  for (const set of [singleModels, fixedFrontModels])
    if ([...set].some(id => !ids.includes(id))) throw Error('Facing override IDs must be explicitly imported');
  if ([...singleModels].some(id => fixedFrontModels.has(id))) throw Error('Conflicting single/front facing overrides');
  if (!directoryMap || typeof directoryMap !== 'object' || Array.isArray(directoryMap))
    throw Error('Source directory map must be a JSON object');
  for (const [id, directory] of Object.entries(directoryMap)) {
    const char = catalogue[id];
    if (!ids.includes(id) || !char || char.isNotObtainable || ['TOKEN', 'TRAP'].includes(char.profession))
      throw Error('Mapped source IDs must be explicitly imported catalogue operators');
    const match = /^spine\/(char_(\d+)_[a-z0-9]+)\/(char_(\d+)_[a-z0-9]+)$/.exec(directory);
    if (!match || match[1] !== id || match[2] !== match[4])
      throw Error('Mapped source directory must be the same operator default, without traversal or variants');
  }
}

export function verifyFacingOverrides(source, { ids, singleModels, fixedFrontModels, directoryMap }) {
  for (const id of ids) {
    if (!singleModels.has(id) && !fixedFrontModels.has(id)) continue;
    const directory = directoryMap[id] ?? `spine/${id}/${id}`;
    const present = facing => source.listing(`${directory}/${facing}`).length > 0;
    if (singleModels.has(id) && (!present('Spine') || present('Front') || present('Back')))
      throw Error(`${id}: single-model override does not match the pinned original tree`);
    if (fixedFrontModels.has(id) && (!present('Front') || present('Back') || present('Spine')))
      throw Error(`${id}: fixed-front override does not match the pinned original tree`);
  }
}

async function main() {
const { values } = parseArgs({ options: {
  "asset-root": { type: "string", default: "../arkpedia-sd-assets" },
  "source-root": { type: "string" },
  ids: { type: "string" }, commit: { type: "string" }, pma: { type: "string" },
  "inspect-existing": { type: "boolean", default: false },
  "review-catalogue": { type: "boolean", default: false },
  "single-model-ids": { type: "string" },
  "fixed-front-ids": { type: "string" },
  "source-directory-map": { type: "string" },
} });
if (!/^[a-f0-9]{40}$/.test(values.commit ?? "") || !["true", "false"].includes(values.pma))
  throw Error("Required: --commit <full source SHA> --pma true|false (explicit blending setting)");
const ids = values.ids?.split(",") ?? Object.keys(REGULAR_OPERATORS);
const singleModels = new Set(values['single-model-ids']?.split(',') ?? []);
const fixedFrontModels = new Set(values['fixed-front-ids']?.split(',') ?? []);
const directoryMap = values['source-directory-map']
  ? JSON.parse(await readFile(resolve(values['source-directory-map']), 'utf8')) : {};
// Importing source animation files for review does not register combat support.
// Review mode requires explicit IDs from the same pinned source catalogue.
const catalogue = values['review-catalogue'] || values['source-directory-map']
  ? JSON.parse(await readFile(new URL('../../.cache/arkpedia/character_table.json', import.meta.url), 'utf8')) : {};
if (values['review-catalogue'] && !values.ids) throw Error('Review imports require explicit operator IDs');
if (!ids.length || ids.some(id => !REGULAR_OPERATORS[id] &&
  !(values['review-catalogue'] && id.startsWith('char_') && catalogue[id] &&
    !catalogue[id].isNotObtainable && !['TOKEN', 'TRAP'].includes(catalogue[id].profession))))
  throw Error("Unknown regular-stage operator or source review ID");
validateSourceOverrides({ ids, singleModels, fixedFrontModels, directoryMap, catalogue });
const root = resolve(values["asset-root"]);
if (singleModels.size || fixedFrontModels.size) {
  if (!values['source-root']) throw Error('Explicit facing exceptions require a pinned local source checkout');
  const { gitSource } = await import(pathToFileURL(join(root, 'scripts/source-git.mjs')));
  verifyFacingOverrides(gitSource(values['source-root'], 'fexli/ArknightsResource', values.commit),
    { ids, singleModels, fixedFrontModels, directoryMap });
}
const { importModel } = await import(pathToFileURL(join(root, "scripts/import-model.mjs")));
const { validateManifest } = await import(pathToFileURL(join(root, "scripts/manifest.mjs")));
const manifestPath = join(root, "manifest.json");
await validateManifest(JSON.parse(await readFile(manifestPath, "utf8")), root);
for (const id of ids) {
  const support = REGULAR_OPERATORS[id] ?? { skillIds: catalogue[id].skills.map(skill => skill.skillId) };
  for (const facing of ["front", "back"]) {
    const key = values['inspect-existing'] ? `operator/${id}/default/${facing}`
      : await importModel({ source: "operators", id, facing, commit: values.commit,
        sourceRoot: values['source-root'],
        directory: `${directoryMap[id] ?? `spine/${id}/${id}`}/${singleModels.has(id) ? 'Spine' : facing === "front" || fixedFrontModels.has(id) || support.fixedFrontModel || support.fixedFacing ? "Front" : "Back"}` });
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const model = manifest.models[key];
    if (!model || model.source.commit !== values.commit) throw Error(`${key}: missing pinned original model`);
    if (!/^3\.8\./.test(model.spineVersion)) throw Error(`${key}: unsupported Spine runtime`);
    const info = parseSkel(await readFile(join(root, model.skeleton.path)),
      atlasInfo(await readFile(join(root, model.atlas.path), "utf8")).regions);
    if (info.missingRegions.length) throw Error(`${key}: missing regions ${info.missingRegions.join(", ")}`);
    const skillCount = support.skillIds?.length ?? (support.skillId ? 1 : 0);
    const roles = resolveRoles(info.animations, { durations: info.durations,
      skillIndices: Array.from({ length: skillCount }, (_, index) => index) });
    // Original S1 components use normal attacks, not the separate S2 clip.
    if (['char_4004_pudd', 'char_4100_caper'].includes(id)) {
      roles.skills['0'] = { ...roles.attack, index: 0, idle: null, via: 'attack' };
      roles.skill = roles.skills['0'];
    }
    // Rosa's S1/S2 buff her ordinary Attack. The native Skill_Begin/Loop/End
    // controller belongs only to her retained-harpoon S3.
    if (id === 'char_197_poca') {
      for (const index of [0, 1]) roles.skills[String(index)] = {
        ...roles.attack, index, idle: null, via: 'attack',
      };
      roles.skill = roles.skills['0'];
    }
    // Native Silence the Paradigmatic form bindings: S1 keeps Attack, S2
    // replaces it with Skill, and S3 owns Skill_2_Begin/Idle/Loop/End.
    if (id === 'char_1031_slent2') {
      const third = roles.skills['1'];
      roles.skills['0'] = { ...roles.attack, index: 0, idle: null, via: 'attack' };
      roles.skills['1'] = { begin: null, loop: 'Skill', end: null, index: 1, idle: null };
      roles.skills['2'] = { ...third, index: 2 };
      roles.skill = roles.skills['0'];
    }
    // Scene S1 requests its one-shot beginning, then keeps ordinary attacks;
    // her remote S2 never requests the unused Skill_2 clip.
    if (id === 'char_336_folivo') {
      roles.skills['0'] = { begin: 'Skill_1', loop: roles.attack.loop,
        end: null, index: 0, idle: roles.idle };
      roles.skills['1'] = { ...roles.attack, index: 1, idle: null, via: 'attack' };
      roles.skill = roles.skills['0'];
    }
    // Native Nian S1 switches damage mode on her ordinary attack. S2 is
    // disarmed: no graph requests the Front-only Skill_1 family. S3 owns the
    // literal Skill_2 family on both original facings.
    if (id === 'char_2014_nian') {
      roles.skills['0'] = { ...roles.attack, index: 0, idle: null, via: 'attack' };
      roles.skills['1'] = { begin: null, loop: roles.idle, end: null,
        index: 1, idle: roles.idle, via: 'idle' };
      roles.skills['2'] = { begin: 'Skill_2_Begin', loop: 'Skill_2_Loop',
        end: 'Skill_2_End', index: 2, idle: 'Skill_2_Idle' };
      roles.skill = roles.skills['0'];
    }
    if (!roles.idle || !support.noBasicAttack && catalogue[id]?.subProfessionId !== 'bard' && (!roles.attack || roles.attack.via === "idle"))
      throw Error(`${key}: missing idle/attack clips`);
    Object.assign(model, { premultipliedAlpha: values.pma === "true", animations: info.durations,
      animationRoles: roles, hits: info.hits, bounds: info.bounds });
    if (fixedFrontModels.has(id) || support.fixedFrontModel || support.fixedFacing) model.source.facingAlias = 'fixed-original-front';
    if (singleModels.has(id)) model.source.facingAlias = 'single-original-model';
    await validateManifest(manifest, root);
    const temporary = join(root, ".cache/runtime-manifest.json");
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
    await rename(temporary, manifestPath);
    console.log(`Inspected ${key}: ${info.animations.length} clips`);
  }
}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
