// SPDX-License-Identifier: GPL-3.0-or-later
// Rebuild generated paths only from the geometry already retained in a pinned
// test-only build. This never fetches, substitutes or edits source geometry.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { syntheticRoutePath } from '../../shared/arkpedia/stage-path.js';
const root = new URL('../../data/', import.meta.url);
const index = JSON.parse(await readFile(new URL('arkpedia-stages.json', root)));
const pending = [];
for (const entry of index.stages.filter(s => s.testOnly)) {
  if (!/^arkpedia-stage-(16|17)-\d+\.json$/.test(entry.data)) throw Error('Unknown candidate stage file');
  const url = new URL(entry.data, root), stage = JSON.parse(await readFile(url));
  if (stage.testOnly !== true || stage.code !== entry.code || stage.enemyCatalogue !== 'canonical-ch16-candidate-v1'
    || stage.canonicalData?.repository !== 'arkpedia/arkpedia-data' || !/^[a-f0-9]{40}$/.test(stage.canonicalData.commit))
    throw Error('Path regeneration requires a pinned test-only canonical build');
  if (createHash('sha256').update(JSON.stringify(stage.geometry)).digest('hex') !== stage.pathing.geometryHash)
    throw Error('Candidate geometry changed: ' + stage.code);
  let changed = false;
  for (const i of stage.pathing.syntheticRoutes) {
    const path = syntheticRoutePath(stage.geometry.routes[i]);
    changed ||= JSON.stringify(path) !== JSON.stringify(stage.pathing.paths[i]);
    stage.pathing.paths[i] = path;
  }
  if (changed) pending.push({ url, stage });
}
if (process.argv.includes('--check')) {
  if (pending.length) throw Error('Stale candidate paths: ' + pending.map(p => p.stage.code).join(', '));
  console.log('All test-only synthetic paths retain their native geometry contracts');
} else {
  // Validate the complete batch before replacing generated artifacts.
  for (const { url, stage } of pending) await writeFile(url, JSON.stringify(stage, null, 1) + '\n');
  console.log('Rebuilt test-only paths: ' + pending.map(p => p.stage.code).join(', '));
}
