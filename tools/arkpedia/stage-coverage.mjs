// SPDX-License-Identifier: GPL-3.0-or-later
// Main-stage view of the same preflight used by atomic additions and inventory.
import { pathToFileURL } from 'node:url';
import { buildContentInventory } from './content-inventory.mjs';

export async function buildStageCoverage(inventory) {
  inventory ??= await buildContentInventory();
  const stages = inventory.stages.filter(stage => stage.mode === 'main');
  const byReason = {}, chapters = new Map(), enemies = new Map(), buildable = [];
  let built = 0;
  for (const stage of stages) {
    const chapter = /^S\d/i.test(stage.code) ? 'Side stories' : /^\d+-/.test(stage.code)
      ? `Chapter ${stage.code.split('-')[0]}` : 'Other';
    const bucket = chapters.get(chapter) ?? { total: 0, built: 0 };
    bucket.total++; chapters.set(chapter, bucket);
    if (['public', 'test-only'].includes(stage.status)) { built++; bucket.built++; continue; }
    const reason = stage.status === 'ready' ? 'buildable' : stage.blockers[0].kind;
    byReason[reason] = (byReason[reason] ?? 0) + 1;
    if (stage.status === 'ready') buildable.push(stage.id);
    for (const blocker of stage.blockers.filter(row => ['enemy', 'enemy-data'].includes(row.kind)))
      enemies.set(blocker.id, (enemies.get(blocker.id) ?? 0) + 1);
  }
  return { total: stages.length, built, byReason,
    byChapter: [...chapters].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })),
    blockers: [...enemies].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), buildable: buildable.sort() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await buildStageCoverage();
  console.log(`${report.built} catalogued / ${report.total} main combat stages (including embedded and developer-only)`);
  console.log(JSON.stringify(report, null, 2));
}
