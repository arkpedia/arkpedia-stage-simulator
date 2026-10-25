// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import stage from '../data/arkpedia-stage-17-3.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import source from '../data/candidates/arkpedia-stage-17-3-source.json' with { type: 'json' };
import review from '../data/candidates/arkpedia-ch17-reviewed-stage-17-3.json' with { type: 'json' };
import { resolveStage, applyStage } from '../shared/arkpedia/stages.js';
import { assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const data = () => ({ ...structuredClone(mvp), stage: structuredClone(stage), enemies: structuredClone(stage.enemies) });
const build = seed => new StandardBattle(data(), { operators: [defaultBuild(mvp.operators.char_122_beagle)] }, { seed });
const run = b => { for (let i = 0; i < Math.round(b.timeLimit / b.dt) && !b.finished; i++) b.step(); };

test('17-3 is explicitly test-only with independently pinned canonical level/enemy snapshots and native marker', async () => {
  assert.equal(index.stages.filter(e => !e.testOnly).length, 597);
  assert.throws(() => resolveStage(index, '17-3'), /test-only/);
  const d = structuredClone(mvp);
  await applyStage(d, index, '17-3', async () => ({ ok: true, json: async () => structuredClone(stage) }), { experimental: true });
  assert.doesNotThrow(() => assertRegularEnemies(d));
  for (const change of [s => { s.testOnly = false; }, s => { delete s.enemyCatalogue; }, s => { s.code = '16-9'; }]) {
    const bad = data(); change(bad.stage); assert.throws(() => assertRegularEnemies(bad), /Unsupported/);
  }
  assert.equal(stage.canonicalData.repository, 'arkpedia/arkpedia-data');
  assert.equal(stage.canonicalData.commit, '79e81a8a872b2ecc592647d81a864ccbf1f8ca06');
  assert.equal(stage.chapter16Source.canonicalData.commit, '245d7c601ce3a4a42adcfb84faa1bd1123d507bb');
  assert.equal(stage.pathing.moveScale, .5); assert.equal(stageAdapter(stage).spawns.length, 24);
  assert.deepEqual(Object.keys(stage.enemies).sort(), review.expected.enemies.slice().sort());
  assert.deepEqual(stage.devices.map(({ key, row, col }) => ({ key, row, col })), review.expected.devices);
  const b = build(19), marker = b.chapter16.rifts[0];
  assert.equal(marker.sp, 0); assert.equal(marker.spCost, 55); assert.equal(marker.spRecovery, 1);
  assert.equal(b.grid.tile(2, 3).build, 'NONE'); assert.equal(b.grid.tile(2, 3).pass, 'FLY');
});

test('17-3 builder binds source bytes, marker/skill graph, inventories and reaction review', () => {
  for (const file of Object.values(review.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file.path, import.meta.url))).digest('hex'), file.sha256);
  const dir = mkdtempSync(join(tmpdir(), 'ch17-3-build-'));
  const input = join(dir, 'stage.json'), geometry = join(dir, 'geometry.json'), out = join(dir, 'out.json');
  writeFileSync(input, JSON.stringify({ ...source.stage, name: 'Changed source' }));
  writeFileSync(geometry, JSON.stringify(source.geometry));
  assert.throws(() => execFileSync(process.execPath, ['tools/arkpedia/build-stage.mjs', '--candidate', 'ch16', '--stage', input,
    '--geometry', geometry, '--out', out], { stdio: 'pipe' }), e => /does not match its reviewed canonical source/.test(String(e.stderr)));
  assert.equal(existsSync(out), false);
});

for (const seed of [19, 71, 129]) test(`17-3 source routes finish with real caster channels and harmless marker summons (seed ${seed})`, () => {
  const b = build(seed); b.life = 1000;
  // Route-only stress run: the simulator's general 300-second guard is shorter
  // than this stage without a deployed squad. Do not claim a default-cap clear.
  b.timeLimit = 600;
  const born = []; let channeled = 0, firstSpawn = null;
  const marker = b.chapter16.rifts[0], gain = marker.gainSp;
  marker.gainSp = function(n, caster) { if (caster?.defId === 'enemy_10203_mumag') channeled += n; gain.call(this, n); };
  b.on('enemySpawn', ({ enemy }) => { born.push(enemy); if (enemy.mem.ch16Leak && firstSpawn == null) firstSpawn = b.time; });
  run(b);
  assert.deepEqual(b.errors, []); assert.equal(b.result().reason, 'cleared');
  assert.ok(b.time > 300 && b.time < 600); assert.equal(b.total, 24);
  const normal = born.filter(e => e.defId !== 'enemy_10211_murad'), summons = born.filter(e => e.defId === 'enemy_10211_murad');
  assert.equal(normal.length, 24);
  assert.equal(normal.filter(e => e.defId === 'enemy_10203_mumag').length, 5);
  assert.equal(normal.filter(e => e.defId === 'enemy_10201_muinf').length, 17);
  assert.equal(normal.filter(e => e.defId === 'enemy_10202_mubow').length, 2);
  assert.ok(channeled > 0); assert.ok(firstSpawn < 55, 'actual casters accelerate the marker');
  assert.ok(summons.length > 6); assert.equal(marker.cycle, summons.length);
  assert.ok(summons.every(e => !e.counted && e.holdsBattle === false && e.mem.ch16Leak));
  assert.ok(summons.some(e => e.alive), 'harmless sources cannot hold stage clear');
});

test('17-3 honestly retains the default timeout without operators while channels and routes advance', () => {
  const b = build(19); b.life = 1000; run(b);
  assert.equal(b.result().reason, 'timeout'); assert.equal(b.time, 300); assert.deepEqual(b.errors, []);
  assert.ok(b.chapter16.rifts[0].cycle > 5);
});

test('17-3 ordinary enemies attack a legally deployed guard without breaking marker channels', () => {
  const b = build(19); b.life = 1000; b.timeLimit = 600; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  assert.equal(b.placementError('char_122_beagle', 3, 4), null);
  const guard = b.deployOperator('char_122_beagle', 3, 4, 'LEFT'), attackers = new Set();
  b.on('attack', c => { if (c.targets.includes(guard)) attackers.add(c.attacker.defId); });
  run(b);
  assert.ok(attackers.size > 0); assert.ok(b.chapter16.rifts[0].cycle > 0);
  assert.deepEqual(b.errors, []); assert.equal(b.result().reason, 'cleared');
});
