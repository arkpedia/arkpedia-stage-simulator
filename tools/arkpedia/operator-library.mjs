// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { writeJSONAtomic } from './write-json.mjs';
import { publishComponentObjects } from './component-store.mjs';
import { catalogueFor } from '../../shared/arkpedia/loadout.js';

// Summaries contain only picker/build constraints, never simulated stats.
export function operatorSummary(op) {
  const keys = ['id', 'name', 'rarity', 'profession', 'subProfessionId', 'position',
    'nationId', 'groupId', 'teamId', 'factionTags', 'formOf', 'sourceName', 'sourceAppellation', 'sourceChannel', 'supportOnly'];
  return { ...Object.fromEntries(keys.filter(k => op[k] !== undefined).map(k => [k, op[k]])), summaryOnly: true,
    phases: op.phases.map(p => ({ maxLevel: p.maxLevel })), potentialRanks: op.potentialRanks.map(() => null),
    skills: op.skills.map(s => ({ id: s.id, ...(s.unlockCondition ? { unlockCondition: s.unlockCondition } : {}),
      ...(s.assetIcon ? { assetIcon: s.assetIcon } : {}), levels: s.levels.map((level, i) => i === 0 ? { name: level.name } : {}) })) };
}

export function buildOperatorLibrary(snapshot) {
  catalogueFor(snapshot); // Validate registered source records before publication.
  const objects = new Map();
  const put = value => {
    const bytes = JSON.stringify(value) + '\n', hash = createHash('sha256').update(bytes).digest('hex');
    objects.set(hash, bytes); return hash;
  };
  const { operators, tokens, sd, stage, enemies, ...common } = snapshot;
  const pack = records => Object.fromEntries(Object.entries(records).map(([id, record]) => [id, put(record)]));
  const { models, ...sdConfig } = sd;
  const bootstrap = { schemaVersion: 1, kind: 'operator-library',
    common: { ...common, sd: { ...sdConfig, models: {} } },
    roster: Object.fromEntries(Object.entries(operators).map(([id, op]) => [id, operatorSummary(op)])),
    operators: pack(operators), tokens: pack(tokens), models: pack(models) };
  if (JSON.stringify(catalogueFor({ operators: bootstrap.roster })) !== JSON.stringify(catalogueFor(snapshot)))
    throw Error('Operator summaries changed build constraints');
  return { bootstrap, objects };
}

export async function publishOperatorLibrary({ bootstrap, objects }, root) {
  await publishComponentObjects(objects, root);
  // Publish after every referenced object is available. Existing tabs keep their pinned graph.
  await writeJSONAtomic(join(root, 'data/arkpedia-operators.json'), bootstrap, { space: 0 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(new URL('../..', import.meta.url).pathname);
  const snapshot = JSON.parse(await readFile(join(root, 'data/arkpedia-mvp.json'), 'utf8'));
  const built = buildOperatorLibrary(snapshot);
  if (process.argv.includes('--check')) {
    if (JSON.stringify(built.bootstrap) !== JSON.stringify(JSON.parse(await readFile(join(root, 'data/arkpedia-operators.json'), 'utf8'))))
      throw Error('Operator library is stale; run npm run content:operators');
    for (const [hash, bytes] of built.objects)
      if (await readFile(join(root, 'data/arkpedia-stage-library/objects', `${hash}.json`), 'utf8') !== bytes)
        throw Error(`Operator component changed: ${hash}`);
  } else await publishOperatorLibrary(built, root);
  console.log(JSON.stringify({ operators: Object.keys(built.bootstrap.roster).length, objects: built.objects.size,
    bootstrapBytes: Buffer.byteLength(JSON.stringify(built.bootstrap)),
    componentBytes: [...built.objects.values()].reduce((n, bytes) => n + Buffer.byteLength(bytes), 0) }));
}
