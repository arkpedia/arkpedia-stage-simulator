// SPDX-License-Identifier: GPL-3.0-or-later
// Report built stages whose enemy records have no chibi model in the pinned snapshot.
//
//   node tools/arkpedia/asset-coverage.mjs
import { readFileSync } from 'node:fs';
import index from '../../data/arkpedia-stages.json' with { type: 'json' };
import snapshot from '../../data/arkpedia-mvp.json' with { type: 'json' };

const stages = [];
for (const entry of index.stages.filter(s => s.data)) {
  const stage = JSON.parse(readFileSync(new URL(`../../data/${entry.data}`, import.meta.url), 'utf8'));
  const missing = Object.keys(stage.enemies ?? {}).filter(id => !snapshot.sd.models[`enemy/${id}/default/default`]);
  if (missing.length) stages.push({ id: entry.id, testOnly: !!entry.testOnly, missing });
}
const unique = [...new Set(stages.flatMap(s => s.missing))];
console.log(JSON.stringify({ builtStages: index.stages.filter(s => s.data).length, stagesWithMissingArt: stages.length,
  missingEnemyModels: unique.length, missing: unique, stages }, null, 2));
