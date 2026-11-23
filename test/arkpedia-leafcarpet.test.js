// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny } from './helpers/enemyHarness.js';
import { chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { leafcarpetNative, leafcarpetParams } from '../shared/arkpedia/enemy-leafcarpet-features.js';

const id = 'enemy_8013_mcnrsh', rec = records.enemies[id].levels[0], p = leafcarpetParams(rec);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const leaf = h => h.b.enemies.find(u => u.defId === id);

test('admitted only with its pinned rush, crash collider and templates; the Lancers and Direswine keep theirs', () => {
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features');
  assert.equal(leafcarpetNative(rec, nativeComponents(native, id)), true);
  for (const other of ['enemy_1072_dlancer', 'enemy_1072_dlancer_2', 'enemy_1309_mhboar'])
    assert.equal(enemySupport(records.enemies[other], clocks.prefabs, native).policy, 'stats-attacks-and-features', other);
  const tpl = structuredClone(native); tpl.templates.enemy_mcnrsh_trigger_1.eventToActions.ON_BUFF_TRIGGER.pop();
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, tpl).policy, null, 'no Fragile on interruption');
  const big = structuredClone(native), path = Object.keys(big.prefabs).find(k => k.endsWith(`/${id}.prefab`));
  const row = big.prefabs[path].find(c => c.originalJson.includes('"m_Radius":9.99'));
  assert.ok(row); row.originalJson = row.originalJson.replace(/"m_Radius":[0-9.e-]+/, '"m_Radius":0.5');
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, big).policy, null, 'another crash hitbox');
  assert.deepEqual(p, { increase: .5, interval: rec.talents.bb['rush.mcnrsh_t[trigger].interval'], limit: 30, predelay: 5, check: Math.fround(.1),
    fragile: 1, fragileDuration: 6, crashScale: 600, crashStun: 4, crashRadius: Math.fround(1e-4) });
});

test('unblockable and stun-immune; the rush stacks only after the 5 s predelay and stops after its 30 triggers', () => {
  const h = spawnAny(id, { units: [] }); h.step(); const e = leaf(h);
  assert.equal(e.s.flags.unblockable, true); assert.ok(e.def.immune.has('stun'));
  const base = rec.stats.moveSpeed, start = p.check; // the first 0.1 s check starts the rush
  const stacks = t => { let n = 0; for (let k = 1; k <= p.limit; k++) { const at = start + k * p.interval; if (at <= t + 1e-9 && at > start + p.predelay + 1e-9) n++; } return n; };
  h.run(4.9 - h.b.time); near(e.s.moveSpeed, base);
  h.run(8 - h.b.time); near(e.s.moveSpeed, base * (1 + p.increase * stacks(h.b.time)), 1e-3);
  h.run(14 - h.b.time); near(e.s.moveSpeed, base * (1 + p.increase * stacks(99)), 1e-3); assert.equal(stacks(99), 15);
  assert.deepEqual(h.b.errors, []);
});

test('a freeze during the rush ends it and leaves weak[limit]: double damage taken for 6 s', () => {
  const h = spawnAny(id, { units: [] }); h.step(); const e = leaf(h), b = h.b;
  h.run(8 - b.time); assert.ok(e.s.moveSpeed > rec.stats.moveSpeed);
  b.applyStatus(e, 'freeze', { duration: 1 }); h.run(.2);
  assert.ok(e.s.flags.freeze); near(e.s.moveSpeed, rec.stats.moveSpeed, 1e-9); // the rush and its stacks are gone
  h.run(1); assert.ok(!e.s.flags.freeze); near(e.s.moveSpeed, rec.stats.moveSpeed, 1e-9); // a new rush waits out its predelay
  const hp = e.hp; b.dealDamage(null, e, { amount: 100, type: 'true' }); near(hp - e.hp, 200, 1e-6);
  h.run(6); const hp2 = e.hp; b.dealDamage(null, e, { amount: 100, type: 'true' }); near(hp2 - e.hp, 100, 1e-6);
  assert.deepEqual(b.errors, []);
});

test('crash: a ground unit on its path takes 600 x current speed Physical (no SP) and a 4 s stun, once; aerial units are passed', () => {
  const guard = chessRec({ id: 'test_enemy_harness_guard' }).chessId;
  const run = flying => {
    const h = spawnAny(id, { units: [{ chessId: guard, row: 9, col: 5 }], autoFinish: false }); h.step();
    const e = leaf(h), b = h.b, [u] = b.allyUnits; if (flying) u.motion = 'FLY';
    const hits = []; b.on('damaged', c => { if (c.source === e) hits.push({ amount: c.amount, type: c.type, speed: e.s.moveSpeed }); });
    const until = b.time + 40; while (b.time < until && !hits.length && e.alive) h.step();
    return { h, e, b, u, hits };
  };
  const { h, e, b, u, hits } = run(false);
  assert.equal(hits.length, 1); assert.equal(hits[0].type, 'phys'); near(hits[0].amount, 600 * hits[0].speed - u.s.def, 1e-6); // Physical: the guard's DEF applies
  assert.ok(u.s.flags.stun, 'stunned'); assert.notEqual(e.blockedBy, u, 'not blocked');
  h.run(3.8); assert.ok(u.s.flags.stun); h.run(.4); assert.ok(!u.s.flags.stun, 'stun ends after 4 s');
  assert.equal(hits.length, 1, 'once per contact'); assert.deepEqual(b.errors, []);
  assert.equal(run(true).hits.length, 0, 'aerial units are not crashed');
});

test('compiled VEC-05: Leafcarpet at its stage stats', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'vec-05_act1break_05'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  let seen = null;
  while (!b.finished && b.time < 900 && !seen) {
    for (const x of b.enemies) if (x.alive) { if (x.defId === id) { seen = { hp: x.s.maxHp, unblockable: x.s.flags.unblockable }; } else b.kill(x); }
    b.step();
  }
  assert.ok(seen); assert.ok(seen.hp >= rec.stats.maxHp); assert.equal(seen.unblockable, true);
  assert.deepEqual(b.errors, []);
});
