// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { selfFearNative } from '../shared/arkpedia/enemy-self-fear.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_10083_hlbird', 'enemy_10083_hlbird_2', 'enemy_10086_hltigr', 'enemy_10086_hltigr_2'];
function fixture(id = ids[0]) {
  const h = spawnAny(id, { units: [], seconds: .1, autoFinish: false });
  const b = h.b, e = b.enemies.find(e => e.defId === id);
  b.addBuff(e, { key: 'fixture:hold', flags: { noMove: true } });
  return { h, b, e, speed: e.s.moveSpeed };
}
test('all four admitted Sankta variants trigger once at exactly half HP, including HP loss', () => {
  for (const id of ids) {
    const { h, b, e, speed } = fixture(id);
    b.loseHp(e, e.s.maxHp / 2 - 1); h.step(); assert.equal(e.findBuff('fear'), null);
    b.loseHp(e, 1); h.step(); assert.equal(e.s.flags.fear, true); assert.equal(e.s.moveSpeed, speed * 1.5);
    assert.equal(e.findBuff('fear').data.fear.self, true);
    b.heal(null, e, e.s.maxHp); h.run(5.1);
    assert.equal(e.findBuff('fear'), null); assert.equal(e.s.moveSpeed, speed);
    b.dealDamage(null, e, { amount: e.s.maxHp * .75, type: 'true' }); h.step();
    assert.equal(e.findBuff('fear'), null); assert.equal(e.findBuff('ab:fearRun'), null);
    assert.deepEqual(b.errors, []);
  }
});
test('Fear resistance, immunity and cancellation do not extend unblockability or remove the independent speed buff', () => {
  for (const mode of ['resist', 'immune', 'cancel']) {
    const { h, b, e, speed } = fixture('enemy_10086_hltigr');
    if (mode === 'resist') b.applyStatus(e, 'resist', { duration: 20, value: .5 });
    if (mode === 'immune') e.def.immune.add('feared');
    if (mode === 'cancel') b.on('beforeStatus', c => { if (c.target === e && c.status === 'fear') c.cancel = true; });
    b.loseHp(e, e.s.maxHp / 2); h.step();
    assert.equal(e.s.moveSpeed, speed * 1.5);
    if (mode === 'resist') { assert.equal(e.s.flags.fear, true); h.run(2.6); }
    assert.equal(!!e.s.flags.fear, false); assert.equal(!!e.s.flags.unblockable, false);
    assert.ok(e.findBuff('ab:fearRun')); h.run(5.1); assert.equal(e.s.moveSpeed, speed);
  }
});
test('the HP checker runs through silence/stun but does not attach effects after lethal HP loss', () => {
  const { h, b, e } = fixture();
  b.applyStatus(e, 'silence', { duration: 20 }); b.applyStatus(e, 'stun', { duration: 20 });
  b.loseHp(e, e.s.maxHp / 2); h.step(); assert.ok(e.findBuff('fear')); assert.ok(e.findBuff('ab:fearRun'));
  const dead = fixture(); let applied = 0;
  dead.b.on('beforeStatus', c => { if (c.target === dead.e && c.status === 'fear') applied++; });
  dead.b.loseHp(dead.e, dead.e.s.maxHp); dead.h.step(); assert.equal(applied, 0); assert.equal(dead.e.alive, false);
});
test('native admission checks all eight shared traits and their separately registered skills', () => {
  for (const family of ['10083_hlbird', '10084_hlegle', '10085_hllevi', '10086_hltigr']) for (const suffix of ['', '_2']) {
    const id = `enemy_${family}${suffix}`, r = ENEMY_RECORDS.enemies[id].levels[0];
    assert.equal(selfFearNative(r, nativeComponents(evidence, id)), true, id);
    assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, evidence).policy, id);
  }
  const id = ids[0];
  for (const kind of ['strict-boundary', 'repeat', 'speed-flags', 'speed-silence', 'fear-owner', 'extra-action', 'fear-resistance', 'fear-range']) {
    const changed = structuredClone(evidence), n = nativeComponents(changed, id);
    const helper = n.SelfFear.find(c => '_checker' in c), checker = n.$ref(helper._checker);
    if (kind === 'strict-boundary' || kind === 'repeat') {
      checker[kind === 'repeat' ? '_toggleOnce' : '_useLTForMax'] = kind === 'repeat' ? 0 : 1;
      changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`].find(c => c.pathId === helper._checker.m_PathID).originalJson = JSON.stringify(checker);
    }
    const actions = changed.templates['hlbird_t[self_fear]'].eventToActions.ON_BUFF_START;
    if (kind === 'speed-flags') actions[0]._buff.attributes.abnormalFlags.push('UNBLOCKABLE');
    if (kind === 'speed-silence') actions[0]._buff.isSilenceable = true;
    if (kind === 'fear-owner') actions[1]._buffOwner = 'BUFF_SOURCE';
    if (kind === 'extra-action') actions.push(actions[0]);
    if (kind === 'fear-resistance') changed.buffDatabase.fear.statusResistable = 'NO';
    if (kind === 'fear-range') changed.templates.fear_buff.eventToActions.ON_BUFF_START[0]._rangeRadius = 1;
    assert.equal(!!selfFearNative(ENEMY_RECORDS.enemies[id].levels[0], nativeComponents(changed, id)), false, kind);
  }
});
