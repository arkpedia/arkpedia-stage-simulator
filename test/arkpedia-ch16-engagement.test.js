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

test('native engagement includes the miner collider at acquisition and uses the native release radius', () => {
  const start = actions('block_mcreep[to_mcreep]', 0);
  assert.equal(start[0]._buffOwner, 'BUFF_SOURCE');
  assert.deepEqual(start[0]._buff.attributes.abnormalFlags, ['UNMOVABLE']);
  assert.equal(start[2]._additionKey, 'range_radius_add');
  const { h, spawn } = fixture(), e = spawn(soldier, 6), m = spawn(miner, 6.95);
  h.run(.31);
  assert.equal(e.mem.mcTarget, m, 'the 0.9 selector touches the miner 0.1 body collider');
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

test('ordinary weapon acquisition is separate from the smaller native engagement circle', () => {
  const native = Object.entries(proof.enemyPrefabs).find(([key]) => key.includes(soldier))[1];
  const by = new Map(native.map(row => [row.pathId, JSON.parse(row.originalJson)]));
  const mode = [...by.values()].find(row => row._attack && row._combat);
  const trigger = by.get(mode._attackTrigger.m_PathID), go = by.get(trigger.m_GameObject.m_PathID);
  const components = go.m_Component.map(c => by.get(c.component.m_PathID)).filter(Boolean);
  assert.equal(components.find(c => 'm_Radius' in c).m_Radius, 1);
  assert.equal(components.find(c => '_buffKey' in c)._buffKey, 'mark_neutral[effect]');
  const { h, spawn } = fixture(), e = spawn(soldier, 6), m = spawn(miner, 7.05), hp = m.hp;
  h.run(.15);
  assert.equal(e.mem.mcTarget, undefined, 'outside the 0.9 circle plus 0.1 miner body, before the first 0.3s engagement scan');
  assert.ok(m.hp < hp, 'the independent radius-1 weapon still overlaps the miner body');
  assert.equal(e.stats.attacks, 1);
  assert.ok(e.findBuff('enemy_field_army_self_mark')); assert.ok(m.findBuff('mark_neutral[effect]'));
  assert.deepEqual(h.b.errors, []);
});

test('engagement movement ownership does not force the ordinary weapon onto the locked miner', () => {
  const { h, b, spawn } = fixture(), e = spawn(soldier, 6), original = spawn(miner, 6.8);
  h.run(.31); assert.equal(e.mem.mcTarget, original);
  const next = spawn(miner, 5.2), hits = [];
  e.atkCd = 0;
  b.on('damageFinal', c => { if (c.source === e) hits.push(c.target); });
  h.run(.1);
  assert.equal(e.mem.mcTarget, original); assert.ok(hits.includes(next));
  assert.deepEqual(b.errors, []);
});

test('a miner also selects independently of its engagement when a higher-taunt enemy is in reach', () => {
  const { h, b, spawn } = fixture(), e = spawn(soldier, 6), m = spawn(miner, 6.8);
  h.run(.31); assert.equal(m.mem.ch16Engagement.source, e);
  const other = spawn(soldier, 7.2), hits = [];
  b.addBuff(other, { key: 'test:taunt', persist: true, mods: { taunt: 1 } }); m.atkCd = 0;
  b.on('damageFinal', c => { if (c.source === m) hits.push(c.target); });
  h.run(.1);
  assert.equal(m.mem.ch16Engagement.source, e); assert.ok(hits.includes(other));
  assert.deepEqual(b.errors, []);
});
