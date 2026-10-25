// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { verifiedNative, verifiedChapter16FamilyGraph } from '../tools/arkpedia/enemy-support.mjs';
const bytes = p => readFileSync(new URL('../data/' + p, import.meta.url));
const read = p => JSON.parse(bytes(p));
const records = read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const key = 'enemy_1107_uoffcr', miner = 'enemy_3010_mcreep';
const proof = read('candidates/arkpedia-ch16-patrol-source.json'), review = read('candidates/arkpedia-ch16-reviewed-patrol.json');
function fixture(block = 0) {
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: installEnemyFeatures,
    defs: { enemies: Object.fromEntries([key, miner].map(k => [k, records[k].levels[0]])),
      chess: { dummy: chessRec({ id: 'dummy', stats: { maxHp: 1e6, atk: 0, def: 0, blockCnt: block } }) } },
    units: [{ chessId: 'dummy', row: 10, col: block ? 7 : 6 }] });
  h.b.start(); const e = h.spawn(key, { pos: [10, 7] }); e.base.moveSpeed = 0; e.markDirty();
  const spawn = (x = 8.25) => { const m = h.spawn(miner, { pos: [10, x] }); m.base.moveSpeed = 0; m.markDirty(); return m; };
  return { h, b: h.b, e, u: h.unit('dummy'), spawn };
}

test('original Patrol Captain selector/projectile graph reproduces its marked-neutral weapon contract', () => {
  for (const file of Object.values(review.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + file.path, import.meta.url))).digest('hex'), file.sha256);
  const index = read('arkpedia-enemy-clock-source.json');
  verifiedChapter16FamilyGraph(bytes('candidates/arkpedia-ch16-patrol-source.json'), bytes('arkpedia-cn-native-source.json'), bytes('arkpedia-cn-enemy-native-source.json'), index);
  verifiedNative(read('candidates/arkpedia-ch16-patrol-native.json'), index.prefabs,
    createHash('sha256').update(bytes('arkpedia-enemy-clock-source.json')).digest('hex'), read('arkpedia-mvp.json').behaviors.source);
  const nodes = Object.values(proof.prefabs)[0].map(r => JSON.parse(r.originalJson));
  const selector = nodes.find(n => n._buffKey === 'mark_neutral[effect]');
  assert.equal(selector._targetSide, 2); assert.equal(selector._maxNum, 1); assert.equal(selector._targetMotion, 1);
  const circle = nodes.find(n => n.m_GameObject?.m_PathID === selector.m_GameObject.m_PathID && 'm_Radius' in n);
  assert.equal(circle.m_Radius, review.defaults.radius);
  const projectile = Object.values(proof.projectiles)[0].map(r => JSON.parse(r.originalJson));
  assert.equal(projectile.find(n => '_speed' in n)._speed, 10);
  assert.equal(projectile.find(n => '_lifeTime' in n)._lifeTime, 5);
  assert.equal(projectile.find(n => '_lifeTime' in n)._stopWhenSourceInvalid, 0);
});

test('the existing public record equals its canonical counterpart; no substitute enemy data is needed', () => {
  assert.deepEqual(read('arkpedia-enemy-records.json').enemies[key], records[key]);
  const { e } = fixture(); assert.equal(e.def.raw.stats.rawRangeRadius, 0);
  assert.equal(e.base.rangeRadius, review.defaults.radius); assert.ok(e.profile.deferHit);
});

test('native ranged Attack reaches a marked miner while ignoring an unblocked operator', () => {
  const { h, b, e, u, spawn } = fixture(); const hp = u.hp;
  h.run(.2); assert.equal(e.stats.attacks, 0); assert.equal(u.hp, hp);
  const m = spawn(), before = m.hp; h.run(.04);
  assert.equal(e.stats.attacks, 1); assert.equal(m.hp, before); assert.equal(b.projectiles.list[0].speed, 10);
  h.run(.2); assert.equal(before - m.hp, 180); assert.equal(u.hp, hp); assert.deepEqual(b.errors, []);
});

test('unmarked, airborne and out-of-radius neutral units cannot trigger the weapon', () => {
  for (const mode of ['unmarked', 'airborne', 'outside']) {
    const { h, b, e, spawn } = fixture(), m = spawn(mode === 'outside' ? 8.31 : 8.2);
    if (mode === 'unmarked') b.removeBuff(m, 'mark_neutral[effect]');
    if (mode === 'airborne') b.addBuff(m, { key: 'fixture-air', flags: { float: true }, persist: true });
    h.run(.3); assert.equal(e.stats.attacks, 0, mode);
  }
});

test('Combat hits the actual blocker and keeps an independent cooldown from ranged Attack', () => {
  const { h, b, e, u, spawn } = fixture(1); const hp = u.hp;
  h.run(.1); assert.equal(hp - u.hp, 330); assert.equal(b.projectiles.list.length, 0);
  assert.ok(e.profile.attackCooldowns.combat > 1.8); assert.equal(e.profile.attackCooldowns.attack, 0);
  const m = spawn(); const before = m.hp; b.retreat(u); h.run(.04);
  assert.equal(e.stats.attacks, 2); assert.ok(e.profile.attackCooldowns.attack > 1.9);
  h.run(.2); assert.equal(before - m.hp, 180); assert.deepEqual(b.errors, []);
});

test('a born shell survives source death and reads its current attack value at impact', () => {
  const { h, b, e, spawn } = fixture(); const m = spawn(), hp = m.hp;
  h.run(.04); b.addBuff(e, { key: 'fixture-atk', mods: { atkFlat: 100 }, persist: true });
  b.kill(e, null); h.run(.2); assert.equal(hp - m.hp, 280); assert.deepEqual(b.errors, []);
});
