// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import stage from '../data/arkpedia-stage-17-2.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import source from '../data/candidates/arkpedia-stage-17-2-source.json' with { type: 'json' };
import review from '../data/candidates/arkpedia-ch17-reviewed-stage-17-2.json' with { type: 'json' };
import { resolveStage, applyStage } from '../shared/arkpedia/stages.js';
import { assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const data = () => ({ ...structuredClone(mvp), stage: structuredClone(stage), enemies: structuredClone(stage.enemies) });
const build = seed => new StandardBattle(data(), { operators: [defaultBuild(mvp.operators.char_122_beagle)] }, { seed });

test('17-2 requires experimental mode and retains the exact canonical level/enemy snapshots', async () => {
  assert.equal(index.stages.filter(e => !e.testOnly).length, 597);
  assert.throws(() => resolveStage(index, '17-2'), /test-only/);
  const d = structuredClone(mvp);
  await applyStage(d, index, '17-2', async () => ({ ok: true, json: async () => structuredClone(stage) }), { experimental: true });
  assert.doesNotThrow(() => assertRegularEnemies(d));
  for (const change of [s => { s.testOnly = false; }, s => { delete s.enemyCatalogue; }, s => { s.code = '17-3'; }]) {
    const bad = data(); change(bad.stage); assert.throws(() => assertRegularEnemies(bad), /Unsupported/);
  }
  assert.equal(stage.canonicalData.repository, 'arkpedia/arkpedia-data');
  assert.equal(stage.canonicalData.commit, '79e81a8a872b2ecc592647d81a864ccbf1f8ca06');
  assert.equal(stage.chapter16Source.canonicalData.commit, '657f85cc032ae5da807135f536d3263c6b249ed7');
  assert.equal(stage.pathing.moveScale, .5); assert.equal(stageAdapter(stage).spawns.length, 28);
  assert.deepEqual(Object.keys(stage.enemies).sort(), review.expected.enemies.slice().sort());
  assert.deepEqual(stage.devices, []); assert.deepEqual(stage.excludedHiddenGroups, []);
});

test('17-2 builder binds original inputs, reaction review and native environment evidence', () => {
  for (const file of Object.values(review.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file.path, import.meta.url))).digest('hex'), file.sha256);
  const dir = mkdtempSync(join(tmpdir(), 'ch17-2-build-'));
  const input = join(dir, 'stage.json'), geometry = join(dir, 'geometry.json'), out = join(dir, 'out.json');
  writeFileSync(input, JSON.stringify({ ...source.stage, name: 'Changed source' }));
  writeFileSync(geometry, JSON.stringify(source.geometry));
  assert.throws(() => execFileSync(process.execPath, ['tools/arkpedia/build-stage.mjs', '--candidate', 'ch16', '--stage', input,
    '--geometry', geometry, '--out', out], { stdio: 'pipe' }), e => /does not match its reviewed canonical source/.test(String(e.stderr)));
  assert.equal(existsSync(out), false);
});

for (const seed of [19, 71, 129]) test(`normal 17-2 has exactly 28 source hostiles and finishes without runtime errors (seed ${seed})`, () => {
  const b = build(seed); b.life = 1000;
  const born = [], installed = [];
  b.on('enemySpawn', ({ enemy }) => { born.push(enemy); installed.push(typeof enemy.mem.ch17PollutionReaction === 'function'); });
  for (let i = 0; i < Math.round(300 / b.dt) && !b.finished; i++) b.step();
  assert.deepEqual(b.errors, []); assert.equal(b.result().reason, 'cleared');
  assert.equal(born.length, 28); assert.equal(b.total, 28);
  assert.equal(born.filter(e => e.defId === 'enemy_10201_muinf').length, 21);
  assert.equal(born.filter(e => e.defId === 'enemy_10202_mubow').length, 7);
  assert.ok(installed.every(Boolean));
});

test('both real stage enemy families attack a legally deployed guard through ordinary combat', () => {
  const b = build(19); b.life = 1000; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  assert.equal(b.placementError('char_122_beagle', 3, 4), null);
  const guard = b.deployOperator('char_122_beagle', 3, 4, 'RIGHT'), attacks = new Set();
  b.on('attack', c => { if (c.targets.includes(guard)) attacks.add(c.attacker.defId); });
  for (let i = 0; i < Math.round(300 / b.dt) && !b.finished; i++) b.step();
  assert.ok(attacks.has('enemy_10201_muinf')); assert.ok(attacks.has('enemy_10202_mubow'));
  assert.deepEqual(b.errors, []); assert.equal(b.result().reason, 'cleared');
});
