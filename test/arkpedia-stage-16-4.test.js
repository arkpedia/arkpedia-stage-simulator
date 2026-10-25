// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import stage from '../data/arkpedia-stage-16-4.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import source from '../data/candidates/arkpedia-stage-16-4-source.json' with { type: 'json' };
import review from '../data/candidates/arkpedia-ch16-reviewed-stage-16-4.json' with { type: 'json' };
import { resolveStage, applyStage } from '../shared/arkpedia/stages.js';
import { assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const data = () => ({ ...structuredClone(mvp), stage: structuredClone(stage), enemies: structuredClone(stage.enemies) });

test('16-4 requires experimental mode and explicitly test-only canonical candidate data', async () => {
  assert.equal(index.stages.filter(e => !e.testOnly).length, 597);
  assert.throws(() => resolveStage(index, '16-4'), /test-only/);
  assert.equal(resolveStage(index, '16-4', { experimental: true }).testOnly, true);
  const d = structuredClone(mvp);
  await applyStage(d, index, '16-4', async () => ({ ok: true, json: async () => structuredClone(stage) }), { experimental: true });
  assert.doesNotThrow(() => assertRegularEnemies(d));
  for (const change of [s => { s.testOnly = false; }, s => { delete s.enemyCatalogue; }, s => { s.code = '16-6'; }]) {
    const bad = data(); change(bad.stage); assert.throws(() => assertRegularEnemies(bad), /Unsupported/);
  }
  const missing = data(); delete missing.enemies.enemy_3010_mcreep;
  assert.throws(() => assertRegularEnemies(missing), /Missing canonical Miner/);
  assert.equal(stage.canonicalData.repository, 'arkpedia/arkpedia-data');
  assert.equal(stage.canonicalData.commit, '79e81a8a872b2ecc592647d81a864ccbf1f8ca06');
  assert.equal(stage.chapter16Source.canonicalData.commit, '57ab0fc5df7ae27b04a0c84515301f1feb6cf7f2');
  assert.equal(stage.pathing.moveScale, .5);
  assert.equal(stageAdapter(stage).spawns.length, 17);
  assert.deepEqual(Object.keys(stage.enemies).sort(), review.expected.enemies.slice().sort());
  assert.equal(stage.chapter16Source.rawLevel.extraRoutes[0].visitEveryCheckPoint, false);
  assert.deepEqual(stage.excludedHiddenGroups, []);
});

test('16-4 builder review binds the complete source, native devices, skill and experimental crossbow contract', () => {
  for (const file of Object.values(review.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file.path, import.meta.url))).digest('hex'), file.sha256);
  const dir = mkdtempSync(join(tmpdir(), 'ch16-4-build-'));
  const input = join(dir, 'stage.json'), geometry = join(dir, 'geometry.json'), out = join(dir, 'out.json');
  writeFileSync(input, JSON.stringify({ ...source.stage, name: 'Changed source' }));
  writeFileSync(geometry, JSON.stringify(source.geometry));
  assert.throws(() => execFileSync(process.execPath, ['tools/arkpedia/build-stage.mjs', '--candidate', 'ch16', '--stage', input,
    '--geometry', geometry, '--out', out], { stdio: 'pipe' }), e => /does not match its reviewed canonical source/.test(String(e.stderr)));
  assert.equal(existsSync(out), false);
});

for (const seed of [19, 71, 129]) test(`normal 16-4 waves, tunnel and crossbow features finish without runtime errors (seed ${seed})`, () => {
  const b = new StandardBattle(data(), { operators: [defaultBuild(Object.values(mvp.operators)[0])] }, { seed });
  b.life = 1000; b.setViewport('fullscreen-workspace');
  const born = [], shots = [];
  b.on('enemySpawn', ({ enemy }) => born.push(enemy));
  b.on('attack', c => { if (c.attacker.defId === 'enemy_10121_uasnip') shots.push(c); });
  for (let i = 0; i < Math.round(300 / b.dt) && !b.finished; i++) {
    for (const [id, entry] of b.stageDeviceActions) if (entry.state.canActivate()) b.activateStageDevice(id);
    b.step();
    for (const entry of b.stageDeviceActions.values()) { assert.ok(entry.state.total <= 5); assert.ok(entry.state.waiting <= 3); }
  }
  assert.deepEqual(b.errors, []); assert.equal(b.result().reason, 'cleared');
  assert.equal(born.filter(e => !e.mem.ch16TunnelHost).length, 17);
  assert.ok(born.some(e => e.mem.ch16TunnelHost));
  assert.ok(shots.length > 0, 'feature dispatch attaches a working crossbow controller in the real stage');
  assert.ok(shots.some(c => c.targets.some(u => u.mem.ch16Miner)));
  assert.equal(b.total, 17);
});
