// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemyRuntimeRecord } from '../shared/arkpedia/enemy-features.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { DREADKAZ, EPOCH_MARK, dreadkazNative, epochMarkNative, epochEnvironmentNative } from '../shared/arkpedia/enemy-epoch-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import environment from '../data/arkpedia-environment-native-source.json' with { type: 'json' };
import { canTargetEnemy } from '../server/sim/targeting.js';
import { StageWaveScheduler } from '../server/sim/content/arkpedia-stage-waves.js';
import { installParasiticEnvironment } from '../server/sim/content/arkpedia-stage-parasitic.js';
function fixture({ autoFinish = false, enemies = [] } = {}) {
  const target = chessRec({ id: 'epoch_target', stats: { atk: 0, maxHp: 1e6, res: 25, blockCnt: 0 }, skill: null });
  const defs = Object.fromEntries([DREADKAZ, EPOCH_MARK].map(id => [id, enemyRuntimeRecord(ENEMY_RECORDS.enemies[id].levels[0])]));
  const h = makeBattle({ content: 'generic', autoFinish, captureNoisy: true, enemies,
    defs: { enemies: { ...defs, host: enemyRec({ key: 'host', hp: 100, speed: 0 }) }, chess: { [target.chessId]: target } },
    kits: { [target.chessId]: () => ({ trait: { noAttack: true } }) }, units: [{ chessId: target.chessId, row: 9, col: 6 }],
    setup: installEnemyFeatures });
  h.b.start(); const u = h.b.allyUnits[0];
  const mark = pos => h.b.spawnEnemy(EPOCH_MARK, { pos: pos ?? [9, 6] });
  return { ...h, u, mark };
}
// elementHit is noisy and not in the shared harness's default hook list.
function capture(f) { const rows = []; f.b.on('elementHit', c => rows.push({ ...c, amount: c.dmg.amount })); return rows; }
test('native Epoch chain covers both records and rejects changes to side, range, clocks and summon effects', () => {
  for (const id of [DREADKAZ, EPOCH_MARK]) {
    assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, native).policy);
    assert.deepEqual(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, native).spawns, id === DREADKAZ ? [EPOCH_MARK] : []);
  }
  assert.equal(epochEnvironmentNative(), true);
  for (const kind of ['side', 'range', 'flag', 'duration', 'element', 'overlap']) {
    const ev = structuredClone(native), env = structuredClone(environment), id = kind === 'duration' ? DREADKAZ : EPOCH_MARK;
    if (kind === 'side' || kind === 'flag') {
      const row = ev.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`].find(c => c.objectName === (kind === 'side' ? id : 'Apoptosis') && !c.referenced);
      const c = JSON.parse(row.originalJson);
      if (kind === 'side') c._sideTypeIndex = 1; else c._buffs[0].attributes.abnormalFlags.pop();
      row.originalJson = JSON.stringify(c);
    }
    if (kind === 'range') ev.ranges['x-4'].grids.pop();
    if (kind === 'duration') ev.templates['skzjs_t[born_action]'].eventToActions.ON_BUFF_FINISH[4]._buffToEnemy.durationKey = 'other';
    if (kind === 'element') env.templates['rogue_4_apoptosis[ally]'].eventToActions.ON_BUFF_TRIGGER[2]._noSource = false;
    if (kind === 'overlap') env.templates.rogue_4_apoptosis.eventToActions.ON_BUFF_START[0]._succeedNodes[0]._buff.overrideType = 'STACK';
    assert.equal(['element', 'overlap'].includes(kind) ? epochEnvironmentNative(env)
      : (id === DREADKAZ ? dreadkazNative : epochMarkNative)(ENEMY_RECORDS.enemies[id].levels[0], nativeComponents(ev, id)), false, kind);
  }
});
test('neutral actor metadata is atomic, immutable, uncounted and outside enemy selectors', () => {
  const original = ENEMY_RECORDS.enemies[EPOCH_MARK].levels[0], compiled = enemyRuntimeRecord(original);
  assert.equal(compiled.side, 'neutral'); assert.equal(original.side, undefined);
  const f = fixture(), m = f.mark(); f.step(1);
  assert.equal(m.side, 'neutral'); assert.equal(m.counted, false); assert.equal(f.b.total, 0);
  assert.equal(canTargetEnemy(f.u, m, { canHitFly: true, ignoreTargetFree: () => true }), false);
  assert.equal(f.b.enemiesInRadius(m.x, m.y, 5).includes(m), false);
  assert.equal(f.b._displaceable(m), false);
  assert.equal(f.b.dealDamage(f.u, m, { type: 'true', amount: 1e9 }), 0);
  const before = [m.x, m.y]; f.run(3); assert.deepEqual([m.x, m.y], before); assert.deepEqual(f.b.errors, []);
});
test('a scheduled neutral actor does not inflate totals, block its wave or prevent victory', () => {
  const f = fixture({ autoFinish: true, enemies: [{ key: EPOCH_MARK, time: 0, pos: [9, 6] }] }); f.step(1);
  assert.equal(f.b.total, 0); assert.equal(f.b.finished, true);
  const m = f.b.neutralUnits.find(u => u.defId === EPOCH_MARK);
  const scheduler = new StageWaveScheduler(f.b, { schemaVersion: 1, waves: [] });
  assert.equal(scheduler.blocksWave(m), false); assert.equal(f.b.leakedCount, 0);
});
test('overlapping tile emitters share one delayed clock and preserve it when either source expires', () => {
  const f = fixture(), seen = capture(f), a = f.mark([9, 6]), c = f.mark([9, 7]);
  assert.equal(f.b.stageEpoch.tiles.size, 8); f.run(.8); assert.equal(seen.length, 0);
  f.b.kill(a); f.run(.3); assert.equal(seen.length, 1); assert.equal(seen[0].amount, 100);
  assert.equal(seen[0].source, null); assert.equal(seen[0].dmg.isEnvironment, false);
  f.run(1); assert.equal(seen.length, 2);
  f.b.kill(c); assert.equal(f.b.stageEpoch.tiles.size, 0); assert.equal(f.u.findBuff('rogue_4_apoptosis[ally]'), null);
  f.run(2); assert.equal(seen.length, 2); assert.deepEqual(f.b.errors, []);
});
test('leaving and redeploying restart the contact clock; filter-tagged allies and enemies take no element damage', () => {
  const f = fixture(), seen = capture(f); f.mark(); f.run(.6);
  f.u.x = 2; f.u.tileC = 2; f.step(1); assert.equal(f.u.findBuff('rogue_4_apoptosis[ally]'), null);
  f.u.x = 6; f.u.tileC = 6; f.step(1); f.run(.8); assert.equal(seen.length, 0);
  f.run(.3); assert.equal(seen.length, 1);
  f.u.tags.add('rogue_4_skhbox'); f.run(1); assert.equal(seen.length, 1); f.u.tags.delete('rogue_4_skhbox');
  const e = f.b.spawnEnemy('host', { pos: [9, 6] }); f.run(.4); assert.ok(e.findBuff('rogue_4_apoptosis[enemy]')); assert.equal(e.elem.apoptosis, 0);
  f.b._remove(f.u, 'retreat'); f.b._deploy(f.u, { tile: [9, 6] }); const count = seen.length;
  f.run(.8); assert.equal(seen.length, count); f.run(.3); assert.equal(seen.length, count + 1); assert.deepEqual(f.b.errors, []);
});
test('tile effect includes concealed and airborne allies but detaches from target-free recipients', () => {
  const f = fixture(), seen = capture(f); f.b.addBuff(f.u, { key: 'fixture', flags: { stealth: true, camou: true, liftoff: true } });
  f.mark(); f.run(1.1); assert.equal(seen.length, 1);
  f.b.addBuff(f.u, { key: 'excluded', flags: { targetFree: true } }); f.run(1.1); assert.equal(seen.length, 1);
  f.b.removeBuff(f.u, 'excluded'); f.run(1.1); assert.equal(seen.length, 2);
});
test('Dreadkaz birth blast uses all nine tiles and Arts mitigation, then its Mark expires after 30 seconds', () => {
  const f = fixture(), seen = capture(f), e = f.b.spawnEnemy(DREADKAZ, { pos: [9, 7] });
  e.profile.noAttack = true; f.b.addBuff(e, { key: 'fixture', flags: { noMove: true } });
  f.run(.066); assert.equal(f.u.stats.taken, 0); f.run(.1);
  assert.equal(f.u.stats.taken, 300); const mark = f.b.neutralUnits.find(u => u.defId === EPOCH_MARK); assert.ok(mark);
  assert.equal(mark.counted, false); assert.equal(f.b.total, 1);
  f.b.kill(e); f.run(1.1); assert.equal(seen.length, 1);
  assert.equal(f.b.neutralUnits.filter(u => u.defId === EPOCH_MARK).length, 1);
  f.run(30); assert.equal(mark.alive, false); assert.equal(f.b.stageEpoch.tiles.size, 0);
  assert.equal(f.b.killed, 1); assert.deepEqual(f.b.errors, []);
});
test('early removal finishes the pending birth action once, including its ALL-motion blast', () => {
  const f = fixture(); f.b.addBuff(f.u, { key: 'air', flags: { liftoff: true } });
  const e = f.b.spawnEnemy(DREADKAZ, { pos: [9, 7] }); f.b.kill(e); assert.equal(f.u.stats.taken, 300);
  f.run(.5); assert.equal(f.b.neutralUnits.filter(u => u.defId === EPOCH_MARK).length, 1); assert.deepEqual(f.b.errors, []);
});
test('the level-owned host marker composes the complete route summon, birth action and neutral hazard chain', () => {
  const f = fixture();
  installParasiticEnvironment(f.b, { hosts: ['enemy_host'], forced: [], enemy: DREADKAZ, delay: Math.fround(.95) });
  const host = f.b.spawnEnemy('host', { pos: [9, 7], route: { start: [9, 8], end: [9, 2], checkpoints: [[9, 5]] } });
  f.b.kill(host); f.run(.9); assert.equal(f.b.enemies.some(e => e.defId === DREADKAZ), false);
  f.run(.2); const child = f.b.enemies.find(e => e.defId === DREADKAZ); assert.ok(child);
  child.profile.noAttack = true; f.run(.2);
  assert.equal(child.route.legs.at(-1).c, 2); assert.equal(child.counted, false);
  assert.equal(f.b.neutralUnits.length, 1); assert.ok(f.u.findBuff('rogue_4_apoptosis[ally]'));
  f.b.kill(child); f.b.autoFinish = true; f.step();
  assert.equal(f.b.finished, true); assert.equal(f.b.reason, 'cleared'); assert.equal(f.b.killed, 1);
  assert.deepEqual(f.b.errors, []);
});
