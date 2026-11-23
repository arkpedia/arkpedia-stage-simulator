// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { drifterNative, drifterParams } from '../shared/arkpedia/enemy-drifter-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { sortAllyTargets } from '../server/sim/targeting.js';

const ids = ['enemy_1435_dsflys', 'enemy_1435_dsflys_2'];
const rec = id => records.enemies[id].levels[0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

/** A held Drifter at (9,6); operators at (9,8) and (10,7), both within its 2.5 range. */
function fixture(id = ids[0]) {
  const op = chessRec({ id: 'drifter-target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: 0 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 180,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec(id)) } },
    units: [[9, 8], [10, 7]].map(([row, col]) => ({ chessId: op.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start();
  for (const u of b.allyUnits) b.addBuff(u, { key: 'test:hold', flags: { disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 6] });
  b.addBuff(e, { key: 'test:hold', flags: { noMove: true } });
  return { ...h, e, ops: b.allyUnits };
}

test('both variants are admitted only with the neural projectile attack, unbalance immunity and the pinned tree', () => {
  for (const id of ids) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    assert.equal(drifterNative(rec(id), nativeComponents(native, id)), true, id);
  }
  const prefab = 'dyn/battle/prefabs/enemies/' + ids[0] + '.prefab';
  const edit = (test, change) => n => { const row = n.prefabs[prefab].find(r => test(JSON.parse(r.originalJson)));
    const d = JSON.parse(row.originalJson); change(d); row.originalJson = JSON.stringify(d); };
  for (const change of [
    edit(d => d._elementDamageType === 1, d => { d._elementDamageType = 2; }),
    edit(d => d._projectileKey === 'projectile_enemy_dsflys', d => { d._damageType = 2; }),
    edit(d => d._postFilter === 52, d => { d._postFilter = 4; }),
    edit(d => d._buffs?.[0]?.buffKey === 'dsflys_immune', d => { d._buffs[0].attributes.abnormalFlags = [6]; }),
  ]) { const changed = structuredClone(native); change(changed);
    assert.equal(enemySupport(records.enemies[ids[0]], clocks.prefabs, changed).policy, null); }
  const r = rec(ids[0]);
  assert.equal(drifterNative({ ...r, talents: { ...r.talents, bb: { '0.attack@ep_damage_ratio': .3 } } }, nativeComponents(native, ids[0])), false);
});

test('each shot deals Physical ATK and ATK x 0.15 Nervous Impairment, at the 1.83 s clip event', () => {
  for (const id of ids) {
    const { b, e, run, ops: [target] } = fixture(id), p = drifterParams(rec(id));
    const hits = []; b.on('damaged', c => { if (c.source === e) hits.push({ target: c.target, type: c.type, amount: c.amount, element: c.dmg?.element }); });
    run(p.animation.releases[0] + .5);
    const phys = hits.filter(x => x.type === 'phys'), neural = hits.filter(x => x.type === 'element');
    assert.equal(phys.length, 1); near(phys[0].amount, e.s.atk);
    assert.equal(neural.length, 1); assert.equal(neural[0].element, 'neural'); near(neural[0].amount, e.s.atk * .15);
    assert.ok(target === phys[0].target || hits.every(x => x.target === phys[0].target));
    assert.equal(e.s.flags.noDisplace, true, 'UNBALANCE_IMMUNE'); assert.equal(e.isFlying, true);
    assert.deepEqual(b.errors, []);
  }
});

test('an operator on high ground comes first, then the ordinary order', () => {
  const { b, e, ops: [a, c] } = fixture();
  const order = () => sortAllyTargets(e, [a, c]);
  const first = order()[0], other = first === a ? c : a;
  b.grid.tiles[other.tileR * b.grid.cols + other.tileC] = { ...b.grid.tile(other.tileR, other.tileC), height: 'HIGH', build: 'RANGED' };
  assert.equal(order()[0], other, 'high ground first');
  assert.deepEqual(b.errors, []);
});

test('compiled BP-1: the Toxocellular Drifter at its stats shoots the deployed operator', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'bp-1'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  let drifter = null;
  const clear = () => { for (const e of b.enemies) if (e.alive && e.defId !== ids[0]) b.kill(e); };
  while (!b.finished && b.time < 900 && !drifter) { clear(); drifter = b.enemies.find(e => e.alive && e.defId === ids[0]); b.step(); }
  assert.ok(drifter); assert.equal(drifter.s.maxHp, 5100); assert.equal(drifter.s.atk, 300);
  b.addBuff(drifter, { key: 'hold', persist: true, flags: { noMove: true } });
  b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 99;
  let myrtle = null;
  for (let r = 0; r < stage.geometry.tileGrid.length && !myrtle; r++) for (let c = 0; c < stage.geometry.tileGrid[0].length && !myrtle; c++) {
    try { myrtle = b.deployOperator('char_151_myrtle', r, c, 'RIGHT'); } catch {} }
  assert.ok(myrtle); myrtle.base.maxHp = 1e9; myrtle.markDirty(); myrtle.hp = myrtle.s.maxHp;
  drifter.x = myrtle.x - 1.5; drifter.y = myrtle.y;
  const hits = []; b.on('damaged', c => { if (c.source === drifter && c.target === myrtle) hits.push(c.type); });
  const until = b.time + 4; while (!b.finished && b.time < until) { clear(); b.step(); }
  assert.ok(hits.includes('phys') && hits.includes('element'), hits.join());
  assert.deepEqual(b.errors, []);
});
