// SPDX-License-Identifier: GPL-3.0-or-later
// Literal event tracks from the original CN chararts export, independently of runtime policy.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseSkel } from '../assets/skel.mjs';
import { atlasInfo } from '../assets/atlas.mjs';
const out = new URL('../../.cache/arkpedia/akkord-source/', import.meta.url);
const models = {};
for (const face of ['Front', 'Back']) {
  const stem = face.toLowerCase();
  const bytes = await readFile(new URL(stem + '.skel', out));
  const atlas = await readFile(new URL(stem + '.atlas', out), 'utf8');
  const parsed = parseSkel(bytes, atlasInfo(atlas).regions, { includeEventPayloads: true });
  if (parsed.missingRegions.length) throw Error('Missing native attachments: ' + face);
  models[face] = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
    durations: parsed.durations, hits: parsed.hits, eventPayloads: parsed.eventPayloads };
}
await writeFile(new URL('models.json', out), JSON.stringify(models, null, 2) + '\n');
console.log('Inspected original Akkord Front/Back event tracks');
