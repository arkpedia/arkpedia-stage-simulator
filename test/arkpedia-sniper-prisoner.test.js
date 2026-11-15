// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { sniperPrisonerNative } from '../shared/arkpedia/enemy-prisoner-features.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1117_liiprr', 'enemy_1117_liiprr_2'];
function fixture(id = ids[0], { tagged = true } = {}) {
  const r = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); r.stats.moveSpeed = 0;
  const ops = ['prison_target', 'prison_decoy'].map((id, i) => chessRec({ id,
    stats: { maxHp: 1e6, atk: 0, def: 0, res: 0, blockCnt: 0, tauntLevel: i ? 99 : 0 }, skill: null }));
  const h = makeBattle({ content: 'none', autoFinish: false, captureNoisy: true, timeLimit: 300,
    defs: { enemies: { [id]: r }, chess: Object.fromEntries(ops.map(op => [op.chessId, op])) },
    kits: Object.fromEntries(ops.map(op => [op.chessId, () => ({ trait: { noAttack: true } })])),
    units: ops.map((op, i) => ({ chessId: op.chessId, row: 9, col: i ? 5 : 6 })), setup: installEnemyFeatures });
  h.b.start(); const [target, decoy] = h.b.allyUnits; if (tagged) target.tags.add('prison');
  const e = h.b.spawnEnemy(id, { pos: [9, 4] });
  const hits = []; h.b.on('damaged', c => { if (c.source === e) hits.push({ ...c, time: h.b.time }); });
  return { ...h, e, target, decoy, hits, state: e.mem.ab.list.find(a => a.confine) };
}
test('tagged Imprisonment targets outrank taunt while selection still rejects camouflage and distant tags', () => {
  const f = fixture(); f.run(1.6); assert.equal(f.hits.length, 1); assert.equal(f.hits[0].target, f.target);
  const g = fixture(); g.b.addBuff(g.target, { key: 'camou', flags: { camou: true } }); g.run(1.6);
  assert.equal(g.hits[0].target, g.decoy);
  const h = fixture(); h.target.x = 10; h.run(1.6); assert.equal(h.hits[0].target, h.decoy);
  for (const x of [f, g, h]) assert.deepEqual(x.b.errors, []);
});
test('both variants keep four physical casts, then use liberated Arts projectiles and ATK', () => {
  for (const id of ids) {
    const f = fixture(id); assert.equal(f.e.s.aspd, 50); f.run(.8); assert.equal(f.hits.length, 0);
    f.run(22); assert.ok(f.hits.length >= 5); assert.deepEqual(f.hits.slice(0, 5).map(h => h.dmg.type), ['phys', 'phys', 'phys', 'phys', 'arts']);
    assert.equal(f.state.mode, 2); assert.equal(f.e.s.aspd, 100); assert.equal(f.e.s.atk, f.e.base.atk * 1.5);
    assert.equal(f.hits[4].dmg.amount, f.e.s.atk); assert.ok(['Attack3', 'Idle3'].includes(f.e.mem.regularFormVisual.clip));
    assert.equal(f.hits.every(h => h.dmg.isAttack && h.dmg.applyWay === 'ranged'), true); assert.deepEqual(f.b.errors, []);
  }
});
test('warning mode keeps confinement until the next attack; reconfinement resets counts and future casts', () => {
  const f = fixture(); f.run(12.2); assert.equal(f.state.mode, 1); assert.equal(f.e.s.aspd, 50);
  const n = f.state.n; f.state.confine(f.b, f.e, f.state); assert.equal(f.state.n, n); assert.equal(f.state.mode, 1);
  f.run(8); assert.equal(f.state.free, true);
  f.state.confine(f.b, f.e, f.state); assert.equal(f.state.mode, 0); assert.equal(f.state.n, 0);
  assert.equal(f.e.s.aspd, 50); assert.equal(f.e.s.atk, f.e.base.atk);
  f.e.atkCd = 0; f.run(2); assert.equal(f.hits.at(-1).dmg.type, 'phys'); assert.deepEqual(f.b.errors, []);
});
test('Palsy does not consume an attack count; control cancels an unreleased projectile', () => {
  const f = fixture(); f.b.addBuff(f.e, { key: 'palsy', stacks: 1 }); f.run(.2);
  assert.equal(f.state.n, 0); assert.equal(f.e.stats.attacks, 0);
  const g = fixture(); g.run(.3); g.b.applyStatus(g.e, 'stun', { duration: 3 }); g.run(1.5);
  assert.equal(g.hits.length, 0); assert.equal(g.e.mem.regularFormVisual.clip, 'Idle'); assert.deepEqual(g.b.errors, []);
});
test('released projectiles outlive the source and cannot hit a replacement deployment', () => {
  const f = fixture(); f.run(1.05); f.b.kill(f.e); f.run(.6); assert.equal(f.hits.length, 1);
  const g = fixture(); g.run(1.05); g.target.deploySeq++; g.b.kill(g.e); g.run(.6); assert.equal(g.hits.length, 0);
  assert.deepEqual(f.b.errors, []); assert.deepEqual(g.b.errors, []);
});
test('native admission checks the device tag, warning transition and Arts mode', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence).policy);
  for (const kind of ['tag', 'counter', 'restart']) {
    const ev = structuredClone(evidence);
    if (kind === 'counter') ev.templates['enemy_confinement[atk_cnt]'].eventToActions.ON_BEFORE_ATTACK[2]._stackCount = 2;
    if (kind === 'restart') ev.templates['enemy_liberty_listener[warning]'].eventToActions.ON_BEFORE_ATTACK[1]._restartFSM = true;
    if (kind === 'tag') {
      const row = ev.prefabs[`dyn/battle/prefabs/enemies/${ids[0]}.prefab`].find(c => JSON.parse(c.originalJson)._filterTag === 'prison');
      const d = JSON.parse(row.originalJson); d._filterTag = 'other'; row.originalJson = JSON.stringify(d);
    }
    assert.equal(sniperPrisonerNative(ENEMY_RECORDS.enemies[ids[0]].levels[0], nativeComponents(ev, ids[0])), false, kind);
  }
});
test('original MB-1 loads the Sniper Prisoner and resolves the complete wave schedule', async () => {
  const { loadContentContext, planStage } = await import('../tools/arkpedia/content-inventory.mjs');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const c = await loadContentContext(), p = await planStage(c, 'mb-1', { waves: true }); assert.deepEqual(p.blockers, []);
  const b = new StandardBattle({ ...c.mvp, stage: p.stage, enemies: { ...c.mvp.enemies, ...p.stage.enemies } },
    { operators: [defaultBuild(c.mvp.operators.char_123_fang)] });
  let snipers = 0;
  b.on('enemySpawn', ({ enemy }) => { if (ids.includes(enemy.defId)) snipers++; b.after(.5, () => b.kill(enemy)); });
  const life = b.life; b.start(); b.runToEnd(600);
  assert.equal(b.reason, 'cleared'); assert.ok(snipers > 0); assert.equal(b.life, life); assert.deepEqual(b.errors, []);
});
