// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { netherseaNative } from '../shared/arkpedia/enemy-nethersea-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const spewers = ['enemy_1233_dsshtr', 'enemy_1233_dsshtr_2'], predators = ['enemy_1231_dsrunr', 'enemy_1231_dsrunr_2'];
const rec = id => records.enemies[id].levels[0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

/** An enemy at (9,6); operators (blockCnt 0 unless given) at [row, col]. */
function fixture(id, positions, { block = 0, hold = true } = {}) {
  const op = chessRec({ id: 'nethersea-target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: block }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec(id)) } },
    units: positions.map(([row, col]) => ({ chessId: op.chessId, row: Math.round(row), col: Math.round(col) })), setup: installEnemyFeatures });
  const b = h.b; b.start();
  const ops = b.allyUnits;
  ops.forEach((u, i) => { b.addBuff(u, { key: 'test:hold', flags: { disarm: true } });
    u.y = positions[i][0]; u.x = positions[i][1]; u.tileR = positions[i][0]; u.tileC = positions[i][1]; });
  const e = b.spawnEnemy(id, { pos: [9, 6] });
  if (hold) b.addBuff(e, { key: 'test:hold', flags: { disarm: false } });
  const brand = (r, c) => { const i = r * b.grid.cols + c; b.grid.tiles[i] = { ...b.grid.tiles[i], key: 'tile_creep' }; };
  const hits = []; b.on('damaged', c => { if (c.source === e) hits.push({ u: c.target, type: c.type, amount: c.amount, element: c.dmg?.element }); });
  return { ...h, e, ops, hits, brand };
}

test('all four are admitted only with their pinned Brand, dodge and Nervous Impairment trees', () => {
  for (const id of [...spewers, ...predators]) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    assert.equal(netherseaNative(rec(id), nativeComponents(native, id)), true, id);
  }
  for (const change of [
    n => n.templates.trap_creep_apply_ep_damage.eventToActions.ON_BUFF_START[0]._elementDamageType = 'FIRE',
    n => n.templates.enemy_dsrunr_blockfree.eventToActions.ON_BUFF_TRIGGER[0]._conditionNode._buffKeys = ['buff_other'],
    n => n.templates.evade.eventToActions.ON_TAKE_DAMAGE[0]._damageMask = 'PHYSICAL',
  ]) { const changed = structuredClone(native); change(changed);
    assert.equal(enemySupport(records.enemies[predators[0]], clocks.prefabs, changed).policy, null); }
  const r = rec(spewers[0]);
  assert.equal(netherseaNative({ ...r, talents: { ...r.talents, bb: { ...r.talents.bb, 'Attack.attack@max_target': 2 } } }, nativeComponents(native, spewers[0])), false);
});

test('Spewer: up to three targets, in its 1.0 reach or on Nethersea Brand anywhere; each hit adds Nervous Impairment', () => {
  for (const id of spewers) {
    const { b, e, run, ops: [nearOp, farOp, brandOp, farOp2], hits, brand } = fixture(id, [[9, 7], [9, 10], [12, 2], [10, 12]]);
    brand(12, 2);
    run(1.5);
    const struck = new Set(hits.filter(x => x.type === 'phys').map(x => x.u));
    assert.ok(struck.has(nearOp) && struck.has(brandOp), 'in reach and on Brand');
    assert.ok(!struck.has(farOp) && !struck.has(farOp2), 'neither in reach nor on Brand');
    const p = hits.find(x => x.type === 'phys' && x.u === nearOp), n = hits.find(x => x.type === 'element' && x.u === nearOp);
    near(p.amount, e.s.atk); assert.equal(n.element, 'neural'); near(n.amount, e.s.atk * rec(id).talents.bb['EpDamage.ep_damage_ratio']);
    assert.deepEqual(b.errors, []);
  }
});

test('Predator: Physical and Arts dodge, off while stunned, silenced or unmovable', () => {
  for (const id of predators) {
    const { b, e, run, ops: [src] } = fixture(id, [[11, 6]]);
    run(.1); const dodge = e.findBuff('dsrunr_evade');
    assert.ok(dodge); near(dodge.mods.dodgePhys, rec(id).talents.bb['Evade.prob']); near(dodge.mods.dodgeArts, rec(id).talents.bb['Evade.prob']);
    b.applyStatus(e, 'stun', { duration: 1, source: null }); run(.05); assert.equal(e.findBuff('dsrunr_evade') ?? null, null, 'stunned');
    run(1.1); assert.ok(e.findBuff('dsrunr_evade'), 'back');
    b.applyStatus(e, 'silence', { duration: 1, source: null }); run(.05); assert.equal(e.findBuff('dsrunr_evade') ?? null, null, 'silenced');
    run(1.1); b.addBuff(e, { key: 'test:root', duration: 1, flags: { noMove: true } }); run(.05);
    assert.equal(e.findBuff('dsrunr_evade') ?? null, null, 'unmovable');
    assert.deepEqual(b.errors, []);
  }
});

test('Predator: block-free on Nethersea Brand, checked every 0.2 s; Nervous Impairment on its hits', () => {
  const id = predators[0];
  const { b, e, run, ops: [blocker], hits, brand } = fixture(id, [[9, 6]], { block: 1 });
  e.x = blocker.x - .3; e.y = blocker.y; e.tileR = blocker.tileR; e.tileC = blocker.tileC; b._checkBlock(e);
  assert.equal(e.blockedBy, blocker); e.atkCd = 0;
  run(1.2); assert.ok(hits.some(x => x.type === 'phys') && hits.some(x => x.element === 'neural'));
  brand(9, 6); run(.25); assert.ok(e.findBuff('dsrunr_blockfree')); assert.equal(e.blockedBy ?? null, null, 'released on Brand');
  const i = 9 * b.grid.cols + 6; b.grid.tiles[i] = { ...b.grid.tiles[i], key: 'tile_road' };
  run(.25); assert.equal(e.findBuff('dsrunr_blockfree') ?? null, null, 'off Brand');
  assert.deepEqual(b.errors, []);
});

test('compiled SN-1 and SN-2: the Spewer and the Predator at their stats', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  for (const [stageId, id, hp, atk] of [['sn-1', spewers[0], 4000, 650], ['sn-2', predators[0], 4000, 450]]) {
    const stage = await loader.load(manifest.stages.find(s => s.id === stageId));
    const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
      { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
    let unit = null;
    const clear = () => { for (const e of b.enemies) if (e.alive && e.defId !== id) b.kill(e); };
    while (!b.finished && b.time < 900 && !unit) { clear(); unit = b.enemies.find(e => e.alive && e.defId === id); b.step(); }
    assert.ok(unit, stageId); assert.equal(unit.s.maxHp, hp); assert.equal(unit.s.atk, atk);
    for (let k = 0; k < 60 && unit.alive && !b.finished; k++) { clear(); b.step(); }
    if (id === predators[0]) assert.ok(unit.findBuff('dsrunr_evade'), 'dodging'); else assert.equal(unit.profile.maxTargets, 3);
    assert.deepEqual(b.errors, []);
  }
});
