// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make, cast, ready, until, advance, near, enemy} from './helpers/aphrissa-s3-fixture.js';
import {APHRISSA_S3_CONTRACT as contract} from '../server/sim/content/arkpedia-aphrissa-s3.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
const STATS = 'aphris_sk3[on_finish]', MODE = 'aphris_sk3_switch_mode';

for (let rank = 1; rank <= 10; rank++) test(`S3 rank ${rank} composes the selected three-second charge and twenty-round account`, () => {
  const f = make({rank}), base = f.u.s.atk, state = cast(f), started = f.b.time;
  assert.equal(f.u.skill.ammoLeft, 20); assert.equal(f.u.skill.ammoMax, 20); assert.equal(f.u.skill.active, true);
  assert.equal(f.u.s.flags.disarm, true); assert.equal(f.controller.deck.stock, 3); near(f.u.s.atk, base);
  advance(f.b, 2.9); assert.equal(state.stage, 'charge'); near(f.u.skill.sp, 0); assert.equal(f.u.skill.ammoLeft, 20);
  until(f, () => state.stage === 'active'); near(f.b.time - started, 3, f.b.dt + 1e-6);
  near(f.u.s.atk, base * (1 + f.selected.bb.atk));
  near(f.u.s.interval, 2.9 + f.selected.bb.base_attack_time);
  assert.equal(f.controller.mode, 's3'); assert.equal(f.u.s.flags.disarm, undefined);
  advance(f.b, 2); assert.equal(f.u.skill.ammoLeft, 20); assert.equal(f.receipts.length, 0);
});

test('S3 refuses activation during original Start, then uses natural SP without automatic casting', () => {
  const f = make(); f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate(), false);
  advance(f.b, 1); assert.equal(f.u.skill.activate(), true);
  const natural = make(); advance(natural.b, 8);
  assert.equal(natural.u.skill.ready, true); assert.equal(natural.starts.length, 0);
});

for (const dir of ['UP', 'DOWN', 'RIGHT']) test(`${dir} S3 uses literal charge Begin/Loop/End and active mode clips`, () => {
  const f = make({dir}), prefix = dir === 'DOWN' ? 'Skill_Down_3' : 'Skill_3'; cast(f);
  assert.equal(f.u.mem.regularFormVisual.clip, `${prefix}_Charge_Begin`);
  until(f, () => f.controller.state.animation === 'loop');
  assert.equal(f.u.mem.regularFormVisual.clip, `${prefix}_Charge_Loop`);
  until(f, () => f.controller.state.animation === 'end', 3);
  assert.equal(f.u.mem.regularFormVisual.clip, `${prefix}_Charge_End`);
  until(f, () => f.controller.state.stage === 'active');
  assert.equal(f.u.mem.regularFormVisual.clip, `${prefix}_Idle`);
  f.u.skill.end('manual'); assert.equal(f.u.mem.regularFormVisual.clip, `${prefix}_End`);
});

test('Cast entry withdraws old relays, permits three permanent replacements and composes nonstacking relay ATK', () => {
  const f = make(), base = f.u.s.atk, old = f.controller.deck.place(5, 7); cast(f);
  assert.equal(old.deployed, false); assert.equal(f.controller.deck.stock, 3);
  const a = f.controller.deck.place(5, 7, 'RIGHT'), z = f.controller.deck.place(5, 8, 'UP');
  const third = f.controller.deck.place(6, 8, 'RIGHT');
  assert.ok([a, z, third].every(unit => unit.findBuff('aphris_sk1_token')));
  until(f, () => f.controller.state.stage === 'active', 4); near(f.u.s.atk, base * (1 + f.selected.bb.atk + .25));
  advance(f.b, 27); assert.ok([a, z, third].every(unit => unit.deployed)); assert.equal(f.u.skill.ammoLeft, 20);
  f.u.skill.end('manual'); assert.ok([a, z, third].every(unit => !unit.deployed));
  assert.equal(f.controller.deck.stock, 1); near(f.controller.deck.readyAt, f.b.time); near(f.u.s.atk, base);
});

test('One accepted multi-target S3 attack spends one round despite separate relay-extra damage', () => {
  const f = make(); ready(f); f.controller.deck.place(5, 7, 'RIGHT');
  enemy(f, {hp: 1e7}); enemy(f, {col: 8, hp: 1e7}); until(f, () => f.hits.length === 3);
  assert.equal(f.receipts.length, 1); assert.equal(f.u.skill.ammoLeft, 19);
  assert.equal(new Set(f.hits.map(hit => hit.attackId)).size, 1); assert.ok(f.hits.every(hit => hit.isSkill));
  near(f.hits[0].amount, f.selected.stats.atk * (1 + f.selected.bb.atk + .25) * 2);
});

test('The actual final round drains all accepted staggered recipients before retiring stats, mode and relays', () => {
  const f = make(); ready(f); const token = f.controller.deck.place(5, 7, 'RIGHT');
  const first = enemy(f, {hp: 1e7}), later = enemy(f, {col: 8, hp: 1e7});
  until(f, () => f.receipts.filter(r => r.isSkill).length === 20, 50);
  assert.equal(f.u.skill.active, false); assert.equal(f.controller.state.stage, 'drain');
  assert.ok(f.u.findBuff(STATS)); assert.ok(f.u.findBuff(MODE)); assert.equal(token.deployed, true);
  until(f, () => !f.controller.state, 1);
  const skillHits = f.hits.filter(hit => hit.isSkill);
  assert.equal(skillHits.filter(hit => hit.id === first.id).length, 20);
  assert.equal(skillHits.filter(hit => hit.id === later.id).length, 40);
  const expected = f.selected.stats.atk * (1 + f.selected.bb.atk + .25);
  near(skillHits.at(-2).amount, expected * .3); near(skillHits.at(-1).amount, expected * 2);
  assert.equal(f.receipts.filter(r => r.isSkill).length, 20); assert.equal(f.ends.length, 1);
  assert.equal(f.u.findBuff(STATS), null); assert.equal(f.u.findBuff(MODE), null); assert.equal(token.deployed, false);
  assert.equal(f.controller.deck.stock, 1);
});

test('Manual cancel during charge drops unborn work and restores one ready baseline relay card', () => {
  const f = make(); cast(f); const token = f.controller.deck.place(5, 7);
  advance(f.b, 1); f.u.skill.end('manual');
  assert.equal(f.controller.state, null); assert.equal(token.deployed, false); assert.equal(f.controller.deck.stock, 1);
  assert.equal(f.u.findBuff('aphris_sk3[mark]'), null); assert.equal(f.u.s.flags.disarm, undefined);
  advance(f.b, 4); assert.equal(f.u.findBuff(STATS), null); assert.equal(f.receipts.length, 0);
});

test('Control during charge does not spend ammunition and the held charge clock does not restart', () => {
  const f = make(); const state = cast(f); enemy(f, {hp: 1e7});
  f.b.addBuff(f.u, {key: 'fixture:control', flags: {stun: true}});
  advance(f.b, 3.5); assert.equal(state.stage, 'active'); assert.equal(f.u.skill.ammoLeft, 20);
  assert.equal(f.hits.length, 0); f.b.removeBuff(f.u, 'fixture:control');
  until(f, () => f.hits.length === 1); assert.equal(f.u.skill.ammoLeft, 19); assert.equal(f.starts.length, 1);
});

test('A cancelled or empty S3 release does not consume a round', () => {
  const f = make(); ready(f); const target = enemy(f, {hp: 1e7});
  f.b.on('beforeAttack', context => { if (context.attacker === f.u) context.cancel = true; });
  advance(f.b, 4); assert.equal(f.u.skill.ammoLeft, 20); assert.equal(f.receipts.length, 0);
  assert.equal(target.hp, target.s.maxHp);
});

test('Removing the stat parent performs its relay cleanup independently of the mode and account', () => {
  const f = make(); ready(f); const token = f.controller.deck.place(5, 7);
  f.b.removeBuff(f.u, f.u.findBuff(STATS)); assert.equal(token.deployed, false);
  assert.equal(f.u.skill.active, true); assert.ok(f.u.findBuff(MODE));
  near(f.u.s.atk, f.selected.stats.atk); assert.equal(f.controller.deck.stock, 1);
});

test('A missing mode parent never borrows ordinary attacks to spend the S3 mode counter', () => {
  const f = make(); ready(f); enemy(f, {hp: 1e7}); f.b.removeBuff(f.u, f.u.findBuff(MODE));
  advance(f.b, 4); assert.equal(f.u.skill.ammoLeft, 20); assert.equal(f.receipts.length, 0);
  assert.equal(f.controller.mode, 'normal');
});

test('A rejected stat parent does not fabricate rejection of the separate mode grant', () => {
  const f = make(); f.b.on('beforeBuff', context => { if (context.buff.key === STATS) context.cancel = true; });
  ready(f); assert.equal(f.u.findBuff(STATS), null); assert.ok(f.u.findBuff(MODE));
  near(f.u.s.atk, f.selected.stats.atk); enemy(f, {hp: 1e7}); until(f, () => f.hits.length === 1);
});

for (const reason of ['death', 'life', 'slot', 'account', 'battleEnd'])
  test(`S3 ${reason} retirement drains its charge/active account, all relay lives and owned hooks`, () => {
    const f = make(); ready(f); const a = f.controller.deck.place(5, 7), z = f.controller.deck.place(5, 8);
    if (reason === 'death') f.b.kill(f.u, null);
    if (reason === 'life') { f.u.deploySeq++; advance(f.b, .1); }
    if (reason === 'slot') { f.u.mem.aphrissaS3Owner = {}; advance(f.b, .1); }
    if (reason === 'account') {
      f.u.skill = Object.create(Object.getPrototypeOf(f.u.skill), Object.getOwnPropertyDescriptors(f.u.skill)); advance(f.b, .1);
    }
    if (reason === 'battleEnd') f.b._finish('fixture');
    assert.equal(a.deployed, false); assert.equal(z.deployed, false); assert.equal(f.controller.handles.length, 0);
    assert.ok(f.controller.parts.every(part => part.handles.length === 0));
    assert.equal(f.u.findBuff(STATS), null); assert.equal(f.u.findBuff(MODE), null);
  });

test('S3 HUD shows the real ammunition account and allows the native manual discard', () => {
  const f = make(); cast(f); const hud = skillHud(f.u.skill);
  assert.equal(hud.text, '20 ammo remaining'); assert.equal(hud.canCancel, true); assert.equal(hud.canActivate, false);
});

test('Replacement presentation survives charge transitions and account cancellation', () => {
  const f = make(); cast(f); const foreign = f.u.mem.regularFormVisual = {clip: 'fixture:foreign'};
  until(f, () => f.controller.state.stage === 'active', 4); assert.equal(f.u.mem.regularFormVisual, foreign);
  f.u.skill.end('manual'); until(f, () => !f.controller.tail); assert.equal(f.u.mem.regularFormVisual, foreign);
});

test('Unreviewed S3 contracts and changed selected source values reject rather than enabling a fallback', () => {
  assert.throws(() => make({contract: {...contract}}), /exact S3 owner/);
  assert.throws(() => make({skill: 2}), /Changed original Aphrissa S3 owner/);
  assert.throws(() => make({mutate: def => { def.skill.bb['attack@trigger_time'] = 40; }}), /Incomplete original/);
});

test('Cancellation inside initial relay withdrawal cannot orphan the newly granted S3 lease', () => {
  const f = make(), old = f.controller.deck.place(5, 7);
  f.b.on('death', ({unit}) => { if (unit === old) f.u.skill.end('manual'); });
  until(f, () => f.b.time + 1e-7 >= f.controller.ordinary.bornUntil, 2);
  f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate(), true);
  assert.equal(f.u.skill.active, false); assert.equal(f.controller.state, null);
  assert.equal(f.controller.deck.lease, null); assert.equal(f.controller.deck.stock, 1);
  assert.equal(f.u.findBuff('aphris_sk3[mark]'), null); assert.equal(f.u.findBuff('aphris_sk3[sheltering]'), null);
});
