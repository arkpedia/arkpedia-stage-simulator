// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec } from './helpers/battleHarness.js';
import evidence from '../data/arkpedia-environment-native-source.json' with { type: 'json' };
import { PARASITIC_ENVIRONMENT as kind, parasiticNativeReviewed, parasiticHostParameters } from '../shared/arkpedia/stage-parasitic.js';
import { compileStageEnvironments, stageEnvironmentEnemyDependencies } from '../shared/arkpedia/stage-environments.js';
import { parasiticLevelState, withoutParasiticRef } from '../tools/arkpedia/stage-parasitic.mjs';
import { installStageEnvironments } from '../server/sim/content/arkpedia-stage-environments.js';
import { StageWaveScheduler } from '../server/sim/content/arkpedia-stage-waves.js';
const child = 'enemy_2065_skzjs', host = 'enemy_fixture_host';
const instance = { prefabKey: kind, blackboard: [{ key: 'enemy_key', value: 0, valueStr: child }], overrideCameraEffect: null,
  passProfessionMaskFlag: false, professionMask: 'NONE', playerSideMask: 'ALL' };
function fixture({ hosts = [host], forced = [], managed = false } = {}) {
  const environment = { ...compileStageEnvironments([instance])[0], hosts, forced };
  const h = makeBattle({ content: 'none', autoFinish: false, defs: { enemies: {
    [host]: enemyRec({ key: host, hp: 9000, speed: 0 }), [child]: enemyRec({ key: child, hp: 2000, speed: 0 }),
  } }, setup: b => installStageEnvironments(b, [environment]) });
  h.b.start();
  if (managed) h.b.stageWaveScheduler = new StageWaveScheduler(h.b, { schemaVersion: 1,
    waves: [{ preDelay: 0, postDelay: 0, maxWait: -1, fragments: [{ preDelay: 0, duration: 0, spawns: [] }] }] });
  const route = { motion: 'WALK', start: [9, 8], end: [9, 2], checkpoints: [[9, 6]] };
  const e = h.b.spawnEnemy(host, { route, pos: [9, 7] });
  if (managed) h.b.stageWaveScheduler.track(e, { wave: 0 });
  return { ...h, e, environment };
}
test('native parasite source checks its death condition, route summon and hint-only birth action', () => {
  assert.equal(parasiticNativeReviewed(evidence), true);
  const result = compileStageEnvironments([instance])[0]; assert.equal(result.delay, Math.fround(.95));
  for (const change of ['fall', 'wave', 'delay', 'hint']) {
    const n = structuredClone(evidence), events = n.templates[kind].eventToActions;
    if (change === 'fall') events.ON_OWNER_KILLED[0]._failNodes[1]._finishReason = 'REACH_EXIT';
    if (change === 'wave') events.ON_OWNER_KILLED[0]._failNodes[3]._dontBlockWave = false;
    if (change === 'delay') events.ON_OWNER_KILLED[0]._failNodes[3]._delayTime = 0;
    if (change === 'hint') events.ON_BUFF_START[0]._failNodes[1]._buff.attributes.abnormalFlags.push('INVINCIBLE');
    assert.equal(parasiticNativeReviewed(n), false, change);
  }
  assert.throws(() => compileStageEnvironments([{ ...instance, blackboard: [] }]), /parasitic/);
});
test('level-owned marker parameters use key presence and leave unrelated enemy definitions untouched', () => {
  const ref = (id, valueStr) => ({ id, useDb: true, overwrittenData: { talentBlackboard: [
    { key: 'parasitic', value: 0, valueStr }, { key: 'ordinary.atk', value: 2, valueStr: null }] } });
  const refs = [ref(host, 'true'), ref(child, 'truee')];
  refs[1].overwrittenData.talentBlackboard.push({ key: 'force_parasitic', value: 0, valueStr: 'false' });
  assert.deepEqual(parasiticHostParameters(refs), { hosts: [child, host].sort(), forced: [child] });
  assert.equal(parasiticLevelState({ globalBuffs: [], enemyDbRefs: refs }), null);
  assert.deepEqual(parasiticLevelState({ globalBuffs: [instance], enemyDbRefs: refs }), parasiticHostParameters(refs));
  assert.deepEqual(withoutParasiticRef(refs[0]).overwrittenData.talentBlackboard, [refs[0].overwrittenData.talentBlackboard[1]]);
  assert.equal(refs[0].overwrittenData.talentBlackboard.length, 2);
  const e = compileStageEnvironments([instance])[0]; assert.deepEqual(stageEnvironmentEnemyDependencies([e]), []);
  e.hosts = [host]; assert.deepEqual(stageEnvironmentEnemyDependencies([e]), [child]);
});
test('a defeated host releases one delayed child on its captured remaining route without copying stats', () => {
  const f = fixture(), { b, e } = f; e.mods = { hpMul: 99 };
  assert.ok(e.findBuff('skzjs_hit[effect]')); b.kill(e); assert.equal(b._hasPendingEnemySchedules(), true);
  e.x = 10; e.y = 12; f.run(.9); assert.equal(b.enemies.filter(e => e.defId === child).length, 0);
  f.run(.1); const spawned = b.enemies.find(e => e.defId === child); assert.ok(spawned);
  assert.equal(spawned.x, 7); assert.equal(spawned.y, 9); assert.equal(spawned.s.maxHp, 2000);
  assert.equal(spawned.route.legs.at(-1).c, 2); assert.equal(spawned.counted, false);
  b.kill(spawned); f.run(2); assert.equal(b.enemies.filter(e => e.defId === child).length, 0); assert.deepEqual(b.errors, []);
});
test('fall deaths, unmarked hosts and ordinary parasite deaths cannot recurse', () => {
  for (const mode of ['fall', 'unmarked', 'expired']) {
    const f = fixture({ hosts: mode === 'unmarked' ? [] : [host] });
    if (mode === 'fall') f.e.mem.deathByFall = true;
    if (mode === 'expired') f.b._remove(f.e, 'expired'); else f.b.kill(f.e);
    f.run(2); assert.equal(f.b.enemies.filter(e => e.defId === child).length, 0, mode);
  }
  for (const force of [false, true]) {
    const f = fixture({ hosts: [child], forced: force ? [child] : [] });
    const parasite = f.b.spawnEnemy(child, { pos: [9, 7] }); f.b.kill(parasite); f.run(1.1);
    assert.equal(f.b.enemies.filter(e => e.defId === child).length, force ? 1 : 0);
  }
});
test('managed parasite timers do not block wave advancement but keep their delayed battle work alive', () => {
  const f = fixture({ managed: true }), { b, e } = f, scheduler = b.stageWaveScheduler;
  b.kill(e); assert.equal(b._hasPendingEnemySchedules(), true);
  for (let i = 0; i < 10 && scheduler.advance(); i++);
  assert.equal(scheduler.done, true); f.run(1.1);
  const spawned = b.enemies.find(e => e.defId === child); assert.ok(spawned);
  assert.deepEqual(scheduler.membership(spawned), { wave: 0, dontBlockWave: true });
  assert.equal(scheduler.blocksWave(spawned), false); assert.equal(spawned.alive, true); assert.deepEqual(b.errors, []);
});
