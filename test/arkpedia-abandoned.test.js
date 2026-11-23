// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { abandonedNative } from '../shared/arkpedia/enemy-abandoned-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const ids = ['enemy_1440_dselec', 'enemy_1440_dselec_2'];
const rec = id => records.enemies[id].levels[0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

function fixture(id, positions, block = 0) {
  const op = chessRec({ id: 'abandoned-target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: block }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec(id)) } },
    units: positions.map(([row, col]) => ({ chessId: op.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start();
  for (const u of b.allyUnits) b.addBuff(u, { key: 'hold', flags: { disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 6] }); b.addBuff(e, { key: 'hold', flags: { noMove: true } });
  const hits = []; b.on('damaged', c => { if (c.source === e) hits.push({ u: c.target, type: c.type, amount: c.amount }); });
  return { ...h, e, ops: b.allyUnits, hits };
}

test('both are admitted only with the instant x-5 splash, the blocked Combat and the pinned tree', () => {
  for (const id of ids) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    assert.equal(abandonedNative(rec(id), nativeComponents(native, id)), true, id);
  }
  const changed = structuredClone(native);
  for (const row of changed.projectiles.projectile_enemy_dselec) {
    const d = JSON.parse(row.originalJson); if (d._rangeId === 'x-5') { d._rangeId = 'x-1'; row.originalJson = JSON.stringify(d); }
  }
  assert.equal(enemySupport(records.enemies[ids[0]], clocks.prefabs, changed).policy, null, 'another splash range');
});

test('unblocked: ATK Arts to the target and to units on its four neighbouring tiles, nobody else', () => {
  for (const id of ids) {
    const { b, e, run, ops: [target, side, diagonal], hits } = fixture(id, [[9, 7], [10, 7], [10, 8]]);
    run(.1);
    const hitBy = u => hits.filter(x => x.u === u);
    assert.equal(hitBy(target).length, 1); near(hitBy(target)[0].amount, e.s.atk); assert.equal(hitBy(target)[0].type, 'arts');
    assert.equal(hitBy(side).length, 1, 'cross neighbour');
    assert.equal(hitBy(diagonal).length, 0, 'diagonal is outside the cross');
    assert.deepEqual(b.errors, []);
  }
});

test('blocked: the Combat hits the blocker alone, on the Combat clip', () => {
  const { b, e, run, ops: [blocker, side], hits } = fixture(ids[0], [[9, 6], [10, 6]], 1);
  e.x = blocker.x - .3; e.y = blocker.y; e.tileR = blocker.tileR; e.tileC = blocker.tileC; b._checkBlock(e);
  assert.equal(e.blockedBy, blocker); e.atkCd = 0;
  run(.2);
  assert.ok(hits.some(x => x.u === blocker)); assert.equal(hits.filter(x => x.u === side).length, 0, 'no splash while blocked');
  assert.deepEqual(b.errors, []);
});

test('compiled BP-EX-3 Challenge: both variants at their Challenge stats', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'bp-ex-3_challenge_mode'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  const seen = {};
  while (!b.finished && b.time < 900 && !(seen[ids[0]] && seen[ids[1]])) {
    for (const e of b.enemies) if (e.alive) { if (ids.includes(e.defId) && !seen[e.defId]) seen[e.defId] = { hp: e.s.maxHp, atk: e.s.atk }; b.kill(e); }
    b.step();
  }
  assert.deepEqual(seen[ids[0]], { hp: 22800, atk: 864 }); assert.deepEqual(seen[ids[1]], { hp: 26400, atk: 1056 });
  assert.deepEqual(b.errors, []);
});
