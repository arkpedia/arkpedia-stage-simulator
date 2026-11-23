// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { holyEscortNative } from '../shared/arkpedia/enemy-holy-escort-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const bats = ['enemy_1336_bldbat', 'enemy_1336_bldbat_2'], robbers = ['enemy_1337_bhrknf', 'enemy_1337_bhrknf_2'];
const rec = id => records.enemies[id].levels[0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

function fixture(id, [row, col], block = 0) {
  const op = chessRec({ id: 'escort-target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: block }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec(id)) } },
    units: [{ chessId: op.chessId, row, col }], setup: installEnemyFeatures });
  const b = h.b; b.start();
  const [u] = b.allyUnits; b.addBuff(u, { key: 'hold', flags: { disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 6] }); b.addBuff(e, { key: 'hold', flags: { noMove: true } });
  const hits = []; b.on('damaged', c => { if (c.target === u) hits.push({ type: c.type, amount: c.amount, source: c.source, t: b.time }); });
  return { ...h, e, u, hits };
}

test('all four are admitted only with their pinned trees; the Gnawbeast keeps its BloodHit', () => {
  for (const id of [...bats, ...robbers]) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    assert.equal(holyEscortNative(rec(id), nativeComponents(native, id)), true, id);
  }
  assert.equal(enemySupport(records.enemies.enemy_1335_bldrat, clocks.prefabs, native).policy, 'stats-attacks-and-features');
  const changed = structuredClone(native);
  const cost = changed.templates['bhrknf_t_1[cost]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE.find(a => a._blackboardKey === 'cost');
  cost._sourceType = 'BUFF_OWNER';
  assert.equal(enemySupport(records.enemies[robbers[0]], clocks.prefabs, changed).policy, null, 'DP source');
});

test('Vesperwing: every second shot is BloodHit, leaving a 5 s Bleed of blood_value per second', () => {
  for (const id of bats) {
    const { b, e, u, run, hits } = fixture(id, [9, 7]), value = rec(id).skills[0].bb.blood_value;
    run(3 + 1);
    assert.ok(hits.filter(x => x.source === e && x.type === 'arts').length >= 2);
    const bleed = u.findBuff('blood_dec'); assert.ok(bleed, 'Bleed after the second shot');
    const hp = u.hp; run(1.05); near(hp - u.hp, value);
    assert.deepEqual(b.errors, []);
  }
});

test('Wasteland Robber: shoots when free, strikes its blocker, and every cost attack takes DP', () => {
  for (const id of robbers) {
    const free = fixture(id, [9, 8]);
    const cost = rec(id).skills[0].spCost, steals = [], addDp = free.b.addDp.bind(free.b);
    free.b.addDp = (who, n) => { if (n < 0) steals.push(n); return addDp(who, n); };
    free.run(2 * (cost + 1) + .5);
    const shots = free.hits.filter(x => x.type === 'phys').length;
    assert.ok(shots >= cost + 1); assert.equal(steals.length, Math.floor(shots / (cost + 1)), `${steals.length} steals in ${shots} shots`);
    assert.ok(steals.every(n => n === rec(id).skills[0].bb.cost));
    assert.deepEqual(free.b.errors, []);
    const blocked = fixture(id, [9, 6], 1), { b, e, u } = blocked;
    e.x = u.x - .3; e.y = u.y; e.tileR = u.tileR; e.tileC = u.tileC; b._checkBlock(e); assert.equal(e.blockedBy, u); e.atkCd = 0;
    blocked.run(.1); assert.deepEqual(e.def.attackAnim.dur, Math.fround(1.1666666269302368), 'the melee clip');
    blocked.run(1); assert.ok(blocked.hits.some(x => x.source === e && x.type === 'phys'));
    assert.deepEqual(b.errors, []);
  }
});

test('compiled HE-EX-1: the Startled Vesperwing and the Elite Robber at their stats', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'he-ex-1'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  const seen = {};
  while (!b.finished && b.time < 900 && !(seen[bats[1]] && seen[robbers[1]])) {
    for (const e of b.enemies) if (e.alive) {
      if ((e.defId === bats[1] || e.defId === robbers[1]) && !seen[e.defId]) seen[e.defId] = { hp: e.s.maxHp, atk: e.s.atk };
      b.kill(e);
    }
    b.step();
  }
  assert.ok(seen[bats[1]] && seen[robbers[1]]);
  assert.ok(seen[bats[1]].hp >= rec(bats[1]).stats.maxHp && seen[robbers[1]].hp >= rec(robbers[1]).stats.maxHp, JSON.stringify(seen));
  assert.deepEqual(b.errors, []);
});
