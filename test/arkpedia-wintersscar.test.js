// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { wintersScarNative, wintersScarParams } from '../shared/arkpedia/enemy-wintersscar-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const id = 'enemy_1510_frstar2', rec = records.enemies[id].levels[0], p = wintersScarParams(rec);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

function fixture(positions) {
  const op = chessRec({ id: 'frstar2-target', stats: { maxHp: 1e8, atk: 0, def: 0, res: 0, blockCnt: 0 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 300,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec) } },
    units: positions.map(([row, col]) => ({ chessId: op.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start(); for (const u of b.allyUnits) b.addBuff(u, { key: 'hold', flags: { disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 6] }); b.addBuff(e, { key: 'hold', persist: true, flags: { noMove: true } });
  const hits = []; b.on('damaged', c => { if (c.source === e) hits.push({ u: c.target, t: b.time, amount: c.amount, tags: c.dmg?.tags ?? [], frozen: !!c.target.s.flags.freeze }); });
  return { ...h, b, e, ops: b.allyUnits, hits };
}

test('both levels are admitted (level 1 read over level 0); the first FrostNova keeps her kit', () => {
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features');
  for (const level of [0, 1]) assert.equal(wintersScarNative(records.enemies[id].levels[level], nativeComponents(native, id)), true, level);
  assert.equal(enemySupport(records.enemies.enemy_1505_frstar, clocks.prefabs, native).policy, 'stats-attacks-and-features');
  const p1 = wintersScarParams(records.enemies[id].levels[1]);
  assert.deepEqual([p.revive.dur, p.revive.atkPct, p.revive.invincible, p.attack.cold], [10, .5, 20, 5]);
  assert.deepEqual([p1.revive.dur, p1.revive.atkPct, p1.revive.invincible, p1.attack.cold, p1.forms[1].shield.count], [10, .5, 25, 5, 4]);
  assert.equal(p.frosts, 'frstar_frosts');
  const tpl = structuredClone(native); tpl.templates.e2c_frozen_atkscale.eventToActions.ON_CALCULATE_DAMAGE.shift();
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, tpl).policy, null, 'frozen check removed');
});

test('a normal attack applies 5 s of Cold; IceBurst hits everyone within 2, doubles on Frozen, and applies 10 s of Cold', () => {
  const { b, e, run, ops: [near1, near2, far], hits } = fixture([[9, 7], [10, 6], [9, 2]]);
  run(1.5); // first attack (0.933 s release, speed-10 bolt)
  const firstHit = hits.find(x => !x.tags.includes('frstar2IceBurst'));
  assert.ok(firstHit); assert.ok(firstHit.u.s.flags.cold, 'Cold after a normal hit');
  // freeze near2 (a second Cold source in the engine turns into Frozen); then let IceBurst land
  b.applyStatus(near2, 'freeze', { duration: 30 });
  run(p.forms[0].burst.initial + p.forms[0].burst.anim.hit + .2 - b.time);
  const burst = hits.filter(x => x.tags.includes('frstar2IceBurst'));
  const of = u => burst.filter(x => x.u === u);
  assert.equal(of(near1).length, 1); assert.equal(of(near2).length, 1); assert.equal(of(far).length, 0);
  // repeated Cold from her normal attacks can already have frozen near1: the double follows the FROZEN flag at the hit
  for (const x of [...of(near1), ...of(near2)]) near(x.amount, e.s.atk * (x.frozen ? 2 : 1));
  assert.equal(of(near2)[0].frozen, true); near(of(near2)[0].amount, e.s.atk * 2);
  assert.ok(near1.s.flags.cold || near1.s.flags.freeze);
  assert.deepEqual(b.errors, []);
});

test('rebirth: 10 s, then ATK +50%, 20 s invulnerable, and the Reborn IceBurst on the Skill_3 clip', () => {
  const { b, e, run, ops: [u], hits } = fixture([[9, 7]]);
  run(.2); const atk = e.s.atk;
  b.dealDamage(null, e, { amount: 1e9, type: 'true' }); run(.1); assert.equal(e.alive, true);
  run(p.revive.dur); near(e.s.atk, atk * 1.5); assert.ok(e.s.flags.invulnerable);
  const t0 = b.time; hits.length = 0;
  run(p.forms[1].burst.initial + p.forms[1].burst.anim.hit + .2);
  const burst = hits.filter(x => x.tags.includes('frstar2IceBurst'));
  assert.ok(burst.length >= 1); near(burst[0].t - t0, p.forms[1].burst.initial + p.forms[1].burst.anim.hit, .15);
  run(p.revive.invincible - (b.time - t0) + .1); assert.ok(!e.s.flags.invulnerable, 'invincibility over after 20 s');
  assert.ok(e.def.immune.has('sleep'), 'sleep immunity kept');
  assert.deepEqual(b.errors, []);
});

test('compiled 6-16: the hidden Ice Crystals appear when she enters her second form, once', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === '6-16'));
  const crystals = stage.devices.filter(d => d.key === 'trap_010_frosts');
  assert.equal(crystals.length, 2); assert.ok(crystals.every(d => d.hidden && d.branchActivated));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  const active = () => b.mvpStageDevices.filter(d => d.key === 'trap_010_frosts' && d.active).length;
  const tileOf = d => b.grid.tile(d.row, d.col).build;
  assert.equal(active(), 0);
  let fs = null, koAt = null;
  while (!b.finished && b.time < 900) {
    for (const x of b.enemies) if (x.alive && x.defId !== id) b.kill(x);
    const f = b.enemies.find(x => x.alive && x.defId === id);
    if (f && !fs) { fs = f; b.addBuff(f, { key: 'test:hold', persist: true, flags: { noMove: true } }); }
    if (fs && koAt == null && b.time > 5) { b.dealDamage(null, fs, { amount: 1e9, type: 'true' }); koAt = b.time; }
    if (koAt != null && b.time < koAt + p.revive.dur - .2) assert.equal(active(), 0, 'not during the rebirth');
    if (koAt != null && b.time > koAt + p.revive.dur + 1) break;
    b.step();
  }
  assert.ok(fs, "Winter's Scar spawns"); assert.equal(active(), 2, 'both crystals active');
  for (const d of b.mvpStageDevices.filter(x => x.key === 'trap_010_frosts')) assert.equal(tileOf(d), 'NONE', 'crystal tile undeployable');
  assert.equal(b.stageBranches.hasNext('frstar_frosts'), false);
  assert.deepEqual(b.errors, []);
});
