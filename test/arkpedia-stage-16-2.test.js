// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 16: the Miner Guerrilla and the pollution system where a level leaves it idle (16-2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import environments from '../data/arkpedia-environment-native-source.json' with { type: 'json' };
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { MINER_GUERRILLA, minerGuerrillaNative, minerGuerrillaParams } from '../shared/arkpedia/enemy-miner-guerrilla-features.js';
import { mainline16NativeReviewed, mainline16Inert, MAINLINE16_SYSTEM } from '../shared/arkpedia/stage-mainline16.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { COLS } from '../server/sim/constants.js';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url)));
const manifest = await read('../data/arkpedia-library.json'), evidence = await read('../data/arkpedia-enemy-native-abilities.json');
const records = (await read('../data/arkpedia-enemy-records.json')).enemies, support = await read('../data/arkpedia-enemy-support.json');
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const clone = v => JSON.parse(JSON.stringify(v));
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const open = async (id, operators = ['char_151_myrtle']) => {
  const entry = manifest.stages.find(s => s.id === id); assert.equal(entry.availability, 'available', id);
  const stage = await loader.load(entry);
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: operators.map(k => defaultBuild(mvp.operators[k])) }, { seed: 1 });
  const life = b.life; b.life = 999;
  return { b, stage, life };
};
const miners = b => b.neutralUnits.filter(u => u.alive && u.def?.key === MINER_GUERRILLA);
const strike = (b, unit, amount) => b.dealDamage(null, unit, { amount, type: 'true', applyWay: 'none', tags: ['test'] });

test('the Miner Guerrilla and the pollution system are reviewed; a level with pollution sources is refused', () => {
  const level = Object.values(records[MINER_GUERRILLA].levels)[0], view = nativeComponents(evidence, MINER_GUERRILLA);
  assert.equal(minerGuerrillaNative(level, view), true);
  assert.equal(support.enemies[MINER_GUERRILLA].policy, 'stats-attacks-and-features');
  const other = clone(level); other.talents.bb['GetHeal.heal_scale'] = 0;
  assert.equal(minerGuerrillaNative(other, view), false);
  const p = minerGuerrillaParams(level);
  assert.deepEqual([p.radius, p.heal, p.fear, p.clear.duration], [1, { interval: 1, scale: .5 }, { interval: 1, damage: 200 }, 3]);
  assert.equal(mainline16NativeReviewed(), true);
  const e = clone(environments); e.envSystems[MAINLINE16_SYSTEM].find(r => '_tileInside' in r.data).data._tileInside = 'x';
  assert.equal(mainline16NativeReviewed(e), false);
  const plain = { enemyDbRefs: [{ id: 'enemy_1107_uoffcr' }, { id: MINER_GUERRILLA }], waves: [], predefines: {}, mapData: { tiles: [{ tileKey: 'tile_road' }] } };
  assert.equal(mainline16Inert(plain), true);
  assert.equal(mainline16Inert({ ...plain, predefines: { tokenInsts: [{ inst: { characterKey: 'trap_271_fowstn' } }] } }), false);
  assert.equal(mainline16Inert({ ...plain, enemyDbRefs: [{ id: 'enemy_10120_uaghst' }] }), false);
  for (const id of ['16-3', '16-9', 'tr-27']) assert.equal(manifest.stages.find(s => s.id === id).availability, 'blocked', id);
});

test('16-2: eight Miner Guerrillas walk through as neutral units; they are not counted and their exit costs nothing', async () => {
  const { b, stage } = await open('16-2');
  assert.equal(stage.rules.mainline16, true);
  const seen = new Set(); let exits = 0;
  b.on('enemySpawn', ({ enemy }) => { if (enemy.def?.key === MINER_GUERRILLA) seen.add(enemy); });
  b.on('enemyLeak', ({ enemy }) => { if (seen.has(enemy)) exits++; });
  assert.ok(until(b, () => seen.size >= 6, 20));
  const m = [...seen][0];
  assert.deepEqual([m.side, m.counted, m.profile.holdsBattle, m.s.tauntLevel ?? m.base.tauntLevel, !!m.s.flags.unblockable, m.profile.noAttack, m.s.maxHp, m.s.atk],
    ['neutral', false, false, -1, true, true, 3000, 500]);
  const life = b.life;
  until(b, () => b.finished, 400);
  assert.deepEqual([seen.size, (b.errors ?? []).length, b.total], [8, 0, 34]);
  assert.ok(exits >= 1 && b.life <= life, `${exits}`);
});

test('a Miner Guerrilla strikes an enemy within 1 tile for its ATK every 3 s, and stands while it swings', async () => {
  const { b } = await open('16-2');
  assert.ok(until(b, () => miners(b).length >= 1, 20));
  const m = miners(b)[0];
  const foe = b.spawnEnemy('enemy_1107_uoffcr', { pos: [m.y, m.x + .5], countInTotal: false, route: { start: [Math.round(m.y), Math.round(m.x)], steps: [{ t: 'wait', s: 1e9 }] } });
  foe.base.maxHp = 1e6; foe.base.def = 0; foe.base.atk = 0; foe.markDirty(); foe.hp = foe.s.maxHp;
  b.addBuff(foe, { key: 'test:still', persist: true, flags: { noMove: true, disarm: true } });
  b.addBuff(m, { key: 'test:hold', persist: true, flags: { noMove: true } });
  const hits = [];
  b.on('damaged', c => { if (c.source === m && c.target === foe) hits.push([b.time, c.type, c.amount]); });
  until(b, () => hits.length >= 2, b.time + 12);
  assert.ok(hits.length >= 2, `${hits.length}`);
  assert.deepEqual(hits.slice(0, 2).map(h => [h[1], h[2]]), [['phys', 500], ['phys', 500]]);
  assert.ok(Math.abs(hits[1][0] - hits[0][0] - 3) < .2, `${hits[1][0] - hits[0][0]}`);
});

test('a Medic whose range covers it heals it once a second for half her ATK; out of range she does not', async () => {
  const medic = Object.keys(mvp.operators).find(k => mvp.operators[k].profession === 'MEDIC');
  assert.ok(medic, 'a Medic in the roster');
  const { b } = await open('16-2', [medic, 'char_151_myrtle']);
  assert.ok(until(b, () => miners(b).length >= 1, 20));
  const m = miners(b)[0];
  b.addBuff(m, { key: 'test:hold', persist: true, flags: { noMove: true } });
  // Put the Medic on any tile from which her range covers the miner.
  let healer = null;
  outer: for (let r = 0; r < b.grid.rows; r++) for (let c = 0; c < b.grid.cols; c++) for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    let u = null;
    try { u = b._deployOperator(medic, r, c, dir, { fromSkill: true, predefined: true }); } catch { continue; }
    if ((u.rangeKeySet ?? new Set(u.rangeKeys)).has(Math.round(m.y) * COLS + Math.round(m.x))) { healer = u; break outer; }
    b.retreat(u, { reason: 'withdraw', permanent: false }); b.bench[medic].readyAt = 0;
  }
  assert.ok(healer, 'a tile from which the Medic reaches the miner');
  healer.profile.noAttack = true; // only the miner's own talent heals in this test
  strike(b, m, 2000);
  const hp0 = m.hp, heals = [];
  b.on('healed', c => { if (c.target === m) heals.push([b.time, c.amount]); });
  const t0 = b.time;
  until(b, () => b.time >= t0 + 3.05, t0 + 4);
  const gained = m.hp - hp0, per = healer.s.atk * .5;
  assert.ok(Math.abs(gained - 3 * per) < per * .5 + 1, `${gained} vs ${3 * per}`);
  b.retreat(healer, { reason: 'withdraw', permanent: true });
  const hp1 = m.hp, t1 = b.time;
  until(b, () => b.time >= t1 + 3, t1 + 4);
  assert.equal(m.hp, hp1, 'no Medic in range, no healing');
});

test('while feared it loses 200 HP to true damage each second', async () => {
  const { b } = await open('16-2');
  assert.ok(until(b, () => miners(b).length >= 1, 20));
  const m = miners(b)[0], hp = m.hp, t0 = b.time;
  b.addBuff(m, { key: 'fear', duration: 3.2, flags: { fear: true } });
  until(b, () => b.time >= t0 + 3.1, t0 + 4);
  assert.equal(hp - m.hp, 600);
  const hp1 = m.hp, t1 = b.time;
  until(b, () => b.time >= t1 + 2, t1 + 3);
  assert.equal(m.hp, hp1, 'the damage stops with the fear');
});

test('six-star 16-2 and CG-3, which also use the Miner Guerrilla, run to the end without errors', async () => {
  const six = await open('16-2_six_star');
  assert.deepEqual([six.life, six.stage.enemies[MINER_GUERRILLA].stats.maxHp], [1, 1800]);
  for (const id of ['16-2_six_star', 'cg-3', 'cg-3_challenge_mode']) {
    const { b } = await open(id);
    const seen = new Set(); b.on('enemySpawn', ({ enemy }) => { if (enemy.def?.key === MINER_GUERRILLA) seen.add(enemy); });
    until(b, () => b.finished, 500);
    assert.ok(seen.size >= 3 && (b.errors ?? []).length === 0 && b.finished, `${id}: ${seen.size} ${(b.errors ?? []).length} ${b.reason}`);
  }
});
