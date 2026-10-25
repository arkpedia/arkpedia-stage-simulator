// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import stage from '../data/arkpedia-stage-16-5.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import source from '../data/candidates/arkpedia-stage-16-5-source.json' with { type: 'json' };
import review from '../data/candidates/arkpedia-ch16-reviewed-stage-16-5.json' with { type: 'json' };
import { resolveStage, applyStage } from '../shared/arkpedia/stages.js';
import { assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const data = () => ({ ...structuredClone(mvp), stage: structuredClone(stage), enemies: structuredClone(stage.enemies) });

test('16-5 requires experimental mode and explicitly test-only canonical candidate data', async () => {
  assert.equal(index.stages.filter(e => !e.testOnly).length, 597);
  assert.throws(() => resolveStage(index, '16-5'), /test-only/);
  assert.equal(resolveStage(index, '16-5', { experimental: true }).testOnly, true);
  const d = structuredClone(mvp);
  await applyStage(d, index, '16-5', async () => ({ ok: true, json: async () => structuredClone(stage) }), { experimental: true });
  assert.doesNotThrow(() => assertRegularEnemies(d));
  for (const change of [s => { s.testOnly = false; }, s => { delete s.enemyCatalogue; }, s => { s.code = '16-7'; }]) {
    const bad = data(); change(bad.stage); assert.throws(() => assertRegularEnemies(bad), /Unsupported/);
  }
  const missing = data(); delete missing.enemies.enemy_3010_mcreep;
  assert.throws(() => assertRegularEnemies(missing), /Missing canonical Miner/);
  assert.equal(stage.canonicalData.repository, 'arkpedia/arkpedia-data');
  assert.equal(stage.canonicalData.commit, '79e81a8a872b2ecc592647d81a864ccbf1f8ca06');
  assert.equal(stage.chapter16Source.canonicalData.commit, '657f85cc032ae5da807135f536d3263c6b249ed7');
  assert.equal(stage.pathing.moveScale, .5);
  assert.equal(stageAdapter(stage).spawns.length, 26);
  assert.deepEqual(Object.keys(stage.enemies).sort(), review.expected.enemies.slice().sort());
  assert.equal(stage.chapter16Source.rawLevel.extraRoutes[0].visitEveryCheckPoint, false);
  assert.deepEqual(stage.excludedHiddenGroups, []);
});

test('16-5 builder review binds the complete source, native devices, skill and Shieldguard, artillery and native Patrol Captain contracts', () => {
  for (const file of Object.values(review.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file.path, import.meta.url))).digest('hex'), file.sha256);
  const dir = mkdtempSync(join(tmpdir(), 'ch16-5-build-'));
  const input = join(dir, 'stage.json'), geometry = join(dir, 'geometry.json'), out = join(dir, 'out.json');
  writeFileSync(input, JSON.stringify({ ...source.stage, name: 'Changed source' }));
  writeFileSync(geometry, JSON.stringify(source.geometry));
  assert.throws(() => execFileSync(process.execPath, ['tools/arkpedia/build-stage.mjs', '--candidate', 'ch16', '--stage', input,
    '--geometry', geometry, '--out', out], { stdio: 'pipe' }), e => /does not match its reviewed canonical source/.test(String(e.stderr)));
  assert.equal(existsSync(out), false);
});

const build = (seed = 19, d = data()) => new StandardBattle(d, { operators: [defaultBuild(mvp.operators.char_122_beagle)] }, { seed });
for (const seed of [19, 71, 129]) test(`16-5 source waves and both native tunnel actions clear without errors (seed ${seed})`, () => {
  const b = build(seed); b.life = 1000; b.setViewport('fullscreen-workspace');
  const born = [], attacks = new Set();
  b.on('enemySpawn', ({ enemy }) => born.push(enemy));
  b.on('attack', c => { if (c.targets.some(t => t.mem.ch16Miner)) attacks.add(c.attacker.defId); });
  for (let i = 0; i < Math.round(300 / b.dt) && !b.finished; i++) {
    for (const [id, entry] of b.stageDeviceActions) if (entry.state.canActivate()) b.activateStageDevice(id);
    b.step();
    for (const entry of b.stageDeviceActions.values()) { assert.ok(entry.state.total <= 5); assert.ok(entry.state.waiting <= 3); }
  }
  assert.deepEqual(b.errors, []); assert.equal(b.result().reason, 'cleared'); assert.equal(b.total, 26);
  const miners = born.filter(e => e.mem.ch16Miner), normal = born.filter(e => !e.mem.ch16Miner);
  assert.equal(normal.length, 26);
  assert.equal(normal.filter(e => e.defId === 'enemy_1107_uoffcr').length, 23);
  assert.equal(normal.filter(e => e.defId === 'enemy_10124_uashld').length, 1);
  assert.equal(normal.filter(e => e.defId === 'enemy_10122_uacann').length, 2);
  assert.ok(miners.length > 0); assert.deepEqual([...new Set(miners.map(e => e.mem.ch16Branch.action))].sort(), [0, 1]);
  assert.ok(attacks.has('enemy_1107_uoffcr')); assert.ok(attacks.has('enemy_10122_uacann'));
  for (const child of miners) {
    const action = child.mem.ch16Branch.action, host = child.mem.ch16TunnelHost.unit;
    assert.equal(child.mem.ch16Branch.route, action);
    assert.equal(host.tileR, action === 0 ? 6 : 2); assert.equal(host.tileC, action === 0 ? 3 : 1);
    const start = source.rawLevel.extraRoutes[action].startPosition;
    assert.ok(Math.abs(child.spawnY - start.row) <= .4 && Math.abs(child.spawnX - start.col) <= .4);
    assert.equal(child.counted, false); assert.equal(child.holdsBattle, false);
  }
});

test('16-5 tunnel commands release only their own queue while preserving the other action/SP bar', () => {
  const b = build(); b.life = 1000; b.setViewport('fullscreen-workspace');
  const born = []; b.on('enemySpawn', ({ enemy }) => born.push(enemy));
  for (let i = 0; i < Math.round(15.1 / b.dt); i++) b.step();
  const entries = [...b.stageDeviceActions]; assert.equal(entries.length, 2);
  const [first, second] = entries;
  assert.equal(first[1].name, 'Lower Hidden Tunnel'); assert.equal(second[1].name, 'Upper Hidden Tunnel');
  assert.equal(first[1].state.waiting, 1); assert.equal(second[1].state.waiting, 1);
  assert.equal(b.activateStageDevice(first[0]), true);
  assert.equal(first[1].state.waiting, 0); assert.equal(second[1].state.waiting, 1);
  assert.equal(first[1].state.sp, 0); assert.equal(second[1].state.sp, 15);
  const released = born.find(e => e.mem.ch16TunnelHost?.unit === first[1].owner);
  const waiting = born.find(e => e.mem.ch16TunnelHost?.unit === second[1].owner);
  assert.equal(released.mem.ch16Branch.action, 0); assert.equal(waiting.mem.ch16Branch.action, 1);
  assert.ok(!released.findBuff('spawnp_t[stop_move]')); assert.ok(waiting.findBuff('spawnp_t[stop_move]'));
  assert.deepEqual(b.errors, []);
});

test('an unknown native tunnel action or blackboard key fails before a battle is accepted', () => {
  for (const override of [[{ key: 'talent@action_index', value: 99, valueStr: null }], [{ key: 'unreviewed', value: 1, valueStr: null }]]) {
    const d = data();
    d.stage.chapter16Source.rawLevel.predefines.tokenInsts.find(t => t.inst.characterKey === 'trap_270_spawnp').overrideSkillBlackboard = override;
    assert.throws(() => build(19, d), /Unreviewed Hidden Tunnel/);
  }
});
