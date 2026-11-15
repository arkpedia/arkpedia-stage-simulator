// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { devourNative } from '../shared/arkpedia/enemy-devour-features.js';
import { nativeComponents, enemySupport } from '../shared/arkpedia/enemy-support.js';
import { holdDeploymentCard, cardLockError } from '../server/sim/content/arkpedia-card-locks.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1271_nhkodo', 'enemy_1271_nhkodo_2'];
function fixture(id = ids[0], { immune = false, token = false } = {}) {
  const r = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); r.stats.moveSpeed = 0;
  const op = chessRec({ id: 'devour_target', stats: { atk: 0, maxHp: 1e6, blockCnt: 3 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 300,
    defs: { enemies: { [id]: r }, chess: { [op.chessId]: op } },
    kits: { [op.chessId]: () => ({ trait: { noAttack: true } }) },
    units: [{ chessId: op.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  h.b.start(); const u = h.b.allyUnits[0]; if (immune) u.tags.add('DEVOUR_IMMU'); if (token) u.kind = 'token';
  h.b.bench = { [u.defId]: { unit: u, readyAt: 90 } };
  const e = h.b.spawnEnemy(id, { pos: [9, 6] }); h.b._checkBlock(e);
  return { ...h, e, u, entry: h.b.bench[u.defId] };
}
test('both Devourers defeat their first blocker at the source marker, hold its card and gain permanent stats', () => {
  for (const id of ids) {
    const f = fixture(id); f.run(.7); assert.equal(f.u.alive, true); assert.equal(f.e.s.def, 0);
    f.run(.3); assert.equal(f.u.alive, false); assert.ok(cardLockError(f.entry));
    assert.equal(f.b.unitAt(9, 6), null); assert.equal(f.e.s.def, 700);
    assert.equal(f.e.mem.regularFormVisual.idle, 'Idle_B');
    f.run(1); f.b.kill(f.e); assert.equal(cardLockError(f.entry), null); assert.equal(f.entry.readyAt, f.b.time);
    assert.deepEqual(f.b.errors, []);
  }
});
test('a swallowed summon dies normally without locking an operator card; immunity leaves the skill unspent', () => {
  const token = fixture(ids[0], { token: true }); token.run(1.1);
  assert.equal(token.u.alive, false); assert.equal(cardLockError(token.entry), null); assert.equal(token.e.s.def, 700);
  const f = fixture(ids[0], { immune: true }); f.run(1.2); assert.equal(f.u.alive, true); assert.equal(f.e.s.def, 0);
  f.u.tags.delete('DEVOUR_IMMU'); f.run(1.2); assert.equal(f.u.alive, false); assert.equal(f.e.s.def, 700);
  assert.deepEqual(f.b.errors, []);
});
test('Slow Down stretches the cast; control or lost blocker cancels an unreleased swallow', () => {
  const f = fixture(); f.b.addBuff(f.e, { key: 'slow', mods: { slowDownMul: .5 } });
  f.run(1.2); assert.equal(f.u.alive, true); f.run(.6); assert.equal(f.u.alive, false);
  for (const action of ['stun', 'retreat', 'replacement', 'death']) {
    const g = fixture(); g.run(.3);
    if (action === 'stun') g.b.applyStatus(g.e, 'stun', { duration: 3 });
    if (action === 'retreat') g.b.retreat(g.u, { permanent: true });
    if (action === 'replacement') g.u.deploySeq++;
    if (action === 'death') g.b.kill(g.e);
    g.run(.7); assert.equal(cardLockError(g.entry), null, action); assert.equal(g.e.s.def, 0, action);
    assert.deepEqual(g.b.errors, []);
  }
});
test('source exit releases the card immediately and independent holds preserve each other', () => {
  const f = fixture(); f.run(1); const other = holdDeploymentCard(f.b, f.u, {}, { message: 'Other owner' });
  f.b.leak(f.e); assert.equal(cardLockError(f.entry), 'Other owner'); assert.equal(f.entry.readyAt, 90);
  other(); assert.equal(cardLockError(f.entry), null); assert.equal(f.entry.readyAt, f.b.time);
  f.entry.removedFromDeck = true; f.entry.readyAt = Infinity;
  const release = holdDeploymentCard(f.b, f.u, {}, { message: 'Hold', readyOnRelease: true }); release();
  assert.equal(f.entry.readyAt, Infinity); assert.deepEqual(f.b.errors, []);
});
test('InstantKill preserves core rebirth and the source cannot swallow a second blocker', () => {
  const f = fixture(); let reborn = 0;
  f.b.on('kill', ({ victim }) => { if (victim === f.u && !reborn++) victim.hp = 5000; }, { priority: 2000 });
  f.run(1); assert.equal(f.u.alive, true); assert.ok(cardLockError(f.entry)); assert.equal(reborn, 1);
  f.run(6); assert.equal(reborn, 1); assert.equal(f.e.stats.attacks > 0, true);
  assert.deepEqual(f.b.errors, []);
});
test('admission rejects changed card release, immunity filters and mode effects', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence).policy);
  for (const kind of ['release', 'rebirth', 'mode', 'stats']) {
    const ev = structuredClone(evidence), r = structuredClone(ENEMY_RECORDS.enemies[ids[0]].levels[0]);
    if (kind === 'release') ev.templates['enemy_nhkodo_t[devour]'].eventToActions.ON_BUFF_FINISH.pop();
    if (kind === 'rebirth') ev.templates['enemy_nhkodo_t[devour]'].eventToActions.ON_BUFF_START[0]._succeedNodes[4]._skipReborn = true;
    if (kind === 'mode') ev.templates.switch_mode_no_restore.eventToActions.ON_BUFF_START[0]._restartFSM = false;
    if (kind === 'stats') r.talents.bb['Stronger.def'] = 1000;
    assert.equal(devourNative(r, nativeComponents(ev, ids[0])), false, kind);
  }
});
test('original 11-14 cards reject manual and skill redeployment until the Devourer leaves', async () => {
  const { loadContentContext, planStage } = await import('../tools/arkpedia/content-inventory.mjs');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const c = await loadContentContext(), p = await planStage(c, '11-14', { waves: true });
  assert.deepEqual(p.blockers, []);
  const b = new StandardBattle({ ...c.mvp, stage: p.stage, enemies: { ...c.mvp.enemies, ...p.stage.enemies } },
    { operators: [defaultBuild(c.mvp.operators.char_123_fang)] });
  b.setViewport('fullscreen-workspace'); b.start(); b.addDp('arkpedia', 99);
  const tiles = [];
  for (let row = b.rect.r0; row <= b.rect.r1; row++) for (let col = b.rect.c0; col <= b.rect.c1; col++) tiles.push({ row, col });
  let u;
  for (const t of tiles) {
    if (!b.placementError('char_123_fang', t.row, t.col)) { u = b.deployOperator('char_123_fang', t.row, t.col, 'RIGHT'); break; }
  }
  assert.ok(u, 'a valid melee deployment tile');
  u.base.maxHp = 1e6; u.hp = 1e6; u.profile.noAttack = true; u.markDirty();
  const e = b.spawnEnemy(ids[0], { pos: [u.tileR, u.tileC], countInTotal: false }); b._checkBlock(e);
  while (b.time < 1.2 && !b.finished) b.step();
  assert.equal(u.alive, false); assert.match(b.deploymentRestrictionError(u.defId), /Devoured/);
  assert.match(b.placementError(u.defId, u.tileR, u.tileC), /Devoured/);
  assert.throws(() => b.redeployOperatorFromSkill(u.defId, u.tileR, u.tileC, 'RIGHT'), /Devoured/);
  b.kill(e); assert.equal(b.deploymentRestrictionError(u.defId), null);
  assert.equal(b.bench[u.defId].readyAt, b.time); b.addDp('arkpedia', 99);
  assert.equal(b.placementError(u.defId, u.tileR, u.tileC), null);
  const again = b.deployOperator(u.defId, u.tileR, u.tileC, 'RIGHT');
  assert.equal(again.defId, u.defId); assert.equal(again.alive, true); assert.notEqual(again.deploySeq, u.deploySeq);
  assert.deepEqual(b.errors, []);
});
