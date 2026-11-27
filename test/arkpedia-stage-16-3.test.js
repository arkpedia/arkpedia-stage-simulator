// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 16: Toxic Pollution, the Heavily Polluted Facility, the Rock Wall, the Hidden Tunnel and the Army
// Infiltrator (16-3 and its six-star variant).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../data/arkpedia-device-source.json' with { type: 'json' };
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { MINER_GUERRILLA } from '../shared/arkpedia/enemy-miner-guerrilla-features.js';
import { ARMY_INFILTRATOR, armyInfiltratorNative, minerEngageParams } from '../shared/arkpedia/enemy-army-features.js';
import { mainline16Supported } from '../shared/arkpedia/stage-mainline16.js';
import { POLLUTED_FACILITY, ROCK_WALL, HIDDEN_TUNNEL, pollutedFacilityNativeReviewed, rockWallNativeReviewed, hiddenTunnelNativeReviewed,
  pollutedFacilityDefinition, rockWallDefinition, hiddenTunnelDefinition } from '../shared/arkpedia/stage-mainline16-devices.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { canTargetEnemy } from '../server/sim/targeting.js';

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
  return { b, stage, life, m: b.stageMainline16 };
};
const miners = b => b.neutralUnits.filter(u => u.alive && u.def?.key === MINER_GUERRILLA);
const strike = (b, unit, amount) => b.dealDamage(null, unit, { amount, type: 'true', applyWay: 'none', tags: ['test'] });
const still = (b, u) => b.addBuff(u, { key: 'test:still', persist: true, flags: { noMove: true, disarm: true } });
const deployError = (b, row, col) => { try { const u = b._deployOperator('char_151_myrtle', row, col, 'RIGHT', { fromSkill: true }); return u ? null : 'no unit'; } catch (e) { return e.message; } };
const at = (m, kind, row, col) => [...m.entries.values()].find(d => d.spec.kind === kind && d.row === row && d.col === col);
/** A standing enemy on a tile, for the tests that need one in a known place. */
const place = (b, key, row, col) => {
  const e = b.spawnEnemy(key, { pos: [row, col], countInTotal: false, route: { start: [row, col], steps: [{ t: 'wait', s: 1e9 }] } });
  e.profile.holdsBattle = false; return e;
};

test('the three devices and the Army Infiltrator are reviewed; other numbers and other levels are refused', () => {
  assert.deepEqual([pollutedFacilityNativeReviewed(), rockWallNativeReviewed(), hiddenTunnelNativeReviewed()], [true, true, true]);
  const edit = (key, fn) => { const e = clone(native); fn(e.prefabs[key].components, e); return e; };
  // Another stop circle, a facility that rewrites its tile, a tunnel whose skill does not switch its mode.
  assert.equal(rockWallNativeReviewed(edit(ROCK_WALL, rows => { rows.find(c => c.object === 'StopMcreep' && c.data.m_Radius !== undefined).data.m_Radius = 1; })), false);
  assert.equal(pollutedFacilityNativeReviewed(edit(POLLUTED_FACILITY, rows => { rows.find(c => '_keepCurrentPassableMask' in c.data).data._keepCurrentPassableMask = 0; })), false);
  assert.equal(pollutedFacilityNativeReviewed(edit(POLLUTED_FACILITY, (rows, e) => { e.templates['fowstn_t[shadow_tile]'].eventToActions.ON_BUFF_FINISH[0]._toShadow = true; })), false);
  assert.equal(hiddenTunnelNativeReviewed(edit('sktok_spawnp', rows => { rows.find(c => '_switchToMode' in c.data).data._switchToMode = 0; })), false);
  const t = clone(tables); t.skills.sktok_spawnp.levels[0].blackboard.find(x => x.key === 'talent@interval').value = 10;
  assert.equal(hiddenTunnelNativeReviewed(native, t), false);
  const t2 = clone(tables); t2.devices[POLLUTED_FACILITY].talents[1].candidates[0].blackboard[0].value = 3;
  assert.equal(pollutedFacilityNativeReviewed(native, t2), false);
  const plain = { level: 1, skillLevel: 1 };
  assert.deepEqual([pollutedFacilityDefinition(plain).hp, pollutedFacilityDefinition(plain).range.length, pollutedFacilityDefinition(plain).minerDamageScale], [30000, 21, 5]);
  assert.deepEqual([rockWallDefinition(plain).hp, rockWallDefinition(plain).def, rockWallDefinition(plain).res], [8000, 300, 20]);
  const tunnel = hiddenTunnelDefinition({ ...plain, actionIndex: 1 });
  assert.deepEqual([tunnel.spCost, tunnel.interval, tunnel.maxWaiting, tunnel.maxCount, tunnel.branchId, tunnel.actionIndex], [15, 15, 3, 5, 'mcreep_route', 1]);
  assert.throws(() => hiddenTunnelDefinition(plain), /Unsupported Hidden Tunnel/);
  assert.throws(() => rockWallDefinition({ level: 2, skillLevel: 1 }), /Unsupported Rock Wall/);

  const level = Object.values(records[ARMY_INFILTRATOR].levels)[0], view = nativeComponents(evidence, ARMY_INFILTRATOR);
  assert.equal(armyInfiltratorNative(level, view), true);
  assert.equal(support.enemies[ARMY_INFILTRATOR].policy, 'stats-attacks-and-features');
  const other = clone(level); other.talents.bb['BlockMcreep.block_mcreep_cnt'] = 0;
  assert.equal(armyInfiltratorNative(other, view), false);
  assert.deepEqual(minerEngageParams(level).engage, { interval: .3, radius: .9, add: .1, count: 1 });

  const ok = { enemyDbRefs: [{ id: ARMY_INFILTRATOR }, { id: MINER_GUERRILLA }], waves: [], mapData: { tiles: [{ tileKey: 'tile_road' }] },
    predefines: { tokenInsts: [{ inst: { characterKey: POLLUTED_FACILITY }, hidden: false }, { inst: { characterKey: HIDDEN_TUNNEL }, hidden: false }] } };
  assert.equal(mainline16Supported(ok), true);
  // A facility a wave action switches on, a supplied card, a soldier that is not built yet, another device.
  assert.equal(mainline16Supported({ ...ok, predefines: { tokenInsts: [{ inst: { characterKey: POLLUTED_FACILITY }, hidden: true }] } }), false);
  assert.equal(mainline16Supported({ ...ok, predefines: { ...ok.predefines, tokenCards: [{ inst: { characterKey: 'trap_001_crate' } }] } }), false);
  assert.equal(mainline16Supported({ ...ok, enemyDbRefs: [{ id: 'enemy_10124_uashld' }] }), false);
  assert.equal(mainline16Supported({ ...ok, predefines: { tokenInsts: [{ inst: { characterKey: 'trap_001_crate' }, hidden: false }] } }), false);
  for (const id of ['16-4', '16-13', '16-18', 'tr-27']) assert.equal(manifest.stages.find(s => s.id === id).availability, 'blocked', id);
});

test('16-3 opens with its devices; the tiles around both facilities are polluted and nothing can be deployed there', async () => {
  const { b, stage, m, life } = await open('16-3');
  assert.equal(stage.rules.mainline16, true); assert.equal(life, 3);
  assert.deepEqual([...m.entries.values()].map(d => `${d.spec.kind}@${d.row},${d.col}`).sort(),
    ['hidden-tunnel@4,1', 'polluted-facility@4,4', 'polluted-facility@4,8', 'rock-wall@5,3', 'rock-wall@5,4']);
  // Two 21-tile areas four columns apart share three tiles.
  assert.equal(m.pollutedTiles().length, 39);
  assert.equal(m.polluted(6, 3), true); assert.equal(m.polluted(6, 2), false);
  assert.match(deployError(b, 6, 3), /Toxic Pollution/);
  assert.match(deployError(b, 4, 4), /unavailable|occupied|melee/i); // the facility's own tile
  assert.equal(deployError(b, 6, 2), null);
  const facility = at(m, 'polluted-facility', 4, 4), wall = at(m, 'rock-wall', 5, 3);
  assert.deepEqual([facility.unit.side, facility.unit.s.maxHp, facility.unit.s.def, wall.unit.s.maxHp, !!wall.unit.s.flags.untargetable, facility.unit.profile.holdsBattle],
    ['enemy', 30000, 300, 8000, true, false]);
});

test('an enemy on a polluted tile is hidden until it is blocked, a Miner Guerrilla clears the tile, or an operator stands there', async () => {
  const melee = Object.keys(mvp.operators).find(k => k !== 'char_151_myrtle' && mvp.operators[k].position === 'MELEE');
  const { b, m } = await open('16-3', ['char_151_myrtle', melee]);
  const op = b._deployOperator('char_151_myrtle', 6, 2, 'RIGHT', { fromSkill: true }); op.profile.noAttack = true;
  const foe = place(b, 'enemy_1108_uterer', 6, 4); still(b, foe);
  const out = place(b, 'enemy_1108_uterer', 1, 3); still(b, out);
  const t0 = b.time; until(b, () => b.time >= t0 + .35, t0 + 1);
  assert.equal(m.polluted(6, 4), true);
  assert.deepEqual([!!foe.s.flags.stealth, canTargetEnemy(op, foe, op.profile), canTargetEnemy(op, out, op.profile)], [true, false, true]);
  // The facility itself stands in its own pollution.
  const facility = at(m, 'polluted-facility', 4, 4);
  assert.equal(canTargetEnemy(op, facility.unit, op.profile), false);
  // A Miner Guerrilla's clearing: the tile and the eight around it, for 3 s.
  m.clearAround({ x: 4, y: 5 }, 3);
  assert.equal(m.polluted(6, 4), false); assert.equal(m.polluted(4, 4), false); assert.equal(m.polluted(5, 6), true);
  const t1 = b.time; until(b, () => b.time >= t1 + .35, t1 + 1);
  assert.deepEqual([canTargetEnemy(op, foe, op.profile), canTargetEnemy(op, facility.unit, op.profile)], [true, true]);
  until(b, () => b.time >= t1 + 3.4, t1 + 4);
  assert.deepEqual([m.polluted(6, 4), canTargetEnemy(op, foe, op.profile)], [true, false]);
  // Blocked, it is shown.
  foe.blockedBy = op; b._stealthSwitch?.(foe);
  const t2 = b.time; until(b, () => b.time >= t2 + .35, t2 + 1);
  assert.equal(canTargetEnemy(op, foe, op.profile), true);
  foe.blockedBy = null;
  // An operator standing on a tile keeps that tile clear (it can only get there while the tile is cleared).
  m.clearAround({ x: 4, y: 6 }, .5);
  const second = b._deployOperator(melee, 6, 5, 'LEFT', { fromSkill: true });
  assert.ok(second);
  const t3 = b.time; until(b, () => b.time >= t3 + 1, t3 + 2);
  assert.deepEqual([m.polluted(6, 5), m.polluted(6, 4)], [false, true]);
});

test('a Hidden Tunnel gathers a Miner Guerrilla every 15 s, three waiting at most; its skill sends them out, five alive at most', async () => {
  const { b, m } = await open('16-3');
  const tunnel = m.tunnels[0];
  assert.match(m.error(tunnel.id), /charging/);
  assert.ok(until(b, () => miners(b).length === 1, 16)); assert.ok(Math.abs(b.time - 15) < .1, `${b.time}`);
  const first = miners(b)[0];
  assert.deepEqual([Math.round(first.y), Math.round(first.x), !!first.s.flags.noMove, first.counted], [3, 1, true, false]);
  assert.equal(m.error(tunnel.id), null, '15 SP after 15 s');
  until(b, () => b.time >= 62, 63);
  assert.deepEqual([miners(b).length, m.waiting(tunnel).length], [3, 3], 'no fourth while three wait');
  for (const u of b.enemies) if (u.kind !== 'device') b.kill(u, null); // nothing in their way
  m.activate(tunnel.id);
  assert.deepEqual([tunnel.state, m.waiting(tunnel).length, miners(b).every(u => !u.findBuff('stage:minerStandby'))], ['sortie', 0, true]);
  const x0 = first.y; until(b, () => b.time >= 66, 67);
  assert.ok(Math.hypot(first.x - 1, first.y - 3) > .5, 'they set out');
  let most = 0; const t0 = b.time;
  while (b.time < t0 + 60) { b.step(); for (const u of b.enemies) if (u.kind !== 'device' && u.alive) b.kill(u, null); most = Math.max(most, m.alive(tunnel).length); }
  assert.equal(most, 5);
  // Used again it gathers: a new Miner Guerrilla waits, and the skill charges from 0.
  m.activate(tunnel.id);
  assert.deepEqual([tunnel.state, Math.floor(tunnel.sp)], ['standby', 0]);
  assert.match(m.error(tunnel.id), /charging/);
  assert.ok(x0 >= 0);
});

test('a facility or a wall stops a Miner Guerrilla beside it and takes 5x its damage; a destroyed facility lifts its pollution', async () => {
  const { b, m } = await open('16-3');
  const facility = at(m, 'polluted-facility', 4, 4), other = at(m, 'polluted-facility', 4, 8), wall = at(m, 'rock-wall', 5, 4);
  const miner = b.spawnEnemy(MINER_GUERRILLA, { pos: [4, 4.85], countInTotal: false, route: { start: [4, 5], steps: [{ t: 'wait', s: 1e9 }] } });
  const hits = [];
  b.on('damaged', c => { if (c.source === miner) hits.push([c.target, c.amount, b.time]); });
  until(b, () => hits.length >= 2, 12);
  assert.equal(!!miner.findBuff('stage:mainline16Bound'), true);
  // 500 ATK against 300 DEF, x5.
  assert.deepEqual(hits.slice(0, 2).map(h => [h[0] === facility.unit, h[1]]), [[true, 1000], [true, 1000]]);
  assert.ok(Math.abs(hits[1][2] - hits[0][2] - 3) < .2);
  // Its own clearing shows the facility to operators.
  assert.equal(m.polluted(4, 4), false);
  strike(b, facility.unit, 30000);
  const t0 = b.time; until(b, () => b.time >= t0 + .1, t0 + 1);
  assert.deepEqual([facility.unit.alive, facility.state, !!miner.findBuff('stage:mainline16Bound')], [false, 'destroyed', false]);
  // The three tiles both facilities cover stay covered by the other; the rest of this one's area is clean.
  assert.deepEqual([m.cover.get('4,6'), m.cover.get('6,3'), m.polluted(6, 3), m.polluted(4, 9)], [1, 0, false, true]);
  assert.equal(deployError(b, 6, 3), null);
  assert.equal(other.unit.alive, true);
  // The wall beside it: out of the stop circle (1 tile away), inside its attack circle.
  hits.length = 0; b.addBuff(miner, { key: 'test:hold', persist: true, flags: { noMove: true } });
  miner.x = 4; miner.y = 4;
  until(b, () => hits.length >= 1, b.time + 6);
  assert.deepEqual([hits[0][0] === wall.unit, hits[0][1]], [true, 1000]);
  assert.match(deployError(b, 5, 4), /unavailable|occupied|ranged|melee/i);
  strike(b, wall.unit, 8000); const t1 = b.time; until(b, () => b.time >= t1 + .1, t1 + 1);
  assert.equal(wall.state, 'destroyed');
});

test('an Army Infiltrator engages one Miner Guerrilla: both stand, it strikes only the miner, and its death frees the miner', async () => {
  const { b } = await open('16-3');
  const op = b._deployOperator('char_151_myrtle', 1, 4, 'RIGHT', { fromSkill: true }); op.profile.noAttack = true;
  const route = { start: [1, 5], steps: [{ t: 'wait', s: 1e9 }] };
  const ghost = b.spawnEnemy(ARMY_INFILTRATOR, { pos: [1, 5], countInTotal: false, route });
  const a = b.spawnEnemy(MINER_GUERRILLA, { pos: [1, 5.9], countInTotal: false, route: { start: [1, 6], steps: [{ t: 'wait', s: 1e9 }] } });
  const c = b.spawnEnemy(MINER_GUERRILLA, { pos: [1, 5.95], countInTotal: false, route: { start: [1, 6], steps: [{ t: 'wait', s: 1e9 }] } });
  ghost.base.maxHp = 1e6; ghost.markDirty(); ghost.hp = ghost.s.maxHp;
  a.base.atk = 0; c.base.atk = 0; a.markDirty(); c.markDirty();
  const hits = [];
  b.on('damaged', x => { if (x.source === ghost) hits.push([x.target, x.type, x.amount]); });
  until(b, () => hits.length >= 2, 10);
  assert.deepEqual([ghost.s.maxHp > 0, !!ghost.s.flags.unblockable, ghost.blockedBy ?? null], [true, true, null]);
  const held = [a, c].filter(u => u.findBuff('ab:minerEngaged'));
  assert.equal(held.length, 1, 'one Miner Guerrilla at a time');
  assert.equal(!!ghost.findBuff('ab:minerEngaging'), true);
  assert.deepEqual([!!ghost.s.flags.noMove, !!held[0].s.flags.noMove], [true, true]);
  // 400 ATK against 150 DEF; the operator beside it is never struck.
  assert.ok(hits.length >= 2 && hits.every(h => [a, c].includes(h[0]) && h[1] === 'phys' && h[2] === 250), JSON.stringify(hits.map(h => h.slice(1))));
  b.kill(ghost, null);
  const t0 = b.time; until(b, () => b.time >= t0 + .1, t0 + 1);
  assert.equal(!!held[0].findBuff('ab:minerEngaged'), false);
});

test('16-3 and its six-star variant run to the end with their counts and without errors', async () => {
  const normal = await open('16-3');
  const seen = new Set(); normal.b.on('enemySpawn', ({ enemy }) => seen.add(enemy.def?.key));
  until(normal.b, () => normal.b.finished, 500);
  // PRTS: 22 enemies (10 beasts, 4 crossbowmen, 8 Infiltrators); the hidden group `raid` is not in the base stage.
  assert.deepEqual([normal.b.total, (normal.b.errors ?? []).length, normal.b.finished, seen.has(ARMY_INFILTRATOR), seen.has(MINER_GUERRILLA)], [22, 0, true, true, true]);
  const six = await open('16-3_six_star');
  const ghost = six.stage.enemies[ARMY_INFILTRATOR].stats;
  assert.deepEqual([six.life, ghost.maxHp, Math.round(ghost.atk), Math.round(ghost.def), at(six.m, 'polluted-facility', 4, 4).unit.s.maxHp], [1, 6000, 440, 220, 30000]);
  // Sending the miners out as soon as three wait: both facilities fall and the pollution is gone.
  const { b, m } = six, tunnel = m.tunnels[0];
  until(b, () => { if (tunnel.state === 'standby' && !m.error(tunnel.id) && m.waiting(tunnel).length >= 3) m.activate(tunnel.id); return b.finished; }, 500);
  assert.deepEqual([(b.errors ?? []).length, b.finished, b.total], [0, true, 22]);
});
