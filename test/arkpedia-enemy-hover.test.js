// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { canTargetEnemy } from '../server/sim/targeting.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { verifiedNative } from '../tools/arkpedia/enemy-support.mjs';
const ids = ['enemy_1171_durokt', 'enemy_1171_durokt_2'];
test('a disabling control permanently grounds Dublinn hoverers, including control shorter than a simulation tick', () => {
  for (const id of ids) for (const status of ['stun', 'freeze', 'sleep', 'levitate']) {
    const h = spawnAny(id, { seconds: .1 }), b = h.b, enemy = b.enemies.find(e => e.defId === id), guard = b.allyUnits[0];
    assert.equal(canTargetEnemy(guard, enemy, {}), false);
    assert.equal(b.applyStatus(enemy, status, { duration: .001 }), true, `${id}:${status}`);
    assert.equal(!!enemy.findBuff('ab:float'), false, 'accepted control removes hovering synchronously');
    assert.equal(enemy.profile.melee, true); assert.equal(enemy.s.flags.stun, true);
    assert.deepEqual(enemy.mem.regularFormVisual,{clip:'Idle02',move:'Move02',die:'Die02',attack:'Attack02',loop:true});
    assert.ok(enemy.findBuff('stun').timeLeft >= .5 - 1e-9);
    h.run(.7); assert.equal(enemy.isFlying, false); assert.equal(enemy.motion, 'WALK');
    enemy.x = guard.x; enemy.y = guard.y; enemy.tileR = guard.tileR; enemy.tileC = guard.tileC;
    h.run(.2); assert.equal(enemy.blockedBy, guard); assert.equal(canTargetEnemy(guard, enemy, {}), true);
    h.run(2); assert.equal(enemy.isFlying, false); assert.deepEqual(b.errors, []);
  }
});
test('silence, cold, rooting and rejected controls do not ground a hoverer', () => {
  const h = spawnAny(ids[0], { seconds: .1 }), b = h.b, e = b.enemies.find(e => e.defId === ids[0]);
  for (const status of ['silence', 'cold', 'bind']) b.applyStatus(e, status, { duration: 1 });
  assert.equal(e.isFlying, true);
  b.on('beforeStatus', c => { if (c.target === e && c.status === 'stun') c.cancel = true; });
  assert.equal(b.applyStatus(e, 'stun', { duration: 1 }), false); assert.equal(e.isFlying, true);
});
test('hover admission requires the source control flags, mode switch and half-second fall stun', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, native).policy);
  for (const mutation of ['silence', 'float', 'mode', 'fallStun']) {
    const evidence = structuredClone(native);
    for (const row of evidence.prefabs[`dyn/battle/prefabs/enemies/${ids[0]}.prefab`]) {
      const d = JSON.parse(row.originalJson), buff = d._buffs?.find(b => b.templateKey === 'enemy_durokt[fly]');
      if (buff && mutation === 'silence') buff.isSilenceable = 1;
      if (buff && mutation === 'float') buff.attributes.abnormalFlags = [];
      row.originalJson = JSON.stringify(d);
    }
    const actions = evidence.templates['enemy_durokt[fly]'].eventToActions.ON_BUFF_DISABLE;
    if (mutation === 'mode') actions[0]._loadModeFromBlackboard = false;
    if (mutation === 'fallStun') actions[1]._buff.blackboard[0].value = 2;
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]], clocks.prefabs, evidence).policy, null, mutation);
  }
});
test('Lost Hovercraft gains its mode-local speed only after falling, then reuses the native outcome account', () => {
  const id = 'enemy_2070_skzfbx';
  for (const level of [0, 1, 2]) {
    const h = spawnAny(id, { level, seconds: .1 }), b = h.b, e = b.enemies.find(e => e.defId === id);
    const guard = b.allyUnits[0]; e.x = guard.x; e.y = guard.y; e.tileR = guard.tileR; e.tileC = guard.tileC;
    b.addBuff(e, { key: 'hold', flags: { noMove: true } });
    assert.equal(e.s.moveSpeed, .35); assert.equal(e.isFlying, true);
    h.run(2); assert.equal(e.stats.attacks, 0); assert.equal(e.blockedBy, null);
    b.applyStatus(e, 'stun', { duration: .1 });
    assert.equal(e.isFlying, false); assert.equal(e.s.moveSpeed, .7); assert.equal(e.profile.noAttack, false);
    assert.deepEqual(e.mem.regularFormVisual,{clip:'Idle2',move:'Move2',die:'Die2',attack:'Attack',loop:true});
    assert.ok(e.findBuff('stun').timeLeft <= .1 + 1e-9, 'no invented Dublinn fall stun');
    b.applyStatus(e, 'stun', { duration: .1 }); assert.equal(e.s.moveSpeed, .7, 'mode talent applies only once');
    h.run(3); assert.ok(e.stats.attacks > 0); assert.equal(e.blockedBy, guard);
    b.grid.setTile(e.tileR, e.tileC, { ...b.grid.tile(e.tileR, e.tileC), key: 'tile_end' });
    b.leak(e); assert.equal(b.stageOutcomes.counters.rogue_thief_reach_exit, 1); assert.deepEqual(b.errors, []);
  }
});
test('Lost Hovercraft source ancestry is verified; moving its speed talent to the air mode is rejected', () => {
  const id = 'enemy_2070_skzfbx', entry = ENEMY_RECORDS.enemies[id];
  assert.ok(enemySupport(entry, clocks.prefabs, native).policy);
  const evidence = structuredClone(native), n = nativeComponents(evidence, id);
  const row = evidence.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`].find(c => c.objectName === '1');
  row.ancestors = [n.Fly.find(c => '_generalAbilities' in c).m_GameObject.m_PathID];
  assert.equal(enemySupport(entry, clocks.prefabs, evidence).policy, null);
  assert.throws(() => verifiedNative(evidence, clocks.prefabs, native.source.sha256, native.source.templates), /hierarchy does not match/);
});
test('hover visual modes reject changed native role replacement instead of playing the airborne body on land',()=>{
 for(const id of [...ids,'enemy_2070_skzfbx']){
  const evidence=structuredClone(native),n=nativeComponents(evidence,id);
  const ground=n.$ref(n[id][0]._modes[1]),hook=n.$ref(ground._animatorHooker);
  const row=evidence.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`].find(c=>c.pathId===ground._animatorHooker.m_PathID);
  hook._replaceAnimPairs[0].toAnimKey='Move';row.originalJson=JSON.stringify(hook);
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,evidence).policy,null);
 }
});
