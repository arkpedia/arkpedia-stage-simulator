// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deriveEnemySupport, prefabPath } from '../shared/arkpedia/enemy-support.js';
import { parseSkel } from '../tools/assets/skel.mjs';
import { installFeatureDispatch } from '../server/sim/content/enemies.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { verifiedNative, verifiedChapter16FamilyGraph } from '../tools/arkpedia/enemy-support.mjs';
const bytes = p => readFileSync(new URL('../data/' + p, import.meta.url));
const read = p => JSON.parse(bytes(p));
const records = read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const review = read('candidates/arkpedia-ch16-reviewed-fortbreaker.json');
const key = 'enemy_10123_uareap', miner = 'enemy_3010_mcreep';
function fixture({ variant = false, quiet = true, block = 0 } = {}) {
  const id = key + (variant ? '_2' : '');
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: b => { installFeatureDispatch(b); installEnemyFeatures(b); },
    defs: { enemies: Object.fromEntries([id, miner].map(k => [k, records[k].levels[0]])),
      chess: { dummy: chessRec({ id: 'dummy', stats: { maxHp: 1e6, atk: 0, def: 0, blockCnt: block } }) } },
    units: [{ chessId: 'dummy', row: 10, col: block ? 6 : 7 }] });
  h.b.start(); const e = h.spawn(id, { pos: [10, 6] });
  e.base.moveSpeed = 0; e.markDirty();
  assert.ok(e.mem.ab.list.some(a => a.cast), 'candidate feature dispatch installs Fortbreaker');
  const a = e.mem.ab.list.find(a => a.cast), u = h.unit('dummy'), launches = [];
  h.b.on('ch16FortbreakerLaunch', c => launches.push({ ...c, time: h.b.time }));
  if (quiet) e.profile.attackCooldowns = { attack: 1e6, combat: 1e6 };
  return { h, b: h.b, e, a, u, launches };
}
test('Fortbreaker full graph, indexed evidence and original skeleton bytes match reviewed hashes', () => {
  for (const file of Object.values(review.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file.path, import.meta.url))).digest('hex'), file.sha256);
  const index = read('arkpedia-enemy-clock-source.json');
  verifiedChapter16FamilyGraph(bytes('candidates/arkpedia-ch16-fortbreaker-source.json'), bytes('arkpedia-cn-native-source.json'), bytes('arkpedia-cn-enemy-native-source.json'), index);
  verifiedNative(read('candidates/arkpedia-ch16-fortbreaker-native.json'), index.prefabs,
    createHash('sha256').update(bytes('arkpedia-enemy-clock-source.json')).digest('hex'), read('arkpedia-mvp.json').behaviors.source);
  const proof = read('candidates/arkpedia-ch16-fortbreaker-source.json');
  assert.equal(Object.keys(proof.prefabs).length, 2); assert.equal(Object.keys(proof.projectiles).length, 2);
  for (const nodes of Object.values(proof.prefabs)) {
    const native = nodes.map(n => JSON.parse(n.originalJson));
    assert.equal(native.find(n => '_blockVolume' in n)._blockVolume, 3);
    const volley = native.find(n => n._projectileKey === 'projectile_enemy_uareap_skill');
    assert.equal(volley._triggerDelta, review.defaults.burstInterval);
    assert.equal(volley._waitForAttackEvent, 1); assert.equal(volley._waitAttackEventForAllAttacks, 0);
    assert.equal(volley._useCachedAtkOnly, 0);
  }
});
for (const variant of [false, true]) test(`variant ${variant}: shared volley subset: initial cooldown, native hit event, three delayed rockets`, () => {
  const { h, b, e, a, u, launches } = fixture({ variant }); const hp = u.hp;
  h.run(4.9); assert.equal(a.pending, null); assert.equal(launches.length, 0);
  h.run(.2); assert.ok(a.pending); h.run(.7); assert.equal(launches.length, 0);
  h.run(.1); assert.equal(launches.length, 1); assert.equal(u.hp, hp);
  h.run(.4); assert.equal(launches.length, 3); assert.equal(u.hp, hp);
  h.run(.7); assert.equal(hp - u.hp, e.s.atk * .7 * 3);
  h.run(.4); assert.equal(a.pending, null); assert.ok(a.cooldown > 9.7); assert.deepEqual(b.errors, []);
});
test('orders snapshot six rockets at cast start; targets alternate before reusing a deployment', () => {
  const { h, b, a, e, u, launches } = fixture();
  const m = h.spawn(miner, { pos: [10, 6.5] }); m.base.moveSpeed = 0; m.markDirty();
  b.addBuff(e, { key: 'enemy_uacomd_extra_power', persist: true }); a.cast();
  b.removeBuff(e, 'enemy_uacomd_extra_power'); h.run(1.9);
  assert.equal(launches.length, 6); assert.equal(new Set(launches.slice(0, 2).map(l => l.target)).size, 2);
  assert.ok(launches.every(l => l.count === 6)); assert.ok(launches.some(l => l.target === u));
});
test('born rocket retains its final trace hit after movement/source death and reads live attack', () => {
  const { h, b, a, e, u, launches } = fixture(); a.cast(); h.run(.9);
  assert.equal(launches.length, 1); const hp = u.hp;
  b.addBuff(e, { key: 'fixture-atk', mods: { atkFlat: 100 }, persist: true });
  b.kill(e, null); u.x = 9; h.run(.6); assert.equal(hp - u.hp, e.s.atk * .7); assert.equal(launches.length, 1);
  assert.equal(a.impacts.size, 0); assert.deepEqual(b.errors, []);
});
test('born blast damages a replacement at the dead target location after source death', () => {
  const { h, b, a, e, u } = fixture(); a.cast(); h.run(.9); const x = u.x, y = u.y;
  b.kill(u, null); const m = h.spawn(miner, { pos: [y, x] }); m.base.moveSpeed = 0; m.markDirty(); const hp = m.hp;
  b.addBuff(e, { key: 'fixture-atk', mods: { atkFlat: 100 }, persist: true }); b.kill(e, null); h.run(.6);
  assert.equal(hp - m.hp, Math.max((e.s.atk * .7) - m.s.def, e.s.atk * .7 * .05)); assert.deepEqual(b.errors, []);
});
test('brief control cancels unborn launches even when removed before the next tick', () => {
  const { h, b, a, e, launches } = fixture(); a.cast(); h.run(.9);
  const control = b.addBuff(e, { key: 'fixture-stun', flags: { stun: true }, persist: true }); b.removeBuff(e, control);
  h.run(.5); assert.equal(launches.length, 1); assert.equal(a.pending, null); assert.ok(a.cooldown > 9);
});
test('battle end clears pending launch and already-born impact tasks', () => {
  const { h, b, a, u, launches } = fixture(); a.cast(); h.run(.9); const hp = u.hp;
  b.emit('battleEnd', {}); h.run(2); assert.equal(u.hp, hp); assert.equal(launches.length, 1); assert.equal(a.impacts.size, 0);
});
test('block volume and three miner movement links are independent of the ranged weapon', () => {
  const { h, b, a, e } = fixture(); assert.equal(e.blockWeight, 3);
  for (const x of [6.2, 6.4, 6.6, 6.8]) { const m = h.spawn(miner, { pos: [10, x] }); m.base.moveSpeed = 0; m.markDirty(); }
  h.run(.91); assert.equal(a.engagements.size, 3); assert.equal(e.profile.melee, false); assert.equal(e.profile.meleeTarget, undefined);
  b.kill(e, null); assert.equal(a.engagements.size, 0);
});

test('target selection rejects hidden, flying, sleeping and camouflaged ground units', () => {
  for (const flag of ['stealth', 'flying', 'sleep', 'camou', 'liftoff']) {
    const { b, a, u } = fixture(); b.addBuff(u, { key: 'fixture-'+flag, flags: { [flag]: true }, persist: true });
    if (flag === 'flying') u.motion = 'FLY';
    a.cast(); assert.equal(!!a.pending, false, flag);
  }
});
test('unborn rounds reselect live targets; orders acquired after cast do not add rounds', () => {
  const { h, b, a, e, u, launches } = fixture(); a.cast(); h.run(.9);
  b.kill(u, null); const m = h.spawn(miner, { pos: [10, 6.5] }); m.base.moveSpeed = 0; m.markDirty();
  b.addBuff(e, { key: 'enemy_uacomd_extra_power', persist: true }); h.run(.4);
  assert.equal(launches.length, 3); assert.equal(launches[1].target, m); assert.equal(launches[2].target, m);
});
test('normal ranged attack uses its separate native homing projectile', () => {
  const { h, b, e, u } = fixture({ quiet: false }); const hp = u.hp;
  h.run(.04); assert.equal(e.stats.attacks, 1); assert.equal(b.projectiles.list[0].speed, 10);
  assert.equal(u.hp, hp); h.run(.2); assert.equal(hp-u.hp, e.s.atk);
  assert.ok(e.profile.attackCooldowns.attack > 3); assert.equal(e.profile.attackCooldowns.combat, 0);
});

test('both retained original skeletons reproduce the Skill and normal Attack/Combat event clocks', () => {
  const proof = read('candidates/arkpedia-ch16-fortbreaker-animation-source.json');
  const hash = x => createHash('sha256').update(x).digest('hex');
  assert.equal(proof.source.bundle.manifestSha256, read('arkpedia-cn-native-source.json').source.manifestSha256);
  for (const row of Object.values(proof.enemies)) {
    const raw = Buffer.from(row.base64, 'base64');
    assert.equal(raw.length, row.bytes); assert.equal(hash(raw), row.sha256);
    assert.equal(hash(row.skeletonDataOriginalJson), row.skeletonDataSha256);
    assert.equal(row.prefabBinding.m_PathID, row.skeletonDataPathId);
    const decoded = parseSkel(raw, undefined, { includeExactDurations: true, includeEventPayloads: true });
    for (const anim of ['F_Skill', 'F_Attack', 'F_Combat']) {
      assert.equal(decoded.exactDurations[anim], anim === 'F_Skill' ? review.defaults.skillDuration : review.defaults.attackDuration);
      assert.equal(decoded.eventPayloads[anim].length, 1);
      assert.equal(decoded.eventPayloads[anim][0].name, 'OnAttack');
      assert.equal(decoded.eventPayloads[anim][0].time, anim === 'F_Skill' ? review.defaults.skillHit : review.defaults.attackHit);
    }
  }
});

test('only three-block operators can block; Combat and Attack have independent clocks', () => {
  for (const block of [1, 2, 3]) {
    const { h, b, e, u } = fixture({ block }); const hp = u.hp;
    h.run(.1); e.profile.attackCooldowns = { attack: 0, combat: 0 }; h.run(.04); assert.equal(e.blockedBy === u, block === 3);
    if (block === 3) {
      assert.equal(hp-u.hp, e.s.atk); assert.equal(b.projectiles.list.length, 0);
      assert.equal(e.profile.attackCooldowns.attack, 0); assert.ok(e.profile.attackCooldowns.combat > 3);
      b.retreat(u); const m = h.spawn(miner, { pos: [10, 7] }); m.base.moveSpeed = 0; m.markDirty();
      h.run(.04); assert.equal(e.stats.attacks, 2); assert.ok(e.profile.attackCooldowns.attack > 3);
    }
    assert.deepEqual(b.errors, []);
  }
});
test('a completed volley preserves the ten-second cooldown from cast end', () => {
  const { h, a, launches } = fixture(); a.cast(); h.run(2.3);
  assert.equal(a.pending, null); assert.equal(launches.length, 3);
  h.run(9.8); assert.equal(a.pending, null); assert.equal(launches.length, 3);
  h.run(.2); assert.ok(a.pending); assert.equal(launches.length, 3);
});

test('candidate support rejects missing family evidence, altered native components and changed canonical skill', () => {
  const native = read('candidates/arkpedia-ch16-fortbreaker-native.json'), index = read('arkpedia-enemy-clock-source.json');
  const entries = Object.fromEntries(Object.keys(review.enemies).map(k => [k, records[k]]));
  const evidence = { ...native, chapter16Families: { fortbreaker: { graphSha256: review.sources.graph.sha256 } } };
  for (const k of Object.keys(entries)) {
    const decision = deriveEnemySupport(entries, index.prefabs, evidence)[k];
    if (k.endsWith('_2')) {
      assert.equal(decision.policy, null);
      assert.deepEqual(decision.reasons, ['talent:AttackParam', 'talent:KillBonusAura']);
    } else assert.equal(decision.policy, 'stats-attacks-and-features');
    assert.equal(deriveEnemySupport(entries, index.prefabs, native)[k].policy, null);
    const changed = structuredClone(evidence); changed.prefabs[prefabPath(k)][0].originalJson += ' ';
    assert.equal(deriveEnemySupport(entries, index.prefabs, changed)[k].policy, null);
    const wrong = structuredClone(entries); wrong[k].levels[0].skills[0].bb.atk_scale = 7;
    const changedSkill = deriveEnemySupport(wrong, index.prefabs, evidence)[k];
    assert.equal(changedSkill.policy, null); assert.ok(changedSkill.reasons.includes('skill:SkyProjectile'));
  }
});

test('native actions bind order count, static impact delay, radius and final trace inclusion', () => {
  const graph = read('candidates/arkpedia-ch16-fortbreaker-source.json');
  const nodes = JSON.parse(JSON.parse(graph.templates['uareap_s[assign_addition_cnt]'].originalJson).eventToActions._items.find(e => e.key === 0).value.SerializedState);
  assert.deepEqual(nodes[0]._conditionNode._buffKeys, ['enemy_uacomd_extra_power']);
  assert.equal(nodes[0]._succeedNodes[0]._value, review.defaults.orderedCount);
  assert.equal(nodes[0]._failNodes[0]._value, review.defaults.normalCount);
  assert.equal(nodes[0]._succeedNodes[0]._blackboardKeys, 'times');
  assert.equal(nodes[0]._succeedNodes[0]._abilityName, 'MainMultiRangedAttack');
  const rows = Object.entries(graph.projectiles).find(([k]) => k.endsWith('projectile_enemy_uareap_skill.prefab'))[1].map(r => JSON.parse(r.originalJson));
  const body = rows.find(n => '_lifeTime' in n), move = rows.find(n => '_delayToStart' in n);
  assert.equal(move._followTarget, 0); assert.equal(move._delayToStart, review.defaults.impactDelay);
  assert.equal(move._stopIfTargetDead, 0); assert.equal(move._stopIfTargetDisappeared, 0);
  assert.equal(body._stopWhenSourceInvalid, 0); assert.equal(body._alwaysHitTraceTargetInTheEnd, 1);
  assert.equal(body._stopAfterMaxHit, 0); assert.equal(body._canHitSameTargetMultipleTimes, 0);
  assert.equal(rows.find(n => 'm_Radius' in n).m_Radius, review.defaults.blastRadius);
});
test('static area and forced original trace hit are deduplicated and retain separate positions', () => {
  const { h, b, a, e, u } = fixture(); a.cast(); h.run(.9); const x = u.x, y = u.y;
  const hp = u.hp; u.x = 10;
  const m = h.spawn(miner, { pos: [y, x] }); m.base.moveSpeed = 0; m.markDirty(); const minerHp = m.hp;
  b.kill(e, null); h.run(.6);
  assert.equal(hp-u.hp, e.s.atk * .7);
  assert.equal(minerHp-m.hp, e.s.atk * .7 - m.s.def);
});
