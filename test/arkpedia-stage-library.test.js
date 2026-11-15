// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStageLibrary, publishStageLibrary, stageCapabilityPriorities } from '../tools/arkpedia/stage-library.mjs';
import { createStageLibraryLoader, validateStageLibrary } from '../shared/arkpedia/stage-library.js';
import { applyStage, resolveStage, loadStageCatalogue } from '../shared/arkpedia/stages.js';
const definition = { key: 'enemy_a', name: 'Shared enemy', skills: [], talents: { bb: {} } };
const sourceStage = (atk = 100) => ({ code: 'A', name: 'A stage', battle: { max_life: 3 },
  geometry: { rows: 3, cols: 4 }, pathing: { paths: {} },
  enemies: { enemy_a: { ...definition, stats: { atk, maxHp: 1000 } } } });
const context = { index: { stages: [], defaultStage: 'a' }, sourceRevision: { commit: 'pinned' }, support: { source: {} } };
const plan = async (_c, id) => ({ id, code: id.toUpperCase(), name: id, mode: 'main', combat: true,
  blockers: id === 'blocked' ? [{ kind: 'device', id: 'weather' }] : [], stage: sourceStage(id === 'b' ? 120 : 100) });
const build = options => buildStageLibrary(context, { ids: ['a', 'b', 'blocked'], plan, ...options });
function fetchObjects(objects, requested = []) {
  return async url => { requested.push(url); const bytes = objects.get(url.split('/').at(-1).slice(0, -5));
    return new Response(bytes ?? '', { status: bytes == null ? 404 : 200 }); };
}
test('source capability changes admit uncatalogued stages automatically and report every blocked dependency', async () => {
  const first = await build(); assert.equal(first.manifest.stages.length, 3); assert.equal(first.report.available, 2);
  assert.equal(context.index.stages.length, 0, 'no manual stage registration');
  assert.throws(() => resolveStage(first.manifest, 'blocked'), e => e.code === 'STAGE_UNSUPPORTED' && e.blockers[0].id === 'weather');
  const next = await build({ plan: async (c, id) => ({ ...await plan(c, id), blockers: [] }) });
  assert.equal(next.report.available, 3); assert.ok(resolveStage(next.manifest, 'blocked').bundle);
  assert.deepEqual(first.report.priorities[0].stages, ['blocked']);
});
test('priorities group shared rule failures across variants and distinguish stages with several blockers', () => {
  const report = stageCapabilityPriorities({ capabilities: [
    { kind: 'stage-rules', id: 'level', message: 'Missing weather timing' },
    { kind: 'stage-rules', id: 'challenge_mode', message: 'Missing weather timing' },
    { kind: 'stage-rules', id: 'level', message: 'Missing tile behavior' },
    { kind: 'enemy', id: 'enemy_a' },
  ], stages: [{ id: 'a', missing: [0] }, { id: 'b', missing: [1, 3] }, { id: 'c', missing: [2] }] });
  assert.deepEqual(report[0], { kind: 'stage-rules', reason: 'Missing weather timing', stages: ['a', 'b'], soleReportedBlockerStages: ['a'] });
  assert.equal(report.length, 3);
});
test('normal/challenge graphs share geometry and enemy definitions while retaining independent stats and loads', async () => {
  const { manifest, objects } = await build(), requested = [];
  const [a, b] = manifest.stages, graph = e => JSON.parse(objects.get(e.bundle));
  assert.equal(graph(a).geometry, graph(b).geometry);
  assert.equal(graph(a).enemies.enemy_a.definition, graph(b).enemies.enemy_a.definition);
  assert.notEqual(graph(a).enemies.enemy_a.stats, graph(b).enemies.enemy_a.stats);
  const loader = createStageLibraryLoader(fetchObjects(objects, requested));
  const [normal, challenge] = await Promise.all([loader.load(a), loader.load(b)]);
  assert.deepEqual(normal, sourceStage()); assert.deepEqual(challenge, sourceStage(120));
  assert.equal(new Set(requested).size, requested.length, 'shared in-flight components fetched once');
  normal.enemies.enemy_a.stats.atk = -1; normal.geometry.rows = 99;
  assert.deepEqual(await loader.load(a), sourceStage(), 'caller mutations cannot contaminate cached definitions');
  assert.ok(loader.stats().cachedBytes > 0);
});
test('fetch concurrency and payload cache are bounded, and missing/corrupt components can be retried', async () => {
  const { manifest, objects } = await build(); let active = 0, peak = 0, fail = true;
  const fetcher = fetchObjects(objects);
  const loader = createStageLibraryLoader(async url => {
    active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 2)); active--;
    if (fail) return new Response('corrupt bytes'); return fetcher(url);
  }, { concurrency: 2, maxCachedBytes: 100 });
  await assert.rejects(loader.load(manifest.stages[0]), /checksum mismatch/); fail = false;
  assert.deepEqual(await loader.load(manifest.stages[0]), sourceStage());
  assert.ok(peak <= 2); assert.ok(loader.stats().cachedBytes <= 100);
  const missing = createStageLibraryLoader(async () => new Response('', { status: 404 }));
  await assert.rejects(missing.load(manifest.stages[0]), /unavailable/);
});
test('normal/challenge stage graphs share the original wave program as a separate component', async () => {
  const waveProgram = { schemaVersion: 1, waves: [] };
  const library = await build({ plan: async (c, id) => {
    const row = await plan(c, id); row.stage.waveProgram = waveProgram; return row;
  } });
  const [a, b] = library.manifest.stages;
  const graphA = JSON.parse(library.objects.get(a.bundle)), graphB = JSON.parse(library.objects.get(b.bundle));
  assert.equal(graphA.waveProgram, graphB.waveProgram);
  assert.equal(JSON.parse(library.objects.get(graphA.definition)).waveProgram, undefined);
  const loader = createStageLibraryLoader(fetchObjects(library.objects));
  const stage = await loader.load(a); assert.deepEqual(stage.waveProgram, waveProgram);
  stage.waveProgram.waves.push({ corrupted: true });
  assert.deepEqual((await loader.load(b)).waveProgram, waveProgram);
});
test('installing a stage is atomic and switching does not retain previous enemy/support overrides', async () => {
  const library = await build({ plan: async (c, id) => {
    const row = await plan(c, id); if (id === 'a') row.stage.operators = { support_only: { id: 'support_only' } };
    if (id === 'b') row.stage.enemies = { enemy_b: { ...definition, key: 'enemy_b', stats: { atk: 200 } } };
    return row;
  } });
  const data = { stage: { code: 'base' }, operators: { original: { id: 'original' } }, enemies: { original: { key: 'original' } } };
  const fetcher = fetchObjects(library.objects);
  await applyStage(data, library.manifest, 'a', fetcher); assert.ok(data.operators.support_only);
  const before = structuredClone(data);
  await assert.rejects(applyStage(data, library.manifest, 'b', async () => new Response('', { status: 404 })), /unavailable/);
  assert.deepEqual(data, before);
  await applyStage(data, library.manifest, 'b', fetcher);
  assert.equal(data.operators.support_only, undefined); assert.equal(data.enemies.enemy_a, undefined);
  assert.ok(data.enemies.enemy_b); assert.ok(data.enemies.original);
});
test('manifest publication is atomic, immutable objects are verified, and legacy fallback is only for absent libraries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stage-library-'));
  try {
    const library = await build(); await publishStageLibrary(library, root);
    const path = join(root, 'data', 'arkpedia-library.json'), before = await readFile(path, 'utf8');
    await assert.rejects(publishStageLibrary(library, root, { publish: async () => { throw Error('interrupted'); } }), /interrupted/);
    assert.equal(await readFile(path, 'utf8'), before);
    const corrupt = { ...library, objects: new Map(library.objects) }; corrupt.objects.set(corrupt.manifest.stages[0].bundle, '{}');
    await assert.rejects(publishStageLibrary(corrupt, root), /digest/);
    const legacy = { schemaVersion: 1, defaultStage: 'a', stages: [{ id: 'a', code: 'A', name: 'A', data: null }] };
    let requests = 0;
    assert.deepEqual(await loadStageCatalogue(async () => ++requests === 1 ? new Response('', { status: 404 }) : Response.json(legacy)), legacy);
    await assert.rejects(loadStageCatalogue(async () => new Response('', { status: 500 })), /unavailable/);
    const invalid = structuredClone(library.manifest); invalid.stages[0].bundle = '../outside';
    assert.throws(() => validateStageLibrary(invalid), /reference/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('explicit bootstrap reuse preserves controlled home-page fixtures but never overrides a selected stage', async () => {
  const { manifest, objects } = await build();
  const data = { stage: { ...sourceStage(), battle: { initial_dp: 99 }, code: 'A' }, operators: {}, enemies: {} };
  let requested = [];
  await applyStage(data, manifest, null, fetchObjects(objects, requested), { embeddedDefault: true });
  assert.equal(data.stage.battle.initial_dp, 99); assert.equal(requested.length, 0);
  await applyStage(data, manifest, 'a', fetchObjects(objects, requested), { embeddedDefault: true });
  assert.equal(data.stage.battle.max_life, 3); assert.equal(data.stage.battle.initial_dp, undefined);
  assert.ok(requested.length);
});

test('legacy presentation retains viewer routes but never restores stale generated waits and tunnels',async()=>{
  const stage=sourceStage();stage.pathing={geometryHash:'same',syntheticRoutes:[0,1],paths:{0:{holds:[{seconds:3}]},1:{rebuilt:true}}};
  const prior=structuredClone(stage);prior.pathing={geometryHash:'same',syntheticRoutes:[0],paths:{0:{holds:[]},1:{viewer:true}}};
  const c={...context,index:{stages:[{id:'a'}],defaultStage:'a'},mvp:{stage:prior}};
  const library=await buildStageLibrary(c,{ids:['a'],plan:async()=>({...await plan(c,'a'),stage})});
  const loaded=await createStageLibraryLoader(fetchObjects(library.objects)).load(library.manifest.stages[0]);
  assert.deepEqual(loaded.pathing.paths,{0:{holds:[{seconds:3}]},1:{viewer:true}});
  assert.deepEqual(loaded.pathing.syntheticRoutes,[0]);
});
