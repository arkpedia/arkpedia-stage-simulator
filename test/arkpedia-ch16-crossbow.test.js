// SPDX-License-Identifier: GPL-3.0-or-later
// Direct candidate attachment only: this suite does not grant support approval.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mobileCrossbow } from '../server/sim/content/chapter16-crossbow.js';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
import { installFeatureDispatch, attach } from '../server/sim/content/enemies.js';
const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const rec = read('data/candidates/arkpedia-enemy-records.canonical.json').enemies.enemy_10121_uasnip.levels[0];
const proof = read('data/candidates/arkpedia-ch16-crossbow-source.json');
function fixture({ blocker = false, near = false } = {}) {
  const h = makeBattle({ content: 'generic', autoFinish: false,
    defs: { enemies: { [rec.key]: rec, other: enemyRec({ key: 'other', atk: 0 }) },
      chess: { dummy: chessRec({ id: 'dummy', stats: { maxHp: 1e6, atk: 0, def: 100, blockCnt: blocker ? 2 : 0 } }) } },
    units: [{ chessId: 'dummy', row: 10, col: near ? 6 : 5 }], setup: installFeatureDispatch });
  const e = h.spawn(rec.key, { pos: [10, blocker ? 5 : 7] });
  e.base.moveSpeed = 0; e.markDirty();
  const a = mobileCrossbow(rec); attach(h.b, e, [a]);
  return { h, e, a, u: h.unit('dummy'), b: h.b };
}

test('retained native listener and projectile distinguish cadence, marker, radius and ranged multiplier', () => {
  for (const rows of [...Object.values(proof.prefabs), ...Object.values(proof.projectiles), Object.values(proof.templates)])
    for (const row of rows) assert.equal(createHash('sha256').update(row.originalJson).digest('hex'), row.sha256);
  const template = JSON.parse(proof.templates['uasnip_t[power_listener]'].originalJson);
  const nodes = JSON.parse(template.eventToActions._items.find(e => e.key === 2).value.SerializedState);
  const all = [];
  function visit(v) { if (v && typeof v === 'object') { if (v.$type) all.push(v); Object.values(v).forEach(visit); } }
  visit(nodes);
  const checks = all.filter(n => n.$type.endsWith('+CheckHasUnitInRange'));
  assert.deepEqual(checks.map(n => n._radiusKey), ['radius_2', 'radius_2', 'radius_1', 'radius_1']);
  assert.deepEqual(checks.map(n => n._targetSide), ['ALLY', 'NEUTRAL', 'ALLY', 'NEUTRAL']);
  assert.ok(checks.filter(n => n._targetSide === 'NEUTRAL').every(n => n._buffKey === 'enemy_mcreep_self_mark'));
  const native = Object.values(proof.prefabs)[0].map(r => JSON.parse(r.originalJson));
  const listener = native.flatMap(n => n._buffs ?? []).find(n => n.templateKey === 'uasnip_t[power_listener]');
  assert.ok(Math.abs(listener.triggerInterval - .1) < 1e-7); assert.equal(listener.waitFirstTriggerInterval, 1);
  assert.equal(listener.isSilenceable, 0);
  const shot = native.find(n => n._projectileKey === 'projectile_enemy_uasnip');
  assert.equal(shot._atkScaleKey, 'atk_scale_2'); assert.equal(shot._useCachedAtkOnly, 0);
  const mode = native.find(n => n._attack && n._combat);
  assert.notEqual(mode._attack.m_PathID, mode._combat.m_PathID, 'separate native animation abilities own separate cooldowns');
  const projectile = Object.values(proof.projectiles)[0].map(r => JSON.parse(r.originalJson));
  assert.equal(projectile.find(n => '_speed' in n)._speed, 10);
  assert.equal(projectile.find(n => '_lifeTime' in n)._lifeTime, 10);
  assert.equal(rec.talents.bb['ExtraPowerListener.attack@atk_scale_2'], 2.5);
});

test('isolated ranged attack has native multiplier, travel and a born projectile that survives source death', () => {
  const { h, e, b, u } = fixture(), hp = u.hp;
  h.run(.14);
  assert.equal(e.stats.attacks, 1); assert.equal(u.hp, hp);
  assert.equal(b.projectiles.list.at(-1).speed, 10);
  b.kill(e, null); h.run(.3);
  assert.equal(hp - u.hp, 850, 'the native multiplier applies to ATK before DEF'); assert.deepEqual(b.errors, []);
});

test('nearby player units inhibit ranged attack; commander orders shrink the query and expiry restores interference', () => {
  const { h, e, b } = fixture({ near: true });
  h.run(.11); assert.equal(e.stats.attacks, 0);
  b.addBuff(e, { key: 'enemy_uacomd_extra_power', persist: true }); h.run(.11);
  assert.equal(e.stats.attacks, 1); assert.ok(e.findBuff('uacomd_t[extra_effect]'));
  b.removeBuff(e, 'enemy_uacomd_extra_power'); h.run(.11);
  assert.equal(e.findBuff('uasnip_no_ally_nearby_able_attack'), null);
  assert.equal(e.findBuff('uacomd_t[extra_effect]'), null); assert.deepEqual(b.errors, []);
});

test('neutral interference requires the native miner mark; unrelated neutral units do not suppress the shot', () => {
  const { h, e, b } = fixture();
  const other = h.spawn('other', { pos: [10, 8] });
  other.profile.neutral = true; other.mem.ch16Miner = true; other.base.moveSpeed = 0; other.markDirty();
  h.run(.11); assert.ok(e.findBuff('uasnip_no_ally_nearby_able_attack'));
  b.addBuff(other, { key: 'enemy_mcreep_self_mark', persist: true }); h.run(.11);
  assert.equal(e.findBuff('uasnip_no_ally_nearby_able_attack'), null); assert.deepEqual(b.errors, []);
});

test('the blocked combat path is an ordinary unscaled physical hit, independent of ranged readiness', () => {
  const { h, e, b, u } = fixture({ blocker: true }), hp = u.hp;
  h.run(.2);
  assert.equal(e.blockedBy, u); assert.equal(e.stats.attacks, 1);
  assert.equal(hp - u.hp, rec.stats.atk - u.s.def);
  assert.equal(b.projectiles.list.length, 0); assert.deepEqual(b.errors, []);
});

test('the nonsilenceable listener rechecks current positions on its independent native cadence', () => {
  const { h, e, b, u } = fixture({ near: true });
  h.run(.11); assert.equal(e.findBuff('uasnip_no_ally_nearby_able_attack'), null);
  u.x = 5;
  b.addBuff(e, { key: 'test:silence', persist: true, flags: { silence: true } });
  h.run(.03); assert.equal(e.findBuff('uasnip_no_ally_nearby_able_attack'), null);
  h.run(.04); assert.ok(e.findBuff('uasnip_no_ally_nearby_able_attack'));
  assert.equal(u.tileC, 6); assert.deepEqual(b.errors, []);
});

test('enemy-side units are not ALLY query recipients; player-side direct selection ignores targetability', () => {
  const { h, e, b, u } = fixture();
  const other = h.spawn('other', { pos: [10, 8] }); other.base.moveSpeed = 0; other.markDirty();
  h.run(.14); assert.equal(e.stats.attacks, 1, 'a nearby same-side enemy does not interfere');
  u.x = 6;
  b.addBuff(u, { key: 'test:selection', persist: true, flags: { untargetable: true, camou: true, isolated: true } });
  h.run(.11);
  assert.equal(e.findBuff('uasnip_no_ally_nearby_able_attack'), null);
  assert.deepEqual(b.errors, []);
});

test('real block and release switches retain separate native Attack and Combat cooldowns', () => {
  const { h, e, b, u } = fixture();
  h.run(.14); assert.equal(e.stats.attacks, 1);
  assert.ok(e.profile.attackCooldowns.attack > 4.8);
  u.base.blockCnt = 2; u.markDirty();
  e.x = u.x; assert.equal(b._checkBlock(e), true);
  h.run(b.dt);
  assert.equal(e.stats.attacks, 2, 'fresh Combat does not inherit the ranged cooldown');
  assert.ok(e.profile.attackCooldowns.combat > 4.9);
  b._unblock(e); e.x = 7;
  h.run(1);
  assert.equal(e.stats.attacks, 2, 'returning to Attack retains its already spent cooldown');
  h.run(4.1);
  assert.equal(e.stats.attacks, 3);
  assert.deepEqual(b.errors, []);
});
