// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { spawnAny } from './helpers/enemyHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { basorobeastNative } from '../shared/arkpedia/enemy-basorobeast-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const ids = ['enemy_1307_mhrhcr', 'enemy_1307_mhrhcr_2'];
const rec = id => records.enemies[id].levels[0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

function fixture(id = ids[0]) {
  const op = chessRec({ id: 'robeast-target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: 1 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 180,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec(id)) } },
    units: [[9, 3], [10, 8]].map(([row, col]) => ({ chessId: op.chessId, row, col })), setup: installEnemyFeatures });
  h.b.start(); const b = h.b, e = b.spawnEnemy(id, { pos: [9, 6] });
  b.addBuff(e, { key: 'test:hold', flags: { noMove: true } });
  for (const u of b.allyUnits) b.addBuff(u, { key: 'test:hold', flags: { disarm: true } });
  return { ...h, e, targets: b.allyUnits };
}

test('both variants are admitted only with the Weakness DamageScale, its front test and the pinned tree', () => {
  for (const id of ids) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    assert.equal(basorobeastNative(rec(id), nativeComponents(native, id)), true, id);
  }
  for (const change of [
    n => n.templates.enemy_mhrhcr_weakness.eventToActions.ON_TAKE_DAMAGE[0]._faceType = 'BACK',
    n => n.templates.enemy_mhrhcr_weakness.eventToActions.ON_TAKE_DAMAGE[0]._faceIfSameCol = 'FRONT',
    n => n.templates.enemy_mhrhcr_weakness.eventToActions.ON_TAKE_DAMAGE[1]._damageMask = 'ALL',
    n => n.templates.enemy_mhrhcr_weakness.eventToActions.ON_TAKE_DAMAGE[1]._isOneMinus = false,
    n => { const row = n.prefabs['dyn/battle/prefabs/enemies/' + ids[0] + '.prefab']
      .find(r => JSON.parse(r.originalJson)._faceToTarget === 1);
      const d = JSON.parse(row.originalJson); d._faceToTarget = 0; row.originalJson = JSON.stringify(d); },
  ]) { const changed = structuredClone(native); change(changed);
    assert.equal(enemySupport(records.enemies[ids[0]], clocks.prefabs, changed).policy, null); }
  const r = rec(ids[0]);
  assert.equal(basorobeastNative({ ...r, talents: { ...r.talents, bb: { ...r.talents.bb, 'Weakness.damage_resistance': .5 } } },
    nativeComponents(native, ids[0])), false, 'damage_resistance');
});

test('Physical and Arts damage from a source in a column ahead of its facing is cut by 80%; same column, rear, True and sourceless are not', () => {
  for (const id of ids) {
    const { b, e, targets: [u] } = fixture(id);
    assert.equal(e.hp, rec(id).stats.maxHp);
    assert.equal(e.def.attackAnim.dur, Math.fround(1.3333333730697632)); assert.equal(e.def.attackAnim.hit, .5);
    const def = rec(id).stats.def;
    e.x = 6.2; e.mem.nativeFacing = 1;
    const hit = (x, type = 'arts', sourceless = false) => { u.x = x; const hp = e.hp;
      b.dealDamage(u, e, { amount: 1000, type, sourceless }); return hp - e.hp; };
    near(hit(7), 200); near(hit(7, 'phys'), (1000 - def) * .2);
    near(hit(6.4), 1000, 'same column'); near(hit(5), 1000); near(hit(7, 'true'), 1000); near(hit(7, 'arts', true), 1000);
    e.mem.nativeFacing = -1; near(hit(5), 200); near(hit(7), 1000);
    b.applyStatus(e, 'sanctuary', { value: .5, key: 'test:ordinary' });
    near(hit(5), 200, 'the stronger channel only'); near(hit(7), 500);
    assert.deepEqual(b.errors, []);
  }
});

test('walking left into the harness guard it faces left, and the guard it faces hits for a fifth', () => {
  // The harness route walks from column 10 to column 2 along row 9; the guard stands at column 6.
  const h = spawnAny(ids[0], { autoFinish: false, seconds: .02 }), { b } = h, e = b.units.find(u => u.defId === ids[0]);
  const x0 = e.x, guard = b.allyUnits[0], hits = [];
  assert.equal(e.mem.nativeFacing, -1, 'faces its first horizontal leg before moving');
  b.on('damaged', c => { if (c.target === e && c.source === guard) hits.push(c.amount); });
  let x = e.x, last = e.mem.nativeFacing;
  for (let i = 0; i < 400 && e.alive; i++) {
    h.run(.05);
    const dx = e.x - x; x = e.x;
    if (e.moving && Math.abs(dx) > 1e-6) assert.equal(e.mem.nativeFacing, Math.sign(dx));
    else assert.equal(e.mem.nativeFacing, last, 'no horizontal step, no turn');
    last = e.mem.nativeFacing;
  }
  assert.ok(x0 - e.x > 3, 'it walked left'); assert.equal(e.blockedBy, guard); assert.equal(e.mem.nativeFacing, -1);
  assert.ok(hits.length > 3); for (const amount of hits) near(amount, (400 - rec(ids[0]).stats.def) * .2);
  assert.deepEqual(b.errors, []);
});

test('blocked, it turns to the blocker it attacks', () => {
  const { b, e, run, targets: [, right] } = fixture();
  e.mem.nativeFacing = -1;
  e.x = right.x - .3; e.y = right.y; e.tileR = right.tileR; e.tileC = right.tileC;
  b._checkBlock(e); assert.equal(e.blockedBy, right); e.atkCd = 0;
  const hp = right.hp; run(1); assert.ok(right.hp < hp, 'it attacks'); assert.equal(e.mem.nativeFacing, 1);
  assert.deepEqual(b.errors, []);
});

async function compiled(stageId) {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === stageId));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  let beast = null;
  while (!b.finished && b.time < 900 && !beast) { beast = b.enemies.find(e => e.alive && e.defId === ids[0]); b.step(); }
  assert.ok(beast, `${ids[0]} in ${stageId}`);
  return { b, beast };
}

test('compiled TG-7 and its Challenge: Basorobeast at the stage stats with the front guard', async () => {
  for (const [stageId, hp, atk] of [['tg-7', 12000, 600], ['tg-7_challenge_mode', 14400, 720]]) {
    const { b, beast } = await compiled(stageId);
    assert.equal(beast.s.maxHp, hp); assert.equal(beast.s.atk, atk);
    assert.ok(beast.buffs.some(x => x.data?.frontSourceSanctuary === .8), stageId);
    assert.ok(beast.mem.nativeFacing === 1 || beast.mem.nativeFacing === -1);
    assert.equal(b.finished, false); assert.deepEqual(b.errors, []);
  }
});
