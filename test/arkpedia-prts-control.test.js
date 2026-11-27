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

test('15-4 compiles with the system and runs its 30 enemies; 15-5, which has the Intrusive Call, stays blocked', async () => {
  const entry = manifest.stages.find(s => s.id === '15-4');
  assert.equal(entry.availability, 'available');
  assert.equal(manifest.stages.find(s => s.id === '15-5').availability, 'blocked');
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
  // The static device forms are not modelled: those stages stay blocked.
  for (const id of ['15-8', '15-6', 'tr-26']) assert.equal(manifest.stages.find(s => s.id === id).availability, 'blocked', id);
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
