// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileRoute } from '../server/sim/ai.js';
import { normalizeRoute } from '../server/sim/simdata.js';
import { remainingRoute, spawnChildren } from '../server/sim/content/enemies.js';
import { stageRouteClockWaits } from '../shared/arkpedia/stage-path.js';
import { makeBattle, enemyRec } from './helpers/battleHarness.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };

const route = (clock = 'fragment', time = 5) => ({ start: [9, 10], end: [9, 2], checkpoints: [{ type: 'WAIT_UNTIL', time, clock }] });
function fixture() { return makeBattle({ content: 'none', flags: { moveScale: 1 }, defs: { enemies: { enemy_test: enemyRec() } }, autoFinish: false }); }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);

test('clock checkpoints retain normalization and require their captured origin', () => {
  const r = normalizeRoute(route());
  assert.equal(r.checkpoints[0].type, 'WAIT_UNTIL');
  assert.equal(compileRoute(r, null, { fragment: 12 })[0].time, 17);
  assert.throws(() => compileRoute(r), /route clock snapshot/);
  assert.throws(() => compileRoute(normalizeRoute(route('invented')), null, { fragment: 12 }), /route clock snapshot/);
  assert.equal(compileRoute(normalizeRoute(route('battle')))[0].time, 5);
});

test('early arrival waits only until the fragment deadline, late arrival adds no new wait', () => {
  const h = fixture(); h.run(3);
  const e = h.spawn('enemy_test', { route: route(), routeClock: { wave: 0, fragment: 0 } });
  h.run(1); close(e.x, 10);
  h.run(2); close(e.x, 9);
  const late = h.spawn('enemy_test', { route: route(), routeClock: { fragment: 0 } });
  h.run(1); close(late.x, 9);
  assert.deepEqual(h.b.errors, []);
});

test('control spanning the deadline does not restart the clock on recovery', () => {
  const h = fixture(), e = h.spawn('enemy_test', { route: route(), routeClock: { fragment: 0 } });
  const hold = h.b.addBuff(e, { key: 'test:noMove', flags: { noMove: true } });
  h.run(7); close(e.x, 10); h.b.removeBuff(e, hold); h.run(1); close(e.x, 9);
});

test('summoned children and replacement routes retain an absolute deadline', () => {
  const h = fixture(), e = h.spawn('enemy_test', { route: route(), routeClock: { fragment: 0 } });
  h.run(3);
  const remaining = remainingRoute(e);
  assert.deepEqual(remaining.steps[0], { t: 'WAIT_UNTIL', s: 5, clock: 'absolute' });
  const [child] = spawnChildren(h.b, e, 'enemy_test', 1);
  assert.equal(child.route.legs[0].time, 5);
  h.run(1); close(child.x, 10); h.run(2); close(child.x, 9);
});

test('geometry clock checkpoints resolve repeated positions in route order', () => {
  const geometry = { checkpoints: [{ position: { row: 0, col: 1 } }, { position: { row: 0, col: 2 } }, { position: { row: 0, col: 1 } }],
    waits: [{ after_checkpoint: 2, type: 'wait_current_wave_time', seconds: 8 }] };
  const holds = stageRouteClockWaits(geometry, { points: [[0, 0], [1, 0], [2, 0], [1, 0], [0, 0]] });
  assert.deepEqual([...holds], [[3, [{ type: 'WAIT_UNTIL', time: 8, clock: 'wave' }]]]);
  assert.throws(() => stageRouteClockWaits(geometry, { points: [[0, 0]] }), /missing from viewer path/);
});

test('arrival-relative pauses adjacent to a clock wait retain original ordering exactly once', () => {
  const r = { checkpoints: [], waits: [
    { after_checkpoint: -1, type: 'wait_for_seconds', seconds: 3 },
    { after_checkpoint: -1, type: 'wait_current_fragment_time', seconds: 10 },
    { after_checkpoint: -1, type: 'wait_for_seconds', seconds: 2 },
  ] };
  assert.deepEqual(stageRouteClockWaits(r, { points: [[0, 0]] }).get(0), [
    { type: 'WAIT', time: 3 }, { type: 'WAIT_UNTIL', time: 10, clock: 'fragment' }, { type: 'WAIT', time: 2 },
  ]);
});

test('0-11 challenge captures original thirty-second fragment waits before later scheduler transitions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(e => e.id === '0-11_challenge_mode'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } }, { operators: [defaultBuild(mvp.operators.char_123_fang)] });
  b.life = 1e6; const captured = [];
  b.on('enemySpawn', ({ enemy }) => {
    const deadlines = enemy.route.legs.filter(l => l.t === 'deadline');
    for (const d of deadlines) { close(d.time, enemy.routeClock.fragment + 30); captured.push({ enemy, deadline: d.time }); }
  });
  for (let n = 0; n < 6000 && !b.finished; n++) {
    // Diagnostic clear gates, not a player clear: remove other enemies to reach
    // the native third-wave waiters without needing a particular squad.
    for (const e of b.enemies) if (e.alive && !captured.some(c => c.enemy === e)) b.kill(e);
    b.step();
    if (captured.length === 2 && b.time > captured[0].deadline + 1) break;
  }
  assert.equal(captured.length, 2);
  for (const c of captured) { close(c.deadline, c.enemy.routeClock.fragment + 30); assert.ok(c.enemy.route.legIdx > 1); }
  assert.deepEqual(b.errors, []);
});
