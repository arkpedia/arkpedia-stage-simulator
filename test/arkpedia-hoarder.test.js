// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { hoarderNative, hoarderParams } from '../shared/arkpedia/enemy-hoarder-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const ids = ['enemy_1436_dsdivi', 'enemy_1436_dsdivi_2'];
const rec = id => records.enemies[id].levels[0];
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

/** A Hoarder walking its harness route; a disarmed, distant operator so it never shoots. */
function fixture(id = ids[0]) {
  const op = chessRec({ id: 'hoarder-source', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: 0 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 180,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec(id)) } },
    units: [{ chessId: op.chessId, row: 12, col: 1 }], setup: installEnemyFeatures });
  const b = h.b; b.start();
  const [src] = b.allyUnits; b.addBuff(src, { key: 'test:hold', flags: { disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 8], route: 0 });
  const copies = () => b.enemies.filter(x => x.alive && x !== e && x.defId === id);
  const hit = amount => b.dealDamage(src, e, { amount, type: 'true' });
  return { ...h, e, src, copies, hit };
}

test('both variants are admitted only with the split listener, its cast and the pinned tree; a variant splits into itself', () => {
  for (const id of ids) {
    const s = enemySupport(records.enemies[id], clocks.prefabs, native);
    assert.equal(s.policy, 'stats-attacks-and-features', id); assert.deepEqual(s.spawns, [id]);
    assert.equal(hoarderNative(rec(id), nativeComponents(native, id)), true, id);
  }
  for (const change of [
    n => n.templates['dsdivi_tr_1[listener]'].eventToActions.ON_APPLIED_MODIFIER[1]._conditionNode._abnormalFlag = 'STUNNED',
    n => n.templates['dsdivi_tr_1[copy_hp]'].eventToActions.ON_BUFF_START[0]._copyByRatio = false,
    n => n.templates.dsdivi_tr_1.eventToActions.ON_BUFF_START[0]._summonCount = 2,
  ]) { const changed = structuredClone(native); change(changed);
    assert.equal(enemySupport(records.enemies[ids[0]], clocks.prefabs, changed).policy, null); }
  const r = rec(ids[0]);
  assert.equal(hoarderNative({ ...r, skills: [{ ...r.skills[0], bbStr: { enemy_key: 'enemy_1436_dsdivi_2' } }] }, nativeComponents(native, ids[0])), false);
});

test('the first hit below 50% HP roots it for the 1.83 s Skill clip, then one copy appears with the same HP ratio; copies never split', () => {
  for (const id of ids) {
    const { b, e, run, copies, hit } = fixture(id), p = hoarderParams(rec(id)), max = e.s.maxHp;
    run(.1); hit(max * .49); assert.equal(copies().length, 0, 'not below 50% yet');
    hit(max * .02); assert.ok(e.findBuff('dsdivi_tr_1[unmovable]')); assert.equal(e.profile.noAttack, true);
    const x = e.x; run(p.cast - .05); assert.equal(copies().length, 0); near(e.x, x, 1e-9);
    run(.1); const [copy] = copies(); assert.ok(copy, 'split');
    near(copy.hp / copy.s.maxHp, e.hp / e.s.maxHp, 1e-6);
    assert.ok(Math.hypot(copy.x - e.x, copy.y - e.y) <= Math.SQRT2 * p.offset + 1e-9);
    hit(max * .1); b.dealDamage(null, copy, { amount: copy.s.maxHp * .2, type: 'true', sourceless: true });
    run(3); assert.equal(copies().length, 1, 'one split only; the copy never splits');
    run(.5); assert.ok(!e.findBuff('dsdivi_tr_1[unmovable]'));
    assert.deepEqual(b.errors, []);
  }
});

test('a silenced Hoarder does not split; the next hit after the silence does', () => {
  const { b, e, run, copies, hit } = fixture(), p = hoarderParams(rec(ids[0]));
  b.applyStatus(e, 'silence', { duration: 1, source: null });
  hit(e.s.maxHp * .6); run(p.cast + .2); assert.equal(copies().length, 0);
  run(1); hit(1); run(p.cast + .2); assert.equal(copies().length, 1);
  assert.deepEqual(b.errors, []);
});

test('compiled BP-EX-1: the Hoarder at its stats splits once in the stage', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'bp-ex-1'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  let hoarder = null;
  const clear = () => { for (const e of b.enemies) if (e.alive && e.defId !== ids[0]) b.kill(e); };
  while (!b.finished && b.time < 900 && !hoarder) { clear(); hoarder = b.enemies.find(e => e.alive && e.defId === ids[0]); b.step(); }
  assert.ok(hoarder); assert.equal(hoarder.s.maxHp, 8000); assert.equal(hoarder.s.atk, 190);
  b.dealDamage(null, hoarder, { amount: 4100, type: 'true', sourceless: true });
  const until = b.time + 2.2; while (!b.finished && b.time < until) { clear(); b.step(); }
  const all = b.enemies.filter(e => e.alive && e.defId === ids[0]);
  assert.ok(all.length >= 2, `${all.length} Hoarders`); assert.ok(all.some(e => e.mem.dsdiviSplitMark));
  assert.deepEqual(b.errors, []);
});
