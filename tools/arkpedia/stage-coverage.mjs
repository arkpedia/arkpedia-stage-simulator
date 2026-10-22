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
import { SUPPORTED_STAGE_DEVICE_NAMES } from '../../shared/arkpedia/stage-devices.js';

const ROOT = new URL('../../', import.meta.url);
const SOURCE = new URL('../arkpedia-data/source/data/', ROOT);
const DATA = new URL('data/', ROOT);
const support = JSON.parse(readFileSync(new URL('arkpedia-enemy-support.json', DATA), 'utf8'));
const devicesByStage = existsSync(new URL('stage-devices.json', SOURCE))
  ? JSON.parse(readFileSync(new URL('stage-devices.json', SOURCE), 'utf8')) : {};

export function buildStageCoverage() {
  const stagesDir = new URL('stages/', SOURCE), geometryDir = new URL('stage-geometry/', SOURCE), conditionalDir = new URL('stage-conditional/', SOURCE);
  const byReason = {}, byCondition = {}, blockers = new Map(), byChapter = new Map(), buildable = [], hiddenMergeable = [];
  let total = 0, built = 0;
  for (const file of readdirSync(stagesDir).filter(name => name.endsWith('.json'))) {
    let stage;
    try { stage = JSON.parse(readFileSync(new URL(file, stagesDir), 'utf8')); } catch { continue; }
    if (stage.stage_type !== 'main') continue;
    total++;
    const chapter = /^S\d/i.test(stage.code) ? 'Side stories' : /^\d+-/.test(stage.code) ? `Chapter ${stage.code.split('-')[0]}` : 'Other';
    const bucket = byChapter.get(chapter) ?? { total: 0, built: 0 };
    bucket.total++; byChapter.set(chapter, bucket);
    if (existsSync(new URL(`arkpedia-stage-${stage.slug}.json`, DATA))) { built++; bucket.built++; continue; }
    const geometryUrl = new URL(`${stage.slug}.json`, geometryDir);
    if (!existsSync(geometryUrl)) { byReason['no-geometry'] = (byReason['no-geometry'] ?? 0) + 1; continue; }
    let geometry;
    try { geometry = JSON.parse(readFileSync(geometryUrl, 'utf8')); } catch { byReason['bad-geometry'] = (byReason['bad-geometry'] ?? 0) + 1; continue; }
    if ((geometry.suppliedUnits?.deployable_tokens ?? []).some(t => t.count !== 0)) { byReason.tokens = (byReason.tokens ?? 0) + 1; continue; }
    if ((devicesByStage[stage.slug] ?? []).some(d => d.kind === 'device' && !String(d.key).startsWith('char_') && !SUPPORTED_STAGE_DEVICE_NAMES.includes(d.name))) { byReason.devices = (byReason.devices ?? 0) + 1; continue; }
    if (geometry.hasConditionalSpawns) {
      byReason.conditional = (byReason.conditional ?? 0) + 1;
      const conditionalUrl = new URL(`${stage.slug}.json`, conditionalDir);
      if (existsSync(conditionalUrl)) {
        try {
          const entries = JSON.parse(readFileSync(conditionalUrl, 'utf8'));
          if (entries.length && entries.every(e => e.condition?.hidden_group && Object.keys(e.condition).length === 1
            && !e.branch && e.source === 'wave')) hiddenMergeable.push(stage.slug);
          for (const spawn of entries) {
            const kind = spawn.condition?.hidden_group ? 'hidden-group' : spawn.branch ? 'branch' : spawn.source === 'wave' ? 'wave' : 'other';
            byCondition[kind] = (byCondition[kind] ?? 0) + 1;
          }
        } catch { byCondition['bad-data'] = (byCondition['bad-data'] ?? 0) + 1; }
      } else byCondition['no-data'] = (byCondition['no-data'] ?? 0) + 1;
      continue;
    }
    if (geometry.rows > 19 || geometry.cols > 21) { byReason.oversized = (byReason.oversized ?? 0) + 1; continue; }
    const ids = [...new Set((geometry.waves ?? []).flatMap(wave => (wave.spawns ?? []).map(spawn => spawn.enemy_id)))].filter(Boolean);
    const missing = ids.filter(id => !support.enemies[id]?.policy);
    if (missing.length) {
      byReason['unsupported-enemies'] = (byReason['unsupported-enemies'] ?? 0) + 1;
      for (const id of missing) blockers.set(id, (blockers.get(id) ?? 0) + 1);
      continue;
    }
    byReason.buildable = (byReason.buildable ?? 0) + 1; buildable.push(stage.slug);
  }
  return { total, built, byReason, byChapter: [...byChapter].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })),
    blockers: [...blockers].sort((a, b) => b[1] - a[1]), buildable: buildable.sort(), byCondition, hiddenMergeable: hiddenMergeable.sort() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = buildStageCoverage(), rest = report.total - report.built;
  console.log(`${report.built} built / ${report.total} main stages (${rest} remaining)`);
  console.log(Object.entries(report.byReason).sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${k}: ${n}`).join('\n'));
  console.log('by chapter:');
  for (const [chapter, counts] of report.byChapter) console.log(`  ${chapter}: ${counts.built}/${counts.total}`);
  console.log(`conditional spawns by condition: ${Object.entries(report.byCondition).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(', ')}`);
  console.log(`pristine hidden-group stages: ${report.hiddenMergeable.length}${report.hiddenMergeable.length ? ` (${report.hiddenMergeable.join(', ')})` : ''}`);
  console.log(`buildable now: ${report.buildable.length}${report.buildable.length ? ` (${report.buildable.join(', ')})` : ''}`);
  console.log(`unsupported enemy blockers: ${report.blockers.length}`);
  for (const [id, n] of report.blockers.slice(0, 15)) console.log(`  ${n}  ${id}`);
}
