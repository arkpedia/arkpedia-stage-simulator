// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { fieldmusNative, fieldmusParams } from '../shared/arkpedia/enemy-fieldmus-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const ids = ['enemy_1395_dhxts', 'enemy_1395_dhxts_2'];
const rec = id => records.enemies[id].levels[0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const INVIS = 'enemy_dhxts_passive[invis]';

/** One held Fieldmus at row 9, col 6; two disarmed operators at (9,3) and (10,8); a settable Blight. */
function fixture(id = ids[0]) {
  const op = chessRec({ id: 'fieldmus-target', stats: { maxHp: 1e5, atk: 0, def: 0, res: 0, blockCnt: 1 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 180,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(rec(id)) } },
    units: [[9, 3], [10, 8]].map(([row, col]) => ({ chessId: op.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start();
  const blight = { on: false };
  b.environmentConditions = { test: (condition, u) => condition === 'act31SidePollute' && blight.on && u.side === 'enemy' };
  const e = b.spawnEnemy(id, { pos: [9, 6] });
  b.addBuff(e, { key: 'test:hold', flags: { noMove: true } });
  for (const u of b.allyUnits) b.addBuff(u, { key: 'test:hold', flags: { disarm: true } });
  return { ...h, e, blight, targets: b.allyUnits };
}

test('both variants are admitted only with the valve skill, the Blight passive and the pinned tree', () => {
  for (const id of ids) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    assert.equal(fieldmusNative(rec(id), nativeComponents(native, id)), true, id);
  }
  for (const change of [
    n => n.templates.enemy_dhxts_hit_tl.eventToActions.ON_BUFF_START[0]._damageType = 'PHYSICAL',
    n => n.templates.enemy_dhxts_hit_tl.eventToActions.ON_BUFF_START[0]._getMaxHpFromTarget = true,
    n => n.templates.enemy_dhxts_passive.eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[4]._buff.attributes.abnormalFlags = ['CAMOUFLAGE'],
    n => n.templates.enemy_dhxts_passive.eventToActions.ON_OWNER_BLOCKEE_CHANGED.pop(),
    n => { const row = n.prefabs['dyn/battle/prefabs/enemies/' + ids[0] + '.prefab'].find(r => JSON.parse(r.originalJson)._filterTag === 'trap_dhtl');
      const d = JSON.parse(row.originalJson); d._filterTag = 'trap_other'; row.originalJson = JSON.stringify(d); },
    n => { const row = n.prefabs['dyn/battle/prefabs/enemies/' + ids[0] + '.prefab'].find(r => JSON.parse(r.originalJson).m_Radius === .5);
      const d = JSON.parse(row.originalJson); d.m_Radius = 1; row.originalJson = JSON.stringify(d); },
  ]) { const changed = structuredClone(native); change(changed);
    assert.equal(enemySupport(records.enemies[ids[0]], clocks.prefabs, changed).policy, null); }
  const r = rec(ids[0]);
  assert.equal(fieldmusNative({ ...r, skills: [{ ...r.skills[0], bb: { hp_ratio: .05 } }] }, nativeComponents(native, ids[0])), false, 'hp_ratio');
});

test('on a Blighted tile and unblocked it turns Invisible at its next 1 s check; off the Blight it is visible again at the following one', () => {
  const { b, e, blight, run } = fixture();
  assert.equal(e.def.attackAnim.dur, Math.fround(1.100000023841858));
  run(.05); assert.equal(e.findBuff(INVIS) ?? null, null, 'no Blight, no stealth');
  blight.on = true; run(.9); assert.equal(e.findBuff(INVIS) ?? null, null, 'not before the next 1 s check');
  run(.1); assert.ok(e.findBuff(INVIS)?.flags?.stealth, 'Invisible');
  blight.on = false; run(.85); assert.ok(e.findBuff(INVIS), 'kept until the next check');
  run(.2); assert.equal(e.findBuff(INVIS) ?? null, null);
  assert.deepEqual(b.errors, []);
});

test('blocking ends the Invisibility at once, and it does not return while blocked', () => {
  const { b, e, blight, run, targets: [, right] } = fixture();
  blight.on = true; run(.05); assert.ok(e.findBuff(INVIS));
  e.x = right.x - .3; e.y = right.y; e.tileR = right.tileR; e.tileC = right.tileC;
  b._checkBlock(e); assert.equal(e.blockedBy, right);
  run(.02); assert.equal(e.findBuff(INVIS) ?? null, null, 'removed on block');
  run(2.1); assert.equal(e.findBuff(INVIS) ?? null, null, 'not while blocked');
  b._unblock(e); e.x = 6; e.y = 9; e.tileR = 9; e.tileC = 6;
  run(1.05); assert.ok(e.findBuff(INVIS), 'back at the next check once free');
  assert.deepEqual(b.errors, []);
});

test('a Throttle Valve within 0.5 is chipped for hp_ratio of its own max HP, Pure, once per 1.1 s Attack clip; nothing else is', () => {
  for (const id of ids) {
    const { b, e, run, targets: [far, valve] } = fixture(id), p = fieldmusParams(rec(id));
    const hits = []; b.on('damaged', c => { if (c.source === e) hits.push({ target: c.target, amount: c.amount, type: c.dmg?.type }); });
    run(1); assert.deepEqual(hits, [], 'no valve, no TL');
    valve.tags.add('trap_dhtl'); valve.x = e.x + .4; valve.y = e.y;
    far.tags.add('trap_dhtl'); far.x = e.x - 2; far.y = e.y;
    run(p.valve.anim.hit + .1);
    assert.equal(hits.length, 1); assert.equal(hits[0].target, valve); assert.equal(hits[0].type, 'true');
    near(hits[0].amount, valve.s.maxHp * p.valve.ratio);
    assert.equal(e.profile.noAttack, true, 'no ordinary attack during the cast');
    run(p.valve.anim.dur * 2);
    assert.ok(hits.length >= 2 && hits.length <= 3, `${hits.length} casts`); assert.ok(hits.every(x => x.target === valve));
    assert.deepEqual(b.errors, []);
  }
});

async function compiled(stageId, id) {
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
  let rat = null;
  while (!b.finished && b.time < 900 && !rat) { rat = b.enemies.find(e => e.alive && e.defId === id); b.step(); }
  assert.ok(rat, `${id} in ${stageId}`);
  return { b, rat };
}

test('compiled VEC-SP04 and VEC-SP05: Hard-Snouted Fieldmus at its stats, visible (no Blight) and never casting (no valves)', async () => {
  for (const stageId of ['vec-sp04_act1break_sp04', 'vec-sp05_act1break_sp05']) {
    const { b, rat } = await compiled(stageId, ids[1]);
    assert.equal(rat.s.maxHp, 2200); assert.equal(rat.s.atk, 250);
    for (let i = 0; i < 120 && rat.alive && !b.finished; i++) b.step();
    assert.equal(rat.findBuff(INVIS) ?? null, null); assert.equal(rat.findBuff('ab:fieldmusValveCast') ?? null, null);
    assert.deepEqual(b.errors, []);
  }
});
