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
} });
if (!/^[a-f0-9]{40}$/.test(values.commit ?? "") || !["true", "false"].includes(values.pma))
  throw Error("Required: --commit <full source SHA> --pma true|false (explicit blending setting)");
const ids = values.ids?.split(",") ?? Object.keys(REGULAR_OPERATORS);
if (!ids.length || ids.some(id => !REGULAR_OPERATORS[id])) throw Error("Unknown regular-stage operator");
const root = resolve(values["asset-root"]);
const { importModel } = await import(pathToFileURL(join(root, "scripts/import-model.mjs")));
const { validateManifest } = await import(pathToFileURL(join(root, "scripts/manifest.mjs")));
const manifestPath = join(root, "manifest.json");
await validateManifest(JSON.parse(await readFile(manifestPath, "utf8")), root);
for (const id of ids) {
  for (const facing of ["front", "back"]) {
    const key = values['inspect-existing'] ? `operator/${id}/default/${facing}`
      : await importModel({ source: "operators", id, facing, commit: values.commit,
        sourceRoot: values['source-root'],
        directory: `spine/${id}/${id}/${facing === "front" ? "Front" : "Back"}` });
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const model = manifest.models[key];
    if (!model || model.source.commit !== values.commit) throw Error(`${key}: missing pinned original model`);
    if (!/^3\.8\./.test(model.spineVersion)) throw Error(`${key}: unsupported Spine runtime`);
    const info = parseSkel(await readFile(join(root, model.skeleton.path)),
      atlasInfo(await readFile(join(root, model.atlas.path), "utf8")).regions);
    if (info.missingRegions.length) throw Error(`${key}: missing regions ${info.missingRegions.join(", ")}`);
    const support = REGULAR_OPERATORS[id];
    const skillCount = support.skillIds?.length ?? (support.skillId ? 1 : 0);
    const roles = resolveRoles(info.animations, { durations: info.durations,
      skillIndices: Array.from({ length: skillCount }, (_, index) => index) });
    if (!roles.idle || !roles.attack || roles.attack.via === "idle") throw Error(`${key}: missing idle/attack clips`);
    Object.assign(model, { premultipliedAlpha: values.pma === "true", animations: info.durations,
      animationRoles: roles, hits: info.hits, bounds: info.bounds });
    await validateManifest(manifest, root);
    const temporary = join(root, ".cache/runtime-manifest.json");
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
    await rename(temporary, manifestPath);
    console.log(`Inspected ${key}: ${info.animations.length} clips`);
  }
}
