// SPDX-License-Identifier: GPL-3.0-or-later
// Classify every main stage in the source data by why it is not built yet.
// This is a maintainer report, not a runtime dependency:
//
//   node tools/arkpedia/stage-coverage.mjs
//
// `built` counts the committed data/arkpedia-stage-<slug>.json files (the
// embedded 0-1 stage is separate). The remaining stages are grouped by the
// first mechanic that blocks them, with the unsupported enemy ids ranked by
// how many stages they affect.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url);
const SOURCE = new URL('../arkpedia-data/source/data/', ROOT);
const DATA = new URL('data/', ROOT);
const support = JSON.parse(readFileSync(new URL('arkpedia-enemy-support.json', DATA), 'utf8'));

export function buildStageCoverage() {
  const stagesDir = new URL('stages/', SOURCE), geometryDir = new URL('stage-geometry/', SOURCE);
  const byReason = {}, blockers = new Map();
  let total = 0, built = 0;
  for (const file of readdirSync(stagesDir).filter(name => name.endsWith('.json'))) {
    let stage;
    try { stage = JSON.parse(readFileSync(new URL(file, stagesDir), 'utf8')); } catch { continue; }
    if (stage.stage_type !== 'main') continue;
    total++;
    if (existsSync(new URL(`arkpedia-stage-${stage.slug}.json`, DATA))) { built++; continue; }
    const geometryUrl = new URL(`${stage.slug}.json`, geometryDir);
    if (!existsSync(geometryUrl)) { byReason['no-geometry'] = (byReason['no-geometry'] ?? 0) + 1; continue; }
    let geometry;
    try { geometry = JSON.parse(readFileSync(geometryUrl, 'utf8')); } catch { byReason['bad-geometry'] = (byReason['bad-geometry'] ?? 0) + 1; continue; }
    if ((geometry.suppliedUnits?.deployable_tokens?.length ?? 0) > 0) { byReason.tokens = (byReason.tokens ?? 0) + 1; continue; }
    if (geometry.hasConditionalSpawns) { byReason.conditional = (byReason.conditional ?? 0) + 1; continue; }
    if (geometry.rows > 19 || geometry.cols > 21) { byReason.oversized = (byReason.oversized ?? 0) + 1; continue; }
    const ids = [...new Set((geometry.waves ?? []).flatMap(wave => (wave.spawns ?? []).map(spawn => spawn.enemy_id)))].filter(Boolean);
    const missing = ids.filter(id => !support.enemies[id]?.policy);
    if (missing.length) {
      byReason['unsupported-enemies'] = (byReason['unsupported-enemies'] ?? 0) + 1;
      for (const id of missing) blockers.set(id, (blockers.get(id) ?? 0) + 1);
      continue;
    }
    byReason.other = (byReason.other ?? 0) + 1;
  }
  return { total, built, byReason, blockers: [...blockers].sort((a, b) => b[1] - a[1]) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = buildStageCoverage(), rest = report.total - report.built;
  console.log(`${report.built} built / ${report.total} main stages (${rest} remaining)`);
  console.log(Object.entries(report.byReason).sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${k}: ${n}`).join('\n'));
  console.log(`unsupported enemy blockers: ${report.blockers.length}`);
  for (const [id, n] of report.blockers.slice(0, 15)) console.log(`  ${n}  ${id}`);
}
