// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { make, enemy, ally, cast, near, advance, until } from './helpers/closur-combat-fixture.js';
const s3shots = f => f.shots.filter(p => p.data.nativeKey.endsWith('_s3'));
for (let rank = 1; rank <= 10; rank++) test(`S3 rank ${rank} selects original interval/scale/slow values and grants eighteen protected DP pulses`, () => {
  const f = make({ skill: 3, rank }); f.u.player.dp = 0; cast(f); const bb = f.record.bb;
  near(f.u.s.interval, .5); near(f.u.s.atk, f.u.base.atk);
  advance(f.b, 1.6); near(f.u.player.dp, 0); until(f, () => f.command.state.pulses === 1, .1); near(f.u.player.dp, 1);
  f.b.applyStatus(f.u, 'stun', { duration: 5 }); const sp = f.u.skill.spTotal;
  advance(f.b, 5); near(f.u.skill.spTotal, sp);
  until(f, () => !f.u.skill.active, 25); near(f.u.player.dp, 18); near(f.u.s.interval, 1);
  assert.equal(f.grants.length, 18);
  for (const [i, p] of f.grants.entries()) near(p.time, (i + 1) * bb['closur_s_3[add_cost_period].interval'], f.b.dt + 1e-5);
  const t = enemy(f); f.command.slow(t); near(t.s.moveSpeed, 1 - bb['attack@slow_down']);
});
for (const [dir, row, col, prefix] of [['RIGHT', 5, 7, 'Skill_3_'], ['LEFT', 5, 3, 'Skill_3_'],
  ['UP', 7, 5, 'Skill_3_'], ['DOWN', 3, 5, 'Skill_Down_3_']]) test(`${dir} S3 uses literal Begin/Loop/Idle and a delayed target attachment, not a traveling arrow`, () => {
  const f = make({ skill: 3, dir }), t = enemy(f, { row, col }); advance(f.b, 1.1); cast(f);
  assert.equal(f.u.mem.regularFormVisual.clip, prefix + 'Begin'); until(f, () => s3shots(f).length > 0, 2);
  assert.equal(f.u.mem.regularFormVisual.clip, prefix + 'Loop'); near(f.controller.phase.speed, 1);
  near(f.controller.phase.releaseAt - f.controller.phase.loopAt, .13333334028720856);
  const p = f.b.projectiles.list.find(p => p.data.nativeKey?.endsWith('_s3')); assert.ok(p?.attached);
  assert.equal(p.visual, 'none');
  near(p.x, t.x); near(p.y, t.y); assert.equal(f.hits.length, 0);
  t.x += .3; advance(f.b, f.b.dt); near(p.x, t.x); assert.equal(f.hits.length, 0);
  until(f, () => f.hits.length > 0, .5); near(f.hits[0].dmg.amount, f.u.s.atk * f.record.bb['attack@atk_scale']);
  assert.equal(f.hits[0].dmg.isSkill, false); assert.equal(f.hits[0].dmg.type, 'phys');
  assert.ok(f.hits[0].time - s3shots(f)[0].time >= .30000001192092896 - 1e-8);
  f.b.kill(t); advance(f.b, 1); assert.equal(f.u.mem.regularFormVisual.clip, prefix + 'Idle');
});
test('S3 selects at release: an old windup input can leave or die and a new in-range input can replace it', () => {
  for (const die of [false, true]) {
    const f = make({ skill: 3 }), a = enemy(f); cast(f);
    until(f, () => f.controller.phase?.kind === 'attack', 2);
    if (die) f.b.kill(a); else a.x = 15;
    const z = enemy(f, { col: 8 }); until(f, () => s3shots(f).length > 0, 1);
    assert.equal(s3shots(f)[0].target, z);
  }
});
test('S3 adds one target every nine accepted attacks, counts a multishot only once and caps at seven', () => {
  const f = make({ skill: 3 }); for (let i = 0; i < 9; i++) enemy(f); cast(f);
  for (let n = 1; n <= 55; n++) {
    until(f, () => f.attacks.length >= n, 1.5);
    const p = s3shots(f).filter(p => Math.abs(p.time - s3shots(f).at(-1).time) < 1e-8);
    near(p.length, Math.min(7, 1 + Math.floor((n - 1) / 9)));
    assert.equal(new Set(p.map(p => p.target)).size, p.length);
    near(f.command.state.maxTargets, Math.min(7, 1 + Math.floor(n / 9)));
  }
  near(f.command.state.upgrades, 6); assert.equal(f.u.skill.active, true);
  f.u.skill.end('diagnostic'); cast(f); near(f.command.state.maxTargets, 1); near(f.command.state.attacks, 0);
});
test('vetoed casts and out-of-band forceAttack calls do not grow S3 target count', () => {
  const f = make({ skill: 3 }), t = enemy(f); cast(f);
  f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u) ctx.cancel = true; });
  advance(f.b, 6); near(f.command.state.attacks, 0); near(f.command.state.maxTargets, 1);
  assert.equal(f.b.forceAttack(f.u, [t]), false); assert.equal(s3shots(f).length, 0);
});
test('S3 vision includes current owned reinforcement main ranges without recursively inheriting their extra ranges', () => {
  const f = make({ skill: 3 }); f.point.place(5, 6); const a = ally(f, { row: 7, col: 6 });
  until(f, () => f.point.active(), 1); const t = enemy(f, { row: 7, col: 7 });
  assert.deepEqual(f.controller.targets(), []); f.b.setExtraRange(a, [15 * 21 + 15]); cast(f);
  assert.ok(f.u.rangeKeySet.has(7 * 21 + 7)); assert.equal(f.u.rangeKeySet.has(15 * 21 + 15), false);
  assert.deepEqual(f.controller.targets(), [t]);
  a.rangeGrid = [[0, 0], [0, 3]]; f.b.refreshRange(a); f.command.refreshRange();
  assert.ok(f.u.rangeKeySet.has(7 * 21 + 9)); assert.equal(f.u.rangeKeySet.has(7 * 21 + 7), false);
  f.b.relocate(a, 10, 10); f.command.refreshRange(); assert.equal(f.u.rangeKeySet.has(7 * 21 + 9), false);
});
test('S3 keeps deployment range geometry independent of sprite facing and can hit owned reinforcement blockers outside the composite', () => {
  const f = make({ skill: 3 }); f.point.place(5, 6); const a = ally(f, { row: 7, col: 6 });
  until(f, () => f.point.active(), 1); const t = enemy(f, { row: 7, col: 12, blockedBy: a }); cast(f);
  assert.ok(!f.u.rangeKeySet.has(7 * 21 + 12)); until(f, () => f.hits.length > 0, 3);
  near(f.hits[0].dmg.amount, f.u.s.atk * 2.5 * 1.5); assert.equal(f.hits[0].target, t);
  f.point.rest(); f.command.refreshRange(); assert.deepEqual(f.controller.targets(), []);
});
test('S3 non-missable slow_down precedes physical damage even on a dodged attack; enemy-side tokens do not acquire it', () => {
  const f = make({ skill: 3 }), t = enemy(f); f.b.addBuff(t, { key: 'dodge', mods: { dodgePhys: 1 } });
  cast(f); until(f, () => t.buffs.some(b => b.data?.nativeSlowDown), 3);
  near(t.s.moveSpeed, .94); assert.equal(f.hits.length, 0);
  const g = make({ skill: 3 }), z = enemy(g); z.kind = 'token'; cast(g); until(g, () => g.hits.length > 0, 3);
  assert.equal(z.buffs.some(b => b.data?.nativeSlowDown), false);
});
test('a born S3 attachment survives owner retreat and skill expiry, but fizzles on target disappearance or replacement life', () => {
  for (const event of ['retreat', 'end', 'hidden', 'new-life']) {
    const f = make({ skill: 3 }), t = enemy(f); cast(f); until(f, () => s3shots(f).length > 0, 3);
    if (event === 'retreat') f.b.retreat(f.u, { permanent: true });
    if (event === 'end') f.u.skill.end('diagnostic');
    if (event === 'hidden') t.hidden = true;
    if (event === 'new-life') t.deploySeq++;
    advance(f.b, .4);
    assert.equal(f.hits.length, ['retreat', 'end'].includes(event) ? 1 : 0);
    assert.equal(t.buffs.some(b => b.data?.nativeSlowDown), ['retreat', 'end'].includes(event));
  }
});
test('S3 removes only its owned composite range on end and never banks later DP after retreat', () => {
  const f = make({ skill: 3 }); f.b.setExtraRange(f.u, [10 * 21 + 10]); f.point.place(5, 6); cast(f);
  assert.ok(f.u.rangeKeySet.has(7 * 21 + 6)); f.u.skill.end('diagnostic');
  assert.ok(f.u.rangeKeySet.has(10 * 21 + 10)); assert.equal(f.u.rangeKeySet.has(7 * 21 + 6), false);
  cast(f); advance(f.b, 2); f.b.retreat(f.u, { permanent: true }); const n = f.grants.length; advance(f.b, 5);
  assert.equal(f.grants.length, n);
});
test('a slow_down application hook cannot redirect an already born S3 hit into a new target lifetime', () => {
  const f = make({ skill: 3 }), t = enemy(f); cast(f);
  f.b.on('beforeBuff', ctx => { if (ctx.unit === t && ctx.buff.data?.nativeSlowDown) t.deploySeq++; });
  until(f, () => s3shots(f).length > 0, 3); advance(f.b, .4); assert.equal(f.hits.length, 0);
  assert.equal(t.buffs.some(b => b.data?.nativeSlowDown), false);
});
