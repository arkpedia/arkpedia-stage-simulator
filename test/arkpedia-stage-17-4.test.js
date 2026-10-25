// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import stage from '../data/arkpedia-stage-17-4.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import source from '../data/candidates/arkpedia-stage-17-4-source.json' with { type: 'json' };
import review from '../data/candidates/arkpedia-ch17-reviewed-stage-17-4.json' with { type: 'json' };
import { resolveStage, applyStage } from '../shared/arkpedia/stages.js';
import { assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const data = () => ({ ...structuredClone(mvp), stage: structuredClone(stage), enemies: structuredClone(stage.enemies) });
const build = seed => new StandardBattle(data(), { operators: [defaultBuild(mvp.operators.char_122_beagle)] }, { seed });
const run = b => { for (let i = 0; i < Math.round(b.timeLimit / b.dt) && !b.finished; i++) b.step(); };

test('17-4 is explicitly test-only with independently pinned canonical level/enemy snapshots and native marker', async () => {
  assert.equal(index.stages.filter(e => !e.testOnly).length, 597);
  assert.throws(() => resolveStage(index, '17-4'), /test-only/);
  const d = structuredClone(mvp);
  await applyStage(d, index, '17-4', async () => ({ ok: true, json: async () => structuredClone(stage) }), { experimental: true });
  assert.doesNotThrow(() => assertRegularEnemies(d));
  for (const change of [s => { s.testOnly = false; }, s => { delete s.enemyCatalogue; }, s => { s.code = '16-9'; }]) {
    const bad = data(); change(bad.stage); assert.throws(() => assertRegularEnemies(bad), /Unsupported/);
  }
  assert.equal(stage.canonicalData.repository, 'arkpedia/arkpedia-data');
  assert.equal(stage.canonicalData.commit, '79e81a8a872b2ecc592647d81a864ccbf1f8ca06');
  assert.equal(stage.chapter16Source.canonicalData.commit, '245d7c601ce3a4a42adcfb84faa1bd1123d507bb');
  assert.equal(stage.pathing.moveScale, .5); assert.equal(stageAdapter(stage).spawns.length, 31);
  assert.deepEqual(Object.keys(stage.enemies).sort(), review.expected.enemies.slice().sort());
  assert.deepEqual(stage.devices.map(({ key, row, col }) => ({ key, row, col })), review.expected.devices);
  const b = build(19), marker = b.chapter16.rifts[0];
  assert.equal(marker.sp, 0); assert.equal(marker.spCost, 55); assert.equal(marker.spRecovery, 1);
  assert.equal(b.grid.tile(3, 3).build, 'NONE'); assert.equal(b.grid.tile(3, 3).pass, 'FLY');
});

test('17-4 builder binds source bytes, marker/skill graph, inventories and reaction review', () => {
  for (const file of Object.values(review.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file.path, import.meta.url))).digest('hex'), file.sha256);
  const dir = mkdtempSync(join(tmpdir(), 'ch17-4-build-'));
  const input = join(dir, 'stage.json'), geometry = join(dir, 'geometry.json'), out = join(dir, 'out.json');
  writeFileSync(input, JSON.stringify({ ...source.stage, name: 'Changed source' }));
  writeFileSync(geometry, JSON.stringify(source.geometry));
  assert.throws(() => execFileSync(process.execPath, ['tools/arkpedia/build-stage.mjs', '--candidate', 'ch16', '--stage', input,
    '--geometry', geometry, '--out', out], { stdio: 'pipe' }), e => /does not match its reviewed canonical source/.test(String(e.stderr)));
  assert.equal(existsSync(out), false);
});

for (const seed of [19, 71, 129]) test(`17-4 real beams split source Rockbreakers and all hostiles finish (seed ${seed})`, () => {
  const b = build(seed); b.life = 1000;
  const born = []; b.on('enemySpawn', ({ enemy }) => born.push(enemy));
  run(b);
  assert.deepEqual(b.errors, []); assert.equal(b.result().reason, 'cleared'); assert.ok(b.time < 300);
  const children = born.filter(e => e.mem.ch17RockbreakerParent), normal = born.filter(e => e.defId !== 'enemy_10211_murad' && !e.mem.ch17RockbreakerParent);
  assert.equal(normal.length, 31);
  assert.equal(normal.filter(e => e.defId === 'enemy_10203_mumag').length, 4);
  assert.equal(normal.filter(e => e.defId === 'enemy_10201_muinf').length, 20);
  assert.equal(normal.filter(e => e.defId === 'enemy_10204_mudia').length, 7);
  assert.ok(children.length > 0 && children.length <= 7); assert.equal(b.total, 31 + children.length);
  assert.ok(children.every(e => e.counted && e.holdsBattle !== false && e.findBuff('enemy_mudia_casted_flag')));
  assert.equal(new Set(children.map(e => e.mem.ch17RockbreakerParent)).size, children.length, 'no repeat split');
  assert.ok(b.chapter16.rifts[0].cycle > 0);
});

test('17-4 ordinary combat and split casts coexist around a legally deployed guard', () => {
  const b = build(19); b.life = 1000; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const cells = [];
  for (let r = 0; r < stage.geometry.rows; r++) for (let c = 0; c < stage.geometry.cols; c++)
    if (b.placementError('char_122_beagle', r, c) === null) cells.push([r, c]);
  assert.ok(cells.length > 0);
  const [r, c] = cells.find(([r, c]) => r === 3 && c === 5) ?? cells[0];
  const guard = b.deployOperator('char_122_beagle', r, c, 'LEFT'), attackers = new Set(), born = [];
  b.on('enemySpawn', ({ enemy }) => born.push(enemy));
  b.on('attack', e => { if (e.targets.includes(guard)) attackers.add(e.attacker.defId); });
  run(b);
  assert.ok(attackers.size > 0); assert.ok(born.some(e => e.mem.ch17RockbreakerParent));
  assert.deepEqual(b.errors, []); assert.equal(b.result().reason, 'cleared');
});
