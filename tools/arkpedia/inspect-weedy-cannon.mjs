// SPDX-License-Identifier: GPL-3.0-or-later
// After extract-weedy-cannon.py, inspect the literal Spine clips and attachment
// names before import-original-models.mjs accepts these immutable files.
import { readFile, writeFile } from 'node:fs/promises';
import { parseSkel } from '../assets/skel.mjs';
import { atlasInfo } from '../assets/atlas.mjs';
const root = new URL('../../.cache/arkpedia/weedy-source/cannon/', import.meta.url);
const file = new URL('sources.json', root);
const metadata = JSON.parse(await readFile(file, 'utf8'));
const token = 'token_10009_weedy_cannon';
for (const [face, record] of Object.entries(metadata.models[token].facings)) {
  const parsed = parseSkel(await readFile(new URL(`${face}/${token}.skel`, root)),
    atlasInfo(await readFile(new URL(`${face}/${token}.atlas`, root), 'utf8')).regions);
  if (parsed.missingRegions.length) throw Error(`Missing ${face} attachments: ${parsed.missingRegions}`);
  Object.assign(record, { spineVersion: parsed.version, durations: parsed.durations,
    hits: parsed.hits, bounds: parsed.bounds,
    // Exact native aliases. Idle is the literal Die mapping, not a fabricated
    // death animation; Attack_Loop begins via the native Attack_Begin mix.
    animationRoles: { idle: 'Idle', deploy: 'Start', die: 'Idle', attack: 'Attack_Loop' } });
  console.log(`${face}: ${parsed.animations.length} original clips, no missing atlas attachments`);
}
await writeFile(file, `${JSON.stringify(metadata, null, 2)}\n`);
