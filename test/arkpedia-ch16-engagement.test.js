// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle } from './helpers/battleHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
const records = JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-enemy-records.canonical.json', import.meta.url))).enemies;
const proof = JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-ch16-device-source.json', import.meta.url)));
const soldier = 'enemy_10120_uaghst', miner = 'enemy_3010_mcreep';
function fixture() {
  const h = makeBattle({ content: 'generic', autoFinish: false,
    defs: { enemies: Object.fromEntries([soldier, miner].map(k => [k, records[k].levels[0]])) }, setup: installEnemyFeatures });
  const spawn = (key, x) => {
    const e = h.spawn(key, { pos: [10, Math.round(x)] });
    e.x = x; e.base.moveSpeed = 0; e.markDirty();
    return e;
  };
  return { h, b: h.b, spawn };
}
function actions(key, event) {
  return JSON.parse(JSON.parse(proof.templates[key].originalJson).eventToActions._items.find(i => i.key === event).value.SerializedState);
}

test('native engagement locks both participants and has a separate release radius', () => {
  const start = actions('block_mcreep[to_mcreep]', 0);
  assert.equal(start[0]._buffOwner, 'BUFF_SOURCE');
  assert.deepEqual(start[0]._buff.attributes.abnormalFlags, ['UNMOVABLE']);
  assert.equal(start[2]._additionKey, 'range_radius_add');
  const { h, spawn } = fixture(), e = spawn(soldier, 6), m = spawn(miner, 6.8);
  h.run(.31);
  assert.equal(e.mem.mcTarget, m);
  assert.ok(e.s.flags.noMove && m.s.flags.noMove);
  e.base.moveSpeed = 1; m.base.moveSpeed = 1; e.markDirty(); m.markDirty();
  const positions = [e.x, e.y, m.x, m.y]; h.run(.3);
  assert.deepEqual([e.x, e.y, m.x, m.y], positions);
  e.base.moveSpeed = m.base.moveSpeed = 0;
  m.x = e.x + .95; h.run(.31);
  assert.equal(e.mem.mcTarget, m, 'retained inside acquisition radius plus range_radius_add');
  m.x = e.x + 1.01; h.run(.31);
  assert.equal(e.mem.mcTarget, null);
  assert.equal(m.mem.blockedMcreepBy, undefined);
  assert.ok(!e.s.flags.noMove && !m.s.flags.noMove);
});

test('one miner has one owner, nearest selection uses continuous distance rather than square tiles', () => {
  const { h, spawn } = fixture(), a = spawn(soldier, 6), other = spawn(soldier, 7.6);
  const near = spawn(miner, 6.8), far = spawn(miner, 5);
  h.run(.31);
  assert.equal(a.mem.mcTarget, near); assert.equal(other.mem.mcTarget, undefined);
  assert.equal(far.mem.blockedMcreepBy, undefined);
  assert.equal(near.mem.ch16Engagement.source, a);
  const diagonal = fixture(), d = diagonal.spawn(miner, 6.8);
  d.y = 10.8; diagonal.spawn(soldier, 6); diagonal.h.run(.31);
  assert.equal(d.mem.blockedMcreepBy, undefined, 'a diagonal outside the circle is not a target');
});

test('the pair exchanges ordinary melee attacks on each canonical attack clock', () => {
  const { h, b, spawn } = fixture(), e = spawn(soldier, 6), m = spawn(miner, 6.8);
  const hits = [];
  b.on('damageFinal', c => { if (c.dmg.isAttack) hits.push({ source: c.source, target: c.target, type: c.dmg.type }); });
  const hp = [e.hp, m.hp]; h.run(.5);
  assert.ok(e.hp < hp[0] && m.hp < hp[1]);
  assert.equal(e.stats.attacks, 1); assert.equal(m.stats.attacks, 1);
  assert.ok(hits.some(c => c.source === e && c.target === m && c.type === 'phys'));
  assert.ok(hits.some(c => c.source === m && c.target === e && c.type === 'phys'));
  h.run(1); assert.equal(e.stats.attacks, 1); assert.equal(m.stats.attacks, 1);
  h.run(1.1); assert.equal(e.stats.attacks, 2); assert.equal(m.stats.attacks, 1);
});

test('source or recipient removal clears both locks and permits a new engagement', () => {
  for (const removeSource of [true, false]) {
    const { h, b, spawn } = fixture(), e = spawn(soldier, 6), m = spawn(miner, 6.8);
    h.run(.31); b.kill(removeSource ? e : m, null); h.run(.05);
    assert.equal(e.mem.mcTarget, null); assert.equal(m.mem.blockedMcreepBy, undefined);
    assert.ok(!e.findBuff(`ch16:engagement-source:${m.id}`));
    assert.ok(!m.findBuff(`ch16:engagement-target:${e.id}`));
    const replacement = spawn(removeSource ? soldier : miner, removeSource ? 6 : 6.8);
    h.run(.31);
    assert.equal((removeSource ? replacement : e).mem.mcTarget, removeSource ? m : replacement);
  }
});
