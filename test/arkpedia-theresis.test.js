// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { nativeComponents, enemySupport } from '../shared/arkpedia/enemy-support.js';
import { theresisNative } from '../shared/arkpedia/enemy-theresis-features.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const id = 'enemy_1276_telex';
function fixture({ kaltsit = true } = {}) {
  const r = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); r.stats.moveSpeed = 0;
  const ops = ['slash_bystander', kaltsit ? 'char_003_kalts' : 'kaltsit_decoy', 'slash_outside'].map(id =>
    chessRec({ id, stats: { atk: 0, maxHp: 10000, blockCnt: 0 }, skill: null }));
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 100,
    defs: { enemies: { [id]: r }, chess: Object.fromEntries(ops.map(op => [op.chessId, op])) },
    units: ops.map((op, i) => ({ chessId: op.chessId, row: i === 2 ? 10 : 9, col: i === 1 ? 8 : 6 })),
    setup: installEnemyFeatures });
  h.b.start(); const e = h.b.spawnEnemy(id, { pos: [9, 4] });
  return { ...h, e, bystander: h.b.allyUnits[0], kaltsit: h.b.allyUnits[1], outside: h.b.allyUnits[2] };
}
test('Theresis is untargetable, invulnerable and unblockable, with zero exit cost', () => {
  const f = fixture(); assert.equal(f.e.profile.noAttack, true); assert.equal(f.e.lpr, 0);
  assert.equal(f.b.dealDamage(f.bystander, f.e, { amount: 1e9, type: 'true' }), 0);
  f.bystander.base.blockCnt = 99; f.bystander.markDirty(); f.e.x = f.bystander.x;
  assert.equal(f.b._checkBlock(f.e), false);
  f.b.leak(f.e); assert.equal(f.e.alive, false);
  assert.equal(f.b._pp('p1').leaked[0].lpr, 0); assert.deepEqual(f.b.errors, []);
});
test('the source Kaltsit filter cannot be lured by another identity', () => {
  const f = fixture({ kaltsit: false }); f.run(30);
  assert.equal(f.bystander.alive, true); assert.equal(f.kaltsit.alive, true);
  assert.equal(f.b.projectiles.list.some(p => p.data?.theresisSlash), false); assert.deepEqual(f.b.errors, []);
});
test('Theresis releases one swept wave at the original marker, hitting multiple recipients along its path', () => {
  const f = fixture(); f.run(18.2); assert.equal(f.bystander.alive, true); assert.equal(f.kaltsit.alive, true);
  f.run(1.1); assert.equal(f.bystander.alive, false); assert.equal(f.kaltsit.alive, false);
  assert.equal(f.outside.alive, true); assert.equal(f.b.projectiles.list.filter(p => p.data?.theresisSlash).length, 1);
  f.run(5); assert.equal(f.e.mem.regularFormVisual, null); assert.equal(f.e.profile.noAttack, true);
  assert.deepEqual(f.b.errors, []);
});
test('a released wave survives source death and reaches airborne bystanders', () => {
  const f = fixture(); f.bystander.motion = 'FLY'; f.run(18.4); f.b.kill(f.e); f.run(1);
  assert.equal(f.bystander.alive, false); assert.equal(f.kaltsit.alive, false);
  assert.equal(f.outside.alive, true); assert.deepEqual(f.b.errors, []);
});
test('InstantKill preserves existing rebirth handlers and the same wave does not hit that deployment twice', () => {
  const f = fixture(); let revivals = 0;
  f.b.on('kill', ({ victim }) => { if (victim === f.bystander && revivals++ === 0) victim.hp = 100; });
  f.run(19.4); assert.equal(revivals, 1); assert.equal(f.bystander.alive, true); assert.equal(f.kaltsit.alive, false);
  assert.deepEqual(f.b.errors, []);
});
test('native admission rejects changed lethal payload and life-point cost', () => {
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence).policy);
  const ev = structuredClone(evidence); ev.templates['enemy_telex_t[kill]'].eventToActions.ON_BUFF_START[1]._skipReborn = true;
  assert.equal(theresisNative(ENEMY_RECORDS.enemies[id].levels[0], nativeComponents(ev, id)), false);
  const changed = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); changed.stats.lpr = 1;
  assert.equal(theresisNative(changed, nativeComponents(evidence, id)), false);
});
test('original 11-17 resolves its narrative actor, literal Rot Eater floor and complete wave schedule', async () => {
  const c = await loadContentContext(), p = await planStage(c, '11-17', { waves: true });
  assert.deepEqual(p.blockers, []);
  assert.equal(p.stage.enemies.enemy_1266_nhapos.talents.bb['PollutedArea.guaranteed_percentage'], 1);
  const b = new StandardBattle({ ...c.mvp, stage: p.stage,
    operators: { ...c.mvp.operators, ...p.stage.operators }, enemies: { ...c.mvp.enemies, ...p.stage.enemies } },
  { operators: [defaultBuild(c.mvp.operators.char_123_fang)] });
  let slashes = 0; const add = b.addProjectile.bind(b);
  b.addProjectile = p => { if (p.data?.theresisSlash) slashes++; return add(p); };
  b.on('enemySpawn', ({ enemy }) => { if (enemy.defId !== id) b.after(.05, () => b.kill(enemy)); });
  const life = b.life; b.start(); b.runToEnd(600);
  assert.equal(b.reason, 'cleared'); assert.equal(b.life, life); assert.equal(slashes, 1);
  const kaltsit = b.allyUnits.find(u => u.defId === 'char_003_kalts');
  assert.equal(kaltsit.alive, false); assert.equal(kaltsit.removeReason, 'killed'); assert.deepEqual(b.errors, []);
});
