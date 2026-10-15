// SPDX-License-Identifier: GPL-3.0-or-later
// Inspect original exported CN skeletons; no animation-role or gameplay inference.
import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseSkel } from '../assets/skel.mjs';
import { atlasInfo } from '../assets/atlas.mjs';
const { values } = parseArgs({ options: { operator: { type: 'string' }, token: { type: 'string' } } });
if (!/^char_\d+_[a-z0-9]+$/.test(values.operator ?? '')) throw Error('Expected an original CN operator ID');
if (values.token !== undefined && !/^token_\d+_[a-z0-9_]+$/.test(values.token)) throw Error('Expected an original token ID');
const out = new URL(`../../.cache/arkpedia/cn-operators/${values.operator}/${values.token ? `tokens/${values.token}/` : ''}`, import.meta.url);
const bindings = JSON.parse(await readFile(new URL('bindings.json', out)));
const models = {};
for (const [face, binding] of Object.entries(bindings)) {
  if (!['Front', 'Back', 'Down', 'Single'].includes(face)) throw Error('Unknown original facing');
  const bytes = await readFile(new URL(face.toLowerCase() + '.skel', out));
  const atlas = await readFile(new URL(face.toLowerCase() + '.atlas', out));
  if (bytes.length !== binding.bytes || createHash('sha256').update(bytes).digest('hex') !== binding.sha256
    || atlas.length !== binding.atlasBytes || createHash('sha256').update(atlas).digest('hex') !== binding.atlasSha256)
    throw Error('Changed original CN skeleton/atlas export');
  const p = parseSkel(bytes, atlasInfo(atlas.toString('utf8')).regions, { includeEventPayloads: true });
  if (p.missingRegions.length) throw Error('Missing native attachments: ' + face);
  models[face] = { sha256: binding.sha256, bytes: bytes.length, spineVersion: p.version,
    durations: p.durations, hits: p.hits, eventPayloads: p.eventPayloads, bounds: p.bounds };
}
await writeFile(new URL('models.json', out), JSON.stringify(models, null, 2) + '\n');
console.log('Inspected original CN animation tracks: ' + (values.token ?? values.operator));
