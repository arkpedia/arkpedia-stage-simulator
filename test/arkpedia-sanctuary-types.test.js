// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6,
  `${actual} != ${expected}`);
function fixture() {
  const source = structuredClone(data);
  source.stage.geometry.waves[0].spawns = [];
  const b = new StandardBattle(source, { operators: [defaultBuild(source.operators.char_123_fang)] });
  b.autoFinish = false;
  b.setViewport('fullscreen-workspace');
  b.addDp('arkpedia', 99);
  const u = b.deployOperator('char_123_fang', 3, 7, 'LEFT');
  assert.ok(u);
  return { b, u };
}
function protection(b, u, key, value, includePure = false, duration = Infinity) {
  b.applyStatus(u, 'sanctuary', { key, value, includePure, duration });
}

test('ordinary Sanctuary bypasses True damage; explicit IncludePure reduces it but never HP loss', () => {
  const { b, u } = fixture();
  protection(b, u, 'ordinary', .4);
  let hp = u.hp;
  b.dealDamage(null, u, { amount: 100, type: 'true' });
  near(hp - u.hp, 100);
  protection(b, u, 'pure', .2, true);
  hp = u.hp;
  b.dealDamage(null, u, { amount: 100, type: 'true' });
  near(hp - u.hp, 80);
  hp = u.hp;
  b.loseHp(u, 100);
  near(hp - u.hp, 100);
  near(u.s.physTakenMul, .6);
  near(u.s.artsTakenMul, .6);
  near(u.s.trueTakenMul, .8);
  assert.deepEqual(b.errors, []);
});

test('stronger ordinary Sanctuary cannot suppress weaker IncludePure; owned removal falls back per type', () => {
  const { b, u } = fixture();
  protection(b, u, 'pure:weak', .2, true);
  protection(b, u, 'ordinary:strong', .6);
  protection(b, u, 'pure:strong', .4, true);
  near(u.s.physTakenMul, .4);
  near(u.s.artsTakenMul, .4);
  near(u.s.trueTakenMul, .6);
  b.removeBuff(u, 'pure:strong');
  near(u.s.physTakenMul, .4);
  near(u.s.trueTakenMul, .8);
  b.removeBuff(u, 'ordinary:strong');
  near(u.s.physTakenMul, .8);
  near(u.s.artsTakenMul, .8);
  b.removeBuff(u, 'pure:weak');
  near(u.s.physTakenMul, 1);
  near(u.s.trueTakenMul, 1);
});

test('IncludePure channels select strongest independently of source insertion and equal-value ties', () => {
  for (const reversed of [false, true]) {
    const { b, u } = fixture();
    const sources = [['ordinary', .5, false], ['pure', .5, true], ['weak', .2, true]];
    for (const args of reversed ? sources.reverse() : sources) protection(b, u, ...args);
    near(u.s.physTakenMul, .5);
    near(u.s.artsTakenMul, .5);
    near(u.s.trueTakenMul, .5);
    b.removeBuff(u, 'pure');
    near(u.s.physTakenMul, .5);
    near(u.s.trueTakenMul, .8);
  }
});

test('Sanctuary composes with unrelated Fragile in either insertion order without multiplying owned sources', () => {
  for (const fragileFirst of [false, true]) {
    const { b, u } = fixture();
    const fragile = () => b.applyStatus(u, 'fragile', { value: .5 });
    if (fragileFirst) fragile();
    protection(b, u, 'first', .2, true);
    protection(b, u, 'second', .4, true);
    if (!fragileFirst) fragile();
    const hp = u.hp;
    b.dealDamage(null, u, { amount: 100, type: 'true' });
    near(hp - u.hp, 90);
    near(u.s.trueTakenMul, .6);
    near(u.s.dmgTakenMul, 1.5);
  }
});

test('expiring strongest IncludePure resumes the weaker owned value while ordinary protection survives', () => {
  const { b, u } = fixture();
  protection(b, u, 'pure:long', .2, true);
  protection(b, u, 'pure:short', .5, true, .1);
  protection(b, u, 'ordinary', .6);
  for (let i = 0; i < 5; i++) b.step();
  near(u.s.physTakenMul, .4);
  near(u.s.trueTakenMul, .8);
  assert.equal(u.findBuff('pure:short'), null);
  assert.ok(u.findBuff('ordinary'));
  assert.deepEqual(b.errors, []);
});

test('default Sanctuary keys keep distinct type masks and expiry fallbacks in either application order', () => {
  for (const pureFirst of [false, true]) {
    const { b, u } = fixture();
    const pure = () => b.applyStatus(u, 'sanctuary', { value: .2, includePure: true });
    if (pureFirst) pure();
    b.applyStatus(u, 'sanctuary', { value: .6, duration: .1 });
    if (!pureFirst) pure();
    near(u.s.physTakenMul, .4);
    near(u.s.trueTakenMul, .8);
    for (let i = 0; i < 5; i++) b.step();
    near(u.s.physTakenMul, .8);
    near(u.s.trueTakenMul, .8);
    b.removeBuff(u, 'sanctuary:include-pure');
    near(u.s.physTakenMul, 1);
    near(u.s.trueTakenMul, 1);
  }
});
