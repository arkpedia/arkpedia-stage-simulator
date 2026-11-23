// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { cityDefenderNative } from '../shared/arkpedia/enemy-city-defender-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const ids = ['enemy_1326_cbagen', 'enemy_1326_cbagen_2'];
const rec = id => records.enemies[id].levels[0];

/** A City Defender blocked by a 3-Block operator at (9,6). */
function fixture(id = ids[0]) {
  const op = chessRec({ id: 'defender-target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: 3 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 180,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec(id)) } },
    units: [{ chessId: op.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  const b = h.b; b.start();
  const [u] = b.allyUnits; b.addBuff(u, { key: 'test:hold', flags: { disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 6] });
  b.addBuff(e, { key: 'test:hold', flags: { noMove: true } });
  e.x = u.x - .3; e.y = u.y; e.tileR = u.tileR; e.tileC = u.tileC; b._checkBlock(e); e.atkCd = 0;
  return { ...h, e, u };
}

test('both variants are admitted only with the tile-dependent Block debuff and the pinned tree', () => {
  for (const id of ids) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    assert.equal(cityDefenderNative(rec(id), nativeComponents(native, id)), true, id);
  }
  for (const change of [
    n => n.templates.enemy_cbagen_t_debuff.eventToActions.ON_BUFF_START[0]._conditionNode._tileKey = ['tile_other'],
    n => n.templates.enemy_cbagen_t_debuff_normal.eventToActions.ON_BUFF_START[0]._formulaType = 'MULTIPLIER',
    n => n.templates.enemy_cbagen_t_debuff_tile.eventToActions.ON_BUFF_START[0]._valueKey = 'normal_block_cnt',
    n => { const row = n.prefabs['dyn/battle/prefabs/enemies/' + ids[0] + '.prefab'].find(r => JSON.parse(r.originalJson)._isSilenceable === 1);
      const d = JSON.parse(row.originalJson); d._isSilenceable = 0; row.originalJson = JSON.stringify(d); },
  ]) { const changed = structuredClone(native); change(changed);
    assert.equal(enemySupport(records.enemies[ids[0]], clocks.prefabs, changed).policy, null); }
  const r = rec(ids[0]);
  assert.equal(cityDefenderNative({ ...r, talents: { ...r.talents, bb: { ...r.talents.bb, 'ReduceBlockCnt.normal_block_cnt': -2 } } },
    nativeComponents(native, ids[0])), false, 'normal_block_cnt');
});

test('each hit takes 1 Block for 3 s; repeated hits extend the one debuff instead of stacking', () => {
  for (const id of ids) {
    const { b, e, u, run } = fixture(id);
    assert.equal(e.blockedBy, u); assert.equal(u.s.blockCnt, 3);
    assert.equal(e.def.attackAnim.dur, Math.fround(1.1333333253860474)); assert.equal(e.def.attackAnim.hit, .5);
    run(.6); assert.ok(e.stats.attacks >= 1); assert.equal(u.s.blockCnt, 2);
    run(4); assert.ok(e.stats.attacks >= 3); assert.equal(u.s.blockCnt, 2, 'still one debuff');
    assert.ok(u.findBuff('cbagen_t_debuff').timeLeft <= 3);
    b.addBuff(e, { key: 'test:disarm', flags: { disarm: true } });
    run(3.1); assert.equal(u.s.blockCnt, 3, 'gone 3 s after the last hit');
    assert.deepEqual(b.errors, []);
  }
});

test('on a Gravity Switch the hit operator has no Block; silence stops the debuff', () => {
  const { b, e, u, run } = fixture();
  const index = u.tileR * b.grid.cols + u.tileC, tile = { ...b.grid.tiles[index], key: 'tile_grvtybtn' };
  b.grid.tiles[index] = tile;
  run(.6); assert.equal(u.s.blockCnt, 0, 'Block x0');
  b.removeBuff(u, 'cbagen_t_debuff'); b.grid.tiles[index] = { ...tile, key: 'tile_road' };
  b.applyStatus(e, 'silence', { duration: 10, source: null });
  run(3); assert.ok(e.stats.attacks >= 2); assert.equal(u.s.blockCnt, 3, 'silenced: no debuff');
  assert.deepEqual(b.errors, []);
});

test('compiled CW-1: the City Defender at its stats takes Block from the operator it hits', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'cw-1'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  let guard = null;
  const clear = () => { for (const e of b.enemies) if (e.alive && e.defId !== ids[0]) b.kill(e); };
  while (!b.finished && b.time < 900 && !guard) { clear(); guard = b.enemies.find(e => e.alive && e.defId === ids[0]); b.step(); }
  assert.ok(guard); assert.equal(guard.s.maxHp, 5800); assert.equal(guard.s.atk, 400);
  b.addBuff(guard, { key: 'hold', persist: true, flags: { noMove: true } });
  b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 99;
  let myrtle = null;
  for (let r = 0; r < stage.geometry.tileGrid.length && !myrtle; r++) for (let c = 0; c < stage.geometry.tileGrid[0].length && !myrtle; c++) {
    try { myrtle = b.deployOperator('char_151_myrtle', r, c, 'RIGHT'); } catch {} }
  assert.ok(myrtle); myrtle.base.maxHp = 1e9; myrtle.markDirty(); myrtle.hp = myrtle.s.maxHp;
  guard.x = myrtle.x - .3; guard.y = myrtle.y; guard.tileR = myrtle.tileR; guard.tileC = myrtle.tileC;
  b._checkBlock(guard); guard.atkCd = 0;
  const before = myrtle.s.blockCnt, until = b.time + 2;
  while (!b.finished && b.time < until) { clear(); b.step(); }
  assert.ok(myrtle.findBuff('cbagen_t_debuff'), 'debuffed'); assert.equal(myrtle.s.blockCnt, Math.max(0, before - 1));
  assert.deepEqual(b.errors, []);
});
