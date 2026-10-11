// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { deployRegularSummon, retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { summonRecordFor } from '../shared/arkpedia/summons.js';
const ID = 'char_1012_skadi2', TOKEN = 'token_10017_skadi2_dedant', KEY = `summon:${ID}`, ALLY = 'char_208_melan';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, s) { for (let i = 0; i < Math.ceil(s / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, allyId = ALLY } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build, defaultBuild(d.operators[allyId])] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia', 99); const u = b.deployOperator(ID, 5, 5, 'RIGHT'); u.skill.rule = 'NEVER';
  const ally = (row = 5, col = 6) => { b.addDp('arkpedia', 99);
    const a = b.deployOperator(allyId, row, col, 'RIGHT'); a.atkCd = 1000; a.skill.rule = 'NEVER'; return a; };
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  const activate = () => { u.skill.setSpTotal(u.skill.spCost);
    if (skill === 1) { u.skill.rule = 'SP_FULL'; advance(b, b.dt); assert.equal(u.skill.active, true); }
    else assert.equal(b.activateOperator(ID), true); };
  const place = (row = 5, col = 7) => { b.addDp('arkpedia', 99); return deployRegularSummon(b, KEY, row, col); };
  return { b, u, ally, activate, place, receipts, build, state: b.regularSummons?.get(KEY) };
}
function enemy(b, { x = 6, y = 5, flag, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: 100000, def: 1000, res: 95, moveSpeed: 0 }); e.markDirty(); void e.s;
  e.hp = 100000; if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true, ...(flag ? { [flag]: true } : {}) } });
  b._buildEnemyIndex(); return e;
}
test('all thirty owner/token ranks preserve selected values, promotion rules and hidden passive wrappers', () => {
  for (const skill of [0, 1, 2]) for (let rank = 1; rank <= 10; rank++) {
    const { b, u, state, activate, place } = make({ skill, rank });
    const expected = { ...u.skill.bb }; delete expected.hp_ratio;
    assert.deepEqual(state.record.skill.bb, expected);
    assert.equal(state.stock, 1); assert.equal(state.record.stats.cost, 5);
    activate(); const t = place(); assert.equal(t.skill.noSkill, true); assert.equal(t.mem.skadi2Mode, skill + 1);
    assert.equal(t.base.atk, 100); assert.equal(b.deployedSlots(), 1); assert.deepEqual(b.errors, []);
  }
  const e0 = make({ elite: 0 }); assert.equal(e0.state, undefined);
  const e1 = make({ elite: 1 }); assert.equal(e1.state.record.talents[0].bb.duration, 15);
  assert.throws(() => summonRecordFor(ID, { ...e1.build, skillId: 'skchr_skadi2_3' }, data.tokens), /Unsupported/);
  assert.throws(() => summonRecordFor(ID, { ...e1.build, skillRank: 10 }, data.tokens), /Unsupported/);
});
test('Seaborn validation rejects unknown skills, blackboards, cooldowns and missing lifetime', () => {
  const { build } = make();
  assert.throws(() => summonRecordFor(ID, { ...build, skillId: 'fake' }, data.tokens), /Unsupported/);
  for (const change of [r => r.skills[0].levels[9].blackboard.push({ key: 'fake', value: 1 }),
    r => r.phases[2].attributesKeyFrames.forEach(k => k.data.respawnTime = 20), r => r.talents = []]) {
    const tokens = structuredClone(data.tokens); change(tokens[TOKEN]);
    assert.throws(() => summonRecordFor(ID, build, tokens), /Unreviewed/);
  }
});
test('all thirty ranks apply their selected healing, MaxHP, Inspiration and True-damage coefficients', () => {
  for (const skill of [0, 1, 2]) for (let rank = 1; rank <= 10; rank++) {
    const { b, u, ally, activate } = make({ skill, rank }), a = ally();
    const baseAtk = a.s.atk, baseDef = a.s.def;
    a.hp = 100; const e = enemy(b); activate(); const atk = u.s.atk;
    if (skill === 0) {
      near(u.s.maxHp, u.base.maxHp * (1 + u.skill.bb.max_hp));
      near(a.hp, 100 + atk * u.skill.bb['attack@atk_to_hp_recovery_ratio']);
      near(a.s.atk, baseAtk);
    } else {
      near(a.s.atk, baseAtk + atk * u.skill.bb.atk);
      near(a.s.def, baseDef + (skill === 1 ? u.s.def * u.skill.bb.def : 0));
      if (skill === 1) near(a.hp, 100 + atk * u.skill.bb['attack@atk_to_hp_recovery_ratio']);
      else { advance(b, .91); near(e.hp, 100000 - atk * u.skill.bb.atk_scale); near(a.hp, 100); }
    }
    assert.deepEqual(b.errors, []);
  }
});
test('trait regenerates self and heal-free allies once per second, without attacks or overlapping double healing', () => {
  const { b, u, ally, place } = make(), a = ally(); const t = place();
  b.addBuff(a, { key: 'test:no-heal', flags: { healFree: true, noHeal: true, untargetable: true },
    mods: { healingTakenMul: .1, hpRegenMul: 2 } });
  a.hp = 100; u.hp = 100;
  advance(b, .99); near(a.hp, 100 + u.s.atk * .1 * 2); near(u.hp, 100 + u.s.atk * .1);
  advance(b, 1); near(a.hp, 100 + u.s.atk * .1 * 4);
  assert.equal(t.stats.heal, 0); assert.equal(t.stats.dmg, 0);
  const e = enemy(b); advance(b, 2); near(e.hp, 100000); assert.equal(u.stats.dmg, 0);
  b.addBuff(a, { key: 'isolated', flags: { isolated: true } }); const hp = a.hp;
  advance(b, 2); near(a.hp, hp);
});
test('Predatory Habits uses other operators in either area, Abyssal overrides, and selected potentials', () => {
  for (const potential of [1, 5]) for (const allyId of [ALLY, 'char_263_skadi']) {
    const { b, u, ally, place } = make({ potential, allyId }); const base = u.s.atk;
    const a = ally(5, 11); advance(b, .1); near(u.s.atk, base);
    const t = place(5, 10); advance(b, .1);
    const ratio = allyId === ALLY ? potential >= 5 ? .09 : .06 : potential >= 5 ? .18 : .15;
    near(u.s.atk, base * (1 + ratio));
    retreatRegularSummon(b, `token:${t.id}`); advance(b, .1); near(u.s.atk, base);
    assert.equal(a.alive, true);
  }
  const { b, u, place } = make(); const base = u.s.atk; place(5, 6); advance(b, .1); near(u.s.atk, base);
});
test('S1 heals before MaxHP scaling, protects after mitigation, bypasses Skadi defenses and avoids overlap recursion', () => {
  const { b, u, ally, activate, place, receipts } = make(), a = ally(); place();
  u.hp = 10; b.addBuff(u, { key: 'test:heal-free', flags: { healFree: true } }); activate();
  near(u.s.maxHp, u.base.maxHp * 2.7); near(u.hp, u.s.maxHp);
  b.addBuff(a, { key: 'test:mitigation', mods: { defFlat: 200 - a.base.def, dmgTakenMul: .5 } });
  b.addBuff(u, { key: 'test:owner-immunity', flags: { invulnerable: true }, shield: 1000,
    mods: { defFlat: 99999, trueTakenMul: .01, dmgTakenMul: .01 } });
  const e = enemy(b), h = u.hp, ah = a.hp;
  near(b.dealDamage(e, a, { amount: 1000, type: 'phys', isAttack: true }), 200);
  near(a.hp, ah - 200); near(u.hp, h - 200);
  const transferred = receipts.find(r => r.target === u && r.dmg.tags.includes('skadi2:share'));
  assert.ok(transferred.dmg.tags.includes('hpLoss')); assert.equal(transferred.dmg.noSp, true);
  assert.equal(transferred.dmg.origin.type, 'phys');
  assert.equal(receipts.filter(r => r.target === u).length, 1);
  const old = u.hp; b.loseHp(a, 100, { source: e }); near(u.hp, old);
  b.addBuff(a, { key: 'test:shield', shield: 100 }); const skadiBefore = u.hp, allyBefore = a.hp;
  near(b.dealDamage(e, a, { amount: 1000, type: 'arts' }), 150); // 1000*.5*.5 - shield100
  near(u.hp, skadiBefore - 250); near(a.hp, allyBefore - 150);
  u.skill.end(); near(u.s.maxHp, u.base.maxHp);
  const after = u.hp; b.dealDamage(e, a, { amount: 100, type: 'true' }); near(u.hp, after);
});
test('S1 does not transfer cancelled/dodged damage or element buildup, and transfer may kill the owner', () => {
  const { b, u, ally, activate, receipts } = make(), a = ally(); activate(); const e = enemy(b);
  b.addBuff(a, { key: 'test:immune', flags: { invulnerable: true } });
  b.dealDamage(e, a, { amount: 1000, type: 'phys' }); assert.equal(receipts.length, 0);
  b.removeBuff(a, 'test:immune'); b.addBuff(a, { key: 'test:dodge', mods: { dodgePhys: 1 } });
  b.dealDamage(e, a, { amount: 1000, type: 'phys' }); assert.equal(receipts.length, 0);
  const hp = u.hp; b.dealDamage(e, a, { amount: 100, type: 'element', element: 'burn' }); near(u.hp, hp);
  b.removeBuff(a, 'test:dodge'); u.hp = 1;
  b.dealDamage(e, a, { amount: 100, type: 'true' }); assert.equal(u.alive, false);
  const last = a.hp; b.dealDamage(e, a, { amount: 100, type: 'true' }); near(a.hp, last - 100);
});
test('S2 auto casts without a target, shares live owner ATK/DEF, excludes immune bards and survives indefinitely', () => {
  const { b, u, ally, place } = make({ skill: 1 }), a = ally(5, 10); const baseAtk = a.s.atk, baseDef = a.s.def; const t = place(5, 9);
  u.skill.rule = 'SP_FULL'; advance(b, 56.2); assert.equal(u.skill.active, true);
  const t2 = place(5, 9); advance(b, .1);
  near(a.s.atk, baseAtk + u.s.atk * .6); near(a.s.def, baseDef + u.s.def * .6);
  near(u.s.atk, u.base.atk * 1.06); assert.equal(u.findBuff(`skadi2:inspire:${u.id}`), null);
  b.addBuff(u, { key: 'test:external', mods: { atkFlat: 100, defFlat: 100 } });
  advance(b, 1.1); near(a.s.atk, baseAtk + u.s.atk * .6); near(a.s.def, baseDef + u.s.def * .6);
  b.addBuff(a, { key: 'immune_to_encourage' }); advance(b, .1); near(a.s.atk, baseAtk);
  b.removeBuff(a, 'immune_to_encourage'); b.addBuff(a, { key: 'isolated', flags: { isolated: true } });
  advance(b, .1); near(a.s.atk, baseAtk + u.s.atk * .6);
  advance(b, 30); assert.equal(u.skill.active, true); assert.equal(t.alive, false); assert.equal(t2.alive, false);
  near(a.s.atk, baseAtk); b.retreat(u); assert.deepEqual(b.errors, []);
});
test('Inspiration chooses highest ratio rather than largest final value, with independent fallback channels', () => {
  const { b, u, ally, activate } = make({ skill: 1 }), a = ally(); const baseAtk = a.s.atk, baseDef = a.s.def; activate();
  b.addBuff(a, { key: 'test:large-weaker', tags: ['inspire'],
    mods: { atkFinalFlat: 10000, defFinalFlat: 10000 }, data: { inspirePriority: { atkFinalFlat: .5, defFinalFlat: .5 } } });
  b.addBuff(a, { key: 'test:small-stronger', tags: ['inspire'], mods: { atkFinalFlat: 10 },
    data: { inspirePriority: { atkFinalFlat: 1.1 } } });
  near(a.s.atk, baseAtk + 10); near(a.s.def, baseDef + u.s.def * .6);
  b.removeBuff(a, 'test:small-stronger'); near(a.s.atk, baseAtk + u.s.atk * .6);
  b.retreat(u); near(a.s.atk, baseAtk + 10000); near(a.s.def, baseDef + 10000);
});
test('S3 owner and Seaborn damage wait on different source clocks, stack and credit owner ATK', () => {
  const { b, u, ally, place, activate, receipts } = make({ skill: 2 }); ally(); const t = place();
  const e = enemy(b), air = enemy(b, { fly: true }), outside = enemy(b, { x: 18 });
  const hp = u.hp; activate(); advance(b, .8); near(e.hp, 100000); near(u.hp, hp);
  advance(b, .067); const first = receipts.filter(r => r.target === e);
  assert.equal(first.length, 1); assert.ok(first[0].dmg.tags.includes('skadi2:seaborn'));
  advance(b, .034); assert.equal(receipts.filter(r => r.target === e).length, 2);
  near(e.hp, 100000 - u.s.atk * .7 * 2); near(air.hp, e.hp); near(outside.hp, 100000);
  for (const r of receipts.filter(r => r.target === e)) assert.equal(r.source, u);
  assert.equal(t.stats.dmg, 0); advance(b, .067); near(u.hp, hp - u.s.maxHp * .05);
  assert.ok(receipts.find(r => r.target === u).dmg.tags.includes('hpLoss'));
  advance(b, 1); assert.equal(receipts.filter(r => r.target === e).length, 4);
  u.skill.end(); const before = e.hp; advance(b, 2); near(e.hp, before); assert.equal(t.mem.skadi2Mode, 0);
});
test('S3 skips unavailable targets, resets entry clocks, replaces healing and cleans pending pulses on withdrawal', () => {
  const { b, u, ally, activate, place, receipts } = make({ skill: 2 }), a = ally();
  const free = enemy(b, { flag: 'untargetable' }), invincible = enemy(b, { flag: 'invulnerable' });
  const e = enemy(b); activate(); a.hp = 100; advance(b, .5);
  near(a.hp, 100); b.addBuff(e, { key: 'test:free', flags: { untargetable: true } });
  advance(b, .6); near(e.hp, 100000); near(free.hp, 100000); near(invincible.hp, 100000);
  b.removeBuff(e, 'test:free'); advance(b, .1); advance(b, .8); near(e.hp, 100000);
  advance(b, .2); assert.ok(e.hp < 100000);
  const t = place(5, 7); assert.equal(t.mem.skadi2Mode, 3); b.retreat(u);
  assert.equal(t.alive, false); const hp = e.hp; advance(b, 2); near(e.hp, hp);
  assert.equal(a.findBuff(`skadi2:inspire:${u.id}`), null);
  assert.ok(receipts.every(r => !r.dmg.tags.includes('skadi2:seaborn')));
});
test('Seaborn duration, finish-based cooldown, occupied tiles, DP and stock remain independent of owner skill', () => {
  for (const elite of [1, 2]) {
    const { b, u, state, place, activate } = make({ elite }); const dp = b.dp;
    const t = deployRegularSummon(b, KEY, 5, 7, 'LEFT'); near(b.dp, dp - 5);
    assert.equal(t.dir, 'RIGHT'); assert.equal(state.stock, 0); near(state.readyAt, 0);
    assert.equal(summonPlacementError(b, KEY, 5, 8), 'No summons remaining.');
    activate(); advance(b, 1); u.skill.end(); assert.equal(t.alive, true); assert.equal(t.mem.skadi2Mode, 0);
    advance(b, [0, 15, 25][elite] - 1.1); assert.equal(t.alive, true);
    advance(b, .2); assert.equal(t.alive, false); assert.equal(state.stock, 1);
    near(state.readyAt, b.time - .1 + 30); assert.match(summonPlacementError(b, KEY, 5, 8), /redeploying/);
    advance(b, 30); const next = place(); retreatRegularSummon(b, `token:${next.id}`);
    assert.equal(state.stock, 1); near(state.readyAt, b.time + 30);
  }
});
