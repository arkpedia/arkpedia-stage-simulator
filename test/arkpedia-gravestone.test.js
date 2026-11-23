// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { gravestoneNative, gravestoneParams } from '../shared/arkpedia/enemy-gravestone-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const id = 'enemy_2008_flking', rec = records.enemies[id].levels[0], p = gravestoneParams(rec);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

function fixture(positions, block = 0) {
  const op = chessRec({ id: 'gravestone-target', stats: { maxHp: 1e8, atk: 0, def: 0, res: 0, blockCnt: block }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 200,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec) } },
    units: positions.map(([row, col]) => ({ chessId: op.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start(); for (const u of b.allyUnits) b.addBuff(u, { key: 'hold', flags: { disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 9] }); b.addBuff(e, { key: 'hold', flags: { noMove: true } });
  const hits = []; b.on('damaged', c => { if (c.source === e) hits.push({ u: c.target, t: b.time, type: c.type, amount: c.amount }); });
  return { ...h, b, e, ops: b.allyUnits, hits };
}

test('admitted only with its pinned shell, barrier cast and clips; the claims match the native counts', () => {
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features');
  assert.equal(gravestoneNative(rec, nativeComponents(native, id)), true);
  const tpl = structuredClone(native); tpl.templates.enemy_flking_ranged.eventToActions.ON_CALCULATE_DAMAGE[0]._applyWayFilter = 'ALL';
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, tpl).policy, null, 'the 0.4 scale on every attack');
  assert.deepEqual({ rangedScale: p.rangedScale, ratio: p.shield.ratio, cooldown: p.shield.cooldown, initial: p.shield.initial }, { rangedScale: .4, ratio: .1, cooldown: 30, initial: 10 });
});

test('unblocked: a 0.4 x ATK shell splashes the 3x3 box around its target; nobody farther', () => {
  const { b, run, ops: [target, side, far], hits } = fixture([[9, 7], [10, 8], [9, 4]]);
  run(4);
  const by = u => hits.filter(x => x.u === u);
  assert.ok(by(target).length >= 1); near(by(target)[0].amount, .4 * rec.stats.atk); assert.equal(by(target)[0].type, 'phys');
  assert.ok(by(side).length >= 1, 'inside the 3x3 box'); assert.equal(by(far).length, 0);
  assert.deepEqual(b.errors, []);
});

test('blocked: the blocker takes full ATK on the 1.1 s melee clip, every 3.5 s', () => {
  const { b, e, run, ops: [u], hits } = fixture([[9, 8]], 1);
  e.x = u.x + .3; e.y = u.y; e.tileR = u.tileR; e.tileC = u.tileC; b._checkBlock(e); assert.equal(e.blockedBy, u);
  run(7.6); assert.ok(hits.length >= 2); assert.ok(hits.every(x => x.u === u && Math.abs(x.amount - rec.stats.atk) < 1e-6));
  assert.deepEqual(b.errors, []);
});

test('barrier: 10% of max HP from the first cast at 10 s (+0.3 s), replaced, not stacked, every 30 s', () => {
  const { b, e, run } = fixture([[3, 3]]);
  run(10.1); assert.ok(!e.findBuff('flking_shield[core]'), 'not before the event');
  run(.4); near(e.findBuff('flking_shield[core]').shield, .1 * e.s.maxHp);
  b.dealDamage(null, e, { amount: 1000, type: 'true' }); assert.equal(e.hp, e.s.maxHp, 'absorbed'); near(e.findBuff('flking_shield[core]').shield, .1 * e.s.maxHp - 1000);
  run(30); near(e.findBuff('flking_shield[core]').shield, .1 * e.s.maxHp); assert.equal(e.buffs.filter(x => x.key === 'flking_shield[core]').length, 1);
  assert.deepEqual(b.errors, []);
});

test('compiled ISW-DF stage: Gravestone at its stats; the stage carries ATK/DEF x0.5, redeploy x2 and 1 DP per 2 s', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'isw-df_level_obt_roguelike_ro2_level_rogue2_b-10'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  let seen = null;
  while (!b.finished && b.time < 900 && !seen) {
    for (const x of b.enemies) if (x.alive) { if (x.defId === id) seen = { hp: x.s.maxHp }; else b.kill(x); }
    b.step();
  }
  assert.ok(seen); assert.ok(seen.hp >= rec.stats.maxHp); assert.deepEqual(b.errors, []);
  assert.deepEqual(stage.rules.characterAttributes, [{ professionMask: 1023, buildableMask: 3, multipliers: { atk: .5, def: .5 } }]);
  assert.deepEqual(stage.rules.allyCards, [{ attribute: 'respawnTime', professionMask: 1023, buildableMask: 3, scale: 2 }]);
  assert.equal(stage.battle.dp_recovery_interval_seconds, 2);
});
