// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { crossroadsNative } from '../shared/arkpedia/enemy-crossroads-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const ids = ['enemy_1331_cbsisy', 'enemy_1331_cbsisy_2'];
const rec = id => records.enemies[id].levels[0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

/** A held Crossroads at (9,6); operators placed at [row, col] offsets (blockCnt 0, disarmed). */
function fixture(positions, id = ids[0]) {
  const op = chessRec({ id: 'crossroads-target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: 0 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 180,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec(id)) } },
    units: positions.map((_, i) => ({ chessId: op.chessId, row: 11, col: 1 + i })), setup: installEnemyFeatures });
  const b = h.b; b.start();
  const ops = b.allyUnits;
  ops.forEach((u, i) => { b.addBuff(u, { key: 'test:hold', flags: { disarm: true } });
    u.y = positions[i][0]; u.x = positions[i][1]; u.tileR = Math.round(u.y); u.tileC = Math.round(u.x); });
  const e = b.spawnEnemy(id, { pos: [9, 6] });
  b.addBuff(e, { key: 'test:hold', flags: { noMove: true } });
  const hits = []; b.on('damaged', c => { if (c.source === e) hits.push({ u: c.target, amount: c.amount, type: c.type, tag: c.dmg?.tags?.[0], t: b.time }); });
  return { ...h, e, ops, hits };
}

test('both variants are admitted only with the pinned laser tree', () => {
  for (const id of ids) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    assert.equal(crossroadsNative(rec(id), nativeComponents(native, id)), true, id);
  }
  const prefab = 'dyn/battle/prefabs/enemies/' + ids[0] + '.prefab';
  const edit = (test, change) => n => { const row = n.prefabs[prefab].find(r => test(JSON.parse(r.originalJson)));
    const d = JSON.parse(row.originalJson); change(d); row.originalJson = JSON.stringify(d); };
  for (const change of [
    edit(d => d.m_Radius === Math.fround(.7), d => { d.m_Radius = 1; }),
    edit(d => d._buffs?.[0]?.buffKey === 'enemy_cbsisy_t', d => { d._buffs[0].triggerInterval = 2; }),
    edit(d => d._atkScaleKey === 'CloseAttack', d => { d._damageType = 1; }),
    n => { const rows = n.projectiles?.projectile_enemy_cbsisy ?? Object.values(n.prefabs).flat().filter(() => false);
      const row = rows.find(r => JSON.parse(r.originalJson)._speed === 6); const d = JSON.parse(row.originalJson); d._speed = 8; row.originalJson = JSON.stringify(d); },
  ]) { const changed = structuredClone(native); change(changed);
    assert.equal(enemySupport(records.enemies[ids[0]], clocks.prefabs, changed).policy, null); }
});

test('every second: 100% ATK Arts to ground operators within 0.7, 50% to the first unit each laser meets beyond it', () => {
  for (const id of ids) {
    // close (0.5 right), lane far (1 up), lane far (1 left), out of reach (2 down), off-lane (1,1 diagonal)
    const { b, e, run, ops: [close, up, left, far, diag], hits } = fixture([[9, 6.5], [8, 6], [9, 5], [11, 6], [10, 7]], id);
    assert.equal(e.profile.noAttack, true); assert.equal(e.s.flags.noDisplace, true);
    run(.5);
    const first = hits.filter(x => x.t <= .5);
    assert.deepEqual(new Set(first.map(x => x.u)), new Set([close, up, left]));
    for (const x of first) assert.equal(x.type, 'arts');
    const amount = u => first.filter(x => x.u === u).reduce((s, x) => s + x.amount, 0);
    near(amount(close), e.s.atk);
    near(amount(up), e.s.atk * .5); near(amount(left), e.s.atk * .5);
    assert.ok(!hits.some(x => x.u === far || x.u === diag), 'out of reach and off the lanes');
    const before = hits.length; run(1); assert.equal(hits.length, before + 3, 'one volley per second');
    assert.deepEqual(b.errors, []);
  }
});

test('a laser stops at the first unit in its lane', () => {
  const { b, run, ops: [front, back], hits } = fixture([[9, 6.9], [9, 7.15]]);
  run(.5); assert.equal(hits.filter(x => x.u === front).length, 1); assert.equal(hits.filter(x => x.u === back).length, 0);
  assert.deepEqual(b.errors, []);
});

test('compiled CW-6: the Production Model at its stats burns an operator next to it', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'cw-6'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  let car = null;
  const clear = () => { for (const e of b.enemies) if (e.alive && e.defId !== ids[0]) b.kill(e); };
  while (!b.finished && b.time < 900 && !car) { clear(); car = b.enemies.find(e => e.alive && e.defId === ids[0]); b.step(); }
  assert.ok(car); assert.equal(car.s.maxHp, 15000); assert.equal(car.s.atk, 190);
  b.addBuff(car, { key: 'hold', persist: true, flags: { noMove: true } });
  b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 99;
  let myrtle = null;
  for (let r = 0; r < stage.geometry.tileGrid.length && !myrtle; r++) for (let c = 0; c < stage.geometry.tileGrid[0].length && !myrtle; c++) {
    try { myrtle = b.deployOperator('char_151_myrtle', r, c, 'RIGHT'); } catch {} }
  assert.ok(myrtle); myrtle.base.maxHp = 1e9; myrtle.markDirty(); myrtle.hp = myrtle.s.maxHp;
  car.x = myrtle.x - .5; car.y = myrtle.y;
  const hits = []; b.on('damaged', c => { if (c.source === car && c.target === myrtle) hits.push(c.dmg?.tags?.[0]); });
  const until = b.time + 2.1; while (!b.finished && b.time < until) { clear(); b.step(); }
  assert.ok(hits.filter(t => t === 'crossroadsClose').length >= 2, hits.join());
  assert.deepEqual(b.errors, []);
});
