// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { ammoTheftNative } from '../shared/arkpedia/enemy-ammo-theft-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_10084_hlegle', 'enemy_10084_hlegle_2'];
function fixture(id = ids[0], { active = true, kind = 'ammo', ammo = 3 } = {}) {
  const target = chessRec({ id: 'theft_target', stats: { atk: 0, maxHp: 1e6, def: 100 }, skill: { spCost: 1, initSp: 1 } });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'generic', autoFinish: false, captureNoisy: true,
    defs: { chess: { [target.chessId]: target }, enemies: { [id]: record } },
    kits: { [target.chessId]: () => ({ trait: { noAttack: true }, skill: { kind, ammo, duration: 99, trigger: 'NEVER' } }) },
    units: [{ chessId: target.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  h.b.start(); const u = h.b.allyUnits[0]; if (active) assert.ok(u.skill.activate('fixture'));
  const e = h.b.spawnEnemy(id, { pos: [9, 7] });
  const shot = () => { assert.ok(h.runUntil(() => h.b.projectiles.list.some(p => !p.removed), 5)); };
  const impact = () => { shot(); h.run(.2); };
  return { ...h, u, e, shot, impact };
}
test('both variants steal one active skill round without HP damage, SP or ammoUsed events', () => {
  for (const id of ids) {
    const f = fixture(id), { u, e, b } = f; b.applyStatus(e, 'silence', { duration: 30 });
    f.impact(); assert.equal(u.skill.ammoLeft, 2); assert.equal(u.stats.taken, 0);
    assert.equal(f.hooksOf('ammoUsed').length, 0); assert.equal(f.hooksOf('damaged').filter(c => c.source === e).length, 0);
    assert.deepEqual(b.errors, []);
  }
});
test('ordinary magazines and inactive or non-ammo skills receive physical damage instead', () => {
  for (const options of [{ active: false }, { kind: 'duration' }, { kind: 'instant', active: false }]) {
    const f = fixture(ids[0], options); f.u.trait.ammo = 4; f.impact();
    assert.equal(f.u.stats.taken, f.e.s.atk - 100); assert.equal(f.u.trait.ammo, 4);
    const hit = f.hooksOf('damaged').find(c => c.source === f.e);
    assert.equal(hit.dmg.type, 'phys'); assert.equal(hit.dmg.applyWay, 'ranged'); assert.equal(hit.dmg.isAttack, true);
    assert.deepEqual(f.b.errors, []);
  }
});
test('ammo is checked at impact, including activation and exhaustion during projectile flight', () => {
  const gain = fixture(ids[0], { active: false }); gain.shot(); assert.ok(gain.u.skill.activate('fixture'));
  gain.run(.2); assert.equal(gain.u.skill.ammoLeft, 2); assert.equal(gain.u.stats.taken, 0);
  const lose = fixture(); lose.shot(); lose.u.skill.end('manual'); lose.run(.2);
  assert.equal(lose.u.stats.taken, lose.e.s.atk - 100);
  const last = fixture(ids[0], { ammo: 1 }); last.impact();
  assert.equal(last.u.skill.active, false); assert.equal(last.u.stats.taken, 0);
  last.impact(); assert.equal(last.u.stats.taken, last.e.s.atk - 100);
});
test('released theft survives source death; unmissable resource payload differs from dodgeable fallback damage', () => {
  const f = fixture(); f.shot(); f.b.kill(f.e); f.run(.2);
  assert.equal(f.u.skill.ammoLeft, 2); assert.equal(f.u.stats.taken, 0); assert.deepEqual(f.b.errors, []);
  for (const active of [true, false]) {
    const g = fixture(ids[0], { active }); g.b.addBuff(g.u, { key: 'dodge', mods: { dodgePhys: 1 } }); g.impact();
    assert.equal(g.u.stats.taken, 0); if (active) assert.equal(g.u.skill.ammoLeft, 2);
    assert.deepEqual(g.b.errors, []);
  }
});
test('the ground-only selector rejects flying and concealed targets; removed recipients are not charged', () => {
  for (const mode of ['air', 'stealth', 'camou']) {
    const f = fixture(); if (mode === 'air') f.u.motion = 'FLY';
    else f.b.addBuff(f.u, { key: 'conceal', flags: { [mode]: true } });
    f.run(5); assert.equal(f.e.stats.attacks, 0, mode); assert.equal(f.u.skill.ammoLeft, 3);
  }
  const f = fixture(); f.shot(); f.u.deployed = false; f.run(.2);
  assert.equal(f.u.skill.ammoLeft, 3); assert.equal(f.u.stats.taken, 0); assert.deepEqual(f.b.errors, []);
});
test('admission rejects changed ammo branches, payload damage and projectile transport', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], index.prefabs, native).policy);
  for (const kind of ['trait-ammo', 'emit-event', 'damage', 'speed', 'silenceable']) {
    const changed = structuredClone(native), id = ids[0], r = ENEMY_RECORDS.enemies[id].levels[0];
    const root = changed.templates['hlegle_a[steal]'].eventToActions.ON_BUFF_START[0];
    if (kind === 'trait-ammo') root._conditionNode._targetType = 'BUFF_SOURCE';
    if (kind === 'emit-event') root._succeedNodes[0]._failNodes[0]._triggerConsumeEvent = true;
    if (kind === 'damage') root._failNodes[0]._defaultAtkScale = 2;
    if (kind === 'speed') {
      const row = changed.projectiles.projectile_enemy_hlegle.find(c => '_speed' in JSON.parse(c.originalJson));
      const data = JSON.parse(row.originalJson); data._speed = 5; row.originalJson = JSON.stringify(data);
    }
    if (kind === 'silenceable') {
      const row = changed.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`].find(c => c.objectName === 'Attack' && '_activeBuffs' in JSON.parse(c.originalJson));
      const data = JSON.parse(row.originalJson); data._activeBuffs[0].isSilenceable = 1; row.originalJson = JSON.stringify(data);
    }
    assert.equal(ammoTheftNative(r, nativeComponents(changed, id)), false, kind);
  }
});
