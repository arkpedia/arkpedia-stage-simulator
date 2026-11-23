// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { rusthammerNative, rusthammerParams } from '../shared/arkpedia/enemy-rusthammer-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const id = 'enemy_2006_flsnip', rec = records.enemies[id].levels[0], p = rusthammerParams(rec);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

function fixture() {
  const op = chessRec({ id: 'rusthammer-target', stats: { maxHp: 1e8, atk: 0, def: 0, res: 0, blockCnt: 3 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 200,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec) } },
    units: [{ chessId: op.chessId, row: 9, col: 4 }], setup: installEnemyFeatures });
  const b = h.b; b.start(); const [u] = b.allyUnits; b.addBuff(u, { key: 'hold', flags: { disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 9] }); b.addBuff(e, { key: 'hold', flags: { noMove: true } });
  const hits = []; b.on('damaged', c => { if (c.source === e) hits.push({ t: b.time, type: c.type, amount: c.amount }); });
  return { ...h, b, e, u, hits };
}

test('admitted only with its pinned Faust kit, projectiles and clips; the claims match the native counts', () => {
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features');
  assert.equal(rusthammerNative(rec, nativeComponents(native, id)), true);
  const shot = structuredClone(native);
  for (const row of shot.projectiles.projectile_enemy_flsnip_s1) row.originalJson = row.originalJson.replace('"_speed":10.0', '"_speed":5.0');
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, shot).policy, null, 'another bolt speed');
  assert.deepEqual({ invincible: p.invincible, cooldown: p.cooldown, initial: p.initial, scale: p.scale }, { invincible: 60, cooldown: 18, initial: 18, scale: 3 });
});

test('invulnerable for the first 60 s, unblockable and sleep-immune for life', () => {
  const { b, e, run } = fixture(); run(.1);
  assert.equal(e.s.flags.invulnerable, true); assert.equal(e.s.flags.unblockable, true); assert.ok(e.def.immune.has('sleep'));
  const hp = e.hp; b.dealDamage(null, e, { amount: 1000, type: 'true' }); assert.equal(e.hp, hp, 'no damage while invincible');
  run(60); assert.ok(!e.s.flags.invulnerable); assert.equal(e.s.flags.unblockable, true);
  b.dealDamage(null, e, { amount: 1000, type: 'true' }); near(hp - e.hp, 1000);
  assert.deepEqual(b.errors, []);
});

test('Physical bolts on the attack clock; from 18 s the next attack is the Arts CriticalHit at 3 x ATK, every 18 s', () => {
  const { b, e, run, hits } = fixture(); run(60);
  const arts = hits.filter(x => x.type === 'arts'), phys = hits.filter(x => x.type === 'phys');
  assert.ok(phys.length >= 3); assert.ok(phys.every(x => Math.abs(x.amount - rec.stats.atk) < 1e-6));
  assert.ok(arts.length >= 2); assert.ok(arts.every(x => Math.abs(x.amount - 3 * rec.stats.atk) < 1e-6));
  assert.ok(arts[0].t >= 18, `first CriticalHit at ${arts[0].t}`); assert.ok(arts[1].t - arts[0].t >= 18 - 1e-6);
  assert.deepEqual(b.errors, []);
});

test('compiled IS stage: Rusthammer Warrior at its stage stats', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'isw-df_level_obt_roguelike_ro2_level_rogue2_b-8'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  let seen = null;
  while (!b.finished && b.time < 900 && !seen) {
    for (const x of b.enemies) if (x.alive) { if (x.defId === id) seen = { hp: x.s.maxHp, inv: x.s.flags.invulnerable }; else b.kill(x); }
    b.step();
  }
  assert.ok(seen); assert.ok(seen.hp >= rec.stats.maxHp); assert.deepEqual(b.errors, []);
});
