// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { cleanupSquadNative, cleanupSquadParams } from '../shared/arkpedia/enemy-cleanup-squad-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const ids = ['enemy_1183_mlasrt', 'enemy_1183_mlasrt_2', 'enemy_1183_mlasrt_3'];
const rec = (id, level = 0) => records.enemies[id].levels[level];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

function fixture(id = ids[0], level = 0) {
  const op = chessRec({ id: 'squad-target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: 0 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 180,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec(id, level)) } },
    units: [{ chessId: op.chessId, row: 9, col: 3 }], setup: installEnemyFeatures });
  const b = h.b; b.start();
  const [u] = b.allyUnits; b.addBuff(u, { key: 'test:hold', flags: { disarm: true } });
  const e = b.spawnEnemy(id, { pos: [9, 8] });
  b.addBuff(e, { key: 'test:hold', flags: { noMove: true } });
  const hits = []; b.on('damaged', c => { if (c.source === e && c.target === u) hits.push({ type: c.type, amount: c.amount, element: c.dmg?.element, t: b.time }); });
  return { ...h, e, u, hits };
}

test('every variant and level is admitted only with its SP power shot and the pinned tree; the Cannoneer keeps its own', () => {
  for (const id of ids) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    for (const level of Object.keys(records.enemies[id].levels)) assert.equal(cleanupSquadNative(rec(id, level), nativeComponents(native, id)), true, `${id}/${level}`);
  }
  assert.equal(enemySupport(records.enemies.enemy_1289_dubmb, clocks.prefabs, native).policy, 'stats-attacks-and-features');
  const r = rec(ids[0]);
  assert.equal(cleanupSquadNative({ ...r, skills: [{ ...r.skills[0], spCost: 2 }] }, nativeComponents(native, ids[0])), false, 'cost');
  assert.equal(cleanupSquadNative({ ...r, skills: [{ ...r.skills[0], bb: { ...r.skills[0].bb, atk_scale: 2 } }] }, nativeComponents(native, ids[0])), false, 'scale');
  const changed = structuredClone(native);
  const row = changed.projectiles.projectile_enemy_mlasrt_s.find(x => JSON.parse(x.originalJson)._speed === 10);
  const d = JSON.parse(row.originalJson); d._speed = 5; row.originalJson = JSON.stringify(d);
  assert.equal(enemySupport(records.enemies[ids[0]], clocks.prefabs, changed).policy, null, 'power projectile');
});

test('three ordinary shots, then a 1.5x ATK power shot on the Skill clip; each hit adds 35% ATK Corrosion', () => {
  for (const id of ids) {
    const { b, e, run, hits } = fixture(id), p = cleanupSquadParams(rec(id));
    assert.deepEqual(e.def.attackAnim, p.attackAnim);
    // The first shot leaves at once (t 0, 5, 10, then the fourth at 15).
    run(3 * 5 - 1); assert.deepEqual(e.def.attackAnim, p.skillAnim, 'the fourth shot stands for the Skill clip');
    run(5 + 3);
    const phys = hits.filter(x => x.type === 'phys'), corrosion = hits.filter(x => x.type === 'element');
    assert.ok(phys.length >= 4, `${phys.length} shots`);
    for (const [i, x] of phys.slice(0, 4).entries()) near(x.amount, e.s.atk * (i === 3 ? p.scale : 1));
    assert.ok(corrosion.length >= 4 && corrosion.every(x => x.element === 'erosion'));
    near(corrosion[0].amount, e.s.atk * .35);
    assert.deepEqual(e.def.attackAnim, p.attackAnim, 'back to the Attack clip after the power shot');
    assert.deepEqual(b.errors, []);
  }
});

test('silence keeps the charge: a silenced Squad fires ordinary shots and powers the next attack once free', () => {
  const { b, e, run, hits } = fixture(), p = cleanupSquadParams(rec(ids[0]));
  run(3 * 5 - 4); assert.equal(hits.filter(x => x.type === 'phys').length, 3);
  b.applyStatus(e, 'silence', { duration: 6, source: null });
  run(5); const silenced = hits.filter(x => x.type === 'phys')[3]; near(silenced.amount, e.s.atk);
  run(6); const next = hits.filter(x => x.type === 'phys')[4]; assert.ok(next); near(next.amount, e.s.atk * p.scale);
  assert.deepEqual(b.errors, []);
});

test('compiled AW-S-1 (Lazurite, Roy at level 1) and VEC-SP03 (the Leader): stage stats and both damage types', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  for (const [stageId, id, hp, atk] of [['aw-s-1', ids[2], 15000, 1000], ['vec-sp03_act1break_sp03', ids[1], 8000, 800]]) {
    const stage = await loader.load(manifest.stages.find(s => s.id === stageId));
    const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
      { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
    let squad = null;
    const clear = () => { for (const e of b.enemies) if (e.alive && e.defId !== id) b.kill(e); };
    while (!b.finished && b.time < 900 && !squad) { clear(); squad = b.enemies.find(e => e.alive && e.defId === id); b.step(); }
    assert.ok(squad, stageId); assert.equal(squad.s.maxHp, hp); assert.equal(squad.s.atk, atk);
    assert.ok(squad.mem.ab.list.some(a => 'charge' in a), 'the SP power-shot account is installed');
    // AW-S-1 fields a fixed squad (Myrtle is unavailable there): its stats and the installed account suffice.
    if (stageId === 'aw-s-1') { assert.deepEqual(b.errors, []); continue; }
    b.addBuff(squad, { key: 'hold', persist: true, flags: { noMove: true } });
    b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 99;
    let myrtle = null;
    for (let r = 0; r < stage.geometry.tileGrid.length && !myrtle; r++) for (let c = 0; c < stage.geometry.tileGrid[0].length && !myrtle; c++) {
      try { myrtle = b.deployOperator('char_151_myrtle', r, c, 'RIGHT'); } catch {} }
    assert.ok(myrtle); myrtle.base.maxHp = 1e9; myrtle.markDirty(); myrtle.hp = myrtle.s.maxHp;
    const hits = []; b.on('damaged', c => { if (c.source === squad && c.target === myrtle) hits.push(c.type); });
    const until = b.time + 8; while (!b.finished && b.time < until) { clear(); b.step(); }
    assert.ok(hits.includes('phys') && hits.includes('element'), `${stageId}: ${hits.join()}`);
    assert.deepEqual(b.errors, []);
  }
});
