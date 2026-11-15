// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { spawnCarapace, canSpawnCarapace } from '../server/sim/content/arkpedia-stage-carapaces.js';
import { carapaceNativeReviewed, carapaceDefinition } from '../shared/arkpedia/stage-carapaces.js';
import { depositorNative } from '../shared/arkpedia/enemy-depositor-features.js';
import { nativeComponents, enemySupport } from '../shared/arkpedia/enemy-support.js';
import { grantCardRedeployRatio, cardRedeployRatio } from '../server/sim/content/arkpedia-card-redeploy.js';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const id = 'enemy_1434_dsshel';
function fixture() {
  const op = chessRec({ id: 'carapace_guest', position: 'RANGED', stats: { atk: 0, blockCnt: 2 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false,
    defs: { enemies: { [id]: ENEMY_RECORDS.enemies[id].levels[0], hit: enemyRec({ key: 'hit', atk: 1000, speed: 0 }) }, chess: { [op.chessId]: op } },
    units: [{ chessId: op.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  h.b.start(); const u = h.b.allyUnits[0]; h.b.retreat(u, { permanent: true });
  return { ...h, u };
}
test('a defeated Depositor creates one level-one allied platform; exit and occupied/gate tiles do not', () => {
  const f = fixture(); const e = f.b.spawnEnemy(id, { pos: [9, 6] }); f.b.kill(e);
  const host = f.b.unitAt(9, 6); assert.equal(host.defId, 'trap_156_dsshell'); assert.equal(host.hp, 3000);
  assert.equal(host.s.def, 320); assert.equal(host.s.blockCnt, 20); assert.equal(host.deploymentSlotCost, 0);
  assert.equal(f.b.regularTileBuild(9, 6), 'RANGED'); assert.equal(f.b.grid.groundPassable(9, 6), false);
  const second = f.b.spawnEnemy(id, { pos: [9, 6] }); f.b.kill(second); assert.equal(f.b.unitAt(9, 6), host);
  const exit = f.b.spawnEnemy(id, { pos: [9, 7] }); f.b.leak(exit); assert.equal(f.b.unitAt(9, 7), null);
  f.b.grid.tiles[9 * 21 + 7] = { ...f.b.grid.tile(9, 7), key: 'tile_end' }; assert.equal(canSpawnCarapace(f.b, 9, 7), false);
  f.b.grid.tiles[9 * 21 + 7] = { ...f.b.grid.tile(9, 7), key: 'tile_floor', height: 'HIGH' }; assert.equal(canSpawnCarapace(f.b, 9, 7), false);
  assert.deepEqual(f.b.errors, []);
});
test('a platform hosts a ranged guest, keeps tile ownership, and releases geometry before defeating its occupant', () => {
  const f = fixture(), host = spawnCarapace(f.b, 9, 6); assert.ok(f.b._deploy(f.u, { tile: [9, 6] }));
  assert.equal(host.mem.regularHost.guest, f.u); assert.equal(f.b.unitAt(9, 6), host); assert.equal(f.u.ground, false);
  assert.equal(f.u.s.flags.noBlock, true); assert.equal(f.b.stageOutcomes.counters.dsshell_overlapped, 1);
  f.b.kill(host); assert.equal(f.u.alive, false); assert.equal(f.b.unitAt(9, 6), null);
  assert.equal(f.b.regularTileBuild(9, 6), null); assert.equal(f.b.grid.groundPassable(9, 6), true);
  assert.equal(f.b.platformTiles.has('9,6'), false); assert.deepEqual(f.b.errors, []);
});
test('host death preserves core rebirth and restores a surviving guest to ordinary terrain', () => {
  const f = fixture(), host = spawnCarapace(f.b, 9, 6); f.b._deploy(f.u, { tile: [9, 6] });
  f.b.on('kill', ({ victim }) => { if (victim === f.u) victim.hp = 10; });
  f.b.kill(host); assert.equal(f.u.alive, true); assert.equal(f.u.ground, true);
  assert.equal(f.b.unitAt(9, 6), f.u); assert.equal(f.u.mem.regularHostedBy, undefined); assert.equal(f.u.s.flags.noBlock, undefined);
  assert.deepEqual(f.b.errors, []);
});
test('host receives the original immunity and cannot be healed or selected by an unrelated ranged enemy', () => {
  const f = fixture(), host = spawnCarapace(f.b, 9, 6);
  for (const s of ['stun', 'freeze', 'sleep', 'levitate']) f.b.applyStatus(host, s, { duration: 2 });
  assert.equal(host.canAct, true); assert.equal(host.s.flags.noHeal, true); assert.equal(host.s.flags.targetFree, true);
  const e = f.b.spawnEnemy('hit', { pos: [9, 6] }); f.b._checkBlock(e); assert.equal(e.blockedBy, host);
  const hp = host.hp; f.run(.2); assert.ok(host.hp < hp); assert.deepEqual(f.b.errors, []);
});
test('card redeploy ratios apply once and adjust an existing cooldown from its removal time', () => {
  const f = fixture(); f.u.kind = 'op'; f.b.bench = { [f.u.defId]: { unit: f.u, readyAt: 70 } };
  grantCardRedeployRatio(f.b, f.u, 'source', -.35); const entry = f.b.bench[f.u.defId];
  assert.equal(cardRedeployRatio(entry), .65); assert.equal(entry.readyAt, 45.5);
  grantCardRedeployRatio(f.b, f.u, 'source', -.35); assert.equal(entry.readyAt, 45.5);
  assert.equal(carapaceDefinition({ level: 30, skillLevel: 1 }).hp, 5000);
  assert.equal(carapaceDefinition({ level: 30, skillLevel: 1 }).def, 100);
});
test('source admission rejects changed spawn tile restrictions, card effects and platform destruction', () => {
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence).policy); assert.equal(carapaceNativeReviewed(), true);
  const ev = structuredClone(evidence); ev.templates.dsshel_t_1.eventToActions.ON_OWNER_KILLED[0]._options.checkHeightType = false;
  assert.equal(depositorNative(ENEMY_RECORDS.enemies[id].levels[0], nativeComponents(ev, id)), false);
  for (const which of ['kill', 'ratio']) {
    const n = structuredClone(native);
    if (which === 'kill') n.templates.trap_156_dsshell_passive.eventToActions.ON_OWNER_FINISH[0]._skipReborn = true;
    if (which === 'ratio') n.templates['trap_156_dsshell[ref]'].eventToActions.ON_OWNER_BEFORE_DEAD[0]._isRatio = false;
    assert.equal(carapaceNativeReviewed(n), false);
  }
});
test('original BP-2 loads reusable death platforms and resolves its complete wave schedule', async () => {
  const { loadContentContext, planStage } = await import('../tools/arkpedia/content-inventory.mjs');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const c = await loadContentContext(), p = await planStage(c, 'bp-2', { waves: true }); assert.deepEqual(p.blockers, []);
  const b = new StandardBattle({ ...c.mvp, stage: p.stage, enemies: { ...c.mvp.enemies, ...p.stage.enemies } },
    { operators: [defaultBuild(c.mvp.operators.char_123_fang)] });
  b.on('enemySpawn', ({ enemy }) => b.after(.5, () => b.kill(enemy)));
  const initialLife = b.life; b.start(); b.runToEnd(600); assert.equal(b.reason, 'cleared'); assert.deepEqual(b.errors, []);
  assert.ok(b.units.some(u => u.defId === 'trap_156_dsshell')); assert.equal(b.life, initialLife);
});
test('a static level-30 platform accepts a real ranged card and grants one discounted redeployment', async () => {
  const { loadContentContext, planStage } = await import('../tools/arkpedia/content-inventory.mjs');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const c = await loadContentContext(), p = await planStage(c, 'bp-2', { waves: true }), g = p.stage.geometry;
  const tiles = g.tileGrid.flatMap((line, row) => line.map((i, col) => ({ row, col, tile: g.tileLegend[i] })));
  const t = tiles.find(t => t.tile.walkable && t.tile.height.toUpperCase() === 'LOW'
    && !['tile_start', 'tile_end', 'tile_telin', 'tile_telout'].includes(t.tile.key));
  const stage = { ...p.stage, devices: [...p.stage.devices, { key: 'trap_156_dsshell', kind: 'device', name: 'Excrescent Carapace',
    row: t.row, col: t.col, hidden: false, instance: { level: 30, skillLevel: 1 } }] };
  const b = new StandardBattle({ ...c.mvp, stage, enemies: { ...c.mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(c.mvp.operators.char_124_kroos)] });
  b.setViewport('fullscreen-workspace'); b.start(); b.addDp('arkpedia', 99);
  const host = b.unitAt(t.row, t.col); assert.equal(host.hp, 5000); assert.equal(host.s.def, 100);
  assert.equal(b.placementError('char_124_kroos', t.row, t.col), null);
  const u = b.deployOperator('char_124_kroos', t.row, t.col, 'RIGHT'); assert.equal(u.ground, false);
  b.kill(host); assert.equal(u.alive, false); const entry = b.bench[u.defId];
  assert.equal(entry.readyAt - b.time, 45.5);
  b.time = entry.readyAt + .01; b.addDp('arkpedia', 99); spawnCarapace(b, t.row, t.col);
  const again = b.deployOperator(u.defId, t.row, t.col, 'RIGHT'); assert.equal(entry.redeployRatios, undefined);
  b.kill(again); assert.equal(entry.readyAt - b.time, 70); assert.deepEqual(b.errors, []);
});
