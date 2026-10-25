// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import stage from '../data/arkpedia-stage-16-7.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import source from '../data/candidates/arkpedia-stage-16-7-source.json' with { type: 'json' };
import review from '../data/candidates/arkpedia-ch16-reviewed-stage-16-7.json' with { type: 'json' };
import { resolveStage, applyStage } from '../shared/arkpedia/stages.js';
import { assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const data = () => ({ ...structuredClone(mvp), stage: structuredClone(stage), enemies: structuredClone(stage.enemies) });
test('16-7 requires experimental mode, exact canonical data, the native Commander wait and original hostile counter', async () => {
  assert.equal(index.stages.filter(e => !e.testOnly).length, 597);
  assert.throws(() => resolveStage(index, '16-7'), /test-only/);
  assert.equal(resolveStage(index, '16-7', { experimental: true }).testOnly, true);
  const d = structuredClone(mvp);
  await applyStage(d, index, '16-7', async () => ({ ok: true, json: async () => structuredClone(stage) }), { experimental: true });
  assert.doesNotThrow(() => assertRegularEnemies(d));
  for (const change of [s => { s.testOnly = false; }, s => { delete s.enemyCatalogue; }, s => { s.code = '16-9'; }]) {
    const bad = data(); change(bad.stage); assert.throws(() => assertRegularEnemies(bad), /Unsupported/);
  }
  assert.equal(stage.canonicalData.repository, 'arkpedia/arkpedia-data');
  assert.equal(stage.canonicalData.commit, '79e81a8a872b2ecc592647d81a864ccbf1f8ca06');
  assert.equal(stage.chapter16Source.canonicalData.commit, '245d7c601ce3a4a42adcfb84faa1bd1123d507bb');
  assert.equal(stage.pathing.moveScale, .5);
  const spawns = stageAdapter(stage).spawns;
  assert.equal(spawns.length, 36); assert.equal(spawns.filter(s => s.enemyKey === 'enemy_3010_mcreep').length, 10);
  assert.deepEqual(Object.keys(stage.enemies).sort(), review.expected.enemies.slice().sort());
  assert.deepEqual(stage.excludedHiddenGroups, ['raid6A', 'raid6B']);
  const enables = Object.values(source.rawLevel.optionalRunes).flat().filter(r => r.key === 'level_hidden_group_enable');
  assert.ok(enables.every(r => r.difficultyMask === 'SIX_STAR'));
  assert.deepEqual(enables.map(r => r.blackboard.find(bb => bb.key === 'key').valueStr).sort(), ['raid6A', 'raid6B']);
  assert.equal(source.conditional.filter(s => ['raid6A', 'raid6B'].includes(s.condition?.hidden_group)).length, 4);
});
test('16-7 review binds complete source and controller contracts; altered source cannot build', () => {
  for (const file of Object.values(review.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file.path, import.meta.url))).digest('hex'), file.sha256);
  const dir = mkdtempSync(join(tmpdir(), 'ch16-7-build-')), input = join(dir, 'stage.json'), geometry = join(dir, 'geometry.json'), out = join(dir, 'out.json');
  writeFileSync(input, JSON.stringify({ ...source.stage, name: 'Changed source' })); writeFileSync(geometry, JSON.stringify(source.geometry));
  assert.throws(() => execFileSync(process.execPath, ['tools/arkpedia/build-stage.mjs', '--candidate', 'ch16', '--stage', input,
    '--geometry', geometry, '--out', out], { stdio: 'pipe' }), e => /does not match its reviewed canonical source/.test(String(e.stderr)));
  assert.equal(existsSync(out), false);
});
for (const seed of [19, 71, 129]) test(`16-7 source waves, live volleys and native miner branch clear within the default cap (seed ${seed})`, () => {
  const b = new StandardBattle(data(), { operators: [defaultBuild(mvp.operators.char_122_beagle)] }, { seed });
  b.life = 1000; b.setViewport('fullscreen-workspace');
  const born = [], launches = []; b.on('enemySpawn', ({ enemy }) => born.push(enemy)); b.on('ch16FortbreakerLaunch', c => launches.push(c));
  for (let i = 0; i < Math.round(300 / b.dt) && !b.finished; i++) {
    for (const [id, entry] of b.stageDeviceActions) if (entry.state.canActivate()) b.activateStageDevice(id);
    b.step();
  }
  assert.deepEqual(b.errors, []); assert.equal(b.result().reason, 'cleared'); assert.equal(b.total, 26);
  assert.equal(born.filter(e => e.defId === 'enemy_10120_uaghst').length, 17);
  assert.equal(born.filter(e => e.defId === 'enemy_10125_uacomd').length, 1);
  assert.equal(born.filter(e => e.defId === 'enemy_10123_uareap').length, 1);
  assert.ok(launches.length >= 3); assert.ok(launches.every(c => c.target.mem.ch16Miner)); assert.ok(launches.some(c => c.count === 6));
  assert.ok(launches.some(c => c.count === 3), 'later volleys lose orders after Commander leaves');
  const miners = born.filter(e => e.mem.ch16Miner), scheduled = miners.filter(e => !e.mem.ch16Branch), branch = miners.filter(e => e.mem.ch16Branch);
  assert.equal(scheduled.length, 10); assert.ok(scheduled.every(e => !e.counted && e.holdsBattle === false));
  assert.ok(branch.length > 0);
  for (const e of branch) {
    assert.equal(e.counted, false); assert.equal(e.holdsBattle, false);
    assert.equal(e.mem.ch16Branch.action, 0); assert.equal(e.mem.ch16Branch.route, 0);
    assert.equal(e.route.visitEveryCheckPoint, false);
    assert.ok(Math.abs(e.spawnY - 5) <= .3 && Math.abs(e.spawnX - 1) <= .3);
  }
});

test('16-7 preserves the native 75-second Commander wait and supplies orders during the delayed Fortbreaker arrival', () => {
  const b = new StandardBattle(data(), { operators: [defaultBuild(mvp.operators.char_122_beagle)] }, { seed: 19 }); b.life = 1000;
  let leader; b.on('enemySpawn', ({ enemy }) => { if (enemy.defId === 'enemy_10125_uacomd') leader = enemy; });
  const adapter = stageAdapter(stage), spawn = adapter.spawns.find(s => s.enemyKey === 'enemy_10125_uacomd');
  assert.equal(spawn.time, 103); assert.ok(adapter.routes[spawn.routeIndex].checkpoints.some(c => c.type === 'WAIT' && c.time === 75));
  for (let i = 0; i < Math.round(170 / b.dt); i++) b.step();
  assert.ok(leader?.alive && leader.deployed); assert.ok(leader.route.waitLeft > 10);
  assert.equal(leader.mem.ab.list.filter(a => a.disposeOrders).length, 1);
  const fort = b.enemies.find(e => e.defId === 'enemy_10123_uareap');
  assert.ok(fort?.findBuff('enemy_uacomd_extra_power')); assert.deepEqual(b.errors, []);
});
