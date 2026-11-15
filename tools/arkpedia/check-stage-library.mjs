// SPDX-License-Identifier: GPL-3.0-or-later
// Validate the deployed graph and execute every available stage. No source
// checkout or legacy per-stage files are needed for this check.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateStageLibrary, createStageLibraryLoader, STAGE_OBJECT_BASE } from '../../shared/arkpedia/stage-library.js';
import { smokeStage } from './content.mjs';
export async function checkStageLibrary(root = fileURLToPath(new URL('../../', import.meta.url)), { seconds = 10, onProgress = () => {} } = {}) {
  const [manifest, mvp] = await Promise.all(['arkpedia-library', 'arkpedia-mvp'].map(async name => JSON.parse(await readFile(join(root, 'data', `${name}.json`), 'utf8'))));
  validateStageLibrary(manifest);
  const requested = new Set();
  const loader = createStageLibraryLoader(async url => {
    if (!url.startsWith(STAGE_OBJECT_BASE)) throw Error('Unexpected component URL');
    requested.add(url);
    return new Response(await readFile(join(root, url.slice(1))));
  });
  const failures = [], stages = manifest.stages.filter(e => e.availability === 'available');
  let completed = 0;
  for (const entry of stages) {
    try { const stage = await loader.load(entry); smokeStage({ mvp }, stage, seconds); completed++; }
    catch (error) { failures.push({ id: entry.id, error: error.message }); }
    if ((completed + failures.length) % 100 === 0) onProgress({ completed, failed: failures.length, total: stages.length });
  }
  return { scope: `${seconds}-second constructor/runtime smoke for every available compiled stage; not a playable-clear or fidelity certificate`,
    available: stages.length, completed, failures, uniqueComponentsRead: requested.size, cache: loader.stats() };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await checkStageLibrary(undefined, { onProgress: p => console.error(`${p.completed}/${p.total} passed; ${p.failed} failed`) });
  console.log(JSON.stringify(report, null, 2)); if (report.failures.length) process.exitCode = 1;
}
