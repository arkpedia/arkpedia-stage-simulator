// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planStage, digest, readJSON } from '../tools/arkpedia/content-inventory.mjs';
import { applyStageAddition, refreshStageRules } from '../tools/arkpedia/content.mjs';
import { compileStage } from '../tools/arkpedia/build-stage.mjs';
import { writeJSONAtomic } from '../tools/arkpedia/write-json.mjs';
import { buildStageLibrary } from '../tools/arkpedia/stage-library.mjs';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import ruleReceipt from '../data/stage-rules/5-4_challenge_mode.json' with { type: 'json' };

const [mvp, records, support, tokenData, supportOperators] = await Promise.all([
  'mvp', 'enemy-records', 'enemy-support', 'deployable-tokens', 'support-operators',
].map(name => readJSON(new URL(`../data/arkpedia-${name}.json`, import.meta.url))));
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'arkpedia-content-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source'), id = 'atomic-example';
  await Promise.all(['data/stage-rules', 'source/stages', 'source/stage-geometry', '.cache/arkpedia/original-level-blobs'].map(dir => mkdir(join(root, dir), { recursive: true })));
  const index = { schemaVersion: 1, defaultStage: '0-1', stages: [{ id: '0-1', code: '0-1', name: 'Collapse', data: null }] };
  await writeFile(join(root, 'data/arkpedia-stages.json'), JSON.stringify(index));
  await writeFile(join(source, 'stages', `${id}.json`), JSON.stringify({
    slug: id, id: 'fixture_stage', code: 'TEST', name: 'Atomic fixture', stage_type: 'main', battle: mvp.stage.battle,
  }));
  // Retain a minimal original action sequence as well as the viewer export.
  const waves = mvp.stage.geometry.waves.map(wave => {
    let clock = wave.pre_delay ?? 0;
    const fragments = Array.from({ length: 1 + Math.max(...wave.spawns.map(s => s.fragment)) }, (_, index) => {
      const rows = wave.spawns.filter(s => s.fragment === index);
      const actions = rows.map(s => ({ actionType: 'SPAWN', key: s.enemy_id, managedByScheduler: true,
        count: s.count, preDelay: s.time - clock, interval: s.interval ?? 1, routeIndex: s.route }));
      clock += Math.max(0, ...actions.map(a => a.preDelay + (a.count - 1) * a.interval));
      return { preDelay: 0, actions };
    });
    return { preDelay: wave.pre_delay ?? 0, postDelay: wave.post_delay ?? 0,
      maxTimeWaitingForNextWave: wave.max_wait_for_next_wave ?? -1, fragments };
  });
  const enemyDbRefs = mvp.stage.geometry.enemyConfigurations.map(c => ({ id: c.enemy_id, useDb: true, level: c.database_level ?? 0,
    overwrittenData: { attributes: Object.fromEntries(Object.entries(c.overrides ?? {}).map(([key, value]) => {
      assert.ok(['hp', 'atk', 'def', 'res'].includes(key), 'Fixture attribute requires an explicit native mapping');
      return [{ hp: 'maxHp', atk: 'atk', def: 'def', res: 'magicResistance' }[key], { m_defined: true, m_value: value }];
    })) } }));
  const original = JSON.stringify({ enemyDbRefs, waves }), gitBlob = createHash('sha1').update(`blob ${Buffer.byteLength(original)}\0`).update(original).digest('hex');
  await writeFile(join(root, '.cache/arkpedia/original-level-blobs', `${gitBlob}.json`), original);
  await writeFile(join(root, 'data/stage-rules', `${id}.json`), JSON.stringify({ schemaVersion: 1, stageId: 'fixture_stage',
    source: { commit: 'a'.repeat(40), sha256: digest(original), gitBlob }, runes: null }));
  await writeFile(join(source, 'stage-geometry', `${id}.json`), JSON.stringify(mvp.stage.geometry));
  await writeFile(join(source, 'stage-devices.json'), '{}');
  const context = { root, source, mvp, records, support, tokenData, supportOperators, index, devices: {},
    sourceRevision: { commit: 'a'.repeat(40), deviceTableSha256: digest('{}') } };
  return { context, id, root, source };
}

test('one stage addition validates dependencies, retains provenance, and enters only the developer catalogue', async t => {
  const { context, id, root } = await fixture(t);
  const plan = await planStage(context, id);
  assert.equal(plan.status, 'ready'); assert.deepEqual(plan.blockers, []);
  const result = await applyStageAddition(context, plan);
  const index = await readJSON(join(root, 'data/arkpedia-stages.json'));
  const entry = index.stages.find(entry => entry.id === id);
  assert.equal(entry.testOnly, true); assert.equal(result.smoke.errors, 0);
  const stage = await readJSON(join(root, 'data', entry.data));
  assert.equal(stage.contentAddition.source.files.length, 3);
  assert.equal(stage.contentAddition.validation.publicReview, 'pending');
  await assert.rejects(applyStageAddition(context, plan), /already registered/);
});

test('the library discovers a source stage and round-trips the shared compiler without registering a stage file', async t => {
  const { context, id, root } = await fixture(t);
  const expected = await planStage(context, id, { waves: true });
  assert.deepEqual(expected.blockers, []);
  const library = await buildStageLibrary(context);
  assert.equal(library.manifest.stages.length, 1);
  assert.equal(library.manifest.defaultStage, id);
  const loader = createStageLibraryLoader(async url => new Response(library.objects.get(url.split('/').at(-1).slice(0, -5))));
  assert.deepEqual(await loader.load(library.manifest.stages[0]), JSON.parse(JSON.stringify(expected.stage)));
  assert.equal(context.index.stages.some(entry => entry.id === id), false);
  assert.equal((await readdir(join(root, 'data'))).includes(`arkpedia-stage-${id}.json`), false);
});

test('normal stages also require original rule evidence before addition', async t => {
  const { context, id, root } = await fixture(t);
  await rm(join(root, 'data/stage-rules', `${id}.json`));
  const plan = await planStage(context, id);
  assert.equal(plan.status, 'blocked');
  assert.ok(plan.blockers.some(b => b.kind === 'stage-rules' && /original level rule receipt/.test(b.message)));
  await assert.rejects(applyStageAddition(context, plan), /blocked stage/);
});

test('failure before catalogue publication rolls back the new file and releases the lock', async t => {
  const { context, id, root } = await fixture(t), plan = await planStage(context, id);
  const before = await readFile(join(root, 'data/arkpedia-stages.json'), 'utf8');
  await assert.rejects(applyStageAddition(context, plan, { publish: async () => { throw Error('disk unavailable'); } }), /disk unavailable/);
  assert.equal(await readFile(join(root, 'data/arkpedia-stages.json'), 'utf8'), before);
  assert.deepEqual((await readdir(join(root, 'data'))).sort(), ['arkpedia-stages.json', 'stage-rules']);
});

test('changed sources and pre-existing unlisted files are never overwritten', async t => {
  const { context, id, source, root } = await fixture(t), plan = await planStage(context, id);
  const file = join(source, 'stage-devices.json');
  await writeFile(file, '{"changed":[]}');
  await assert.rejects(applyStageAddition(context, plan), /Source changed/);
  await writeFile(file, '{}');
  const target = join(root, 'data', `arkpedia-stage-${id}.json`);
  await writeFile(target, 'user work');
  await assert.rejects(applyStageAddition(context, plan), { code: 'EEXIST' });
  assert.equal(await readFile(target, 'utf8'), 'user work');
});

test('a publisher error after rename cannot remove the now-catalogued stage', async t => {
  const { context, id, root } = await fixture(t), plan = await planStage(context, id);
  await assert.rejects(applyStageAddition(context, plan, { publish: async (path, value) => {
    await writeJSONAtomic(path, value); throw Error('post-publication cleanup error');
  } }), /post-publication/);
  const index = await readJSON(join(root, 'data/arkpedia-stages.json'));
  const entry = index.stages.find(entry => entry.id === id);
  assert.ok(entry);
  assert.equal((await readJSON(join(root, 'data', entry.data))).code, 'TEST');
  assert.equal((await readdir(join(root, 'data'))).includes('.content-add.lock'), false);
});

test('preflight reports every independent blocker rather than hiding later dependencies', async t => {
  const { context, id, source } = await fixture(t);
  const path = join(source, 'stage-geometry', `${id}.json`), geometry = await readJSON(path);
  geometry.waves[0].spawns[0].enemy_id = 'enemy_missing';
  geometry.suppliedUnits = { deployable_tokens: [{ unit_id: 'trap_missing', count: 1 }] };
  geometry.hasConditionalSpawns = true;
  await writeFile(path, JSON.stringify(geometry));
  context.devices[id] = [{ kind: 'device', key: 'trap_missing', name: 'Unknown controller' }];
  const plan = await planStage(context, id);
  for (const kind of ['device', 'token', 'conditional', 'enemy-data']) assert.ok(plan.blockers.some(row => row.kind === kind), kind);
  assert.equal(plan.stage, undefined);
  await assert.rejects(applyStageAddition(context, plan), /blocked/);
});

test('stage compilation is non-mutating and refuses unsupported enemy override values', async t => {
  const { context, id, source } = await fixture(t);
  const stageSource = await readJSON(join(source, 'stages', `${id}.json`));
  const geometry = await readJSON(join(source, 'stage-geometry', `${id}.json`));
  const before = structuredClone(geometry);
  compileStage({ ...context, source: stageSource, geometry, devices: [] });
  assert.deepEqual(geometry, before);
  geometry.enemyConfigurations = [{ enemy_id: 'enemy_1007_slime', database_level: 0, overrides: { unknown_rule: 7 } }];
  assert.throws(() => compileStage({ ...context, source: stageSource, geometry, devices: [] }), /Unsupported enemy override/);
});

test('a challenge label cannot silently reuse the normal stage without its rules', async t => {
  const { context, id, source } = await fixture(t);
  const path = join(source, 'stages', `${id}.json`), stage = await readJSON(path);
  stage.variant = { kind: 'challenge_mode', shares_parent_level_file: true };
  await writeFile(path, JSON.stringify(stage));
  const plan = await planStage(context, id);
  assert.ok(plan.blockers.some(row => row.kind === 'stage-rules'));
  assert.equal(plan.stage, undefined);
  const geometry = await readJSON(join(source, 'stage-geometry', `${id}.json`));
  assert.throws(() => compileStage({ ...context, source: stage, geometry }), /Missing executable variant rules/);
});

test('a late wave cannot silently compile behind the legacy five-minute timeout', async t => {
  const { context, id, source } = await fixture(t);
  const path = join(source, 'stage-geometry', `${id}.json`), geometry = await readJSON(path);
  geometry.waves[0].spawns[0].time = 301;
  await writeFile(path, JSON.stringify(geometry));
  const plan = await planStage(context, id);
  assert.equal(plan.stage, undefined);
  assert.ok(plan.blockers.some(b => b.kind === 'compile' && /Missing original time limit/.test(b.message)));
});

test('a changed local rule receipt invalidates an already compiled addition', async t => {
  const { context, id, root, source } = await fixture(t);
  const path = join(source, 'stages', `${id}.json`), stage = await readJSON(path);
  stage.id = ruleReceipt.stageId;
  stage.variant = { kind: 'challenge_mode', of_stage_id: ruleReceipt.parentStageId };
  await writeFile(path, JSON.stringify(stage));
  await mkdir(join(root, 'data/stage-rules'), { recursive: true });
  const rulePath = join(root, 'data/stage-rules', `${id}.json`);
  const originalSource = (await readJSON(rulePath)).source;
  await writeFile(rulePath, JSON.stringify({ ...ruleReceipt, source: originalSource }));
  const plan = await planStage(context, id);
  assert.equal(plan.status, 'ready');
  assert.equal(plan.localSources.length, 2);
  await writeFile(rulePath, JSON.stringify({ ...ruleReceipt, changed: true }));
  await assert.rejects(applyStageAddition(context, plan), /Local rules changed/);
  assert.equal((await readdir(join(root, 'data'))).some(name => name === `arkpedia-stage-${id}.json`), false);
});

test('rule refresh preserves reviewed map/assets and visibility, validates digests, and is idempotent', async t => {
  const { context, id, root, source } = await fixture(t), plan = await planStage(context, id);
  await applyStageAddition(context, plan);
  const path = join(root, 'data', `arkpedia-stage-${id}.json`), old = await readJSON(path);
  old.art = { reviewed: 'retain-art' }; old.battle.initial_dp = 0;
  await writeFile(path, JSON.stringify(old));
  const index = await readFile(join(root, 'data/arkpedia-stages.json'), 'utf8');
  const before = await readFile(path, 'utf8');
  const preview = await refreshStageRules(context, plan);
  assert.deepEqual(preview.changed, ['battle']); assert.equal(preview.applied, false);
  assert.equal(await readFile(path, 'utf8'), before);
  const result = await refreshStageRules(context, plan, { apply: true });
  assert.equal(result.applied, true);
  const updated = await readJSON(path); assert.deepEqual(updated.art, old.art); assert.deepEqual(updated.geometry, old.geometry);
  assert.equal(updated.battle.initial_dp, plan.stage.battle.initial_dp);
  assert.equal(await readFile(join(root, 'data/arkpedia-stages.json'), 'utf8'), index);
  assert.equal((await refreshStageRules(context, plan, { apply: true })).applied, false);
  const sharedGeometry = structuredClone(plan); sharedGeometry.stage.geometry.slug = 'shared-parent-label';
  assert.equal((await refreshStageRules(context, sharedGeometry)).applied, false,
    'a shared geometry lookup label is not a map or wave change');
  const bad = structuredClone(plan); bad.stage.geometry.rows++;
  await assert.rejects(refreshStageRules(context, bad, { apply: true }), /Geometry changed/);
  plan.stage.battle.initial_dp++;
  await writeFile(join(source, 'stage-devices.json'), '{} ');
  const valid = await readFile(path, 'utf8');
  await assert.rejects(refreshStageRules(context, plan, { apply: true }), /Source changed/);
  assert.equal(await readFile(path, 'utf8'), valid);
});

test('explicit route refresh replaces waves/pathing atomically but still refuses map changes and mismatched paths', async t => {
  const { context, id, root, source } = await fixture(t), initial = await planStage(context, id);
  await applyStageAddition(context, initial);
  const path = join(root, 'data', `arkpedia-stage-${id}.json`), old = await readJSON(path);
  old.art = { reviewed: 'same-map-art' }; await writeFile(path, JSON.stringify(old));
  const geometryPath = join(source, 'stage-geometry', `${id}.json`), geometry = await readJSON(geometryPath);
  geometry.waves[0].spawns[0].time += 2;
  await writeFile(geometryPath, JSON.stringify(geometry));
  const plan = await planStage(context, id); assert.deepEqual(plan.blockers, []);
  await assert.rejects(refreshStageRules(context, plan), /Geometry changed/);
  const before = await readFile(path, 'utf8'), preview = await refreshStageRules(context, plan, { refreshRoutes: true });
  assert.ok(preview.changed.includes('geometry')); assert.ok(preview.changed.includes('pathing'));
  assert.equal(await readFile(path, 'utf8'), before);
  const bad = structuredClone(plan); bad.stage.pathing.geometryHash = '0'.repeat(64);
  await assert.rejects(refreshStageRules(context, bad, { apply: true, refreshRoutes: true }), /matching compiled/);
  const map = structuredClone(plan); map.stage.geometry.tileGrid[0][0]++;
  await assert.rejects(refreshStageRules(context, map, { apply: true, refreshRoutes: true }), /Geometry changed/);
  assert.equal(await readFile(path, 'utf8'), before);
  const result = await refreshStageRules(context, plan, { apply: true, refreshRoutes: true }); assert.equal(result.applied, true);
  const after = await readJSON(path); assert.deepEqual(after.art, old.art); assert.deepEqual(after.geometry, geometry);
  assert.equal(after.pathing.geometryHash, digest(JSON.stringify(geometry)));
  assert.equal(after.contentRuleRefresh.routeRefresh, true);
  assert.equal((await refreshStageRules(context, plan, { apply: true, refreshRoutes: true })).applied, false);
});

test('device refresh is explicit, previewable and preserves existing map artwork and visibility', async t => {
  const { context, id, root } = await fixture(t), plan = await planStage(context, id);
  await applyStageAddition(context, plan);
  const path = join(root, 'data', `arkpedia-stage-${id}.json`), old = await readJSON(path);
  old.art = { reviewed: 'preserved' }; await writeFile(path, JSON.stringify(old));
  plan.stage.devices = [{ key: 'trap_002_emp', name: 'Stun Generator', kind: 'device', hidden: false,
    row: 1, col: 1, instance: { level: 10, skillLevel: 1 } }];
  const before = await readFile(path, 'utf8');
  assert.equal((await refreshStageRules(context, plan)).changed.includes('devices'), false);
  assert.equal((await refreshStageRules(context, plan, { refreshDevices: true })).changed.includes('devices'), true);
  assert.equal(await readFile(path, 'utf8'), before);
  await refreshStageRules(context, plan, { apply: true, refreshDevices: true });
  const next = await readJSON(path); assert.deepEqual(next.devices, plan.stage.devices);
  assert.deepEqual(next.art, old.art); assert.deepEqual(next.geometry, old.geometry);
  assert.equal(next.contentRuleRefresh.deviceRefresh, true);
  assert.equal((await readJSON(join(root, 'data/arkpedia-stages.json'))).stages.find(s => s.id === id).testOnly, true);
});

test('supply-count refresh is explicit and atomic, updates the geometry hash, and rejects tile or instance changes', async t => {
  const { context, id, root } = await fixture(t), initial = await planStage(context, id);
  const card = { unit_id: 'trap_001_crate', count: 5, level: 1, elite: 0, potential: 0, skill_index: 0, skill_level: 1 };
  initial.stage.geometry.suppliedUnits = { fixed_squad: [], deployable_tokens: [card] };
  initial.stage.tokens = [{ unitId: card.unit_id, name: 'Roadblock', behavior: 'roadblock', obstacle: 'crate', count: 5, hp: 100, block: 3, cost: 5 }];
  initial.stage.pathing.geometryHash = digest(JSON.stringify(initial.stage.geometry));
  await applyStageAddition(context, initial);
  const path = join(root, 'data', `arkpedia-stage-${id}.json`), before = await readFile(path, 'utf8');
  const plan = structuredClone(initial); plan.stage.geometry.suppliedUnits.deployable_tokens[0].count = 1; plan.stage.tokens[0].count = 1;
  await assert.rejects(refreshStageRules(context, plan), /Geometry changed/);
  const preview = await refreshStageRules(context, plan, { refreshSupplies: true });
  assert.ok(preview.changed.includes('tokens')); assert.ok(preview.changed.includes('geometry'));
  assert.equal(await readFile(path, 'utf8'), before);
  for (const edit of [s => s.geometry.tileGrid[0][0]++, s => s.geometry.suppliedUnits.deployable_tokens[0].level++]) {
    const bad = structuredClone(plan); edit(bad.stage);
    await assert.rejects(refreshStageRules(context, bad, { refreshSupplies: true, apply: true }), /Geometry changed/);
  }
  await refreshStageRules(context, plan, { refreshSupplies: true, apply: true });
  const after = await readJSON(path);
  assert.equal(after.tokens[0].count, 1); assert.equal(after.geometry.suppliedUnits.deployable_tokens[0].count, 1);
  assert.equal(after.pathing.geometryHash, digest(JSON.stringify(after.geometry)));
  assert.equal(after.contentRuleRefresh.supplyRefresh, true);
  assert.equal((await refreshStageRules(context, plan, { refreshSupplies: true, apply: true })).applied, false);
});
