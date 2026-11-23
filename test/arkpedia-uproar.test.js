// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { uproarNative, uproarParams } from '../shared/arkpedia/enemy-uproar-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const id = 'enemy_8015_mcnrhd', rec = records.enemies[id].levels[0], p = uproarParams(rec);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

function fixture(positions, block = 0) {
  const op = chessRec({ id: 'uproar-target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: block }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec) } },
    units: positions.map(([row, col]) => ({ chessId: op.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start();
  for (const u of b.allyUnits) b.addBuff(u, { key: 'hold', flags: { disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 9] }); b.addBuff(e, { key: 'hold', flags: { noMove: true, disarm: true } });
  const hits = []; b.on('damaged', c => { if (c.source === e) hits.push({ u: c.target, amount: c.amount, type: c.type, t: b.time }); });
  h.run(.1);
  return { ...h, b, e, ops: b.allyUnits, hits };
}

test('admitted only with its pinned damage template, arrow-rain projectile and clips; the shared rebirth runs it', () => {
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features');
  assert.equal(uproarNative(rec, nativeComponents(native, id)), true);
  const tpl = structuredClone(native); tpl.templates.enemy_mcnrhd_damage.eventToActions.ON_TAKE_DAMAGE.splice(1, 1);
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, tpl).policy, null, 'no multiAttack trigger');
  const shot = structuredClone(native);
  for (const row of shot.projectiles.projectile_enemy_mcnrhd_skill) row.originalJson = row.originalJson.replace('"_delayTime":0.30000001192092896', '"_delayTime":0');
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, shot).policy, null, 'another landing delay');
  assert.deepEqual({ reduction: p.reduction, cooldown: p.cooldown, initial: p.initial, radius: p.radius, scale: p.scale, aspd: p.aspd, aspdDuration: p.aspdDuration },
    { reduction: .8, cooldown: 4, initial: 0, radius: 1.5, scale: 1.2, aspd: -50, aspdDuration: 10 });
});

test('unblocked: Physical and Arts hits are cut to 20% (True is not); blocked: full damage', () => {
  const { b, e, run } = fixture([[3, 3]]);
  for (const [type, taken] of [['phys', 20], ['arts', 20], ['true', 100]]) {
    const hp = e.hp; b.dealDamage(null, e, { amount: 100 + (type === 'phys' ? rec.stats.def : 0), type, ...(type === 'arts' ? {} : {}) });
    if (type === 'arts') near(hp - e.hp, 100 * (1 - rec.stats.res / 100) * .2, 1e-6); else near(hp - e.hp, taken, 1e-6);
  }
  const blocked = fixture([[9, 8]], 1), u = blocked.ops[0], be = blocked.e;
  be.x = u.x + .3; be.y = u.y; be.tileR = u.tileR; be.tileC = u.tileC; blocked.b._checkBlock(be); assert.equal(be.blockedBy, u);
  blocked.run(.1); assert.ok(!be.findBuff('enemy_mcnrhd_damage'), 'no reduction while blocked');
  { const hp = be.hp; blocked.b.dealDamage(null, be, { amount: 100 + rec.stats.def, type: 'phys' }); near(hp - be.hp, 100, 1e-6); }
  assert.deepEqual(blocked.b.errors, []);
  const hp = e.hp; b.dealDamage(null, e, { amount: 100, type: 'true' }); near(hp - e.hp, 100);
  assert.deepEqual(b.errors, []);
});

test('a hit from an operator casts the arrow rain on it: 1.2 x ATK Physical within 1.5 and -50 ASPD for 10 s; once per 4 s', () => {
  const { b, e, run, ops: [shooter, neighbour, far], hits } = fixture([[9, 6], [10, 6], [9, 3]]);
  b.dealDamage(shooter, e, { amount: 1000, type: 'arts', isAttack: true });
  assert.equal(e.skillAnimUntil > b.time, true, 'the Skill clip started');
  const flight = Math.hypot(shooter.x - e.x, shooter.y - e.y) / p.speed, landAt = b.time + p.cast.hit + flight + p.delay;
  b.dealDamage(shooter, e, { amount: 1000, type: 'arts', isAttack: true }); // on cooldown: no second rain
  run(landAt - b.time - .15); assert.equal(hits.length, 0, 'not yet landed');
  run(.3);
  const by = u => hits.filter(x => x.u === u);
  assert.equal(by(shooter).length, 1); assert.equal(by(neighbour).length, 1); assert.equal(by(far).length, 0);
  near(by(shooter)[0].amount, e.s.atk * 1.2); assert.equal(by(shooter)[0].type, 'phys');
  assert.ok(shooter.findBuff('enemy_mcnrhd_attack_speed')); assert.ok(!far.findBuff('enemy_mcnrhd_attack_speed'));
  run(p.cooldown); b.dealDamage(shooter, e, { amount: 1000, type: 'arts', isAttack: true }); run(p.cast.dur + 2);
  assert.equal(by(shooter).length, 2, 'ready again after 4 s');
  assert.deepEqual(b.errors, []);
});

test('Rebirth: the first knock-out holds for 5.667 s, then Uproar returns at full HP', () => {
  const { b, e, run } = fixture([[3, 3]]);
  b.dealDamage(null, e, { amount: 1e9, type: 'true' }); run(.1);
  assert.equal(e.alive, true); assert.ok(e.hp < e.s.maxHp);
  run(5.667); assert.equal(e.alive, true); near(e.hp, e.s.maxHp, 1e-6);
  b.dealDamage(null, e, { amount: 1e9, type: 'true' }); run(.1); assert.equal(e.alive, false, 'only once');
  assert.deepEqual(b.errors, []);
});

for (const [sid, label] of [['vec-10_act1break_10', 'VEC-10'], ['vec-sp16_act1break_sp16', 'VEC-SP16']])
  test(`compiled ${label}: Uproar at its stage stats`, async () => {
    const { readFile } = await import('node:fs/promises');
    const { StandardBattle } = await import('../server/sim/arkpedia.js');
    const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
    const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
    const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
    const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
    const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
    const stage = await loader.load(manifest.stages.find(s => s.id === sid));
    const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
      { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
    let seen = null;
    while (!b.finished && b.time < 900 && !seen) {
      for (const x of b.enemies) if (x.alive) { if (x.defId === id) seen = { hp: x.s.maxHp }; else b.kill(x); }
      b.step();
    }
    assert.ok(seen); assert.ok(seen.hp >= rec.stats.maxHp); assert.deepEqual(b.errors, []);
  });
