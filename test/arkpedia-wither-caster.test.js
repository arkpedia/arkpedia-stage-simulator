// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { nativeComponents, enemySupport } from '../shared/arkpedia/enemy-support.js';
import { witherCasterNative } from '../shared/arkpedia/enemy-wither-caster-features.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1268_nhnrs', 'enemy_1268_nhnrs_2'];
function fixture(id = ids[0]) {
  const r = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); r.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 100,
    defs: { enemies: { [id]: r } }, setup: installEnemyFeatures });
  h.b.start(); const e = h.b.spawnEnemy(id, { pos: [9, 6] });
  const device = (col, hp = 10000, key = 'trap_086_larva', side = 'enemy') => {
    const u = h.b.spawnDevice(key, 9, col, { hp, blockCnt: 0, side });
    h.b.addBuff(u, { key: 'fixture:stationary', flags: { noMove: true, targetFree: true } });
    return u;
  };
  return { ...h, e, device };
}
test('both Wither Casters heal the lowest injured HP ratio on the original release clock', () => {
  for (const id of ids) {
    const h = fixture(id), near = h.device(7), far = h.device(8, 20000);
    near.hp = 4000; far.hp = 6000;
    const pulses = []; h.b.on('healed', c => { if (c.source === h.e) pulses.push(c); });
    h.run(4.9); assert.equal(h.e.profile.noAttack, false);
    h.run(.7); assert.equal(h.e.mem.regularFormVisual.clip, 'Skill_Loop'); assert.equal(pulses.length, 0);
    h.run(.5); assert.equal(far.hp, 6400); assert.equal(near.hp, 4000);
    h.run(2); assert.equal(far.hp, 7200); assert.equal(pulses.length, 3);
    h.run(6); assert.equal(pulses.length, 8); assert.equal(far.hp, 9200);
    h.run(1); assert.equal(h.e.profile.noAttack, false); assert.equal(h.e.mem.regularFormVisual, null);
    assert.deepEqual(h.b.errors, []);
  }
});
test('channel admission needs the original device ID, side, range and healable injury', () => {
  for (const rejected of ['full', 'healFree', 'noHeal', 'side', 'identity', 'range', 'sleep']) {
    const h = fixture(), u = h.device(rejected === 'range' ? 10 : 7, 10000,
      rejected === 'identity' ? 'unrelated_device' : 'trap_086_larva', rejected === 'side' ? 'ally' : 'enemy');
    u.hp = rejected === 'full' ? 10000 : 5000;
    if (['healFree', 'noHeal', 'sleep'].includes(rejected)) h.b.addBuff(u, { key: 'fixture:reject', flags: { [rejected]: true } });
    h.run(7); assert.notEqual(h.e.profile.noAttack, true, rejected);
    assert.equal(h.b.projectiles.list.some(p => p.data?.witherCasterChannel), false, rejected);
    assert.deepEqual(h.b.errors, []);
  }
});
test('death, silence, stun, target loss and external link removal release channel locks', () => {
  for (const mode of ['death', 'silence', 'stun', 'target', 'redeploy', 'projectile']) {
    const h = fixture(), u = h.device(7); u.hp = 3000; h.run(6.2);
    assert.equal(h.e.profile.noAttack, true); const hp = u.hp;
    if (mode === 'death') h.b.kill(h.e);
    else if (mode === 'target') h.b.kill(u);
    else if (mode === 'redeploy') u.deploySeq++;
    else if (mode === 'projectile') h.b.projectiles.remove(p => p.data?.witherCasterChannel);
    else h.b.applyStatus(h.e, mode, { duration: .1 });
    h.run(1.2); assert.equal(u.hp, mode === 'target' ? 0 : hp, mode); assert.equal(h.e.profile.noAttack, false, mode);
    assert.equal(h.e.findBuff('ab:witherCasterChannel'), null, mode); assert.deepEqual(h.b.errors, []);
  }
});
test('an established link retains its recipient and restores prior attack restrictions', () => {
  const h = fixture(), u = h.device(7); u.hp = 9900; h.e.profile.noAttack = true;
  h.run(6.2); assert.equal(u.hp, 10000); assert.equal(h.e.profile.noAttack, true);
  u.hp = 9000; u.x = 12; h.run(1); assert.equal(u.hp, 9200);
  h.b.addBuff(u, { key: 'fixture:healFree', flags: { healFree: true } });
  h.run(1); assert.equal(u.hp, 9200);
  h.b.removeBuff(u, 'fixture:healFree'); h.run(1); assert.equal(u.hp, 9400);
  h.run(7); assert.equal(h.e.profile.noAttack, true); assert.equal(h.e.findBuff('ab:witherCasterChannel'), null);
  assert.deepEqual(h.b.errors, []);
});
test('ordinary Arts attacks retain native stance clocks and homing projectiles', () => {
  const guard = chessRec({ id: 'wither_attack_target', stats: { atk: 0, maxHp: 100000, res: 25 }, skill: null });
  const r = structuredClone(ENEMY_RECORDS.enemies[ids[0]].levels[0]); r.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, defs: { enemies: { [ids[0]]: r }, chess: { [guard.chessId]: guard } },
    units: [{ chessId: guard.chessId, row: 9, col: 7 }], setup: installEnemyFeatures });
  h.b.start(); const e = h.b.spawnEnemy(ids[0], { pos: [9, 6] }), u = h.b.allyUnits[0];
  assert.deepEqual(e.def.attackAnim, { dur: 1, hit: Math.fround(16 / 30) });
  h.run(.8);
  assert.equal(u.hp, 100000 - e.s.atk * .75); assert.deepEqual(h.b.errors, []);
});
test('source gates reject changed target identity, pulse timing, healing actions and wrappers', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence).policy, id);
  for (const [field, value] of [['_filterID', 'trap_other'], ['_postFilter', 11], ['_ignoreSilence', 1], ['_waitForAttackEvent', 0]]) {
    const ev = structuredClone(evidence), id = ids[0], rows = ev.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
    const row = rows.find(r => Object.hasOwn(JSON.parse(r.originalJson), field)
      && (field !== '_waitForAttackEvent' || r.objectName === 'Heallarva'));
    const d = JSON.parse(row.originalJson); d[field] = value; row.originalJson = JSON.stringify(d);
    assert.equal(witherCasterNative(ENEMY_RECORDS.enemies[id].levels[0], nativeComponents(ev, id)), false, field);
  }
  const ev = structuredClone(evidence);
  ev.templates['enemy_nhnrs_t[healtrap]'].eventToActions.ON_BUFF_START[0]._ignoreHealFree = true;
  assert.equal(witherCasterNative(ENEMY_RECORDS.enemies[ids[0]].levels[0], nativeComponents(ev, ids[0])), false);
});
