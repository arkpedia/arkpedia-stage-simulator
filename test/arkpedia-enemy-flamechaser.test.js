// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny, ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { enemyStealthed } from '../server/sim/targeting.js';
import { StageReeds } from '../server/sim/content/arkpedia-stage-reeds.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enterEnemyHusk } from '../server/sim/content/enemies.js';
function fixture(id) {
  const h = spawnAny(id, { seconds: .1, autoFinish: false }), b = h.b, e = b.enemies[0];
  e.x = 3; e.y = 10; e.tileR = 10; e.tileC = 3;
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true, disarm: true } });
  return { ...h, e, target: b.allyUnits[0] };
}
test('summoned hit-count form starts immediately, with no synthetic kill or rebirth immunity', () => {
  const { b, e, run } = fixture('enemy_1288_duskls'), max = e.s.maxHp;
  let killed = 0; b.on('kill', ({ victim }) => { if (victim === e) killed++; });
  b.applyStatus(e, 'stun', { duration: .5 });
  assert.equal(enterEnemyHusk(b, e), true);
  assert.equal(enterEnemyHusk(b, e), false, 'duplicate mode request does not restart its clock');
  assert.equal(e.form, 'husk'); assert.equal(e.hp, 5); assert.equal(e.s.maxHp, 5);
  assert.equal(!!e.s.flags.invulnerable, false); assert.equal(!!e.s.flags.unblockable, false);
  assert.equal(!!e.s.flags.stun, true, 'mode selection is not a rebirth cleanse');
  assert.equal(e.mem.regularFormVisual.clip, 'Start');
  b.dealDamage(null, e, { amount: 10000, type: 'true', ignoreSelect: true }); assert.equal(e.hp, 4);
  run(9.9); assert.equal(e.form, 'husk'); run(.2);
  assert.equal(e.form, 'revived'); assert.equal(e.s.maxHp, max); assert.equal(e.hp, max);
  assert.equal(b.killed, 0); assert.equal(killed, 0); assert.equal(e.profile.noAttack, false);
  b.kill(e); assert.equal(e.form, 'husk', 'the revived body still owns its normal lifecycle');
  assert.equal(!!e.s.flags.invulnerable, true); assert.deepEqual(b.errors, []);
});
test('killing a summoned ember is final and cancels its later revival', () => {
  const { b, e, run } = fixture('enemy_1288_duskls_2');
  assert.ok(enterEnemyHusk(b, e)); b.kill(e); assert.equal(e.alive, false);
  assert.equal(enterEnemyHusk(b, e), false); run(12);
  assert.equal(e.alive, false); assert.equal(b.killed, 1); assert.deepEqual(b.errors, []);
  const plain = spawnAny('enemy_1007_slime', { seconds: .1 });
  assert.equal(enterEnemyHusk(plain.b, plain.b.enemies[0]), false);
});
for (const id of ['enemy_1288_duskls', 'enemy_1288_duskls_2', 'enemy_1292_duskld', 'enemy_1292_duskld_2']) {
  const hits = id.includes('duskld') ? 10 : 5;
  test(`${id}: first defeat becomes a source-sized ember; final death earns one kill`, () => {
    const { b, e, run } = fixture(id); let deaths = 0; b.on('death', ({ unit }) => { if (unit === e) deaths++; });
    b.applyStatus(e, 'stun', { duration: 10 }); b.kill(e, null);
    assert.equal(e.alive, true); assert.equal(e.s.maxHp, hits); assert.equal(e.hp, hits); assert.equal(e.form, 'husk');
    assert.equal(b.killed, 0); assert.equal(deaths, 0); assert.equal(!!e.s.flags.stun, false);
    assert.equal(e.mem.regularFormVisual.clip, 'Die');
    b.dealDamage(null, e, { amount: 99999, type: 'true', ignoreSelect: true }); assert.equal(e.hp, hits);
    run(1.1); assert.equal(!!e.s.flags.invulnerable, false); assert.equal(!!e.s.flags.unblockable, false);
    assert.equal(e.profile.noAttack, true); assert.equal(e.mem.regularFormVisual.clip, 'Start');
    run(1.1); assert.equal(e.mem.regularFormVisual.die, 'Die_2');
    for (let i = 0; i < hits - 1; i++) b.dealDamage(null, e, { amount: 99999, type: i % 2 ? 'arts' : 'phys', ignoreSelect: true });
    assert.equal(e.alive, true); assert.equal(e.hp, 1);
    b.dealDamage(null, e, { amount: 99999, type: 'true', ignoreSelect: true });
    assert.equal(e.alive, false); assert.equal(b.killed, 1); assert.equal(deaths, 1);
    run(12); assert.equal(e.alive, false); assert.equal(b.killed, 1); assert.deepEqual(b.errors, []);
  });
  test(`${id}: survives ten seconds, restores original HP, and can repeat the lifecycle`, () => {
    const { b, e, run } = fixture(id), max = e.s.maxHp;
    b.kill(e, null); run(10.9); assert.equal(e.form, 'husk'); run(.2);
    assert.equal(e.form, 'revived'); assert.equal(e.s.maxHp, max); assert.equal(e.hp, max);
    assert.equal(!!e.s.flags.hitCount, false); assert.equal(e.profile.noAttack, false); assert.equal(b.killed, 0);
    assert.equal(e.mem.regularFormVisual.clip, 'Revive');
    b.kill(e, null); assert.equal(e.hp, hits); assert.equal(e.form, 'husk'); run(1.1);
    b.kill(e, null); assert.equal(e.alive, false); assert.equal(b.killed, 1); assert.deepEqual(b.errors, []);
  });
}
test('Burn rider requires burning Reeds within range and the living soldier form', () => {
  const { b, e, target } = fixture('enemy_1288_duskls');
  b.stageReeds = new StageReeds(b, { kind: 'reeds', scanInterval: .1, damageInterval: 1, entryStealth: .2,
    tiles: [{ row: 10, col: 4, ignite_duration: 15, extinct_duration: 20, cooldown_duration: 5, damage: 40, ep_damage: 40 }] });
  const hit = () => b.dealDamage(e, target, { amount: e.s.atk, type: 'arts', isAttack: true, ignoreSelect: true });
  hit(); assert.equal(target.elem.burn, 0);
  b.stageReeds.ignite(10, 4); hit(); assert.equal(target.elem.burn, 150);
  e.x = 2.5; hit(); assert.equal(target.elem.burn, 300);
  e.x = 2.49; hit(); assert.equal(target.elem.burn, 300);
  e.x = 3; b.kill(e, null); hit(); assert.equal(target.elem.burn, 300);
  assert.deepEqual(b.errors, []);
});
test('source admission rejects modified form transitions, hit counts, selectors, templates and timers', () => {
  const id = 'enemy_1288_duskls'; assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, native).policy);
  for (const field of ['mode', 'duration', 'range', 'restore', 'trigger']) {
    const n = structuredClone(native);
    if (field === 'trigger') n.templates.enemy_duskls_trigger_skill.eventToActions.ON_BUFF_START[0]._abilityName = 'other';
    for (const row of n.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) {
      const d = JSON.parse(row.originalJson);
      if (field === 'mode' && '_hpRechargeRatio' in d) d._modeIndex = 9;
      if (field === 'duration' && row.objectName === 'Revive[Trigger]') d._buffs[0].triggerCnt = 2;
      if (field === 'range' && '_options' in d) d._options.modeIndex = 0;
      if (field === 'restore' && '_restoreDelay' in d) d._restoreDelay = 0;
      row.originalJson = JSON.stringify(d);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, n).policy, null, field);
  }
});

test('the walking ember can be blocked, and restores invisibility three seconds after release', () => {
  const { b, e, target, run } = fixture('enemy_1288_duskls'); b.kill(e, null); run(1.1);
  assert.equal(enemyStealthed(e), true);
  target.blocking = [e]; e.blockedBy = target; b.emit('blocked', { enemy: e, blocker: target });
  assert.equal(enemyStealthed(e), false); b._unblock(e); run(2.8); assert.equal(enemyStealthed(e), false);
  run(.3); assert.equal(enemyStealthed(e), true);
  b.removeBuff(e, 'test:hold'); const x = e.x, y = e.y; run(.3);
  assert.ok(Math.hypot(e.x - x, e.y - y) > 0); assert.equal(e.profile.noAttack, true); assert.deepEqual(b.errors, []);
});

for (const id of ['enemy_1292_duskld', 'enemy_1292_duskld_2']) test(`${id}: nearby burning Reeds grants non-stacking physical/Arts protection, never true damage or ember protection`, () => {
  const { b, e } = fixture(id);
  b.stageReeds = new StageReeds(b, { kind: 'reeds', scanInterval: .1, damageInterval: 1, entryStealth: .2,
    tiles: [{ row: 10, col: 4, ignite_duration: 15, extinct_duration: 20, cooldown_duration: 5, damage: 40, ep_damage: 40 }] });
  const hit = type => { const hp = e.hp; b.dealDamage(null, e, { amount: 1000, type, canDodge: false, ignoreSelect: true }); return hp - e.hp; };
  const normal = hit('phys'); b.stageReeds.ignite(10, 4); assert.equal(hit('phys'), normal * .5);
  assert.equal(hit('arts'), 200); assert.equal(hit('true'), 1000);
  b.addBuff(e, { key: 'stronger', status: 'sanctuary', mods: { physTakenMul: .25, artsTakenMul: .25 } });
  assert.equal(hit('phys'), normal * .25); b.removeBuff(e, 'stronger');
  e.x = 2.49; assert.equal(hit('phys'), normal); e.x = 2.5; assert.equal(hit('arts'), 200);
  b.kill(e); assert.equal(e.form, 'husk'); assert.equal(e.findBuff('ab:burningReedsProtection'), null);
  assert.deepEqual(b.errors, []);
});
test('Guard source gate rejects stacking or silenceable protection and changed ten-hit form', () => {
  const id = 'enemy_1292_duskld'; assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, native).policy);
  const n = structuredClone(native); n.templates.damage_resistance.eventToActions.ON_TAKE_DAMAGE[0]._isStackable = true;
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, n).policy, null);
  const d = structuredClone(native); d.buffDatabase['damage_resistance[inf]'].isSilenceable = true;
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, d).policy, null);
  const r = structuredClone(ENEMY_RECORDS.enemies[id]); r.levels[0].talents.bb['Revive[Trigger].prop_max_hp'] = 5;
  assert.equal(enemySupport(r, clocks.prefabs, native).policy, null);
});
