// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import stage from '../data/arkpedia-stage-16-3.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import source from '../data/candidates/arkpedia-stage-16-3-source.json' with { type: 'json' };
import review from '../data/candidates/arkpedia-ch16-reviewed-stage.json' with { type: 'json' };
import { resolveStage, applyStage } from '../shared/arkpedia/stages.js';
import { assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const data = () => ({ ...structuredClone(mvp), stage: structuredClone(stage), enemies: structuredClone(stage.enemies) });

test('16-3 is test-only, uses distinct verified stage/enemy snapshots, and ships its branch dependency', async () => {
  assert.equal(index.stages.filter(e => !e.testOnly).length, 597);
  assert.throws(() => resolveStage(index, '16-3'), /test-only/);
  assert.equal(resolveStage(index, '16-3', { experimental: true }).testOnly, true);
  const d = structuredClone(mvp);
  await applyStage(d, index, '16-3', async () => ({ ok: true, json: async () => structuredClone(stage) }), { experimental: true });
  assert.doesNotThrow(() => assertRegularEnemies(d));
  assert.throws(() => assertRegularEnemies({ ...d, stage: { ...d.stage, testOnly: false } }), /Unsupported/);
  const missing = data(); delete missing.enemies.enemy_3010_mcreep;
  assert.throws(() => assertRegularEnemies(missing), /Missing canonical Miner/);
  assert.equal(stage.canonicalData.commit, '79e81a8a872b2ecc592647d81a864ccbf1f8ca06');
  assert.equal(stage.chapter16Source.canonicalData.commit, '245d7c601ce3a4a42adcfb84faa1bd1123d507bb');
  assert.equal(stage.pathing.moveScale, .5);
  assert.equal(stageAdapter(stage).spawns.length, 22);
  assert.deepEqual(Object.keys(stage.enemies).sort(), review.expected.enemies.slice().sort());
  assert.deepEqual(stage.excludedHiddenGroups, ['raid']);
});

test('16-3 controller review binds all retained inputs and refuses noncanonical builder arguments', () => {
  for (const file of Object.values(review.sources)) {
    const bytes = readFileSync(new URL('../' + file.path, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
  const dir = mkdtempSync(join(tmpdir(), 'ch16-build-'));
  const input = join(dir, 'stage.json'), geometry = join(dir, 'geometry.json'), out = join(dir, 'out.json');
  writeFileSync(input, JSON.stringify({ ...source.stage, name: 'Unreviewed level' }));
  writeFileSync(geometry, JSON.stringify(source.geometry));
  assert.throws(() => execFileSync(process.execPath, ['tools/arkpedia/build-stage.mjs', '--candidate', 'ch16', '--stage', input,
    '--geometry', geometry, '--out', out], { stdio: 'pipe' }), e => /does not match its reviewed canonical source/.test(String(e.stderr)));
  assert.equal(existsSync(out), false);
});

test('the built normal stage runs its native waves and manual tunnel without errors or optional raid spawns', () => {
  const d = data(), b = new StandardBattle(d, { operators: [defaultBuild(Object.values(mvp.operators)[0])] }, { seed: 19 });
  b.life = 1000; b.setViewport('fullscreen-workspace');
  const born = [];
  b.on('enemySpawn', ({ enemy }) => born.push(enemy));
  for (let i = 0; i < Math.round(280 / b.dt) && !b.finished; i++) {
    for (const [id, entry] of b.stageDeviceActions) if (entry.state.canActivate()) b.activateStageDevice(id);
    b.step();
    for (const entry of b.stageDeviceActions.values()) {
      assert.ok(entry.state.total <= 5); assert.ok(entry.state.waiting <= 3);
    }
  }
  assert.deepEqual(b.errors, []);
  assert.equal(b.result().reason, 'cleared');
  assert.equal(born.filter(e => !e.mem.ch16TunnelHost).length, 22);
  assert.ok(born.some(e => e.mem.ch16TunnelHost));
  assert.equal(b.total, 22);
});
