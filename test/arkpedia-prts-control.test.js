// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 15: the PRTS control system (shared/arkpedia/stage-prts-control.js), accepted only where it has nothing to do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import environments from '../data/arkpedia-environment-native-source.json' with { type: 'json' };
import { prtsControlNativeReviewed, compilePrtsControlRule, prtsControlInert, PRTS_CONTROL_SYSTEM, PRTS_INTRUSIVE_CALL,
  PRTS_DRAG_TILE } from '../shared/arkpedia/stage-prts-control.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const clone = v => JSON.parse(JSON.stringify(v));

test('the control system is reviewed; another actor, drag tile or device pair is refused', () => {
  assert.equal(prtsControlNativeReviewed(), true);
  const config = e => e.envSystems[PRTS_CONTROL_SYSTEM].find(r => '_prtsEnemyKey' in r.data).data;
  const a = clone(environments); config(a)._prtsEnemyKey = 'enemy_10073_mpcar';
  assert.equal(prtsControlNativeReviewed(a), false);
  const b = clone(environments); config(b)._prtsEnemyDragTileKey = 'tile_road';
  assert.equal(prtsControlNativeReviewed(b), false);
  const c = clone(environments); config(c)._enemyTrapKeyPairs.pop();
  assert.equal(prtsControlNativeReviewed(c), false);
  const rune = bb => ({ key: 'env_system_new', blackboard: bb });
  assert.equal(compilePrtsControlRule(rune([{ key: 'key', value: 0, valueStr: PRTS_CONTROL_SYSTEM }])), true);
  assert.throws(() => compilePrtsControlRule(rune([{ key: 'key', value: 0, valueStr: PRTS_CONTROL_SYSTEM }, { key: 'x', value: 1 }])), /Unsupported PRTS control rule/);
});

test('a level is inert only without the Intrusive Call and without a drag tile', () => {
  const level = { enemyDbRefs: [{ id: 'enemy_10073_mpcar' }], waves: [], mapData: { tiles: [{ tileKey: 'tile_road' }] } };
  assert.equal(prtsControlInert(level), true);
  assert.equal(prtsControlInert({ ...level, enemyDbRefs: [{ id: PRTS_INTRUSIVE_CALL }] }), false);
  assert.equal(prtsControlInert({ ...level, waves: [{ fragments: [{ actions: [{ key: PRTS_INTRUSIVE_CALL }] }] }] }), false);
  assert.equal(prtsControlInert({ ...level, mapData: { tiles: [{ tileKey: PRTS_DRAG_TILE }] } }), false);
});

test('15-4 compiles with the system and runs its 30 enemies; 15-2 stays blocked', async () => {
  const entry = manifest.stages.find(s => s.id === '15-4');
  assert.equal(entry.availability, 'available');
  assert.equal(manifest.stages.find(s => s.id === '15-2').availability, 'blocked');
  const stage = await loader.load(entry);
  assert.equal(stage.rules.prtsControl, true);
  assert.equal(Object.hasOwn(stage.enemies, PRTS_INTRUSIVE_CALL), false);
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
  b.life = 999;
  let spawned = 0; b.on('enemySpawn', () => spawned++);
  while (!b.finished && b.time < 400) b.step();
  assert.equal(b.reason, 'cleared');
  assert.deepEqual([spawned, b.total, (b.errors ?? []).length], [30, 30, 0]);
});

// ----- the Intrusive Call's grab and deploy (15-9, 15-15) -----
const support = JSON.parse(await readFile(new URL('../data/arkpedia-enemy-support.json', import.meta.url)));
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const open = async id => {
  const entry = manifest.stages.find(s => s.id === id); assert.equal(entry.availability, 'available', id);
  const stage = await loader.load(entry);
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
  b.life = 999;
  return { b, stage };
};

test('the Intrusive Call is reviewed; grab orders compile only where every carried enemy is an ordinary one', async () => {
  assert.deepEqual(support.enemies[PRTS_INTRUSIVE_CALL].features.at(-1), 'native:intrusiveCall');
  const { stage } = await open('15-9');
  assert.deepEqual(stage.waveProgram.prts, { drag: { row: 5, col: 4 } });
  const spawns = stage.waveProgram.waves.flatMap(w => w.fragments.flatMap(f => f.spawns));
  assert.equal(spawns.filter(s => s.enemyKey === PRTS_INTRUSIVE_CALL).length, 1, 'later hand actions spawn nothing');
  assert.equal(spawns.find(s => s.enemyKey === PRTS_INTRUSIVE_CALL).prtsHand, true);
  assert.deepEqual(spawns.filter(s => s.prtsGrab).map(s => [s.enemyKey, s.offset]),
    [['enemy_10073_mpcar_2', 3], ['enemy_10073_mpcar_2', 25], ['enemy_10080_mpiced', 26], ['enemy_10080_mpiced', 39], ['enemy_10080_mpiced', 57]]);
  assert.equal((await open('15-15')).stage.waveProgram.waves.flatMap(w => w.fragments.flatMap(f => f.spawns)).filter(s => s.prtsGrab).length, 2);
  // TR-26's last grab is a squad: both Helpers of the action are carried.
  const squad = (await open('tr-26')).stage.waveProgram.waves.flatMap(w => w.fragments.flatMap(f => f.spawns)).filter(s => s.prtsGrab);
  assert.deepEqual(squad.map(s => [s.enemyKey, s.count, s.offset]), [['enemy_10073_mpcar', 1, 19], ['enemy_10074_mpcata', 1, 25], ['enemy_10074_mpcata', 1, 35],
    ['enemy_10082_mpweak', 1, 60], ['enemy_10074_mpcata', 1, 105], ['enemy_10073_mpcar', 2, 110]]);
});

test('15-9: a grabbed enemy is held out of play, carried from the drag tile and deployed at its own position', async () => {
  const { b } = await open('15-9'), P = b.stagePrts;
  let held = null;
  b.on('enemySpawn', ({ enemy }) => { if (enemy.mem.prtsCarried && !held) held = enemy; });
  assert.ok(until(b, () => !!held, 5));
  assert.ok(Math.abs(b.time - 3) < .05);
  const hand = P.hand, total = b.total;
  assert.deepEqual([hand.s.flags.invulnerable, hand.s.flags.untargetable, hand.profile.holdsBattle], [true, true, false]);
  assert.deepEqual([held.counted, held.hidden, held.s.flags.untargetable, held.profile.holdsBattle], [false, true, true, false]);
  assert.deepEqual(P.marker, [5, 5]);
  // To the drag tile, Grab_Begin (1.17 s), to the target, then Grab_End's event (0.33 s in).
  assert.ok(until(b, () => P.job?.phase === 'grab', 12));
  assert.deepEqual([hand.y, hand.x], [5, 4]);
  const grabbed = b.time;
  assert.ok(until(b, () => P.job?.phase === 'toTarget', grabbed + 2));
  assert.ok(Math.abs(b.time - grabbed - 1.1667) < .05, `${b.time - grabbed}`);
  assert.ok(until(b, () => P.job?.phase === 'release', b.time + 5));
  const arrived = b.time;
  assert.ok(until(b, () => P.deployed === 1, arrived + 1));
  assert.ok(Math.abs(b.time - arrived - .3333) < .05, `${b.time - arrived}`);
  assert.deepEqual([held.hidden, !!held.s.flags.untargetable, held.alive, P.marker], [false, false, true, null]);
  assert.equal(b.total, total, 'not counted');
  // It flies back to where it appeared before the next order.
  assert.ok(until(b, () => !P.job, b.time + 10));
  assert.deepEqual([hand.y, hand.x], [5, 1]);
  until(b, () => b.finished, 400);
  assert.deepEqual([b.reason, P.deployed, P.failed, (b.errors ?? []).length], ['cleared', 5, 0, 0]);
  assert.equal(hand.alive, true, 'the hand does not hold the battle');
});

test('an occupied target makes the deploy fail (the enemy is lost, the hand is angry); a flying enemy deploys anyway', async () => {
  const { b } = await open('15-9'), P = b.stagePrts;
  b.step();
  const blocker = b.spawnDevice('test:blocker', 5, 5, { hp: 1e6 }); blocker.profile.characterLikeDevice = true;
  let held = null;
  b.on('enemySpawn', ({ enemy }) => { if (enemy.mem.prtsCarried && !held) held = enemy; });
  assert.ok(until(b, () => P.failed === 1, 15));
  assert.deepEqual([held.alive, P.deployed], [false, 0]);
  assert.equal(P.job.phase, 'release');
  assert.ok(until(b, () => P.job?.phase === 'angry', b.time + 2));
  const angry = b.time;
  assert.ok(until(b, () => P.job?.phase === 'toOrigin', angry + 3));
  assert.ok(Math.abs(b.time - angry - 1.9333) < .05, `${b.time - angry}`);
  // The Static Oneiros (flying) is carried to a highland tile: a unit there does not stop it.
  const perch = b.spawnDevice('test:perch', 5, 2, { hp: 1e6 });
  assert.ok(perch);
  assert.ok(until(b, () => P.deployed >= 2, 110), 'second ground enemy, then the first flying one');
  assert.equal(P.failed, 1);
});

// ----- the Weakening Node (15-10, 15-17, 15-18) -----
import deviceNative from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import deviceTables from '../data/arkpedia-device-source.json' with { type: 'json' };
import { weakeningNodeNativeReviewed } from '../shared/arkpedia/stage-weakening-node.js';

test('the Weakening Node is reviewed; another cost, duration or modifier is refused', () => {
  assert.equal(weakeningNodeNativeReviewed(), true);
  const t = clone(deviceTables); t.skills.sktok_mpweak_1.levels[0].blackboard[0].value = 5;
  assert.equal(weakeningNodeNativeReviewed(deviceNative, t), false, 'a cheaper cast');
  const t2 = clone(deviceTables); t2.skills.sktok_mpweak_1.levels[0].blackboard[1].value = 40;
  assert.equal(weakeningNodeNativeReviewed(deviceNative, t2), false, 'a longer PRTS cast');
  const t3 = clone(deviceTables); t3.devices.trap_227_mpweak.talents[0].candidates[0].blackboard[1].value = .2;
  assert.equal(weakeningNodeNativeReviewed(deviceNative, t3), false, 'a stronger penalty');
});

test('15-10: the hand deploys a node, the node charges 30 s and calls the hand, which weakens operators for 20 s', async () => {
  const { b, stage } = await open('15-10'), P = b.stagePrts, N = b.stageWeakeningNodes;
  assert.deepEqual(stage.waveProgram.prts, { drag: { row: 1, col: 5 }, nodes: true });
  assert.ok(until(b, () => N.entries.size === 1, 30));
  const node = [...N.entries.values()][0], placed = b.time;
  assert.deepEqual([node.row, node.col, node.sp, node.state, node.unit.side], [5, 7, 0, 'charging', 'ally']);
  assert.deepEqual([node.unit.s.flags.untargetable, node.unit.s.taunt, P.deployed], [true, -1, 1]);
  assert.equal(b.enemies.some(e => e.alive && (e.def?.key ?? e.defId) === 'enemy_10082_mpweak'), false, 'the node enemy itself never fights');
  // An operator beside the node.
  b.getPlayer('arkpedia').dp = 99; b.setViewport?.('fullscreen-workspace');
  // (No tile around this node takes a card, so she is placed as a preset unit would be.)
  const myrtle = b._deployOperator('char_151_myrtle', node.row, node.col - 1, 'LEFT', { fromSkill: true, predefined: true });
  assert.ok(myrtle?.alive);
  myrtle.base.maxHp = 1e6; myrtle.markDirty(); myrtle.hp = myrtle.s.maxHp;
  const def = myrtle.s.def, res = myrtle.s.res;
  assert.ok(until(b, () => node.state === 'ready', placed + 31));
  assert.ok(Math.abs(b.time - placed - 30) < .1, `${b.time - placed}`);
  assert.match(N.error(node.id) ?? '', /^$/, 'the player could cast it now');
  assert.equal(P.job?.activate ?? P.queue[0]?.activate, node, 'the hand is called');
  assert.ok(until(b, () => node.state === 'active', b.time + 15));
  const cast = b.time;
  assert.deepEqual([node.mode, P.activated], ['enemy', 1]);
  b.step();
  assert.ok(Math.abs(myrtle.s.def - def * .5) < 1e-6 && Math.abs(myrtle.s.res - res * .5) < 1e-6, `${myrtle.s.def} ${myrtle.s.res}`);
  assert.match(N.error(node.id), /already active/);
  assert.ok(until(b, () => node.state === 'charging', cast + 21));
  assert.ok(Math.abs(b.time - cast - 20) < .1, `${b.time - cast}`);
  b.step();
  assert.deepEqual([myrtle.s.def, myrtle.s.res, node.sp < 1], [def, res, true]);
});

test('the player casts a charged node first: 10 DP, enemies in range lose half their DEF and RES for 30 s, and the hand is angry', async () => {
  const { b } = await open('15-10'), P = b.stagePrts, N = b.stageWeakeningNodes;
  assert.ok(until(b, () => N.entries.size === 1, 30));
  const node = [...N.entries.values()][0];
  assert.match(N.error(node.id), /charging/);
  assert.ok(until(b, () => node.state === 'ready', 60));
  b.getPlayer('arkpedia').dp = 5;
  assert.match(N.error(node.id), /Not enough DP/);
  b.getPlayer('arkpedia').dp = 30;
  N.activate(node.id);
  assert.deepEqual([b.dp, node.mode, node.state], [20, 'ally', 'active']);
  const cast = b.time;
  const foe = b.spawnEnemy('enemy_10073_mpcar', { pos: [node.row, node.col - 1], countInTotal: false });
  b.addBuff(foe, { key: 'test:hold', persist: true, flags: { noMove: true, disarm: true } });
  foe.base.maxHp = 1e9; foe.markDirty(); foe.hp = foe.s.maxHp;
  const def = foe.s.def, res = foe.s.res;
  b.step(); b.step();
  assert.ok(Math.abs(foe.s.def - def * .5) < 1e-6 && Math.abs(foe.s.res - res * .5) < 1e-6);
  // The hand arrives, finds it active, and is angry.
  assert.ok(until(b, () => P.failed === 1, cast + 15));
  assert.equal(P.activated, 0);
  assert.ok(until(b, () => P.job?.phase === 'angry', b.time + 2));
  assert.ok(until(b, () => node.state === 'charging', cast + 31));
  assert.ok(Math.abs(b.time - cast - 30) < .1, `${b.time - cast}`);
  b.step();
  assert.equal(foe.s.def, def);
});

test('15-17 and 15-18 run with their nodes: carried in 15-17, placed by the level in 15-18', async () => {
  const a = await open('15-17');
  until(a.b, () => a.b.finished, 500);
  assert.deepEqual([(a.b.errors ?? []).length, a.b.stagePrts.failed, a.b.stageWeakeningNodes.entries.size >= 2], [0, 0, true]);
  const c = await open('15-18');
  assert.ok(c.stage.devices.some(d => d.key === 'trap_227_mpweak'));
  c.b.step();
  assert.ok(c.b.stageWeakeningNodes.entries.size >= 1);
  until(c.b, () => c.b.finished, 500);
  assert.equal((c.b.errors ?? []).length, 0);
});

// ----- the static forms (15-5, 15-6, 15-8, 15-12, 15-13, 15-14, H15-1, H15-2) -----
import enemyRecords from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import { PRTS_STATIC_FORMS, prtsStaticFormReviewed, prtsStaticForm } from '../shared/arkpedia/stage-prts-static-forms.js';

test('the six static forms are reviewed against their enemy records; a different device number is refused', () => {
  for (const key of Object.keys(PRTS_STATIC_FORMS)) assert.equal(prtsStaticFormReviewed(key), true, key);
  assert.deepEqual(prtsStaticForm('enemy_10076_mpgrou_2'), { trap: 'trap_232_mpgroub', hp: 9000, atk: 450, def: 1250, res: 60, taunt: -1, mass: 0 });
  const t = clone(deviceTables); t.devices.trap_229_mpcata.phases[0].attributesKeyFrames[0].data.atk = 400;
  assert.equal(prtsStaticFormReviewed('enemy_10074_mpcata', deviceNative, t, enemyRecords), false);
  const t2 = clone(deviceTables); t2.devices.trap_229_mpcata.phases[0].attributesKeyFrames[0].data.tauntLevel = 0;
  assert.equal(prtsStaticFormReviewed('enemy_10074_mpcata', deviceNative, t2, enemyRecords), false);
  assert.throws(() => prtsStaticForm('enemy_10073_mpcar'), /Unsupported static form/);
});

test('15-5: eight Cold Drink Machines are dropped on high ground as fixed devices that fight but need not be defeated', async () => {
  const { b, stage } = await open('15-5'), P = b.stagePrts;
  assert.deepEqual(Object.keys(stage.waveProgram.prts.statics), ['enemy_10074_mpcata']);
  assert.ok(until(b, () => P.staticsPlaced === 1, 60));
  const m = b.enemies.find(e => e.alive && e.mem.prtsStatic);
  assert.equal(b.grid.tile(m.y, m.x).height, 'HIGH');
  assert.deepEqual([m.mem.prtsStatic, m.s.maxHp, m.s.atk, m.s.def, m.s.res, m.s.taunt, m.s.massLevel], ['trap_229_mpcata', 3000, 350, 240, 35, -1, 0]);
  assert.deepEqual([m.counted, m.profile.holdsBattle, !!m.s.flags.untargetable, m.route.legs.length], [false, false, false, 0]);
  b.getPlayer('arkpedia').dp = 99; b.setViewport?.('fullscreen-workspace');
  assert.equal(b.noDeployZones.get(m).has(`${m.y},${m.x}`), true, 'nothing can be deployed on its tile');
  // An operator within its 2.5 radius is shot (Physical) every 4 s.
  const myrtle = b._deployOperator('char_151_myrtle', m.y - 1, m.x, 'UP', { fromSkill: true, predefined: true });
  myrtle.base.maxHp = 1e6; myrtle.markDirty(); myrtle.hp = myrtle.s.maxHp;
  const shots = [];
  b.on('damaged', ({ source, target, type }) => { if (source === m && target === myrtle) shots.push([b.time, type]); });
  const [y, x] = [m.y, m.x];
  until(b, () => shots.length >= 2, b.time + 12);
  assert.ok(shots.length >= 2 && shots.every(([, type]) => type === 'phys'), JSON.stringify(shots));
  assert.ok(Math.abs(shots[1][0] - shots[0][0] - 4) < .2, `${shots[1][0] - shots[0][0]}`);
  assert.deepEqual([m.y, m.x], [y, x], 'it does not move');
  assert.ok(m.hp < m.s.maxHp, 'the operator can attack it');
  m.hp = m.s.maxHp; b.retreat(myrtle, { reason: 'withdraw', permanent: true });
  until(b, () => b.finished, 500);
  assert.deepEqual([b.reason, b.total, P.staticsPlaced, P.failed, (b.errors ?? []).length], ['cleared', 48, 8, 0, 0]);
  assert.equal(b.enemies.filter(e => e.alive && e.mem.prtsStatic).length, 8, 'they stay on the field');
});

test('H15-1: a static crystal takes the stage rule that names its device id; the other static stages run clean', async () => {
  const { b } = await open('h15-1'), P = b.stagePrts;
  assert.ok(until(b, () => P.staticsPlaced >= 1, 400));
  const c = b.enemies.find(e => e.alive && e.mem.prtsStatic === 'trap_234_mpmageb');
  assert.deepEqual([c.s.maxHp, Math.round(c.s.atk), Math.round(c.s.def)], [16000, 780, 1560]);
  for (const id of ['15-6', '15-8', '15-12', '15-13', '15-14', 'h15-2']) {
    const x = await open(id);
    until(x.b, () => x.b.finished, 700);
    assert.deepEqual([(x.b.errors ?? []).length, x.b.stagePrts.failed, x.b.stagePrts.staticsPlaced > 0], [0, 0, true], id);
  }
});

test('a stage with ten or more tile types keeps every type (the fifth used to be read as the tenth)', async () => {
  for (const id of ['h15-1', '14-17', '15-5']) {
    const { b, stage } = await open(id), g = stage.geometry;
    assert.ok(g.tileLegend.length >= 10, id);
    let wrong = 0;
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
      const want = g.tileLegend[g.tileGrid[r][c]], got = b.grid.tile(r, c);
      if (got.key !== want.key || got.height !== want.height.toUpperCase()) wrong++;
    }
    assert.equal(wrong, 0, id);
  }
});

// ----- six-star ("险地") variants: the base conditions only (level 0); the optional hypotheses are not offered -----
const openSix = async id => {
  const entry = manifest.stages.find(s => s.id === id); assert.equal(entry.availability, 'available', id);
  const stage = await loader.load(entry);
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
  const life = b.life; b.life = 999;
  return { b, stage, life };
};
const firstOf = (b, key, limit = 200) => { let e; until(b, () => (e = b.enemies.find(x => (x.def?.key ?? x.defId) === key)), limit); return e; };

test('six-star 15-4: 1 life point, enemies at 110% ATK and DEF, 120% HP, 130% speed; the alias name changes nothing', async () => {
  const { b, stage, life } = await openSix('15-4_six_star');
  assert.equal(life, 1);
  assert.deepEqual(stage.rules.enemies, { atk: 1.1, def: 1.1, maxHp: 1.2, moveSpeed: 1.3 });
  const e = firstOf(b, 'enemy_10073_mpcar');
  assert.deepEqual([e.s.maxHp, Math.round(e.s.atk), Math.round(e.s.def), Math.round(e.s.moveSpeed * 100)], [2400, 330, 220, 247]);
  until(b, () => b.finished, 400);
  assert.deepEqual([b.reason, b.total, (b.errors ?? []).length], ['cleared', 30, 0]);
});

test('six-star 15-5: every Cold Drink Machine is a Hot one, and the hand still fixes it on high ground with the device rule once', async () => {
  const { b, stage } = await openSix('15-5_six_star'), P = b.stagePrts;
  assert.deepEqual(stage.rules.enemyReplacements, { enemy_10074_mpcata: 'enemy_10074_mpcata_2' });
  assert.deepEqual(Object.keys(stage.waveProgram.prts.statics), ['enemy_10074_mpcata_2']);
  assert.ok(until(b, () => P.staticsPlaced === 1, 60));
  const m = b.enemies.find(e => e.alive && e.mem.prtsStatic);
  // Hot Drink Machine device: 3,800 HP, 400 ATK, 240 DEF; the six-star device rule gives x1.2, x1.1, x1.1 (not the enemy rule on top).
  assert.deepEqual([m.mem.prtsStatic, m.s.maxHp, Math.round(m.s.atk), Math.round(m.s.def)], ['trap_230_mpcatab', 4560, 440, 264]);
  until(b, () => b.finished, 500);
  assert.deepEqual([b.reason, b.total, P.staticsPlaced, P.failed, (b.errors ?? []).length], ['cleared', 48, 8, 0, 0]);
});

test('six-star 15-9: its four tiles cannot be deployed on by any class', async () => {
  const { b, stage } = await openSix('15-9_six_star');
  assert.deepEqual(stage.rules.forbiddenLocations, [{ row: 3, col: 7 }, { row: 2, col: 6 }, { row: 3, col: 4 }, { row: 4, col: 5 }]);
  assert.deepEqual([...b.stageForbiddenTiles].sort(), ['2,6', '3,4', '3,7', '4,5']);
  assert.equal((await open('15-9')).stage.rules.forbiddenLocations, undefined);
});

test('six-star 15-13 and 15-18: ally units lose ATK or DEF; an enemy-side fixed device does not', async () => {
  const a = await openSix('15-13_six_star');
  assert.deepEqual(a.stage.rules.characterAttributes[0], { professionMask: 1023, buildableMask: 3, side: 'ALLY', multipliers: { maxHp: 1, atk: 0.9, def: 1 } });
  assert.ok(until(a.b, () => a.b.stagePrts.staticsPlaced >= 1, 400));
  const g = a.b.enemies.find(e => e.alive && e.mem.prtsStatic === 'trap_231_mpgrou');
  assert.deepEqual([g.s.maxHp, Math.round(g.s.atk), Math.round(g.s.def)], [8400, 495, 1210], 'device numbers x 1.2 / 1.1 / 1.1, without the ally rule');
  const plain = (await open('15-13')).b, six = (await openSix('15-13_six_star')).b;
  const spot = b => { for (let r = 0; r < b.grid.rows; r++) for (let c = 0; c < b.grid.cols; c++) { try { const u = b._deployOperator('char_151_myrtle', r, c, 'RIGHT', { fromSkill: true, predefined: true }); if (u) return u; } catch { /* next tile */ } } };
  const [u0, u1] = [spot(plain), spot(six)];
  assert.ok(Math.abs(u1.s.atk / u0.s.atk - 0.9) < 1e-9 && u1.s.def === u0.s.def && u1.s.maxHp === u0.s.maxHp);
  const d = await openSix('15-18_six_star'), v = spot(d.b), w = spot((await open('15-18')).b);
  assert.ok(Math.abs(v.s.def / w.s.def - 0.8) < 1e-9 && v.s.atk === w.s.atk);
  for (const id of ['15-10_six_star', '15-12_six_star', '15-15_six_star', '15-17_six_star', '15-18_six_star']) {
    const x = await openSix(id);
    until(x.b, () => x.b.finished, 700);
    assert.deepEqual([x.life, x.b.reason, (x.b.errors ?? []).length, x.b.stagePrts.failed], [1, 'cleared', 0, 0], id);
  }
});

// ----- drink machines the level places itself (15-3, 15-7, 15-11) -----
const placed = b => b.enemies.filter(e => e.alive && e.mem.prtsStatic).map(e => `${e.y},${e.x}`).sort();

test('15-3: the level switches on one Cold Drink Machine at the start; it is a fixed device, not one of the 26 enemies', async () => {
  const { b, stage } = await open('15-3');
  const rows = stage.devices.filter(d => d.key === 'trap_229_mpcata');
  // The second machine belongs to a hidden group no base rule enables, so it is left out.
  assert.deepEqual(rows.map(d => [d.row, d.col, d.alias, d.scheduledActivation, d.staticForm.trap, d.staticForm.hp]), [[3, 8, 'trap_229_mpcata#1', true, 'trap_229_mpcata', 3000]]);
  b.step();
  assert.deepEqual(placed(b), ['3,8']);
  const m = b.enemies.find(e => e.mem.prtsStatic);
  assert.deepEqual([m.def.key, m.s.maxHp, m.s.atk, m.s.def, m.s.taunt, m.counted, m.profile.holdsBattle], ['enemy_10074_mpcata', 3000, 350, 240, -1, false, false]);
  assert.equal(b.noDeployZones.get(m).has('3,8'), true);
  const [y, x] = [m.y, m.x];
  until(b, () => b.finished, 400);
  assert.deepEqual([b.reason, b.total, (b.errors ?? []).length, m.alive, m.y, m.x], ['cleared', 26, 0, true, y, x]);
});

test('15-7 and 15-11 place three machines each; the six-star variants scale them by the device rule', async () => {
  const a = await open('15-7'); a.b.step();
  assert.deepEqual(placed(a.b), ['4,4', '6,1', '6,4']);
  const c = await open('15-11'); c.b.step();
  assert.deepEqual(placed(c.b), ['3,9', '4,9', '5,9']);
  assert.deepEqual(c.b.enemies.filter(e => e.mem.prtsStatic).map(e => [e.def.key, e.s.maxHp, e.s.atk]), Array(3).fill(['enemy_10074_mpcata_2', 3800, 400]));
  for (const x of [a, c]) { until(x.b, () => x.b.finished, 600); assert.deepEqual([x.b.reason, (x.b.errors ?? []).length, x.b.stagePrts.failed], ['cleared', 0, 0]); }
  const six = await openSix('15-3_six_star'); six.b.step();
  const m = six.b.enemies.find(e => e.mem.prtsStatic);
  assert.deepEqual([six.life, m.s.maxHp, Math.round(m.s.atk), Math.round(m.s.def)], [1, 3600, 385, 264]);
  const hot = await openSix('15-11_six_star');
  assert.equal(hot.stage.rules.battle.dp_recovery_interval_seconds, 1.5);
  until(hot.b, () => hot.b.finished, 600);
  assert.deepEqual([hot.b.reason, (hot.b.errors ?? []).length, placed(hot.b).length >= 3], ['cleared', 0, true]);
});

test('six-star 15-6 and 15-7: the Distributor summons every 4 s instead of 5, its first delay unchanged', async () => {
  const base = await open('15-6'), six = await openSix('15-6_six_star');
  const spawn = s => s.enemies.enemy_10077_mpbarr.skills.find(k => k.prefabKey === 'Spawn');
  assert.deepEqual([spawn(base.stage).cooldown, spawn(base.stage).initCooldown], [5, 3]);
  assert.deepEqual([spawn(six.stage).cooldown, spawn(six.stage).initCooldown], [4, 3]);
  assert.deepEqual(six.stage.rules.enemySkillPeriodScoped, { enemy_10077_mpbarr: { Spawn: 0.8 } });
  for (const x of [base, six]) until(x.b, () => x.b.finished, 600);
  assert.ok(six.b.total > base.b.total, `${six.b.total} > ${base.b.total}`);
  assert.deepEqual([six.b.reason, (six.b.errors ?? []).length], ['cleared', 0]);
  const seven = await openSix('15-7_six_star');
  assert.equal(spawn(seven.stage).cooldown, 4);
  until(seven.b, () => seven.b.finished, 600);
  assert.deepEqual([seven.life, seven.b.reason, (seven.b.errors ?? []).length], [1, 'cleared', 0]);
});

test('six-star 15-8: the crystal has 150% DEF on top, its fixed form 130% on top', async () => {
  const { b, stage } = await openSix('15-8_six_star');
  assert.deepEqual(stage.rules.enemyScoped, { enemy_10079_mpmage: { def: 1.5 } });
  assert.deepEqual(stage.rules.characterAttributes[1].multipliers, { def: 1.3 });
  const walking = firstOf(b, 'enemy_10079_mpmage', 300);
  assert.equal(Math.round(stage.enemies.enemy_10079_mpmage.stats.def), 1650);
  assert.ok(until(b, () => b.stagePrts.staticsPlaced >= 1, 400));
  const fixed = b.enemies.find(e => e.alive && e.mem.prtsStatic === 'trap_233_mpmage');
  assert.deepEqual([fixed.s.maxHp, Math.round(fixed.s.atk), Math.round(fixed.s.def)], [9600, 550, 1430]);
  assert.ok(walking);
  until(b, () => b.finished, 600);
  assert.deepEqual([b.reason, (b.errors ?? []).length, b.stagePrts.failed], ['cleared', 0, 0]);
});

// ----- TR-26: the tutorial's script dates the hand's flight -----
test('TR-26: the hand flies at move speed x 0.5, so Amiya (placed at 49 s) is on the tile before the second machine arrives', async () => {
  const { b } = await open('tr-26'), P = b.stagePrts, log = [];
  let last = '';
  while (!b.finished && b.time < 70) {
    b.step();
    const k = `${P.deployed},${P.failed},${P.staticsPlaced}`;
    if (k !== last) { last = k; log.push([Math.round(b.time * 10) / 10, P.deployed, P.failed, P.staticsPlaced]); }
  }
  // 19 s Helper -> 3,4; 25 s machine -> 2,6 (fixed); 35 s machine -> 2,7, where Amiya stands since 49 s: the deploy
  // fails; 60 s Weakening Node -> 3,6.
  assert.deepEqual(log.slice(1), [[24.8, 1, 0, 0], [35.7, 2, 0, 1], [50.1, 2, 1, 1], [67, 3, 1, 1]]);
  assert.ok(b.allyUnits.some(u => u.defId === 'char_002_amiya' && u.deployed && u.tileR === 2 && u.tileC === 7));
  until(b, () => b.finished, 400);
  assert.deepEqual([b.reason, b.total, (b.errors ?? []).length], ['cleared', 10, 0]);
});

test('a fixed form on high ground stops a second drop on its tile', async () => {
  const { b } = await open('15-5'), P = b.stagePrts;
  assert.ok(until(b, () => P.staticsPlaced === 1, 60));
  const m = b.enemies.find(e => e.alive && e.mem.prtsStatic);
  assert.equal(P.occupied([m.y, m.x]), true);
  assert.equal(P.occupied([m.y, m.x + 1]), false);
});

test('H15-3: seven level-placed Active Sarkaz Caster Crystals; its misspelt device rule changes nothing', async () => {
  const { b, stage } = await open('h15-3');
  assert.equal(stage.rules.characterAttributes, undefined);
  assert.deepEqual(stage.rules.enemies, { atk: 1.3, def: 1.3, maxHp: 1.6 });
  b.step();
  assert.deepEqual(placed(b), ['3,9', '4,4', '4,6', '4,8', '5,10', '5,7', '6,9']);
  const c = b.enemies.find(e => e.mem.prtsStatic);
  assert.deepEqual([c.def.key, c.mem.prtsStatic, c.s.maxHp, c.s.atk, c.s.def, b.grid.tile(c.y, c.x).height], ['enemy_10079_mpmage_2', 'trap_234_mpmageb', 10000, 600, 1200, 'HIGH']);
  until(b, () => b.finished, 600);
  assert.deepEqual([b.reason, b.total, (b.errors ?? []).length, b.stagePrts.failed], ['cleared', 32, 0, 0]);
});

// ----- six-star 15-14: Originium crystal bursts -----
test('six-star 15-14: every 30 s a crystal bursts 3 s after it appears: 900 Arts in its 3x3, and an empty tile is sealed for 5 s', async () => {
  const { originiumBurstNativeReviewed, ORIGINIUM_BURST_RANGE, ORIGINIUM_BURST_SYSTEM } = await import('../shared/arkpedia/stage-originium-bursts.js');
  const deviceSource = JSON.parse(await readFile(new URL('../data/arkpedia-device-source.json', import.meta.url)));
  assert.equal(originiumBurstNativeReviewed(), true);
  const other = clone(environments); other.envSystems[ORIGINIUM_BURST_SYSTEM].find(r => '_maxTarget' in r.data).data._maxTarget = 2;
  assert.equal(originiumBurstNativeReviewed(other), false);
  assert.deepEqual(ORIGINIUM_BURST_RANGE, deviceSource.ranges['x-4'].grids.map(g => [g.row, g.col]));
  const { b, stage, life } = await openSix('15-14_six_star'), S = b.stageOriginiumBursts;
  assert.equal((await open('15-14')).b.stageOriginiumBursts, undefined);
  assert.deepEqual([life, stage.rules.originiumBursts.tiles, stage.rules.originiumBursts.interval, stage.rules.originiumBursts.delay, stage.rules.originiumBursts.damage,
    stage.rules.originiumBursts.life, stage.rules.originiumBursts.addWeight], [1, [{ row: 3, col: 9, weight: 100 }, { row: 4, col: 5, weight: 100 }], 30, 3, 900, 5, -20]);
  // Operators beside both tiles, none on them.
  const near = [[3, 9], [4, 5]].map(([r, c]) => {
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      try { const u = b._deployOperator(['char_151_myrtle', 'char_002_amiya'].find(id => !b.bench[id]?.unit?.alive && b.bench[id]) ?? 'char_151_myrtle', r + dr, c + dc, 'RIGHT', { fromSkill: true, predefined: true });
        u.base.maxHp = 1e6; u.markDirty(); u.hp = u.s.maxHp; return u; } catch { /* next tile */ }
    }
    return null;
  });
  const hits = [];
  b.on('damaged', c => { if (c.dmg?.tags?.includes('stage:originiumBurst')) hits.push([b.time, c.target, c.type, c.dmg.amount]); });
  assert.ok(until(b, () => S.pending.length === 1, 40));
  assert.ok(Math.abs(b.time - 30) < .1, `${b.time}`);
  const first = S.pending[0], key = `${first.row},${first.col}`;
  assert.ok(['3,9', '4,5'].includes(key));
  assert.ok(until(b, () => S.bursts === 1, 40));
  assert.ok(Math.abs(b.time - 33) < .1, `${b.time}`);
  const struck = near[key === '3,9' ? 0 : 1];
  if (struck) assert.deepEqual(hits.filter(h => h[1] === struck).map(h => [h[2], h[3]]), [['arts', 900]]);
  assert.deepEqual([b.noDeployTiles.has(key), S.markers.sealed], [true, [[first.row, first.col]]], 'nobody stood on it: Sealed Ground');
  until(b, () => !b.noDeployTiles.has(key), 45);
  assert.ok(Math.abs(b.time - 38) < .1, `${b.time}`);
  // Both tiles take their turns.
  until(b, () => S.picks.length >= 8 || b.finished, 260);
  const count = k => S.picks.filter(p => p === k).length;
  assert.ok(S.picks.length >= 6 && Math.abs(count('3,9') - count('4,5')) <= 2, S.picks.join(' '));
});

test('a crystal on a tile an operator stands on hits them and seals nothing', async () => {
  const { b } = await openSix('15-14_six_star'), S = b.stageOriginiumBursts;
  assert.ok(until(b, () => S.pending.length === 1, 40));
  const { row, col } = S.pending[0], u = b._deployOperator('char_151_myrtle', 6, 8, 'RIGHT', { fromSkill: true, predefined: true });
  u.base.maxHp = 1e6; u.markDirty(); u.hp = u.s.maxHp; u.x = col; u.y = row; u.tileR = row; u.tileC = col;
  const hp = u.hp;
  assert.ok(until(b, () => S.bursts === 1, 40));
  assert.ok(u.hp < hp);
  assert.deepEqual([b.noDeployTiles?.has(`${row},${col}`) ?? false, S.sealed.length], [false, 0]);
});
