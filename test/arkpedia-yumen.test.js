// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { yumenNative } from '../shared/arkpedia/enemy-yumen-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const walls = ['enemy_1301_ymcnon', 'enemy_1301_ymcnon_2'], buses = ['enemy_1302_ymtro', 'enemy_1302_ymtro_2'];
const rec = id => records.enemies[id].levels[0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('all four are admitted only with their pinned trees; the beach bus keeps its own Bus', () => {
  for (const id of [...walls, ...buses]) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    assert.equal(yumenNative(rec(id), nativeComponents(native, id)), true, id);
  }
  assert.equal(enemySupport(records.enemies.enemy_1263_durbus, clocks.prefabs, native).policy, 'stats-attacks-and-features');
  const changed = structuredClone(native);
  changed.templates['enemy_ymtro_t[mark]'].eventToActions.ON_OWNER_ROOT_TILE_CHANGED[0]._tileKey = ['tile_other'];
  assert.equal(enemySupport(records.enemies[buses[0]], clocks.prefabs, changed).policy, null, 'Ladder key');
  const r = rec(buses[0]);
  assert.equal(yumenNative({ ...r, talents: { ...r.talents, bb: { 'Bus.max_cnt': 3 } } }, nativeComponents(native, buses[0])), false, 'capacity');
});

function field(enemies, units = []) {
  const op = chessRec({ id: 'yumen-target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: 0 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { chess: { [op.chessId]: op }, enemies: Object.fromEntries(enemies.map(id => [id, structuredClone(rec(id))])) },
    units: units.map(([row, col]) => ({ chessId: op.chessId, row, col })), setup: installEnemyFeatures });
  h.b.start(); for (const u of h.b.allyUnits) h.b.addBuff(u, { key: 'hold', flags: { disarm: true } });
  return h;
}

test('Wallbreaker: an arcing speed-6 shot for ATK Physical; it refuses stages with devices', () => {
  const h = field([walls[0]], [[9, 7]]), { b } = h;
  const e = b.spawnEnemy(walls[0], { pos: [9, 6] }); b.addBuff(e, { key: 'hold', flags: { noMove: true } });
  const hits = []; b.on('damaged', c => { if (c.source === e) hits.push(c); });
  h.run(1.5); assert.equal(hits.length, 1); assert.equal(hits[0].type, 'phys'); near(hits[0].amount, e.s.atk);
  assert.deepEqual(b.errors, []);
  const h2 = field([walls[0]]); h2.b.mvpStageDevices = [{ key: 'trap_test' }];
  h2.b.spawnEnemy(walls[0], { pos: [9, 6] });
  assert.ok(h2.b.errors.some(x => /_postFilter 48/.test(JSON.stringify(x) + String(x?.message ?? x))), 'refused: ' + JSON.stringify(h2.b.errors).slice(0, 200));
});

test('Sandwalker: loads up to four nearby ground non-machine enemies, carries them hidden, and drops them on its tile when it dies', () => {
  const h = field([buses[0], 'enemy_1007_slime'].filter(id => records.enemies[id])), { b } = h;
  const bus = b.spawnEnemy(buses[0], { pos: [9, 6] }); b.addBuff(bus, { key: 'hold', flags: { noMove: true } });
  const riders = [0, 1, 2, 3, 4].map(i => { const u = b.spawnEnemy('enemy_1007_slime', { pos: [9, 6 + (i % 2 ? .2 : -.2)] });
    b.addBuff(u, { key: 'hold', flags: { noMove: true } }); return u; });
  h.run(.2);
  const carried = riders.filter(u => u.mem.enemyPassengerOf === bus);
  assert.equal(carried.length, 4, 'capacity 4'); assert.ok(carried.every(u => u.hidden));
  const own = carried[0].route;
  b.kill(bus); h.run(.05);
  assert.ok(carried.every(u => !u.hidden && u.alive));
  assert.ok(carried.every(u => u.x === Math.round(bus.x) && u.y === Math.round(bus.y)), 'tile centre');
  assert.ok(carried[0].route && carried[0].route.legs.length === own.legs.length, 'its own route');
  assert.deepEqual(b.errors, []);
});

test('compiled TG-8: the Wallbreaker and the Sand Voyager at their stage stats', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'tg-8'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  const seen = {};
  while (!b.finished && b.time < 900 && !(seen[walls[0]] && seen[buses[1]])) {
    for (const e of b.enemies) if (e.alive) {
      if (e.defId === walls[0] || e.defId === buses[1]) { if (!seen[e.defId]) seen[e.defId] = { hp: e.s.maxHp, atk: e.s.atk }; }
      b.kill(e); // keep the run going: nothing leaks
    }
    b.step();
  }
  assert.ok(seen[walls[0]] && seen[buses[1]]);
  assert.equal(seen[walls[0]].hp, 15000); assert.equal(seen[buses[1]].hp, 30000); assert.equal(seen[buses[1]].atk, 1000);
  assert.deepEqual(b.errors, []);
});
