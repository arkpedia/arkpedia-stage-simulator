// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { loadContentContext, planStage } from './content-inventory.mjs';
import { writeJSONAtomic } from './write-json.mjs';
import { publishComponentObjects } from './component-store.mjs';
import { validateStageLibrary } from '../../shared/arkpedia/stage-library.js';
import { groupStageBlockers } from './content-priorities.mjs';
import { withCompiledEnemyRuntime } from '../../shared/arkpedia/enemy-runtime-compiler.js';
const encode = value => JSON.stringify(value) + '\n';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/** Explicit graph edges, not arbitrary JSON patches. Stats and definitions have
 * independent identities so challenge stat overrides reuse the same behavior. */
export function packStage(id, stage, put) {
  const { geometry, pathing, waveProgram, enemies = {}, operators = {}, contentAddition, contentRuleRefresh, ...definition } = stage;
  return put({ schemaVersion: 1, kind: 'stage', id, definition: put(definition), geometry: put(geometry), pathing: put(pathing),
    ...(waveProgram ? { waveProgram: put(waveProgram) } : {}),
    enemies: Object.fromEntries(Object.entries(enemies).map(([key, source]) => {
      const { stats, ...record } = source.abilities && source.talents?.groups ? withCompiledEnemyRuntime(source) : source;
      return [key, { definition: put(record), stats: put(stats) }];
    })),
    ...(Object.keys(operators).length ? { operators: Object.fromEntries(Object.entries(operators).map(([key, record]) => [key, put(record)])) } : {}) });
}

/** Group compiler refusals by the missing mechanic/reason, not by a variant
 * label such as "level" or a stage-specific identity. A sole reported blocker
 * is a prioritization hint: implementing it can expose further compiler checks. */
export function stageCapabilityPriorities(manifest) {
  return groupStageBlockers(manifest.stages.map(stage => ({ id: stage.id,
    blockers: (stage.missing ?? []).map(index => manifest.capabilities[index]) })));
}

export async function buildStageLibrary(context, { ids, plan = (context, id) => planStage(context, id, { waves: true }), onProgress = () => {} } = {}) {
  ids ??= (await readdir(join(context.source, 'stages'))).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
  if (new Set(ids).size !== ids.length) throw Error('Duplicate stage source identity');
  const objects = new Map(), capabilities = [], capabilityIds = new Map(), stages = [];
  let inlineBytes = 0, referenceBytes = 0;
  const put = value => {
    if (value === undefined) throw Error('Missing stage component');
    const bytes = encode(value), hash = digest(bytes); objects.set(hash, bytes); referenceBytes += Buffer.byteLength(bytes); return hash;
  };
  for (const [i, id] of ids.entries()) {
    const row = await plan(context, id);
    if (!row.combat) continue;
    const entry = { id, code: row.code || id, name: row.name || 'Unnamed stage', mode: row.mode };
    if (row.blockers.length) {
      entry.availability = 'blocked'; entry.missing = [];
      for (const blocker of row.blockers) {
        const key = encode(blocker);
        if (!capabilityIds.has(key)) { capabilityIds.set(key, capabilities.length); capabilities.push(blocker); }
        entry.missing.push(capabilityIds.get(key));
      }
    } else {
      if (!row.stage) throw Error(`Missing compiled stage: ${id}`);
      let stage = row.stage;
      // Legacy entries supply presentation only, never admission or rules.
      const old = context.index.stages.find(e => e.id === id);
      if (old) {
        const prior = old.data ? JSON.parse(await readFile(join(context.root, 'data', old.data), 'utf8')) : context.mvp.stage;
        stage = { ...stage, art: prior.art ?? null, gates: prior.gates ?? null,
          mapTags: prior.mapTags ?? stage.mapTags, mapTagSource: prior.mapTagSource ?? stage.mapTagSource };
        if (JSON.stringify(prior.geometry) === JSON.stringify(stage.geometry) && prior.pathing?.geometryHash === stage.pathing.geometryHash) {
          // Viewer paths are presentation evidence. Old generated paths are
          // rebuildable code output and must receive current wait/tunnel fixes.
          const generated = new Set(prior.pathing.syntheticRoutes ?? []);
          const retained = Object.fromEntries(Object.entries(prior.pathing.paths ?? {}).filter(([i]) => !generated.has(Number(i))));
          stage.pathing = { ...stage.pathing, paths: { ...stage.pathing.paths, ...retained },
            syntheticRoutes: stage.pathing.syntheticRoutes.filter(i => !Object.hasOwn(retained, i)) };
        }
      }
      inlineBytes += Buffer.byteLength(encode(stage));
      entry.availability = 'available'; entry.bundle = packStage(id, stage, put);
    }
    stages.push(entry);
    if ((i + 1) % 100 === 0) onProgress({ processed: i + 1, total: ids.length, available: stages.filter(e => e.bundle).length });
  }
  const available = stages.filter(e => e.availability === 'available');
  const manifest = { schemaVersion: 2, defaultStage: available.find(e => e.id === context.index.defaultStage)?.id ?? available[0]?.id,
    source: { ...context.sourceRevision, enemyRecords: context.support.source },
    scope: 'Availability follows implemented component contracts, not legacy registration; not a native fidelity certificate.',
    capabilities, stages };
  validateStageLibrary(manifest);
  const report = { combatStages: stages.length, available: available.length, blocked: stages.length - available.length,
    componentObjects: objects.size, componentBytes: [...objects.values()].reduce((n, s) => n + Buffer.byteLength(s), 0),
    manifestBytes: Buffer.byteLength(encode(manifest)), inlineStageBytes: inlineBytes, referencedComponentBytes: referenceBytes,
    priorities: stageCapabilityPriorities(manifest) };
  return { manifest, objects, report };
}

/** Compare identities, not net totals: a larger library can still lose a stage. */
export function assertPreservedStageAvailability(previous, next) {
  const available = new Set(next.stages.filter(s => s.availability === 'available').map(s => s.id));
  const removed = (previous.stages ?? []).filter(s => s.availability === 'available' && !available.has(s.id))
    .map(s => s.id).sort();
  if (removed.length) throw Error(`Stage library would remove ${removed.length} loadable stages: ${removed.join(', ')}. Fix the regression, or use --allow-removals after reviewing an intentional withdrawal.`);
}

/** Write immutable objects first. The atomic manifest replacement is the only
 * publication point; old objects remain usable by already-open clients. */
export async function publishStageLibrary({ manifest, objects, report }, root, { publish = writeJSONAtomic, allowRemovals = false } = {}) {
  validateStageLibrary(manifest);
  if (!allowRemovals) {
    let previous;
    try { previous = JSON.parse(await readFile(join(root, 'data', 'arkpedia-library.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous) assertPreservedStageAvailability(previous, manifest);
  }
  await publishComponentObjects(objects, root);
  await publish(join(root, 'data', 'arkpedia-library.json'), validateStageLibrary(manifest), { space: 0 });
  await writeJSONAtomic(join(root, 'data', 'arkpedia-library-report.json'), report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const context = await loadContentContext({ ...(process.env.ARKPEDIA_CONTENT_SOURCE ? { source: resolve(process.env.ARKPEDIA_CONTENT_SOURCE) } : {}) });
  const library = await buildStageLibrary(context, { onProgress: p => console.error(`${p.processed}/${p.total}: ${p.available} loadable stages`) });
  await publishStageLibrary(library, context.root, { allowRemovals: process.argv.includes('--allow-removals') });
  const { priorities, ...summary } = library.report; console.log(JSON.stringify(summary, null, 2));
}
