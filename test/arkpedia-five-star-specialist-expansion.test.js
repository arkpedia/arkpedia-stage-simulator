// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-specialist-expansion-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile } from '../server/sim/ai.js';
const FIG = 'char_4155_talr';
const close = (value, want) => assert.ok(Math.abs(value - want) < 1e-5, `${value} != ${want}`);
function make({ skill = 0, rank = 10, elite = 2, potential = 1 } = {}) {
  const src = structuredClone(data); src.stage.geometry.waves[0].spawns = [];
  src.stage.battle.dp_per_second = 0;
  const op = src.operators[FIG], build = { ...defaultBuild(op), elite,
    level: op.phases[elite].maxLevel, skillId: op.skills[skill].id, skillRank: rank, potential };
  const b = new StandardBattle(src, { operators: [build] }); b.autoFinish = false;
  b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const u = b.deployOperator(FIG, 3, 4, 'RIGHT'); u.atkCd = 1000;
  return { b, u };
}
function step(b, seconds) { for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step(); assert.deepEqual(b.errors, []); }
function foe(b, col = 5) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [3, col] });
  e.def = { ...e.def, immune: new Set(e.def.immune) };
  e.base.maxHp = 100000; e.base.def = 300; e.base.res = 0; e.base.moveSpeed = 0;
  e.markDirty(); void e.s; e.hp = 100000;
  b.addBuff(e, { key: 'test:quiet', flags: { disarm: true } }); b._buildEnemyIndex(); return e;
}
function activate(u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(u.skill.activate('test'), true); u.skill.rule = 'NEVER'; }
test('Figurino keeps both original skills and source selectors, and loads every rank', () => {
  assert.match(evidence.sourceBundles[0].sha256, /^[a-f0-9]{64}$/);
  for (const skill of [0, 1]) for (let rank = 1; rank <= 10; rank++) {
    const { b, u } = make({ skill, rank }); assert.equal(u.skill.noSkill, false); assert.deepEqual(b.errors, []);
  }
  const selector = evidence.skills.skchr_talr_2.flatMap(x => x.components)
    .find(x => x.data._maxTargetKey === 'max_target').data;
  assert.deepEqual(selector._abnormalFlags, [13]); assert.equal(selector._filterAbnormalImmune, 1);
});
test('merchant upkeep charges at3s, never refunds and auto-withdraws without enough DP', () => {
  const { b, u } = make(); const dp = b.dp; step(b, 2.9); close(b.dp, dp);
  step(b, .2); close(b.dp, dp - 3);
  b.retreatOperator(FIG); close(b.dp, dp - 3);
  b.bench[FIG].readyAt = b.time; b.addDp('arkpedia', 99);
  const again = b.deployOperator(FIG, 3, 4, 'RIGHT'); b.addDp('arkpedia', -b.dp);
  step(b, 3.1); assert.equal(again.alive, false); assert.equal(again.removeReason, 'merchant');
  assert.ok(b.bench[FIG].readyAt > b.time);
});
test('talent scales mitigated output, does not boost his own blocked enemy, and applies to DOT', () => {
  const { b, u } = make(); const e = foe(b);
  close(b.dealDamage(u, e, { amount: 1000, type: 'phys' }), 700 * 1.2);
  e.blockedBy = u; close(b.dealDamage(u, e, { amount: 1000, type: 'phys' }), 700);
  e.blockedBy = null; close(b.dealDamage(u, e, { amount: 1000, type: 'phys', isAttack: false }), 840);
  b.addBuff(e, { key: 'test:resistance', mods: { flatDamageResistance: 100 } });
  close(b.dealDamage(u, e, { amount: 1000, type: 'phys' }), 740, 'source multiplier precedes flat resistance');
});
test('S1 extends the source range, stays active, and retains original capped event timing', () => {
  const { b, u } = make(); const atk = u.s.atk; activate(u);
  close(u.s.atk, atk * 1.6); assert.ok(u.liveRangeGrid.some(([r, c]) => r === 0 && c === 2));
  const p = effectiveProfile(u); close(p.windup(b, u), .533);
  b.addBuff(u, { key: 'test:fast', mods: { aspd: 100 } }); close(p.windup(b, u), .533);
  step(b, 12); assert.equal(u.skill.active, true);
});
test('S2 requires eligible targets, locks four, rejects flying/bound/immune and cleans up on retreat', () => {
  const { b, u } = make({ skill: 1 }); u.skill.setSpTotal(u.skill.spCost);
  assert.equal(u.skill.activate('test'), false);
  const all = Array.from({ length: 8 }, (_, i) => foe(b, 4.2 + i * .2));
  all[5].motion = 'FLY'; all[6].def.immune.add('bind');
  b.addBuff(all[7], { key: 'test:bound', flags: { bind: true } });
  activate(u);
  assert.equal(all.filter(e => e.findBuff(`talr:bind:${u.id}`)).length, 4);
  assert.ok(all.slice(5).every(e => !e.findBuff(`talr:bind:${u.id}`)));
  assert.equal(u.s.flags.disarm, true); b.retreatOperator(FIG);
  assert.ok(all.every(e => !e.findBuff(`talr:bind:${u.id}`)));
});
test('S2 delayed1s pulses, 25DP over8s plus normal upkeep, no normal attack and derived cleanup', () => {
  const { b, u } = make({ skill: 1 }); const e = foe(b, 5.8), hp = e.hp, dp = b.dp;
  activate(u); step(b, .9); close(e.hp, hp); close(b.dp, dp - 2);
  step(b, .2); close(hp - e.hp, (u.s.atk * 1.6 - e.s.def) * 1.2);
  step(b, 7); close(b.dp, dp - 25 - 6); assert.equal(u.skill.active, false);
  assert.equal(e.findBuff(`talr:bind:${u.id}`), null);
});
test('S2 does not retarget dead recipients and ends at the native empty-recipient check', () => {
  const { b, u } = make({ skill: 1 }); const e = foe(b); activate(u);
  b.kill(e, null); const replacement = foe(b); step(b, .4);
  assert.equal(u.skill.active, false); assert.equal(!!replacement.s.flags.bind, false);
  close(replacement.hp, 100000);
});
