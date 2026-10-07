#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Import pinned Front/Back models into the separate asset repo and inspect them
// with the renderer's Spine parser. Publication and visual QA remain separate.
import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { parseSkel } from "../assets/skel.mjs";
import { atlasInfo } from "../assets/atlas.mjs";
import { resolveRoles } from "../assets/anim-roles.mjs";
import { REGULAR_OPERATORS } from "../../shared/arkpedia/operators.js";

const { values } = parseArgs({ options: {
  "asset-root": { type: "string", default: "../arkpedia-sd-assets" },
  "source-root": { type: "string" },
  ids: { type: "string" }, commit: { type: "string" }, pma: { type: "string" },
  "inspect-existing": { type: "boolean", default: false },
  "review-catalogue": { type: "boolean", default: false },
  "single-model-ids": { type: "string" },
} });
if (!/^[a-f0-9]{40}$/.test(values.commit ?? "") || !["true", "false"].includes(values.pma))
  throw Error("Required: --commit <full source SHA> --pma true|false (explicit blending setting)");
const ids = values.ids?.split(",") ?? Object.keys(REGULAR_OPERATORS);
const singleModels = new Set(values['single-model-ids']?.split(',') ?? []);
if ([...singleModels].some(id => !ids.includes(id))) throw Error('Single-model IDs must be explicitly imported');
// Importing source animation files for review does not register combat support.
// Review mode requires explicit IDs from the same pinned source catalogue.
const catalogue = values['review-catalogue']
  ? JSON.parse(await readFile(new URL('../../.cache/arkpedia/character_table.json', import.meta.url), 'utf8')) : {};
if (values['review-catalogue'] && !values.ids) throw Error('Review imports require explicit operator IDs');
if (!ids.length || ids.some(id => !REGULAR_OPERATORS[id] &&
  !(values['review-catalogue'] && id.startsWith('char_') && catalogue[id] &&
    !catalogue[id].isNotObtainable && !['TOKEN', 'TRAP'].includes(catalogue[id].profession))))
  throw Error("Unknown regular-stage operator or source review ID");
const root = resolve(values["asset-root"]);
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
        directory: `spine/${id}/${id}/${singleModels.has(id) ? 'Spine' : facing === "front" || support.fixedFrontModel || support.fixedFacing ? "Front" : "Back"}` });
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
    if (!roles.idle || !support.noBasicAttack && catalogue[id]?.subProfessionId !== 'bard' && (!roles.attack || roles.attack.via === "idle"))
      throw Error(`${key}: missing idle/attack clips`);
    Object.assign(model, { premultipliedAlpha: values.pma === "true", animations: info.durations,
      animationRoles: roles, hits: info.hits, bounds: info.bounds });
    if (support.fixedFrontModel || support.fixedFacing) model.source.facingAlias = 'fixed-original-front';
    if (singleModels.has(id)) model.source.facingAlias = 'single-original-model';
    await validateManifest(manifest, root);
    const temporary = join(root, ".cache/runtime-manifest.json");
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
    await rename(temporary, manifestPath);
    console.log(`Inspected ${key}: ${info.animations.length} clips`);
  }
}
