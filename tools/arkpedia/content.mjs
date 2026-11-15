// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile, rm, open } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadContentContext, planStage, operatorInventory, digest } from './content-inventory.mjs';
import { writeJSONAtomic } from './write-json.mjs';
import { validateStageIndex } from '../../shared/arkpedia/stages.js';
import { StandardBattle } from '../../server/sim/arkpedia.js';
import { defaultBuild } from '../../shared/arkpedia/loadout.js';
import { excludedStageOperators, stageSquadLimit } from '../../shared/arkpedia/stage-roster.js';

/** Exercise the same constructor and runtime used by the public battle. This is
 * a load/runtime gate, not a claim that ten seconds prove stage fidelity. */
export function smokeStage(context, stage, seconds = 10) {
  const data = { ...context.mvp, stage, operators: { ...context.mvp.operators, ...stage.operators },
    enemies: { ...context.mvp.enemies, ...stage.enemies } };
  const excluded = excludedStageOperators(stage, data.operators);
  const battle = new StandardBattle(data, {
    operators: Object.values(context.mvp.operators).filter(op => !excluded.has(op.id)).slice(0, Math.min(5, stageSquadLimit(stage))).map(defaultBuild),
  }, { seed: 1 });
  battle.setViewport('fullscreen-workspace');
  for (let step = 0; step < Math.ceil(seconds / battle.dt) && !battle.finished; step++) battle.step();
  if (battle.errors.length) throw Error(`Stage smoke failed: ${JSON.stringify(battle.errors)}`);
  return { seconds: battle.time, spawned: battle.units.filter(unit => unit.side === 'enemy').length, errors: 0 };
}

/** Append-only addition: the catalogue is the commit point. Existing stages
 * cannot be overwritten or promoted by this command. On ordinary failure the
 * unlisted new file is rolled back; an interrupted process leaves no public entry. */
export async function applyStageAddition(context, plan, { publish = writeJSONAtomic } = {}) {
  if (!plan.stage || plan.blockers.length) throw Error('Cannot add a blocked stage');
  if (!/^[a-z0-9_-]+$/i.test(plan.id)) throw Error('Invalid stage id');
  const dataDir = join(context.root, 'data'), indexPath = join(dataDir, 'arkpedia-stages.json');
  const lockPath = join(dataDir, '.content-add.lock');
  const lock = await open(lockPath, 'wx');
  const file = `arkpedia-stage-${plan.id}.json`, target = join(dataDir, file);
  let created = false, committed = false, bytes;
  try {
    const originalIndex = await readFile(indexPath, 'utf8');
    const index = validateStageIndex(JSON.parse(originalIndex));
    if (index.stages.some(entry => entry.id === plan.id || entry.data === file)) throw Error(`Stage already registered: ${plan.id}`);
    for (const source of plan.sources) {
      if (digest(await readFile(join(context.source, source.path))) !== source.sha256)
        throw Error(`Source changed; re-plan the addition: ${source.path}`);
    }
    for (const source of plan.localSources ?? []) {
      if (digest(await readFile(join(context.root, source.path))) !== source.sha256)
        throw Error(`Local rules changed; re-plan the addition: ${source.path}`);
    }
    const smoke = smokeStage(context, plan.stage);
    const stage = { ...plan.stage, contentAddition: { schemaVersion: 1,
      source: { repository: 'arkpedia/arkpedia-data', commit: context.sourceRevision.commit, files: plan.sources,
        ...(plan.localSources?.length ? { localFiles: plan.localSources } : {}) },
      dependencies: plan.dependencies, validation: { smoke, publicReview: 'pending' } } };
    bytes = JSON.stringify(stage, null, 1) + '\n';
    await writeFile(target, bytes, { flag: 'wx' });
    created = true;
    const entry = { id: plan.id, code: stage.code, name: stage.name, description: stage.description ?? '', data: file, testOnly: true };
    // Match the catalogue generator's stable order while preserving curated entries.
    const next = { ...index, stages: [...index.stages.filter(entry => !entry.testOnly),
      ...[...index.stages.filter(entry => entry.testOnly), entry].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))] };
    validateStageIndex(next);
    if (await readFile(indexPath, 'utf8') !== originalIndex) throw Error('Stage catalogue changed; re-plan the addition');
    await publish(indexPath, next);
    committed = true;
    return { id: plan.id, file, testOnly: true, smoke };
  } finally {
    try {
      if (created && !committed) {
        // A publisher can throw during cleanup after its rename has succeeded.
        // Never roll back a file already referenced by the visible catalogue.
        let referenced = true;
        try { referenced = JSON.parse(await readFile(indexPath, 'utf8')).stages.some(entry => entry.data === file); }
        catch { /* Ambiguous publication: preserve the file for recovery. */ }
        if (!referenced && await readFile(target, 'utf8') === bytes) await rm(target);
      }
    } finally {
      await lock.close();
      await rm(lockPath);
    }
  }
}

/** Refresh executable rules on an existing stage without replacing reviewed
 * geometry, artwork or catalogue visibility. Source edits use the same lock and
 * digest recheck as additions; a single atomic file replacement is the commit. */
export async function refreshStageRules(context, plan, { apply = false, refreshRoutes = false, refreshDevices = false, refreshSupplies = false } = {}) {
  if (!plan.stage || plan.blockers.length) throw Error('Cannot refresh a blocked stage');
  const dataDir = join(context.root, 'data');
  const index = validateStageIndex(JSON.parse(await readFile(join(dataDir, 'arkpedia-stages.json'), 'utf8')));
  const entry = index.stages.find(entry => entry.id === plan.id);
  if (!entry) throw Error('Stage is not registered; use add');
  const target = join(dataDir, entry.data), original = await readFile(target, 'utf8'), old = JSON.parse(original);
  // Shared normal/adverse geometry may retain the normal file's lookup slug.
  // Its identity label is not executable map, route or wave content.
  const geometryContent = ({ slug: _slug, ...geometry }) => refreshSupplies && geometry.suppliedUnits
    ? { ...geometry, suppliedUnits: { ...geometry.suppliedUnits,
      deployable_tokens: geometry.suppliedUnits.deployable_tokens?.map(({ count: _count, ...card }) => card) } } : geometry;
  const mapContent = geometry => Object.fromEntries(Object.entries(geometryContent(geometry))
    .filter(([key]) => !['routes', 'waves', 'spawnTiles', 'objectiveTiles', 'enemyConfigurations'].includes(key)));
  const compare = refreshRoutes ? mapContent : geometryContent;
  if (JSON.stringify(compare(old.geometry)) !== JSON.stringify(compare(plan.stage.geometry)))
    throw Error('Geometry changed; rule-only refresh requires a separate stage review');
  if (refreshRoutes && plan.stage.pathing?.geometryHash !== digest(JSON.stringify(plan.stage.geometry)))
    throw Error('Route refresh requires matching compiled geometry/pathing');
  const supplyGeometry = refreshSupplies ? { ...old.geometry, suppliedUnits: { ...old.geometry.suppliedUnits,
    deployable_tokens: plan.stage.geometry.suppliedUnits?.deployable_tokens } } : null;
  const next = { ...old, rules: plan.stage.rules, battle: plan.stage.battle,
    enemies: plan.stage.enemies, tokens: plan.stage.tokens, environment: plan.stage.environment,
    ...(refreshDevices ? { devices: plan.stage.devices } : {}),
    ...(refreshSupplies ? { geometry: supplyGeometry, pathing: { ...old.pathing, geometryHash: digest(JSON.stringify(supplyGeometry)) } } : {}),
    ...(refreshRoutes ? { geometry: plan.stage.geometry, pathing: plan.stage.pathing } : {}) };
  const changed = ['rules', 'battle', 'enemies', 'tokens', 'environment', ...(refreshDevices ? ['devices'] : []), ...(refreshRoutes || refreshSupplies ? ['geometry', 'pathing'] : [])]
    .filter(key => JSON.stringify(old[key]) !== JSON.stringify(next[key]));
  const smoke = smokeStage(context, next);
  const summary = { id: plan.id, file: entry.data, changed, smoke, applied: false };
  if (!apply || !changed.length) return summary;
  const lockPath = join(dataDir, '.content-add.lock'), lock = await open(lockPath, 'wx');
  try {
    for (const [base, sources] of [[context.source, plan.sources], [context.root, plan.localSources ?? []]])
      for (const source of sources) if (digest(await readFile(join(base, source.path))) !== source.sha256)
        throw Error(`Source changed; re-plan the refresh: ${source.path}`);
    if (await readFile(target, 'utf8') !== original) throw Error('Stage changed; re-plan the refresh');
    next.contentRuleRefresh = { schemaVersion: 1, source: { repository: 'arkpedia/arkpedia-data',
      commit: context.sourceRevision.commit, files: plan.sources, localFiles: plan.localSources ?? [] },
      validation: { smoke }, changed, ...(refreshRoutes ? { routeRefresh: true } : {}),
      ...(refreshDevices ? { deviceRefresh: true } : {}), ...(refreshSupplies ? { supplyRefresh: true } : {}) };
    await writeJSONAtomic(target, next);
    return { ...summary, applied: true };
  } finally { await lock.close(); await rm(lockPath); }
}

export async function runContent(args) {
  const [command, kind, id, ...flags] = args;
  if (!['plan', 'add', 'refresh'].includes(command) || !['operator', 'enemy', 'stage'].includes(kind) || !id ||
      flags.some(flag => flag !== '--apply' && !(command === 'refresh' && ['--routes', '--devices', '--supplies'].includes(flag)))
      || new Set(flags).size !== flags.length || (command === 'plan' && flags.length))
    throw Error('Usage: npm run content -- plan <operator|enemy|stage> <id> | <add|refresh> stage <id> [--apply] [refresh only: --routes --devices --supplies]');
  if (['add', 'refresh'].includes(command) && kind !== 'stage') throw Error('Implement and test the operator/enemy behavior first; plan lists its registration gaps');
  const context = await loadContentContext({ requireStageSource: kind === 'stage', source: process.env.ARKPEDIA_CONTENT_SOURCE
    ? resolve(process.env.ARKPEDIA_CONTENT_SOURCE) : undefined });
  if (kind === 'operator') {
    const row = operatorInventory(context).find(row => row.id === id);
    if (!row) throw Error(`Operator is not in the pinned target: ${id}`);
    console.log(JSON.stringify(row, null, 2)); return;
  }
  if (kind === 'enemy') {
    const row = context.support.enemies[id];
    if (!row) throw Error(`Enemy is not in the pinned catalogue: ${id}`);
    console.log(JSON.stringify({ id, ...row }, null, 2)); return;
  }
  const plan = await planStage(context, id, { waves: command === 'plan' });
  if (command === 'refresh') console.log(JSON.stringify(await refreshStageRules(context, plan,
    { apply: flags.includes('--apply'), refreshRoutes: flags.includes('--routes'), refreshDevices: flags.includes('--devices'), refreshSupplies: flags.includes('--supplies') }), null, 2));
  else if (command === 'add' && flags.includes('--apply')) console.log(JSON.stringify(await applyStageAddition(context, plan), null, 2));
  else {
    const { stage, ...summary } = plan;
    console.log(JSON.stringify({ ...summary, writes: stage && plan.status === 'ready'
      ? [`data/arkpedia-stage-${id}.json`, 'data/arkpedia-stages.json'] : [],
    ...(stage && plan.status === 'ready' ? { smoke: smokeStage(context, stage) } : {}) }, null, 2));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runContent(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
